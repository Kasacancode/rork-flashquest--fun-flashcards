import { BarChart3, Clock, Swords, TrendingUp, Zap } from 'lucide-react-native';
import React, { memo, useMemo } from 'react';
import { Text, View } from 'react-native';

import type { InsightStyles, InsightThemeColors } from '@/components/stats/insights/insightTypes';

interface RecapInsightsProps {
  weeklyRecap: {
    accuracy: number | null;
    comparedToLastWeek: string;
    lastWeekCards: number;
  };
  displaySessions: {
    study: number;
    quest: number;
    practice: number;
    arena: number;
  };
  formattedStudyTime: string;
  totalStudyTimeMs: number;
  colors: InsightThemeColors;
  styles: InsightStyles;
  isDark: boolean;
  onTryQuest?: () => void;
  onTryArena?: () => void;
}

function RecapInsights({
  weeklyRecap,
  displaySessions,
  formattedStudyTime,
  totalStudyTimeMs,
  colors,
  styles,
}: RecapInsightsProps) {
  const sessionSplitText = useMemo(() => {
    const total = displaySessions.study + displaySessions.quest + displaySessions.practice + displaySessions.arena;
    if (total <= 0) {
      return null;
    }

    const parts: string[] = [];

    if (displaySessions.study > 0) {
      parts.push(`${Math.round((displaySessions.study / total) * 100)}% Study`);
    }

    if (displaySessions.quest > 0) {
      parts.push(`${Math.round((displaySessions.quest / total) * 100)}% Quest`);
    }

    if (displaySessions.practice > 0) {
      parts.push(`${Math.round((displaySessions.practice / total) * 100)}% Practice`);
    }

    if (displaySessions.arena > 0) {
      parts.push(`${Math.round((displaySessions.arena / total) * 100)}% Arena`);
    }

    return `Session split: ${parts.join(', ')}.`;
  }, [displaySessions.arena, displaySessions.practice, displaySessions.quest, displaySessions.study]);

  return (
    <View style={styles.insightSection}>
      <View style={[styles.insightDivider, { backgroundColor: colors.border }]} />

      {sessionSplitText ? (
        <View style={styles.insightRow}>
          <BarChart3 color={colors.statsAccent} size={15} />
          <Text style={[styles.insightText, { color: colors.textSecondary }]}>{sessionSplitText}</Text>
        </View>
      ) : null}

      {weeklyRecap.accuracy !== null ? (
        <View style={styles.insightRow}>
          <TrendingUp color={weeklyRecap.comparedToLastWeek === 'better' ? colors.success : colors.textSecondary} size={15} />
          <Text style={[styles.insightText, { color: colors.textSecondary }]}>
            {weeklyRecap.comparedToLastWeek === 'better'
              ? `Up from ${weeklyRecap.lastWeekCards} cards last week. You're building momentum.`
              : weeklyRecap.comparedToLastWeek === 'worse'
                ? `Down from ${weeklyRecap.lastWeekCards} cards last week. Try setting a smaller daily goal to rebuild consistency.`
                : weeklyRecap.comparedToLastWeek === 'first_week'
                  ? 'This is your first tracked week. Come back next week to see your trend.'
                  : 'Same as last week. Push for one extra session to level up.'}
          </Text>
        </View>
      ) : null}

      {displaySessions.quest === 0 && displaySessions.study > 0 ? (
        <View style={styles.insightRow}>
          <Zap color={colors.warning} size={15} />
          <Text style={[styles.insightText, { color: colors.textSecondary }]}>You haven't tried Quest mode this week. It tests recall under pressure and earns more XP.</Text>
        </View>
      ) : displaySessions.arena === 0 && displaySessions.study + displaySessions.quest > 3 ? (
        <View style={styles.insightRow}>
          <Swords color={colors.warning} size={15} />
          <Text style={[styles.insightText, { color: colors.textSecondary }]}>Try Arena mode. Competing against others sharpens your recall speed.</Text>
        </View>
      ) : null}

      {formattedStudyTime !== '' ? (
        <View style={styles.insightRow}>
          <Clock color={colors.statsAccent} size={15} />
          <Text style={[styles.insightText, { color: colors.textSecondary }]}>
            {formattedStudyTime} total study time this week. {totalStudyTimeMs > 1800000 ? 'Great commitment.' : 'Even 5 more minutes a day adds up.'}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

export default memo(RecapInsights);
