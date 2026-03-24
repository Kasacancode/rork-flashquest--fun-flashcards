import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/context/ThemeContext';
import type { RecallQuality } from '@/types/performance';

interface ConfidenceChipsProps {
  selectedQuality: RecallQuality;
  onSelect: (quality: RecallQuality) => void;
  compact?: boolean;
  allowForgot?: boolean;
  prompt?: string;
  testIDPrefix?: string;
}

type ChipDefinition = {
  quality: RecallQuality;
  label: string;
  activeColor: string;
};

export default function ConfidenceChips({
  selectedQuality,
  onSelect,
  compact = false,
  allowForgot = false,
  prompt = 'How did that feel?',
  testIDPrefix = 'confidence-chip',
}: ConfidenceChipsProps) {
  const { theme, isDark } = useTheme();

  const chips = useMemo<ChipDefinition[]>(() => {
    const baseChips: ChipDefinition[] = [
      { quality: 4, label: 'Easy', activeColor: '#2563EB' },
      { quality: 3, label: 'Okay', activeColor: isDark ? '#475569' : '#64748B' },
      { quality: 2, label: 'Hard', activeColor: '#F59E0B' },
    ];

    return allowForgot
      ? [...baseChips, { quality: 1, label: 'Forgot', activeColor: '#F43F5E' }]
      : baseChips;
  }, [allowForgot, isDark]);

  return (
    <View style={[styles.container, compact && styles.containerCompact]}>
      <Text style={[styles.prompt, { color: theme.textSecondary }]}>{prompt}</Text>
      <View style={[styles.row, compact && styles.rowCompact]}>
        {chips.map((chip) => {
          const isSelected = selectedQuality === chip.quality;
          return (
            <Pressable
              key={chip.quality}
              style={[
                styles.chip,
                compact && styles.chipCompact,
                {
                  backgroundColor: isSelected ? chip.activeColor : (isDark ? 'rgba(15,23,42,0.32)' : 'rgba(255,255,255,0.82)'),
                  borderColor: isSelected ? chip.activeColor : (isDark ? 'rgba(255,255,255,0.12)' : 'rgba(148,163,184,0.22)'),
                },
              ]}
              onPress={() => onSelect(chip.quality)}
              testID={`${testIDPrefix}-${chip.label.toLowerCase()}`}
            >
              <Text
                style={[
                  styles.chipLabel,
                  compact && styles.chipLabelCompact,
                  { color: isSelected ? '#FFFFFF' : theme.text },
                ]}
              >
                {chip.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 10,
    alignItems: 'center',
  },
  containerCompact: {
    gap: 8,
  },
  prompt: {
    fontSize: 13,
    fontWeight: '600' as const,
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  rowCompact: {
    gap: 6,
  },
  chip: {
    minWidth: 68,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipCompact: {
    minWidth: 60,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipLabel: {
    fontSize: 13,
    fontWeight: '700' as const,
  },
  chipLabelCompact: {
    fontSize: 12,
  },
});
