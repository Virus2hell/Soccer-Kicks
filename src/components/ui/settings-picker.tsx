import { Text, View } from 'react-native';

import { Chip, styles } from '@/components/ui/kit';
import { GOAL_OPTIONS, MatchSettings, TIME_OPTIONS } from '@/game/types';

/** Lets the host choose: play for X minutes, or first to X goals */
export function SettingsPicker({ value, onChange }: { value: MatchSettings; onChange: (s: MatchSettings) => void }) {
  return (
    <View style={{ gap: 10 }}>
      <Text style={styles.label}>Match type</Text>
      <View style={[styles.row, { flexWrap: 'wrap' }]}>
        <Chip label="⏱ Timed" selected={value.mode === 'time'} onPress={() => onChange({ ...value, mode: 'time' })} />
        <Chip label="⚽ First to goals" selected={value.mode === 'goals'} onPress={() => onChange({ ...value, mode: 'goals' })} />
      </View>

      <Text style={styles.label}>{value.mode === 'time' ? 'Minutes' : 'Goals to win'}</Text>
      <View style={[styles.row, { flexWrap: 'wrap' }]}>
        {value.mode === 'time'
          ? TIME_OPTIONS.map((m) => (
              <Chip key={m} label={`${m} min`} selected={value.minutes === m} onPress={() => onChange({ ...value, minutes: m })} />
            ))
          : GOAL_OPTIONS.map((g) => (
              <Chip key={g} label={`${g} goals`} selected={value.goals === g} onPress={() => onChange({ ...value, goals: g })} />
            ))}
      </View>
      {value.mode === 'time' && (
        <Text style={styles.muted}>If it's a draw when time runs out: 5 trick shots each, then the first to score wins.</Text>
      )}
    </View>
  );
}

export const describeSettings = (s: MatchSettings) => (s.mode === 'time' ? `${s.minutes} minutes` : `First to ${s.goals} goals`);
