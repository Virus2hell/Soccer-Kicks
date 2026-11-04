// 2D physics for round pucks + ball on a table:
// - friction that slows everything down as it slides
// - impulse-based collisions between circles (heavier pucks push the light ball further)
// - bounces off walls, goal posts and the goal net
// - pucks may slide into a goal (the match rules move them back out once everything stops)
// - goal detection when the whole ball crosses the goal line

import type { Team } from './types';

export type BodyKind = 'piece' | 'ball' | 'block';

export type Body = {
  id: string;
  kind: BodyKind;
  team?: Team;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  mass: number; // 0 = fixed in place (trick-shot blocks)
};

// Called for every collision between two bodies (impulse = how hard they hit)
export type CollideFn = (a: Body, b: Body, impulse: number) => void;

// ---- Field size in "game units" (scaled to pixels when drawing) ----
export const FIELD_W = 1000;
export const FIELD_H = 600;
// Sizes measured from real Soccer Stars gameplay (field = 1000 wide)
export const GOAL_MOUTH = 240;
export const GOAL_DEPTH = 66;
export const GOAL_TOP = (FIELD_H - GOAL_MOUTH) / 2;
export const GOAL_BOTTOM = GOAL_TOP + GOAL_MOUTH;

export const PIECE_R = 34;
export const BALL_R = 14;
export const BLOCK_R = 24;
export const POST_R = 8;

export const PIECE_MASS = 3; // the light ball flies off a puck ~1.4x faster
export const BALL_MASS = 1;

// ---- Tuning (matched to the reference video) ----
// Pucks slide: they lose about the same speed every frame (sliding friction),
// so a shot glides smoothly and then settles. The ball rolls: much less friction.
const BODY_BOUNCE = 0.9;
const WALL_BOUNCE = { piece: 0.6, ball: 0.78, block: 0 };
const NET_BOUNCE = 0.35; // the net soaks up most of the ball's speed
const DRAG = { piece: 0.995, ball: 0.992, block: 1 }; // speed kept per frame
const SLIDE = { piece: 0.06, ball: 0.018, block: 0 }; // speed lost per frame
const STOP_SPEED = 0.05;
const SUBSTEPS = 4; // more = fewer bodies passing through each other

export const POSTS = [
  { x: 0, y: GOAL_TOP },
  { x: 0, y: GOAL_BOTTOM },
  { x: FIELD_W, y: GOAL_TOP },
  { x: FIELD_W, y: GOAL_BOTTOM },
];

/**
 * Advances the world by `frames` (1 = one 60fps frame).
 * Returns the team that scored, or null.
 * Left goal = team 1 scores, right goal = team 0 scores.
 * With allowGoals = false (during the goal celebration) the ball just bounces
 * around inside the net and rolls back out.
 */
export function step(bodies: Body[], frames: number, onCollide?: CollideFn, allowGoals = true): Team | null {
  const h = frames / SUBSTEPS;

  for (let s = 0; s < SUBSTEPS; s++) {
    for (const b of bodies) {
      if (b.mass === 0) continue;
      b.x += b.vx * h;
      b.y += b.vy * h;
    }

    for (const b of bodies) {
      const scorer = collideWalls(b, allowGoals);
      if (scorer !== null) return scorer;
    }

    for (let i = 0; i < bodies.length; i++) {
      for (let j = i + 1; j < bodies.length; j++) {
        collideBodies(bodies[i], bodies[j], onCollide);
      }
    }

    for (const b of bodies) {
      if (b.mass === 0) continue;
      for (const p of POSTS) collidePost(b, p);
    }
  }

  for (const b of bodies) applyFriction(b, frames);
  return null;
}

/** A puck whose center is behind a goal line */
export const isInGoal = (b: Body) => b.kind === 'piece' && (b.x < 0 || b.x > FIELD_W);

export function isMoving(bodies: Body[]) {
  return bodies.some((b) => b.vx !== 0 || b.vy !== 0);
}

