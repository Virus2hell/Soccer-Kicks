// The pitch, drawn once with SVG (memo: only re-draws if the size changes).
// Game units: the playing area is FIELD_W x FIELD_H; the canvas adds the goal
// nets on both sides and a border all around.

import { memo, useMemo } from 'react';
import Svg, { Circle, Defs, G, Line, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

import { useSvgId } from '@/components/ui/svg-id';
import { FIELD_H, FIELD_W, GOAL_DEPTH, GOAL_MOUTH, GOAL_TOP, POSTS, POST_R } from '@/game/physics';

const PAD = 22; // border around the playing area
export const ORIGIN_X = GOAL_DEPTH + PAD; // where game x = 0 is on the canvas
export const ORIGIN_Y = PAD;
export const CANVAS_W = FIELD_W + ORIGIN_X * 2;
export const CANVAS_H = FIELD_H + PAD * 2;

const STRIPES = 12;
const INSET = 16; // painted lines sit a little inside the walls
const LINE = 'rgba(255,255,255,0.92)';
const LW = 5;
const BOX_W = 170;
const BOX_H = 360;
const SMALL_W = 66;
const SMALL_H = 230;
const CIRCLE_R = 95;

// Same "random" grass texture every time
function grassSpecks() {
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  return Array.from({ length: 260 }, () => ({
    x: rand() * FIELD_W,
    y: rand() * FIELD_H,
    w: 2 + rand() * 3,
    h: 6 + rand() * 8,
    light: rand() > 0.5,
  }));
}

export const Field = memo(function Field({ width, height }: { width: number; height: number }) {
  const specks = useMemo(grassSpecks, []);
  const id = useSvgId();
  const x0 = ORIGIN_X;
  const y0 = ORIGIN_Y;
  const left = x0 + INSET;
  const right = x0 + FIELD_W - INSET;
  const top = y0 + INSET;
  const bottom = y0 + FIELD_H - INSET;
  const midX = x0 + FIELD_W / 2;
  const midY = y0 + FIELD_H / 2;

  return (
    <Svg width={width} height={height} viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}>
      <Defs>
        <LinearGradient id={`${id}-apron`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#14532d" />
          <Stop offset="1" stopColor="#0f3d21" />
        </LinearGradient>
        <RadialGradient id={`${id}-lights`} cx="50%" cy="45%" r="60%">
          <Stop offset="0" stopColor="#fff" stopOpacity="0.16" />
          <Stop offset="1" stopColor="#fff" stopOpacity="0" />
        </RadialGradient>
        <RadialGradient id={`${id}-vignette`} cx="50%" cy="50%" r="70%">
          <Stop offset="0.6" stopColor="#000" stopOpacity="0" />
          <Stop offset="1" stopColor="#000" stopOpacity="0.4" />
        </RadialGradient>
        <LinearGradient id={`${id}-board`} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#fde047" />
          <Stop offset="1" stopColor="#ca8a04" />
        </LinearGradient>
        <LinearGradient id={`${id}-board2`} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#38bdf8" />
          <Stop offset="1" stopColor="#0369a1" />
        </LinearGradient>
        <LinearGradient id={`${id}-netShade`} x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor="#0f172a" stopOpacity="0.85" />
          <Stop offset="1" stopColor="#1e293b" stopOpacity="0.55" />
        </LinearGradient>
      </Defs>

      {/* Stadium surround */}
      <Rect x={0} y={0} width={CANVAS_W} height={CANVAS_H} rx={26} fill={`url(#${id}-apron)`} />

      {/* Advertising boards behind the goals */}
      {[0, 1].map((side) => {
        const bx = side === 0 ? 8 : CANVAS_W - ORIGIN_X + 14;
        const bw = ORIGIN_X - 22;
        return (
          <G key={side}>
            <Rect x={bx} y={y0 + 18} width={bw} height={GOAL_TOP - 40} rx={8} fill={`url(#${id}-board)`} />
            <Rect x={bx} y={y0 + GOAL_TOP + GOAL_MOUTH + 22} width={bw} height={GOAL_TOP - 40} rx={8} fill={`url(#${id}-board2)`} />
          </G>
        );
      })}

      {/* Goal nets */}
      {[0, 1].map((side) => {
        const nx = side === 0 ? x0 - GOAL_DEPTH : x0 + FIELD_W;
        const ny = y0 + GOAL_TOP;
        const back = side === 0 ? nx : nx + GOAL_DEPTH;
        const front = side === 0 ? nx + GOAL_DEPTH : nx;
        return (
          <G key={side}>
            <Rect x={nx} y={ny} width={GOAL_DEPTH} height={GOAL_MOUTH} fill={`url(#${id}-netShade)`} />
            {Array.from({ length: 12 }, (_, i) => (
              <Line key={`a${i}`} x1={nx} y1={ny + i * 20 - 40} x2={nx + GOAL_DEPTH} y2={ny + i * 20 + 30} stroke="#e2e8f0" strokeOpacity={0.35} strokeWidth={1.5} />
            ))}
            {Array.from({ length: 12 }, (_, i) => (
              <Line key={`b${i}`} x1={nx} y1={ny + i * 20 + 30} x2={nx + GOAL_DEPTH} y2={ny + i * 20 - 40} stroke="#e2e8f0" strokeOpacity={0.35} strokeWidth={1.5} />
            ))}
            {/* cover the mesh that sticks out above/below the net */}
            <Rect x={nx - 2} y={ny - 60} width={GOAL_DEPTH + 4} height={60} fill="#14532d" />
            <Rect x={nx - 2} y={ny + GOAL_MOUTH} width={GOAL_DEPTH + 4} height={60} fill="#0f3d21" />
            <Path
              d={`M ${front} ${ny} H ${back} V ${ny + GOAL_MOUTH} H ${front}`}
              stroke="#f8fafc"
              strokeWidth={7}
              strokeLinejoin="round"
              fill="none"
            />
          </G>
        );
      })}

      {/* Grass: vertical mowing stripes + faint horizontal ones */}
      <Rect x={x0} y={y0} width={FIELD_W} height={FIELD_H} fill="#2e8b3a" />
      {Array.from({ length: STRIPES }, (_, i) =>
        i % 2 ? null : <Rect key={i} x={x0 + (i * FIELD_W) / STRIPES} y={y0} width={FIELD_W / STRIPES} height={FIELD_H} fill="#38a346" />
      )}
      {Array.from({ length: 6 }, (_, i) =>
        i % 2 ? null : <Rect key={`h${i}`} x={x0} y={y0 + (i * FIELD_H) / 6} width={FIELD_W} height={FIELD_H / 6} fill="#000" opacity={0.05} />
      )}
      {specks.map((s, i) => (
        <Rect key={`s${i}`} x={x0 + s.x} y={y0 + s.y} width={s.w} height={s.h} rx={1} fill={s.light ? '#7dd87f' : '#1b5e20'} opacity={0.22} />
      ))}
      <Rect x={x0} y={y0} width={FIELD_W} height={FIELD_H} fill={`url(#${id}-lights)`} />

      {/* Markings */}
      <G stroke={LINE} strokeWidth={LW} fill="none">
        <Rect x={left} y={top} width={right - left} height={bottom - top} />
        <Line x1={midX} y1={top} x2={midX} y2={bottom} />
        <Circle cx={midX} cy={midY} r={CIRCLE_R} />

        <Rect x={left} y={midY - BOX_H / 2} width={BOX_W} height={BOX_H} />
        <Rect x={right - BOX_W} y={midY - BOX_H / 2} width={BOX_W} height={BOX_H} />
        <Rect x={left} y={midY - SMALL_H / 2} width={SMALL_W} height={SMALL_H} />
        <Rect x={right - SMALL_W} y={midY - SMALL_H / 2} width={SMALL_W} height={SMALL_H} />

        <Path d={`M ${left + BOX_W} ${midY - 58} A 75 75 0 0 1 ${left + BOX_W} ${midY + 58}`} />
        <Path d={`M ${right - BOX_W} ${midY - 58} A 75 75 0 0 0 ${right - BOX_W} ${midY + 58}`} />

        <Path d={`M ${left} ${top + 24} A 24 24 0 0 0 ${left + 24} ${top}`} />
        <Path d={`M ${left} ${bottom - 24} A 24 24 0 0 1 ${left + 24} ${bottom}`} />
        <Path d={`M ${right} ${top + 24} A 24 24 0 0 1 ${right - 24} ${top}`} />
        <Path d={`M ${right} ${bottom - 24} A 24 24 0 0 0 ${right - 24} ${bottom}`} />
      </G>
      <Circle cx={midX} cy={midY} r={8} fill={LINE} />
      <Circle cx={left + 120} cy={midY} r={6} fill={LINE} />
      <Circle cx={right - 120} cy={midY} r={6} fill={LINE} />

      <Rect x={x0} y={y0} width={FIELD_W} height={FIELD_H} fill={`url(#${id}-vignette)`} />

      {/* Walls (rail) around the playing area, open at the goals */}
      <Path
        d={`M ${x0} ${y0 + GOAL_TOP} V ${y0} H ${x0 + FIELD_W} V ${y0 + GOAL_TOP} M ${x0 + FIELD_W} ${y0 + GOAL_TOP + GOAL_MOUTH} V ${y0 + FIELD_H} H ${x0} V ${y0 + GOAL_TOP + GOAL_MOUTH}`}
        stroke="#cbd5e1"
        strokeWidth={10}
        strokeLinejoin="round"
        fill="none"
      />
      <Path
        d={`M ${x0} ${y0 + GOAL_TOP} V ${y0} H ${x0 + FIELD_W} V ${y0 + GOAL_TOP} M ${x0 + FIELD_W} ${y0 + GOAL_TOP + GOAL_MOUTH} V ${y0 + FIELD_H} H ${x0} V ${y0 + GOAL_TOP + GOAL_MOUTH}`}
        stroke="#64748b"
        strokeWidth={3}
        strokeLinejoin="round"
        fill="none"
        transform="translate(0 3)"
      />

      {/* Goal posts */}
      {POSTS.map((p, i) => (
        <G key={i}>
          <Circle cx={p.x + x0 + 2} cy={p.y + y0 + 3} r={POST_R + 3} fill="#000" opacity={0.35} />
          <Circle cx={p.x + x0} cy={p.y + y0} r={POST_R + 3} fill="#f8fafc" stroke="#94a3b8" strokeWidth={2} />
        </G>
      ))}
    </Svg>
  );
});
