import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeInDown, FadeInLeft } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BallArt, PuckArt } from '@/components/game/puck-art';
import { Button, Card, COLORS, styles as ui } from '@/components/ui/kit';
import { Backdrop } from '@/components/ui/layout';
import { useAuth } from '@/lib/auth';

export default function LoginScreen() {
  const { status, login, register, serverUrl } = useAuth();
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [url, setUrl] = useState(serverUrl);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => setUrl(serverUrl), [serverUrl]);

  if (status === 'loggedIn') return <Redirect href="/" />;

  const submit = async () => {
    setError('');
    setBusy(true);
    try {
      const action = mode === 'login' ? login : register;
      await action(username.trim(), password, url);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[ui.screen, { flexDirection: 'row', paddingLeft: insets.left, paddingRight: insets.right }]}>
      <Backdrop />

      {/* Left: branding */}
      <Animated.View entering={FadeInLeft.duration(500)} style={styles.brand}>
        <View style={styles.logoRow}>
          <PuckArt size={84} color="blue" number={10} />
          <View style={{ marginHorizontal: -10, zIndex: 1 }}>
            <BallArt size={46} />
          </View>
          <PuckArt size={84} color="red" number={7} />
        </View>
        <Text style={styles.title}>SOCCER PUCKS</Text>
        <Text style={styles.tagline}>Flick. Bank. Score.</Text>
      </Animated.View>

      {/* Right: form */}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={[ui.scroll, { flexGrow: 1, justifyContent: 'center' }]} keyboardShouldPersistTaps="handled">
          <Animated.View entering={FadeInDown.duration(500)}>
            <Card>
              <View style={[ui.row, { backgroundColor: COLORS.bg, borderRadius: 12, padding: 4 }]}>
                <Button title="Log in" small variant={mode === 'login' ? 'primary' : 'secondary'} onPress={() => setMode('login')} style={{ flex: 1 }} />
                <Button title="Register" small variant={mode === 'register' ? 'primary' : 'secondary'} onPress={() => setMode('register')} style={{ flex: 1 }} />
              </View>

              <View style={ui.row}>
                <View style={{ flex: 1, gap: 6 }}>
                  <Text style={ui.label}>Username</Text>
                  <TextInput
                    style={ui.input}
                    value={username}
                    onChangeText={setUsername}
                    autoCapitalize="none"
                    autoCorrect={false}
                    placeholder="e.g. atharva"
                    placeholderTextColor={COLORS.muted}
                  />
                </View>
                <View style={{ flex: 1, gap: 6 }}>
                  <Text style={ui.label}>Password</Text>
                  <TextInput
                    style={ui.input}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                    placeholder="at least 4 characters"
                    placeholderTextColor={COLORS.muted}
                  />
                </View>
              </View>

              <Text style={ui.label}>Server address</Text>
              <TextInput
                style={ui.input}
                value={url}
                onChangeText={setUrl}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                placeholder="http://192.168.x.x:3001"
                placeholderTextColor={COLORS.muted}
              />
              <Text style={ui.muted}>Shown in the terminal when you start the server (npm start in the server folder).</Text>

              {!!error && <Text style={ui.error}>{error}</Text>}

              <Button title={mode === 'login' ? 'Log in' : 'Create account'} onPress={submit} loading={busy} disabled={!username || !password} />
            </Card>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  brand: { width: '42%', alignItems: 'center', justifyContent: 'center', gap: 6 },
  logoRow: { flexDirection: 'row', alignItems: 'center' },
  title: { color: COLORS.text, fontSize: 34, fontWeight: '900', letterSpacing: 2, marginTop: 8 },
  tagline: { color: COLORS.accent, fontSize: 15, fontWeight: '800', letterSpacing: 1 },
});
