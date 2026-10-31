import { Pressable, StyleSheet, Text, View } from 'react-native';

import { PuckArt } from '@/components/game/puck-art';
import { COLORS } from '@/components/ui/kit';
import { PUCK_COLORS, PUCK_COLOR_IDS, PuckColorId } from '@/game/colors';

/** Row of pucks in every color; tap one to choose it */
export function ColorPicker({ value, onChange, number = 7 }: { value: PuckColorId; onChange: (c: PuckColorId) => void; number?: number }) {
  return (
    <View style={styles.wrap}>
      {PUCK_COLOR_IDS.map((id) => (
        <Pressable key={id} onPress={() => onChange(id)} style={[styles.item, value === id && styles.selected]}>
          <PuckArt size={46} color={id} number={number} highlight={value === id ? 'selected' : 'none'} />
          <Text style={[styles.label, value === id && { color: COLORS.gold }]} numberOfLines={1}>
            {PUCK_COLORS[id].name}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  item: { width: 70, alignItems: 'center', paddingVertical: 4, borderRadius: 12, borderWidth: 2, borderColor: 'transparent' },
  selected: { borderColor: COLORS.gold, backgroundColor: '#3b2f0544' },
  label: { color: COLORS.muted, fontSize: 10, fontWeight: '800' },
});
