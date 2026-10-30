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
      <View style={{ flex: 1, backgroundColor: COLORS.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={COLORS.accent} size="large" />
      </View>
    );
  }
  if (status === 'loggedOut') return <Redirect href="/login" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: COLORS.card, borderTopColor: COLORS.border },
        tabBarActiveTintColor: COLORS.accent,
        tabBarInactiveTintColor: COLORS.muted,
      }}>
      <Tabs.Screen name="index" options={{ title: 'Play', tabBarIcon: icon('⚽') }} />
      <Tabs.Screen name="squad" options={{ title: 'Squad', tabBarIcon: icon('🛡️') }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: icon('👤') }} />
    </Tabs>
  );
}
