// SVG artwork for pucks, the ball and trick-shot blocks.
// Pucks are drawn as short cylinders seen slightly from above (side wall +
// glossy top face) so they look 3D. Wrapped in memo() so they only re-draw
// when their look changes — movement is done by the parent, not by redrawing.

import { memo } from 'react';
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, Polygon, RadialGradient, Stop, Text as SvgText } from 'react-native-svg';

import { healthColor } from '@/components/ui/kit';
import { useSvgId } from '@/components/ui/svg-id';
import { PUCK_COLORS, PuckColorId } from '@/game/colors';

/** The art is drawn in a 100x100 box; the puck's top face is 82 wide */
export const PUCK_ART_SCALE = 100 / 82;

type PuckArtProps = {
  size: number; // size of the whole art box (use diameter * PUCK_ART_SCALE)
  color: PuckColorId;
  number: number;
  health?: number; // 0..100, draws a ring when given
  highlight?: 'none' | 'active' | 'selected';
};

export const PuckArt = memo(function PuckArt({ size, color, number, health, highlight = 'none' }: PuckArtProps) {
  const c = PUCK_COLORS[color];
  const id = useSvgId();
  const hp = health ?? 100;
  const ringR = 33;
  const circumference = 2 * Math.PI * ringR;
  const glow = highlight === 'selected' ? '#facc15' : '#7dd3fc';

  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Defs>
        <RadialGradient id={`${id}-top`} cx="40%" cy="30%" r="75%">
          <Stop offset="0" stopColor={c.light} />
          <Stop offset="0.45" stopColor={c.main} />
          <Stop offset="1" stopColor={c.dark} />
        </RadialGradient>
        <LinearGradient id={`${id}-side`} x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor={c.side} />
          <Stop offset="0.35" stopColor={c.dark} />
          <Stop offset="0.7" stopColor={c.side} />
          <Stop offset="1" stopColor="#000" />
        </LinearGradient>
        <RadialGradient id={`${id}-emblem`} cx="40%" cy="35%" r="70%">
          <Stop offset="0" stopColor="#ffffff" />
          <Stop offset="1" stopColor={c.emblem} />
        </RadialGradient>
        <RadialGradient id={`${id}-shadow`} cx="50%" cy="50%" r="50%">
          <Stop offset="0.6" stopColor="#000" stopOpacity="0.45" />
          <Stop offset="1" stopColor="#000" stopOpacity="0" />
        </RadialGradient>
      </Defs>

      {/* soft shadow on the grass */}
      <Ellipse cx="54" cy="60" rx="48" ry="44" fill={`url(#${id}-shadow)`} />

      {/* glow ring when this puck can be played */}
      {highlight !== 'none' && (
        <>
          <Circle cx="50" cy="50" r="48" fill="none" stroke={glow} strokeWidth="2" opacity={0.5} />
          <Circle cx="50" cy="50" r="45.5" fill="none" stroke={glow} strokeWidth="3" opacity={0.95} />
        </>
      )}

      {/* side wall: bottom disc + band joining it to the top face */}
      <Circle cx="50" cy="57" r="41" fill={`url(#${id}-side)`} />
      <Path d="M 9 50 L 9 57 A 41 41 0 0 0 91 57 L 91 50 Z" fill={`url(#${id}-side)`} />

      {/* top face */}
      <Circle cx="50" cy="50" r="41" fill={`url(#${id}-top)`} />
      <Circle cx="50" cy="50" r="39.5" fill="none" stroke="#ffffff" strokeOpacity={0.55} strokeWidth="2" />
      <Circle cx="50" cy="50" r="41" fill="none" stroke={c.dark} strokeWidth="1.5" />

      {/* health ring */}
      {health !== undefined && (
        <G transform="rotate(-90 50 50)">
          <Circle cx="50" cy="50" r={ringR} fill="none" stroke="#00000055" strokeWidth="5" />
          <Circle
            cx="50"
            cy="50"
            r={ringR}
            fill="none"
            stroke={healthColor(hp)}
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={`${(circumference * hp) / 100} ${circumference}`}
          />
        </G>
      )}

      {/* raised emblem with the number */}
      <Circle cx="50" cy="52" r="24" fill={c.side} opacity={0.6} />
      <Circle cx="50" cy="50" r="24" fill={`url(#${id}-emblem)`} stroke={c.dark} strokeWidth="2" />
      <SvgText x="50" y="60" fontSize="27" fontWeight="900" fill={c.ink} textAnchor="middle" fontFamily="sans-serif">
        {String(number)}
      </SvgText>

      {/* glossy shine */}
      <Path d="M 22 36 A 32 32 0 0 1 58 16 A 40 40 0 0 0 26 42 Z" fill="#ffffff" opacity={0.35} />
    </Svg>
  );
});

export const BallArt = memo(function BallArt({ size }: { size: number }) {
  const id = useSvgId();
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Defs>
        <RadialGradient id={`${id}-ball`} cx="38%" cy="32%" r="72%">
          <Stop offset="0" stopColor="#ffffff" />
          <Stop offset="0.65" stopColor="#e5e7eb" />
          <Stop offset="1" stopColor="#6b7280" />
        </RadialGradient>
        <RadialGradient id={`${id}-bshadow`} cx="50%" cy="50%" r="50%">
          <Stop offset="0.5" stopColor="#000" stopOpacity="0.5" />
          <Stop offset="1" stopColor="#000" stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Ellipse cx="58" cy="62" rx="44" ry="40" fill={`url(#${id}-bshadow)`} />
      <Circle cx="50" cy="50" r="44" fill={`url(#${id}-ball)`} stroke="#1f2937" strokeWidth="2.5" />
      <Polygon points="50,34 65,45 59,62 41,62 35,45" fill="#111827" />
      <Polygon points="50,7 60,13 50,21 40,13" fill="#111827" />
      <Polygon points="86,40 90,55 81,58 77,44" fill="#111827" />
      <Polygon points="14,40 23,44 19,58 10,55" fill="#111827" />
      <Polygon points="31,81 41,75 46,87 37,92" fill="#111827" />
      <Polygon points="69,81 63,92 54,87 59,75" fill="#111827" />
      <Ellipse cx="37" cy="29" rx="12" ry="8" fill="#ffffff" opacity={0.7} />
    </Svg>
  );
});

export const BlockArt = memo(function BlockArt({ size }: { size: number }) {
  const id = useSvgId();
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Defs>
        <RadialGradient id={`${id}-block`} cx="40%" cy="30%" r="75%">
          <Stop offset="0" stopColor="#f8fafc" />
          <Stop offset="0.55" stopColor="#94a3b8" />
          <Stop offset="1" stopColor="#334155" />
        </RadialGradient>
      </Defs>
      <Circle cx="54" cy="58" r="44" fill="#000" opacity={0.3} />
      <Circle cx="50" cy="56" r="42" fill="#1e293b" />
      <Circle cx="50" cy="50" r="42" fill={`url(#${id}-block)`} stroke="#1e293b" strokeWidth="2" />
      <Circle cx="50" cy="50" r="24" fill="none" stroke="#ef4444" strokeWidth="8" />
      <Circle cx="50" cy="50" r="8" fill="#ef4444" />
    </Svg>
  );
});
