import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BallArt, PuckArt } from '@/components/game/puck-art';
import { Card, Coins, COLORS, styles as ui } from '@/components/ui/kit';
import { Backdrop } from '@/components/ui/layout';
import { useAuth } from '@/lib/auth';

const HOW_TO = [
  'Pull back on one of your pucks and let go to shoot — like a slingshot.',
  'Every shot and every puck-on-puck hit drains health. Tired pucks are weaker and less accurate.',
  'Tap SUB on your turn: 30 seconds, up to 3 subs. A puck you take off can’t come back.',
  'A puck that ends up inside a goal slides back out once everything stops.',
  'Draw when time runs out? 5 trick shots each, then the first to score wins.',
  'Win coins every match and upgrade each puck in your Squad.',
];

export default function PlayScreen() {
  const { profile } = useAuth();
  const insets = useSafeAreaInsets();
  if (!profile) return null;

  return (
    <View style={[ui.screen, { paddingRight: insets.right }]}>
      <Backdrop />
      <ScrollView contentContainerStyle={ui.scroll}>
        <View style={[ui.row, { justifyContent: 'space-between' }]}>
          <View>
            <Text style={ui.muted}>Welcome back</Text>
            <Text style={styles.hello}>{profile.username}</Text>
          </View>
          <Coins amount={profile.coins} />
        </View>

        <View style={styles.modes}>
          <ModeCard
            delay={0}
            title="LOCAL 1V1"
            subtitle="Two players · one phone"
            colors={['#1d4ed8', '#1e3a8a']}
            art={
              <View style={styles.art}>
                <PuckArt size={70} color={profile.color} number={9} />
                <PuckArt size={70} color={profile.color === 'red' ? 'blue' : 'red'} number={4} />
              </View>
            }
            onPress={() => router.push('/match-setup')}
          />
          <ModeCard
            delay={100}
            title="ONLINE"
            subtitle="Host or join a friend's room"
            colors={['#c2410c', '#7c2d12']}
            art={
              <View style={styles.art}>
                <BallArt size={56} />
                <Text style={{ fontSize: 40 }}>🌐</Text>
              </View>
            }
            onPress={() => router.push('/online')}
          />
        </View>

        <View style={styles.modes}>
          <Card style={{ flex: 1 }}>
            <Text style={ui.sectionTitle}>Your record</Text>
            <View style={ui.row}>
              <Stat label="Played" value={profile.stats.played} />
              <Stat label="Wins" value={profile.stats.wins} />
              <Stat label="Goals" value={profile.stats.goals} />
            </View>
          </Card>
          <Card style={{ flex: 1.6 }}>
            <Text style={ui.sectionTitle}>How to play</Text>
            {HOW_TO.map((line) => (
              <Text key={line} style={[ui.text, { fontSize: 13 }]}>
                • {line}
              </Text>
            ))}
          </Card>
        </View>
      </ScrollView>
    </View>
  );
}

type ModeCardProps = {
  title: string;
  subtitle: string;
  colors: [string, string];
  art: React.ReactNode;
  delay: number;
  onPress: () => void;
};

function ModeCard({ title, subtitle, colors, art, delay, onPress }: ModeCardProps) {
  return (
    <Animated.View entering={FadeInDown.delay(delay).duration(400)} style={{ flex: 1 }}>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.mode,
          { backgroundColor: colors[0], borderBottomColor: colors[1], transform: [{ scale: pressed ? 0.97 : 1 }] },
        ]}>
        {art}
        <View style={{ flex: 1 }}>
          <Text style={styles.modeTitle}>{title}</Text>
          <Text style={styles.modeSub}>{subtitle}</Text>
        </View>
        <Text style={styles.modeArrow}>▶</Text>
      </Pressable>
    </Animated.View>
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
  modes: { flexDirection: 'row', gap: 14 },
  mode: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 18,
    paddingHorizontal: 18,
    borderRadius: 22,
    borderBottomWidth: 6,
    minHeight: 120,
  },
  art: { flexDirection: 'row', alignItems: 'center', gap: -10 },
  modeTitle: { color: '#fff', fontSize: 21, fontWeight: '900', letterSpacing: 1 },
  modeSub: { color: '#e2e8f0', fontSize: 13, fontWeight: '600' },
  modeArrow: { color: '#fff', fontSize: 22 },
  stat: { flex: 1, alignItems: 'center', backgroundColor: COLORS.cardLight, borderRadius: 12, paddingVertical: 12 },
  statValue: { color: COLORS.text, fontSize: 24, fontWeight: '900' },
});
