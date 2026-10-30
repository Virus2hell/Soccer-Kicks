'use no memo';
// ^ The match state is mutated every frame, so React Compiler's automatic
//   memoization must be switched off for this file.

import { useRef, useState } from 'react';
import { GestureResponderEvent, LayoutChangeEvent, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Polygon, Text as SvgText } from 'react-native-svg';

import { CANVAS_H, CANVAS_W, Field } from '@/components/game/field';
import { BallArt, BlockArt, PuckArt } from '@/components/game/puck-art';
import { Bar, Button, COLORS, healthColor } from '@/components/ui/kit';
import {
  KEEPER_SECONDS,
  KICK_SECONDS,
  MAX_DRAG,
  MIN_DRAG,
  MatchInput,
  MatchState,
  SHOOTOUT_KICKS,
  SquadPuck,
  TURN_SECONDS,
  actingTeam,
  eligibleBench,
  getSquadPuck,
} from '@/game/match';
import { Body, GOAL_DEPTH } from '@/game/physics';
import { aimLength, effectiveness } from '@/game/pucks';
import type { Team } from '@/game/types';

type Props = {
  state: MatchState;
  canControl: (team: Team) => boolean;
  send: (input: MatchInput, team: Team) => void;
  onExit: () => void;
  reward: number | null;
  onRestart?: () => void;
};

type Aim = { pieceId: string; dx: number; dy: number };

const SIDE_PANEL_W = 92;

