import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card, Coins, COLORS, styles as ui } from '@/components/ui/kit';
import { useAuth } from '@/lib/auth';

const HOW_TO = [
  'Pull back on one of your pucks and let go to shoot — like a slingshot.',
  'Every shot and every puck-on-puck hit drains health. Tired pucks are weaker and less accurate.',
  'Tap SUB on your turn: 30 seconds, up to 3 subs. A puck you take off can’t come back.',
  'A puck can go into the goal, but if it goes in too deep it gets thrown back out.',
  'Draw when time runs out? 5 trick shots each, then the first to score wins.',
  'Win coins every match and upgrade each puck in your Squad.',
];

export default function PlayScreen() {
  const { profile } = useAuth();
  if (!profile) return null;

  return (
    <SafeAreaView style={ui.screen} edges={['top']}>
      <ScrollView contentContainerStyle={ui.scroll}>
        <View style={[ui.row, { justifyContent: 'space-between' }]}>
          <View>
            <Text style={ui.muted}>Welcome back</Text>
            <Text style={styles.hello}>{profile.username}</Text>
          </View>
          <Coins amount={profile.coins} />
        </View>

        <ModeCard
          emoji="🎮"
          title="Local 1v1"
          subtitle="Two players, one phone"
          color="#1d4ed8"
          onPress={() => router.push('/match-setup')}
        />
        <ModeCard
          emoji="🌐"
          title="Online match"
          subtitle="Host or join a friend's room"
          color="#c2410c"
          onPress={() => router.push('/online')}
        />

        <Card>
          <Text style={ui.sectionTitle}>Your record</Text>
          <View style={ui.row}>
            <Stat label="Played" value={profile.stats.played} />
            <Stat label="Wins" value={profile.stats.wins} />
            <Stat label="Goals" value={profile.stats.goals} />
          </View>
        </Card>

        <Card>
          <Text style={ui.sectionTitle}>How to play</Text>
          {HOW_TO.map((line) => (
            <Text key={line} style={ui.text}>
              • {line}
            </Text>
          ))}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

function ModeCard(props: { emoji: string; title: string; subtitle: string; color: string; onPress: () => void }) {
  return (
    <Pressable onPress={props.onPress} style={({ pressed }) => [styles.mode, { backgroundColor: props.color, opacity: pressed ? 0.85 : 1 }]}>
      <Text style={styles.modeEmoji}>{props.emoji}</Text>
      <View style={{ flex: 1 }}>
        <Text style={styles.modeTitle}>{props.title}</Text>
        <Text style={styles.modeSub}>{props.subtitle}</Text>
      </View>
      <Text style={styles.modeArrow}>›</Text>
    </Pressable>
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
  hello: { color: COLORS.text, fontSize: 26, fontWeight: '900' },
  mode: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 20, borderRadius: 20 },
  modeEmoji: { fontSize: 38 },
  modeTitle: { color: '#fff', fontSize: 22, fontWeight: '900' },
  modeSub: { color: '#e2e8f0', fontSize: 14 },
  modeArrow: { color: '#fff', fontSize: 34, fontWeight: '300' },
  stat: { flex: 1, alignItems: 'center', backgroundColor: COLORS.cardLight, borderRadius: 12, paddingVertical: 10 },
  statValue: { color: COLORS.text, fontSize: 22, fontWeight: '900' },
});
