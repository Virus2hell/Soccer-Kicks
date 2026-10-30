import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Text, TextInput } from 'react-native';

import { Button, Card, COLORS, styles as ui } from '@/components/ui/kit';
import { SettingsPicker } from '@/components/ui/settings-picker';
import type { MatchSettings } from '@/game/types';

export default function MatchSetupScreen() {
  const [settings, setSettings] = useState<MatchSettings>({ mode: 'time', minutes: 5, goals: 2 });
  const [p2, setP2] = useState('Guest');

  const start = () =>
    router.push({
      pathname: '/game',
      params: {
        mode: 'local',
        matchMode: settings.mode,
        value: String(settings.mode === 'time' ? settings.minutes : settings.goals),
        p2: p2.trim() || 'Guest',
      },
    });

  return (
    <ScrollView style={ui.screen} contentContainerStyle={ui.scroll}>
      <Card>
        <SettingsPicker value={settings} onChange={setSettings} />
      </Card>
      <Card>
        <Text style={ui.label}>Player 2 name</Text>
        <TextInput style={ui.input} value={p2} onChangeText={setP2} maxLength={14} placeholderTextColor={COLORS.muted} />
        <Text style={ui.muted}>You play blue (left) with your squad. Player 2 plays orange with a default squad.</Text>
      </Card>
      <Button title="⚽ Kick off" onPress={start} />
    </ScrollView>
  );
}
