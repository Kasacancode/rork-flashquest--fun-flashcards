import { ChevronRight, Crown, Moon, Settings, Sun } from 'lucide-react-native';
import React from 'react';
import { Switch, Text, TouchableOpacity, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';

import type { Theme } from '@/constants/colors';

type ViewStyles<K extends string> = { [P in K]: StyleProp<ViewStyle> };
type TextStyles<K extends string> = { [P in K]: StyleProp<TextStyle> };

interface OverviewTabProps {
  isDark: boolean;
  onOpenSettings: () => void;
  onOpenLeaderboard: () => void;
  styles: ViewStyles<
    | 'tabContent'
    | 'toggleCard'
    | 'toggleLeadingIcon'
    | 'toggleTextWrap'
    | 'toggleRight'
    | 'toggleChevronWrap'
    | 'themeSwitch'
    | 'leaderboardButton'
    | 'leaderboardIconWrap'
    | 'leaderboardTextWrap'
    | 'leaderboardChevronWrap'
  > &
    TextStyles<
      | 'toggleTitle'
      | 'toggleSubtitle'
      | 'leaderboardButtonText'
      | 'leaderboardSubtitle'
    >;
  theme: Theme;
  toggleTheme: () => void;
}

export default function OverviewTab({
  isDark,
  onOpenSettings,
  onOpenLeaderboard,
  styles,
  theme,
  toggleTheme,
}: OverviewTabProps) {
  return (
    <View style={styles.tabContent}>
      <TouchableOpacity
        style={styles.leaderboardButton}
        onPress={onOpenLeaderboard}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel="Open leaderboard"
        testID="profile-overview-leaderboard"
      >
        <View style={styles.leaderboardIconWrap}>
          <Crown color={theme.primary} size={20} strokeWidth={2.3} />
        </View>
        <View style={styles.leaderboardTextWrap}>
          <Text style={styles.leaderboardButtonText}>Leaderboard</Text>
          <Text style={styles.leaderboardSubtitle} numberOfLines={2}>
            See the top arena players and track your climb.
          </Text>
        </View>
        <View style={styles.leaderboardChevronWrap}>
          <ChevronRight color={theme.textSecondary} size={18} strokeWidth={2.3} />
        </View>
      </TouchableOpacity>

      <TouchableOpacity style={styles.toggleCard} onPress={onOpenSettings} activeOpacity={0.7} testID="profile-open-settings">
        <View style={styles.toggleLeadingIcon}>
          <Settings color={theme.primary} size={20} strokeWidth={2.3} />
        </View>
        <View style={styles.toggleTextWrap}>
          <Text style={styles.toggleTitle}>Settings</Text>
          <Text style={styles.toggleSubtitle} numberOfLines={2}>Goals, reminders, privacy, and more.</Text>
        </View>
        <View style={styles.toggleChevronWrap}>
          <ChevronRight color={theme.textSecondary} size={20} strokeWidth={2.5} />
        </View>
      </TouchableOpacity>

      <View style={styles.toggleCard} testID="profile-dark-mode-row">
        <View style={styles.toggleLeadingIcon}>
          {isDark ? <Moon color={theme.primary} size={20} strokeWidth={2.3} /> : <Sun color={theme.primary} size={20} strokeWidth={2.3} />}
        </View>
        <View style={styles.toggleTextWrap}>
          <Text style={styles.toggleTitle}>Dark mode</Text>
          <Text style={styles.toggleSubtitle}>{isDark ? 'Dark theme active' : 'Light theme active'}</Text>
        </View>
        <View style={styles.toggleRight}>
          <Switch
            value={isDark}
            onValueChange={toggleTheme}
            style={styles.themeSwitch}
            trackColor={{ false: isDark ? 'rgba(148, 163, 184, 0.45)' : '#CBD5E1', true: theme.primary }}
            thumbColor="#fff"
            ios_backgroundColor={isDark ? 'rgba(148, 163, 184, 0.45)' : '#CBD5E1'}
            accessibilityLabel="Dark mode"
            accessibilityRole="switch"
            testID="profile-dark-mode-switch"
          />
        </View>
      </View>
    </View>
  );
}
