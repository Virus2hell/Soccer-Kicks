// Landscape layouts: two side-by-side scrolling columns, and a stadium backdrop.

import { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, Rect, RadialGradient, Stop } from 'react-native-svg';

import { COLORS, styles as ui } from '@/components/ui/kit';
import { useSvgId } from '@/components/ui/svg-id';

export function Split({ left, right, leftFlex = 1, rightFlex = 1.25 }: { left: ReactNode; right: ReactNode; leftFlex?: number; rightFlex?: number }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[ui.screen, styles.split, { paddingRight: insets.right }]}>
      <Backdrop />
      <ScrollView style={{ flex: leftFlex, minWidth: 0 }} contentContainerStyle={ui.scroll} keyboardShouldPersistTaps="handled">
        {left}
      </ScrollView>
      <ScrollView style={{ flex: rightFlex, minWidth: 0 }} contentContainerStyle={[ui.scroll, { paddingLeft: 0 }]} keyboardShouldPersistTaps="handled">
        {right}
      </ScrollView>
    </View>
  );
}

/** Dark background with a soft floodlight glow and faint pitch stripes */
export function Backdrop() {
  const id = useSvgId();
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 100 100">
        <Defs>
          <RadialGradient id={`${id}-glow`} cx="20%" cy="0%" r="90%">
            <Stop offset="0" stopColor="#16a34a" stopOpacity="0.28" />
            <Stop offset="1" stopColor="#16a34a" stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id={`${id}-glow2`} cx="95%" cy="100%" r="70%">
            <Stop offset="0" stopColor="#2563eb" stopOpacity="0.18" />
            <Stop offset="1" stopColor="#2563eb" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100" height="100" fill={COLORS.bg} />
        {Array.from({ length: 10 }, (_, i) =>
          i % 2 ? null : <Rect key={i} x={i * 10} y="0" width="10" height="100" fill="#ffffff" opacity={0.018} />
        )}
        <Rect x="0" y="0" width="100" height="100" fill={`url(#${id}-glow)`} />
        <Rect x="0" y="0" width="100" height="100" fill={`url(#${id}-glow2)`} />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  split: { flexDirection: 'row' },
});
