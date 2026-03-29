import { LinearGradient } from 'expo-linear-gradient';
import { Bug, ChevronRight, HelpCircle, Moon, ShieldCheck, Sun } from 'lucide-react-native';
import React from 'react';
import { Switch, Text, TouchableOpacity, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';

import type { Theme } from '@/constants/colors';
type ViewStyles<K extends string> = { [P in K]: StyleProp<ViewStyle> };
type TextStyles<K extends string> = { [P in K]: StyleProp<TextStyle> };

interface OverviewTabProps {
  isDark: boolean;
  toggleTheme: () => void;
  onOpenFAQ: () => void;
  onOpenPrivacy: () => void;
  onOpenFlashcardInspector?: () => void;
  surfaceGradient: readonly [string, string];
  styles: ViewStyles<
    | 'tabContent'
    | 'cardShell'
    | 'appearanceCard'
    | 'appearanceHeader'
    | 'appearanceIntro'
    | 'appearanceIconWrap'
    | 'appearanceTextWrap'
    | 'toggleCard'
    | 'toggleLeadingIcon'
    | 'toggleTextWrap'
  > &
    TextStyles<
      | 'cardTitle'
      | 'cardDescription'
      | 'toggleTitle'
      | 'toggleSubtitle'
    >;
  theme: Theme;
}

export default function OverviewTab({
  isDark,
  toggleTheme,
  onOpenFAQ,
  onOpenPrivacy,
  onOpenFlashcardInspector,
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
          <View style={styles.appearanceHeader}>
            <View style={styles.appearanceIntro}>
              <View style={styles.appearanceIconWrap}>
                {isDark ? (
                  <Moon color={theme.primary} size={18} strokeWidth={2.3} />
                ) : (
                  <Sun color={theme.primary} size={18} strokeWidth={2.3} />
                )}
              </View>
              <View style={styles.appearanceTextWrap}>
                <Text style={styles.cardTitle}>Appearance</Text>
              </View>
            </View>
          </View>

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
          <View style={styles.appearanceHeader}>
            <View style={styles.appearanceIntro}>
              <View style={styles.appearanceIconWrap}>
                <HelpCircle color={theme.primary} size={18} strokeWidth={2.3} />
              </View>
              <View style={styles.appearanceTextWrap}>
                <Text style={styles.cardTitle}>Help & trust</Text>
              </View>
            </View>
          </View>

          <TouchableOpacity style={styles.toggleCard} onPress={onOpenFAQ} activeOpacity={0.7} testID="profile-open-help-center">
            <View style={styles.toggleLeadingIcon}>
              <HelpCircle color={theme.primary} size={17} strokeWidth={2.3} />
            </View>
            <View style={styles.toggleTextWrap}>
              <Text style={styles.toggleTitle}>Help Center</Text>
              <Text style={styles.toggleSubtitle}>Guides, FAQs, and support.</Text>
            </View>
            <ChevronRight color={theme.textSecondary} size={18} strokeWidth={2.3} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.toggleCard} onPress={onOpenPrivacy} activeOpacity={0.7} testID="profile-open-privacy-center">
            <View style={styles.toggleLeadingIcon}>
              <ShieldCheck color={theme.primary} size={17} strokeWidth={2.3} />
            </View>
            <View style={styles.toggleTextWrap}>
              <Text style={styles.toggleTitle}>Privacy & Data</Text>
              <Text style={styles.toggleSubtitle}>Analytics controls, data use, and legal documents.</Text>
            </View>
            <ChevronRight color={theme.textSecondary} size={18} strokeWidth={2.3} />
          </TouchableOpacity>

          {__DEV__ && onOpenFlashcardInspector ? (
            <TouchableOpacity style={styles.toggleCard} onPress={onOpenFlashcardInspector} activeOpacity={0.7} testID="profile-open-flashcard-inspector">
              <View style={styles.toggleLeadingIcon}>
                <Bug color={theme.primary} size={17} strokeWidth={2.3} />
              </View>
              <View style={styles.toggleTextWrap}>
                <Text style={styles.toggleTitle}>Flashcard Inspector</Text>
                <Text style={styles.toggleSubtitle}>Inspect normalization snapshots and diagnostics.</Text>
              </View>
              <ChevronRight color={theme.textSecondary} size={18} strokeWidth={2.3} />
            </TouchableOpacity>
          ) : null}
        </LinearGradient>
      </View>

    </View>
  );
}
