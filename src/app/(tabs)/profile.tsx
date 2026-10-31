import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { PuckArt } from '@/components/game/puck-art';
import { Button, Card, Coins, COLORS, styles as ui } from '@/components/ui/kit';
import { Split } from '@/components/ui/layout';
import { PUCK_COLORS } from '@/game/colors';
import { puckRating } from '@/game/pucks';
import { useAuth } from '@/lib/auth';

export default function ProfileScreen() {
  const { profile, logout, serverUrl } = useAuth();
  if (!profile) return null;

  const s = profile.stats;
  const winRate = s.played ? Math.round((s.wins / s.played) * 100) : 0;
  const pucks = [...profile.pucks].sort((a, b) => b.goals - a.goals || b.matches - a.matches);
  const c = PUCK_COLORS[profile.color];

  return (
    <Split
      left={
        <>
          <View style={[ui.row, { gap: 14 }]}>
            <View style={[styles.avatar, { backgroundColor: c.main, borderColor: c.light }]}>
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
            <Text style={ui.muted}>Server: {serverUrl}</Text>
            <Button title="Log out" variant="danger" onPress={logout} />
          </Card>
        </>
      }
      right={
        <Card>
          <Text style={ui.sectionTitle}>Puck stats</Text>
          <View style={styles.headerRow}>
            <Text style={[ui.muted, { flex: 1 }]}>Puck</Text>
            <Text style={styles.col}>Goals</Text>
            <Text style={styles.col}>Shots</Text>
            <Text style={styles.col}>Apps</Text>
            <Text style={styles.col}>OVR</Text>
          </View>
          {pucks.map((p) => (
            <Pressable key={p.id} style={styles.puckRow} onPress={() => router.push({ pathname: '/puck/[id]', params: { id: p.id } })}>
              <PuckArt size={38} color={profile.color} number={p.number} />
              <Text style={[styles.puckName, { flex: 1 }]}>{p.name}</Text>
              <Text style={styles.colValue}>{p.goals}</Text>
              <Text style={styles.colValue}>{p.shots}</Text>
              <Text style={styles.colValue}>{p.matches}</Text>
              <Text style={[styles.colValue, { color: COLORS.gold }]}>{puckRating(p.levels)}</Text>
            </Pressable>
          ))}
        </Card>
      }
    />
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
  avatar: { width: 60, height: 60, borderRadius: 16, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: 28, fontWeight: '900' },
  name: { color: COLORS.text, fontSize: 24, fontWeight: '900' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  stat: { width: '30%', flexGrow: 1, alignItems: 'center', backgroundColor: COLORS.cardLight, borderRadius: 12, paddingVertical: 10 },
  statValue: { color: COLORS.text, fontSize: 20, fontWeight: '900' },
  headerRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6 },
  col: { width: 52, textAlign: 'center', color: COLORS.muted, fontSize: 12 },
  puckRow: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 6, borderRadius: 12, backgroundColor: COLORS.cardLight },
  puckName: { color: COLORS.text, fontWeight: '800' },
  colValue: { width: 52, textAlign: 'center', color: COLORS.text, fontWeight: '800' },
});
