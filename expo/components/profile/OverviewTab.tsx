import { LinearGradient } from 'expo-linear-gradient';
import { ChevronRight, Settings } from 'lucide-react-native';
import React from 'react';
import { Text, TouchableOpacity, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';

import type { Theme } from '@/constants/colors';

type ViewStyles<K extends string> = { [P in K]: StyleProp<ViewStyle> };
type TextStyles<K extends string> = { [P in K]: StyleProp<TextStyle> };

interface OverviewTabProps {
  onOpenSettings: () => void;
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
  onOpenSettings,
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
                <Settings color={theme.primary} size={18} strokeWidth={2.3} />
              </View>
              <View style={styles.appearanceTextWrap}>
                <Text style={styles.cardTitle}>App settings</Text>
                <Text style={styles.cardDescription}>Study preferences, privacy, support, and backups live in one place.</Text>
              </View>
            </View>
          </View>

          <TouchableOpacity style={styles.toggleCard} onPress={onOpenSettings} activeOpacity={0.7} testID="profile-open-settings">
            <View style={styles.toggleLeadingIcon}>
              <Settings color={theme.primary} size={17} strokeWidth={2.3} />
            </View>
            <View style={styles.toggleTextWrap}>
              <Text style={styles.toggleTitle}>Open settings</Text>
              <Text style={styles.toggleSubtitle}>Dark mode, reminders, sound, privacy, support, and data tools.</Text>
            </View>
            <ChevronRight color={theme.textSecondary} size={18} strokeWidth={2.3} />
          </TouchableOpacity>
        </LinearGradient>
      </View>
    </View>
  );
}
