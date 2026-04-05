import { Calendar, Target } from 'lucide-react-native';
import React, { memo, useMemo } from 'react';
import { Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';

import type { InsightStyles, InsightThemeColors } from '@/components/stats/insights/insightTypes';

interface WeekInsightsProps {
  thisWeekDays: number;
  currentWeekAccuracy: number | null;
  studyDates: string[];
  lastActiveDate: string;
  colors: InsightThemeColors;
  styles: InsightStyles & {
    weekDayRow: StyleProp<ViewStyle>;
    weekDayItem: StyleProp<ViewStyle>;
    weekDayLabel: StyleProp<TextStyle>;
    weekDayDot: StyleProp<ViewStyle>;
  };
  isDark: boolean;
}

function WeekInsights({
  thisWeekDays,
  currentWeekAccuracy,
  studyDates,
  lastActiveDate,
  colors,
  styles,
  isDark,
}: WeekInsightsProps) {
  const weekInsightData = useMemo(() => {
    const referenceDate = new Date();
    const currentDateKey = referenceDate.toISOString().slice(0, 10);
    const dayOfWeek = referenceDate.getDay();
    const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const todayTime = referenceDate.getTime();
    const activeDates = new Set<string>(studyDates);

    if (lastActiveDate) {
      activeDates.add(lastActiveDate);
    }

    return ['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((label, index) => {
      const dayDate = new Date(referenceDate);
      dayDate.setHours(0, 0, 0, 0);
      dayDate.setDate(referenceDate.getDate() - mondayOffset + index);

      const dateKey = dayDate.toISOString().slice(0, 10);

      return {
        key: `${label}-${dateKey}`,
        label,
        isToday: dateKey === currentDateKey,
        isActive: activeDates.has(dateKey),
        isFuture: dayDate.getTime() > todayTime,
      };
    });
  }, [lastActiveDate, studyDates]);

  return (
    <View style={styles.insightSection}>
      <View style={[styles.insightDivider, { backgroundColor: colors.border }]} />
      <View style={styles.weekDayRow}>
        {weekInsightData.map((day) => (
          <View key={day.key} style={styles.weekDayItem}>
            <Text style={[styles.weekDayLabel, { color: colors.textTertiary }]}>{day.label}</Text>
            <View
              style={[
                styles.weekDayDot,
                {
                  backgroundColor: day.isFuture
                    ? 'transparent'
                    : day.isActive
                      ? colors.success
                      : (isDark ? 'rgba(148,163,184,0.15)' : 'rgba(0,0,0,0.06)'),
                  borderWidth: day.isToday ? 2 : 0,
                  borderColor: day.isToday ? colors.statsAccent : 'transparent',
                },
              ]}
            />
          </View>
        ))}
      </View>

      {currentWeekAccuracy !== null ? (
        <View style={styles.insightRow}>
          <Target color={currentWeekAccuracy >= 80 ? colors.success : colors.warning} size={15} />
          <Text style={[styles.insightText, { color: colors.textSecondary }]}>
            {currentWeekAccuracy >= 90
              ? `${currentWeekAccuracy}% accuracy. You're retaining almost everything.`
              : currentWeekAccuracy >= 70
                ? `${currentWeekAccuracy}% accuracy. Solid, but reviewing weak cards could push it higher.`
                : `${currentWeekAccuracy}% accuracy. Try focusing on fewer decks and reviewing weak cards.`}
          </Text>
        </View>
      ) : null}

      <View style={styles.insightRow}>
        <Calendar color={colors.statsAccent} size={15} />
        <Text style={[styles.insightText, { color: colors.textSecondary }]}>
          {thisWeekDays >= 5
            ? 'Exceptional consistency. Keep this rhythm and watch your recall improve.'
            : thisWeekDays >= 3
              ? `${thisWeekDays} days this week. Try for one more day to build a stronger habit.`
              : thisWeekDays >= 1
                ? `Only ${thisWeekDays} day this week. Aim for at least 3 days for better retention.`
                : 'No study days yet this week. Start today and build momentum.'}
        </Text>
      </View>
    </View>
  );
}

export default memo(WeekInsights);
