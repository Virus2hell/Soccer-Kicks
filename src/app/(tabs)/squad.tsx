import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FormationPreview } from '@/components/game/formation-preview';
import { PuckArt } from '@/components/game/puck-art';
import { Card, Chip, Coins, COLORS, styles as ui } from '@/components/ui/kit';
import { FORMATIONS, FORMATION_IDS } from '@/game/formations';
import { puckRating } from '@/game/pucks';
import type { FormationId, PuckData } from '@/game/types';
import { useAuth } from '@/lib/auth';

export default function SquadScreen() {
  const { profile, call } = useAuth();
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState('');
  if (!profile) return null;

  const byId = new Map(profile.pucks.map((p) => [p.id, p]));
  const lineup = profile.lineup.map((id) => byId.get(id)!).filter(Boolean);
  const slots = FORMATIONS[profile.formation].slots;

  const run = (p: Promise<unknown>) => {
    setError('');
    p.catch((e: Error) => setError(e.message));
  };

  const setFormation = (formation: FormationId) => run(call('profile:formation', { formation }));

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

  return (
    <SafeAreaView style={ui.screen} edges={['top']}>
      <ScrollView contentContainerStyle={ui.scroll}>
        <View style={[ui.row, { justifyContent: 'space-between' }]}>
          <Text style={styles.title}>Squad</Text>
          <Coins amount={profile.coins} />
        </View>

        <Card>
          <Text style={ui.sectionTitle}>Formation</Text>
          <View style={[ui.row, { flexWrap: 'wrap' }]}>
            {FORMATION_IDS.map((id) => (
              <Chip key={id} label={FORMATIONS[id].label} selected={profile.formation === id} onPress={() => setFormation(id)} />
            ))}
          </View>
          <FormationPreview formation={profile.formation} numbers={lineup.slice(0, 5).map((p) => p.number)} />
        </Card>

        <Card>
          <Text style={ui.sectionTitle}>Lineup</Text>
          <Text style={ui.muted}>
            {selected ? 'Now tap the puck to swap with' : 'Tap two pucks to swap them. Top 5 start, the rest are subs.'}
          </Text>
          {!!error && <Text style={ui.error}>{error}</Text>}

          <Text style={styles.group}>STARTERS</Text>
          {lineup.slice(0, 5).map((p, i) => (
            <PuckRow key={p.id} puck={p} badge={slots[i].role} selected={selected === p.id} onPress={() => tap(p.id)} />
          ))}

          <Text style={styles.group}>BENCH</Text>
          {lineup.slice(5).map((p) => (
            <PuckRow key={p.id} puck={p} badge="SUB" selected={selected === p.id} onPress={() => tap(p.id)} />
          ))}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

function PuckRow({ puck, badge, selected, onPress }: { puck: PuckData; badge: string; selected: boolean; onPress: () => void }) {
  const l = puck.levels;
  return (
    <Pressable onPress={onPress} style={[styles.row, selected && { borderColor: COLORS.gold }]}>
      <Text style={styles.badge}>{badge}</Text>
      <PuckArt size={44} team={0} number={puck.number} />
      <View style={{ flex: 1 }}>
        <Text style={styles.name}>{puck.name}</Text>
        <Text style={ui.muted}>
          💥{l.power} 🎯{l.accuracy} 📏{l.aim} 🔋{l.stamina} · ⚽ {puck.goals}
        </Text>
      </View>
      <Text style={styles.rating}>{puckRating(l)}</Text>
      <Pressable
        hitSlop={10}
        onPress={() => router.push({ pathname: '/puck/[id]', params: { id: puck.id } })}
        style={styles.details}>
        <Text style={{ color: COLORS.text, fontWeight: '900' }}>›</Text>
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  title: { color: COLORS.text, fontSize: 28, fontWeight: '900' },
  group: { color: COLORS.muted, fontSize: 11, fontWeight: '900', marginTop: 6 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 8,
    borderRadius: 14,
    backgroundColor: COLORS.cardLight,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  badge: { color: COLORS.muted, fontSize: 10, fontWeight: '900', width: 30 },
  name: { color: COLORS.text, fontWeight: '800', fontSize: 15 },
  rating: { color: COLORS.gold, fontWeight: '900', fontSize: 16 },
  details: { width: 30, height: 30, borderRadius: 15, backgroundColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
});
