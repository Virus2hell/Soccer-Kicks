// The pitch, drawn once with SVG (memo: only re-draws if the size changes).

import { memo } from 'react';
import Svg, { Circle, Defs, G, Line, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

import { FIELD_H, FIELD_W, GOAL_DEPTH, GOAL_MOUTH, GOAL_TOP, POSTS, POST_R } from '@/game/physics';

export const CANVAS_W = FIELD_W + GOAL_DEPTH * 2;
export const CANVAS_H = FIELD_H;

const STRIPES = 14;
const LINE = 'rgba(255,255,255,0.85)';
const LW = 4;
const BOX_W = 160;
const BOX_H = 340;
const SMALL_BOX_W = 60;
const SMALL_BOX_H = 230;
const CIRCLE_R = 90;

export const Field = memo(function Field({ width, height }: { width: number; height: number }) {
  const gx = GOAL_DEPTH; // the field starts after the left goal
  const nets = [
    { x: 0, flip: false },
    { x: gx + FIELD_W, flip: true },
  ];

  return (
    <Svg width={width} height={height} viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}>
      <Defs>
        <RadialGradient id="vignette" cx="50%" cy="50%" r="65%">
          <Stop offset="0.55" stopColor="#000" stopOpacity="0" />
          <Stop offset="1" stopColor="#000" stopOpacity="0.45" />
        </RadialGradient>
        <RadialGradient id="spot" cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor="#fff" stopOpacity="0.12" />
          <Stop offset="1" stopColor="#fff" stopOpacity="0" />
        </RadialGradient>
      </Defs>

      {/* Goal nets */}
      {nets.map(({ x, flip }) => (
        <G key={x}>
          <Rect x={x} y={GOAL_TOP} width={GOAL_DEPTH} height={GOAL_MOUTH} fill="#1f2937" />
          {Array.from({ length: 8 }, (_, i) => (
            <Line key={`v${i}`} x1={x + (i * GOAL_DEPTH) / 7} y1={GOAL_TOP} x2={x + (i * GOAL_DEPTH) / 7} y2={GOAL_TOP + GOAL_MOUTH} stroke="#e5e7eb" strokeOpacity={0.35} strokeWidth={1.5} />
          ))}
          {Array.from({ length: 17 }, (_, i) => (
            <Line key={`h${i}`} x1={x} y1={GOAL_TOP + (i * GOAL_MOUTH) / 16} x2={x + GOAL_DEPTH} y2={GOAL_TOP + (i * GOAL_MOUTH) / 16} stroke="#e5e7eb" strokeOpacity={0.35} strokeWidth={1.5} />
          ))}
          <Path
            d={
              flip
                ? `M ${x} ${GOAL_TOP} H ${x + GOAL_DEPTH} V ${GOAL_TOP + GOAL_MOUTH} H ${x}`
                : `M ${x + GOAL_DEPTH} ${GOAL_TOP} H ${x} V ${GOAL_TOP + GOAL_MOUTH} H ${x + GOAL_DEPTH}`
            }
            stroke="#f8fafc"
            strokeWidth={5}
            fill="none"
          />
        </G>
      ))}

      {/* Grass with mowing stripes */}
      <Rect x={gx} y={0} width={FIELD_W} height={FIELD_H} fill="#2f8f2f" />
      {Array.from({ length: STRIPES }, (_, i) =>
        i % 2 ? null : <Rect key={i} x={gx + (i * FIELD_W) / STRIPES} y={0} width={FIELD_W / STRIPES} height={FIELD_H} fill="#3aa33a" />
      )}
      <Rect x={gx} y={0} width={FIELD_W} height={FIELD_H} fill="url(#spot)" />

      {/* Lines */}
      <G stroke={LINE} strokeWidth={LW} fill="none">
        <Rect x={gx + LW / 2} y={LW / 2} width={FIELD_W - LW} height={FIELD_H - LW} />
        <Line x1={gx + FIELD_W / 2} y1={0} x2={gx + FIELD_W / 2} y2={FIELD_H} />
        <Circle cx={gx + FIELD_W / 2} cy={FIELD_H / 2} r={CIRCLE_R} />

        {/* penalty + goal boxes */}
        <Rect x={gx} y={(FIELD_H - BOX_H) / 2} width={BOX_W} height={BOX_H} />
        <Rect x={gx + FIELD_W - BOX_W} y={(FIELD_H - BOX_H) / 2} width={BOX_W} height={BOX_H} />
        <Rect x={gx} y={(FIELD_H - SMALL_BOX_H) / 2} width={SMALL_BOX_W} height={SMALL_BOX_H} />
        <Rect x={gx + FIELD_W - SMALL_BOX_W} y={(FIELD_H - SMALL_BOX_H) / 2} width={SMALL_BOX_W} height={SMALL_BOX_H} />

        {/* penalty arcs */}
        <Path d={`M ${gx + BOX_W} ${FIELD_H / 2 - 55} A 70 70 0 0 1 ${gx + BOX_W} ${FIELD_H / 2 + 55}`} />
        <Path d={`M ${gx + FIELD_W - BOX_W} ${FIELD_H / 2 - 55} A 70 70 0 0 0 ${gx + FIELD_W - BOX_W} ${FIELD_H / 2 + 55}`} />

        {/* corner arcs */}
        <Path d={`M ${gx} 22 A 22 22 0 0 0 ${gx + 22} 0`} />
        <Path d={`M ${gx} ${FIELD_H - 22} A 22 22 0 0 1 ${gx + 22} ${FIELD_H}`} />
        <Path d={`M ${gx + FIELD_W} 22 A 22 22 0 0 1 ${gx + FIELD_W - 22} 0`} />
        <Path d={`M ${gx + FIELD_W} ${FIELD_H - 22} A 22 22 0 0 0 ${gx + FIELD_W - 22} ${FIELD_H}`} />
      </G>
      <Circle cx={gx + FIELD_W / 2} cy={FIELD_H / 2} r={7} fill={LINE} />
      <Circle cx={gx + 115} cy={FIELD_H / 2} r={5} fill={LINE} />
      <Circle cx={gx + FIELD_W - 115} cy={FIELD_H / 2} r={5} fill={LINE} />

      {/* Shadowy edges */}
      <Rect x={gx} y={0} width={FIELD_W} height={FIELD_H} fill="url(#vignette)" />

      {/* Goal posts */}
      {POSTS.map((p, i) => (
        <Circle key={i} cx={p.x + gx} cy={p.y} r={POST_R + 2} fill="#f8fafc" stroke="#64748b" strokeWidth={2} />
      ))}
    </Svg>
  );
});
