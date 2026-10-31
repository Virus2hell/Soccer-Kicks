import Svg, { Circle, Line, Rect, Text as SvgText } from 'react-native-svg';

import { PUCK_COLORS, PuckColorId } from '@/game/colors';
import { FORMATIONS } from '@/game/formations';
import type { FormationId } from '@/game/types';

// Half a pitch showing where each starter stands (numbers = puck numbers)
export function FormationPreview({ formation, numbers, color }: { formation: FormationId; numbers: number[]; color: PuckColorId }) {
  const slots = FORMATIONS[formation].slots;
  const c = PUCK_COLORS[color];
  return (
    <Svg width="100%" height={170} viewBox="0 0 520 600" preserveAspectRatio="xMidYMid meet">
      <Rect x={0} y={0} width={520} height={600} rx={22} fill="#2e8b3a" />
      {[0, 2, 4].map((i) => (
        <Rect key={i} x={i * 104} y={0} width={104} height={600} fill="#38a346" />
      ))}
      <Rect x={12} y={120} width={170} height={360} stroke="#fff" strokeOpacity={0.8} strokeWidth={5} fill="none" />
      <Line x1={500} y1={0} x2={500} y2={600} stroke="#fff" strokeOpacity={0.8} strokeWidth={5} />
      <Circle cx={500} cy={300} r={95} stroke="#fff" strokeOpacity={0.8} strokeWidth={5} fill="none" />
      {slots.map((s, i) => {
        const x = s.x * 1000;
        const y = s.y * 600;
        return (
          <SvgPuck key={i} x={x} y={y} label={String(numbers[i] ?? '')} role={s.role} main={c.main} side={c.side} light={c.light} />
        );
      })}
    </Svg>
  );
}

type SvgPuckProps = { x: number; y: number; label: string; role: string; main: string; side: string; light: string };

function SvgPuck({ x, y, label, role, main, side, light }: SvgPuckProps) {
  return (
    <>
      <Circle cx={x + 4} cy={y + 10} r={44} fill="#000" opacity={0.3} />
      <Circle cx={x} cy={y + 7} r={44} fill={side} />
      <Circle cx={x} cy={y} r={44} fill={main} stroke={light} strokeWidth={5} />
      <Circle cx={x} cy={y} r={24} fill="#fff" />
      <SvgText x={x} y={y + 11} fontSize={30} fontWeight="900" fill={side} textAnchor="middle">
        {label}
      </SvgText>
      <SvgText x={x} y={y + 74} fontSize={24} fontWeight="900" fill="#fff" textAnchor="middle">
        {role}
      </SvgText>
    </>
  );
}
