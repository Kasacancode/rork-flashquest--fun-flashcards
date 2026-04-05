import { BarChart3, CheckCircle, ChevronRight, Star } from 'lucide-react-native';
import React, { memo, useMemo } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import type { InsightStyles, InsightThemeColors } from '@/components/stats/insights/insightTypes';
import { computeLevel, computeLevelProgress } from '@/utils/levels';

interface PerformanceInsightsProps {
  totalScore: number;
  displaySessions: {
    study: number;
    quest: number;
    practice: number;
    arena: number;
  };
  lifetimeAccuracy: number | null;
  colors: InsightThemeColors;
  styles: InsightStyles;
  isDark: boolean;
  onTryQuest: () => void;
  onTryArena: () => void;
}

function PerformanceInsights({
  totalScore,
  displaySessions,
  lifetimeAccuracy,
  colors,
  styles,
  isDark,
  onTryQuest,
  onTryArena,
}: PerformanceInsightsProps) {
  const level = useMemo(() => computeLevel(totalScore), [totalScore]);
  const levelProgress = useMemo(() => computeLevelProgress(totalScore), [totalScore]);
  const dominantModeText = useMemo(() => {
    const total = displaySessions.study + displaySessions.quest + displaySessions.practice + displaySessions.arena;
    if (total === 0) {
      return null;
    }

    const modes = [
      { name: 'Study', count: displaySessions.study },
      { name: 'Quest', count: displaySessions.quest },
      { name: 'Practice', count: displaySessions.practice },
      { name: 'Arena', count: displaySessions.arena },
    ].sort((a, b) => b.count - a.count);
    const top = modes[0]!;
    const topPct = Math.round((top.count / total) * 100);

    if (topPct >= 80) {
      return `${top.name} mode dominates at ${topPct}% of sessions. Mixing in other modes improves retention.`;
    }

    if (topPct >= 50) {
      return `${top.name} is your go-to mode (${topPct}%). A healthy balance across modes.`;
    }

    return `Sessions are well-distributed. ${top.name} leads slightly at ${topPct}%.`;
  }, [displaySessions.arena, displaySessions.practice, displaySessions.quest, displaySessions.study]);

  return (
    <View style={styles.insightSection}>
      <View style={[styles.insightDivider, { backgroundColor: colors.border }]} />

      <View style={styles.insightRow}>
        <Star color={colors.warning} size={15} />
        <Text style={[styles.insightText, { color: colors.textSecondary }]}> 
          {totalScore.toLocaleString()} total XP. Level {level}. {levelProgress.percent >= 1 ? 'Max level reached.' : `${(levelProgress.required - levelProgress.current).toLocaleString()} XP to next level.`}
        </Text>
      </View>

      {dominantModeText ? (
        <View style={styles.insightRow}>
          <BarChart3 color={colors.statsAccent} size={15} />
          <Text style={[styles.insightText, { color: colors.textSecondary }]}>{dominantModeText}</Text>
        </View>
      ) : null}

      {lifetimeAccuracy !== null ? (
        <View style={styles.insightRow}>
          <CheckCircle color={lifetimeAccuracy >= 80 ? colors.success : colors.warning} size={15} />
          <Text style={[styles.insightText, { color: colors.textSecondary }]}>
            {lifetimeAccuracy >= 90
              ? `${lifetimeAccuracy}% lifetime accuracy. Exceptional recall across all modes.`
              : lifetimeAccuracy >= 75
                ? `${lifetimeAccuracy}% lifetime accuracy. Strong, with room to tighten up on weak cards.`
                : `${lifetimeAccuracy}% lifetime accuracy. Focus on reviewing weak cards before adding new ones.`}
          </Text>
        </View>
      ) : null}

      {displaySessions.quest === 0 && displaySessions.study > 0 ? (
        <TouchableOpacity
          style={[styles.insightAction, { backgroundColor: isDark ? 'rgba(99,102,241,0.1)' : 'rgba(99,102,241,0.06)' }]}
          onPress={onTryQuest}
          activeOpacity={0.8}
          testID="stats-performance-quest-action"
        >
          <Text style={[styles.insightActionText, { color: colors.statsAccent }]}>Try Quest Mode</Text>
          <ChevronRight color={colors.statsAccent} size={14} />
        </TouchableOpacity>
      ) : displaySessions.arena === 0 && displaySessions.study + displaySessions.quest > 5 ? (
        <TouchableOpacity
          style={[styles.insightAction, { backgroundColor: isDark ? 'rgba(99,102,241,0.1)' : 'rgba(99,102,241,0.06)' }]}
          onPress={onTryArena}
          activeOpacity={0.8}
          testID="stats-performance-arena-action"
        >
          <Text style={[styles.insightActionText, { color: colors.statsAccent }]}>Try Arena Mode</Text>
          <ChevronRight color={colors.statsAccent} size={14} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

export default memo(PerformanceInsights);
