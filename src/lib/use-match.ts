'use no memo';
// ^ match state is mutated in place every frame; keep React Compiler out of it.

import { useCallback, useEffect, useRef, useState } from 'react';

import { MatchInput, MatchState, Side, SideSetup, applyInput, createMatch, update } from '@/game/match';
import type { MatchSettings, Team } from '@/game/types';
import { getSocket, request } from '@/lib/socket';

/** Re-renders the component on every animation frame and calls `tick` first */
function useFrameLoop(tick?: (frames: number) => void) {
  const [, setFrame] = useState(0);
  const tickRef = useRef(tick);
  tickRef.current = tick;

  useEffect(() => {
    let raf = 0;
    let last = 0;
    const loop = (now: number) => {
      const frames = last ? Math.min((now - last) / (1000 / 60), 3) : 1;
      last = now;
      tickRef.current?.(frames);
      setFrame((f) => (f + 1) % 1_000_000);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
}

// ---------------------------------------------------------------------------
// Local match: both players on this phone, the rules run right here
// ---------------------------------------------------------------------------

export function useLocalMatch(settings: MatchSettings, a: SideSetup, b: SideSetup) {
  const ref = useRef<MatchState | null>(null);
  if (!ref.current) ref.current = createMatch(settings, a, b);

  useFrameLoop((frames) => update(ref.current!, frames));

  const send = useCallback((input: MatchInput, team: Team) => {
    applyInput(ref.current!, team, input);
  }, []);

  const restart = useCallback(() => {
    ref.current = createMatch(settings, a, b);
  }, [settings, a, b]);

  return { state: ref.current, send, restart };
}

// ---------------------------------------------------------------------------
// Online match: the server runs the rules and streams the state ~20x/second.
// We smooth the movement between two updates (interpolation).
// ---------------------------------------------------------------------------

type Snapshot = Omit<MatchState, 'sides'>;
const SERVER_SEND_MS = 50;

export function useOnlineMatch() {
  const [team, setTeam] = useState<Team | null>(null);
  const [reward, setReward] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const sides = useRef<[Side, Side] | null>(null);
  const snaps = useRef<{ prev: Snapshot | null; cur: Snapshot | null; at: number }>({ prev: null, cur: null, at: 0 });

  useFrameLoop();

  useEffect(() => {
    const socket = getSocket();
    if (!socket) {
      setError('Not connected to the server');
      return;
    }
    const onSides = (s: [Side, Side]) => (sides.current = s);
    const onState = (s: Snapshot) => (snaps.current = { prev: snaps.current.cur, cur: s, at: Date.now() });
    const onEnd = (res: { reward: number }) => setReward(res.reward);
    socket.on('match:sides', onSides);
    socket.on('match:state', onState);
    socket.on('match:end', onEnd);

    request<{ team: Team; sides: [Side, Side]; state: Snapshot }>('match:sync')
      .then((res) => {
        setTeam(res.team);
        sides.current = sides.current ?? res.sides;
        if (!snaps.current.cur) snaps.current = { prev: null, cur: res.state, at: Date.now() };
      })
      .catch((e: Error) => setError(e.message));

    return () => {
      socket.off('match:sides', onSides);
      socket.off('match:state', onState);
      socket.off('match:end', onEnd);
    };
  }, []);

  const send = useCallback((input: MatchInput) => {
    getSocket()?.emit('match:input', { input });
  }, []);

  const leave = useCallback(() => {
    getSocket()?.emit('room:leave', {});
  }, []);

  // Blend between the last two server updates so movement looks smooth
  let state: MatchState | null = null;
  const { prev, cur, at } = snaps.current;
  if (cur && sides.current) {
    const t = Math.min(1, (Date.now() - at) / SERVER_SEND_MS);
    const bodies = cur.bodies.map((b) => {
      const p = prev?.bodies.find((o) => o.id === b.id);
      if (!p || Math.hypot(p.x - b.x, p.y - b.y) > 150) return b;
      return { ...b, x: p.x + (b.x - p.x) * t, y: p.y + (b.y - p.y) * t };
    });
    state = { ...cur, bodies, sides: sides.current };
  }

  return { state, team, reward, error, send, leave };
}
