// The match rules: turns, clock, goals, substitutions, puck health and the
// trick-shot shootout. Pure TypeScript, so the same code runs on the phone
// (local matches) and on the server (online matches).

import { PuckColorId, resolveColors } from './colors';
import { FORMATIONS } from './formations';
import {
  BALL_MASS,
  BALL_R,
  BLOCK_R,
  Body,
  CollideFn,
  FIELD_H,
  FIELD_W,
  GOAL_BOTTOM,
  GOAL_TOP,
  PIECE_MASS,
  PIECE_R,
  POSTS,
  POST_R,
  isInGoal,
  isMoving,
  step,
} from './physics';
import {
  MAX_HEALTH,
  SHOT_DRAIN,
  drainMultiplier,
  effectiveness,
  maxDeviationDeg,
  maxShotSpeed,
} from './pucks';
import type { FormationId, MatchResult, MatchSettings, PuckData, StatLevels, Team } from './types';

export const TURN_SECONDS = 15;
export const SUB_SECONDS = 30;
export const MAX_SUBS = 3;
export const GOAL_PAUSE = 2.5;
export const KEEPER_SECONDS = 8;
export const KICK_SECONDS = 12;
export const KICK_RESULT_PAUSE = 1.8;
export const SHOOTOUT_KICKS = 5;
export const MIN_DRAG = 12;
export const MAX_DRAG = 170;
export const EJECT_SECONDS = 0.5; // how long a puck takes to slide out of a goal

// A puck during one match (health resets to full every match)
export type SquadPuck = {
  id: string;
  name: string;
  number: number;
  levels: StatLevels;
  health: number;
  matchGoals: number;
  matchShots: number;
};

export type Side = {
  name: string;
  color: PuckColorId;
  formation: FormationId;
  squad: SquadPuck[];
  onField: string[]; // puck ids in formation slot order
  subbedOff: string[]; // can't come back on
  played: string[]; // every puck that appeared in this match
  subsLeft: number;
};

export type Phase =
  | 'aim' // current player picks a puck and shoots
  | 'moving' // pucks are sliding
  | 'eject' // everything stopped: pucks inside a goal slide back out
  | 'sub' // current player is making substitutions
  | 'goal' // goal celebration
  | 'so-keeper' // shootout: defender places the keeper
  | 'so-aim' // shootout: shooter takes the trick shot
  | 'so-moving'
  | 'so-result'
  | 'over';

export type Shootout = {
  kicks: [boolean[], boolean[]];
  shooter: Team;
  suddenDeath: boolean;
  lastScored: boolean | null;
  decided: Team | null;
};

export type MatchState = {
  settings: MatchSettings;
  sides: [Side, Side];
  bodies: Body[];
  phase: Phase;
  turn: Team;
  turnTime: number; // seconds left in this turn
  clock: number; // seconds left in the match (time mode)
  subTime: number;
  pause: number;
  score: [number, number];
  lastTouch: string | null; // body id of the last puck that touched the ball
  goalInfo: { team: Team; scorer: string | null } | null;
  ejects: Eject[];
  shootout: Shootout | null;
  winner: Team | null;
  wonOnShootout: boolean;
};

export type Eject = { id: string; fromX: number; fromY: number; toX: number; toY: number };

export type MatchInput =
  | { type: 'shoot'; pieceId: string; dx: number; dy: number }
  | { type: 'startSub' }
  | { type: 'sub'; outId: string; inId: string }
  | { type: 'endSub' }
  | { type: 'keeper'; y: number }
  | { type: 'keeperReady' };

export type SideSetup = {
  name: string;
  color: PuckColorId;
  formation: FormationId;
  pucks: PuckData[];
  lineup: string[];
};

export const other = (t: Team): Team => (t === 0 ? 1 : 0);
export const bodyId = (team: Team, puckId: string) => `${team}:${puckId}`;

export function parseBodyId(id: string) {
  const [team, puckId] = id.split(':');
  return { team: Number(team) as Team, puckId };
}

export function getSquadPuck(state: MatchState, id: string): SquadPuck | undefined {
  const { team, puckId } = parseBodyId(id);
  return state.sides[team]?.squad.find((p) => p.id === puckId);
}

/** Bench pucks that are allowed to come on */
export function eligibleBench(side: Side) {
  return side.squad.filter((p) => !side.onField.includes(p.id) && !side.subbedOff.includes(p.id));
}

