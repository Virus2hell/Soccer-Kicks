// Small reusable UI pieces with one consistent dark "sports app" look.

import { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';

export const COLORS = {
  bg: '#0b1220',
  card: '#151f32',
  cardLight: '#1f2b44',
  border: '#2a3956',
  text: '#f8fafc',
  muted: '#94a3b8',
  accent: '#22c55e',
  accentDark: '#15803d',
  gold: '#facc15',
  danger: '#ef4444',
  team: ['#3b82f6', '#f97316'] as const,
};

type ButtonProps = {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  small?: boolean;
};

export function Button({ title, onPress, variant = 'primary', disabled, loading, style, small }: ButtonProps) {
  const bg = variant === 'primary' ? COLORS.accent : variant === 'danger' ? COLORS.danger : COLORS.cardLight;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        small && styles.buttonSmall,
        { backgroundColor: bg, opacity: disabled ? 0.45 : pressed ? 0.8 : 1 },
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <Text style={[styles.buttonText, small && { fontSize: 14 }]}>{title}</Text>
      )}
    </Pressable>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

export function Chip({ label, selected, onPress }: { label: string; selected?: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, selected && styles.chipSelected]}>
      <Text style={[styles.chipText, selected && { color: '#04140a' }]}>{label}</Text>
    </Pressable>
  );
}

/** Horizontal bar, `value` from 0 to 1 */
export function Bar({ value, color = COLORS.accent, height = 6 }: { value: number; color?: string; height?: number }) {
  return (
    <View style={[styles.barTrack, { height, borderRadius: height / 2 }]}>
      <View style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%`, height, borderRadius: height / 2, backgroundColor: color }} />
    </View>
  );
}

export const healthColor = (health: number) => (health > 60 ? '#22c55e' : health > 30 ? '#facc15' : '#ef4444');

export function Coins({ amount }: { amount: number }) {
  return (
    <View style={styles.coins}>
      <Text style={styles.coinsText}>🪙 {amount}</Text>
    </View>
  );
}

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { padding: 16, gap: 14, paddingBottom: 40 },
  button: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonSmall: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 0.3 },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 10,
  },
  sectionTitle: { color: COLORS.text, fontSize: 18, fontWeight: '800' },
  text: { color: COLORS.text, fontSize: 15 },
  muted: { color: COLORS.muted, fontSize: 13 },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: COLORS.cardLight,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  chipSelected: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  chipText: { color: COLORS.text, fontWeight: '700' },
  barTrack: { flex: 1, backgroundColor: '#0f172a', overflow: 'hidden' },
  input: {
    backgroundColor: COLORS.bg,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  label: { color: COLORS.muted, fontSize: 13, fontWeight: '600' },
  error: { color: COLORS.danger, fontWeight: '600' },
  coins: { backgroundColor: '#3b2f05', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20 },
  coinsText: { color: COLORS.gold, fontWeight: '800' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
});
