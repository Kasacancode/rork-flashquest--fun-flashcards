import { Flame, Star } from 'lucide-react-native';
import React, { memo } from 'react';
import { Text, View } from 'react-native';

import type { StatsTextStyles, StatsViewStyles } from '@/components/stats/statsScreen.types';
import type { CalendarDayData } from '@/utils/statsSelectors';

interface StatsStudyActivityCardProps {
  calendarActiveDays: number;
  calendarColumns: CalendarDayData[][];
  calendarIntensityColors: readonly [string, string, string, string];
  currentStreak: number;
  longestStreak: number;
  statsAccent: string;
  styles: StatsViewStyles<'calendarCard' | 'calendarBody' | 'calendarDayLabels' | 'calendarMonthSpacer' | 'calendarGrid' | 'calendarWeekColumn' | 'calendarSquare' | 'calendarFooter' | 'calendarLegend' | 'calendarLegendSquare' | 'streakRow' | 'streakItem'> &
    StatsTextStyles<'calendarTitle' | 'calendarSubtitle' | 'calendarDayLabel' | 'calendarMonthLabel' | 'calendarLegendText' | 'streakLabel'>;
}

function StatsStudyActivityCardComponent({
  calendarActiveDays,
  calendarColumns,
  calendarIntensityColors,
  currentStreak,
  longestStreak,
  statsAccent,
  styles,
}: StatsStudyActivityCardProps) {
  return (
    <View style={styles.calendarCard} testID="stats-study-activity">
      <Text style={styles.calendarTitle}>Study Activity</Text>
      <Text style={styles.calendarSubtitle}>{calendarActiveDays} days active in the last 7 weeks</Text>

      <View style={styles.calendarBody}>
        <View style={styles.calendarDayLabels}>
          <View style={styles.calendarMonthSpacer} />
          {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((label, index) => (
            <Text key={`label-${index}`} style={styles.calendarDayLabel}>
              {label}
            </Text>
          ))}
        </View>

        <View style={styles.calendarGrid}>
          {calendarColumns.map((week, weekIndex) => {
            const monthLabel = week.find((day) => day?.monthLabel)?.monthLabel ?? '';

            return (
              <View key={`week-${weekIndex}`} style={styles.calendarWeekColumn}>
                <Text style={styles.calendarMonthLabel}>{monthLabel}</Text>
                {week.map((day) => {
                  const intensity = day.count === 0 ? 0 : day.count === 1 ? 1 : day.count <= 3 ? 2 : 3;

                  return (
                    <View
                      key={day.date}
                      style={[
                        styles.calendarSquare,
                        { backgroundColor: calendarIntensityColors[intensity] },
                      ]}
                    />
                  );
                })}
              </View>
            );
          })}
        </View>
      </View>

      <View style={styles.calendarFooter}>
        <View style={styles.calendarLegend}>
          <Text style={styles.calendarLegendText}>Less</Text>
          {[0, 1, 2, 3].map((intensity) => (
            <View
              key={`legend-${intensity}`}
              style={[styles.calendarLegendSquare, { backgroundColor: calendarIntensityColors[intensity] }]}
            />
          ))}
          <Text style={styles.calendarLegendText}>More</Text>
        </View>
      </View>

      <View style={styles.streakRow}>
        <View style={styles.streakItem}>
          <Flame color="#FF6B6B" size={16} strokeWidth={2.2} />
          <Text style={styles.streakLabel}>Current: {currentStreak} {currentStreak === 1 ? 'day' : 'days'}</Text>
        </View>
        <View style={styles.streakItem}>
          <Star color={statsAccent} size={16} strokeWidth={2.2} />
          <Text style={styles.streakLabel}>Longest: {longestStreak} {longestStreak === 1 ? 'day' : 'days'}</Text>
        </View>
      </View>
    </View>
  );
}

export default memo(StatsStudyActivityCardComponent);
