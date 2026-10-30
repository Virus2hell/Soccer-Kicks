// SVG artwork for pucks, the ball and trick-shot blocks.
// Wrapped in memo() so they only re-draw when their look changes,
// not on every frame when they move.

import { memo } from 'react';
import Svg, { Circle, Defs, G, LinearGradient, Polygon, RadialGradient, Stop, Text as SvgText } from 'react-native-svg';

import { healthColor } from '@/components/ui/kit';

const TEAM_STYLE = [
  { light: '#93c5fd', main: '#2563eb', dark: '#1e3a8a', rim: '#dbeafe' },
  { light: '#fdba74', main: '#ea580c', dark: '#7c2d12', rim: '#ffedd5' },
];

type PuckArtProps = {
  size: number;
  team: 0 | 1;
  number: number;
  health?: number; // 0..100, draws a ring when given
  highlight?: 'none' | 'active' | 'selected';
};

export const PuckArt = memo(function PuckArt({ size, team, number, health, highlight = 'none' }: PuckArtProps) {
  const s = TEAM_STYLE[team];
  const id = `t${team}`;
  const hp = health ?? 100;
  const ringR = 40;
  const circumference = 2 * Math.PI * ringR;

  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Defs>
        <RadialGradient id={`${id}-body`} cx="38%" cy="32%" r="70%">
          <Stop offset="0" stopColor={s.light} />
          <Stop offset="0.55" stopColor={s.main} />
          <Stop offset="1" stopColor={s.dark} />
        </RadialGradient>
        <LinearGradient id={`${id}-cap`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#ffffff" stopOpacity="0.95" />
          <Stop offset="1" stopColor={s.rim} stopOpacity="0.85" />
        </LinearGradient>
      </Defs>

      {/* glow when it's this player's turn */}
      {highlight !== 'none' && (
        <Circle cx="50" cy="50" r="49" fill="none" stroke={highlight === 'selected' ? '#facc15' : '#ffffff'} strokeWidth="3" opacity={0.9} />
      )}
      {/* shadow + body */}
      <Circle cx="52" cy="54" r="44" fill="#000" opacity={0.35} />
      <Circle cx="50" cy="50" r="44" fill={`url(#${id}-body)`} />
      {/* health ring */}
      {health !== undefined && (
        <G transform="rotate(-90 50 50)">
          <Circle cx="50" cy="50" r={ringR} fill="none" stroke="#0008" strokeWidth="5" />
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
      {/* center cap with number */}
      <Circle cx="50" cy="50" r="25" fill={`url(#${id}-cap)`} stroke={s.dark} strokeWidth="2" />
      <SvgText x="50" y="59" fontSize="26" fontWeight="900" fill={s.dark} textAnchor="middle">
        {String(number)}
      </SvgText>
      {/* shine */}
      <Circle cx="36" cy="30" r="9" fill="#fff" opacity={0.25} />
    </Svg>
  );
});

export const BallArt = memo(function BallArt({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Defs>
        <RadialGradient id="ball" cx="40%" cy="35%" r="70%">
          <Stop offset="0" stopColor="#ffffff" />
          <Stop offset="0.7" stopColor="#e5e7eb" />
          <Stop offset="1" stopColor="#9ca3af" />
        </RadialGradient>
      </Defs>
      <Circle cx="53" cy="55" r="46" fill="#000" opacity={0.3} />
      <Circle cx="50" cy="50" r="46" fill="url(#ball)" stroke="#111" strokeWidth="3" />
      <Polygon points="50,34 65,45 59,62 41,62 35,45" fill="#111" />
      <Polygon points="50,6 60,12 50,20 40,12" fill="#111" />
      <Polygon points="88,40 92,55 82,58 78,44" fill="#111" />
      <Polygon points="12,40 22,44 18,58 8,55" fill="#111" />
      <Polygon points="30,82 40,76 46,88 36,93" fill="#111" />
      <Polygon points="70,82 64,93 54,88 60,76" fill="#111" />
    </Svg>
  );
});

export const BlockArt = memo(function BlockArt({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Defs>
        <RadialGradient id="block" cx="40%" cy="35%" r="70%">
          <Stop offset="0" stopColor="#f1f5f9" />
          <Stop offset="0.6" stopColor="#94a3b8" />
          <Stop offset="1" stopColor="#334155" />
        </RadialGradient>
      </Defs>
      <Circle cx="53" cy="55" r="44" fill="#000" opacity={0.35} />
      <Circle cx="50" cy="50" r="44" fill="url(#block)" stroke="#1e293b" strokeWidth="3" />
      <Circle cx="50" cy="50" r="22" fill="none" stroke="#ef4444" strokeWidth="8" />
      <Circle cx="50" cy="50" r="7" fill="#ef4444" />
    </Svg>
  );
});
