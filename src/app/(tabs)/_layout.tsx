import { Redirect, Tabs } from 'expo-router';
import { ActivityIndicator, Text, View } from 'react-native';

import { COLORS } from '@/components/ui/kit';
import { useAuth } from '@/lib/auth';

// Emoji + label drawn by us, so the label always fits in the side rail
const icon = (emoji: string, label: string) =>
  function TabIcon({ focused }: { focused: boolean }) {
    return (
      <View style={{ alignItems: 'center', width: 72, gap: 2 }}>
        <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.5 }}>{emoji}</Text>
        <Text
          numberOfLines={1}
          style={{ fontSize: 12, fontWeight: '800', color: focused ? COLORS.accent : COLORS.muted }}>
          {label}
        </Text>
      </View>
    );
  };

export default function TabLayout() {
  const { status } = useAuth();

  if (status === 'loading') {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={COLORS.accent} size="large" />
      </View>
    );
  }
  if (status === 'loggedOut') return <Redirect href="/login" />;

  // Landscape: the tabs sit in a rail on the left side
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarPosition: 'left',
        tabBarShowLabel: false,
        tabBarStyle: { backgroundColor: COLORS.card, borderRightColor: COLORS.border, width: 92, minWidth: 92, maxWidth: 92, paddingTop: 12 },
        tabBarItemStyle: { height: 72, maxHeight: 72, justifyContent: 'center' },
        tabBarActiveTintColor: COLORS.accent,
        tabBarInactiveTintColor: COLORS.muted,
        tabBarActiveBackgroundColor: '#22c55e22',
      }}>
      <Tabs.Screen name="index" options={{ title: 'Play', tabBarIcon: icon('⚽', 'Play') }} />
      <Tabs.Screen name="squad" options={{ title: 'Squad', tabBarIcon: icon('🛡️', 'Squad') }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: icon('👤', 'Profile') }} />
    </Tabs>
  );
}
