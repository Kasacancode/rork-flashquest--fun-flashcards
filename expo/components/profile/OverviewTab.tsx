import { ChevronRight, CircleHelp, Crown, Mail, Settings, Users } from 'lucide-react-native';
import React from 'react';
import { Text, TouchableOpacity, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';

import type { Theme } from '@/constants/colors';

type ViewStyles<K extends string> = { [P in K]: StyleProp<ViewStyle> };
type TextStyles<K extends string> = { [P in K]: StyleProp<TextStyle> };

interface OverviewTabProps {
  onOpenSettings: () => void;
  onOpenFAQ: () => void;
  onOpenSupport: () => void;
  onOpenLeaderboard: () => void;
  onOpenFriends: () => void;
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
    | 'utilityRow'
    | 'utilityCard'
    | 'utilityCardHeader'
    | 'utilityIconWrap'
    | 'utilityTextWrap'
    | 'utilityChevronWrap'
  > &
    TextStyles<
      | 'toggleTitle'
      | 'toggleSubtitle'
      | 'leaderboardButtonText'
      | 'leaderboardSubtitle'
      | 'utilityTitle'
      | 'utilitySubtitle'
    >;
  theme: Theme;
}

export default function OverviewTab({
  onOpenSettings,
  onOpenFAQ,
  onOpenSupport,
  onOpenLeaderboard,
  onOpenFriends,
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
            See the top arena players and track your climb
          </Text>
        </View>
        <View style={styles.leaderboardChevronWrap}>
          <ChevronRight color={theme.textSecondary} size={18} strokeWidth={2.3} />
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.toggleCard}
        onPress={onOpenFriends}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel="Open friends"
        testID="profile-open-friends"
      >
        <View style={styles.toggleLeadingIcon}>
          <Users color={theme.primary} size={20} strokeWidth={2.3} />
        </View>
        <View style={styles.toggleTextWrap}>
          <Text style={styles.toggleTitle}>Friends</Text>
          <Text style={styles.toggleSubtitle} numberOfLines={2}>Add friends and compare streaks</Text>
        </View>
        <View style={styles.toggleChevronWrap}>
          <ChevronRight color={theme.textSecondary} size={18} strokeWidth={2.3} />
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.toggleCard}
        onPress={onOpenSettings}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel="Open settings"
        testID="profile-open-settings"
      >
        <View style={styles.toggleLeadingIcon}>
          <Settings color={theme.primary} size={20} strokeWidth={2.3} />
        </View>
        <View style={styles.toggleTextWrap}>
          <Text style={styles.toggleTitle}>Settings</Text>
          <Text style={styles.toggleSubtitle} numberOfLines={2}>Appearance, goals, privacy, and backup</Text>
        </View>
        <View style={styles.toggleChevronWrap}>
          <ChevronRight color={theme.textSecondary} size={18} strokeWidth={2.3} />
        </View>
      </TouchableOpacity>

      <View style={styles.utilityRow}>
        <TouchableOpacity
          style={styles.utilityCard}
          onPress={onOpenFAQ}
          activeOpacity={0.76}
          accessibilityRole="button"
          accessibilityLabel="Open FAQ"
          testID="profile-open-faq"
        >
          <View style={styles.utilityCardHeader}>
            <View style={styles.utilityIconWrap}>
              <CircleHelp color={theme.primary} size={18} strokeWidth={2.3} />
            </View>
            <View style={styles.utilityChevronWrap}>
              <ChevronRight color={theme.textSecondary} size={17} strokeWidth={2.3} />
            </View>
          </View>
          <View style={styles.utilityTextWrap}>
            <Text style={styles.utilityTitle}>FAQ</Text>
            <Text style={styles.utilitySubtitle} numberOfLines={2}>Answers, guides, and feature tips</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.utilityCard}
          onPress={onOpenSupport}
          activeOpacity={0.76}
          accessibilityRole="button"
          accessibilityLabel="Open support"
          testID="profile-open-support"
        >
          <View style={styles.utilityCardHeader}>
            <View style={styles.utilityIconWrap}>
              <Mail color={theme.primary} size={18} strokeWidth={2.3} />
            </View>
            <View style={styles.utilityChevronWrap}>
              <ChevronRight color={theme.textSecondary} size={17} strokeWidth={2.3} />
            </View>
          </View>
          <View style={styles.utilityTextWrap}>
            <Text style={styles.utilityTitle}>Support</Text>
            <Text style={styles.utilitySubtitle} numberOfLines={2}>Account, deck, and app help</Text>
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
}
