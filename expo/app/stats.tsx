import { useFocusEffect, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { AlertCircle, Award, BarChart3, BookOpen, Calendar, CheckCircle, ChevronDown, ChevronRight, Clock, Flame, Star, Swords, Target, TrendingUp, Zap } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { LayoutAnimation, Platform, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, UIManager, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import { useQueryClient } from '@tanstack/react-query';

import ResponsiveContainer from '@/components/ResponsiveContainer';
import StatsRankEmblem from '@/components/StatsRankEmblem';
import LevelsModal from '@/components/profile/LevelsModal';
import StatsDeckProgressList from '@/components/stats/StatsDeckProgressList';
import StatsHeader from '@/components/stats/StatsHeader';
import StatsScreenBackground from '@/components/stats/StatsScreenBackground';
import { useStatsScreenState } from '@/components/stats/useStatsScreenState';
import type { Theme } from '@/constants/colors';
import { getDailyGoalTarget, getDailyProgress } from '@/utils/dailyGoal';
import { LEVELS } from '@/utils/levels';
import { computeDeckMastery, type MasteryBreakdown } from '@/utils/mastery';
import { deckHubHref, LEADERBOARD_ROUTE, studyHref } from '@/utils/routes';

type ThemeValues = Theme;
type ExpandableStatsPanel = 'goal' | 'week' | 'recap' | 'activity' | 'mastery' | 'performance' | 'trend' | 'deckProgress';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function StatsPage() {
  const {
    theme,
    isDark,
    stats,
    decks,
    performance,
    getCardsDueForReview,
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
  } = useStatsScreenState();

  const router = useRouter();
  const queryClient = useQueryClient();
  const styles = useMemo(() => createStyles(theme, isDark), [theme, isDark]);
  const levelModalStyles = useMemo(() => createLevelModalStyles(theme, isDark), [theme, isDark]);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [dailyGoalTarget, setDailyGoalTarget] = useState<number>(15);
  const [dailyGoalProgress, setDailyGoalProgress] = useState<number>(0);
  const [expandedPanel, setExpandedPanel] = useState<ExpandableStatsPanel | null>(null);
  const cardSurface = isDark ? 'rgba(11, 20, 37, 0.84)' : 'rgba(255, 255, 255, 0.9)';
  const cardBorderColor = isDark ? 'rgba(148, 163, 184, 0.12)' : 'rgba(148, 163, 184, 0.18)';
  const dailyGoalPercent = Math.min(Math.round((dailyGoalProgress / Math.max(dailyGoalTarget, 1)) * 100), 100);
  const dailyGoalCircumference = Math.PI * 100;

  const loadDailyGoalState = useCallback(async () => {
    try {
      const [target, progress] = await Promise.all([getDailyGoalTarget(), getDailyProgress()]);
      setDailyGoalTarget(target);
      setDailyGoalProgress(progress.count);
    } catch {
    }
  }, []);

  useEffect(() => {
    void loadDailyGoalState();
  }, [loadDailyGoalState]);

  useFocusEffect(
    useCallback(() => {
      void loadDailyGoalState();
    }, [loadDailyGoalState]),
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        queryClient.refetchQueries(),
        loadDailyGoalState(),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [loadDailyGoalState, queryClient]);

  const handleOpenLeaderboard = useCallback(() => {
    router.push(LEADERBOARD_ROUTE);
  }, [router]);

  const currentDateKey = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const weekInsightData = useMemo(() => {
    const referenceDate = new Date();
    const dayOfWeek = referenceDate.getDay();
    const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const todayTime = referenceDate.getTime();
    const activeDates = new Set<string>(stats.studyDates ?? []);

    if (stats.lastActiveDate) {
      activeDates.add(stats.lastActiveDate);
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
  }, [currentDateKey, stats.lastActiveDate, stats.studyDates]);

  const studyPatternInsight = useMemo(() => {
    const dates = stats.studyDates ?? [];
    if (dates.length < 3) {
      return null;
    }

    const dayCounts = [0, 0, 0, 0, 0, 0, 0];
    for (const dateStr of dates) {
      const day = new Date(dateStr).getDay();
      dayCounts[day] += 1;
    }

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const maxDay = dayCounts.indexOf(Math.max(...dayCounts));
    const weekdayTotal = dayCounts[1] + dayCounts[2] + dayCounts[3] + dayCounts[4] + dayCounts[5];
    const weekendTotal = dayCounts[0] + dayCounts[6];
    const totalDays = dates.length;

    const mostActiveDay = dayNames[maxDay] ?? 'Monday';
    const isWeekdayFocused = weekdayTotal > weekendTotal * 2;
    const isWeekendFocused = weekendTotal > weekdayTotal;

    const pattern = isWeekdayFocused
      ? 'You study mostly on weekdays. Weekend sessions could boost retention.'
      : isWeekendFocused
        ? 'You lean toward weekends. Adding one weekday session would smooth your rhythm.'
        : 'Good balance between weekdays and weekends.';

    const weekCounts = new Map<string, number>();
    for (const dateStr of dates) {
      const d = new Date(dateStr);
      const weekStart = new Date(d);
      weekStart.setDate(d.getDate() - ((d.getDay() + 6) % 7));
      const key = weekStart.toISOString().slice(0, 10);
      weekCounts.set(key, (weekCounts.get(key) ?? 0) + 1);
    }

    let bestWeekDays = 0;
    for (const count of weekCounts.values()) {
      if (count > bestWeekDays) {
        bestWeekDays = count;
      }
    }

    return { mostActiveDay, pattern, bestWeekDays, totalDays };
  }, [stats.studyDates]);

  const accuracyTrendContext = useMemo(() => {
    const recentEntries = [...accuracyTrend].reverse();
    const populatedEntries = recentEntries.filter((entry) => entry.accuracy !== null);

    return {
      recentEntries,
      current: populatedEntries[0] ?? null,
      previous: populatedEntries[1] ?? null,
    };
  }, [accuracyTrend]);

  const deckMasteryDetails = useMemo(() => {
    const nextMap = new Map<string, MasteryBreakdown>();

    for (const deck of decks) {
      nextMap.set(deck.id, computeDeckMastery(deck.flashcards, performance.cardStatsById));
    }

    return nextMap;
  }, [decks, performance.cardStatsById]);

  const deckDueCounts = useMemo(() => {
    const nextMap = new Map<string, number>();

    for (const deck of decks) {
      nextMap.set(deck.id, getCardsDueForReview(deck.id, deck.flashcards).length);
    }

    return nextMap;
  }, [decks, getCardsDueForReview]);

  const deckProgressOverview = useMemo(() => {
    const trackedDecks = deckProgressSummaries.length;
    const totalMastered = deckProgressSummaries.reduce((sum, deck) => sum + deck.mastered, 0);
    const totalCards = deckProgressSummaries.reduce((sum, deck) => sum + deck.total, 0);

    return {
      trackedDecks,
      totalMastered,
      totalCards,
    };
  }, [deckProgressSummaries]);

  const togglePanel = useCallback((panel: ExpandableStatsPanel) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedPanel((prev) => (prev === panel ? null : panel));
  }, []);

  return (
    <View style={styles.container} testID="stats-screen">
      <StatsScreenBackground
        backgroundGradient={backgroundGradient}
        upperAtmosphereGradient={upperAtmosphereGradient}
        lowerAtmosphereGradient={lowerAtmosphereGradient}
        shellOverlayGradient={shellOverlayGradient}
        topGlowColor={topGlowColor}
        midGlowColor={midGlowColor}
        bottomGlowColor={bottomGlowColor}
        styles={styles}
      />

      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <StatsHeader
          isDark={isDark}
          headerContentColor={headerContentColor}
          headerPillBorderColor={headerPillBorderColor}
          trophyIconColor={trophyIconColor}
          styles={styles}
          onBack={handleBack}
          onLeaderboard={handleOpenLeaderboard}
        />

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={isDark ? 'rgba(255,255,255,0.7)' : theme.primary}
              colors={[theme.primary]}
            />
          }
          testID="stats-scroll-view"
        >
          <ResponsiveContainer>
            <TouchableOpacity
            style={[
              styles.levelCard,
              {
                borderColor: levelPalette.badgeBorder,
                shadowColor: levelPalette.badgeShadow,
              },
            ]}
            onPress={handleOpenLevels}
            activeOpacity={0.92}
            testID="stats-score-card"
          >
            <LinearGradient
              colors={levelPalette.heroGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <LinearGradient
              colors={['rgba(255, 255, 255, 0)', levelPalette.heroEdgeTint]}
              start={{ x: 0.12, y: 0.2 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <View style={[styles.levelOrb, { backgroundColor: levelPalette.haloColor }]} />
            <Text style={styles.levelEyebrow}>Progression</Text>
            <StatsRankEmblem
              level={level}
              palette={levelPalette}
              isDark={isDark}
              size="hero"
              style={styles.levelBadge}
              testID="stats-rank-emblem"
            />
            <Text
              style={styles.levelTitle}
              numberOfLines={2}
              adjustsFontSizeToFit
              minimumFontScale={0.86}
            >
              {levelEntry.title}
            </Text>
            <Text style={styles.levelXpText}>{stats.totalScore.toLocaleString()} XP</Text>
            <View style={styles.levelBarContainer}>
              <View style={[styles.levelBarTrack, { backgroundColor: levelPalette.progressTrack }] }>
                <LinearGradient
                  colors={levelPalette.progressGradient}
                  start={{ x: 0, y: 0.5 }}
                  end={{ x: 1, y: 0.5 }}
                  style={[
                    styles.levelBarFill,
                    {
                      width: `${Math.round(levelProgress.percent * 100)}%`,
                      shadowColor: levelPalette.progressGlow,
                    },
                  ]}
                />
              </View>
              <Text style={styles.levelBarLabel}>
                {level >= 20
                  ? 'Max Level Reached!'
                  : `${levelProgress.current} / ${levelProgress.required} to Level ${level + 1}`}
              </Text>
            </View>
            <Text style={[styles.levelHint, { color: levelPalette.band === 'elite' ? '#6D28D9' : undefined }]}>
              Tap to view the rank ladder
            </Text>
          </TouchableOpacity>

          <View style={[styles.dailyGoalCard, { backgroundColor: cardSurface, borderColor: cardBorderColor }]}> 
            <TouchableOpacity
              style={styles.expandableCardButton}
              onPress={() => togglePanel('goal')}
              activeOpacity={0.92}
              accessible={true}
              accessibilityRole="button"
              accessibilityState={{ expanded: expandedPanel === 'goal' }}
              accessibilityLabel={`Today's study goal: ${dailyGoalProgress} of ${dailyGoalTarget} cards. ${dailyGoalProgress >= dailyGoalTarget ? 'Goal reached.' : `${dailyGoalTarget - dailyGoalProgress} remaining.`}`}
              testID="stats-goal-card-toggle"
            >
            <View style={styles.dailyGoalHeader}>
              <Target color={statsAccent} size={20} strokeWidth={2.2} />
              <Text style={[styles.dailyGoalTitle, { color: theme.text }]}>Today's Goal</Text>
              <Text style={[styles.dailyGoalFraction, { color: theme.textSecondary }]}>
                {dailyGoalProgress} / {dailyGoalTarget}
              </Text>
              <View
                style={[
                  styles.cardChevron,
                  { transform: [{ rotate: expandedPanel === 'goal' ? '180deg' : '0deg' }] },
                ]}
              >
                <ChevronDown color={theme.textTertiary} size={16} strokeWidth={2} />
              </View>
            </View>

            <View style={styles.dailyGoalRingContainer}>
              <Svg width={120} height={120} viewBox="0 0 120 120">
                <Circle
                  cx={60}
                  cy={60}
                  r={50}
                  fill="none"
                  stroke={isDark ? 'rgba(148,163,184,0.12)' : 'rgba(0,0,0,0.06)'}
                  strokeWidth={10}
                />
                <Circle
                  cx={60}
                  cy={60}
                  r={50}
                  fill="none"
                  stroke={dailyGoalProgress >= dailyGoalTarget ? theme.success : statsAccent}
                  strokeWidth={10}
                  strokeLinecap="round"
                  strokeDasharray={`${dailyGoalCircumference}`}
                  strokeDashoffset={`${dailyGoalCircumference * (1 - Math.min(dailyGoalProgress / Math.max(dailyGoalTarget, 1), 1))}`}
                  transform="rotate(-90 60 60)"
                />
              </Svg>
              <View style={styles.dailyGoalRingCenter}>
                <Text style={[styles.dailyGoalPercent, { color: dailyGoalProgress >= dailyGoalTarget ? theme.success : statsAccent }]}>
                  {dailyGoalPercent}%
                </Text>
                <Text style={[styles.dailyGoalSubtext, { color: theme.textSecondary }]}> 
                  {dailyGoalProgress >= dailyGoalTarget ? 'Goal reached!' : 'cards studied'}
                </Text>
              </View>
            </View>
            </TouchableOpacity>

            {expandedPanel === 'goal' ? (
              <View style={styles.insightSection}>
                <View style={[styles.insightDivider, { backgroundColor: theme.border }]} />
                <View style={styles.insightRow}>
                  <Flame color={theme.warning} size={15} />
                  <Text style={[styles.insightText, { color: theme.textSecondary }]}> 
                    {stats.currentStreak > 0
                      ? `${stats.currentStreak}-day streak. Study tomorrow to keep it going.`
                      : 'Start a streak today. Study a few cards to begin.'}
                  </Text>
                </View>

                {dailyGoalProgress >= dailyGoalTarget && dailyGoalProgress > dailyGoalTarget * 2 ? (
                  <View style={styles.insightRow}>
                    <TrendingUp color={theme.success} size={15} />
                    <Text style={[styles.insightText, { color: theme.textSecondary }]}> 
                      You hit {dailyGoalProgress} cards today, well over your goal of {dailyGoalTarget}. Consider raising your daily goal.
                    </Text>
                  </View>
                ) : dailyGoalProgress < dailyGoalTarget && dailyGoalProgress > 0 ? (
                  <View style={styles.insightRow}>
                    <Target color={statsAccent} size={15} />
                    <Text style={[styles.insightText, { color: theme.textSecondary }]}> 
                      {dailyGoalTarget - dailyGoalProgress} more cards to hit your goal. A quick study session will get you there.
                    </Text>
                  </View>
                ) : dailyGoalProgress === 0 ? (
                  <View style={styles.insightRow}>
                    <BookOpen color={statsAccent} size={15} />
                    <Text style={[styles.insightText, { color: theme.textSecondary }]}> 
                      You haven't studied yet today. Even 5 cards makes a difference.
                    </Text>
                  </View>
                ) : null}

                <TouchableOpacity
                  style={[styles.insightAction, { backgroundColor: isDark ? 'rgba(99,102,241,0.1)' : 'rgba(99,102,241,0.06)' }]}
                  onPress={() => router.push('/study')}
                  activeOpacity={0.8}
                  testID="stats-goal-insight-action"
                >
                  <Text style={[styles.insightActionText, { color: statsAccent }]}> 
                    {dailyGoalProgress >= dailyGoalTarget ? 'Keep studying' : 'Start studying'}
                  </Text>
                  <ChevronRight color={statsAccent} size={14} />
                </TouchableOpacity>
              </View>
            ) : null}
          </View>

          <View style={styles.weeklyCard}>
            <TouchableOpacity
              style={styles.expandableCardButton}
              onPress={() => togglePanel('week')}
              activeOpacity={0.92}
              accessibilityRole="button"
              accessibilityState={{ expanded: expandedPanel === 'week' }}
              testID="stats-week-card-toggle"
            >
            <View style={styles.weeklyHeader}>
              <Calendar color={statsAccent} size={20} strokeWidth={2.2} />
              <Text style={[styles.weeklyTitle, styles.expandableCardTitle]}>This Week</Text>
              <View
                style={[
                  styles.cardChevron,
                  { transform: [{ rotate: expandedPanel === 'week' ? '180deg' : '0deg' }] },
                ]}
              >
                <ChevronDown color={theme.textTertiary} size={16} strokeWidth={2} />
              </View>
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
              {formattedStudyTime !== '' ? (
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
            </TouchableOpacity>

            {expandedPanel === 'week' ? (
              <View style={styles.insightSection}>
                <View style={[styles.insightDivider, { backgroundColor: theme.border }]} />
                <View style={styles.weekDayRow}>
                  {weekInsightData.map((day) => (
                    <View key={day.key} style={styles.weekDayItem}>
                      <Text style={[styles.weekDayLabel, { color: theme.textTertiary }]}>{day.label}</Text>
                      <View
                        style={[
                          styles.weekDayDot,
                          {
                            backgroundColor: day.isFuture
                              ? 'transparent'
                              : day.isActive
                                ? theme.success
                                : (isDark ? 'rgba(148,163,184,0.15)' : 'rgba(0,0,0,0.06)'),
                            borderWidth: day.isToday ? 2 : 0,
                            borderColor: day.isToday ? statsAccent : 'transparent',
                          },
                        ]}
                      />
                    </View>
                  ))}
                </View>

                {weeklySummary.currentWeekAccuracy !== null ? (
                  <View style={styles.insightRow}>
                    <Target color={weeklySummary.currentWeekAccuracy >= 80 ? theme.success : theme.warning} size={15} />
                    <Text style={[styles.insightText, { color: theme.textSecondary }]}> 
                      {weeklySummary.currentWeekAccuracy >= 90
                        ? `${weeklySummary.currentWeekAccuracy}% accuracy. You're retaining almost everything.`
                        : weeklySummary.currentWeekAccuracy >= 70
                          ? `${weeklySummary.currentWeekAccuracy}% accuracy. Solid, but reviewing weak cards could push it higher.`
                          : `${weeklySummary.currentWeekAccuracy}% accuracy. Try focusing on fewer decks and reviewing weak cards.`}
                    </Text>
                  </View>
                ) : null}

                <View style={styles.insightRow}>
                  <Calendar color={statsAccent} size={15} />
                  <Text style={[styles.insightText, { color: theme.textSecondary }]}> 
                    {weeklySummary.thisWeekDays >= 5
                      ? 'Exceptional consistency. Keep this rhythm and watch your recall improve.'
                      : weeklySummary.thisWeekDays >= 3
                        ? `${weeklySummary.thisWeekDays} days this week. Try for one more day to build a stronger habit.`
                        : weeklySummary.thisWeekDays >= 1
                          ? `Only ${weeklySummary.thisWeekDays} day this week. Aim for at least 3 days for better retention.`
                          : 'No study days yet this week. Start today and build momentum.'}
                  </Text>
                </View>
              </View>
            ) : null}
          </View>

          {weeklyRecap.cardsStudied > 0 ? (
            <View style={[styles.recapCard, { backgroundColor: cardSurface, borderColor: cardBorderColor }]}> 
              <TouchableOpacity
                style={styles.expandableCardButton}
                onPress={() => togglePanel('recap')}
                activeOpacity={0.92}
                accessible={true}
                accessibilityRole="button"
                accessibilityState={{ expanded: expandedPanel === 'recap' }}
                accessibilityLabel={`Weekly recap: ${weeklyRecap.cardsStudied} cards studied, ${weeklyRecap.daysActive} days active${weeklyRecap.accuracy !== null ? `, ${Math.round(weeklyRecap.accuracy * 100)}% accuracy` : ''}`}
                testID="stats-recap-card-toggle"
              >
              <View style={styles.recapHeader}>
                <TrendingUp color={statsAccent} size={20} strokeWidth={2.2} />
                <Text style={[styles.recapTitle, styles.expandableCardTitle, { color: theme.text }]}>Weekly Recap</Text>
                <View
                  style={[
                    styles.cardChevron,
                    { transform: [{ rotate: expandedPanel === 'recap' ? '180deg' : '0deg' }] },
                  ]}
                >
                  <ChevronDown color={theme.textTertiary} size={16} strokeWidth={2} />
                </View>
              </View>

              <View style={styles.recapGrid}>
                <View style={styles.recapStat}>
                  <Text style={[styles.recapStatValue, { color: statsAccent }]}>{weeklyRecap.cardsStudied}</Text>
                  <Text style={[styles.recapStatLabel, { color: theme.textSecondary }]}>Cards Studied</Text>
                </View>
                <View style={styles.recapStat}>
                  <Text style={[styles.recapStatValue, { color: statsAccent }]}>
                    {weeklyRecap.accuracy !== null ? `${Math.round(weeklyRecap.accuracy * 100)}%` : '--'}
                  </Text>
                  <Text style={[styles.recapStatLabel, { color: theme.textSecondary }]}>Accuracy</Text>
                </View>
                <View style={styles.recapStat}>
                  <Text style={[styles.recapStatValue, { color: statsAccent }]}>{weeklyRecap.daysActive}</Text>
                  <Text style={[styles.recapStatLabel, { color: theme.textSecondary }]}>Days Active</Text>
                </View>
              </View>

              {weeklyRecap.comparedToLastWeek !== 'first_week' ? (
                <Text style={[styles.recapComparison, { color: theme.textSecondary }]}>
                  {weeklyRecap.comparedToLastWeek === 'better'
                    ? `Up from ${weeklyRecap.lastWeekCards} cards last week`
                    : weeklyRecap.comparedToLastWeek === 'same'
                      ? 'Same as last week. Keep it steady.'
                      : `Down from ${weeklyRecap.lastWeekCards} cards last week`}
                </Text>
              ) : null}
              </TouchableOpacity>

              {expandedPanel === 'recap' ? (
                <View style={styles.insightSection}>
                  <View style={[styles.insightDivider, { backgroundColor: theme.border }]} />
                  {displaySessions.study + displaySessions.quest + displaySessions.practice + displaySessions.arena > 0 ? (
                    <View style={styles.insightRow}>
                      <BarChart3 color={statsAccent} size={15} />
                      <Text style={[styles.insightText, { color: theme.textSecondary }]}> 
                        {(() => {
                          const total = displaySessions.study + displaySessions.quest + displaySessions.practice + displaySessions.arena;
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
                        })()}
                      </Text>
                    </View>
                  ) : null}

                  {weeklyRecap.accuracy !== null ? (
                    <View style={styles.insightRow}>
                      <TrendingUp color={weeklyRecap.comparedToLastWeek === 'better' ? theme.success : theme.textSecondary} size={15} />
                      <Text style={[styles.insightText, { color: theme.textSecondary }]}> 
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
                      <Zap color={theme.warning} size={15} />
                      <Text style={[styles.insightText, { color: theme.textSecondary }]}> 
                        You haven't tried Quest mode this week. It tests recall under pressure and earns more XP.
                      </Text>
                    </View>
                  ) : displaySessions.arena === 0 && displaySessions.study + displaySessions.quest > 3 ? (
                    <View style={styles.insightRow}>
                      <Swords color={theme.warning} size={15} />
                      <Text style={[styles.insightText, { color: theme.textSecondary }]}> 
                        Try Arena mode. Competing against others sharpens your recall speed.
                      </Text>
                    </View>
                  ) : null}

                  {formattedStudyTime !== '' ? (
                    <View style={styles.insightRow}>
                      <Clock color={statsAccent} size={15} />
                      <Text style={[styles.insightText, { color: theme.textSecondary }]}> 
                        {formattedStudyTime} total study time this week. {((stats.totalStudyTimeMs ?? 0) > 1800000) ? 'Great commitment.' : 'Even 5 more minutes a day adds up.'}
                      </Text>
                    </View>
                  ) : null}
                </View>
              ) : null}
            </View>
          ) : null}

          <View style={styles.calendarCard} testID="stats-study-activity">
            <TouchableOpacity
              style={styles.expandableCardButton}
              onPress={() => togglePanel('activity')}
              activeOpacity={0.92}
              accessibilityRole="button"
              accessibilityState={{ expanded: expandedPanel === 'activity' }}
              accessibilityLabel={`Study activity over the last 7 weeks. ${calendarActiveDays} days active.`}
              testID="stats-activity-card-toggle"
            >
              <View style={styles.expandableHeaderRow}>
                <View style={styles.expandableHeaderTextWrap}>
                  <Text style={styles.calendarTitle}>Study Activity</Text>
                  <Text style={styles.calendarSubtitle}>
                    {calendarActiveDays} days active in the last 7 weeks
                  </Text>
                </View>
                <View
                  style={[
                    styles.cardChevron,
                    { transform: [{ rotate: expandedPanel === 'activity' ? '180deg' : '0deg' }] },
                  ]}
                >
                  <ChevronDown color={theme.textTertiary} size={16} strokeWidth={2} />
                </View>
              </View>

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
            </TouchableOpacity>

            {expandedPanel === 'activity' ? (
              <View style={styles.insightSection}>
                <View style={[styles.insightDivider, { backgroundColor: theme.border }]} />

                {studyPatternInsight ? (
                  <View style={styles.insightRow}>
                    <Calendar color={statsAccent} size={15} />
                    <Text style={[styles.insightText, { color: theme.textSecondary }]}>
                      Your most active day is {studyPatternInsight.mostActiveDay}. You've studied on {studyPatternInsight.totalDays} total days.
                    </Text>
                  </View>
                ) : null}

                {studyPatternInsight ? (
                  <View style={styles.insightRow}>
                    <TrendingUp color={statsAccent} size={15} />
                    <Text style={[styles.insightText, { color: theme.textSecondary }]}>
                      {studyPatternInsight.pattern}
                    </Text>
                  </View>
                ) : null}

                <View style={styles.insightRow}>
                  <Flame color={theme.warning} size={15} />
                  <Text style={[styles.insightText, { color: theme.textSecondary }]}>
                    {stats.currentStreak >= stats.longestStreak && stats.currentStreak > 1
                      ? `You're on your longest streak ever (${stats.currentStreak} days). Every day you study extends the record.`
                      : stats.currentStreak > 0 && stats.longestStreak > stats.currentStreak
                        ? `Current streak: ${stats.currentStreak}. Your record is ${stats.longestStreak} days. ${stats.longestStreak - stats.currentStreak} more to beat it.`
                        : stats.longestStreak > 0
                          ? `Your best streak was ${stats.longestStreak} days. Start studying today to build a new one.`
                          : 'Study today to start your first streak.'}
                  </Text>
                </View>

                {studyPatternInsight && studyPatternInsight.bestWeekDays > 0 ? (
                  <View style={styles.insightRow}>
                    <Award color={theme.success} size={15} />
                    <Text style={[styles.insightText, { color: theme.textSecondary }]}>
                      Your best week had {studyPatternInsight.bestWeekDays} active days. {weeklySummary.thisWeekDays >= studyPatternInsight.bestWeekDays ? 'You\'re matching that this week.' : `This week you have ${weeklySummary.thisWeekDays} so far.`}
                    </Text>
                  </View>
                ) : null}
              </View>
            ) : null}
          </View>

          <View style={styles.masteryCard}>
            <TouchableOpacity
              style={styles.expandableCardButton}
              onPress={() => togglePanel('mastery')}
              activeOpacity={0.92}
              accessibilityRole="button"
              accessibilityState={{ expanded: expandedPanel === 'mastery' }}
              accessibilityLabel={`Mastery overview. ${masteryOverview.mastered} of ${masteryOverview.totalCards} cards mastered.`}
              testID="stats-mastery-card-toggle"
            >
              <View style={styles.expandableHeaderRow}>
                <Text style={styles.sectionHeaderLabel}>MASTERY OVERVIEW</Text>
                <View
                  style={[
                    styles.cardChevron,
                    { transform: [{ rotate: expandedPanel === 'mastery' ? '180deg' : '0deg' }] },
                  ]}
                >
                  <ChevronDown color={theme.textTertiary} size={16} strokeWidth={2} />
                </View>
              </View>
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
                {masteryOverview.lapsed > 0 ? (
                  <View
                    style={{
                      width: `${(masteryOverview.lapsed / Math.max(masteryOverview.totalCards, 1)) * 100}%`,
                      height: '100%',
                      backgroundColor: '#F43F5E',
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
                  <Text style={{ color: '#F43F5E' }}>●</Text> {masteryOverview.lapsed} lapsed
                </Text>
                <Text style={styles.masteryLegendItem}>
                  <Text style={{ color: isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.2)' }}>●</Text>{' '}
                  {masteryOverview.newCards} new
                </Text>
              </View>
            </TouchableOpacity>

            {expandedPanel === 'mastery' ? (
              <View style={styles.insightSection}>
                <View style={[styles.insightDivider, { backgroundColor: theme.border }]} />

                <View style={styles.insightRow}>
                  <Target color={statsAccent} size={15} />
                  <Text style={[styles.insightText, { color: theme.textSecondary }]}>
                    {(() => {
                      const total = masteryOverview.totalCards;
                      const mastered = masteryOverview.mastered;
                      if (total === 0) {
                        return 'Add some decks to start tracking mastery.';
                      }
                      const pct = Math.round((mastered / total) * 100);
                      const nextMilestone = [10, 25, 50, 75, 100].find((milestone) => milestone > pct) ?? 100;
                      const cardsNeeded = Math.ceil((nextMilestone / 100) * total) - mastered;
                      if (pct >= 100 || cardsNeeded <= 0) {
                        return '100% overall mastery. Every tracked card is mastered right now.';
                      }
                      return `${pct}% overall mastery. Master ${cardsNeeded} more card${cardsNeeded === 1 ? '' : 's'} to reach ${nextMilestone}%.`;
                    })()}
                  </Text>
                </View>

                {masteryOverview.lapsed > 0 ? (
                  <View style={styles.insightRow}>
                    <AlertCircle color={theme.error} size={15} />
                    <Text style={[styles.insightText, { color: theme.textSecondary }]}>
                      {masteryOverview.lapsed} card{masteryOverview.lapsed === 1 ? ' has' : 's have'} lapsed. A quick review session will bring them back.
                    </Text>
                  </View>
                ) : null}

                <View style={styles.deckMiniBarSection}>
                  {deckProgressSummaries
                    .filter((deck) => deck.total > 0)
                    .sort((a, b) => b.pct - a.pct)
                    .slice(0, 5)
                    .map((deck) => (
                      <TouchableOpacity
                        key={deck.id}
                        style={styles.deckMiniRow}
                        onPress={() => router.push(deckHubHref(deck.id))}
                        activeOpacity={0.8}
                        testID={`stats-mastery-deck-${deck.id}`}
                      >
                        <Text style={[styles.deckMiniName, { color: theme.text }]} numberOfLines={1}>{deck.name}</Text>
                        <View style={[styles.deckMiniBarTrack, { backgroundColor: isDark ? 'rgba(148,163,184,0.1)' : 'rgba(0,0,0,0.04)' }]}>
                          <View style={[styles.deckMiniBarFill, { width: `${Math.max(deck.pct, 2)}%`, backgroundColor: deck.pct >= 50 ? theme.success : statsAccent }]} />
                        </View>
                        <Text style={[styles.deckMiniPct, { color: theme.textSecondary }]}>{deck.pct}%</Text>
                      </TouchableOpacity>
                    ))}
                </View>

                {(() => {
                  const weakest = deckProgressSummaries
                    .filter((deck) => deck.total >= 4 && deck.pct < 50)
                    .sort((a, b) => a.pct - b.pct)[0];

                  if (!weakest) {
                    return null;
                  }

                  return (
                    <TouchableOpacity
                      style={[styles.insightAction, { backgroundColor: isDark ? 'rgba(99,102,241,0.1)' : 'rgba(99,102,241,0.06)' }]}
                      onPress={() => router.push(studyHref(weakest.id))}
                      activeOpacity={0.8}
                      testID="stats-mastery-insight-action"
                    >
                      <Text style={[styles.insightActionText, { color: statsAccent }]}>Study {weakest.name}</Text>
                      <ChevronRight color={statsAccent} size={14} />
                    </TouchableOpacity>
                  );
                })()}
              </View>
            ) : null}
          </View>

          <View style={styles.performanceCard}>
            <TouchableOpacity
              style={styles.expandableCardButton}
              onPress={() => togglePanel('performance')}
              activeOpacity={0.92}
              accessibilityRole="button"
              accessibilityState={{ expanded: expandedPanel === 'performance' }}
              accessibilityLabel={`Performance summary. ${stats.totalScore.toLocaleString()} total XP.`}
              testID="stats-performance-card-toggle"
            >
              <View style={styles.expandableHeaderRow}>
                <Text style={styles.sectionHeaderLabel}>PERFORMANCE</Text>
                <View
                  style={[
                    styles.cardChevron,
                    { transform: [{ rotate: expandedPanel === 'performance' ? '180deg' : '0deg' }] },
                  ]}
                >
                  <ChevronDown color={theme.textTertiary} size={16} strokeWidth={2} />
                </View>
              </View>
              <View style={styles.perfRow}>
                <View style={styles.perfIconWrap}>
                  <BookOpen color={statsAccent} size={18} strokeWidth={2.2} />
                </View>
                <View style={styles.perfContent}>
                  <Text style={styles.perfLabel}>Study</Text>
                  <Text style={styles.perfValue}>
                    {displaySessions.study} sessions{formattedStudyTime !== '' ? ` · ${formattedStudyTime} total` : ''}
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
            </TouchableOpacity>

            {expandedPanel === 'performance' ? (
              <View style={styles.insightSection}>
                <View style={[styles.insightDivider, { backgroundColor: theme.border }]} />

                <View style={styles.insightRow}>
                  <Star color={theme.warning} size={15} />
                  <Text style={[styles.insightText, { color: theme.textSecondary }]}>
                    {stats.totalScore.toLocaleString()} total XP. Level {level}. {levelProgress.percent >= 1 ? 'Max level reached.' : `${(levelProgress.required - levelProgress.current).toLocaleString()} XP to next level.`}
                  </Text>
                </View>

                {(() => {
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
                  const top = modes[0];
                  const topPct = Math.round((top.count / total) * 100);

                  return (
                    <View style={styles.insightRow}>
                      <BarChart3 color={statsAccent} size={15} />
                      <Text style={[styles.insightText, { color: theme.textSecondary }]}>
                        {topPct >= 80
                          ? `${top.name} mode dominates at ${topPct}% of sessions. Mixing in other modes improves retention.`
                          : topPct >= 50
                            ? `${top.name} is your go-to mode (${topPct}%). A healthy balance across modes.`
                            : `Sessions are well-distributed. ${top.name} leads slightly at ${topPct}%.`}
                      </Text>
                    </View>
                  );
                })()}

                {lifetimeAccuracy !== null ? (
                  <View style={styles.insightRow}>
                    <CheckCircle color={lifetimeAccuracy >= 80 ? theme.success : theme.warning} size={15} />
                    <Text style={[styles.insightText, { color: theme.textSecondary }]}>
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
                    onPress={() => router.push('/quest')}
                    activeOpacity={0.8}
                    testID="stats-performance-quest-action"
                  >
                    <Text style={[styles.insightActionText, { color: statsAccent }]}>Try Quest Mode</Text>
                    <ChevronRight color={statsAccent} size={14} />
                  </TouchableOpacity>
                ) : displaySessions.arena === 0 && displaySessions.study + displaySessions.quest > 5 ? (
                  <TouchableOpacity
                    style={[styles.insightAction, { backgroundColor: isDark ? 'rgba(99,102,241,0.1)' : 'rgba(99,102,241,0.06)' }]}
                    onPress={() => router.push('/arena')}
                    activeOpacity={0.8}
                    testID="stats-performance-arena-action"
                  >
                    <Text style={[styles.insightActionText, { color: statsAccent }]}>Try Arena Mode</Text>
                    <ChevronRight color={statsAccent} size={14} />
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : null}
          </View>

          {hasRealAccuracyData ? (
            <TouchableOpacity
              style={[styles.trendCard, { backgroundColor: cardSurface, borderColor: cardBorderColor }]}
              onPress={() => togglePanel('trend')}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityState={{ expanded: expandedPanel === 'trend' }}
              testID="stats-trend-card-toggle"
            >
              <View style={styles.trendHeader}>
                <Text style={styles.sectionHeaderLabel}>ACCURACY</Text>
                <ChevronDown
                  color={theme.textTertiary}
                  size={16}
                  strokeWidth={2}
                  style={{ transform: [{ rotate: expandedPanel === 'trend' ? '180deg' : '0deg' }] }}
                />
              </View>

              {(() => {
                const current = accuracyTrendContext.current;
                const previous = accuracyTrendContext.previous;
                if (current?.accuracy === null || current?.accuracy === undefined) {
                  return null;
                }

                const diff = previous?.accuracy !== null && previous?.accuracy !== undefined
                  ? current.accuracy - previous.accuracy
                  : null;
                const trendLabel = diff === null ? '' : diff > 0 ? `+${diff}%` : diff < 0 ? `${diff}%` : 'steady';
                const trendColor = diff === null ? theme.textSecondary : diff > 0 ? theme.success : diff < 0 ? theme.error : theme.textSecondary;

                return (
                  <View style={styles.accuracyHero}>
                    <Text
                      style={[
                        styles.accuracyHeroNumber,
                        {
                          color: current.accuracy >= 80 ? theme.success : current.accuracy >= 60 ? theme.warning : theme.error,
                        },
                      ]}
                    >
                      {current.accuracy}%
                    </Text>
                    {diff !== null ? (
                      <View
                        style={[
                          styles.accuracyTrendBadge,
                          {
                            backgroundColor: diff > 0
                              ? 'rgba(16,185,129,0.12)'
                              : diff < 0
                                ? 'rgba(239,68,68,0.12)'
                                : 'rgba(148,163,184,0.1)',
                          },
                        ]}
                      >
                        <Text style={[styles.accuracyTrendText, { color: trendColor }]}>{trendLabel}</Text>
                      </View>
                    ) : null}
                  </View>
                );
              })()}

              <Text style={[styles.accuracySummary, { color: theme.textSecondary }]}>
                {(() => {
                  const current = accuracyTrendContext.current;
                  const previous = accuracyTrendContext.previous;
                  if (current?.accuracy === null || current?.accuracy === undefined) {
                    return 'Start studying to track accuracy.';
                  }

                  if (previous?.accuracy === null || previous?.accuracy === undefined) {
                    return 'This is your first tracked week. Keep it up.';
                  }

                  const diff = current.accuracy - previous.accuracy;
                  if (diff > 5) {
                    return 'Big improvement from last week. Your study habits are paying off.';
                  }
                  if (diff > 0) {
                    return 'Slightly up from last week. Consistent progress.';
                  }
                  if (diff === 0) {
                    return 'Holding steady. Consistency is the goal.';
                  }
                  if (diff > -5) {
                    return 'Small dip from last week. Review weak cards to bounce back.';
                  }
                  return 'Accuracy dropped this week. Focus on fewer decks and review lapsed cards.';
                })()}
              </Text>

              {expandedPanel === 'trend' ? (
                <View style={styles.insightSection}>
                  <View style={[styles.insightDivider, { backgroundColor: theme.border }]} />

                  {accuracyTrendContext.recentEntries.map((entry, index) => {
                    const weekLabel = index === 0 ? 'This week' : index === 1 ? 'Last week' : `${index} weeks ago`;

                    return (
                      <View key={entry.week} style={styles.trendWeekRow}>
                        <Text style={[styles.trendWeekLabel, { color: theme.textSecondary }]}>{weekLabel}</Text>
                        {entry.accuracy !== null ? (
                          <View style={styles.trendWeekRight}>
                            <View
                              style={[
                                styles.trendWeekBar,
                                {
                                  width: `${entry.accuracy}%`,
                                  backgroundColor: entry.accuracy >= 80 ? theme.success : entry.accuracy >= 60 ? theme.warning : theme.error,
                                },
                              ]}
                            />
                            <Text style={[styles.trendWeekPct, { color: theme.text }]}>{entry.accuracy}%</Text>
                          </View>
                        ) : (
                          <Text style={[styles.trendWeekPct, { color: theme.textTertiary }]}>No data</Text>
                        )}
                      </View>
                    );
                  })}
                </View>
              ) : null}
            </TouchableOpacity>
          ) : null}

          <View style={[styles.deckProgressSection, { backgroundColor: cardSurface, borderColor: cardBorderColor }]}>
            <TouchableOpacity
              style={styles.expandableCardButton}
              onPress={() => togglePanel('deckProgress')}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityState={{ expanded: expandedPanel === 'deckProgress' }}
              accessibilityLabel="Deck progress"
              testID="stats-deck-progress-toggle"
            >
              <View style={styles.trendHeader}>
                <View style={styles.expandableHeaderTextWrap}>
                  <Text style={styles.sectionHeaderLabel}>DECK PROGRESS</Text>
                  <Text style={[styles.deckProgressSummary, { color: theme.textSecondary }]}> 
                    {deckProgressOverview.trackedDecks > 0
                      ? `${deckProgressOverview.trackedDecks} decks • ${deckProgressOverview.totalMastered}/${deckProgressOverview.totalCards} cards mastered`
                      : 'Tap to expand your deck progress'}
                  </Text>
                </View>
                <View
                  style={[
                    styles.cardChevron,
                    { transform: [{ rotate: expandedPanel === 'deckProgress' ? '180deg' : '0deg' }] },
                  ]}
                >
                  <ChevronDown color={theme.textTertiary} size={16} strokeWidth={2} />
                </View>
              </View>
            </TouchableOpacity>

            {expandedPanel === 'deckProgress' ? (
              <View style={styles.deckProgressListWrap}>
                <View style={[styles.insightDivider, { backgroundColor: theme.border }]} />
                <StatsDeckProgressList
                  deckProgressSummaries={deckProgressSummaries}
                  deckMasteryDetails={deckMasteryDetails}
                  deckDueCounts={deckDueCounts}
                  isDark={isDark}
                  onStudyDeck={(deckId) => router.push(studyHref(deckId))}
                  textColor={theme.text}
                  secondaryTextColor={secondaryTextColor}
                  emptyTextColor={secondaryTextColor}
                  emptySurfaceColor={isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}
                  trackColor={isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}
                />
              </View>
            ) : null}
          </View>
          </ResponsiveContainer>
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
        isDark={isDark}
        levelPalette={levelPalette}
        showRankIdentity
      />
    </View>
  );
}

const createStyles = (theme: ThemeValues, isDark: boolean) => {
  const statSurface = isDark ? 'rgba(9, 18, 35, 0.84)' : 'rgba(255, 255, 255, 0.88)';
  const surfaceBorderColor = isDark ? 'rgba(148, 163, 184, 0.12)' : 'rgba(148, 163, 184, 0.18)';
  const statsAccent = isDark ? '#38bdf8' : '#2563eb';
  const accentTint = isDark ? 'rgba(56, 189, 248, 0.1)' : 'rgba(59, 130, 246, 0.12)';
  const accentBorder = isDark ? 'rgba(56, 189, 248, 0.18)' : 'rgba(96, 165, 250, 0.28)';
  const deepSurface = isDark ? 'rgba(7, 15, 31, 0.92)' : 'rgba(255, 255, 255, 0.9)';
  const cardSurface = isDark ? 'rgba(11, 20, 37, 0.84)' : 'rgba(255, 255, 255, 0.9)';
  const secondaryTextColor = isDark ? theme.textSecondary : '#4F6284';
  const tertiaryTextColor = isDark ? theme.textTertiary : '#7183A6';

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
    midGlow: {
      position: 'absolute',
      top: 280,
      right: -54,
      width: 220,
      height: 220,
      borderRadius: 110,
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
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
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
      color: tertiaryTextColor,
      letterSpacing: 1,
      textTransform: 'uppercase' as const,
      marginBottom: 12,
    },
    levelBadge: {
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
      fontWeight: '700' as const,
      color: secondaryTextColor,
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
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.28,
      shadowRadius: 6,
      elevation: 2,
    },
    levelBarLabel: {
      fontSize: 12,
      fontWeight: '700' as const,
      color: tertiaryTextColor,
      textAlign: 'center',
      marginTop: 10,
    },
    levelHint: {
      fontSize: 12,
      fontWeight: '700' as const,
      color: statsAccent,
      marginTop: 14,
    },

    dailyGoalCard: {
      marginHorizontal: 24,
      marginBottom: 14,
      borderRadius: 20,
      borderWidth: 1,
      padding: 20,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: isDark ? 0.14 : 0.06,
      shadowRadius: isDark ? 18 : 12,
      elevation: isDark ? 6 : 3,
    },
    expandableCardButton: {
      width: '100%',
    },
    expandableCardTitle: {
      flex: 1,
    },
    expandableHeaderRow: {
      width: '100%',
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 12,
    },
    expandableHeaderTextWrap: {
      flex: 1,
    },
    cardChevron: {
      marginLeft: 8,
    },
    dailyGoalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 16,
    },
    dailyGoalTitle: {
      fontSize: 16,
      fontWeight: '800' as const,
      flex: 1,
    },
    dailyGoalFraction: {
      fontSize: 14,
      fontWeight: '700' as const,
    },
    dailyGoalRingContainer: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    dailyGoalRingCenter: {
      position: 'absolute',
      alignItems: 'center',
    },
    dailyGoalPercent: {
      fontSize: 28,
      fontWeight: '800' as const,
    },
    dailyGoalSubtext: {
      fontSize: 12,
      fontWeight: '600' as const,
      marginTop: 2,
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
      color: secondaryTextColor,
      marginTop: 4,
    },
    weeklyDivider: {
      width: 1,
      height: 36,
    },
    weeklyComparison: {
      fontSize: 13,
      fontWeight: '600' as const,
      color: tertiaryTextColor,
      textAlign: 'center',
      marginTop: 14,
    },

    recapCard: {
      marginHorizontal: 24,
      marginBottom: 14,
      borderRadius: 20,
      borderWidth: 1,
      padding: 20,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: isDark ? 0.14 : 0.06,
      shadowRadius: isDark ? 18 : 12,
      elevation: isDark ? 6 : 3,
    },
    recapHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 16,
    },
    recapTitle: {
      fontSize: 16,
      fontWeight: '800' as const,
    },
    recapGrid: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      marginBottom: 12,
    },
    recapStat: {
      alignItems: 'center',
    },
    recapStatValue: {
      fontSize: 24,
      fontWeight: '800' as const,
      marginBottom: 4,
    },
    recapStatLabel: {
      fontSize: 12,
      fontWeight: '600' as const,
    },
    recapComparison: {
      fontSize: 13,
      fontWeight: '500' as const,
      textAlign: 'center',
      marginTop: 4,
    },
    insightSection: {
      width: '100%',
      marginTop: 12,
      gap: 10,
    },
    insightDivider: {
      height: 1,
      marginBottom: 4,
      opacity: 0.5,
    },
    insightRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      paddingHorizontal: 4,
    },
    insightText: {
      fontSize: 13,
      lineHeight: 18,
      flex: 1,
    },
    insightAction: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 10,
      borderRadius: 10,
      marginTop: 4,
    },
    insightActionText: {
      fontSize: 13,
      fontWeight: '700' as const,
    },
    weekDayRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingHorizontal: 12,
      marginBottom: 4,
    },
    weekDayItem: {
      alignItems: 'center',
      gap: 6,
    },
    weekDayLabel: {
      fontSize: 11,
      fontWeight: '600' as const,
    },
    weekDayDot: {
      width: 24,
      height: 24,
      borderRadius: 12,
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
      color: secondaryTextColor,
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
      color: tertiaryTextColor,
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
      color: tertiaryTextColor,
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
      color: tertiaryTextColor,
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
      color: secondaryTextColor,
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
      color: tertiaryTextColor,
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginBottom: 12,
      alignSelf: 'flex-start',
    },
    sectionHeaderLabel: {
      fontSize: 12,
      fontWeight: '700' as const,
      color: tertiaryTextColor,
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    masteryBigText: {
      fontSize: 36,
      fontWeight: '800' as const,
    },
    masterySubtext: {
      fontSize: 13,
      fontWeight: '600' as const,
      color: secondaryTextColor,
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
      color: secondaryTextColor,
    },
    deckMiniBarSection: {
      gap: 8,
      marginTop: 4,
    },
    deckMiniRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 4,
    },
    deckMiniName: {
      fontSize: 12,
      fontWeight: '600' as const,
      width: 100,
    },
    deckMiniBarTrack: {
      flex: 1,
      height: 6,
      borderRadius: 3,
      overflow: 'hidden',
    },
    deckMiniBarFill: {
      height: '100%',
      borderRadius: 3,
    },
    deckMiniPct: {
      fontSize: 11,
      fontWeight: '700' as const,
      width: 32,
      textAlign: 'right',
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
      color: secondaryTextColor,
      flex: 1,
    },
    perfDetail: {
      fontSize: 12,
      fontWeight: '500' as const,
      color: tertiaryTextColor,
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
    trendHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    accuracyHero: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginBottom: 6,
    },
    accuracyHeroNumber: {
      fontSize: 36,
      fontWeight: '900' as const,
      letterSpacing: -1,
    },
    accuracyTrendBadge: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 8,
    },
    accuracyTrendText: {
      fontSize: 13,
      fontWeight: '700' as const,
    },
    accuracySummary: {
      fontSize: 13,
      lineHeight: 18,
    },
    trendWeekRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 6,
      paddingHorizontal: 4,
      gap: 10,
    },
    trendWeekLabel: {
      fontSize: 13,
      fontWeight: '600' as const,
      width: 100,
    },
    trendWeekRight: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    trendWeekBar: {
      height: 6,
      borderRadius: 3,
      minWidth: 8,
    },
    trendWeekPct: {
      fontSize: 13,
      fontWeight: '700' as const,
      width: 56,
      textAlign: 'right',
    },

    deckProgressSection: {
      marginHorizontal: 24,
      marginBottom: 20,
      borderRadius: 24,
      padding: 22,
      borderWidth: 1,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: isDark ? 0.14 : 0.06,
      shadowRadius: isDark ? 18 : 12,
      elevation: isDark ? 6 : 3,
    },
    deckProgressSummary: {
      fontSize: 13,
      fontWeight: '600' as const,
      marginTop: 6,
    },
    deckProgressListWrap: {
      marginTop: 12,
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
      backgroundColor: isDark ? 'rgba(148,163,184,0.14)' : 'rgba(148, 163, 184, 0.2)',
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
      color: secondaryTextColor,
      textAlign: 'center',
    },
  });
};

const createLevelModalStyles = (theme: ThemeValues, isDark: boolean) => {
  const secondaryTextColor = isDark ? theme.textSecondary : '#4F6284';
  const tertiaryTextColor = isDark ? theme.textTertiary : '#7183A6';

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
      color: tertiaryTextColor,
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
      color: secondaryTextColor,
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
      color: secondaryTextColor,
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
      color: secondaryTextColor,
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
      color: secondaryTextColor,
      lineHeight: 17,
    },
    levelRowMeta: {
      fontSize: 11,
      fontWeight: '700' as const,
      color: tertiaryTextColor,
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
