import { router } from 'expo-router';
import { useState } from 'react';
import { Text, TextInput } from 'react-native';

import { ColorPicker } from '@/components/ui/color-picker';
import { Button, Card, COLORS, styles as ui } from '@/components/ui/kit';
import { Split } from '@/components/ui/layout';
import { SettingsPicker } from '@/components/ui/settings-picker';
import type { PuckColorId } from '@/game/colors';
import type { MatchSettings } from '@/game/types';
import { useAuth } from '@/lib/auth';

export default function MatchSetupScreen() {
  const { profile } = useAuth();
  const [settings, setSettings] = useState<MatchSettings>({ mode: 'time', minutes: 5, goals: 2 });
  const [p2, setP2] = useState('Guest');
  const [p2color, setP2color] = useState<PuckColorId>(profile?.color === 'red' ? 'blue' : 'red');

  const start = () =>
    router.push({
      pathname: '/game',
      params: {
        mode: 'local',
        matchMode: settings.mode,
        value: String(settings.mode === 'time' ? settings.minutes : settings.goals),
        p2: p2.trim() || 'Guest',
        p2color,
      },
    });

  return (
    <Split
      left={
        <>
          <Card>
            <SettingsPicker value={settings} onChange={setSettings} />
          </Card>
          <Button title="⚽ KICK OFF" onPress={start} />
        </>
      }
      right={
        <Card>
          <Text style={ui.sectionTitle}>Player 2</Text>
          <TextInput style={ui.input} value={p2} onChangeText={setP2} maxLength={14} placeholderTextColor={COLORS.muted} />
          <Text style={ui.label}>Player 2 puck color</Text>
          <ColorPicker value={p2color} onChange={setP2color} number={2} />
          <Text style={ui.muted}>
            You play on the left with your squad and color. Player 2 uses a default squad. If you both pick the same color,
            Player 2 gets a different one.
          </Text>
        </Card>
      }
    />
  );
}
