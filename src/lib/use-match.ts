'use no memo';
// ^ match state is mutated in place every frame; keep React Compiler out of it.
//
// Smoothness trick: puck/ball positions go into a Reanimated shared value
// (`pos`) that the UI thread reads directly, so pucks move every frame WITHOUT
// re-rendering React. React only re-renders when something on screen really
// changes (score, turn, timer second, health...) — see viewSignature().

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSharedValue } from 'react-native-reanimated';

import {
  KEEPER_SECONDS,
  KICK_SECONDS,
  MatchInput,
  MatchState,
  Side,
  SideSetup,
  TURN_SECONDS,
  applyInput,
  createMatch,
  update,
} from '@/game/match';
import type { Body } from '@/game/physics';
import type { MatchSettings, Team } from '@/game/types';
import { getSocket, request } from '@/lib/socket';

/** For the UI thread: [x0, y0, vx0, vy0, x1, y1, ...] in body order */
export type PosBuffer = {
  seq: number; // changes on every write
  prev: number[]; // where the bodies were (online: last server update)
  cur: number[]; // where they are now
  dur: number; // ms to blend prev -> cur (0 = jump straight to cur)
  turnFrac: number; // 1 -> 0 as the turn timer runs out
};

export const STRIDE = 4;
const pack = (bodies: Body[]) => bodies.flatMap((b) => [b.x, b.y, b.vx, b.vy]);

const samePositions = (a: number[], b: number[]) =>
  a.length === b.length && a.every((v, i) => Math.abs(v - b[i]) < 0.01);

function turnFraction(s: Pick<MatchState, 'phase' | 'turnTime'>) {
  const max = s.phase === 'so-keeper' ? KEEPER_SECONDS : s.phase === 'so-aim' ? KICK_SECONDS : TURN_SECONDS;
  return s.phase === 'aim' || s.phase === 'so-keeper' || s.phase === 'so-aim' ? Math.max(0, s.turnTime / max) : 0;
}

/** Everything that, when it changes, needs a React re-render */
function viewSignature(s: Omit<MatchState, 'sides'>, sides: [Side, Side]) {
  return [
    s.phase,
    s.turn,
    Math.ceil(s.turnTime),
    Math.ceil(s.clock),
    Math.ceil(s.subTime),
    s.score.join(),
    s.winner,
    s.goalInfo?.team,
    s.bodies.map((b) => b.id).join(),
    s.shootout ? `${s.shootout.kicks.map((k) => k.join()).join('/')}${s.shootout.suddenDeath}` : '',
    sides.map((d) => `${d.onField.join()}${d.subsLeft}${d.squad.map((p) => Math.round(p.health / 5)).join()}`).join('|'),
  ].join(';');
}

// ---------------------------------------------------------------------------
// Local match: both players on this phone, the rules run right here
// ---------------------------------------------------------------------------

export function useLocalMatch(settings: MatchSettings, a: SideSetup, b: SideSetup) {
  const ref = useRef<MatchState | null>(null);
  if (!ref.current) ref.current = createMatch(settings, a, b);

  const pos = useSharedValue<PosBuffer>({ seq: 0, prev: [], cur: pack(ref.current.bodies), dur: 0, turnFrac: 1 });
  const lastPos = useRef<PosBuffer>(pos.value);
  const [, setVersion] = useState(0);
  const sig = useRef('');
  const pausedRef = useRef(false);
  const [paused, setPausedState] = useState(false);

  useEffect(() => {
    let raf = 0;
    let last = 0;
    const loop = (now: number) => {
      const frames = last ? Math.min((now - last) / (1000 / 60), 3) : 1;
      last = now;
      const s = ref.current!;
      if (!pausedRef.current) update(s, frames);

      // Positions -> UI thread (only when they changed)
      const cur = pack(s.bodies);
      const turnFrac = turnFraction(s);
      const p = lastPos.current;
      if (!samePositions(cur, p.cur) || Math.abs(turnFrac - p.turnFrac) > 0.002) {
        const next = { seq: p.seq + 1, prev: cur, cur, dur: 0, turnFrac };
        lastPos.current = next;
        pos.value = next;
      }

      // Re-render React only when something visible changed
      const nextSig = viewSignature(s, s.sides);
      if (nextSig !== sig.current) {
        sig.current = nextSig;
        setVersion((v) => v + 1);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [pos]);

  const send = useCallback((input: MatchInput, team: Team) => {
    applyInput(ref.current!, team, input);
  }, []);

  const restart = useCallback(() => {
    ref.current = createMatch(settings, a, b);
  }, [settings, a, b]);

  const setPaused = useCallback((value: boolean) => {
    pausedRef.current = value;
    setPausedState(value);
  }, []);

  return { state: ref.current, pos, send, restart, paused, setPaused };
}

// ---------------------------------------------------------------------------
// Online match: the server runs the rules and streams the state ~30x/second.
// The UI thread blends between two updates (interpolation).
// ---------------------------------------------------------------------------

type Snapshot = Omit<MatchState, 'sides'>;

export function useOnlineMatch() {
  const [team, setTeam] = useState<Team | null>(null);
  const [reward, setReward] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, setVersion] = useState(0);
  const sides = useRef<[Side, Side] | null>(null);
  const snap = useRef<Snapshot | null>(null);
  const sig = useRef('');
  const pos = useSharedValue<PosBuffer>({ seq: 0, prev: [], cur: [], dur: 0, turnFrac: 0 });

  useEffect(() => {
    const socket = getSocket();
    if (!socket) {
      setError('Not connected to the server');
      return;
    }
    let lastIds = '';
    let lastCur: number[] = [];
    let lastArrival = 0;
    let interval = 33;
    let seq = 0;

    const refresh = () => {
      if (!snap.current || !sides.current) return;
      const next = viewSignature(snap.current, sides.current);
      if (next !== sig.current) {
        sig.current = next;
        setVersion((v) => v + 1);
      }
    };

    const onState = (s: Snapshot) => {
      const now = Date.now();
      if (lastArrival) interval = interval * 0.8 + (now - lastArrival) * 0.2;
      lastArrival = now;

      const ids = s.bodies.map((b) => b.id).join();
      const cur = pack(s.bodies);
      const prev = ids === lastIds ? lastCur : cur; // new kickoff = jump, don't slide
      lastIds = ids;
      lastCur = cur;
      pos.value = { seq: ++seq, prev, cur, dur: Math.min(120, Math.max(25, interval)), turnFrac: turnFraction(s) };
      snap.current = s;
      refresh();
    };
    const onSides = (s: [Side, Side]) => {
      sides.current = s;
      refresh();
    };
    const onEnd = (res: { reward: number }) => setReward(res.reward);

    socket.on('match:sides', onSides);
    socket.on('match:state', onState);
    socket.on('match:end', onEnd);

    request<{ team: Team; sides: [Side, Side]; state: Snapshot }>('match:sync')
      .then((res) => {
        setTeam(res.team);
        sides.current = sides.current ?? res.sides;
        if (!snap.current) onState(res.state);
        else refresh();
      })
      .catch((e: Error) => setError(e.message));

    return () => {
      socket.off('match:sides', onSides);
      socket.off('match:state', onState);
      socket.off('match:end', onEnd);
    };
  }, [pos]);

  const send = useCallback((input: MatchInput) => {
    getSocket()?.emit('match:input', { input });
  }, []);

  const leave = useCallback(() => {
    getSocket()?.emit('room:leave', {});
  }, []);

  const state: MatchState | null = snap.current && sides.current ? { ...snap.current, sides: sides.current } : null;
  return { state, pos, team, reward, error, send, leave };
}
