import Svg, { Circle, Line, Rect, Text as SvgText } from 'react-native-svg';

import { FORMATIONS } from '@/game/formations';
import type { FormationId } from '@/game/types';

// Half a pitch showing where each starter stands (numbers = puck numbers)
export function FormationPreview({ formation, numbers }: { formation: FormationId; numbers: number[] }) {
  const slots = FORMATIONS[formation].slots;
  return (
    <Svg width="100%" height={180} viewBox="0 0 520 600" preserveAspectRatio="xMidYMid meet">
      <Rect x={0} y={0} width={520} height={600} rx={18} fill="#2f8f2f" />
      {[0, 2, 4].map((i) => (
        <Rect key={i} x={i * 104} y={0} width={104} height={600} fill="#3aa33a" />
      ))}
      <Rect x={4} y={130} width={160} height={340} stroke="#fff" strokeOpacity={0.7} strokeWidth={5} fill="none" />
      <Line x1={500} y1={0} x2={500} y2={600} stroke="#fff" strokeOpacity={0.7} strokeWidth={5} />
      <Circle cx={500} cy={300} r={90} stroke="#fff" strokeOpacity={0.7} strokeWidth={5} fill="none" />
      {slots.map((s, i) => (
        <SvgPuck key={i} x={s.x * 1000} y={s.y * 600} label={String(numbers[i] ?? '')} role={s.role} />
      ))}
    </Svg>
  );
}

function SvgPuck({ x, y, label, role }: { x: number; y: number; label: string; role: string }) {
  return (
    <>
      <Circle cx={x + 3} cy={y + 4} r={40} fill="#000" opacity={0.3} />
      <Circle cx={x} cy={y} r={40} fill="#2563eb" stroke="#dbeafe" strokeWidth={5} />
      <SvgText x={x} y={y + 12} fontSize={34} fontWeight="900" fill="#fff" textAnchor="middle">
        {label}
      </SvgText>
      <SvgText x={x} y={y + 66} fontSize={24} fontWeight="800" fill="#fff" textAnchor="middle">
        {role}
      </SvgText>
    </>
  );
}