function collideWalls(b: Body, allowGoals: boolean): Team | null {
  if (b.mass === 0) return null;

  if (b.x < 0 || b.x > FIELD_W) {
    // Center is behind a goal line, so the body is inside a goal
    const left = b.x < 0;
    const depth = left ? -b.x : b.x - FIELD_W;

    // The whole ball is over the line = goal (it keeps moving afterwards)
    if (b.kind === 'ball' && depth > b.r && allowGoals) return left ? 1 : 0;

    // Net: back wall + side walls
    if (depth + b.r > GOAL_DEPTH) {
      b.x = left ? -(GOAL_DEPTH - b.r) : FIELD_W + GOAL_DEPTH - b.r;
      b.vx = left ? Math.abs(b.vx) * NET_BOUNCE : -Math.abs(b.vx) * NET_BOUNCE;
      b.vy *= 0.7;
    }
    if (b.y - b.r < GOAL_TOP) {
      b.y = GOAL_TOP + b.r;
      b.vy = Math.abs(b.vy) * NET_BOUNCE;
    } else if (b.y + b.r > GOAL_BOTTOM) {
      b.y = GOAL_BOTTOM - b.r;
      b.vy = -Math.abs(b.vy) * NET_BOUNCE;
    }
    return null;
  }

  // On the field: the side walls have a gap at the goal mouth
  const inMouth = b.y > GOAL_TOP && b.y < GOAL_BOTTOM;
  if (!inMouth) {
    if (b.x - b.r < 0) {
      b.x = b.r;
      b.vx = Math.abs(b.vx) * WALL_BOUNCE[b.kind];
    } else if (b.x + b.r > FIELD_W) {
      b.x = FIELD_W - b.r;
      b.vx = -Math.abs(b.vx) * WALL_BOUNCE[b.kind];
    }
  }

  if (b.y - b.r < 0) {
    b.y = b.r;
    b.vy = Math.abs(b.vy) * WALL_BOUNCE[b.kind];
  } else if (b.y + b.r > FIELD_H) {
    b.y = FIELD_H - b.r;
    b.vy = -Math.abs(b.vy) * WALL_BOUNCE[b.kind];
  }
  return null;
}

// Impulse-based collision between two circles
function collideBodies(a: Body, b: Body, onCollide?: CollideFn) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dist = Math.hypot(dx, dy);
  const minDist = a.r + b.r;
  if (dist === 0 || dist >= minDist) return;

  const invA = a.mass === 0 ? 0 : 1 / a.mass;
  const invB = b.mass === 0 ? 0 : 1 / b.mass;
  const invSum = invA + invB;
  if (invSum === 0) return;

  // Collision normal (from a to b)
  const nx = dx / dist;
  const ny = dy / dist;

  // 1) Push them apart so they don't overlap (lighter body moves more)
  const overlap = minDist - dist;
  a.x -= nx * overlap * (invA / invSum);
  a.y -= ny * overlap * (invA / invSum);
  b.x += nx * overlap * (invB / invSum);
  b.y += ny * overlap * (invB / invSum);

  // 2) Bounce: only if they're moving towards each other
  const relVel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
  if (relVel > 0) return;

  const impulse = (-(1 + BODY_BOUNCE) * relVel) / invSum;
  a.vx -= impulse * invA * nx;
  a.vy -= impulse * invA * ny;
  b.vx += impulse * invB * nx;
  b.vy += impulse * invB * ny;

  onCollide?.(a, b, impulse);
}

// Goal posts are fixed circles
function collidePost(b: Body, p: { x: number; y: number }) {
  const dx = b.x - p.x;
  const dy = b.y - p.y;
  const dist = Math.hypot(dx, dy);
  const minDist = b.r + POST_R;
  if (dist === 0 || dist >= minDist) return;

  const nx = dx / dist;
  const ny = dy / dist;
  b.x = p.x + nx * minDist;
  b.y = p.y + ny * minDist;

  const vn = b.vx * nx + b.vy * ny;
  if (vn < 0) {
    b.vx -= (1 + WALL_BOUNCE[b.kind]) * vn * nx;
    b.vy -= (1 + WALL_BOUNCE[b.kind]) * vn * ny;
  }
}

function applyFriction(b: Body, frames: number) {
  const speed = Math.hypot(b.vx, b.vy);
  if (speed === 0) return;

  const newSpeed = speed * Math.pow(DRAG[b.kind], frames) - SLIDE[b.kind] * frames;

  if (newSpeed < STOP_SPEED) {
    b.vx = 0;
    b.vy = 0;
  } else {
    b.vx *= newSpeed / speed;
    b.vy *= newSpeed / speed;
  }
}
