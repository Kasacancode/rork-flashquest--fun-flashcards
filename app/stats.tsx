import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { ArrowLeft, Flame, Target, Zap, Swords, Calendar, Star, BookOpen } from 'lucide-react-native';
import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useArena } from '@/context/ArenaContext';
import { useFlashQuest } from '@/context/FlashQuestContext';
import { usePerformance } from '@/context/PerformanceContext';
import { useTheme } from '@/context/ThemeContext';
import type { Flashcard } from '@/types/flashcard';
import type { CardStats } from '@/types/performance';
import { computeLevel, computeLevelProgress, getLevelEntry } from '@/utils/levels';

type ThemeValues = ReturnType<typeof useTheme>['theme'];
type MasteryStage = 'new' | 'learning' | 'reviewing' | 'mastered';

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

function getCardMasteryStage(
  card: Flashcard,
  cardStatsById: Record<string, CardStats | undefined>,
): MasteryStage {
  const stats = cardStatsById[card.id];

  if (!stats || stats.attempts === 0) {
    return 'new';
  }

  if (stats.streakCorrect >= 5) {
    return 'mastered';
  }

  if (stats.streakCorrect >= 3) {
    return 'reviewing';
  }

  return 'learning';
}

function buildDeckMasterySummary(
  deck: { id: string; name: string; color: string; flashcards: Flashcard[] },
  cardStatsById: Record<string, CardStats | undefined>,
): DeckMasterySummary {
  const total = deck.flashcards.length;
  const mastered = deck.flashcards.reduce((count, card) => {
    return count + (getCardMasteryStage(card, cardStatsById) === 'mastered' ? 1 : 0);
  }, 0);

  return {
    id: deck.id,
    name: deck.name,
    color: deck.color,
    mastered,
    total,
    pct: total > 0 ? Math.round((mastered / total) * 100) : 0,
  };
}

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

  const level = useMemo(() => computeLevel(stats.totalScore), [stats.totalScore]);
  const levelEntry = useMemo(() => getLevelEntry(level), [level]);
  const levelProgress = useMemo(() => computeLevelProgress(stats.totalScore), [stats.totalScore]);

  const masteryOverview = useMemo(() => {
    const cardStatsById = performance.cardStatsById as Record<string, CardStats | undefined>;
    let totalCards = 0;
    let mastered = 0;
    let reviewing = 0;
    let learning = 0;
    let newCards = 0;

    for (const deck of decks) {
      for (const card of deck.flashcards) {
        totalCards += 1;
        const stage = getCardMasteryStage(card, cardStatsById);

        if (stage === 'mastered') {
          mastered += 1;
          continue;
        }

        if (stage === 'reviewing') {
          reviewing += 1;
          continue;
        }

        if (stage === 'learning') {
          learning += 1;
          continue;
        }

        newCards += 1;
      }
    }

    return { totalCards, mastered, reviewing, learning, newCards };
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

    const attempted = stats.totalQuestionsAttempted ?? 0;
    const correct = stats.totalCorrectAnswers ?? 0;
    const accuracy = attempted > 0 ? Math.round((correct / attempted) * 100) : null;

    return { thisWeekDays, comparison, accuracy };
  }, [
    stats.studyDates,
    stats.lastActiveDate,
    stats.totalQuestionsAttempted,
    stats.totalCorrectAnswers,
  ]);

  const totalSessions = useMemo(() => ({
    study: stats.totalStudySessions ?? 0,
    quest: stats.totalQuestSessions ?? 0,
    practice: stats.totalPracticeSessions ?? 0,
    arena: stats.totalArenaSessions ?? 0,
    total:
      (stats.totalStudySessions ?? 0)
      + (stats.totalQuestSessions ?? 0)
      + (stats.totalPracticeSessions ?? 0)
      + (stats.totalArenaSessions ?? 0),
  }), [
    stats.totalStudySessions,
    stats.totalQuestSessions,
    stats.totalPracticeSessions,
    stats.totalArenaSessions,
  ]);

  const formattedStudyTime = useMemo(() => {
    const ms = stats.totalStudyTimeMs ?? 0;
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

  const calendarColumns = useMemo(() => {
    return Array.from({ length: 7 }, (_, weekIndex) => {
      return calendarWithIntensity.slice(weekIndex * 7, weekIndex * 7 + 7);
    });
  }, [calendarWithIntensity]);

  const calendarActiveDays = useMemo(() => {
    return calendarWithIntensity.filter((day) => day.count > 0).length;
  }, [calendarWithIntensity]);

  const deckProgressSummaries = useMemo(() => {
    const cardStatsById = performance.cardStatsById as Record<string, CardStats | undefined>;
    return decks.map((deck) => buildDeckMasterySummary(deck, cardStatsById));
  }, [decks, performance.cardStatsById]);

  const backgroundGradient = useMemo(
    () => (
      isDark
        ? [theme.gradientStart, theme.gradientMid, theme.gradientEnd] as const
        : ['#FF6B6B', '#FF8E53', '#FFA07A'] as const
    ),
    [isDark, theme.gradientEnd, theme.gradientMid, theme.gradientStart],
  );

  const calendarIntensityColors = useMemo(
    () => (
      isDark
        ? [
            'rgba(255,255,255,0.04)',
            'rgba(139,92,246,0.3)',
            'rgba(139,92,246,0.55)',
            'rgba(139,92,246,0.85)',
          ] as const
        : [
            'rgba(0,0,0,0.05)',
            'rgba(102,126,234,0.3)',
            'rgba(102,126,234,0.55)',
            'rgba(102,126,234,0.85)',
          ] as const
    ),
    [isDark],
  );

  const styles = useMemo(() => createStyles(theme, isDark), [theme, isDark]);
  const headerContentColor = isDark ? theme.text : theme.white;

  return (
    <View style={styles.container} testID="stats-screen">
      <LinearGradient
        colors={backgroundGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {isDark ? (
        <LinearGradient
          colors={['rgba(6, 10, 22, 0.06)', 'rgba(6, 10, 22, 0.34)', 'rgba(5, 8, 20, 0.76)']}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.95, y: 1 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      ) : null}

      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
            testID="stats-back-button"
          >
            <ArrowLeft color={headerContentColor} size={28} strokeWidth={2.5} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: headerContentColor }]}>Your Stats</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          testID="stats-scroll-view"
        >
          <View style={styles.levelCard} testID="stats-score-card">
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
                {levelProgress.current} / {levelProgress.required} to Level {level + 1}
              </Text>
            </View>
          </View>

          <View style={styles.weeklyCard}>
            <View style={styles.weeklyHeader}>
              <Calendar color={theme.primary} size={20} strokeWidth={2.2} />
              <Text style={styles.weeklyTitle}>This Week</Text>
            </View>
            <View style={styles.weeklyStatsRow}>
              <View style={styles.weeklyStat}>
                <Text style={[styles.weeklyStatValue, { color: theme.primary }]}>
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
                <Text style={[styles.weeklyStatValue, { color: theme.primary }]}> 
                  {stats.currentStreak}
                </Text>
                <Text style={styles.weeklyStatLabel}>Day Streak</Text>
              </View>
              <View
                style={[
                  styles.weeklyDivider,
                  { backgroundColor: isDark ? 'rgba(148,163,184,0.14)' : '#e0e0e0' },
                ]}
              />
              <View style={styles.weeklyStat}>
                <Text
                  style={[styles.weeklyStatValue, { color: theme.primary }]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                >
                  {formattedStudyTime}
                </Text>
                <Text style={styles.weeklyStatLabel}>Study Time</Text>
              </View>
              {weeklySummary.accuracy !== null ? (
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
                            weeklySummary.accuracy >= 70
                              ? theme.success
                              : theme.warning,
                        },
                      ]}
                    >
                      {weeklySummary.accuracy}%
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
                <Text style={styles.streakLabel}>Current: {stats.currentStreak} days</Text>
              </View>
              <View style={styles.streakItem}>
                <Star color="#F59E0B" size={16} strokeWidth={2.2} />
                <Text style={styles.streakLabel}>Longest: {stats.longestStreak} days</Text>
              </View>
            </View>
          </View>

          <View style={styles.masteryCard}>
            <Text style={styles.sectionLabel}>MASTERY OVERVIEW</Text>
            <Text style={[styles.masteryBigText, { color: theme.primary }]}>
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
              <BookOpen color={theme.primary} size={18} strokeWidth={2.2} />
              <Text style={styles.perfLabel}>Study</Text>
              <Text style={styles.perfValue}>{totalSessions.study} sessions · {formattedStudyTime} total</Text>
            </View>
            <View style={styles.perfRow}>
              <Target color={theme.primary} size={18} strokeWidth={2.2} />
              <Text style={styles.perfLabel}>Quest</Text>
              <Text style={styles.perfValue}>
                {totalSessions.quest} sessions · {stats.totalQuestionsAttempted ?? 0} questions
                {weeklySummary.accuracy !== null ? ` · ${weeklySummary.accuracy}%` : ''}
                {performance.bestQuestStreak > 0 ? ` · ${performance.bestQuestStreak} best streak` : ''}
              </Text>
            </View>
            <View style={[styles.perfRow, !arenaStats ? styles.perfRowLast : null]}>
              <Swords color={theme.primary} size={18} strokeWidth={2.2} />
              <Text style={styles.perfLabel}>Practice</Text>
              <Text style={styles.perfValue}>{totalSessions.practice} sessions · {stats.totalCardsStudied} cards studied</Text>
            </View>
            {arenaStats ? (
              <View style={[styles.perfRow, styles.perfRowLast]}>
                <Zap color={theme.primary} size={18} strokeWidth={2.2} />
                <Text style={styles.perfLabel}>Arena</Text>
                <Text style={styles.perfValue}>
                  {totalSessions.arena} battles · {arenaStats.wins} wins · {arenaStats.winRate}% rate
                </Text>
              </View>
            ) : null}
          </View>

          {accuracyTrend.length >= 2 ? (
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
    </View>
  );
}

const createStyles = (theme: ThemeValues, isDark: boolean) => {
  const statSurface = isDark ? 'rgba(15, 23, 42, 0.78)' : theme.statsCard;
  const surfaceBorderColor = isDark ? 'rgba(148, 163, 184, 0.14)' : 'transparent';

  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    safeArea: {
      flex: 1,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingVertical: 16,
    },
    backButton: {
      width: 40,
      height: 40,
      justifyContent: 'center',
      alignItems: 'center',
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: '700' as const,
      color: theme.white,
    },
    placeholder: {
      width: 40,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      paddingBottom: 40,
    },

    levelCard: {
      marginHorizontal: 24,
      marginBottom: 20,
      borderRadius: 20,
      padding: 24,
      alignItems: 'center',
      backgroundColor: statSurface,
      borderWidth: isDark ? 1 : 0,
      borderColor: surfaceBorderColor,
    },
    levelBadge: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: theme.primary,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 12,
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
      fontWeight: '600' as const,
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
      backgroundColor: theme.primary,
    },
    levelBarLabel: {
      fontSize: 12,
      fontWeight: '600' as const,
      color: theme.textTertiary,
      textAlign: 'center',
      marginTop: 8,
    },

    weeklyCard: {
      marginHorizontal: 24,
      marginBottom: 20,
      borderRadius: 20,
      padding: 20,
      backgroundColor: statSurface,
      borderWidth: isDark ? 1 : 0,
      borderColor: surfaceBorderColor,
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
      marginBottom: 20,
      borderRadius: 20,
      padding: 20,
      backgroundColor: statSurface,
      borderWidth: isDark ? 1 : 0,
      borderColor: surfaceBorderColor,
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
      marginBottom: 20,
      borderRadius: 20,
      padding: 20,
      backgroundColor: statSurface,
      borderWidth: isDark ? 1 : 0,
      borderColor: surfaceBorderColor,
      alignItems: 'center',
    },
    sectionLabel: {
      fontSize: 12,
      fontWeight: '700' as const,
      color: theme.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
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
      marginBottom: 20,
      borderRadius: 20,
      padding: 20,
      backgroundColor: statSurface,
      borderWidth: isDark ? 1 : 0,
      borderColor: surfaceBorderColor,
    },
    perfRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 10,
      gap: 10,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? 'rgba(148,163,184,0.08)' : 'rgba(0,0,0,0.04)',
    },
    perfRowLast: {
      borderBottomWidth: 0,
      paddingBottom: 0,
    },
    perfLabel: {
      fontSize: 14,
      fontWeight: '700' as const,
      color: theme.text,
      width: 65,
    },
    perfValue: {
      fontSize: 13,
      fontWeight: '500' as const,
      color: theme.textSecondary,
      flex: 1,
    },

    trendCard: {
      marginHorizontal: 24,
      marginBottom: 20,
      borderRadius: 20,
      padding: 20,
      backgroundColor: statSurface,
      borderWidth: isDark ? 1 : 0,
      borderColor: surfaceBorderColor,
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
      backgroundColor: statSurface,
      borderRadius: 16,
      marginBottom: 10,
      overflow: 'hidden',
      borderWidth: isDark ? 1 : 0,
      borderColor: surfaceBorderColor,
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
