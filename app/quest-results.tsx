import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Trophy, Target, Zap, Clock, RotateCcw, BookOpen, Home, ChevronDown, ChevronUp } from 'lucide-react-native';
import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useFlashQuest } from '@/context/FlashQuestContext';
import { useTheme } from '@/context/ThemeContext';
import { QuestRunResult, QuestSettings } from '@/types/flashcard';
import { logger } from '@/utils/logger';

export default function QuestResultsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ result: string }>();
  const { theme } = useTheme();
  const { decks } = useFlashQuest();

  const [showMissedCards, setShowMissedCards] = useState(false);

  const result: QuestRunResult = useMemo(() => {
    try {
      return JSON.parse(params.result || '{}');
    } catch {
      return {} as QuestRunResult;
    }
  }, [params.result]);

  const deck = useMemo(() => decks.find(d => d.id === result.deckId), [decks, result.deckId]);
  
  const missedCards = useMemo(() => {
    if (!deck) return [];
    return result.missedCardIds
      .map(id => deck.flashcards.find(c => c.id === id))
      .filter(Boolean);
  }, [deck, result.missedCardIds]);

  const formatTime = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`;
    }
    return `${seconds}s`;
  };

  const getPerformanceMessage = (): string => {
    const accuracy = result.accuracy || 0;
    if (accuracy >= 0.9) return "Outstanding!";
    if (accuracy >= 0.8) return "Great job!";
    if (accuracy >= 0.7) return "Well done!";
    if (accuracy >= 0.5) return "Keep practicing!";
    return "Don't give up!";
  };

  const getPerformanceColor = (): string => {
    const accuracy = result.accuracy || 0;
    if (accuracy >= 0.7) return theme.success;
    if (accuracy >= 0.5) return theme.warning;
    return theme.error;
  };

  const handlePlayAgain = () => {
    router.replace({
      pathname: '/quest-session' as any,
      params: { settings: JSON.stringify(result.settings) },
    });
  };

  const handleDrillMissed = () => {
    if (missedCards.length === 0) return;

    const len = missedCards.length;
    let drillRunLength: 5 | 10 | 20 = 5;
    if (len >= 20) drillRunLength = 20;
    else if (len >= 10) drillRunLength = 10;
    else drillRunLength = 5;

    const drillSettings: QuestSettings = {
      ...result.settings,
      runLength: drillRunLength,
      focusWeakOnly: false,
    };

    logger.log('[Quest] Drilling missed cards:', result.missedCardIds.length, 'runLength:', drillRunLength);

    router.replace({
      pathname: '/quest-session' as any,
      params: { 
        settings: JSON.stringify(drillSettings),
        drillCardIds: JSON.stringify(result.missedCardIds),
      },
    });
  };

  const handleBackToMenu = () => {
    router.replace('/quest' as any);
  };

  const handleGoHome = () => {
    router.replace('/');
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <LinearGradient
        colors={[theme.gradientStart, theme.gradientMid, theme.gradientEnd]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <Trophy color="#FFD700" size={48} />
            <Text style={styles.title}>Quest Complete!</Text>
            <Text style={[styles.performanceMessage, { color: getPerformanceColor() }]}>
              {getPerformanceMessage()}
            </Text>
          </View>

          <View style={[styles.scoreCard, { backgroundColor: theme.cardBackground }]}>
            <View style={styles.mainScore}>
              <Text style={[styles.scoreValue, { color: theme.primary }]}>{result.totalScore}</Text>
              <Text style={[styles.scoreLabel, { color: theme.textSecondary }]}>Total Score</Text>
            </View>

            <View style={styles.statsGrid}>
              <View style={styles.statBox}>
                <Target color={theme.success} size={24} />
                <Text style={[styles.statValue, { color: theme.text }]}>
                  {Math.round((result.accuracy || 0) * 100)}%
                </Text>
                <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Accuracy</Text>
              </View>

              <View style={styles.statBox}>
                <Zap color="#FFD700" size={24} />
                <Text style={[styles.statValue, { color: theme.text }]}>{result.bestStreak}</Text>
                <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Best Streak</Text>
              </View>

              <View style={styles.statBox}>
                <Clock color={theme.primary} size={24} />
                <Text style={[styles.statValue, { color: theme.text }]}>
                  {formatTime(result.totalTimeMs || 0)}
                </Text>
                <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Time</Text>
              </View>
            </View>

            <View style={[styles.resultBar, { backgroundColor: theme.background }]}>
              <View 
                style={[
                  styles.correctBar, 
                  { 
                    backgroundColor: theme.success,
                    width: `${(result.correctCount / (result.settings?.runLength || 1)) * 100}%`,
                  }
                ]} 
              />
            </View>
            <View style={styles.resultLabels}>
              <Text style={[styles.resultText, { color: theme.success }]}>
                {result.correctCount} Correct
              </Text>
              <Text style={[styles.resultText, { color: theme.error }]}>
                {result.incorrectCount} Incorrect
              </Text>
            </View>
          </View>

          {missedCards.length > 0 && (
            <View style={[styles.missedSection, { backgroundColor: theme.cardBackground }]}>
              <TouchableOpacity
                style={styles.missedHeader}
                onPress={() => setShowMissedCards(!showMissedCards)}
                activeOpacity={0.7}
              >
                <View style={styles.missedTitleRow}>
                  <BookOpen color={theme.error} size={20} />
                  <Text style={[styles.missedTitle, { color: theme.text }]}>
                    Missed Cards ({missedCards.length})
                  </Text>
                </View>
                {showMissedCards ? (
                  <ChevronUp color={theme.textSecondary} size={24} />
                ) : (
                  <ChevronDown color={theme.textSecondary} size={24} />
                )}
              </TouchableOpacity>

              {showMissedCards && (
                <View style={styles.missedList}>
                  {missedCards.map((card, index) => (
                    <View 
                      key={card?.id || index} 
                      style={[styles.missedCard, { backgroundColor: theme.background }]}
                    >
                      <Text style={[styles.missedQuestion, { color: theme.text }]} numberOfLines={2}>
                        {card?.question}
                      </Text>
                      <Text style={[styles.missedAnswer, { color: theme.success }]}>
                        Answer: {card?.answer}
                      </Text>
                      {card?.explanation && (
                        <Text style={[styles.missedExplanation, { color: theme.textSecondary }]} numberOfLines={3}>
                          {card.explanation}
                        </Text>
                      )}
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handlePlayAgain}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={theme.questGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.buttonGradient}
              >
                <RotateCcw color="#fff" size={20} />
                <Text style={styles.primaryButtonText}>Play Again</Text>
              </LinearGradient>
            </TouchableOpacity>

            {missedCards.length > 0 && (
              <TouchableOpacity
                style={[styles.secondaryButton, { borderColor: theme.warning }]}
                onPress={handleDrillMissed}
                activeOpacity={0.7}
              >
                <Target color={theme.warning} size={20} />
                <Text style={[styles.secondaryButtonText, { color: theme.warning }]}>
                  Drill Missed Cards
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.secondaryButton, { borderColor: theme.primary }]}
              onPress={handleBackToMenu}
              activeOpacity={0.7}
            >
              <BookOpen color={theme.primary} size={20} />
              <Text style={[styles.secondaryButtonText, { color: theme.primary }]}>
                Quest Menu
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tertiaryButton]}
              onPress={handleGoHome}
              activeOpacity={0.7}
            >
              <Home color={theme.textSecondary} size={18} />
              <Text style={[styles.tertiaryButtonText, { color: theme.textSecondary }]}>
                Back to Home
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  title: {
    fontSize: 32,
    fontWeight: '800' as const,
    color: '#fff',
    marginTop: 16,
    marginBottom: 8,
  },
  performanceMessage: {
    fontSize: 20,
    fontWeight: '600' as const,
  },
  scoreCard: {
    borderRadius: 24,
    padding: 24,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  mainScore: {
    alignItems: 'center',
    marginBottom: 24,
  },
  scoreValue: {
    fontSize: 56,
    fontWeight: '800' as const,
  },
  scoreLabel: {
    fontSize: 16,
    fontWeight: '500' as const,
    marginTop: 4,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 24,
  },
  statBox: {
    alignItems: 'center',
    gap: 6,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '700' as const,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '500' as const,
  },
  resultBar: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  correctBar: {
    height: '100%',
    borderRadius: 4,
  },
  resultLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  resultText: {
    fontSize: 14,
    fontWeight: '600' as const,
  },
  missedSection: {
    borderRadius: 20,
    marginBottom: 20,
    overflow: 'hidden',
  },
  missedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  missedTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  missedTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
  },
  missedList: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 12,
  },
  missedCard: {
    padding: 14,
    borderRadius: 14,
  },
  missedQuestion: {
    fontSize: 15,
    fontWeight: '600' as const,
    marginBottom: 8,
  },
  missedAnswer: {
    fontSize: 14,
    fontWeight: '500' as const,
    marginBottom: 6,
  },
  missedExplanation: {
    fontSize: 13,
    lineHeight: 18,
  },
  buttonContainer: {
    gap: 12,
  },
  primaryButton: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 18,
  },
  primaryButtonText: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#fff',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 2,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
  },
  tertiaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  tertiaryButtonText: {
    fontSize: 15,
    fontWeight: '500' as const,
  },
});
