import { BookOpen, ChevronRight, Flame, Target, TrendingUp } from 'lucide-react-native';
import React, { memo } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import type { InsightStyles, InsightThemeColors } from '@/components/stats/insights/insightTypes';

interface GoalInsightsProps {
  currentStreak: number;
  dailyGoalProgress: number;
  dailyGoalTarget: number;
  colors: InsightThemeColors;
  styles: InsightStyles;
  isDark: boolean;
  onStudy: () => void;
}

function GoalInsights({
  currentStreak,
  dailyGoalProgress,
  dailyGoalTarget,
  colors,
  styles,
  isDark,
  onStudy,
}: GoalInsightsProps) {
  return (
    <View style={styles.insightSection}>
      <View style={[styles.insightDivider, { backgroundColor: colors.border }]} />
      <View style={styles.insightRow}>
        <Flame color={colors.warning} size={15} />
        <Text style={[styles.insightText, { color: colors.textSecondary }]}>
          {currentStreak > 0
            ? `${currentStreak}-day streak. Study tomorrow to keep it going.`
            : 'Start a streak today. Study a few cards to begin.'}
        </Text>
      </View>

      {dailyGoalProgress >= dailyGoalTarget && dailyGoalProgress > dailyGoalTarget * 2 ? (
        <View style={styles.insightRow}>
          <TrendingUp color={colors.success} size={15} />
          <Text style={[styles.insightText, { color: colors.textSecondary }]}>
            You hit {dailyGoalProgress} cards today, well over your goal of {dailyGoalTarget}. Consider raising your daily goal.
          </Text>
        </View>
      ) : dailyGoalProgress < dailyGoalTarget && dailyGoalProgress > 0 ? (
        <View style={styles.insightRow}>
          <Target color={colors.statsAccent} size={15} />
          <Text style={[styles.insightText, { color: colors.textSecondary }]}>
            {dailyGoalTarget - dailyGoalProgress} more cards to hit your goal. A quick study session will get you there.
          </Text>
        </View>
      ) : dailyGoalProgress === 0 ? (
        <View style={styles.insightRow}>
          <BookOpen color={colors.statsAccent} size={15} />
          <Text style={[styles.insightText, { color: colors.textSecondary }]}>
            You haven't studied yet today. Even 5 cards makes a difference.
          </Text>
        </View>
      ) : null}

      <TouchableOpacity
        style={[styles.insightAction, { backgroundColor: isDark ? 'rgba(99,102,241,0.1)' : 'rgba(99,102,241,0.06)' }]}
        onPress={onStudy}
        activeOpacity={0.8}
        testID="stats-goal-insight-action"
      >
        <Text style={[styles.insightActionText, { color: colors.statsAccent }]}>
          {dailyGoalProgress >= dailyGoalTarget ? 'Keep studying' : 'Start studying'}
        </Text>
        <ChevronRight color={colors.statsAccent} size={14} />
      </TouchableOpacity>
    </View>
  );
}

export default memo(GoalInsights);
