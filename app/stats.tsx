import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { ArrowLeft, Flame, Target, Zap, Swords, Calendar, Star, BookOpen } from 'lucide-react-native';
import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import LevelsModal from '@/components/profile/LevelsModal';
import { useArena } from '@/context/ArenaContext';
import { useFlashQuest } from '@/context/FlashQuestContext';
import { usePerformance } from '@/context/PerformanceContext';
import { useTheme } from '@/context/ThemeContext';
import { LEVELS, computeLevel, computeLevelProgress, getLevelEntry } from '@/utils/levels';
import { computeDeckMastery } from '@/utils/mastery';

type ThemeValues = ReturnType<typeof useTheme>['theme'];

type CalendarDayData = {
  date: string;
  count: number;
  dayOfWeek: number;
  monthLabel?: string;
};

type DeckMasterySummary = {
  id: string;
  name: string;
  color: string;
  mastered: number;
  total: number;
  pct: number;
};

function getIsoWeekString(date: Date): string {
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  normalized.setDate(normalized.getDate() + 3 - ((normalized.getDay() + 6) % 7));
  const week1 = new Date(normalized.getFullYear(), 0, 4);
  const weekNum = 1 + Math.round(
    ((normalized.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7,
  );

  return `${normalized.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

function getRecentWeekKeys(count: number): string[] {
  const keys: string[] = [];
  const today = new Date();

  for (let index = count - 1; index >= 0; index -= 1) {
    const date = new Date(today);
    date.setDate(date.getDate() - index * 7);
    keys.push(getIsoWeekString(date));
  }

  return keys;
}

export default function StatsPage() {
  const router = useRouter();
  const { stats, decks } = useFlashQuest();
  const { performance } = usePerformance();
  const { leaderboard, playerName: savedPlayerName } = useArena();
  const { theme, isDark } = useTheme();
  const [showLevels, setShowLevels] = useState<boolean>(false);
  const statsAccent = isDark ? '#38bdf8' : '#0ea5e9';

  const level = useMemo(() => computeLevel(stats.totalScore), [stats.totalScore]);
  const levelEntry = useMemo(() => getLevelEntry(level), [level]);
  const levelProgress = useMemo(() => computeLevelProgress(stats.totalScore), [stats.totalScore]);

  const masteryOverview = useMemo(() => {
    return decks.reduce((accumulator, deck) => {
      const mastery = computeDeckMastery(deck.flashcards, performance.cardStatsById);
      accumulator.totalCards += mastery.total;
      accumulator.mastered += mastery.mastered;
      accumulator.reviewing += mastery.reviewing;
      accumulator.learning += mastery.learning;
      accumulator.newCards += mastery.newCards;
      return accumulator;
    }, {
      totalCards: 0,
      mastered: 0,
      reviewing: 0,
      learning: 0,
      newCards: 0,
    });
  }, [decks, performance.cardStatsById]);

  const arenaStats = useMemo(() => {
    if (!savedPlayerName || leaderboard.length === 0) {
      return null;
    }

    const normalizedName = savedPlayerName.trim().toLowerCase();
    if (!normalizedName) {
      return null;
    }

    const wins = leaderboard.filter(
      (entry) => entry.winnerName.trim().toLowerCase() === normalizedName,
    ).length;
    const total = leaderboard.length;
    const winRate = total > 0 ? Math.round((wins / total) * 100) : 0;

    return { wins, total, winRate };
  }, [leaderboard, savedPlayerName]);

  const calendarWithIntensity = useMemo(() => {
    const today = new Date();
    const studyDates = stats.studyDates ?? [];
    const dateCount: Record<string, number> = {};

    for (const date of studyDates) {
      dateCount[date] = (dateCount[date] ?? 0) + 1;
    }

    const days: CalendarDayData[] = [];
    for (let i = 48; i >= 0; i -= 1) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateKey = date.toISOString().slice(0, 10);
      const dayOfWeek = date.getDay() === 0 ? 6 : date.getDay() - 1;
      const isFirstOfMonth = date.getDate() <= 7 && dayOfWeek === 0;

      days.push({
        date: dateKey,
        count: dateCount[dateKey] ?? 0,
        dayOfWeek,
        monthLabel: isFirstOfMonth
          ? date.toLocaleDateString('en-US', { month: 'short' })
          : undefined,
      });
    }

    return days;
  }, [stats.studyDates]);

  const weeklySummary = useMemo(() => {
    const studySet = new Set(stats.studyDates ?? []);
    const today = new Date();
    const todayKey = today.toISOString().slice(0, 10);

    if (stats.lastActiveDate === todayKey) {
      studySet.add(todayKey);
    }

    const dayOfWeek = today.getDay();
    const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

    let thisWeekDays = 0;
    for (let i = 0; i <= mondayOffset; i += 1) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      if (studySet.has(date.toISOString().slice(0, 10))) {
        thisWeekDays += 1;
      }
    }

    if (stats.currentStreak > 0 && thisWeekDays === 0) {
      thisWeekDays = 1;
    }

    let lastWeekDays = 0;
    for (let i = mondayOffset + 1; i <= mondayOffset + 7; i += 1) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      if (studySet.has(date.toISOString().slice(0, 10))) {
        lastWeekDays += 1;
      }
    }

    let comparison: string;
    if (thisWeekDays > lastWeekDays) {
      comparison = `${thisWeekDays - lastWeekDays} more than last week`;
    } else if (thisWeekDays < lastWeekDays) {
      comparison = `${lastWeekDays - thisWeekDays} fewer than last week`;
    } else {
      comparison = lastWeekDays === 0 ? 'Start your week strong!' : 'Same as last week';
    }

    const currentWeekAccuracy = (() => {
      const weekly = stats.weeklyAccuracy ?? [];
      if (weekly.length === 0) {
        return null;
      }

      const weekKey = getIsoWeekString(today);
      const entry = weekly.find((item) => item.week === weekKey);
      if (!entry || entry.attempted === 0) {
        return null;
      }

      return Math.round((entry.correct / entry.attempted) * 100);
    })();

    return { thisWeekDays, comparison, currentWeekAccuracy };
  }, [
    stats.studyDates,
    stats.lastActiveDate,
    stats.weeklyAccuracy,
    stats.currentStreak,
  ]);

  const lifetimeAccuracy = useMemo(() => {
    const attempted = stats.totalQuestionsAttempted ?? 0;
    const correct = stats.totalCorrectAnswers ?? 0;
    return attempted > 0 ? Math.round((correct / attempted) * 100) : null;
  }, [stats.totalQuestionsAttempted, stats.totalCorrectAnswers]);

  const displaySessions = useMemo(() => {
    const study = stats.totalStudySessions ?? 0;
    const quest = stats.totalQuestSessions ?? 0;
    const practice = stats.totalPracticeSessions ?? 0;
    const arena = stats.totalArenaSessions ?? 0;

    const hasPreTrackingData = (study + quest + practice + arena) === 0 && stats.totalCardsStudied > 0;

    if (hasPreTrackingData) {
      const estimatedStudy = stats.studyDates?.length ?? 0;
      const estimatedQuest = (stats.totalQuestionsAttempted ?? 0) > 0
        ? Math.max(1, Math.round((stats.totalQuestionsAttempted ?? 0) / 10))
        : 0;

      return {
        study: estimatedStudy,
        quest: estimatedQuest,
        practice: 0,
        arena: 0,
        estimated: true,
      };
    }

    return { study, quest, practice, arena, estimated: false };
  }, [stats]);

  const formattedStudyTime = useMemo(() => {
    const ms = stats.totalStudyTimeMs ?? 0;
    if (ms < 30000) {
      return '—';
    }

    const minutes = Math.floor(ms / 60000);

    if (minutes < 60) {
      return `${minutes}m`;
    }

    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
  }, [stats.totalStudyTimeMs]);

  const accuracyTrend = useMemo(() => {
    const weekly = stats.weeklyAccuracy ?? [];
    const weeklyMap = new Map(weekly.map((entry) => [entry.week, entry]));

    return getRecentWeekKeys(4).map((week) => {
      const entry = weeklyMap.get(week);
      return {
        week,
        accuracy: entry && entry.attempted > 0 ? Math.round((entry.correct / entry.attempted) * 100) : null,
      };
    });
  }, [stats.weeklyAccuracy]);

  const hasRealAccuracyData = useMemo(
    () => accuracyTrend.some((entry) => entry.accuracy !== null),
    [accuracyTrend],
  );

  const calendarColumns = useMemo(() => {
    return Array.from({ length: 7 }, (_, weekIndex) => {
      return calendarWithIntensity.slice(weekIndex * 7, weekIndex * 7 + 7);
    });
  }, [calendarWithIntensity]);

  const calendarActiveDays = useMemo(() => {
    return calendarWithIntensity.filter((day) => day.count > 0).length;
  }, [calendarWithIntensity]);

  const deckProgressSummaries = useMemo(() => {
    return decks.map((deck) => {
      const mastery = computeDeckMastery(deck.flashcards, performance.cardStatsById);
      return {
        id: deck.id,
        name: deck.name,
        color: deck.color,
        mastered: mastery.mastered,
        total: mastery.total,
        pct: mastery.total > 0 ? Math.round((mastery.mastered / mastery.total) * 100) : 0,
      } satisfies DeckMasterySummary;
    });
  }, [decks, performance.cardStatsById]);

  const backgroundGradient = useMemo(
    () => (
      isDark
        ? ['#09111f', '#11203a', '#0a1323'] as const
        : ['#fafcff', '#eef4ff', '#f9f7ff'] as const
    ),
    [isDark],
  );

  const calendarIntensityColors = useMemo(
    () => (
      isDark
        ? [
            'rgba(255,255,255,0.04)',
            'rgba(56,189,248,0.2)',
            'rgba(56,189,248,0.45)',
            'rgba(56,189,248,0.75)',
          ] as const
        : [
            'rgba(0,0,0,0.05)',
            'rgba(14,165,233,0.2)',
            'rgba(14,165,233,0.45)',
            'rgba(14,165,233,0.75)',
          ] as const
    ),
    [isDark],
  );

  const styles = useMemo(() => createStyles(theme, isDark), [theme, isDark]);
  const levelModalStyles = useMemo(() => createLevelModalStyles(theme, isDark), [theme, isDark]);
  const headerContentColor = isDark ? '#F8FAFC' : '#2D2A61';
  const topGlowColor = isDark ? 'rgba(56, 189, 248, 0.15)' : 'rgba(125, 211, 252, 0.18)';
  const bottomGlowColor = isDark ? 'rgba(59, 130, 246, 0.1)' : 'rgba(99, 102, 241, 0.1)';

  const handleOpenLevels = useCallback(() => {
    setShowLevels(true);
  }, []);

  const handleCloseLevels = useCallback(() => {
    setShowLevels(false);
  }, []);

  return (
    <View style={styles.container} testID="stats-screen">
      <LinearGradient
        colors={backgroundGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={
          isDark
            ? ['rgba(6, 10, 22, 0.06)', 'rgba(6, 10, 22, 0.34)', 'rgba(5, 8, 20, 0.76)']
            : ['rgba(255, 255, 255, 0.24)', 'rgba(239, 246, 255, 0.16)', 'rgba(248, 250, 252, 0.62)']
        }
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.95, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <View pointerEvents="none" style={[styles.topGlow, { backgroundColor: topGlowColor }]} />
      <View pointerEvents="none" style={[styles.bottomGlow, { backgroundColor: bottomGlowColor }]} />

      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
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
                borderColor: isDark ? 'rgba(148, 163, 184, 0.14)' : 'rgba(148, 163, 184, 0.16)',
              },
            ]}
          >
            <Text style={[styles.headerTitle, { color: headerContentColor }]}>Your Stats</Text>
          </View>
          <View style={styles.placeholder} />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          testID="stats-scroll-view"
        >
          <TouchableOpacity
            style={styles.levelCard}
            onPress={handleOpenLevels}
            activeOpacity={0.92}
            testID="stats-score-card"
          >
            <LinearGradient
              colors={
                isDark
                  ? ['rgba(56, 189, 248, 0.18)', 'rgba(9, 17, 33, 0.98)']
                  : ['rgba(255, 255, 255, 0.94)', 'rgba(229, 241, 255, 0.92)']
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <View style={[styles.levelOrb, { backgroundColor: isDark ? 'rgba(56, 189, 248, 0.2)' : 'rgba(125, 211, 252, 0.2)' }]} />
            <Text style={styles.levelEyebrow}>Progression</Text>
            <View style={styles.levelBadge}>
              <Text style={styles.levelBadgeText}>{level}</Text>
            </View>
            <Text style={styles.levelTitle}>{levelEntry.title}</Text>
            <Text style={styles.levelXpText}>{stats.totalScore.toLocaleString()} XP</Text>
            <View style={styles.levelBarContainer}>
              <View style={styles.levelBarTrack}>
                <View
                  style={[
                    styles.levelBarFill,
                    { width: `${Math.round(levelProgress.percent * 100)}%` },
                  ]}
                />
              </View>
              <Text style={styles.levelBarLabel}>
                {level >= 20
                  ? 'Max Level Reached!'
                  : `${levelProgress.current} / ${levelProgress.required} to Level ${level + 1}`}
              </Text>
            </View>
            <Text style={styles.levelHint}>Tap to view all levels</Text>
          </TouchableOpacity>

          <View style={styles.weeklyCard}>
            <View style={styles.weeklyHeader}>
              <Calendar color={statsAccent} size={20} strokeWidth={2.2} />
              <Text style={styles.weeklyTitle}>This Week</Text>
            </View>
            <View style={styles.weeklyStatsRow}>
              <View style={styles.weeklyStat}>
                <Text style={[styles.weeklyStatValue, { color: statsAccent }]}>
                  {weeklySummary.thisWeekDays}
                </Text>
                <Text style={styles.weeklyStatLabel}>Days Active</Text>
              </View>
              <View
                style={[
                  styles.weeklyDivider,
                  { backgroundColor: isDark ? 'rgba(148,163,184,0.14)' : '#e0e0e0' },
                ]}
              />
              <View style={styles.weeklyStat}>
                <Text style={[styles.weeklyStatValue, { color: statsAccent }]}>
                  {stats.currentStreak}
                </Text>
                <Text style={styles.weeklyStatLabel}>Day Streak</Text>
              </View>
              {formattedStudyTime !== '—' ? (
                <>
                  <View
                    style={[
                      styles.weeklyDivider,
                      { backgroundColor: isDark ? 'rgba(148,163,184,0.14)' : '#e0e0e0' },
                    ]}
                  />
                  <View style={styles.weeklyStat}>
                    <Text
                      style={[styles.weeklyStatValue, { color: statsAccent }]}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                    >
                      {formattedStudyTime}
                    </Text>
                    <Text style={styles.weeklyStatLabel}>Study Time</Text>
                  </View>
                </>
              ) : null}
              {weeklySummary.currentWeekAccuracy !== null ? (
                <>
                  <View
                    style={[
                      styles.weeklyDivider,
                      { backgroundColor: isDark ? 'rgba(148,163,184,0.14)' : '#e0e0e0' },
                    ]}
                  />
                  <View style={styles.weeklyStat}>
                    <Text
                      style={[
                        styles.weeklyStatValue,
                        {
                          color:
                            weeklySummary.currentWeekAccuracy >= 70
                              ? theme.success
                              : theme.warning,
                        },
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

          <View style={styles.calendarCard} testID="stats-study-activity">
            <Text style={styles.calendarTitle}>Study Activity</Text>
            <Text style={styles.calendarSubtitle}>
              {calendarActiveDays} days active in the last 7 weeks
            </Text>

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
                    style={[
                      styles.calendarLegendSquare,
                      { backgroundColor: calendarIntensityColors[intensity] },
                    ]}
                  />
                ))}
                <Text style={styles.calendarLegendText}>More</Text>
              </View>
            </View>

            <View style={styles.streakRow}>
              <View style={styles.streakItem}>
                <Flame color="#FF6B6B" size={16} strokeWidth={2.2} />
                <Text style={styles.streakLabel}>
                  Current: {stats.currentStreak} {stats.currentStreak === 1 ? 'day' : 'days'}
                </Text>
              </View>
              <View style={styles.streakItem}>
                <Star color={statsAccent} size={16} strokeWidth={2.2} />
                <Text style={styles.streakLabel}>
                  Longest: {stats.longestStreak} {stats.longestStreak === 1 ? 'day' : 'days'}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.masteryCard}>
            <Text style={styles.sectionLabel}>MASTERY OVERVIEW</Text>
            <Text style={[styles.masteryBigText, { color: statsAccent }]}>
              {masteryOverview.mastered}/{masteryOverview.totalCards}
            </Text>
            <Text style={styles.masterySubtext}>
              cards mastered across {decks.length} decks
            </Text>
            <View
              style={[
                styles.masteryBar,
                {
                  backgroundColor: isDark
                    ? 'rgba(255,255,255,0.06)'
                    : 'rgba(0,0,0,0.06)',
                },
              ]}
            >
              {masteryOverview.mastered > 0 ? (
                <View
                  style={{
                    width: `${(masteryOverview.mastered / Math.max(masteryOverview.totalCards, 1)) * 100}%`,
                    height: '100%',
                    backgroundColor: '#10B981',
                    borderRadius: 4,
                  }}
                />
              ) : null}
              {masteryOverview.reviewing > 0 ? (
                <View
                  style={{
                    width: `${(masteryOverview.reviewing / Math.max(masteryOverview.totalCards, 1)) * 100}%`,
                    height: '100%',
                    backgroundColor: '#3B82F6',
                  }}
                />
              ) : null}
              {masteryOverview.learning > 0 ? (
                <View
                  style={{
                    width: `${(masteryOverview.learning / Math.max(masteryOverview.totalCards, 1)) * 100}%`,
                    height: '100%',
                    backgroundColor: '#F59E0B',
                  }}
                />
              ) : null}
            </View>
            <View style={styles.masteryLegend}>
              <Text style={styles.masteryLegendItem}>
                <Text style={{ color: '#10B981' }}>●</Text> {masteryOverview.mastered} mastered
              </Text>
              <Text style={styles.masteryLegendItem}>
                <Text style={{ color: '#3B82F6' }}>●</Text> {masteryOverview.reviewing} reviewing
              </Text>
              <Text style={styles.masteryLegendItem}>
                <Text style={{ color: '#F59E0B' }}>●</Text> {masteryOverview.learning} learning
              </Text>
              <Text style={styles.masteryLegendItem}>
                <Text style={{ color: isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.2)' }}>●</Text>{' '}
                {masteryOverview.newCards} new
              </Text>
            </View>
          </View>

          <View style={styles.performanceCard}>
            <Text style={styles.sectionLabel}>PERFORMANCE</Text>
            <View style={styles.perfRow}>
              <View style={styles.perfIconWrap}>
                <BookOpen color={statsAccent} size={18} strokeWidth={2.2} />
              </View>
              <View style={styles.perfContent}>
                <Text style={styles.perfLabel}>Study</Text>
                <Text style={styles.perfValue}>
                  {displaySessions.study} sessions{formattedStudyTime !== '—' ? ` · ${formattedStudyTime} total` : ''}
                </Text>
              </View>
            </View>
            <View style={styles.perfRow}>
              <View style={styles.perfIconWrap}>
                <Target color={statsAccent} size={18} strokeWidth={2.2} />
              </View>
              <View style={styles.perfContent}>
                <Text style={styles.perfLabel}>Quest</Text>
                <Text style={styles.perfValue}>
                  {displaySessions.quest} sessions · {stats.totalQuestionsAttempted ?? 0} questions
                </Text>
                {lifetimeAccuracy !== null ? (
                  <Text style={styles.perfDetail}>
                    {lifetimeAccuracy}% accuracy
                    {performance.bestQuestStreak > 0 ? ` · ${performance.bestQuestStreak} best streak` : ''}
                  </Text>
                ) : null}
              </View>
            </View>
            <View style={[styles.perfRow, !arenaStats ? styles.perfRowLast : null]}>
              <View style={styles.perfIconWrap}>
                <Swords color={statsAccent} size={18} strokeWidth={2.2} />
              </View>
              <View style={styles.perfContent}>
                <Text style={styles.perfLabel}>Practice</Text>
                <Text style={styles.perfValue}>{displaySessions.practice} sessions · {stats.totalCardsStudied} cards</Text>
              </View>
            </View>
            {arenaStats ? (
              <View style={[styles.perfRow, styles.perfRowLast]}>
                <View style={styles.perfIconWrap}>
                  <Zap color={statsAccent} size={18} strokeWidth={2.2} />
                </View>
                <View style={styles.perfContent}>
                  <Text style={styles.perfLabel}>Arena</Text>
                  <Text style={styles.perfValue}>
                    {displaySessions.arena || arenaStats.total} battles · {arenaStats.wins} wins · {arenaStats.winRate}% rate
                  </Text>
                </View>
              </View>
            ) : null}
          </View>

          {accuracyTrend.length >= 2 && hasRealAccuracyData ? (
            <View style={styles.trendCard}>
              <Text style={styles.sectionLabel}>ACCURACY TREND</Text>
              <View style={styles.trendRow}>
                {accuracyTrend.map((entry) => {
                  const label = entry.week.replace(/^\d{4}-W/, 'W');
                  const pct = entry.accuracy;
                  return (
                    <View key={entry.week} style={styles.trendColumn}>
                      <View style={styles.trendBarContainer}>
                        {pct !== null ? (
                          <View
                            style={[
                              styles.trendBar,
                              {
                                height: `${pct}%`,
                                backgroundColor: pct >= 70 ? theme.success : theme.warning,
                              },
                            ]}
                          />
                        ) : null}
                      </View>
                      <Text style={styles.trendPct}>{pct !== null ? `${pct}%` : '–'}</Text>
                      <Text style={styles.trendWeek}>{label}</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          ) : null}

          <View style={styles.deckProgressSection}>
            <Text style={styles.sectionLabel}>DECK PROGRESS</Text>
            {deckProgressSummaries.length === 0 ? (
              <View style={styles.emptyState} testID="stats-empty-progress">
                <Text style={styles.emptyText}>Create a deck to start tracking progress!</Text>
              </View>
            ) : (
              deckProgressSummaries.map((deckSummary) => (
                <View
                  key={deckSummary.id}
                  style={styles.deckProgressCard}
                  testID={`progress-card-${deckSummary.id}`}
                >
                  <View style={[styles.deckIndicator, { backgroundColor: deckSummary.color }]} />
                  <View style={styles.deckProgressInfo}>
                    <View style={styles.deckProgressHeader}>
                      <Text style={styles.deckProgressName} numberOfLines={1}>
                        {deckSummary.name}
                      </Text>
                      <Text
                        style={[
                          styles.deckProgressPct,
                          {
                            color:
                              deckSummary.pct === 100
                                ? '#10B981'
                                : theme.textSecondary,
                          },
                        ]}
                      >
                        {deckSummary.pct === 100
                          ? '100%'
                          : `${deckSummary.mastered}/${deckSummary.total}`}
                      </Text>
                    </View>
                    <View style={styles.deckProgressBarTrack}>
                      <View
                        style={[
                          styles.deckProgressBarFill,
                          {
                            width: `${deckSummary.pct}%`,
                            backgroundColor: deckSummary.color,
                          },
                        ]}
                      />
                    </View>
                  </View>
                </View>
              ))
            )}
          </View>
        </ScrollView>
      </SafeAreaView>

      <LevelsModal
        visible={showLevels}
        level={level}
        levelEntry={levelEntry}
        levels={LEVELS}
        onClose={handleCloseLevels}
        styles={levelModalStyles}
        theme={theme}
      />
    </View>
  );
}

const createStyles = (theme: ThemeValues, isDark: boolean) => {
  const statSurface = isDark ? 'rgba(9, 18, 35, 0.84)' : 'rgba(255, 255, 255, 0.84)';
  const surfaceBorderColor = isDark ? 'rgba(148, 163, 184, 0.12)' : 'rgba(148, 163, 184, 0.16)';
  const statsAccent = isDark ? '#38bdf8' : '#0284c7';
  const accentTint = isDark ? 'rgba(56, 189, 248, 0.1)' : 'rgba(14, 165, 233, 0.1)';
  const accentBorder = isDark ? 'rgba(56, 189, 248, 0.18)' : 'rgba(125, 211, 252, 0.26)';
  const deepSurface = isDark ? 'rgba(7, 15, 31, 0.92)' : 'rgba(247, 250, 255, 0.9)';
  const cardSurface = isDark ? 'rgba(11, 20, 37, 0.84)' : 'rgba(255, 255, 255, 0.88)';

  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    topGlow: {
      position: 'absolute',
      top: -96,
      right: -44,
      width: 240,
      height: 240,
      borderRadius: 120,
    },
    bottomGlow: {
      position: 'absolute',
      bottom: 140,
      left: -70,
      width: 260,
      height: 260,
      borderRadius: 130,
    },
    safeArea: {
      flex: 1,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingVertical: 14,
    },
    backButton: {
      width: 46,
      height: 46,
      borderRadius: 16,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
    },
    headerTitleWrap: {
      paddingHorizontal: 18,
      paddingVertical: 12,
      borderRadius: 18,
      borderWidth: 1,
    },
    headerTitle: {
      fontSize: 22,
      fontWeight: '800' as const,
      color: theme.white,
      letterSpacing: -0.5,
    },
    placeholder: {
      width: 46,
      height: 46,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      paddingBottom: 40,
      gap: 2,
    },

    levelCard: {
      marginHorizontal: 24,
      marginBottom: 18,
      borderRadius: 28,
      padding: 26,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: cardSurface,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: accentBorder,
      shadowColor: isDark ? '#38bdf8' : '#93c5fd',
      shadowOffset: { width: 0, height: 16 },
      shadowOpacity: isDark ? 0.26 : 0.14,
      shadowRadius: isDark ? 28 : 20,
      elevation: isDark ? 10 : 5,
    },
    levelOrb: {
      position: 'absolute',
      top: -54,
      width: 180,
      height: 180,
      borderRadius: 90,
    },
    levelEyebrow: {
      fontSize: 11,
      fontWeight: '800' as const,
      color: theme.textTertiary,
      letterSpacing: 1,
      textTransform: 'uppercase' as const,
      marginBottom: 12,
    },
    levelBadge: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: statsAccent,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 12,
      shadowColor: statsAccent,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 6,
    },
    levelBadgeText: {
      fontSize: 24,
      fontWeight: '800' as const,
      color: '#fff',
    },
    levelTitle: {
      fontSize: 18,
      fontWeight: '700' as const,
      color: theme.text,
      marginBottom: 4,
      textAlign: 'center',
    },
    levelXpText: {
      fontSize: 14,
      fontWeight: '700' as const,
      color: theme.textSecondary,
      marginBottom: 16,
    },
    levelBarContainer: {
      width: '100%',
    },
    levelBarTrack: {
      height: 8,
      borderRadius: 4,
      backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
      overflow: 'hidden',
    },
    levelBarFill: {
      height: '100%',
      borderRadius: 4,
      backgroundColor: statsAccent,
    },
    levelBarLabel: {
      fontSize: 12,
      fontWeight: '700' as const,
      color: theme.textTertiary,
      textAlign: 'center',
      marginTop: 10,
    },
    levelHint: {
      fontSize: 12,
      fontWeight: '700' as const,
      color: statsAccent,
      marginTop: 14,
    },

    weeklyCard: {
      marginHorizontal: 24,
      marginBottom: 18,
      borderRadius: 24,
      padding: 22,
      backgroundColor: deepSurface,
      borderWidth: 1,
      borderColor: surfaceBorderColor,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: isDark ? 0.14 : 0.06,
      shadowRadius: isDark ? 18 : 12,
      elevation: isDark ? 6 : 3,
    },
    weeklyHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 16,
    },
    weeklyTitle: {
      fontSize: 16,
      fontWeight: '700' as const,
      color: theme.text,
    },
    weeklyStatsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
    },
    weeklyStat: {
      flex: 1,
      alignItems: 'center',
    },
    weeklyStatValue: {
      fontSize: 28,
      fontWeight: '800' as const,
    },
    weeklyStatLabel: {
      fontSize: 12,
      fontWeight: '600' as const,
      color: theme.textSecondary,
      marginTop: 4,
    },
    weeklyDivider: {
      width: 1,
      height: 36,
    },
    weeklyComparison: {
      fontSize: 13,
      fontWeight: '600' as const,
      color: theme.textTertiary,
      textAlign: 'center',
      marginTop: 14,
    },

    calendarCard: {
      marginHorizontal: 24,
      marginBottom: 18,
      borderRadius: 24,
      padding: 22,
      backgroundColor: deepSurface,
      borderWidth: 1,
      borderColor: surfaceBorderColor,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: isDark ? 0.16 : 0.06,
      shadowRadius: isDark ? 18 : 12,
      elevation: isDark ? 6 : 3,
    },
    calendarTitle: {
      fontSize: 16,
      fontWeight: '700' as const,
      color: theme.text,
      marginBottom: 4,
    },
    calendarSubtitle: {
      fontSize: 13,
      fontWeight: '500' as const,
      color: theme.textSecondary,
      marginBottom: 16,
    },
    calendarBody: {
      flexDirection: 'row',
      gap: 10,
      alignItems: 'flex-start',
    },
    calendarGrid: {
      flex: 1,
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 4,
    },
    calendarWeekColumn: {
      flex: 1,
      gap: 4,
      alignItems: 'center',
    },
    calendarMonthSpacer: {
      height: 12,
      marginBottom: 4,
    },
    calendarMonthLabel: {
      fontSize: 10,
      fontWeight: '600' as const,
      color: theme.textTertiary,
      height: 12,
      lineHeight: 12,
      marginBottom: 4,
      textAlign: 'center',
      minWidth: 20,
    },
    calendarSquare: {
      width: 14,
      height: 14,
      borderRadius: 3,
      backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.05)',
    },
    calendarFooter: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      alignItems: 'center',
      marginTop: 12,
    },
    calendarDayLabels: {
      gap: 4,
    },
    calendarDayLabel: {
      fontSize: 10,
      fontWeight: '600' as const,
      color: theme.textTertiary,
      height: 14,
      lineHeight: 14,
    },
    calendarLegend: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    calendarLegendSquare: {
      width: 10,
      height: 10,
      borderRadius: 2,
    },
    calendarLegendText: {
      fontSize: 10,
      fontWeight: '500' as const,
      color: theme.textTertiary,
    },
    streakRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 24,
      marginTop: 16,
      paddingTop: 14,
      borderTopWidth: 1,
      borderTopColor: isDark ? 'rgba(148,163,184,0.1)' : 'rgba(0,0,0,0.06)',
      flexWrap: 'wrap',
    },
    streakItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    streakLabel: {
      fontSize: 13,
      fontWeight: '600' as const,
      color: theme.textSecondary,
    },

    masteryCard: {
      marginHorizontal: 24,
      marginBottom: 18,
      borderRadius: 24,
      padding: 22,
      backgroundColor: cardSurface,
      borderWidth: 1,
      borderColor: surfaceBorderColor,
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: isDark ? 0.14 : 0.06,
      shadowRadius: isDark ? 18 : 12,
      elevation: isDark ? 6 : 3,
    },
    sectionLabel: {
      fontSize: 12,
      fontWeight: '700' as const,
      color: theme.textTertiary,
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginBottom: 12,
      alignSelf: 'flex-start',
    },
    masteryBigText: {
      fontSize: 36,
      fontWeight: '800' as const,
    },
    masterySubtext: {
      fontSize: 13,
      fontWeight: '600' as const,
      color: theme.textSecondary,
      marginTop: 4,
      marginBottom: 16,
      textAlign: 'center',
    },
    masteryBar: {
      height: 8,
      borderRadius: 4,
      flexDirection: 'row',
      overflow: 'hidden',
      width: '100%',
      marginBottom: 12,
    },
    masteryLegend: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
      justifyContent: 'center',
    },
    masteryLegendItem: {
      fontSize: 12,
      fontWeight: '600' as const,
      color: theme.textSecondary,
    },

    performanceCard: {
      marginHorizontal: 24,
      marginBottom: 18,
      borderRadius: 24,
      padding: 22,
      backgroundColor: cardSurface,
      borderWidth: 1,
      borderColor: surfaceBorderColor,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: isDark ? 0.14 : 0.06,
      shadowRadius: isDark ? 18 : 12,
      elevation: isDark ? 6 : 3,
    },
    perfRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      paddingVertical: 12,
      gap: 10,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? 'rgba(148,163,184,0.08)' : 'rgba(0,0,0,0.04)',
    },
    perfRowLast: {
      borderBottomWidth: 0,
      paddingBottom: 0,
    },
    perfIconWrap: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: accentTint,
      justifyContent: 'center',
      alignItems: 'center',
    },
    perfContent: {
      flex: 1,
    },
    perfLabel: {
      fontSize: 15,
      fontWeight: '700' as const,
      color: theme.text,
      marginBottom: 2,
    },
    perfValue: {
      fontSize: 13,
      fontWeight: '500' as const,
      color: theme.textSecondary,
      flex: 1,
    },
    perfDetail: {
      fontSize: 12,
      fontWeight: '500' as const,
      color: theme.textTertiary,
      marginTop: 2,
    },

    trendCard: {
      marginHorizontal: 24,
      marginBottom: 18,
      borderRadius: 24,
      padding: 22,
      backgroundColor: cardSurface,
      borderWidth: 1,
      borderColor: surfaceBorderColor,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: isDark ? 0.14 : 0.06,
      shadowRadius: isDark ? 18 : 12,
      elevation: isDark ? 6 : 3,
    },
    trendRow: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      alignItems: 'flex-end',
      height: 100,
      gap: 8,
    },
    trendColumn: {
      flex: 1,
      alignItems: 'center',
    },
    trendBarContainer: {
      width: '100%',
      height: 60,
      justifyContent: 'flex-end',
      alignItems: 'center',
    },
    trendBar: {
      width: '60%',
      borderRadius: 4,
      minHeight: 4,
    },
    trendPct: {
      fontSize: 12,
      fontWeight: '700' as const,
      color: theme.text,
      marginTop: 6,
    },
    trendWeek: {
      fontSize: 10,
      fontWeight: '500' as const,
      color: theme.textTertiary,
      marginTop: 2,
    },

    deckProgressSection: {
      marginHorizontal: 24,
      marginBottom: 20,
    },
    deckProgressCard: {
      flexDirection: 'row',
      backgroundColor: cardSurface,
      borderRadius: 20,
      marginBottom: 10,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: surfaceBorderColor,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: isDark ? 0.12 : 0.04,
      shadowRadius: 12,
      elevation: isDark ? 4 : 2,
    },
    deckIndicator: {
      width: 4,
    },
    deckProgressInfo: {
      flex: 1,
      padding: 14,
      paddingLeft: 12,
    },
    deckProgressHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    deckProgressName: {
      fontSize: 15,
      fontWeight: '700' as const,
      color: theme.text,
      flex: 1,
      marginRight: 8,
    },
    deckProgressPct: {
      fontSize: 14,
      fontWeight: '700' as const,
    },
    deckProgressBarTrack: {
      height: 6,
      borderRadius: 3,
      backgroundColor: isDark ? 'rgba(148,163,184,0.14)' : theme.border,
      overflow: 'hidden',
    },
    deckProgressBarFill: {
      height: '100%',
      borderRadius: 3,
    },

    emptyState: {
      borderRadius: 16,
      padding: 24,
      backgroundColor: statSurface,
      alignItems: 'center',
      borderWidth: isDark ? 1 : 0,
      borderColor: surfaceBorderColor,
    },
    emptyText: {
      fontSize: 14,
      fontWeight: '600' as const,
      color: theme.textSecondary,
      textAlign: 'center',
    },
  });
};

const createLevelModalStyles = (theme: ThemeValues, isDark: boolean) => {
  return StyleSheet.create({
    levelModalOverlay: {
      flex: 1,
      justifyContent: 'center',
      paddingHorizontal: 20,
      backgroundColor: theme.modalOverlay,
    },
    levelModalCard: {
      borderRadius: 28,
      padding: 18,
      maxHeight: '78%',
      gap: 16,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 14 },
      shadowOpacity: 0.24,
      shadowRadius: 22,
      elevation: 12,
    },
    levelModalHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 12,
    },
    levelModalTitleWrap: {
      flex: 1,
      gap: 4,
    },
    levelModalEyebrow: {
      fontSize: 11,
      fontWeight: '700' as const,
      color: theme.textTertiary,
      textTransform: 'uppercase' as const,
      letterSpacing: 0.9,
    },
    levelModalTitle: {
      fontSize: 24,
      fontWeight: '800' as const,
      color: theme.text,
      letterSpacing: -0.6,
    },
    levelModalSubtitle: {
      fontSize: 13,
      fontWeight: '500' as const,
      color: theme.textSecondary,
      lineHeight: 18,
    },
    settingsCloseButton: {
      width: 42,
      height: 42,
      borderRadius: 14,
      backgroundColor: isDark ? 'rgba(148, 163, 184, 0.12)' : 'rgba(15, 23, 42, 0.05)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    settingsCloseText: {
      fontSize: 22,
      fontWeight: '500' as const,
      color: theme.textSecondary,
      lineHeight: 24,
    },
    levelList: {
      gap: 10,
      paddingBottom: 4,
    },
    levelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 14,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(148, 163, 184, 0.12)' : 'rgba(15, 23, 42, 0.08)',
      backgroundColor: isDark ? 'rgba(15, 23, 42, 0.46)' : 'rgba(15, 23, 42, 0.03)',
    },
    levelRowCurrent: {
      borderColor: theme.primary,
      backgroundColor: isDark ? 'rgba(99, 102, 241, 0.16)' : 'rgba(102, 126, 234, 0.1)',
    },
    levelRowReached: {
      borderColor: isDark ? 'rgba(16, 185, 129, 0.22)' : 'rgba(16, 185, 129, 0.14)',
    },
    levelBadge: {
      minWidth: 58,
      paddingHorizontal: 10,
      paddingVertical: 9,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? 'rgba(148, 163, 184, 0.12)' : 'rgba(15, 23, 42, 0.06)',
    },
    levelBadgeReached: {
      backgroundColor: isDark ? 'rgba(16, 185, 129, 0.14)' : 'rgba(16, 185, 129, 0.1)',
    },
    levelBadgeText: {
      fontSize: 12,
      fontWeight: '800' as const,
      color: theme.textSecondary,
      textTransform: 'uppercase' as const,
      letterSpacing: 0.4,
    },
    levelBadgeTextCurrent: {
      color: '#fff',
    },
    levelRowTextWrap: {
      flex: 1,
      gap: 2,
    },
    levelRowTitle: {
      fontSize: 15,
      fontWeight: '800' as const,
      color: theme.text,
    },
    levelRowSubtitle: {
      fontSize: 12,
      fontWeight: '500' as const,
      color: theme.textSecondary,
      lineHeight: 17,
    },
    levelRowMeta: {
      fontSize: 11,
      fontWeight: '700' as const,
      color: theme.textTertiary,
      letterSpacing: 0.3,
      textTransform: 'uppercase' as const,
    },
    levelReachedPill: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: '#10B981',
      justifyContent: 'center',
      alignItems: 'center',
    },
  });
};
