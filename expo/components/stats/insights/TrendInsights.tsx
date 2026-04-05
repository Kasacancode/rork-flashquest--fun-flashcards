import React, { memo } from 'react';
import { Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';

import type { InsightStyles, InsightThemeColors } from '@/components/stats/insights/insightTypes';

interface TrendInsightsProps {
  accuracyTrend: Array<{
    week: string;
    accuracy: number | null;
  }>;
  colors: InsightThemeColors;
  styles: InsightStyles & {
    trendWeekRow: StyleProp<ViewStyle>;
    trendWeekLabel: StyleProp<TextStyle>;
    trendWeekRight: StyleProp<ViewStyle>;
    trendWeekBar: StyleProp<ViewStyle>;
    trendWeekPct: StyleProp<TextStyle>;
  };
}

function TrendInsights({ accuracyTrend, colors, styles }: TrendInsightsProps) {
  return (
    <View style={styles.insightSection}>
      <View style={[styles.insightDivider, { backgroundColor: colors.border }]} />

      {accuracyTrend.map((entry, index) => {
        const weekLabel = index === 0 ? 'This week' : index === 1 ? 'Last week' : `${index} weeks ago`;

        return (
          <View key={entry.week} style={styles.trendWeekRow}>
            <Text style={[styles.trendWeekLabel, { color: colors.textSecondary }]}>{weekLabel}</Text>
            {entry.accuracy !== null ? (
              <View style={styles.trendWeekRight}>
                <View
                  style={[
                    styles.trendWeekBar,
                    {
                      width: `${entry.accuracy}%`,
                      backgroundColor: entry.accuracy >= 80 ? colors.success : entry.accuracy >= 60 ? colors.warning : colors.error,
                    },
                  ]}
                />
                <Text style={[styles.trendWeekPct, { color: colors.text }]}>{entry.accuracy}%</Text>
              </View>
            ) : (
              <Text style={[styles.trendWeekPct, { color: colors.textTertiary }]}>No data</Text>
            )}
          </View>
        );
      })}
    </View>
  );
}

export default memo(TrendInsights);
