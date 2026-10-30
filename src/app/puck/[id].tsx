import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { PuckArt } from '@/components/game/puck-art';
import { Bar, Button, Card, Coins, COLORS, styles as ui } from '@/components/ui/kit';
import { MAX_LEVEL, STAT_INFO, puckRating, upgradeCost } from '@/game/pucks';
import { STAT_KEYS, StatKey } from '@/game/types';
import { useAuth } from '@/lib/auth';

export default function PuckScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile, call } = useAuth();
  const puck = profile?.pucks.find((p) => p.id === id);
  const [name, setName] = useState(puck?.name ?? '');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');

  if (!profile || !puck) return <Text style={[ui.text, { padding: 20 }]}>Puck not found</Text>;

  const run = async (key: string, event: string, payload: object) => {
    setError('');
    setBusy(key);
    try {
      await call(event, payload);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(null);
    }
  };

  const upgrade = (stat: StatKey) => run(stat, 'profile:upgrade', { puckId: puck.id, stat });

  return (
    <ScrollView style={ui.screen} contentContainerStyle={ui.scroll}>
      <Stack.Screen options={{ title: puck.name }} />

      <View style={{ alignItems: 'center', gap: 6 }}>
        <PuckArt size={130} team={0} number={puck.number} />
        <Text style={styles.rating}>OVR {puckRating(puck.levels)}</Text>
        <Coins amount={profile.coins} />
      </View>

      <Card>
        <Text style={ui.label}>Name</Text>
        <View style={ui.row}>
          <TextInput style={[ui.input, { flex: 1 }]} value={name} onChangeText={setName} maxLength={14} />
          <Button
            title="Save"
            small
            loading={busy === 'name'}
            disabled={!name.trim() || name.trim() === puck.name}
            onPress={() => run('name', 'profile:rename', { puckId: puck.id, name })}
          />
        </View>
      </Card>

      <Card>
        <Text style={ui.sectionTitle}>Upgrades</Text>
        {!!error && <Text style={ui.error}>{error}</Text>}
        {STAT_KEYS.map((stat) => {
          const level = puck.levels[stat];
          const info = STAT_INFO[stat];
          const maxed = level >= MAX_LEVEL;
          const cost = upgradeCost(level);
          return (
            <View key={stat} style={styles.statRow}>
              <View style={{ flex: 1, gap: 4 }}>
                <View style={[ui.row, { justifyContent: 'space-between' }]}>
                  <Text style={styles.statName}>
                    {info.icon} {info.label}
                  </Text>
                  <Text style={ui.muted}>
                    Lv {level}/{MAX_LEVEL}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row' }}>
                  <Bar value={level / MAX_LEVEL} height={8} />
                </View>
                <Text style={ui.muted}>
                  {info.describe(level)}
                  {!maxed && `  →  ${info.describe(level + 1)}`}
                </Text>
              </View>
              <Button
                small
                title={maxed ? 'MAX' : `⬆ ${cost}`}
                disabled={maxed || profile.coins < cost}
                loading={busy === stat}
                onPress={() => upgrade(stat)}
                style={{ minWidth: 76 }}
              />
            </View>
          );
        })}
      </Card>

      <Card>
        <Text style={ui.sectionTitle}>Career</Text>
        <View style={ui.row}>
          <Stat label="Goals" value={puck.goals} />
          <Stat label="Shots" value={puck.shots} />
          <Stat label="Matches" value={puck.matches} />
        </View>
        <Text style={ui.muted}>
          Health resets to 100% after every match. It drops with every shot and every puck-on-puck hit, and a tired puck
          shoots weaker and less accurately — that's what your 3 subs are for. Stamina makes it drop slower.
        </Text>
      </Card>
    </ScrollView>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={ui.muted}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  rating: { color: COLORS.gold, fontWeight: '900', fontSize: 18 },
  statRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 },
  statName: { color: COLORS.text, fontWeight: '800', fontSize: 15 },
  stat: { flex: 1, alignItems: 'center', backgroundColor: COLORS.cardLight, borderRadius: 12, paddingVertical: 10 },
  statValue: { color: COLORS.text, fontSize: 20, fontWeight: '900' },
});
