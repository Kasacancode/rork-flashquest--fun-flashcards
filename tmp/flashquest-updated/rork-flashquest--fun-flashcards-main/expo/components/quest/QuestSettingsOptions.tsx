import { BookOpen, Clock, Focus, Lightbulb, RefreshCw, Target } from 'lucide-react-native';
import React, { memo, useCallback } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import type { Theme } from '@/constants/colors';

type RunLength = 5 | 10 | 20;
type TimerOption = 0 | 5 | 10;

interface QuestSettingsOptionsProps {
  theme: Theme;
  insetSurface: string;
  inactiveToggleSurface: string;
  runLength: RunLength;
  timerSeconds: TimerOption;
  focusWeakOnly: boolean;
  hintsEnabled: boolean;
  explanationsEnabled: boolean;
  secondChanceEnabled: boolean;
  setRunLength: (value: RunLength) => void;
  setTimerSeconds: (value: TimerOption) => void;
  setFocusWeakOnly: (value: boolean) => void;
  setHintsEnabled: (value: boolean) => void;
  setExplanationsEnabled: (value: boolean) => void;
  setSecondChanceEnabled: (value: boolean) => void;
}

interface OptionChipGroupProps<T extends string | number> {
  values: readonly T[];
  selectedValue: T;
  getLabel?: (value: T) => string;
  onSelect: (value: T) => void;
  theme: Theme;
  insetSurface: string;
  testIDPrefix: string;
}

interface ToggleSettingRowProps {
  label: string;
  icon: React.ComponentType<{ color?: string; size?: number }>;
  value: boolean;
  onToggle: () => void;
  theme: Theme;
  inactiveToggleSurface: string;
  testID: string;
}

function OptionChipGroup<T extends string | number>({
  values,
  selectedValue,
  getLabel,
  onSelect,
  theme,
  insetSurface,
  testIDPrefix,
}: OptionChipGroupProps<T>) {
  return (
    <View style={styles.optionGroup}>
      {values.map((value) => {
        const isSelected = selectedValue === value;
        const handlePress = () => {
          onSelect(value);
        };

        return (
          <TouchableOpacity
            key={`${testIDPrefix}-${String(value)}`}
            style={[
              styles.optionButton,
              { backgroundColor: insetSurface },
              isSelected ? { backgroundColor: theme.primary } : null,
            ]}
            onPress={handlePress}
            activeOpacity={0.7}
            testID={`${testIDPrefix}-${String(value)}`}
          >
            <Text style={[styles.optionText, { color: isSelected ? '#fff' : theme.text }]}>
              {getLabel ? getLabel(value) : String(value)}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const MemoOptionChipGroup = memo(OptionChipGroup) as typeof OptionChipGroup;

const ToggleSettingRow = memo(function ToggleSettingRow({
  label,
  icon: Icon,
  value,
  onToggle,
  theme,
  inactiveToggleSurface,
  testID,
}: ToggleSettingRowProps) {
  return (
    <TouchableOpacity style={styles.toggleRow} onPress={onToggle} activeOpacity={0.7} testID={testID}>
      <View style={styles.settingLabel}>
        <Icon color={theme.textSecondary} size={18} />
        <Text style={[styles.settingText, { color: theme.text }]}>{label}</Text>
      </View>
      <View style={[styles.toggle, { backgroundColor: value ? theme.primary : inactiveToggleSurface }]}>
        <View style={[styles.toggleKnob, { transform: [{ translateX: value ? 20 : 2 }] }]} />
      </View>
    </TouchableOpacity>
  );
});

function QuestSettingsOptions({
  theme,
  insetSurface,
  inactiveToggleSurface,
  runLength,
  timerSeconds,
  focusWeakOnly,
  hintsEnabled,
  explanationsEnabled,
  secondChanceEnabled,
  setRunLength,
  setTimerSeconds,
  setFocusWeakOnly,
  setHintsEnabled,
  setExplanationsEnabled,
  setSecondChanceEnabled,
}: QuestSettingsOptionsProps) {
  const handleToggleFocusWeakOnly = useCallback(() => {
    setFocusWeakOnly(!focusWeakOnly);
  }, [focusWeakOnly, setFocusWeakOnly]);

  const handleToggleHints = useCallback(() => {
    setHintsEnabled(!hintsEnabled);
  }, [hintsEnabled, setHintsEnabled]);

  const handleToggleExplanations = useCallback(() => {
    setExplanationsEnabled(!explanationsEnabled);
  }, [explanationsEnabled, setExplanationsEnabled]);

  const handleToggleSecondChance = useCallback(() => {
    setSecondChanceEnabled(!secondChanceEnabled);
  }, [secondChanceEnabled, setSecondChanceEnabled]);

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
      testID="quest-settings-options"
    >
      <View style={styles.settingRow}>
        <View style={styles.settingLabel}>
          <Target color={theme.textSecondary} size={18} />
          <Text style={[styles.settingText, { color: theme.text }]}>Run Length</Text>
        </View>
        <MemoOptionChipGroup
          values={[5, 10, 20] as const}
          selectedValue={runLength}
          onSelect={setRunLength}
          theme={theme}
          insetSurface={insetSurface}
          testIDPrefix="quest-settings-run-length"
        />
      </View>

      <View style={styles.settingRow}>
        <View style={styles.settingLabel}>
          <Clock color={theme.textSecondary} size={18} />
          <Text style={[styles.settingText, { color: theme.text }]}>Timer (sec)</Text>
        </View>
        <MemoOptionChipGroup
          values={[0, 5, 10] as const}
          selectedValue={timerSeconds}
          onSelect={setTimerSeconds}
          getLabel={(value) => (value === 0 ? 'Off' : String(value))}
          theme={theme}
          insetSurface={insetSurface}
          testIDPrefix="quest-settings-timer"
        />
      </View>

      <ToggleSettingRow
        label="Focus Weak Cards"
        icon={Focus}
        value={focusWeakOnly}
        onToggle={handleToggleFocusWeakOnly}
        theme={theme}
        inactiveToggleSurface={inactiveToggleSurface}
        testID="quest-settings-focus-weak-toggle"
      />
      <ToggleSettingRow
        label="Hints"
        icon={Lightbulb}
        value={hintsEnabled}
        onToggle={handleToggleHints}
        theme={theme}
        inactiveToggleSurface={inactiveToggleSurface}
        testID="quest-settings-hints-toggle"
      />
      <ToggleSettingRow
        label="Explanations"
        icon={BookOpen}
        value={explanationsEnabled}
        onToggle={handleToggleExplanations}
        theme={theme}
        inactiveToggleSurface={inactiveToggleSurface}
        testID="quest-settings-explanations-toggle"
      />
      <ToggleSettingRow
        label="Second Chance"
        icon={RefreshCw}
        value={secondChanceEnabled}
        onToggle={handleToggleSecondChance}
        theme={theme}
        inactiveToggleSurface={inactiveToggleSurface}
        testID="quest-settings-second-chance-toggle"
      />
    </ScrollView>
  );
}

export default memo(QuestSettingsOptions);

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 16,
  },
  settingRow: {
    marginBottom: 24,
  },
  settingLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  settingText: {
    fontSize: 16,
    fontWeight: '700' as const,
  },
  optionGroup: {
    flexDirection: 'row',
    gap: 10,
  },
  optionButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  optionText: {
    fontSize: 15,
    fontWeight: '700' as const,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 22,
  },
  toggle: {
    width: 46,
    height: 28,
    borderRadius: 999,
    justifyContent: 'center',
  },
  toggleKnob: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#fff',
  },
});
