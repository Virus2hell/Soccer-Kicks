import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PuckArt } from '@/components/game/puck-art';
import { Button, Card, Coins, COLORS, styles as ui } from '@/components/ui/kit';
import { Backdrop } from '@/components/ui/layout';
import { PUCK_COLORS } from '@/game/colors';
import { MAX_NAME_LENGTH, puckRating } from '@/game/pucks';
import { useAuth } from '@/lib/auth';

// Same width for a column's title and its values, so numbers sit right under their title
const COLUMNS = ['Goals', 'Shots', 'Apps', 'OVR'] as const;

export default function ProfileScreen() {
  const { profile, logout, serverUrl } = useAuth();
  const insets = useSafeAreaInsets();
  if (!profile) return null;

  const s = profile.stats;
  const winRate = s.played ? Math.round((s.wins / s.played) * 100) : 0;
  const pucks = [...profile.pucks].sort((a, b) => b.goals - a.goals || b.matches - a.matches);
  const c = PUCK_COLORS[profile.color];

  return (
    <View style={[ui.screen, { paddingRight: insets.right }]}>
      <Backdrop />
      <ScrollView contentContainerStyle={ui.scroll}>
        {/* Header */}
        <View style={[ui.row, { gap: 14 }]}>
          <View style={[styles.avatar, { backgroundColor: c.main, borderColor: c.light }]}>
            <Text style={styles.avatarText}>{profile.username[0]?.toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name} numberOfLines={1}>
              {profile.username}
            </Text>
            <Text style={ui.muted}>{s.played} matches played</Text>
          </View>
          <Coins amount={profile.coins} />
        </View>

        {/* Career: one row of stats */}
        <Card>
          <Text style={ui.sectionTitle}>Career</Text>
          <View style={styles.statsRow}>
            <Stat label="Played" value={s.played} />
            <Stat label="Wins" value={s.wins} />
            <Stat label="Losses" value={s.losses} />
            <Stat label="Win %" value={`${winRate}%`} />
            <Stat label="Goals" value={s.goals} />
            <Stat label="Conceded" value={s.conceded} />
            <Stat label="Trick wins" value={s.shootoutWins} />
          </View>
        </Card>

        {/* Puck stats table: full width below the career card */}
        <Card>
          <Text style={ui.sectionTitle}>Puck stats</Text>
          <View style={styles.table}>
            <View style={[styles.tr, styles.thead]}>
              <Text style={[styles.th, styles.puckCol, { textAlign: 'left' }]}>Puck</Text>
              {COLUMNS.map((col) => (
                <Text key={col} style={[styles.th, styles.numCol]}>
                  {col}
                </Text>
              ))}
            </View>

            {pucks.map((p, i) => (
              <Pressable
                key={p.id}
                onPress={() => router.push({ pathname: '/puck/[id]', params: { id: p.id } })}
                style={({ pressed }) => [styles.tr, i % 2 === 1 && styles.trAlt, pressed && { opacity: 0.7 }]}>
                <View style={[styles.puckCol, styles.puckCell]}>
                  <View style={styles.puckIcon}>
                    <PuckArt size={36} color={profile.color} number={p.number} />
                  </View>
                  <Text style={styles.puckName} numberOfLines={1}>
                    {p.name.slice(0, MAX_NAME_LENGTH)}
                  </Text>
                </View>
                <Text style={[styles.td, styles.numCol]}>{p.goals}</Text>
                <Text style={[styles.td, styles.numCol]}>{p.shots}</Text>
                <Text style={[styles.td, styles.numCol]}>{p.matches}</Text>
                <Text style={[styles.td, styles.numCol, { color: COLORS.gold }]}>{puckRating(p.levels)}</Text>
              </Pressable>
            ))}
          </View>
        </Card>

        <Card style={[ui.row, { justifyContent: 'space-between' }]}>
          <Text style={[ui.muted, { flex: 1 }]} numberOfLines={1}>
            Server: {serverUrl}
          </Text>
          <Button title="Log out" variant="danger" small onPress={logout} style={{ minWidth: 120 }} />
        </Card>
      </ScrollView>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: { width: 58, height: 58, borderRadius: 16, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: 26, fontWeight: '900' },
  name: { color: COLORS.text, fontSize: 24, fontWeight: '900' },
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  stat: { flexGrow: 1, flexBasis: 74, alignItems: 'center', backgroundColor: COLORS.cardLight, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 4 },
  statValue: { color: COLORS.text, fontSize: 20, fontWeight: '900' },
  statLabel: { color: COLORS.muted, fontSize: 12 },
  table: { borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.border },
  tr: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, paddingHorizontal: 10, backgroundColor: COLORS.card },
  trAlt: { backgroundColor: COLORS.cardLight },
  thead: { backgroundColor: COLORS.bg, paddingVertical: 10 },
  th: { color: COLORS.muted, fontSize: 12, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5 },
  td: { color: COLORS.text, fontSize: 15, fontWeight: '800' },
  puckCol: { flex: 2.4, minWidth: 150 },
  puckCell: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  puckIcon: { width: 36, height: 36, flexShrink: 0 },
  puckName: { color: COLORS.text, fontWeight: '800', fontSize: 15, flexShrink: 1 },
  numCol: { flex: 1, minWidth: 52, textAlign: 'center' },
});
