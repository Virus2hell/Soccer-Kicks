import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Card, COLORS, styles as ui } from '@/components/ui/kit';
import { useAuth } from '@/lib/auth';

export default function LoginScreen() {
  const { status, login, register, serverUrl } = useAuth();
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
    <SafeAreaView style={ui.screen}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={[ui.scroll, { flexGrow: 1, justifyContent: 'center' }]} keyboardShouldPersistTaps="handled">
          <Text style={{ fontSize: 56, textAlign: 'center' }}>⚽</Text>
          <Text style={{ color: COLORS.text, fontSize: 32, fontWeight: '900', textAlign: 'center' }}>Soccer Pucks</Text>
          <Text style={[ui.muted, { textAlign: 'center', marginBottom: 8 }]}>Flick. Bank. Score.</Text>

          <Card>
            <View style={[ui.row, { backgroundColor: COLORS.bg, borderRadius: 12, padding: 4 }]}>
              <Button title="Log in" small variant={mode === 'login' ? 'primary' : 'secondary'} onPress={() => setMode('login')} style={{ flex: 1 }} />
              <Button title="Register" small variant={mode === 'register' ? 'primary' : 'secondary'} onPress={() => setMode('register')} style={{ flex: 1 }} />
            </View>

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

            <Text style={ui.label}>Password</Text>
            <TextInput
              style={ui.input}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder="at least 4 characters"
              placeholderTextColor={COLORS.muted}
            />

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

            <Button
              title={mode === 'login' ? 'Log in' : 'Create account'}
              onPress={submit}
              loading={busy}
              disabled={!username || !password}
            />
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
