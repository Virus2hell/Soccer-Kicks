// 2D physics for round pucks + ball on a table:
// - friction that slows everything down as it slides
// - impulse-based collisions between circles (heavier pucks push the light ball further)
// - bounces off walls, goal posts and the goal net
// - pucks may enter a goal, but one that goes in too deep gets thrown back out
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
export const GOAL_MOUTH = 200;
export const GOAL_DEPTH = 70;
export const GOAL_TOP = (FIELD_H - GOAL_MOUTH) / 2;
export const GOAL_BOTTOM = GOAL_TOP + GOAL_MOUTH;

export const PIECE_R = 38;
export const BALL_R = 17;
export const BLOCK_R = 26;
export const POST_R = 8;

export const PIECE_MASS = 2;
export const BALL_MASS = 1;

// ---- Tuning ----
const BODY_BOUNCE = 0.92;
const WALL_BOUNCE = 0.7;
const PIECE_FRICTION = 0.972; // speed kept per frame (lower = stops sooner)
const BALL_FRICTION = 0.982;
const LINEAR_DRAG = 0.025; // extra slowdown so things don't crawl forever
const STOP_SPEED = 0.06;
const SUBSTEPS = 4; // more = fewer bodies passing through each other
const EJECT_DEPTH = 20; // a puck whose center goes this deep into a goal is thrown out
const EJECT_SPEED = 10;

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
 */
export function step(bodies: Body[], frames: number, onCollide?: CollideFn): Team | null {
  const h = frames / SUBSTEPS;

  for (let s = 0; s < SUBSTEPS; s++) {
    for (const b of bodies) {
      if (b.mass === 0) continue;
      b.x += b.vx * h;
      b.y += b.vy * h;
    }

    for (const b of bodies) {
      const scorer = collideWalls(b);
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

export function isMoving(bodies: Body[]) {
  return bodies.some((b) => b.vx !== 0 || b.vy !== 0);
}

function collideWalls(b: Body): Team | null {
  if (b.mass === 0) return null;

  if (b.x < 0 || b.x > FIELD_W) {
    // Center is behind a goal line, so the body is inside a goal
    const left = b.x < 0;
    const depth = left ? -b.x : b.x - FIELD_W;

    if (b.kind === 'ball' && depth > b.r) return left ? 1 : 0;

    if (b.kind === 'piece' && depth > EJECT_DEPTH) {
      // Too deep: throw the puck back onto the field
      b.vx = left ? EJECT_SPEED : -EJECT_SPEED;
      b.vy *= 0.3;
    }

    // Net: back wall + side walls
    if (depth + b.r > GOAL_DEPTH) {
      b.x = left ? -(GOAL_DEPTH - b.r) : FIELD_W + GOAL_DEPTH - b.r;
      b.vx = left ? Math.abs(b.vx) * WALL_BOUNCE : -Math.abs(b.vx) * WALL_BOUNCE;
    }
    if (b.y - b.r < GOAL_TOP) {
      b.y = GOAL_TOP + b.r;
      b.vy = Math.abs(b.vy) * WALL_BOUNCE;
    } else if (b.y + b.r > GOAL_BOTTOM) {
      b.y = GOAL_BOTTOM - b.r;
      b.vy = -Math.abs(b.vy) * WALL_BOUNCE;
    }
    return null;
  }

  // On the field: the side walls have a gap at the goal mouth
  const inMouth = b.y > GOAL_TOP && b.y < GOAL_BOTTOM;
  if (!inMouth) {
    if (b.x - b.r < 0) {
      b.x = b.r;
      b.vx = Math.abs(b.vx) * WALL_BOUNCE;
    } else if (b.x + b.r > FIELD_W) {
      b.x = FIELD_W - b.r;
      b.vx = -Math.abs(b.vx) * WALL_BOUNCE;
    }
  }

  if (b.y - b.r < 0) {
    b.y = b.r;
    b.vy = Math.abs(b.vy) * WALL_BOUNCE;
  } else if (b.y + b.r > FIELD_H) {
    b.y = FIELD_H - b.r;
    b.vy = -Math.abs(b.vy) * WALL_BOUNCE;
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
    b.vx -= (1 + WALL_BOUNCE) * vn * nx;
    b.vy -= (1 + WALL_BOUNCE) * vn * ny;
  }
}

function applyFriction(b: Body, frames: number) {
  const speed = Math.hypot(b.vx, b.vy);
  if (speed === 0) return;

  const friction = b.kind === 'ball' ? BALL_FRICTION : PIECE_FRICTION;
  const newSpeed = speed * Math.pow(friction, frames) - LINEAR_DRAG * frames;

  if (newSpeed < STOP_SPEED) {
    b.vx = 0;
    b.vy = 0;
  } else {
    b.vx *= newSpeed / speed;
    b.vy *= newSpeed / speed;
  }
}
