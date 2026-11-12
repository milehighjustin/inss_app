import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { MetroType, Spacing } from '@/constants/metro';
import { useMetro } from './use-metro';

export interface MetroPivotTab {
  value: string;
  label: string;
}

export interface MetroPivotProps {
  tabs: MetroPivotTab[];
  value: string;
  onChange: (value: string) => void;
}

/**
 * In-page tabs (v1's NavigationHorizontal). Sits under the screen header and
 * switches content without changing route — matching how v1's admin, investor
 * and KPI-admin panels work.
 */
export function MetroPivot({ tabs, value, onChange }: MetroPivotProps) {
  const theme = useMetro();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.root}
      contentContainerStyle={styles.content}>
      {tabs.map((tab) => {
        const active = tab.value === value;
        return (
          <Pressable
            key={tab.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            // react-native-web reads aria-selected, native reads accessibilityState.
            aria-selected={active}
            onPress={() => onChange(tab.value)}
            style={({ pressed }) => [styles.tab, pressed && styles.pressed]}>
            <Text style={[styles.label, { color: active ? theme.text : theme.textDim }]}>
              {tab.label}
            </Text>
            <View
              style={[styles.underline, { backgroundColor: active ? theme.accent : 'transparent' }]}
            />
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    // No baseline rule: the accent bar under the active tab is the only line a
    // pivot needs, and a full-width rule under every tab row was just another
    // hairline between the header and the content.
    // A bare ScrollView grows to fill a flex column, which pushed the tab
    // content it sits above to the bottom of the screen. The tab row keeps its
    // own height and nothing else.
    flexGrow: 0,
    flexShrink: 0,
  },
  content: {
    gap: Spacing.four,
    paddingHorizontal: 2,
  },
  tab: {
    paddingTop: 10,
    gap: 8,
  },
  label: {
    fontSize: MetroType.body.fontSize,
    lineHeight: MetroType.body.lineHeight,
    fontWeight: 600,
  },
  underline: {
    height: 3,
  },
  pressed: {
    opacity: 0.7,
  },
});
