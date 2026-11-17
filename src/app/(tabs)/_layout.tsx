import { Redirect, Tabs } from 'expo-router';
import { ActivityIndicator, Text, View } from 'react-native';

import { COLORS } from '@/components/ui/kit';
import { useAuth } from '@/lib/auth';

// An emoji as the tab icon (dimmed when the tab isn't selected)
const icon = (emoji: string) =>
  function TabIcon({ focused }: { focused: boolean }) {
    return <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.5 }}>{emoji}</Text>;
  };

export default function TabLayout() {
  const { status } = useAuth();

  if (status === 'loading') {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.bg, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
        <ActivityIndicator color={COLORS.accent} size="large" />
        <Text style={{ color: COLORS.muted }}>Connecting to the game server…</Text>
      </View>
    );
  }
  if (status === 'loggedOut') return <Redirect href="/login" />;

  // Compact bottom bar: icon and label side by side to save height in landscape
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarPosition: 'bottom',
        tabBarLabelPosition: 'beside-icon',
        tabBarStyle: { backgroundColor: COLORS.card, borderTopColor: COLORS.border, height: 52 },
        tabBarActiveTintColor: COLORS.accent,
        tabBarInactiveTintColor: COLORS.muted,
        tabBarActiveBackgroundColor: '#22c55e1a',
        tabBarLabelStyle: { fontSize: 14, fontWeight: '800' },
      }}>
      <Tabs.Screen name="index" options={{ title: 'Play', tabBarIcon: icon('⚽') }} />
      <Tabs.Screen name="squad" options={{ title: 'Squad', tabBarIcon: icon('🛡️') }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: icon('👤') }} />
    </Tabs>
  );
}
