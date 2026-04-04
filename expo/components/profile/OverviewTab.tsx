import { ChevronRight, Crown, Settings } from 'lucide-react-native';
import React from 'react';
import { Text, TouchableOpacity, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';

import type { Theme } from '@/constants/colors';

type ViewStyles<K extends string> = { [P in K]: StyleProp<ViewStyle> };
type TextStyles<K extends string> = { [P in K]: StyleProp<TextStyle> };

interface OverviewTabProps {
  onOpenSettings: () => void;
  onOpenLeaderboard: () => void;
  styles: ViewStyles<
    | 'tabContent'
    | 'toggleCard'
    | 'toggleLeadingIcon'
    | 'toggleTextWrap'
    | 'toggleChevronWrap'
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
}

export default function OverviewTab({
  onOpenSettings,
  onOpenLeaderboard,
  styles,
  theme,
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

      <TouchableOpacity
        style={styles.toggleCard}
        onPress={onOpenSettings}
        activeOpacity={0.72}
        accessibilityRole="button"
        accessibilityLabel="Open settings"
        testID="profile-open-settings"
      >
        <View style={styles.toggleLeadingIcon}>
          <Settings color={theme.primary} size={20} strokeWidth={2.3} />
        </View>
        <View style={styles.toggleTextWrap}>
          <Text style={styles.toggleTitle}>Settings</Text>
          <Text style={styles.toggleSubtitle} numberOfLines={2}>Appearance, goals, privacy, and backup.</Text>
        </View>
        <View style={styles.toggleChevronWrap}>
          <ChevronRight color={theme.textSecondary} size={20} strokeWidth={2.5} />
        </View>
      </TouchableOpacity>

    </View>
  );
}