/** Which team is allowed to act right now */
export function actingTeam(state: MatchState): Team {
  if (state.phase === 'so-keeper' && state.shootout) return other(state.shootout.shooter);
  return state.turn;
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

function createSide(setup: SideSetup, color: PuckColorId): Side {
  const byId = new Map(setup.pucks.map((p) => [p.id, p]));
  const ordered = [
    ...setup.lineup.map((id) => byId.get(id)).filter((p): p is PuckData => !!p),
    ...setup.pucks.filter((p) => !setup.lineup.includes(p.id)),
  ];
  const squad: SquadPuck[] = ordered.map((p) => ({
    id: p.id,
    name: p.name,
    number: p.number,
    levels: { ...p.levels },
    health: MAX_HEALTH,
    matchGoals: 0,
    matchShots: 0,
  }));
  const onField = squad.slice(0, 5).map((p) => p.id);
  return {
    name: setup.name,
    color,
    formation: setup.formation,
    squad,
    onField,
    subbedOff: [],
    played: [...onField],
    subsLeft: MAX_SUBS,
  };
}

export function createMatch(settings: MatchSettings, a: SideSetup, b: SideSetup): MatchState {
  const [colorA, colorB] = resolveColors(a.color, b.color);
  const state: MatchState = {
    settings,
    sides: [createSide(a, colorA), createSide(b, colorB)],
    bodies: [],
    phase: 'aim',
    turn: 0,
    turnTime: TURN_SECONDS,
    clock: settings.minutes * 60,
    subTime: 0,
    pause: 0,
    score: [0, 0],
    lastTouch: null,
    goalInfo: null,
    ejects: [],
    shootout: null,
    winner: null,
    wonOnShootout: false,
  };
  kickoff(state, 0);
  return state;
}

function makePiece(team: Team, puckId: string, x: number, y: number): Body {
  return { id: bodyId(team, puckId), kind: 'piece', team, x, y, vx: 0, vy: 0, r: PIECE_R, mass: PIECE_MASS };
}

function makeBall(x: number, y: number): Body {
  return { id: 'ball', kind: 'ball', x, y, vx: 0, vy: 0, r: BALL_R, mass: BALL_MASS };
}

/** Puts everyone back in formation; `team` kicks off */
function kickoff(state: MatchState, team: Team) {
  const bodies: Body[] = [];
  ([0, 1] as Team[]).forEach((t) => {
    const side = state.sides[t];
    const slots = FORMATIONS[side.formation].slots;
    side.onField.forEach((puckId, i) => {
      const slot = slots[i];
      const fx = t === 0 ? slot.x : 1 - slot.x;
      bodies.push(makePiece(t, puckId, fx * FIELD_W, slot.y * FIELD_H));
    });
  });
  bodies.push(makeBall(FIELD_W / 2, FIELD_H / 2));
  state.bodies = bodies;
  state.lastTouch = null;
  state.ejects = [];
  startTurn(state, team);
}

function startTurn(state: MatchState, team: Team) {
  state.turn = team;
  state.phase = 'aim';
  state.turnTime = TURN_SECONDS;
}

function finish(state: MatchState, winner: Team, onShootout = false) {
  state.phase = 'over';
  state.winner = winner;
  state.wonOnShootout = onShootout;
}

// ---------------------------------------------------------------------------
// Player actions
// ---------------------------------------------------------------------------

/** Applies one action from `team`. Returns false if it isn't allowed right now. */
export function applyInput(state: MatchState, team: Team, input: MatchInput, rng = Math.random): boolean {
  switch (input.type) {
    case 'shoot':
      return shoot(state, team, input.pieceId, input.dx, input.dy, rng);

    case 'startSub': {
      const side = state.sides[team];
      if (state.phase !== 'aim' || state.turn !== team) return false;
      if (side.subsLeft <= 0 || eligibleBench(side).length === 0) return false;
      state.phase = 'sub';
      state.subTime = SUB_SECONDS;
      return true;
    }

    case 'sub': {
      const side = state.sides[team];
      if (state.phase !== 'sub' || state.turn !== team || side.subsLeft <= 0) return false;
      const slot = side.onField.indexOf(input.outId);
      const incoming = eligibleBench(side).find((p) => p.id === input.inId);
      if (slot === -1 || !incoming) return false;

      side.onField[slot] = incoming.id;
      side.subbedOff.push(input.outId);
      if (!side.played.includes(incoming.id)) side.played.push(incoming.id);
      side.subsLeft -= 1;

      // The new puck takes the old one's place on the field
      const body = state.bodies.find((b) => b.id === bodyId(team, input.outId));
      if (body) body.id = bodyId(team, incoming.id);
      if (state.lastTouch === bodyId(team, input.outId)) state.lastTouch = null;

      if (side.subsLeft === 0 || eligibleBench(side).length === 0) state.phase = 'aim';
      return true;
    }

    case 'endSub':
      if (state.phase !== 'sub' || state.turn !== team) return false;
      state.phase = 'aim';
      return true;

    case 'keeper': {
      const so = state.shootout;
      if (state.phase !== 'so-keeper' || !so || team !== other(so.shooter)) return false;
      const keeper = state.bodies.find((b) => b.kind === 'piece' && b.team === team);
      if (!keeper) return false;
      keeper.y = Math.min(GOAL_BOTTOM + 30, Math.max(GOAL_TOP - 30, input.y));
      return true;
    }

    case 'keeperReady': {
      const so = state.shootout;
      if (state.phase !== 'so-keeper' || !so || team !== other(so.shooter)) return false;
      startKick(state);
      return true;
    }
  }
  return false;
}

function shoot(state: MatchState, team: Team, pieceId: string, dx: number, dy: number, rng: () => number) {
  if (state.turn !== team || (state.phase !== 'aim' && state.phase !== 'so-aim')) return false;
  const piece = state.bodies.find((b) => b.id === pieceId && b.kind === 'piece' && b.team === team);
  const puck = piece && getSquadPuck(state, piece.id);
  if (!piece || !puck) return false;

  let len = Math.hypot(dx, dy);
  if (!Number.isFinite(len) || len < MIN_DRAG) return false;
  if (len > MAX_DRAG) {
    dx *= MAX_DRAG / len;
    dy *= MAX_DRAG / len;
    len = MAX_DRAG;
  }

  const pull = len / MAX_DRAG; // 0..1
  const eff = effectiveness(puck.health);
  const speed = maxShotSpeed(puck.levels.power) * eff * pull;

  // Accuracy: a tired / low-accuracy puck adds random error to the angle
  const maxDev = Math.min(15, maxDeviationDeg(puck.levels.accuracy) / eff) * (0.4 + 0.6 * pull);
  const angle = Math.atan2(dy, dx) + ((rng() * 2 - 1) * maxDev * Math.PI) / 180;

  piece.vx = Math.cos(angle) * speed;
  piece.vy = Math.sin(angle) * speed;

  puck.health = Math.max(0, puck.health - SHOT_DRAIN * drainMultiplier(puck.levels.stamina));
  puck.matchShots += 1;
  state.phase = state.phase === 'aim' ? 'moving' : 'so-moving';
  return true;
}

// ---------------------------------------------------------------------------
// Game loop
// ---------------------------------------------------------------------------

function collisionHandler(state: MatchState): CollideFn {
  return (a, b, impulse) => {
    if (a.kind === 'ball' && b.kind === 'piece') state.lastTouch = b.id;
    if (b.kind === 'ball' && a.kind === 'piece') state.lastTouch = a.id;

    // Puck hits puck: both lose health
    if (a.kind === 'piece' && b.kind === 'piece' && impulse > 2) {
      const damage = Math.min(8, impulse * 0.12);
      for (const body of [a, b]) {
        const puck = getSquadPuck(state, body.id);
        if (puck) puck.health = Math.max(0, puck.health - damage * drainMultiplier(puck.levels.stamina));
      }
    }
  };
}

const timeIsUp = (s: MatchState) => s.settings.mode === 'time' && s.clock <= 0;

function tickClock(state: MatchState, dt: number) {
  if (state.settings.mode === 'time') state.clock = Math.max(0, state.clock - dt);
}

/** Advances the match by `frames` (1 = one 60fps frame) */
export function update(state: MatchState, frames: number, rng = Math.random) {
  const dt = frames / 60;

  switch (state.phase) {
    case 'aim':
      tickClock(state, dt);
      state.turnTime -= dt;
      if (timeIsUp(state)) endRegulation(state, rng);
      else if (state.turnTime <= 0) startTurn(state, other(state.turn)); // too slow
      break;

    case 'moving': {
      tickClock(state, dt);
      const scorer = step(state.bodies, frames, collisionHandler(state));
      if (scorer !== null) onGoal(state, scorer);
      else if (!isMoving(state.bodies)) {
        // Everything is still: pucks left inside a goal now slide back out
        state.ejects = planEjects(state);
        if (state.ejects.length > 0) {
          state.phase = 'eject';
          state.pause = 0;
        } else afterShot(state, rng);
      }
      break;
    }

    case 'eject': {
      tickClock(state, dt);
      state.pause = Math.min(1, state.pause + dt / EJECT_SECONDS);
      const t = 1 - Math.pow(1 - state.pause, 3); // ease-out
      for (const e of state.ejects) {
        const b = state.bodies.find((o) => o.id === e.id);
        if (!b) continue;
        b.x = e.fromX + (e.toX - e.fromX) * t;
        b.y = e.fromY + (e.toY - e.fromY) * t;
      }
      if (state.pause >= 1) {
        state.ejects = [];
        afterShot(state, rng);
      }
      break;
    }

    case 'sub': // the clock is paused while substituting
      state.subTime -= dt;
      if (state.subTime <= 0) state.phase = 'aim';
      break;

    case 'goal': {
      state.pause -= dt;
      if (state.pause > 0) break;
      const team = state.goalInfo!.team;
      if (state.settings.mode === 'goals' && state.score[team] >= state.settings.goals) finish(state, team);
      else if (timeIsUp(state)) endRegulation(state, rng);
      else kickoff(state, other(team)); // the team that conceded kicks off
      break;
    }

    case 'so-keeper':
      state.turnTime -= dt;
      if (state.turnTime <= 0) startKick(state);
      break;

    case 'so-aim':
      state.turnTime -= dt;
      if (state.turnTime <= 0) recordKick(state, false); // ran out of time = miss
      break;

    case 'so-moving': {
      const scorer = step(state.bodies, frames, collisionHandler(state));
      if (scorer !== null) recordKick(state, scorer === 0); // every kick goes at the right goal
      else if (!isMoving(state.bodies)) recordKick(state, false);
      break;
    }

    case 'so-result':
      state.pause -= dt;
      if (state.pause <= 0) nextKick(state, rng);
      break;
  }
}

function afterShot(state: MatchState, rng: () => number) {
  if (timeIsUp(state)) endRegulation(state, rng);
  else startTurn(state, other(state.turn));
}

/** Finds a free spot just in front of the goal for every puck stuck inside one */
function planEjects(state: MatchState): Eject[] {
  const ejects: Eject[] = [];
  const taken = state.bodies.filter((b) => !isInGoal(b)).map((b) => ({ x: b.x, y: b.y, r: b.r }));

  for (const b of state.bodies.filter(isInGoal)) {
    const left = b.x < 0;
    const gap = b.r * 2 + 6;
    let spot: { x: number; y: number } | null = null;

    for (let col = 0; col < 6 && !spot; col++) {
      const x = left ? b.r + POST_R + 6 + col * gap : FIELD_W - b.r - POST_R - 6 - col * gap;
      for (let k = 0; k < 9 && !spot; k++) {
        const offset = (k % 2 === 0 ? 1 : -1) * Math.ceil(k / 2) * (gap / 2);
        const y = Math.min(FIELD_H - b.r, Math.max(b.r, b.y + offset));
        const free =
          taken.every((o) => Math.hypot(o.x - x, o.y - y) > o.r + b.r + 2) &&
          POSTS.every((p) => Math.hypot(p.x - x, p.y - y) > POST_R + b.r + 2);
        if (free) spot = { x, y };
      }
    }
    spot ??= { x: left ? b.r + 20 : FIELD_W - b.r - 20, y: FIELD_H / 2 };

    b.vx = 0;
    b.vy = 0;
    taken.push({ ...spot, r: b.r });
    ejects.push({ id: b.id, fromX: b.x, fromY: b.y, toX: spot.x, toY: spot.y });
  }
  return ejects;
}

function onGoal(state: MatchState, team: Team) {
  state.score[team] += 1;

  // Credit the goal to the last puck of the scoring team that touched the ball
  let scorer: string | null = null;
  if (state.lastTouch) {
    const { team: touchTeam } = parseBodyId(state.lastTouch);
    const puck = getSquadPuck(state, state.lastTouch);
    if (puck && touchTeam === team) {
      puck.matchGoals += 1;
      scorer = puck.name;
    }
  }

  state.goalInfo = { team, scorer };
  state.phase = 'goal';
  state.pause = GOAL_PAUSE;
}

function endRegulation(state: MatchState, rng: () => number) {
  if (state.score[0] !== state.score[1]) finish(state, state.score[0] > state.score[1] ? 0 : 1);
  else startShootout(state, rng);
}

// ---------------------------------------------------------------------------
// Trick-shot shootout: 5 kicks each, then the first one to score wins.
// Each kick: ball + one shooter puck, the defender's keeper on the goal line
// (the defender slides it into place first) and 1-2 fixed blocks in the way,
// so you often need to bank the ball off a wall.
// ---------------------------------------------------------------------------

function startShootout(state: MatchState, rng: () => number) {
  state.shootout = { kicks: [[], []], shooter: 0, suddenDeath: false, lastScored: null, decided: null };
  setupKick(state, rng);
}

const KICK_ORDER = [1, 2, 3, 4, 0]; // outfield pucks first, goalkeeper last

function setupKick(state: MatchState, rng: () => number) {
  const so = state.shootout!;
  const shooter = so.shooter;
  const defender = other(shooter);
  const shooterSide = state.sides[shooter];
  const slot = KICK_ORDER[so.kicks[shooter].length % KICK_ORDER.length];
  const shooterPuck = shooterSide.onField[slot] ?? shooterSide.onField[0];
  const keeperPuck = state.sides[defender].onField[0];

  const ballX = FIELD_W - 240;
  const ballY = FIELD_H / 2 + (rng() * 2 - 1) * 110;
  const bodies: Body[] = [
    makeBall(ballX, ballY),
    makePiece(shooter, shooterPuck, ballX - 100, ballY + (rng() * 2 - 1) * 50),
    makePiece(defender, keeperPuck, FIELD_W - 60, FIELD_H / 2),
  ];

  // Random fixed blocks between the ball and the goal
  const blockCount = 1 + Math.floor(rng() * 2);
  for (let i = 0, tries = 0; i < blockCount && tries < 50; tries++) {
    const x = FIELD_W - 170 + rng() * 40;
    const y = GOAL_TOP - 40 + rng() * (GOAL_BOTTOM - GOAL_TOP + 80);
    const clear = bodies.every((b) => Math.hypot(b.x - x, b.y - y) > b.r + BLOCK_R + 20);
    if (!clear) continue;
    bodies.push({ id: `block${i}`, kind: 'block', x, y, vx: 0, vy: 0, r: BLOCK_R, mass: 0 });
    i++;
  }

  state.bodies = bodies;
  state.lastTouch = null;
  state.phase = 'so-keeper';
  state.turn = defender;
  state.turnTime = KEEPER_SECONDS;
}

function startKick(state: MatchState) {
  state.phase = 'so-aim';
  state.turn = state.shootout!.shooter;
  state.turnTime = KICK_SECONDS;
}

function recordKick(state: MatchState, scored: boolean) {
  const so = state.shootout!;
  so.kicks[so.shooter].push(scored);
  so.lastScored = scored;
  so.decided = decideShootout(so, scored);
  state.phase = 'so-result';
  state.pause = KICK_RESULT_PAUSE;
}

function decideShootout(so: Shootout, scored: boolean): Team | null {
  if (so.suddenDeath) return scored ? so.shooter : null; // first goal wins

  const goals = so.kicks.map((k) => k.filter(Boolean).length);
  const left = so.kicks.map((k) => SHOOTOUT_KICKS - k.length);
  if (goals[0] > goals[1] + left[1]) return 0;
  if (goals[1] > goals[0] + left[0]) return 1;
  if (left[0] === 0 && left[1] === 0) so.suddenDeath = true; // still level after 5 each
  return null;
}

function nextKick(state: MatchState, rng: () => number) {
  const so = state.shootout!;
  if (so.decided !== null) {
    finish(state, so.decided, true);
    return;
  }
  so.shooter = other(so.shooter);
  setupKick(state, rng);
}

// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------

export function matchResultFor(state: MatchState, team: Team): MatchResult {
  const side = state.sides[team];
  const puckStats: MatchResult['puckStats'] = {};
  for (const p of side.squad) {
    puckStats[p.id] = { goals: p.matchGoals, shots: p.matchShots, played: side.played.includes(p.id) };
  }
  return {
    won: state.winner === team,
    goalsFor: state.score[team],
    goalsAgainst: state.score[other(team)],
    wonOnShootout: state.winner === team && state.wonOnShootout,
    puckStats,
  };
}
