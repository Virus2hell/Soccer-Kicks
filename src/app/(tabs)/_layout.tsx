import { Redirect, Tabs } from 'expo-router';
import { ActivityIndicator, Text, View } from 'react-native';

import { COLORS } from '@/components/ui/kit';
import { useAuth } from '@/lib/auth';

// An emoji as the tab icon (dimmed when the tab isn't selected)
const icon = (emoji: string) =>
  function TabIcon({ focused }: { focused: boolean }) {
    return <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.5 }}>{emoji}</Text>;
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
        tabBarVariant: 'material',
        tabBarLabelPosition: 'below-icon',
        tabBarStyle: { backgroundColor: COLORS.card, borderRightColor: COLORS.border, width: 88 },
        tabBarActiveTintColor: COLORS.accent,
        tabBarInactiveTintColor: COLORS.muted,
        tabBarActiveBackgroundColor: '#22c55e22',
        tabBarLabelStyle: { fontWeight: '800' },
      }}>
      <Tabs.Screen name="index" options={{ title: 'Play', tabBarIcon: icon('⚽') }} />
      <Tabs.Screen name="squad" options={{ title: 'Squad', tabBarIcon: icon('🛡️') }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: icon('👤') }} />
    </Tabs>
  );
}
