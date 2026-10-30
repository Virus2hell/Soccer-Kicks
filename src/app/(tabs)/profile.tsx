import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PuckArt } from '@/components/game/puck-art';
import { Button, Card, Coins, COLORS, styles as ui } from '@/components/ui/kit';
import { puckRating } from '@/game/pucks';
import { useAuth } from '@/lib/auth';

export default function ProfileScreen() {
  const { profile, logout, serverUrl } = useAuth();
  if (!profile) return null;

  const s = profile.stats;
  const winRate = s.played ? Math.round((s.wins / s.played) * 100) : 0;
  const pucks = [...profile.pucks].sort((a, b) => b.goals - a.goals || b.matches - a.matches);

  return (
    <SafeAreaView style={ui.screen} edges={['top']}>
      <ScrollView contentContainerStyle={ui.scroll}>
        <View style={[ui.row, { gap: 14 }]}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{profile.username[0]?.toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{profile.username}</Text>
            <Text style={ui.muted}>{s.played} matches played</Text>
          </View>
          <Coins amount={profile.coins} />
        </View>

        <Card>
          <Text style={ui.sectionTitle}>Career</Text>
          <View style={styles.grid}>
            <Stat label="Played" value={s.played} />
            <Stat label="Wins" value={s.wins} />
            <Stat label="Losses" value={s.losses} />
            <Stat label="Win %" value={`${winRate}%`} />
            <Stat label="Goals" value={s.goals} />
            <Stat label="Conceded" value={s.conceded} />
            <Stat label="Trick-shot wins" value={s.shootoutWins} />
          </View>
        </Card>

        <Card>
          <Text style={ui.sectionTitle}>Puck stats</Text>
          <View style={styles.headerRow}>
            <Text style={[ui.muted, { flex: 1 }]}>Puck</Text>
            <Text style={styles.col}>⚽</Text>
            <Text style={styles.col}>Shots</Text>
            <Text style={styles.col}>Apps</Text>
            <Text style={styles.col}>OVR</Text>
          </View>
          {pucks.map((p) => (
            <Pressable
              key={p.id}
              style={styles.puckRow}
              onPress={() => router.push({ pathname: '/puck/[id]', params: { id: p.id } })}>
              <PuckArt size={34} team={0} number={p.number} />
              <Text style={[styles.puckName, { flex: 1 }]}>{p.name}</Text>
              <Text style={styles.colValue}>{p.goals}</Text>
              <Text style={styles.colValue}>{p.shots}</Text>
              <Text style={styles.colValue}>{p.matches}</Text>
              <Text style={[styles.colValue, { color: COLORS.gold }]}>{puckRating(p.levels)}</Text>
            </Pressable>
          ))}
        </Card>

        <Card>
          <Text style={ui.muted}>Server: {serverUrl}</Text>
          <Button title="Log out" variant="danger" onPress={logout} />
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={ui.muted}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: COLORS.accent, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#04140a', fontSize: 30, fontWeight: '900' },
  name: { color: COLORS.text, fontSize: 24, fontWeight: '900' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  stat: { width: '31%', flexGrow: 1, alignItems: 'center', backgroundColor: COLORS.cardLight, borderRadius: 12, paddingVertical: 10 },
  statValue: { color: COLORS.text, fontSize: 20, fontWeight: '900' },
  headerRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4 },
  col: { width: 44, textAlign: 'center', color: COLORS.muted, fontSize: 12 },
  puckRow: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 6, borderRadius: 12, backgroundColor: COLORS.cardLight },
  puckName: { color: COLORS.text, fontWeight: '800' },
  colValue: { width: 44, textAlign: 'center', color: COLORS.text, fontWeight: '800' },
});
