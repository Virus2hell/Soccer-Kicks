'use no memo';
// ^ The match state is mutated every frame, so React Compiler's automatic
//   memoization must be switched off for this file.

import { memo, useRef, useState } from 'react';
import { GestureResponderEvent, LayoutChangeEvent, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, SharedValue, ZoomIn, useAnimatedStyle, useFrameCallback, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Line, Polygon, Text as SvgText } from 'react-native-svg';

import { CANVAS_H, CANVAS_W, Field, ORIGIN_X, ORIGIN_Y } from '@/components/game/field';
import { BallArt, BlockArt, PUCK_ART_SCALE, PuckArt } from '@/components/game/puck-art';
import { Bar, Button, COLORS, healthColor } from '@/components/ui/kit';
import { PUCK_COLORS, PuckColorId } from '@/game/colors';
import {
  MAX_DRAG,
  MIN_DRAG,
  MatchInput,
  MatchState,
  SHOOTOUT_KICKS,
  SquadPuck,
  actingTeam,
  eligibleBench,
  getSquadPuck,
} from '@/game/match';
import type { Body, BodyKind } from '@/game/physics';
import { aimLength, effectiveness } from '@/game/pucks';
import type { Team } from '@/game/types';
import type { PosBuffer } from '@/lib/use-match';

type Props = {
  state: MatchState;
  pos: SharedValue<PosBuffer>;
  canControl: (team: Team) => boolean;
  send: (input: MatchInput, team: Team) => void;
  onExit: () => void;
  reward: number | null;
  onRestart?: () => void;
  /** Local matches can be paused; online matches can't */
  onPause?: (paused: boolean) => void;
  paused?: boolean;
};

type Aim = { pieceId: string; dx: number; dy: number };

const SIDE_W = 84;
const teamColor = (state: MatchState, team: Team) => PUCK_COLORS[state.sides[team].color];

