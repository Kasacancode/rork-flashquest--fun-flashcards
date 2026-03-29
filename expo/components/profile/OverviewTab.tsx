import { LinearGradient } from 'expo-linear-gradient';
import { Crown, HelpCircle, Mail, Moon, ShieldCheck, Sun, User } from 'lucide-react-native';
import React from 'react';
import { Switch, Text, TouchableOpacity, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';

import type { Theme } from '@/constants/colors';

type ViewStyles<K extends string> = { [P in K]: StyleProp<ViewStyle> };
type TextStyles<K extends string> = { [P in K]: StyleProp<TextStyle> };

interface OverviewTabProps {
  isDark: boolean;
  toggleTheme: () => void;
  canAccessDeveloperTools: boolean;
  onOpenAnalyticsDebug: () => void;
  onOpenFAQ: () => void;
  onOpenSupport: () => void;
  onOpenPrivacy: () => void;
  onComingSoon: (label: string) => void;
  surfaceGradient: readonly [string, string];
  styles: ViewStyles<
    | 'tabContent'
    | 'cardShell'
    | 'appearanceCard'
    | 'toggleCard'
    | 'toggleLeadingIcon'
    | 'toggleTextWrap'
    | 'utilityGrid'
    | 'utilityCard'
    | 'utilityCardGradient'
    | 'utilityIconWrap'
    | 'debugButton'
  > &
    TextStyles<
      | 'toggleTitle'
      | 'toggleSubtitle'
      | 'utilityTitle'
      | 'utilityDescription'
      | 'utilityTag'
      | 'debugButtonText'
    >;
  theme: Theme;
}

export default function OverviewTab({
  isDark,
  toggleTheme,
  canAccessDeveloperTools,
  onOpenAnalyticsDebug,
  onOpenFAQ,
  onOpenSupport,
  onOpenPrivacy,
  onComingSoon,
  surfaceGradient,
  styles,
  theme,
}: OverviewTabProps) {
  return (
    <View style={styles.tabContent}>
      <View style={styles.cardShell}>
        <LinearGradient
          colors={surfaceGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.appearanceCard}
        >
          <View style={styles.toggleCard}>
            <View style={styles.toggleLeadingIcon}>
              {isDark ? (
                <Moon color={theme.primary} size={17} strokeWidth={2.3} />
              ) : (
                <Sun color={theme.primary} size={17} strokeWidth={2.3} />
              )}
            </View>
            <View style={styles.toggleTextWrap}>
              <Text style={styles.toggleTitle}>Dark mode</Text>
              <Text style={styles.toggleSubtitle}>
                {isDark ? 'Enabled for a low-light look.' : 'Switch on for a darker theme.'}
              </Text>
            </View>
            <Switch
              value={isDark}
              onValueChange={toggleTheme}
              trackColor={{ false: isDark ? '#475569' : '#CBD5E1', true: theme.primary }}
              thumbColor={theme.white}
              ios_backgroundColor={isDark ? '#475569' : '#CBD5E1'}
              testID="dark-mode-switch"
            />
          </View>
        </LinearGradient>
      </View>

      <View style={styles.cardShell}>
        <LinearGradient
          colors={surfaceGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.appearanceCard}
        >
          <TouchableOpacity style={styles.toggleCard} onPress={onOpenFAQ} activeOpacity={0.7}>
            <View style={styles.toggleLeadingIcon}>
              <HelpCircle color={theme.primary} size={17} strokeWidth={2.3} />
            </View>
            <View style={styles.toggleTextWrap}>
              <Text style={styles.toggleTitle}>Help & FAQ</Text>
              <Text style={styles.toggleSubtitle}>How FlashQuest works.</Text>
            </View>
          </TouchableOpacity>
        </LinearGradient>
      </View>

      <View style={styles.cardShell}>
        <LinearGradient
          colors={surfaceGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.appearanceCard}
        >
          <TouchableOpacity style={styles.toggleCard} onPress={onOpenSupport} activeOpacity={0.7} testID="profile-open-support-contact">
            <View style={styles.toggleLeadingIcon}>
              <Mail color={theme.primary} size={17} strokeWidth={2.3} />
            </View>
            <View style={styles.toggleTextWrap}>
              <Text style={styles.toggleTitle}>Support & Contact</Text>
              <Text style={styles.toggleSubtitle}>Support: support@flashquest.net</Text>
            </View>
          </TouchableOpacity>
        </LinearGradient>
      </View>

      <View style={styles.cardShell}>
        <LinearGradient
          colors={surfaceGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.appearanceCard}
        >
          <TouchableOpacity style={styles.toggleCard} onPress={onOpenPrivacy} activeOpacity={0.7} testID="profile-open-privacy-center">
            <View style={styles.toggleLeadingIcon}>
              <ShieldCheck color={theme.primary} size={17} strokeWidth={2.3} />
            </View>
            <View style={styles.toggleTextWrap}>
              <Text style={styles.toggleTitle}>Data & Privacy</Text>
              <Text style={styles.toggleSubtitle}>Privacy: privacy@flashquest.net</Text>
            </View>
          </TouchableOpacity>
        </LinearGradient>
      </View>

      <View style={styles.utilityGrid}>
        <TouchableOpacity
          style={styles.utilityCard}
          onPress={() => onComingSoon('Friends')}
          activeOpacity={0.88}
          testID="profile-card-friends"
        >
          <LinearGradient
            colors={surfaceGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.utilityCardGradient}
          >
            <View style={styles.utilityIconWrap}>
              <User color={theme.primary} size={18} strokeWidth={2.3} />
            </View>
            <Text style={styles.utilityTitle}>Friends</Text>
            <Text style={styles.utilityDescription}>Follow classmates and compare progress soon.</Text>
            <Text style={styles.utilityTag}>Coming soon</Text>
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.utilityCard}
          onPress={() => onComingSoon('Leaderboard')}
          activeOpacity={0.88}
          testID="profile-card-leaderboard"
        >
          <LinearGradient
            colors={surfaceGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.utilityCardGradient}
          >
            <View style={styles.utilityIconWrap}>
              <Crown color={theme.primary} size={18} strokeWidth={2.3} />
            </View>
            <Text style={styles.utilityTitle}>Leaderboard</Text>
            <Text style={styles.utilityDescription}>Rank up against other players in future updates.</Text>
            <Text style={styles.utilityTag}>Coming soon</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {canAccessDeveloperTools ? (
        <TouchableOpacity
          style={styles.debugButton}
          onPress={onOpenAnalyticsDebug}
          activeOpacity={0.84}
          testID="profile-open-analytics-debug"
        >
          <Text style={styles.debugButtonText}>Analytics Debug</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}
