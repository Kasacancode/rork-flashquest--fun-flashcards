import { useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { BookOpen, Calendar, Flame, Star, Swords, Target, TrendingUp, Zap } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import { useQueryClient } from '@tanstack/react-query';

import StatsRankEmblem from '@/components/StatsRankEmblem';
import LevelsModal from '@/components/profile/LevelsModal';
import StatsDeckProgressList from '@/components/stats/StatsDeckProgressList';
import StatsHeader from '@/components/stats/StatsHeader';
import StatsScreenBackground from '@/components/stats/StatsScreenBackground';
import { useStatsScreenState } from '@/components/stats/useStatsScreenState';
import type { Theme } from '@/constants/colors';
import { getDailyGoalTarget, getDailyProgress } from '@/utils/dailyGoal';
import { LEVELS } from '@/utils/levels';

type ThemeValues = Theme;

export default function StatsPage() {
  const {
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
  } = useStatsScreenState();

  const queryClient = useQueryClient();
  const styles = useMemo(() => createStyles(theme, isDark), [theme, isDark]);
  const levelModalStyles = useMemo(() => createLevelModalStyles(theme, isDark), [theme, isDark]);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [dailyGoalTarget, setDailyGoalTarget] = useState<number>(15);
  const [dailyGoalProgress, setDailyGoalProgress] = useState<number>(0);
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

          <View
            style={[styles.dailyGoalCard, { backgroundColor: cardSurface, borderColor: cardBorderColor }]}
            accessible={true}
            accessibilityLabel={`Today's study goal: ${dailyGoalProgress} of ${dailyGoalTarget} cards. ${dailyGoalProgress >= dailyGoalTarget ? 'Goal reached.' : `${dailyGoalTarget - dailyGoalProgress} remaining.`}`}
          >
            <View style={styles.dailyGoalHeader}>
              <Target color={statsAccent} size={20} strokeWidth={2.2} />
              <Text style={[styles.dailyGoalTitle, { color: theme.text }]}>Today's Goal</Text>
              <Text style={[styles.dailyGoalFraction, { color: theme.textSecondary }]}>
                {dailyGoalProgress} / {dailyGoalTarget}
              </Text>
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
          </View>

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

          {weeklyRecap.cardsStudied > 0 ? (
            <View
              style={[styles.recapCard, { backgroundColor: cardSurface, borderColor: cardBorderColor }]}
              accessible={true}
              accessibilityLabel={`Weekly recap: ${weeklyRecap.cardsStudied} cards studied, ${weeklyRecap.daysActive} days active${weeklyRecap.accuracy !== null ? `, ${Math.round(weeklyRecap.accuracy * 100)}% accuracy` : ''}`}
            >
              <View style={styles.recapHeader}>
                <TrendingUp color={statsAccent} size={20} strokeWidth={2.2} />
                <Text style={[styles.recapTitle, { color: theme.text }]}>Weekly Recap</Text>
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
            </View>
          ) : null}

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
            <StatsDeckProgressList
              deckProgressSummaries={deckProgressSummaries}
              textColor={theme.text}
              secondaryTextColor={secondaryTextColor}
              emptyTextColor={secondaryTextColor}
              emptySurfaceColor={isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}
              trackColor={isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}
            />
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
      color: tertiaryTextColor,
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
