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
  pendingFriendRequestCount: number;
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
    | 'pendingBadge'
  > &
    TextStyles<
      | 'toggleTitle'
      | 'toggleSubtitle'
      | 'leaderboardButtonText'
      | 'leaderboardSubtitle'
      | 'utilityTitle'
      | 'utilitySubtitle'
      | 'pendingBadgeText'
    >;
  theme: Theme;
  isDark: boolean;
}

export default function OverviewTab({
  onOpenSettings,
  onOpenFAQ,
  onOpenSupport,
  onOpenLeaderboard,
  onOpenFriends,
  pendingFriendRequestCount,
  styles,
  theme,
  isDark,
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
          <Crown color={isDark ? '#F5C451' : '#B7791F'} size={20} strokeWidth={2.3} />
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
        <View
          style={[
            styles.toggleLeadingIcon,
            { backgroundColor: isDark ? 'rgba(52, 211, 153, 0.15)' : 'rgba(5, 150, 105, 0.1)' },
          ]}
        >
          <Users color={isDark ? '#34D399' : '#059669'} size={20} strokeWidth={2.3} />
          {pendingFriendRequestCount > 0 ? (
            <View style={styles.pendingBadge}>
              <Text style={styles.pendingBadgeText}>{pendingFriendRequestCount > 9 ? '9+' : pendingFriendRequestCount}</Text>
            </View>
          ) : null}
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
        <View
          style={[
            styles.toggleLeadingIcon,
            { backgroundColor: isDark ? 'rgba(148, 163, 184, 0.15)' : 'rgba(100, 116, 139, 0.1)' },
          ]}
        >
          <Settings color={isDark ? '#94A3B8' : '#64748B'} size={20} strokeWidth={2.3} />
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
            <View
              style={[
                styles.utilityIconWrap,
                { backgroundColor: isDark ? 'rgba(96, 165, 250, 0.15)' : 'rgba(37, 99, 235, 0.1)' },
              ]}
            >
              <CircleHelp color={isDark ? '#60A5FA' : '#2563EB'} size={18} strokeWidth={2.3} />
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
            <View
              style={[
                styles.utilityIconWrap,
                { backgroundColor: isDark ? 'rgba(251, 146, 60, 0.15)' : 'rgba(234, 88, 12, 0.1)' },
              ]}
            >
              <Mail color={isDark ? '#FB923C' : '#EA580C'} size={18} strokeWidth={2.3} />
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
