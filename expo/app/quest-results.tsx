import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Trophy, Target, Zap, Clock, RotateCcw, BookOpen, Home, ChevronDown, ChevronUp, Share2 } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import ConfettiCelebration from '@/components/ConfettiCelebration';
import DealerPlaceholder from '@/components/DealerPlaceholder';
import ResponsiveContainer from '@/components/ResponsiveContainer';
import ShareableResultCard, { type ResultCardData } from '@/components/ShareableResultCard';
import { useFlashQuest } from '@/context/FlashQuestContext';
import { useTheme } from '@/context/ThemeContext';
import { getQuestCompletionDialogueEvent, selectAssistantDialogue } from '@/utils/dialogue';
import { logger } from '@/utils/logger';
import { parseQuestResultParam, serializeQuestSettings } from '@/utils/questParams';
import { HOME_ROUTE, QUEST_ROUTE, focusedQuestSessionHref, questSessionHref, studyHref } from '@/utils/routes';
import { captureAndShareImage } from '@/utils/share';
import { playSound } from '@/utils/sounds';
import { maybePromptReview } from '@/utils/storeReview';

export default function QuestResultsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ result?: string | string[] }>();
  const { theme } = useTheme();
  const { decks, stats } = useFlashQuest();

  const [showMissedCards, setShowMissedCards] = useState(false);
  const [showShareCard, setShowShareCard] = useState<boolean>(false);
  const [showConfetti, setShowConfetti] = useState<boolean>(false);
  const shareCardRef = useRef<View>(null);
  const reviewPromptStatsRef = useRef({
    totalStudySessions: stats.totalStudySessions,
    totalQuestSessions: stats.totalQuestSessions,
    currentStreak: stats.currentStreak,
  });

  useEffect(() => {
    void maybePromptReview(reviewPromptStatsRef.current);
  }, []);

  const result = useMemo(() => parseQuestResultParam(params.result), [params.result]);

  const deck = useMemo(() => decks.find((item) => item.id === result?.deckId), [decks, result?.deckId]);

  const missedCards = useMemo(() => {
    if (!deck || !result) return [];
    return result.missedCardIds
      .map(id => deck.flashcards.find(c => c.id === id))
      .filter(Boolean);
  }, [deck, result]);

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
    const accuracy = result?.accuracy ?? 0;
    if (accuracy >= 0.9) return "Outstanding!";
    if (accuracy >= 0.8) return "Great job!";
    if (accuracy >= 0.7) return "Well done!";
    if (accuracy >= 0.5) return "Keep practicing!";
    return "Don't give up!";
  };

  const getPerformanceColor = (): string => {
    const accuracy = result?.accuracy ?? 0;
    if (accuracy >= 0.7) return theme.success;
    if (accuracy >= 0.5) return theme.warning;
    return theme.error;
  };

  const resultDialogueEvent = useMemo(() => getQuestCompletionDialogueEvent({
    accuracy: result?.accuracy ?? 0,
    correctCount: result?.correctCount ?? 0,
    incorrectCount: result?.incorrectCount ?? 0,
  }), [result?.accuracy, result?.correctCount, result?.incorrectCount]);

  const assistantLine = useMemo(() => selectAssistantDialogue({
    mode: 'quest',
    event: resultDialogueEvent,
  }), [resultDialogueEvent]);

  const shareCardData = useMemo<ResultCardData | null>(() => {
    if (!result || !deck) {
      return null;
    }

    return {
      mode: 'quest',
      title: result.accuracy >= 0.9 ? 'Outstanding!' : result.accuracy >= 0.7 ? 'Great Job!' : 'Keep Practicing!',
      deckName: deck.name,
      score: result.totalScore ?? 0,
      accuracy: result.accuracy ?? 0,
      correctCount: result.correctCount ?? 0,
      totalRounds: result.totalRounds ?? 0,
      streakBest: result.bestStreak,
    };
  }, [deck, result]);

  useEffect(() => {
    if (!result) {
      return;
    }

    void playSound('complete');
    setShowConfetti((result.accuracy ?? 0) >= 0.9);
  }, [result]);

  const handlePlayAgain = () => {
    if (!result) {
      router.replace(QUEST_ROUTE);
      return;
    }

    router.replace(questSessionHref({ settings: serializeQuestSettings(result.settings) }));
  };

  const handleRetryMissed = () => {
    if (!result || missedCards.length === 0) {
      return;
    }

    logger.log('[Quest] Retrying missed cards:', result.missedCardIds.length);
    router.replace(focusedQuestSessionHref({
      deckId: result.deckId,
      cardIds: result.missedCardIds,
      mode: result.settings.mode,
    }));
  };

  const handleBackToMenu = () => {
    router.replace(QUEST_ROUTE);
  };

  const handleGoHome = () => {
    router.replace(HOME_ROUTE);
  };

  const handleShareAsImage = useCallback(async () => {
    const shareResult = await captureAndShareImage(shareCardRef, 'flashquest-quest-result');

    if (shareResult !== 'failed') {
      setShowShareCard(false);
    }
  }, []);

  if (!result) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}> 
        <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
          <View style={styles.errorState}>
            <Text style={[styles.errorTitle, { color: theme.text }]}>Couldn’t load quest results</Text>
            <Text style={[styles.errorSubtitle, { color: theme.textSecondary }]}>This run summary is missing or invalid.</Text>
            <TouchableOpacity style={[styles.secondaryButton, { borderColor: theme.primary }]} onPress={handleBackToMenu} activeOpacity={0.8}>
              <Text style={[styles.secondaryButtonText, { color: theme.primary }]}>Back to Quest</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}> 
      <ConfettiCelebration trigger={showConfetti} />
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
          <ResponsiveContainer>
            <View style={styles.header}>
            <Trophy color="#FFD700" size={48} />
            <Text style={styles.title}>Quest Complete!</Text>
            <Text style={[styles.performanceMessage, { color: getPerformanceColor() }]}>
              {getPerformanceMessage()}
            </Text>
          </View>

          <View style={styles.assistantCard} testID="questResultsAssistantRow">
            <View style={styles.assistantMetaRow}>
              <Text style={styles.assistantEyebrow}>FLASHQUEST AI</Text>
              <Text style={styles.assistantMode}>{resultDialogueEvent === 'win' ? 'Quest win' : 'Quest loss'}</Text>
            </View>
            <DealerPlaceholder customDialogue={assistantLine} size="small" title="Round assistant" />
          </View>

          <View style={[styles.scoreCard, { backgroundColor: theme.cardBackground }]}>
            <View style={styles.mainScore}>
              <Text style={[styles.scoreValue, { color: theme.primary }]}>{result.totalScore}</Text>
              <Text style={[styles.scoreLabel, { color: theme.textSecondary }]}>XP</Text>
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
                    width: `${(result.correctCount / Math.max(result.totalRounds, 1)) * 100}%`,
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
                      {!!card?.explanation && (
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
                testID="quest-results-retry-missed-button"
                style={[styles.secondaryButton, { borderColor: theme.warning }]}
                onPress={handleRetryMissed}
                activeOpacity={0.7}
              >
                <Target color={theme.warning} size={20} />
                <Text style={[styles.secondaryButtonText, { color: theme.warning }]}> 
                  Retry Missed ({missedCards.length})
                </Text>
              </TouchableOpacity>
            )}

            {(result.accuracy || 0) < 0.7 && deck && (
              <TouchableOpacity
                style={[styles.secondaryButton, { borderColor: theme.primary }]}
                onPress={() => router.replace(studyHref(result.deckId))}
                activeOpacity={0.7}
              >
                <BookOpen color={theme.primary} size={20} />
                <Text style={[styles.secondaryButtonText, { color: theme.primary }]}>Review Flashcards First</Text>
              </TouchableOpacity>
            )}

            {shareCardData ? (
              <TouchableOpacity
                style={[styles.secondaryButton, { borderColor: theme.primary }]}
                onPress={() => setShowShareCard(true)}
                activeOpacity={0.7}
                accessibilityLabel="Share results as image"
                accessibilityRole="button"
                testID="quest-results-share-image"
              >
                <Share2 color={theme.primary} size={20} strokeWidth={2.2} />
                <Text style={[styles.secondaryButtonText, { color: theme.primary }]}>Share as Image</Text>
              </TouchableOpacity>
            ) : null}

            <TouchableOpacity
              style={[styles.secondaryButton, { borderColor: theme.primary }]}
              onPress={handleBackToMenu}
              activeOpacity={0.7}
            >
              <BookOpen color={theme.primary} size={20} />
              <Text style={[styles.secondaryButtonText, { color: theme.primary }]}>Quest Menu</Text>
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
          </ResponsiveContainer>
        </ScrollView>

        {shareCardData ? (
          <Modal
            visible={showShareCard}
            transparent
            animationType="fade"
            onRequestClose={() => setShowShareCard(false)}
            testID="quest-share-modal"
          >
            <View style={styles.shareModalBackdrop}>
              <View style={styles.shareModalContent}>
                <ShareableResultCard ref={shareCardRef} data={shareCardData} />
                <View style={styles.shareModalActions}>
                  <TouchableOpacity
                    style={styles.shareModalButton}
                    onPress={() => {
                      void handleShareAsImage();
                    }}
                    activeOpacity={0.8}
                    accessibilityLabel="Share image"
                    accessibilityRole="button"
                  >
                    <Text style={styles.shareModalButtonText}>Share</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.shareModalCancelButton}
                    onPress={() => setShowShareCard(false)}
                    activeOpacity={0.8}
                    accessibilityLabel="Cancel"
                    accessibilityRole="button"
                  >
                    <Text style={styles.shareModalCancelText}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
        ) : null}
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
  errorState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    gap: 12,
  },
  errorTitle: {
    fontSize: 22,
    fontWeight: '800' as const,
    textAlign: 'center' as const,
  },
  errorSubtitle: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center' as const,
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
  assistantCard: {
    marginBottom: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    backgroundColor: 'rgba(8, 15, 30, 0.18)',
    paddingBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 14,
    elevation: 5,
  },
  assistantMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 14,
    marginBottom: 4,
  },
  assistantEyebrow: {
    fontSize: 11,
    fontWeight: '800' as const,
    color: 'rgba(255,255,255,0.92)',
    letterSpacing: 0.8,
  },
  assistantMode: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: 'rgba(255,255,255,0.72)',
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
  shareModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  shareModalContent: {
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  shareModalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  shareModalButton: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 14,
  },
  shareModalButtonText: {
    color: '#0F172A',
    fontSize: 16,
    fontWeight: '800' as const,
  },
  shareModalCancelButton: {
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  shareModalCancelText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700' as const,
  },
});
