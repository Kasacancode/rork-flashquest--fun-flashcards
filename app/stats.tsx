import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { ArrowLeft, Trophy, Flame, Target, Award, TrendingUp } from 'lucide-react-native';
import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useFlashQuest } from '../context/FlashQuestContext';
import { useTheme } from '../context/ThemeContext';

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

  const accuracyEntries = useMemo(() => {
    console.log('StatsPage accuracyEntries computation', { progressCount: progress.length });
    return progress
      .filter((entry) => entry.totalAttempts > 0)
      .map((entry) => entry.correctAnswers / entry.totalAttempts);
  }, [progress]);

  const totalAccuracy = accuracyEntries.length > 0
    ? Math.round(
      (accuracyEntries.reduce((sum, ratio) => sum + ratio, 0) / accuracyEntries.length) * 100,
    )
    : 0;

  console.log('StatsPage render', {
    isDark,
    totalAccuracy,
    totalDecks: decks.length,
    progressCount: progress.length,
    totalScore: stats.totalScore,
  });

  const backgroundGradient = useMemo(
    () => (
      isDark
        ? [theme.gradientStart, theme.gradientMid, theme.gradientEnd]
        : ['#FF6B6B', '#FF8E53', '#FFA07A']
    ),
    [isDark, theme.gradientEnd, theme.gradientMid, theme.gradientStart],
  );

  const scoreGradientColors = useMemo(
    () => (isDark ? ['#0EA5E9', '#2563EB'] : ['#FFD93D', '#F6C23E']),
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
      value: `${totalAccuracy}%`,
      title: 'Accuracy',
      subtitle: 'Overall score',
      testId: 'stats-card-accuracy',
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
                  console.warn('StatsPage missing deck for progress entry', { deckId: item.deckId });
                  return null;
                }

                const attempts = item.totalAttempts;
                const accuracy = attempts > 0 ? Math.round((item.correctAnswers / attempts) * 100) : 0;

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
                          {item.correctAnswers}/{item.totalAttempts} correct
                        </Text>
                        <Text style={styles.progressAccuracy}>{accuracy}%</Text>
                      </View>
                      <View style={styles.progressBar}>
                        <View
                          style={[styles.progressBarFill, { width: `${accuracy}%`, backgroundColor: deck.color }]}
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

const createStyles = (theme: ThemeValues, isDark: boolean) => StyleSheet.create({
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
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
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
  statsGrid: {
    paddingHorizontal: 24,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  statCard: {
    width: '47%',
    backgroundColor: theme.statsCard,
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
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
    backgroundColor: theme.card,
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: theme.textSecondary,
    fontWeight: '500' as const,
    textAlign: 'center',
  },
  progressCard: {
    backgroundColor: theme.cardBackground,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
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
  progressAccuracy: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: theme.text,
  },
  progressBar: {
    height: 8,
    backgroundColor: theme.border,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
});
