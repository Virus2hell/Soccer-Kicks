import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { Button, Card, COLORS, styles as ui } from '@/components/ui/kit';
import { Split } from '@/components/ui/layout';
import { describeSettings, SettingsPicker } from '@/components/ui/settings-picker';
import type { MatchSettings } from '@/game/types';
import { useAuth } from '@/lib/auth';
import { getSocket, request } from '@/lib/socket';

type RoomView = { code: string; settings: MatchSettings; players: string[]; playing: boolean };

export default function OnlineScreen() {
  const { profile } = useAuth();
  const [room, setRoom] = useState<RoomView | null>(null);
  const [settings, setSettings] = useState<MatchSettings>({ mode: 'time', minutes: 5, goals: 2 });
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const onRoom = (r: RoomView | null) => setRoom(r);
    const onStart = () => router.push({ pathname: '/game', params: { mode: 'online' } });
    socket.on('room:update', onRoom);
    socket.on('match:start', onStart);
    return () => {
      socket.off('room:update', onRoom);
      socket.off('match:start', onStart);
      socket.emit('room:leave', {}); // leaving this screen = leaving the room
    };
  }, []);

  const run = async (key: string, event: string, payload: object = {}) => {
    setError('');
    setBusy(key);
    try {
      const res = await request<{ room?: RoomView }>(event, payload);
      if (res.room) setRoom(res.room);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(null);
    }
  };

  if (room) {
    const isHost = room.players[0] === profile?.username;
    return (
      <Split
        left={
          <Card style={{ alignItems: 'center' }}>
            <Text style={ui.muted}>Room code — share it with your friend</Text>
            <Text style={styles.code}>{room.code}</Text>
            <Text style={ui.text}>{describeSettings(room.settings)}</Text>
          </Card>
        }
        right={
          <>
            <Card>
              <Text style={ui.sectionTitle}>Players</Text>
              {[0, 1].map((i) => (
                <View key={i} style={styles.player}>
                  <Text style={styles.side}>{i === 0 ? 'LEFT' : 'RIGHT'}</Text>
                  <Text style={[ui.text, { flex: 1, fontWeight: '800' }]}>{room.players[i] ?? 'Waiting for opponent…'}</Text>
                  <Text style={ui.muted}>{i === 0 ? 'Host' : 'Guest'}</Text>
                </View>
              ))}
            </Card>
            {!!error && <Text style={ui.error}>{error}</Text>}
            {room.playing ? (
              <Text style={ui.text}>Match in progress…</Text>
            ) : isHost ? (
              <Button title="Start match" onPress={() => run('start', 'room:start')} disabled={room.players.length < 2} loading={busy === 'start'} />
            ) : (
              <Text style={[ui.text, { textAlign: 'center' }]}>Waiting for the host to start…</Text>
            )}
            <Button title="Leave room" variant="secondary" onPress={() => run('leave', 'room:leave').then(() => setRoom(null))} />
          </>
        }
      />
    );
  }

  return (
    <Split
      leftFlex={1.3} rightFlex={1}
      left={
        <Card>
          <Text style={ui.sectionTitle}>Host a match</Text>
          <SettingsPicker value={settings} onChange={setSettings} />
          <Button title="Create room" onPress={() => run('create', 'room:create', { settings })} loading={busy === 'create'} />
        </Card>
      }
      right={
        <>
          <Card>
            <Text style={ui.sectionTitle}>Join a match</Text>
            <TextInput
              style={[ui.input, styles.codeInput]}
              value={code}
              onChangeText={(t) => setCode(t.toUpperCase())}
              placeholder="CODE"
              placeholderTextColor={COLORS.muted}
              autoCapitalize="characters"
              maxLength={4}
            />
            <Button title="Join" onPress={() => run('join', 'room:join', { code })} disabled={code.length !== 4} loading={busy === 'join'} />
          </Card>
          {!!error && <Text style={ui.error}>{error}</Text>}
          <Text style={ui.muted}>Both phones must reach the same server (same Wi-Fi, or a server hosted online).</Text>
        </>
      }
    />
  );
}

const styles = StyleSheet.create({
  code: { color: COLORS.gold, fontSize: 60, fontWeight: '900', letterSpacing: 12 },
  codeInput: { fontSize: 26, fontWeight: '900', letterSpacing: 8, textAlign: 'center' },
  player: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 12, backgroundColor: COLORS.cardLight },
  side: { color: COLORS.muted, fontSize: 10, fontWeight: '900', width: 40 },
});
