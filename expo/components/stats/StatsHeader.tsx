import { ArrowLeft, Trophy } from 'lucide-react-native';
import React, { memo } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import type { StatsTextStyles, StatsViewStyles } from '@/components/stats/statsScreen.types';

interface StatsHeaderProps {
  isDark: boolean;
  headerContentColor: string;
  headerPillBorderColor: string;
  trophyIconColor: string;
  styles: StatsViewStyles<'header' | 'backButton' | 'headerTitleWrap' | 'placeholder'> &
    StatsTextStyles<'headerTitle'>;
  onBack: () => void;
}

function StatsHeaderComponent({
  isDark,
  headerContentColor,
  headerPillBorderColor,
  trophyIconColor,
  styles,
  onBack,
}: StatsHeaderProps) {
  return (
    <View style={styles.header}>
      <TouchableOpacity
        onPress={onBack}
        accessibilityLabel="Go back"
        accessibilityRole="button"
        style={[
          styles.backButton,
          {
            backgroundColor: isDark ? 'rgba(10, 17, 34, 0.46)' : 'rgba(255, 255, 255, 0.58)',
            borderColor: isDark ? 'rgba(148, 163, 184, 0.16)' : 'rgba(148, 163, 184, 0.18)',
            shadowOpacity: isDark ? 0.22 : 0.08,
            shadowRadius: isDark ? 14 : 10,
            elevation: isDark ? 6 : 3,
          },
        ]}
        testID="stats-back-button"
      >
        <ArrowLeft color={headerContentColor} size={24} strokeWidth={2.5} />
      </TouchableOpacity>
      <View
        style={[
          styles.headerTitleWrap,
          {
            backgroundColor: isDark ? 'rgba(10, 17, 34, 0.42)' : 'rgba(255, 255, 255, 0.5)',
            borderColor: headerPillBorderColor,
          },
        ]}
      >
        <Trophy color={trophyIconColor} size={21} strokeWidth={2.35} />
        <Text style={[styles.headerTitle, { color: headerContentColor }]}>Stats</Text>
      </View>
      <View style={styles.placeholder} />
    </View>
  );
}

export default memo(StatsHeaderComponent);
