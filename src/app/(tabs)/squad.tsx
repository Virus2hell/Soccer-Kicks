import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FormationPreview } from '@/components/game/formation-preview';
import { PuckArt } from '@/components/game/puck-art';
import { ColorPicker } from '@/components/ui/color-picker';
import { Card, Chip, Coins, COLORS, styles as ui } from '@/components/ui/kit';
import { Backdrop } from '@/components/ui/layout';
import type { PuckColorId } from '@/game/colors';
import { FORMATIONS, FORMATION_IDS } from '@/game/formations';
import { MAX_NAME_LENGTH, puckRating } from '@/game/pucks';
import type { FormationId, PuckData } from '@/game/types';
import { useAuth } from '@/lib/auth';

const CARDS_PER_ROW = 5;

export default function SquadScreen() {
  const { profile, call } = useAuth();
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState('');
  if (!profile) return null;

  const byId = new Map(profile.pucks.map((p) => [p.id, p]));
  const lineup = profile.lineup.map((id) => byId.get(id)!).filter(Boolean);
  const slots = FORMATIONS[profile.formation].slots;
  const starters = lineup.slice(0, 5);
  const bench = lineup.slice(5);

  const run = (p: Promise<unknown>) => {
    setError('');
    p.catch((e: Error) => setError(e.message));
  };

  const setFormation = (formation: FormationId) => run(call('profile:formation', { formation }));
  const setColor = (color: PuckColorId) => run(call('profile:color', { color }));

  // Tap one puck, then another: they swap places in the lineup
  const tap = (id: string) => {
    if (!selected) return setSelected(id);
    if (selected === id) return setSelected(null);
    const next = [...profile.lineup];
    const a = next.indexOf(selected);
    const b = next.indexOf(id);
    [next[a], next[b]] = [next[b], next[a]];
    setSelected(null);
    run(call('profile:lineup', { lineup: next }));
  };

  const renderRow = (pucks: PuckData[], badge: (i: number) => string) => (
    <View style={styles.cardRow}>
      {pucks.map((p, i) => (
        <PuckCard key={p.id} puck={p} color={profile.color} badge={badge(i)} selected={selected === p.id} onPress={() => tap(p.id)} />
      ))}
      {/* empty spacers keep bench cards the same width as starter cards */}
      {Array.from({ length: Math.max(0, CARDS_PER_ROW - pucks.length) }, (_, i) => (
        <View key={`spacer${i}`} style={styles.spacer} />
      ))}
    </View>
  );

  return (
    <View style={[ui.screen, { paddingLeft: insets.left, paddingRight: insets.right }]}>
      <Backdrop />
      <ScrollView contentContainerStyle={ui.scroll}>
        <View style={[ui.row, { justifyContent: 'space-between' }]}>
          <Text style={styles.title}>Squad</Text>
          <Coins amount={profile.coins} />
        </View>

        <View style={styles.topRow}>
          <Card style={{ flex: 1.15 }}>
            <Text style={ui.sectionTitle}>Formation</Text>
            <View style={[ui.row, { flexWrap: 'wrap', gap: 6 }]}>
              {FORMATION_IDS.map((id) => (
                <Chip key={id} label={FORMATIONS[id].label} selected={profile.formation === id} onPress={() => setFormation(id)} />
              ))}
            </View>
            <FormationPreview formation={profile.formation} numbers={starters.map((p) => p.number)} color={profile.color} />
          </Card>

          <Card style={{ flex: 1 }}>
            <Text style={ui.sectionTitle}>Puck color</Text>
            <ColorPicker value={profile.color} onChange={setColor} />
          </Card>
        </View>

        <Card>
          <View style={[ui.row, { justifyContent: 'space-between' }]}>
            <Text style={ui.sectionTitle}>Lineup</Text>
            <Text style={[ui.muted, selected && { color: COLORS.gold, fontWeight: '800' }]}>
              {selected ? 'Now tap the puck to swap with' : 'Tap two pucks to swap them'}
            </Text>
          </View>
          {!!error && <Text style={ui.error}>{error}</Text>}

          <Text style={styles.group}>STARTERS</Text>
          {renderRow(starters, (i) => slots[i].role)}

          <Text style={styles.group}>BENCH</Text>
          {renderRow(bench, () => 'SUB')}
        </Card>
      </ScrollView>
    </View>
  );
}

type PuckCardProps = { puck: PuckData; color: PuckColorId; badge: string; selected: boolean; onPress: () => void };

function PuckCard({ puck, color, badge, selected, onPress }: PuckCardProps) {
  const l = puck.levels;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, selected && styles.cardSelected, pressed && { opacity: 0.85 }]}>
      <View style={styles.cardTop}>
        <Text style={[styles.badge, badge === 'SUB' && { backgroundColor: COLORS.border }]}>{badge}</Text>
        <Text style={styles.rating}>{puckRating(l)}</Text>
      </View>

      <PuckArt size={58} color={color} number={puck.number} highlight={selected ? 'selected' : 'none'} />
      <Text style={styles.name} numberOfLines={1}>
        {puck.name.slice(0, MAX_NAME_LENGTH)}
      </Text>

      <View style={styles.stats}>
        <StatChip icon="💥" value={l.power} />
        <StatChip icon="🎯" value={l.accuracy} />
        <StatChip icon="📏" value={l.aim} />
        <StatChip icon="🔋" value={l.stamina} />
      </View>
      <Text style={ui.muted}>⚽ {puck.goals} goals</Text>

      <Pressable
        hitSlop={6}
        onPress={() => router.push({ pathname: '/puck/[id]', params: { id: puck.id } })}
        style={({ pressed }) => [styles.upgrade, pressed && { opacity: 0.8 }]}>
        <Text style={styles.upgradeText}>UPGRADE</Text>
      </Pressable>
    </Pressable>
  );
}

function StatChip({ icon, value }: { icon: string; value: number }) {
  return (
    <View style={styles.statChip}>
      <Text style={styles.statIcon}>{icon}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { color: COLORS.text, fontSize: 28, fontWeight: '900' },
  topRow: { flexDirection: 'row', gap: 14, alignItems: 'stretch' },
  group: { color: COLORS.muted, fontSize: 11, fontWeight: '900', marginTop: 4 },
  cardRow: { flexDirection: 'row', gap: 10 },
  spacer: { flex: 1 },
  card: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 16,
    backgroundColor: COLORS.cardLight,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  cardSelected: { borderColor: COLORS.gold, backgroundColor: '#3b2f0566' },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', alignSelf: 'stretch' },
  badge: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '900',
    backgroundColor: COLORS.accentDark,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    overflow: 'hidden',
  },
  rating: { color: COLORS.gold, fontWeight: '900', fontSize: 17 },
  name: { color: COLORS.text, fontWeight: '900', fontSize: 15, alignSelf: 'stretch', textAlign: 'center' },
  stats: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 4, alignSelf: 'stretch' },
  statChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    width: '46%',
    justifyContent: 'center',
    backgroundColor: COLORS.bg,
    borderRadius: 8,
    paddingVertical: 3,
  },
  statIcon: { fontSize: 12 },
  statValue: { color: COLORS.text, fontWeight: '900', fontSize: 13 },
  upgrade: {
    alignSelf: 'stretch',
    alignItems: 'center',
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: COLORS.accent,
    marginTop: 2,
  },
  upgradeText: { color: '#04140a', fontWeight: '900', fontSize: 12, letterSpacing: 0.5 },
});