export function MatchView(props: Props) {
  const { state, pos, canControl, send, onExit, reward, onRestart, onPause } = props;
  const insets = useSafeAreaInsets();
  const [scale, setScale] = useState(0);
  const [aim, setAim] = useState<Aim | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const scaleRef = useRef(0);
  const stateRef = useRef(state);
  const propsRef = useRef(props);
  const aimRef = useRef<Aim | null>(null);
  const keeperDrag = useRef(false);
  const lastKeeperSend = useRef(0);
  const touchOrigin = useRef({ x: 0, y: 0 });
  stateRef.current = state;
  propsRef.current = props;

  // UI-thread clock used to blend online updates (see AnimatedBody)
  const clock = useSharedValue(0);
  const startAt = useSharedValue(0);
  const seenSeq = useSharedValue(-1);
  useFrameCallback((frame) => {
    clock.value = frame.timestamp;
    const seq = pos.value.seq;
    if (seq !== seenSeq.value) {
      seenSeq.value = seq;
      startAt.value = frame.timestamp;
    }
  });

  const turnBarStyle = useAnimatedStyle(() => ({ width: `${pos.value.turnFrac * 100}%` }));

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    const s = Math.min(width / CANVAS_W, height / CANVAS_H);
    scaleRef.current = s;
    setScale(s);
  };

  // Screen touch -> game units
  const toWorld = (e: GestureResponderEvent) => ({
    x: (e.nativeEvent.pageX - touchOrigin.current.x) / scaleRef.current - ORIGIN_X,
    y: (e.nativeEvent.pageY - touchOrigin.current.y) / scaleRef.current - ORIGIN_Y,
  });

  const updateAim = (next: Aim | null) => {
    aimRef.current = next;
    setAim(next ? { ...next } : null);
  };

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,

      onPanResponderGrant: (e) => {
        const s = stateRef.current;
        const { canControl: allowed, send: emit } = propsRef.current;
        touchOrigin.current = {
          x: e.nativeEvent.pageX - e.nativeEvent.locationX,
          y: e.nativeEvent.pageY - e.nativeEvent.locationY,
        };
        const t = toWorld(e);

        if ((s.phase === 'aim' || s.phase === 'so-aim') && allowed(s.turn)) {
          // Pick the current player's puck under the finger
          let best: Body | null = null;
          let bestDist = Infinity;
          for (const b of s.bodies) {
            if (b.kind !== 'piece' || b.team !== s.turn) continue;
            const d = Math.hypot(b.x - t.x, b.y - t.y);
            if (d < b.r * 1.35 && d < bestDist) {
              best = b;
              bestDist = d;
            }
          }
          if (best) updateAim({ pieceId: best.id, dx: 0, dy: 0 });
        } else if (s.phase === 'so-keeper' && allowed(actingTeam(s))) {
          keeperDrag.current = true;
          emit({ type: 'keeper', y: t.y }, actingTeam(s));
        }
      },

      // Dragging: the shot goes OPPOSITE to the pull (like a slingshot)
      onPanResponderMove: (e) => {
        const s = stateRef.current;
        const t = toWorld(e);
        const current = aimRef.current;
        if (current) {
          const piece = s.bodies.find((b) => b.id === current.pieceId);
          if (!piece) return;
          let dx = piece.x - t.x;
          let dy = piece.y - t.y;
          const len = Math.hypot(dx, dy);
          if (len > MAX_DRAG) {
            dx *= MAX_DRAG / len;
            dy *= MAX_DRAG / len;
          }
          updateAim({ pieceId: current.pieceId, dx, dy });
        } else if (keeperDrag.current && Date.now() - lastKeeperSend.current > 30) {
          lastKeeperSend.current = Date.now();
          propsRef.current.send({ type: 'keeper', y: t.y }, actingTeam(s));
        }
      },

      onPanResponderRelease: () => {
        const s = stateRef.current;
        const current = aimRef.current;
        updateAim(null);
        keeperDrag.current = false;
        if (current && Math.hypot(current.dx, current.dy) >= MIN_DRAG) {
          propsRef.current.send({ type: 'shoot', pieceId: current.pieceId, dx: current.dx, dy: current.dy }, s.turn);
        }
      },

      onPanResponderTerminate: () => {
        updateAim(null);
        keeperDrag.current = false;
      },
    })
  ).current;

  // A shot that was cancelled by the turn ending shouldn't stay on screen
  const aimActive = aim && (state.phase === 'aim' || state.phase === 'so-aim') ? aim : null;
  const aimPiece = aimActive ? state.bodies.find((b) => b.id === aimActive.pieceId) : undefined;
  const aimPuck = aimPiece ? getSquadPuck(state, aimPiece.id) : undefined;
  const myTurnToShoot = (state.phase === 'aim' || state.phase === 'so-aim') && canControl(state.turn);
  const acting = actingTeam(state);

  const toggleMenu = (open: boolean) => {
    setMenuOpen(open);
    onPause?.(open);
  };

  return (
    <View style={[styles.screen, { paddingLeft: insets.left, paddingRight: insets.right }]}>
      <Hud state={state} />
      <View style={styles.turnTrack}>
        <Animated.View
          style={[
            styles.turnBar,
            { backgroundColor: teamColor(state, acting).main, alignSelf: acting === 0 ? 'flex-start' : 'flex-end' },
            turnBarStyle,
          ]}
        />
      </View>

      <View style={styles.middle}>
        <SidePanel team={0} {...props} onMenu={() => toggleMenu(true)} />

        <View style={styles.fieldArea} onLayout={onLayout}>
          {scale > 0 && (
            <View style={{ width: CANVAS_W * scale, height: CANVAS_H * scale }} {...pan.panHandlers}>
              {/* pointerEvents="none": every touch goes to the field, not to the pucks */}
              <View style={StyleSheet.absoluteFill} pointerEvents="none">
                <Field width={CANVAS_W * scale} height={CANVAS_H * scale} />
                {state.bodies.map((b, i) => {
                  const puck = b.kind === 'piece' ? getSquadPuck(state, b.id) : undefined;
                  return (
                    <AnimatedBody
                      key={b.id}
                      index={i}
                      kind={b.kind}
                      r={b.r}
                      scale={scale}
                      pos={pos}
                      clock={clock}
                      startAt={startAt}
                      color={b.team !== undefined ? state.sides[b.team].color : 'blue'}
                      number={puck?.number ?? 0}
                      health={puck ? Math.round(puck.health / 5) * 5 : undefined}
                      highlight={
                        aimActive?.pieceId === b.id ? 'selected' : myTurnToShoot && b.team === state.turn ? 'active' : 'none'
                      }
                    />
                  );
                })}
                {aimActive && aimPiece && aimPuck && (
                  <AimOverlay piece={aimPiece} puck={aimPuck} dx={aimActive.dx} dy={aimActive.dy} scale={scale} />
                )}
              </View>
              <Banner state={state} canControl={canControl} />
            </View>
          )}
        </View>

        <SidePanel team={1} {...props} onMenu={() => toggleMenu(true)} />
      </View>

      {state.phase === 'sub' && canControl(state.turn) && (
        <SubPanel state={state} team={state.turn} send={(input) => send(input, state.turn)} />
      )}

      {state.phase === 'goal' && state.goalInfo && (
        <View style={styles.overlay} pointerEvents="none">
          <Animated.Text entering={ZoomIn.springify().damping(12)} style={styles.bigText}>
            GOAL!
          </Animated.Text>
          <Animated.Text entering={FadeIn.delay(200)} style={styles.subText}>
            {state.goalInfo.scorer
              ? `${state.goalInfo.scorer} scores for ${state.sides[state.goalInfo.team].name}`
              : `Own goal! Point to ${state.sides[state.goalInfo.team].name}`}
          </Animated.Text>
        </View>
      )}

      {state.phase === 'so-result' && state.shootout && (
        <View style={styles.overlay} pointerEvents="none">
          <Animated.Text
            entering={ZoomIn.springify().damping(12)}
            style={[styles.bigText, !state.shootout.lastScored && { color: COLORS.danger }]}>
            {state.shootout.lastScored ? 'GOAL!' : 'MISSED!'}
          </Animated.Text>
          <Text style={styles.subText}>
            Trick shots {shootoutGoals(state, 0)} - {shootoutGoals(state, 1)}
          </Text>
        </View>
      )}

      {state.phase === 'over' && state.winner !== null && (
        <View style={styles.overlay}>
          <Animated.View entering={ZoomIn.springify().damping(14)} style={styles.endCard}>
            <Avatar name={state.sides[state.winner].name} color={state.sides[state.winner].color} size={64} active />
            <Text style={styles.endTitle}>🏆 {state.sides[state.winner].name} wins!</Text>
            <Text style={styles.endScore}>
              {state.score[0]} - {state.score[1]}
            </Text>
            {state.wonOnShootout && (
              <Text style={styles.subText}>
                Trick shots {shootoutGoals(state, 0)} - {shootoutGoals(state, 1)}
              </Text>
            )}
            {reward !== null && <Text style={styles.reward}>+{reward} 🪙</Text>}
            <View style={styles.row}>
              {onRestart && <Button title="Play again" onPress={onRestart} />}
              <Button title="Exit" variant="secondary" onPress={onExit} />
            </View>
          </Animated.View>
        </View>
      )}

      {menuOpen && state.phase !== 'over' && (
        <View style={styles.overlay}>
          <Animated.View entering={ZoomIn.springify().damping(16)} style={styles.menuCard}>
            <Text style={styles.endTitle}>{onPause ? 'Paused' : 'Menu'}</Text>
            {!onPause && <Text style={styles.subText}>The match keeps running online.</Text>}
            <Button title="Resume" onPress={() => toggleMenu(false)} style={{ alignSelf: 'stretch' }} />
            <Button
              title={onPause ? 'Quit match' : 'Leave match (counts as a loss)'}
              variant="danger"
              onPress={onExit}
              style={{ alignSelf: 'stretch' }}
            />
          </Animated.View>
        </View>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------

const shootoutGoals = (state: MatchState, team: Team) => state.shootout?.kicks[team].filter(Boolean).length ?? 0;

const formatClock = (seconds: number) => {
  const s = Math.ceil(Math.max(0, seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

function Avatar({ name, color, size, active }: { name: string; color: PuckColorId; size: number; active: boolean }) {
  const c = PUCK_COLORS[color];
  return (
    <View
      style={[
        styles.avatar,
        { width: size, height: size, backgroundColor: c.main, borderColor: active ? COLORS.gold : '#e2e8f0' },
      ]}>
      <View style={[styles.avatarShine, { backgroundColor: c.light }]} />
      <Text style={[styles.avatarText, { fontSize: size * 0.48 }]}>{name[0]?.toUpperCase()}</Text>
    </View>
  );
}

function Hud({ state }: { state: MatchState }) {
  const acting = actingTeam(state);
  const live = state.phase !== 'over';
  return (
    <View style={styles.hud}>
      <PlayerBlock state={state} team={0} active={live && acting === 0} />
      <View style={styles.scoreboard}>
        <Text style={[styles.score, { borderColor: teamColor(state, 0).main }]}>{state.score[0]}</Text>
        <View style={styles.clock}>
          <Text style={styles.clockText}>
            {state.shootout
              ? state.shootout.suddenDeath
                ? 'SUDDEN'
                : 'TRICK'
              : state.settings.mode === 'time'
                ? formatClock(state.clock)
                : `TO ${state.settings.goals}`}
          </Text>
          <Text style={styles.clockSub}>
            {state.phase === 'aim' || state.phase === 'so-aim' || state.phase === 'so-keeper'
              ? `${Math.ceil(Math.max(0, state.turnTime))}s left`
              : state.phase === 'sub'
                ? `sub ${Math.ceil(Math.max(0, state.subTime))}s`
                : ' '}
          </Text>
        </View>
        <Text style={[styles.score, { borderColor: teamColor(state, 1).main }]}>{state.score[1]}</Text>
      </View>
      <PlayerBlock state={state} team={1} active={live && acting === 1} />
    </View>
  );
}

function PlayerBlock({ state, team, active }: { state: MatchState; team: Team; active: boolean }) {
  const side = state.sides[team];
  const kicks = state.shootout?.kicks[team];
  const remaining = state.shootout && !state.shootout.suddenDeath ? Math.max(0, SHOOTOUT_KICKS - kicks!.length) : 0;
  const right = team === 1;

  return (
    <View style={[styles.player, right && { flexDirection: 'row-reverse' }, active && { backgroundColor: '#1e293b' }]}>
      <Avatar name={side.name} color={side.color} size={38} active={active} />
      <View style={{ flexShrink: 1, alignItems: right ? 'flex-end' : 'flex-start', gap: 3 }}>
        <Text style={styles.playerName} numberOfLines={1}>
          {side.name}
        </Text>
        <View style={[styles.pips, right && { flexDirection: 'row-reverse' }]}>
          {kicks ? (
            <>
              {kicks.map((k, i) => (
                <View key={i} style={[styles.kickDot, { backgroundColor: k ? '#22c55e' : '#ef4444' }]} />
              ))}
              {Array.from({ length: remaining }, (_, i) => (
                <View key={`r${i}`} style={[styles.kickDot, { backgroundColor: '#475569' }]} />
              ))}
            </>
          ) : (
            <>
              <Text style={styles.pipLabel}>SUBS</Text>
              {[0, 1, 2].map((i) => (
                <View key={i} style={[styles.pip, { backgroundColor: i < side.subsLeft ? PUCK_COLORS[side.color].light : '#334155' }]} />
              ))}
            </>
          )}
        </View>
      </View>
      {active && <View style={[styles.activeBar, { backgroundColor: PUCK_COLORS[side.color].main }]} />}
    </View>
  );
}

/** Beside the field: menu button, SUB for the shooting player, READY for the keeper */
function SidePanel({ team, state, canControl, send, onMenu }: Props & { team: Team; onMenu: () => void }) {
  const side = state.sides[team];
  const mine = canControl(team);
  const canSub =
    mine && state.phase === 'aim' && state.turn === team && side.subsLeft > 0 && eligibleBench(side).length > 0;
  const keeperReady = mine && state.phase === 'so-keeper' && actingTeam(state) === team;
  const c = PUCK_COLORS[side.color];

  return (
    <View style={styles.sidePanel}>
      <View style={{ flex: 1 }} />
      {canSub && (
        <Animated.View entering={ZoomIn}>
          <Pressable
            style={({ pressed }) => [styles.sideBtn, { backgroundColor: c.main, borderColor: c.light, opacity: pressed ? 0.8 : 1 }]}
            onPress={() => send({ type: 'startSub' }, team)}>
            <Text style={styles.sideBtnIcon}>⇄</Text>
            <Text style={styles.sideBtnText}>SUB</Text>
            <Text style={styles.sideBtnSmall}>{side.subsLeft} left</Text>
          </Pressable>
        </Animated.View>
      )}
      {keeperReady && (
        <Animated.View entering={ZoomIn}>
          <Pressable style={[styles.sideBtn, { backgroundColor: COLORS.accent, borderColor: '#bbf7d0' }]} onPress={() => send({ type: 'keeperReady' }, team)}>
            <Text style={styles.sideBtnIcon}>🧤</Text>
            <Text style={styles.sideBtnText}>READY</Text>
          </Pressable>
        </Animated.View>
      )}
      {team === 0 && (
        <Pressable style={styles.menuBtn} onPress={onMenu}>
          <Text style={styles.menuIcon}>☰</Text>
        </Pressable>
      )}
    </View>
  );
}

function Banner({ state, canControl }: { state: MatchState; canControl: (t: Team) => boolean }) {
  const acting = actingTeam(state);
  const name = state.sides[acting].name;
  const so = state.shootout;
  let text = '';
  if (state.phase === 'aim') text = canControl(acting) ? `${name}: pull back a puck & release` : `${name}'s turn`;
  else if (state.phase === 'sub') text = `${name} is making substitutions`;
  else if (state.phase === 'so-keeper' && so) {
    const kick = so.kicks[so.shooter].length + 1;
    text = canControl(acting)
      ? `Trick shot #${kick}: ${name}, slide your keeper up/down, then READY`
      : `Trick shot #${kick}: ${name} is placing the keeper`;
  } else if (state.phase === 'so-aim') text = `Trick shot! ${name} shoots — bank it off the walls`;
  if (!text) return null;

  return (
    <View style={styles.bannerWrap} pointerEvents="none">
      <Animated.View key={text} entering={FadeIn.duration(200)} style={[styles.banner, { borderColor: teamColor(state, acting).main }]}>
        <Text style={styles.bannerText}>{text}</Text>
      </Animated.View>
    </View>
  );
}

type BodyProps = {
  index: number;
  kind: BodyKind;
  r: number;
  scale: number;
  pos: SharedValue<PosBuffer>;
  clock: SharedValue<number>;
  startAt: SharedValue<number>;
  color: PuckColorId;
  number: number;
  health?: number;
  highlight: 'none' | 'active' | 'selected';
};

/** One puck/ball/block. Its position is applied on the UI thread every frame. */
const AnimatedBody = memo(function AnimatedBody(props: BodyProps) {
  const { index, kind, r, scale, pos, clock, startAt } = props;
  const artScale = kind === 'piece' ? PUCK_ART_SCALE : kind === 'ball' ? 100 / 88 : 100 / 84;
  const size = r * 2 * scale * artScale;

  const style = useAnimatedStyle(() => {
    const p = pos.value;
    const i = index * 2;
    if (i + 1 >= p.cur.length) return { opacity: 0 };
    const t = p.dur > 0 ? Math.min(1, Math.max(0, (clock.value - startAt.value) / p.dur)) : 1;
    const hasPrev = p.prev.length === p.cur.length;
    const fromX = hasPrev ? p.prev[i] : p.cur[i];
    const fromY = hasPrev ? p.prev[i + 1] : p.cur[i + 1];
    const x = fromX + (p.cur[i] - fromX) * t;
    const y = fromY + (p.cur[i + 1] - fromY) * t;
    return {
      opacity: 1,
      transform: [
        { translateX: (x + ORIGIN_X) * scale - size / 2 },
        { translateY: (y + ORIGIN_Y) * scale - size / 2 },
        { rotate: kind === 'ball' ? `${(x + y) * 2}deg` : '0deg' },
      ],
    };
  });

  return (
    <Animated.View style={[{ position: 'absolute', left: 0, top: 0, width: size, height: size }, style]}>
      {kind === 'ball' ? (
        <BallArt size={size} />
      ) : kind === 'block' ? (
        <BlockArt size={size} />
      ) : (
        <PuckArt size={size} color={props.color} number={props.number} health={props.health} highlight={props.highlight} />
      )}
    </Animated.View>
  );
});

type AimProps = { piece: Body; puck: SquadPuck; dx: number; dy: number; scale: number };

/** Power circle, pull-back dots and the aim guide (its length comes from the Aim stat) */
function AimOverlay({ piece, puck, dx, dy, scale }: AimProps) {
  const pull = Math.hypot(dx, dy);
  if (pull < 1) return null;

  const power = Math.min(1, pull / MAX_DRAG);
  const ux = dx / pull;
  const uy = dy / pull;
  const guide = aimLength(puck.levels.aim) * effectiveness(puck.health);
  const cx = piece.x + ORIGIN_X;
  const cy = piece.y + ORIGIN_Y;
  const r = piece.r;
  const color = power > 0.75 ? '#ef4444' : power > 0.4 ? '#f97316' : '#facc15';
  const endX = cx + ux * (r + guide);
  const endY = cy + uy * (r + guide);
  const px = -uy; // perpendicular, for the arrow head
  const py = ux;

  return (
    <Svg style={StyleSheet.absoluteFill} width={CANVAS_W * scale} height={CANVAS_H * scale} viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}>
      <Circle cx={cx} cy={cy} r={r + 14 + power * 70} fill="#ffffff" fillOpacity={0.07} stroke="#fff" strokeOpacity={0.85} strokeWidth={3} strokeDasharray="10 8" />
      {[1, 2, 3, 4, 5].map((i) => (
        <Circle key={i} cx={cx - ux * (r + (pull * i) / 5)} cy={cy - uy * (r + (pull * i) / 5)} r={5.5 - i * 0.5} fill="#fff" opacity={0.9} />
      ))}
      <Line x1={cx + ux * (r + 6)} y1={cy + uy * (r + 6)} x2={endX} y2={endY} stroke="#000" strokeOpacity={0.35} strokeWidth={11} strokeLinecap="round" />
      <Line x1={cx + ux * (r + 6)} y1={cy + uy * (r + 6)} x2={endX} y2={endY} stroke={color} strokeWidth={7} strokeDasharray="16 10" strokeLinecap="round" />
      <Polygon
        points={`${endX + ux * 24},${endY + uy * 24} ${endX + px * 14},${endY + py * 14} ${endX - px * 14},${endY - py * 14}`}
        fill={color}
        stroke="#000"
        strokeOpacity={0.35}
        strokeWidth={2}
      />
      <SvgText x={cx} y={cy - r - 24 - power * 70} fill="#fff" stroke="#000" strokeOpacity={0.4} strokeWidth={1} fontSize={28} fontWeight="900" textAnchor="middle">
        {`${Math.round(power * 100)}%`}
      </SvgText>
    </Svg>
  );
}

/** Substitution window: 30 seconds, up to 3 subs; a puck taken off can't come back */
function SubPanel({ state, team, send }: { state: MatchState; team: Team; send: (input: MatchInput) => void }) {
  const side = state.sides[team];
  const [outId, setOutId] = useState<string | null>(null);
  const onField = side.onField.map((id) => side.squad.find((p) => p.id === id)!);
  const bench = side.squad.filter((p) => !side.onField.includes(p.id));

  const pick = (kind: 'out' | 'in', id: string) => {
    if (kind === 'out') setOutId(id === outId ? null : id);
    else if (outId) {
      send({ type: 'sub', outId, inId: id });
      setOutId(null);
    }
  };

  return (
    <View style={styles.overlay}>
      <Animated.View entering={ZoomIn.springify().damping(16)} style={styles.subCard}>
        <View style={styles.rowBetween}>
          <Text style={styles.subTitle}>⇄ Substitution · {side.name}</Text>
          <Text style={styles.subTimer}>
            {Math.ceil(Math.max(0, state.subTime))}s · {side.subsLeft} left
          </Text>
        </View>
        <Text style={styles.subHint}>{outId ? 'Now pick a bench puck to bring on' : 'Tap a tired puck on the field to take it off'}</Text>

        <View style={{ flexDirection: 'row', gap: 16 }}>
          <View style={{ flex: 5, gap: 6 }}>
            <Text style={styles.subLabel}>ON FIELD</Text>
            <View style={styles.subRow}>
              {onField.map((p) => (
                <PuckCard key={p.id} puck={p} color={side.color} selected={p.id === outId} onPress={() => pick('out', p.id)} />
              ))}
            </View>
          </View>
          <View style={{ flex: 3, gap: 6 }}>
            <Text style={styles.subLabel}>BENCH</Text>
            <View style={styles.subRow}>
              {bench.map((p) => {
                const used = side.subbedOff.includes(p.id);
                return <PuckCard key={p.id} puck={p} color={side.color} disabled={used || !outId} used={used} onPress={() => pick('in', p.id)} />;
              })}
            </View>
          </View>
        </View>

        <Button title="Done" small onPress={() => send({ type: 'endSub' })} style={{ alignSelf: 'flex-end', minWidth: 110 }} />
      </Animated.View>
    </View>
  );
}

type PuckCardProps = {
  puck: SquadPuck;
  color: PuckColorId;
  selected?: boolean;
  disabled?: boolean;
  used?: boolean;
  onPress: () => void;
};

function PuckCard({ puck, color, selected, disabled, used, onPress }: PuckCardProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.puckCard, selected && { borderColor: COLORS.gold }, (used || disabled) && { opacity: used ? 0.35 : 0.75 }]}>
      <PuckArt size={44} color={color} number={puck.number} />
      <Text style={styles.puckCardName} numberOfLines={1}>
        {puck.name}
      </Text>
      <View style={{ width: '100%', flexDirection: 'row' }}>
        <Bar value={puck.health / 100} color={healthColor(puck.health)} height={5} />
      </View>
      <Text style={styles.puckCardSub}>{used ? 'OUT' : `${Math.round(puck.health)}%`}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#04150b' },
  hud: {
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 8,
    backgroundColor: '#0b1220',
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  player: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 6,
    height: 46,
    borderRadius: 12,
    overflow: 'hidden',
  },
  playerName: { color: '#fff', fontWeight: '900', fontSize: 15 },
  pips: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  pipLabel: { color: '#94a3b8', fontSize: 9, fontWeight: '900', marginHorizontal: 2 },
  pip: { width: 14, height: 5, borderRadius: 3 },
  kickDot: { width: 10, height: 10, borderRadius: 5 },
  activeBar: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 3 },
  avatar: { borderRadius: 10, borderWidth: 2, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarShine: { position: 'absolute', top: -8, left: -8, width: '70%', height: '55%', borderRadius: 40, opacity: 0.45 },
  avatarText: { color: '#fff', fontWeight: '900', textShadowColor: '#0006', textShadowRadius: 3 },
  scoreboard: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  score: {
    color: '#fff',
    fontSize: 26,
    fontWeight: '900',
    minWidth: 46,
    textAlign: 'center',
    backgroundColor: '#020617',
    borderRadius: 10,
    borderBottomWidth: 3,
    overflow: 'hidden',
    paddingVertical: 2,
  },
  clock: {
    width: 86,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 3,
    borderBottomColor: '#cbd5e1',
  },
  clockText: { fontSize: 17, fontWeight: '900', color: '#0f172a', letterSpacing: 0.5 },
  clockSub: { fontSize: 10, fontWeight: '800', color: '#64748b' },
  turnTrack: { height: 4, backgroundColor: '#020617' },
  turnBar: { height: 4 },
  middle: { flex: 1, flexDirection: 'row' },
  sidePanel: { width: SIDE_W, alignItems: 'center', paddingVertical: 10, gap: 10 },
  sideBtn: { width: 72, paddingVertical: 10, borderRadius: 16, alignItems: 'center', borderWidth: 2 },
  sideBtnIcon: { fontSize: 22, color: '#fff' },
  sideBtnText: { color: '#fff', fontWeight: '900', fontSize: 14 },
  sideBtnSmall: { color: '#fff', fontSize: 10, opacity: 0.85 },
  menuBtn: {
    width: 52,
    height: 46,
    borderRadius: 12,
    backgroundColor: '#22c55e',
    borderBottomWidth: 4,
    borderBottomColor: '#15803d',
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuIcon: { color: '#fff', fontSize: 24, fontWeight: '900' },
  fieldArea: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 4 },
  bannerWrap: { position: 'absolute', top: 4, left: 0, right: 0, alignItems: 'center' },
  banner: {
    backgroundColor: 'rgba(2,6,23,0.78)',
    borderRadius: 20,
    borderWidth: 2,
    paddingVertical: 4,
    paddingHorizontal: 14,
    maxWidth: '90%',
  },
  bannerText: { color: '#fff', fontWeight: '800', fontSize: 12, textAlign: 'center' },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bigText: {
    fontSize: 72,
    fontWeight: '900',
    color: COLORS.gold,
    textShadowColor: '#000',
    textShadowOffset: { width: 3, height: 4 },
    textShadowRadius: 6,
    letterSpacing: 2,
  },
  subText: { fontSize: 17, color: '#fff', fontWeight: '700', textAlign: 'center' },
  endCard: {
    backgroundColor: COLORS.card,
    borderRadius: 24,
    paddingVertical: 18,
    paddingHorizontal: 28,
    alignItems: 'center',
    gap: 6,
    borderWidth: 2,
    borderColor: COLORS.border,
    minWidth: 340,
  },
  menuCard: {
    backgroundColor: COLORS.card,
    borderRadius: 24,
    padding: 22,
    alignItems: 'center',
    gap: 12,
    borderWidth: 2,
    borderColor: COLORS.border,
    width: 320,
  },
  endTitle: { color: '#fff', fontSize: 24, fontWeight: '900' },
  endScore: { color: '#fff', fontSize: 40, fontWeight: '900' },
  reward: { color: COLORS.gold, fontSize: 22, fontWeight: '900' },
  row: { flexDirection: 'row', gap: 12, marginTop: 8 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  subCard: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 16,
    gap: 8,
    width: '94%',
    maxWidth: 860,
    borderWidth: 2,
    borderColor: COLORS.border,
  },
  subTitle: { color: '#fff', fontSize: 17, fontWeight: '900' },
  subTimer: { color: COLORS.gold, fontWeight: '900', fontSize: 15 },
  subHint: { color: COLORS.muted, fontSize: 12 },
  subLabel: { color: COLORS.muted, fontSize: 11, fontWeight: '900' },
  subRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  puckCard: {
    width: 78,
    alignItems: 'center',
    gap: 3,
    padding: 6,
    borderRadius: 14,
    backgroundColor: COLORS.cardLight,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  puckCardName: { color: '#fff', fontSize: 11, fontWeight: '800' },
  puckCardSub: { color: COLORS.muted, fontSize: 10 },
});
