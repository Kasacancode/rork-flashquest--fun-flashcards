import { Calendar } from 'lucide-react-native';
import React, { memo } from 'react';
import { Text, View } from 'react-native';

import type { StatsTextStyles, StatsViewStyles } from '@/components/stats/statsScreen.types';
import type { WeeklySummary } from '@/utils/statsSelectors';

interface StatsWeeklySummaryCardProps {
  weeklySummary: WeeklySummary;
  formattedStudyTime: string;
  currentStreak: number;
  statsAccent: string;
  isDark: boolean;
  theme: { success: string; warning: string };
  styles: StatsViewStyles<'weeklyCard' | 'weeklyHeader' | 'weeklyStatsRow' | 'weeklyStat' | 'weeklyDivider'> &
    StatsTextStyles<'weeklyTitle' | 'weeklyStatValue' | 'weeklyStatLabel' | 'weeklyComparison'>;
}

function StatsWeeklySummaryCardComponent({
  weeklySummary,
  formattedStudyTime,
  currentStreak,
  statsAccent,
  isDark,
  theme,
  styles,
}: StatsWeeklySummaryCardProps) {
  return (
    <View style={styles.weeklyCard}>
      <View style={styles.weeklyHeader}>
        <Calendar color={statsAccent} size={20} strokeWidth={2.2} />
        <Text style={styles.weeklyTitle}>This Week</Text>
      </View>
      <View style={styles.weeklyStatsRow}>
        <View style={styles.weeklyStat}>
          <Text style={[styles.weeklyStatValue, { color: statsAccent }]}>{weeklySummary.thisWeekDays}</Text>
          <Text style={styles.weeklyStatLabel}>Days Active</Text>
        </View>
        <View style={[styles.weeklyDivider, { backgroundColor: isDark ? 'rgba(148,163,184,0.14)' : '#e0e0e0' }]} />
        <View style={styles.weeklyStat}>
          <Text style={[styles.weeklyStatValue, { color: statsAccent }]}>{currentStreak}</Text>
          <Text style={styles.weeklyStatLabel}>Day Streak</Text>
        </View>
        {formattedStudyTime !== '' ? (
          <>
            <View style={[styles.weeklyDivider, { backgroundColor: isDark ? 'rgba(148,163,184,0.14)' : '#e0e0e0' }]} />
            <View style={styles.weeklyStat}>
              <Text style={[styles.weeklyStatValue, { color: statsAccent }]} numberOfLines={1} adjustsFontSizeToFit>
                {formattedStudyTime}
              </Text>
              <Text style={styles.weeklyStatLabel}>Study Time</Text>
            </View>
          </>
        ) : null}
        {weeklySummary.currentWeekAccuracy !== null ? (
          <>
            <View style={[styles.weeklyDivider, { backgroundColor: isDark ? 'rgba(148,163,184,0.14)' : '#e0e0e0' }]} />
            <View style={styles.weeklyStat}>
              <Text
                style={[
                  styles.weeklyStatValue,
                  { color: weeklySummary.currentWeekAccuracy >= 70 ? theme.success : theme.warning },
                ]}
              >
                {weeklySummary.currentWeekAccuracy}%
              </Text>
              <Text style={styles.weeklyStatLabel}>Accuracy</Text>
            </View>
          </>
        ) : null}
      </View>
      <Text style={styles.weeklyComparison}>{weeklySummary.comparison}</Text>
    </View>
  );
}

export default memo(StatsWeeklySummaryCardComponent);