export function MatchView(props: Props) {
  const { state, canControl, send, onExit, reward, onRestart } = props;
  const [scale, setScale] = useState(0);
  const scaleRef = useRef(0);
  const stateRef = useRef(state);
  const propsRef = useRef(props);
  const aimRef = useRef<Aim | null>(null);
  const keeperDrag = useRef(false);
  const lastKeeperSend = useRef(0);
  const touchOrigin = useRef({ x: 0, y: 0 });
  stateRef.current = state;
  propsRef.current = props;

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    const s = Math.min(width / CANVAS_W, height / CANVAS_H) * 0.98;
    scaleRef.current = s;
    setScale(s);
  };

  // Screen touch -> game units
  const toWorld = (e: GestureResponderEvent) => ({
    x: (e.nativeEvent.pageX - touchOrigin.current.x) / scaleRef.current - GOAL_DEPTH,
    y: (e.nativeEvent.pageY - touchOrigin.current.y) / scaleRef.current,
  });

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
            if (d < b.r * 1.4 && d < bestDist) {
              best = b;
              bestDist = d;
            }
          }
          if (best) aimRef.current = { pieceId: best.id, dx: 0, dy: 0 };
        } else if (s.phase === 'so-keeper' && allowed(actingTeam(s))) {
          keeperDrag.current = true;
          emit({ type: 'keeper', y: t.y }, actingTeam(s));
        }
      },

      // Dragging: the shot goes OPPOSITE to the pull (like a slingshot)
      onPanResponderMove: (e) => {
        const s = stateRef.current;
        const t = toWorld(e);
        const aim = aimRef.current;
        if (aim) {
          const piece = s.bodies.find((b) => b.id === aim.pieceId);
          if (!piece) return;
          let dx = piece.x - t.x;
          let dy = piece.y - t.y;
          const len = Math.hypot(dx, dy);
          if (len > MAX_DRAG) {
            dx *= MAX_DRAG / len;
            dy *= MAX_DRAG / len;
          }
          aim.dx = dx;
          aim.dy = dy;
        } else if (keeperDrag.current && Date.now() - lastKeeperSend.current > 30) {
          lastKeeperSend.current = Date.now();
          propsRef.current.send({ type: 'keeper', y: t.y }, actingTeam(s));
        }
      },

      onPanResponderRelease: () => {
        const s = stateRef.current;
        const aim = aimRef.current;
        aimRef.current = null;
        keeperDrag.current = false;
        if (aim && Math.hypot(aim.dx, aim.dy) >= MIN_DRAG) {
          propsRef.current.send({ type: 'shoot', pieceId: aim.pieceId, dx: aim.dx, dy: aim.dy }, s.turn);
        }
      },

      onPanResponderTerminate: () => {
        aimRef.current = null;
        keeperDrag.current = false;
      },
    })
  ).current;

  // A shot that was cancelled by the turn ending shouldn't stay on screen
  if (aimRef.current && state.phase !== 'aim' && state.phase !== 'so-aim') aimRef.current = null;

  const aim = aimRef.current;
  const aimPiece = aim ? state.bodies.find((b) => b.id === aim.pieceId) : undefined;
  const aimPuck = aimPiece ? getSquadPuck(state, aimPiece.id) : undefined;
  const myTurnToShoot = (state.phase === 'aim' || state.phase === 'so-aim') && canControl(state.turn);

  return (
    <View style={styles.screen}>
      <Hud state={state} onExit={onExit} />

      <View style={styles.middle}>
        <SidePanel team={0} {...props} />

        <View style={styles.fieldArea} onLayout={onLayout}>
          {scale > 0 && (
            <View style={{ width: CANVAS_W * scale, height: CANVAS_H * scale }} {...pan.panHandlers}>
              {/* pointerEvents="none": every touch goes to the field, not to the pucks */}
              <View style={StyleSheet.absoluteFill} pointerEvents="none">
                <Field width={CANVAS_W * scale} height={CANVAS_H * scale} />
                {state.bodies.map((b) => (
                  <BodyView
                    key={b.id}
                    body={b}
                    scale={scale}
                    puck={b.kind === 'piece' ? getSquadPuck(state, b.id) : undefined}
                    highlight={
                      aim?.pieceId === b.id ? 'selected' : myTurnToShoot && b.team === state.turn ? 'active' : 'none'
                    }
                  />
                ))}
                {aim && aimPiece && aimPuck && (
                  <AimOverlay piece={aimPiece} puck={aimPuck} dx={aim.dx} dy={aim.dy} scale={scale} />
                )}
              </View>
              <Banner state={state} canControl={canControl} />
            </View>
          )}
        </View>

        <SidePanel team={1} {...props} />
      </View>

      {state.phase === 'sub' && canControl(state.turn) && (
        <SubPanel state={state} team={state.turn} send={(input) => send(input, state.turn)} />
      )}

      {state.phase === 'goal' && state.goalInfo && (
        <View style={styles.overlay} pointerEvents="none">
          <Text style={styles.bigText}>GOAL!</Text>
          <Text style={styles.subText}>
            {state.goalInfo.scorer
              ? `${state.goalInfo.scorer} scores for ${state.sides[state.goalInfo.team].name}`
              : `Own goal! Point to ${state.sides[state.goalInfo.team].name}`}
          </Text>
        </View>
      )}

      {state.phase === 'so-result' && state.shootout && (
        <View style={styles.overlay} pointerEvents="none">
          <Text style={[styles.bigText, !state.shootout.lastScored && { color: COLORS.danger }]}>
            {state.shootout.lastScored ? 'GOAL!' : 'MISSED!'}
          </Text>
          <Text style={styles.subText}>
            Trick shots {shootoutGoals(state, 0)} - {shootoutGoals(state, 1)}
          </Text>
        </View>
      )}

      {state.phase === 'over' && state.winner !== null && (
        <View style={styles.overlay}>
          <View style={styles.endCard}>
            <Text style={styles.trophy}>🏆</Text>
            <Text style={styles.endTitle}>{state.sides[state.winner].name} wins!</Text>
            <Text style={styles.subText}>
              {state.score[0]} - {state.score[1]}
              {state.wonOnShootout ? `   (trick shots ${shootoutGoals(state, 0)} - ${shootoutGoals(state, 1)})` : ''}
            </Text>
            {reward !== null && <Text style={styles.reward}>+{reward} 🪙 coins</Text>}
            <View style={styles.row}>
              {onRestart && <Button title="Play again" onPress={onRestart} />}
              <Button title="Exit" variant="secondary" onPress={onExit} />
            </View>
          </View>
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

function Hud({ state, onExit }: { state: MatchState; onExit: () => void }) {
  const turnMax = state.phase === 'so-keeper' ? KEEPER_SECONDS : state.phase === 'so-aim' ? KICK_SECONDS : TURN_SECONDS;
  const showTurnTimer = state.phase === 'aim' || state.phase === 'so-keeper' || state.phase === 'so-aim';

  return (
    <View>
      <View style={styles.hud}>
        <Pressable style={styles.exitBtn} onPress={onExit}>
          <Text style={styles.exitText}>✕</Text>
        </Pressable>
        <TeamTag state={state} team={0} />
        <Text style={styles.score}>{state.score[0]}</Text>
        <View style={styles.clock}>
          {state.shootout ? (
            <Text style={styles.clockText}>{state.shootout.suddenDeath ? 'SUDDEN' : 'TRICK'}</Text>
          ) : state.settings.mode === 'time' ? (
            <Text style={styles.clockText}>{formatClock(state.clock)}</Text>
          ) : (
            <Text style={styles.clockText}>to {state.settings.goals}</Text>
          )}
          <Text style={styles.clockSub}>{showTurnTimer ? `${Math.ceil(Math.max(0, state.turnTime))}s` : ' '}</Text>
        </View>
        <Text style={styles.score}>{state.score[1]}</Text>
        <TeamTag state={state} team={1} />
      </View>
      <View style={styles.turnTrack}>
        {showTurnTimer && (
          <View
            style={{
              width: `${Math.max(0, state.turnTime / turnMax) * 100}%`,
              height: 4,
              backgroundColor: COLORS.team[actingTeam(state)],
              alignSelf: actingTeam(state) === 0 ? 'flex-start' : 'flex-end',
            }}
          />
        )}
      </View>
    </View>
  );
}

function TeamTag({ state, team }: { state: MatchState; team: Team }) {
  const side = state.sides[team];
  const active = actingTeam(state) === team && state.phase !== 'over';
  const kicks = state.shootout?.kicks[team];
  const remaining = state.shootout && !state.shootout.suddenDeath ? Math.max(0, SHOOTOUT_KICKS - kicks!.length) : 0;

  return (
    <View
      style={[
        styles.tag,
        team === 1 && { flexDirection: 'row-reverse' },
        active && { backgroundColor: COLORS.team[team] },
      ]}>
      <View style={[styles.dot, { backgroundColor: active ? '#fff' : COLORS.team[team] }]} />
      <View style={{ flexShrink: 1, alignItems: team === 1 ? 'flex-end' : 'flex-start' }}>
        <Text style={styles.tagName} numberOfLines={1}>
          {side.name}
        </Text>
        {kicks ? (
          <Text style={styles.tagSub}>
            {kicks.map((k) => (k ? '🟢' : '🔴')).join('')}
            {'⚪'.repeat(remaining)}
          </Text>
        ) : (
          <Text style={styles.tagSub}>⇄ {side.subsLeft} subs</Text>
        )}
      </View>
    </View>
  );
}

/** Buttons beside the field: SUB for the shooting player, READY for the keeper */
function SidePanel({ team, state, canControl, send }: Props & { team: Team }) {
  const side = state.sides[team];
  const mine = canControl(team);
  const canSub =
    mine && state.phase === 'aim' && state.turn === team && side.subsLeft > 0 && eligibleBench(side).length > 0;
  const keeperReady = mine && state.phase === 'so-keeper' && actingTeam(state) === team;

  return (
    <View style={styles.sidePanel}>
      {canSub && (
        <Pressable style={[styles.sideBtn, { backgroundColor: COLORS.team[team] }]} onPress={() => send({ type: 'startSub' }, team)}>
          <Text style={styles.sideBtnIcon}>⇄</Text>
          <Text style={styles.sideBtnText}>SUB</Text>
          <Text style={styles.sideBtnSmall}>{side.subsLeft} left</Text>
        </Pressable>
      )}
      {keeperReady && (
        <Pressable style={[styles.sideBtn, { backgroundColor: COLORS.accent }]} onPress={() => send({ type: 'keeperReady' }, team)}>
          <Text style={styles.sideBtnIcon}>🧤</Text>
          <Text style={styles.sideBtnText}>READY</Text>
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
  if (state.phase === 'aim') text = canControl(acting) ? `${name}: pull back a puck and release to shoot` : `${name}'s turn`;
  else if (state.phase === 'sub') text = `${name} is making substitutions`;
  else if (state.phase === 'so-keeper' && so) {
    const kick = so.kicks[so.shooter].length + 1;
    text = canControl(acting)
      ? `Trick shot #${kick}: ${name}, drag up/down to place your keeper, then READY`
      : `Trick shot #${kick}: ${name} is placing the keeper`;
  } else if (state.phase === 'so-aim') text = `Trick shot! ${name} shoots — bank it off the walls`;
  if (!text) return null;

  return (
    <View style={styles.bannerWrap} pointerEvents="none">
      <View style={[styles.banner, { borderColor: COLORS.team[acting] }]}>
        <Text style={styles.bannerText}>{text}</Text>
      </View>
    </View>
  );
}

type BodyViewProps = { body: Body; scale: number; puck?: SquadPuck; highlight: 'none' | 'active' | 'selected' };

function BodyView({ body, scale, puck, highlight }: BodyViewProps) {
  const size = body.r * 2 * scale;
  const left = (body.x + GOAL_DEPTH) * scale - size / 2;
  const top = body.y * scale - size / 2;

  if (body.kind === 'ball') {
    // Spin the ball as it moves
    return (
      <View style={{ position: 'absolute', left, top, transform: [{ rotate: `${(body.x + body.y) * 2}deg` }] }}>
        <BallArt size={size} />
      </View>
    );
  }
  if (body.kind === 'block') {
    return (
      <View style={{ position: 'absolute', left, top }}>
        <BlockArt size={size} />
      </View>
    );
  }
  return (
    <View style={{ position: 'absolute', left, top }}>
      <PuckArt
        size={size}
        team={body.team ?? 0}
        number={puck?.number ?? 0}
        health={puck ? Math.round(puck.health / 5) * 5 : undefined}
        highlight={highlight}
      />
    </View>
  );
}

type AimProps = { piece: Body; puck: SquadPuck; dx: number; dy: number; scale: number };

/** Power circle, pull-back dots and the aim guide (its length comes from the Aim stat) */
function AimOverlay({ piece, puck, dx, dy, scale }: AimProps) {
  const pull = Math.hypot(dx, dy);
  if (pull < 1) return null;

  const power = Math.min(1, pull / MAX_DRAG);
  const ux = dx / pull;
  const uy = dy / pull;
  const eff = effectiveness(puck.health);
  const guide = aimLength(puck.levels.aim) * eff;
  const cx = piece.x + GOAL_DEPTH;
  const cy = piece.y;
  const r = piece.r;
  const color = power > 0.75 ? '#ef4444' : power > 0.4 ? '#f97316' : '#facc15';
  const endX = cx + ux * (r + guide);
  const endY = cy + uy * (r + guide);
  const px = -uy; // perpendicular, for the arrow head
  const py = ux;

  return (
    <Svg
      style={StyleSheet.absoluteFill}
      width={CANVAS_W * scale}
      height={CANVAS_H * scale}
      viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}>
      <Circle cx={cx} cy={cy} r={r + 12 + power * 70} fill="none" stroke="#fff" strokeOpacity={0.8} strokeWidth={3} strokeDasharray="10 8" />
      {[1, 2, 3, 4, 5].map((i) => (
        <Circle key={i} cx={cx - ux * (r + (pull * i) / 5)} cy={cy - uy * (r + (pull * i) / 5)} r={5} fill="#fff" opacity={0.85} />
      ))}
      <Line x1={cx + ux * (r + 6)} y1={cy + uy * (r + 6)} x2={endX} y2={endY} stroke={color} strokeWidth={7} strokeDasharray="16 10" strokeLinecap="round" />
      <Polygon
        points={`${endX + ux * 22},${endY + uy * 22} ${endX + px * 13},${endY + py * 13} ${endX - px * 13},${endY - py * 13}`}
        fill={color}
      />
      <SvgText x={cx} y={cy - r - 22 - power * 70} fill="#fff" fontSize={26} fontWeight="900" textAnchor="middle">
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
      <View style={styles.subCard}>
        <View style={styles.rowBetween}>
          <Text style={styles.subTitle}>⇄ Substitution · {side.name}</Text>
          <Text style={styles.subTimer}>
            {Math.ceil(Math.max(0, state.subTime))}s · {side.subsLeft} left
          </Text>
        </View>
        <Text style={styles.subHint}>{outId ? 'Now pick a bench puck to bring on' : 'Tap a puck on the field to take off'}</Text>

        <Text style={styles.subLabel}>ON FIELD</Text>
        <View style={styles.subRow}>
          {onField.map((p) => (
            <PuckCard key={p.id} puck={p} team={team} selected={p.id === outId} onPress={() => pick('out', p.id)} />
          ))}
        </View>

        <Text style={styles.subLabel}>BENCH</Text>
        <View style={styles.subRow}>
          {bench.map((p) => {
            const used = side.subbedOff.includes(p.id);
            return <PuckCard key={p.id} puck={p} team={team} disabled={used || !outId} used={used} onPress={() => pick('in', p.id)} />;
          })}
        </View>

        <Button title="Done" small onPress={() => send({ type: 'endSub' })} style={{ alignSelf: 'flex-end' }} />
      </View>
    </View>
  );
}

type PuckCardProps = {
  puck: SquadPuck;
  team: Team;
  selected?: boolean;
  disabled?: boolean;
  used?: boolean;
  onPress: () => void;
};

function PuckCard({ puck, team, selected, disabled, used, onPress }: PuckCardProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.puckCard, selected && { borderColor: COLORS.gold }, (used || disabled) && { opacity: used ? 0.35 : 0.75 }]}>
      <PuckArt size={38} team={team} number={puck.number} />
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
  screen: { flex: 1, backgroundColor: '#0a2a12' },
  hud: {
    height: 46,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    backgroundColor: '#0f172a',
  },
  exitBtn: { width: 34, height: 34, borderRadius: 8, backgroundColor: '#334155', alignItems: 'center', justifyContent: 'center' },
  exitText: { color: '#fff', fontSize: 16, fontWeight: '900' },
  tag: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#1e293b',
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  tagName: { color: '#fff', fontWeight: '800', fontSize: 13 },
  tagSub: { color: '#e2e8f0', fontSize: 10 },
  score: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '900',
    minWidth: 40,
    textAlign: 'center',
    backgroundColor: '#020617',
    borderRadius: 8,
    overflow: 'hidden',
    paddingVertical: 2,
  },
  clock: { width: 72, height: 38, borderRadius: 8, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' },
  clockText: { fontSize: 15, fontWeight: '900', color: '#0f172a' },
  clockSub: { fontSize: 10, fontWeight: '700', color: '#475569' },
  turnTrack: { height: 4, backgroundColor: '#020617' },
  middle: { flex: 1, flexDirection: 'row' },
  sidePanel: { width: SIDE_PANEL_W, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 12 },
  sideBtn: { width: 76, paddingVertical: 10, borderRadius: 14, alignItems: 'center' },
  sideBtnIcon: { fontSize: 20, color: '#fff' },
  sideBtnText: { color: '#fff', fontWeight: '900', fontSize: 14 },
  sideBtnSmall: { color: '#fff', fontSize: 10, opacity: 0.85 },
  fieldArea: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  bannerWrap: { position: 'absolute', top: 6, left: 0, right: 0, alignItems: 'center' },
  banner: {
    backgroundColor: 'rgba(2,6,23,0.75)',
    borderRadius: 20,
    borderWidth: 2,
    paddingVertical: 4,
    paddingHorizontal: 14,
    maxWidth: '90%',
  },
  bannerText: { color: '#fff', fontWeight: '700', fontSize: 12, textAlign: 'center' },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bigText: {
    fontSize: 60,
    fontWeight: '900',
    color: COLORS.gold,
    textShadowColor: '#000',
    textShadowOffset: { width: 2, height: 3 },
    textShadowRadius: 4,
  },
  subText: { fontSize: 18, color: '#fff', fontWeight: '700', textAlign: 'center' },
  endCard: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    minWidth: 320,
  },
  trophy: { fontSize: 44 },
  endTitle: { color: '#fff', fontSize: 26, fontWeight: '900' },
  reward: { color: COLORS.gold, fontSize: 18, fontWeight: '900' },
  row: { flexDirection: 'row', gap: 12, marginTop: 8 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  subCard: {
    backgroundColor: COLORS.card,
    borderRadius: 18,
    padding: 14,
    gap: 6,
    width: '92%',
    maxWidth: 720,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  subTitle: { color: '#fff', fontSize: 16, fontWeight: '900' },
  subTimer: { color: COLORS.gold, fontWeight: '900' },
  subHint: { color: COLORS.muted, fontSize: 12 },
  subLabel: { color: COLORS.muted, fontSize: 11, fontWeight: '800', marginTop: 4 },
  subRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  puckCard: {
    width: 74,
    alignItems: 'center',
    gap: 3,
    padding: 6,
    borderRadius: 12,
    backgroundColor: COLORS.cardLight,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  puckCardName: { color: '#fff', fontSize: 11, fontWeight: '800' },
  puckCardSub: { color: COLORS.muted, fontSize: 10 },
});

