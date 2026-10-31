import * as ScreenOrientation from 'expo-screen-orientation';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { COLORS } from '@/components/ui/kit';
import { AuthProvider } from '@/lib/auth';

export default function RootLayout() {
  // The whole app runs in landscape
  useEffect(() => {
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE).catch(() => {});
  }, []);

  return (
    <AuthProvider>
      <StatusBar style="light" hidden />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: COLORS.bg },
          headerTintColor: COLORS.text,
          headerTitleStyle: { fontWeight: '900' },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: COLORS.bg },
          animation: 'fade',
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
