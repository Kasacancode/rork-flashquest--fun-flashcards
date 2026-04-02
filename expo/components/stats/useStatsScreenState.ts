import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';

import { useArena } from '@/context/ArenaContext';
import { useFlashQuest } from '@/context/FlashQuestContext';
import { usePerformance } from '@/context/PerformanceContext';
import { useTheme } from '@/context/ThemeContext';
import { computeLevel, computeLevelProgress, getLevelBandPalette, getLevelEntry } from '@/utils/levels';
import {
  formatStudyTime,
  getAccuracyTrend,
  getArenaStatsSummary,
  getDeckProgressStats,
  getDisplaySessions,
  getLifetimeAccuracy,
  getStatsCalendarColumns,
  getStatsCalendarDays,
  getWeeklyRecap,
  getWeeklySummary,
} from '@/utils/statsSelectors';

export function useStatsScreenState() {
  const router = useRouter();
  const { stats, decks } = useFlashQuest();
  const { performance } = usePerformance();
  const { leaderboard, playerName: savedPlayerName } = useArena();
  const { theme, isDark } = useTheme();
  const [showLevels, setShowLevels] = useState<boolean>(false);
  const statsAccent = isDark ? '#38bdf8' : '#2563eb';

  const level = useMemo(() => computeLevel(stats.totalScore), [stats.totalScore]);
  const levelEntry = useMemo(() => getLevelEntry(level), [level]);
  const levelProgress = useMemo(() => computeLevelProgress(stats.totalScore), [stats.totalScore]);
  const levelPalette = useMemo(() => getLevelBandPalette(level, isDark), [level, isDark]);
  const { masteryOverview, deckProgressSummaries } = useMemo(() => {
    return getDeckProgressStats(decks, performance.cardStatsById);
  }, [decks, performance.cardStatsById]);
  const arenaStats = useMemo(() => getArenaStatsSummary(leaderboard, savedPlayerName), [leaderboard, savedPlayerName]);
  const calendarWithIntensity = useMemo(() => getStatsCalendarDays(stats.studyDates ?? []), [stats.studyDates]);
  const weeklySummary = useMemo(() => getWeeklySummary(stats), [stats]);
  const weeklyRecap = useMemo(() => getWeeklyRecap(stats, performance.cardStatsById), [performance.cardStatsById, stats]);
  const lifetimeAccuracy = useMemo(() => getLifetimeAccuracy(stats), [stats]);
  const displaySessions = useMemo(() => getDisplaySessions(stats), [stats]);
  const formattedStudyTime = useMemo(() => formatStudyTime(stats.totalStudyTimeMs), [stats.totalStudyTimeMs]);
  const accuracyTrend = useMemo(() => getAccuracyTrend(stats), [stats]);
  const hasRealAccuracyData = useMemo(
    () => accuracyTrend.some((entry) => entry.accuracy !== null),
    [accuracyTrend],
  );
  const calendarColumns = useMemo(() => getStatsCalendarColumns(calendarWithIntensity), [calendarWithIntensity]);
  const calendarActiveDays = useMemo(
    () => calendarWithIntensity.filter((day) => day.count > 0).length,
    [calendarWithIntensity],
  );
  const backgroundGradient = useMemo(
    () => (isDark ? ['#09111f', '#11203a', '#0a1323'] as const : ['#f7fbff', '#e6efff', '#eef0ff'] as const),
    [isDark],
  );
  const upperAtmosphereGradient = useMemo(
    () => (
      isDark
        ? ['rgba(56, 189, 248, 0.18)', 'rgba(37, 99, 235, 0.08)', 'rgba(5, 8, 20, 0)'] as const
        : ['rgba(96, 165, 250, 0.3)', 'rgba(129, 140, 248, 0.16)', 'rgba(255, 255, 255, 0)'] as const
    ),
    [isDark],
  );
  const lowerAtmosphereGradient = useMemo(
    () => (
      isDark
        ? ['rgba(5, 8, 20, 0)', 'rgba(59, 130, 246, 0.08)', 'rgba(14, 165, 233, 0.16)'] as const
        : ['rgba(255, 255, 255, 0)', 'rgba(191, 219, 254, 0.16)', 'rgba(196, 181, 253, 0.18)'] as const
    ),
    [isDark],
  );
  const shellOverlayGradient = useMemo(
    () => (
      isDark
        ? ['rgba(6, 10, 22, 0.06)', 'rgba(6, 10, 22, 0.34)', 'rgba(5, 8, 20, 0.76)'] as const
        : ['rgba(255, 255, 255, 0.3)', 'rgba(241, 247, 255, 0.14)', 'rgba(237, 243, 255, 0.5)'] as const
    ),
    [isDark],
  );
  const calendarIntensityColors = useMemo(
    () => (
      isDark
        ? ['rgba(255,255,255,0.04)', 'rgba(56,189,248,0.2)', 'rgba(56,189,248,0.45)', 'rgba(56,189,248,0.75)'] as const
        : ['rgba(0,0,0,0.05)', 'rgba(14,165,233,0.2)', 'rgba(14,165,233,0.45)', 'rgba(14,165,233,0.75)'] as const
    ),
    [isDark],
  );
  const secondaryTextColor = isDark ? theme.textSecondary : '#4F6284';
  const headerContentColor = isDark ? '#F8FAFC' : '#173A71';
  const headerPillBorderColor = isDark ? 'rgba(148, 163, 184, 0.14)' : 'rgba(148, 163, 184, 0.16)';
  const trophyIconColor = isDark ? '#FCD34D' : '#B45309';
  const topGlowColor = isDark ? 'rgba(56, 189, 248, 0.15)' : 'rgba(96, 165, 250, 0.22)';
  const midGlowColor = isDark ? 'rgba(37, 99, 235, 0.1)' : 'rgba(125, 211, 252, 0.16)';
  const bottomGlowColor = isDark ? 'rgba(59, 130, 246, 0.1)' : 'rgba(196, 181, 253, 0.14)';

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  const handleOpenLevels = useCallback(() => {
    setShowLevels(true);
  }, []);

  const handleCloseLevels = useCallback(() => {
    setShowLevels(false);
  }, []);

  return {
    theme,
    isDark,
    stats,
    decks,
    performance,
    showLevels,
    statsAccent,
    level,
    levelEntry,
    levelProgress,
    levelPalette,
    masteryOverview,
    deckProgressSummaries,
    arenaStats,
    weeklySummary,
    weeklyRecap,
    lifetimeAccuracy,
    displaySessions,
    formattedStudyTime,
    accuracyTrend,
    hasRealAccuracyData,
    calendarColumns,
    calendarActiveDays,
    backgroundGradient,
    upperAtmosphereGradient,
    lowerAtmosphereGradient,
    shellOverlayGradient,
    calendarIntensityColors,
    secondaryTextColor,
    headerContentColor,
    headerPillBorderColor,
    trophyIconColor,
    topGlowColor,
    midGlowColor,
    bottomGlowColor,
    handleBack,
    handleOpenLevels,
    handleCloseLevels,
  };
}
