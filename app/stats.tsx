import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { ArrowLeft, Trophy, Flame, Target, Award, TrendingUp, Calendar } from 'lucide-react-native';
import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useFlashQuest } from '../context/FlashQuestContext';
import { useTheme } from '../context/ThemeContext';
import { logger } from '@/utils/logger';

type ThemeValues = ReturnType<typeof useTheme>['theme'];
type StatCardConfig = {
  icon: React.ReactNode;
  value: string;
  title: string;
  subtitle: string;
  testId: string;
};

export default function StatsPage() {
  const router = useRouter();
  const { stats, decks, progress } = useFlashQuest();
  const { theme, isDark } = useTheme();

  const totalCardsReviewed = useMemo(() => {
    return progress.reduce((sum, entry) => sum + entry.cardsReviewed, 0);
  }, [progress]);

  const calendarData = useMemo(() => {
    const today = new Date();
    const studySet = new Set(stats.studyDates ?? []);
    const days: { date: string; active: boolean }[] = [];

    for (let i = 48; i >= 0; i -= 1) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateKey = date.toISOString().slice(0, 10);
      days.push({ date: dateKey, active: studySet.has(dateKey) });
    }

    return days;
  }, [stats.studyDates]);

  const activeDaysCount = useMemo(() => calendarData.filter((day) => day.active).length, [calendarData]);

  const weeklySummary = useMemo(() => {
    const studySet = new Set(stats.studyDates ?? []);
    const today = new Date();
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

    const totalDaysThisWeek = mondayOffset + 1;
    let comparison: string;
    if (thisWeekDays > lastWeekDays) {
      comparison = `${thisWeekDays - lastWeekDays} more than last week`;
    } else if (thisWeekDays < lastWeekDays) {
      comparison = `${lastWeekDays - thisWeekDays} fewer than last week`;
    } else {
      comparison = lastWeekDays === 0 ? 'Start your week strong!' : 'Same as last week';
    }

    return { thisWeekDays, lastWeekDays, totalDaysThisWeek, comparison };
  }, [stats.studyDates]);

  const accuracySummary = useMemo(() => {
    const attempted = stats.totalQuestionsAttempted ?? 0;
    const correct = stats.totalCorrectAnswers ?? 0;
    if (attempted === 0) {
      return null;
    }
    return Math.round((correct / attempted) * 100);
  }, [stats.totalQuestionsAttempted, stats.totalCorrectAnswers]);

  const backgroundGradient = useMemo(
    () => (
      isDark
        ? [theme.gradientStart, theme.gradientMid, theme.gradientEnd] as const
        : ['#FF6B6B', '#FF8E53', '#FFA07A'] as const
    ),
    [isDark, theme.gradientEnd, theme.gradientMid, theme.gradientStart],
  );

  const scoreGradientColors = useMemo(
    () => (isDark ? ['#0EA5E9', '#2563EB'] as const : ['#FFD93D', '#F6C23E'] as const),
    [isDark],
  );

  const styles = useMemo(() => createStyles(theme, isDark), [theme, isDark]);

  const headerContentColor = isDark ? theme.text : theme.white;

  const statCards: StatCardConfig[] = [
    {
      icon: <Flame color="#FF6B6B" size={32} strokeWidth={2} />,
      value: `${stats.currentStreak}`,
      title: 'Day Streak',
      subtitle: `Longest: ${stats.longestStreak}`,
      testId: 'stats-card-streak',
    },
    {
      icon: <Target color="#4ECDC4" size={32} strokeWidth={2} />,
      value: `${totalCardsReviewed}`,
      title: 'Reviewed',
      subtitle: 'Cards completed',
      testId: 'stats-card-reviewed',
    },
    {
      icon: <Award color="#667eea" size={32} strokeWidth={2} />,
      value: `${stats.totalCardsStudied}`,
      title: 'Cards Studied',
      subtitle: 'Keep learning!',
      testId: 'stats-card-studied',
    },
    {
      icon: <TrendingUp color="#F093FB" size={32} strokeWidth={2} />,
      value: `${decks.length}`,
      title: 'Total Decks',
      subtitle: `${progress.length} active`,
      testId: 'stats-card-total-decks',
    },
  ];

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
          <View style={styles.scoreCard} testID="stats-score-card">
            <LinearGradient
              colors={scoreGradientColors}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.scoreGradient}
            >
              <Trophy color={theme.white} size={48} strokeWidth={2} />
              <Text style={styles.scoreValue}>{stats.totalScore}</Text>
              <Text style={styles.scoreLabel}>Total Points</Text>
            </LinearGradient>
          </View>

          <View style={styles.weeklyCard}>
            <View style={styles.weeklyHeader}>
              <Calendar color={theme.primary} size={20} strokeWidth={2.2} />
              <Text style={styles.weeklyTitle}>This Week</Text>
            </View>
            <View style={styles.weeklyStatsRow}>
              <View style={styles.weeklyStat}>
                <Text style={[styles.weeklyStatValue, { color: theme.primary }]}>{weeklySummary.thisWeekDays}</Text>
                <Text style={styles.weeklyStatLabel}>Days Active</Text>
              </View>
              <View style={[styles.weeklyDivider, { backgroundColor: isDark ? 'rgba(148,163,184,0.14)' : '#e0e0e0' }]} />
              <View style={styles.weeklyStat}>
                <Text style={[styles.weeklyStatValue, { color: theme.primary }]}>{stats.currentStreak}</Text>
                <Text style={styles.weeklyStatLabel}>Current Streak</Text>
              </View>
              {accuracySummary !== null ? (
                <>
                  <View style={[styles.weeklyDivider, { backgroundColor: isDark ? 'rgba(148,163,184,0.14)' : '#e0e0e0' }]} />
                  <View style={styles.weeklyStat}>
                    <Text style={[styles.weeklyStatValue, { color: accuracySummary >= 70 ? theme.success : theme.warning }]}>{accuracySummary}%</Text>
                    <Text style={styles.weeklyStatLabel}>Accuracy</Text>
                  </View>
                </>
              ) : null}
            </View>
            <Text style={styles.weeklyComparison}>{weeklySummary.comparison}</Text>
          </View>

          <View style={styles.statsGrid}>
            {statCards.map((card) => (
              <View key={card.testId} style={styles.statCard} testID={card.testId}>
                <View style={styles.statIconContainer}>{card.icon}</View>
                <Text style={styles.statNumber}>{card.value}</Text>
                <Text style={styles.statTitle}>{card.title}</Text>
                <Text style={styles.statSubtitle}>{card.subtitle}</Text>
              </View>
            ))}
          </View>

          <View style={styles.activitySection} testID="stats-study-activity">
            <View style={styles.activityCard}>
              <Text style={styles.activityTitle}>Study Activity</Text>
              <Text style={styles.activitySubtitle}>{activeDaysCount} days active in the last 7 weeks</Text>
              <View style={styles.activityGrid}>
                {calendarData.map((day) => (
                  <View
                    key={day.date}
                    style={[
                      styles.activitySquare,
                      {
                        backgroundColor: day.active
                          ? theme.primary
                          : (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'),
                      },
                    ]}
                  />
                ))}
              </View>
              <View style={styles.activityLabels}>
                {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((label, index) => (
                  <Text key={`${label}-${index}`} style={styles.activityLabel}>{label}</Text>
                ))}
              </View>
            </View>
          </View>

          <View style={styles.progressSection}>
            <Text style={styles.sectionTitle}>Deck Progress</Text>
            {progress.length === 0 ? (
              <View style={styles.emptyState} testID="stats-empty-progress">
                <Text style={styles.emptyText}>Start studying to see your progress!</Text>
              </View>
            ) : (
              progress.map((item) => {
                const deck = decks.find((deckItem) => deckItem.id === item.deckId);
                if (!deck) {
                  logger.warn('StatsPage missing deck for progress entry', item.deckId);
                  return null;
                }

                const totalCards = deck.flashcards.length;
                const progressPercent = totalCards > 0 ? Math.min(100, Math.round((item.cardsReviewed / totalCards) * 100)) : 0;

                return (
                  <View
                    key={item.deckId}
                    style={styles.progressCard}
                    testID={`progress-card-${item.deckId}`}
                  >
                    <View style={[styles.deckIndicator, { backgroundColor: deck.color }]} />
                    <View style={styles.progressInfo}>
                      <Text style={styles.progressDeckName}>{deck.name}</Text>
                      <View style={styles.progressStats}>
                        <Text style={styles.progressText}>
                          {item.cardsReviewed} reviewed
                        </Text>
                        <Text style={styles.progressReviewed}>{progressPercent}%</Text>
                      </View>
                      <View style={styles.progressBar}>
                        <View
                          style={[styles.progressBarFill, { width: `${progressPercent}%`, backgroundColor: deck.color }]}
                        />
                      </View>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const createStyles = (theme: ThemeValues, isDark: boolean) => {
  const statSurface = isDark ? 'rgba(15, 23, 42, 0.78)' : theme.statsCard;
  const progressSurface = isDark ? 'rgba(10, 17, 34, 0.88)' : theme.cardBackground;
  const emptySurface = isDark ? 'rgba(15, 23, 42, 0.72)' : theme.card;
  const surfaceBorderColor = isDark ? 'rgba(148, 163, 184, 0.14)' : 'transparent';
  const progressTrack = isDark ? 'rgba(148, 163, 184, 0.14)' : theme.border;

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
    scoreCard: {
      marginHorizontal: 24,
      marginBottom: 24,
      borderRadius: 24,
      overflow: 'hidden',
      borderWidth: isDark ? 1 : 0,
      borderColor: isDark ? 'rgba(148, 163, 184, 0.16)' : 'transparent',
      shadowColor: theme.shadow,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: isDark ? 0.3 : 0.25,
      shadowRadius: 18,
      elevation: 12,
    },
    scoreGradient: {
      padding: 32,
      alignItems: 'center',
    },
    scoreValue: {
      fontSize: 56,
      fontWeight: '800' as const,
      color: theme.white,
      marginTop: 12,
      marginBottom: 4,
    },
    scoreLabel: {
      fontSize: 18,
      color: 'rgba(255, 255, 255, 0.95)',
      fontWeight: '600' as const,
    },
    weeklyCard: {
      marginHorizontal: 24,
      marginBottom: 24,
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
    statsGrid: {
      paddingHorizontal: 24,
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 16,
    },
    statCard: {
      width: '47%',
      backgroundColor: statSurface,
      borderRadius: 20,
      padding: 20,
      alignItems: 'center',
      borderWidth: isDark ? 1 : 0,
      borderColor: surfaceBorderColor,
      shadowColor: theme.shadow,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: isDark ? 0.22 : 0.15,
      shadowRadius: isDark ? 12 : 8,
      elevation: isDark ? 7 : 6,
    },
    statIconContainer: {
      marginBottom: 12,
    },
    statNumber: {
      fontSize: 32,
      fontWeight: '800' as const,
      color: theme.text,
      marginBottom: 4,
    },
    statTitle: {
      fontSize: 15,
      fontWeight: '700' as const,
      color: theme.text,
      marginBottom: 2,
    },
    statSubtitle: {
      fontSize: 12,
      color: theme.textSecondary,
      fontWeight: '500' as const,
    },
    activitySection: {
      marginTop: 28,
      paddingHorizontal: 24,
    },
    activityCard: {
      backgroundColor: statSurface,
      borderRadius: 20,
      padding: 20,
      borderWidth: isDark ? 1 : 0,
      borderColor: surfaceBorderColor,
      shadowColor: theme.shadow,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: isDark ? 0.22 : 0.15,
      shadowRadius: isDark ? 12 : 8,
      elevation: isDark ? 7 : 6,
    },
    activityTitle: {
      fontSize: 18,
      fontWeight: '700' as const,
      color: theme.text,
    },
    activitySubtitle: {
      marginTop: 6,
      fontSize: 13,
      fontWeight: '500' as const,
      color: theme.textSecondary,
    },
    activityGrid: {
      marginTop: 18,
      height: 91,
      flexDirection: 'column',
      flexWrap: 'wrap',
      gap: 3,
      alignSelf: 'flex-start',
    },
    activitySquare: {
      width: 10,
      height: 10,
      borderRadius: 4,
    },
    activityLabels: {
      marginTop: 12,
      flexDirection: 'row',
      alignSelf: 'flex-start',
      gap: 11,
    },
    activityLabel: {
      fontSize: 9,
      fontWeight: '600' as const,
      color: theme.textTertiary,
    },
    progressSection: {
      marginTop: 32,
      paddingHorizontal: 24,
    },
    sectionTitle: {
      fontSize: 24,
      fontWeight: '700' as const,
      color: isDark ? theme.text : theme.white,
      marginBottom: 16,
    },
    emptyState: {
      backgroundColor: emptySurface,
      borderRadius: 16,
      padding: 32,
      alignItems: 'center',
      borderWidth: isDark ? 1 : 0,
      borderColor: surfaceBorderColor,
    },
    emptyText: {
      fontSize: 16,
      color: theme.textSecondary,
      fontWeight: '500' as const,
      textAlign: 'center',
    },
    progressCard: {
      backgroundColor: progressSurface,
      borderRadius: 16,
      padding: 16,
      marginBottom: 12,
      flexDirection: 'row',
      borderWidth: isDark ? 1 : 0,
      borderColor: surfaceBorderColor,
      shadowColor: theme.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: isDark ? 0.18 : 0.1,
      shadowRadius: isDark ? 10 : 4,
      elevation: isDark ? 5 : 3,
    },
    deckIndicator: {
      width: 4,
      borderRadius: 2,
      marginRight: 16,
    },
    progressInfo: {
      flex: 1,
    },
    progressDeckName: {
      fontSize: 17,
      fontWeight: '700' as const,
      color: theme.text,
      marginBottom: 8,
    },
    progressStats: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    progressText: {
      fontSize: 14,
      color: theme.textSecondary,
      fontWeight: '500' as const,
    },
    progressReviewed: {
      fontSize: 16,
      fontWeight: '700' as const,
      color: theme.text,
    },
    progressBar: {
      height: 8,
      backgroundColor: progressTrack,
      borderRadius: 4,
      overflow: 'hidden',
    },
    progressBarFill: {
      height: '100%',
      borderRadius: 4,
    },
  });
};
