import { Award, Calendar, Flame, TrendingUp } from 'lucide-react-native';
import React, { memo, useMemo } from 'react';
import { Text, View } from 'react-native';

import type { InsightStyles, InsightThemeColors } from '@/components/stats/insights/insightTypes';

interface ActivityInsightsProps {
  studyDates: string[];
  currentStreak: number;
  longestStreak: number;
  thisWeekDays: number;
  colors: InsightThemeColors;
  styles: InsightStyles;
}

function ActivityInsights({
  studyDates,
  currentStreak,
  longestStreak,
  thisWeekDays,
  colors,
  styles,
}: ActivityInsightsProps) {
  const studyPatternInsight = useMemo(() => {
    if (studyDates.length < 3) {
      return null;
    }

    const dayCounts = [0, 0, 0, 0, 0, 0, 0];
    for (const dateStr of studyDates) {
      const day = new Date(dateStr).getDay();
      dayCounts[day] += 1;
    }

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const maxDay = dayCounts.indexOf(Math.max(...dayCounts));
    const weekdayTotal = dayCounts[1] + dayCounts[2] + dayCounts[3] + dayCounts[4] + dayCounts[5];
    const weekendTotal = dayCounts[0] + dayCounts[6];
    const totalDays = studyDates.length;

    const pattern = weekdayTotal > weekendTotal * 2
      ? 'You study mostly on weekdays. Weekend sessions could boost retention.'
      : weekendTotal > weekdayTotal
        ? 'You lean toward weekends. Adding one weekday session would smooth your rhythm.'
        : 'Good balance between weekdays and weekends.';

    const weekCounts = new Map<string, number>();
    for (const dateStr of studyDates) {
      const day = new Date(dateStr);
      const weekStart = new Date(day);
      weekStart.setDate(day.getDate() - ((day.getDay() + 6) % 7));
      const key = weekStart.toISOString().slice(0, 10);
      weekCounts.set(key, (weekCounts.get(key) ?? 0) + 1);
    }

    let bestWeekDays = 0;
    for (const count of weekCounts.values()) {
      if (count > bestWeekDays) {
        bestWeekDays = count;
      }
    }

    return {
      mostActiveDay: dayNames[maxDay] ?? 'Monday',
      pattern,
      bestWeekDays,
      totalDays,
    };
  }, [studyDates]);

  return (
    <View style={styles.insightSection}>
      <View style={[styles.insightDivider, { backgroundColor: colors.border }]} />

      {studyPatternInsight ? (
        <View style={styles.insightRow}>
          <Calendar color={colors.statsAccent} size={15} />
          <Text style={[styles.insightText, { color: colors.textSecondary }]}>
            Your most active day is {studyPatternInsight.mostActiveDay}. You've studied on {studyPatternInsight.totalDays} total days.
          </Text>
        </View>
      ) : null}

      {studyPatternInsight ? (
        <View style={styles.insightRow}>
          <TrendingUp color={colors.statsAccent} size={15} />
          <Text style={[styles.insightText, { color: colors.textSecondary }]}>{studyPatternInsight.pattern}</Text>
        </View>
      ) : null}

      <View style={styles.insightRow}>
        <Flame color={colors.warning} size={15} />
        <Text style={[styles.insightText, { color: colors.textSecondary }]}>
          {currentStreak >= longestStreak && currentStreak > 1
            ? `You're on your longest streak ever (${currentStreak} days). Every day you study extends the record.`
            : currentStreak > 0 && longestStreak > currentStreak
              ? `Current streak: ${currentStreak}. Your record is ${longestStreak} days. ${longestStreak - currentStreak} more to beat it.`
              : longestStreak > 0
                ? `Your best streak was ${longestStreak} days. Start studying today to build a new one.`
                : 'Study today to start your first streak.'}
        </Text>
      </View>

      {studyPatternInsight && studyPatternInsight.bestWeekDays > 0 ? (
        <View style={styles.insightRow}>
          <Award color={colors.success} size={15} />
          <Text style={[styles.insightText, { color: colors.textSecondary }]}>Your best week had {studyPatternInsight.bestWeekDays} active days. {thisWeekDays >= studyPatternInsight.bestWeekDays ? "You're matching that this week." : `This week you have ${thisWeekDays} so far.`}</Text>
        </View>
      ) : null}
    </View>
  );
}

export default memo(ActivityInsights);
