import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { COLORS } from '@/components/ui/kit';
import { AuthProvider } from '@/lib/auth';

export default function RootLayout() {
  return (
    <AuthProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: COLORS.bg },
          headerTintColor: COLORS.text,
          headerTitleStyle: { fontWeight: '800' },
          contentStyle: { backgroundColor: COLORS.bg },
        }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="game" options={{ headerShown: false, gestureEnabled: false }} />
        <Stack.Screen name="match-setup" options={{ title: 'Local 1v1' }} />
        <Stack.Screen name="online" options={{ title: 'Online match' }} />
        <Stack.Screen name="puck/[id]" options={{ title: 'Puck' }} />
      </Stack>
    </AuthProvider>
  );
}
