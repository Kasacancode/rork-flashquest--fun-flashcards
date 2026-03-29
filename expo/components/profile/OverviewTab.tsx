import { LinearGradient } from 'expo-linear-gradient';
import { HelpCircle, Mail, Moon, ShieldCheck, Sun } from 'lucide-react-native';
import React from 'react';
import { Switch, Text, TouchableOpacity, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';

import type { Theme } from '@/constants/colors';
import { PRIVACY_LINKS } from '@/constants/privacy';

type ViewStyles<K extends string> = { [P in K]: StyleProp<ViewStyle> };
type TextStyles<K extends string> = { [P in K]: StyleProp<TextStyle> };

interface OverviewTabProps {
  isDark: boolean;
  toggleTheme: () => void;
  onOpenFAQ: () => void;
  onOpenSupport: () => void;
  onOpenPrivacy: () => void;
  surfaceGradient: readonly [string, string];
  styles: ViewStyles<
    | 'tabContent'
    | 'cardShell'
    | 'appearanceCard'
    | 'toggleCard'
    | 'toggleLeadingIcon'
    | 'toggleTextWrap'
  > &
    TextStyles<
      | 'toggleTitle'
      | 'toggleSubtitle'
    >;
  theme: Theme;
}

export default function OverviewTab({
  isDark,
  toggleTheme,
  onOpenFAQ,
  onOpenSupport,
  onOpenPrivacy,
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
              <Text style={styles.toggleSubtitle}>{`Support: ${PRIVACY_LINKS.supportEmail}`}</Text>
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
              <Text style={styles.toggleSubtitle}>{`Privacy: ${PRIVACY_LINKS.privacyEmail}`}</Text>
            </View>
          </TouchableOpacity>
        </LinearGradient>
      </View>

    </View>
  );
}
