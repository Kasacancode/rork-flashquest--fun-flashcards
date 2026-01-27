import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { X, Zap, Lightbulb, Clock } from 'lucide-react-native';
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, Platform, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import DealerPlaceholder from '@/components/DealerPlaceholder';
import { useFlashQuest } from '@/context/FlashQuestContext';
import { usePerformance } from '@/context/PerformanceContext';
import { useTheme } from '@/context/ThemeContext';
import { QuestSettings, Flashcard, QuestRunResult } from '@/types/flashcard';
import { selectNextCard, generateOptions, checkAnswer, calculateScore } from '@/utils/questUtils';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 60) / 2;

export default function QuestSessionScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ settings: string }>();
  const { theme } = useTheme();
  const { decks } = useFlashQuest();
  const { performance, logQuestAttempt, updateBestStreak } = usePerformance();

  const settings: QuestSettings = useMemo(() => {
    try {
      return JSON.parse(params.settings || '{}');
    } catch {
      return {} as QuestSettings;
    }
  }, [params.settings]);

  const deck = useMemo(() => decks.find(d => d.id === settings.deckId), [decks, settings.deckId]);
  const allCards = useMemo(() => decks.flatMap(d => d.flashcards), [decks]);

  const [currentRound, setCurrentRound] = useState(0);
  const [currentCard, setCurrentCard] = useState<Flashcard | null>(null);
  const [options, setOptions] = useState<string[]>([]);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [showHint, setShowHint] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);
  const [inputLocked, setInputLocked] = useState(false);
  const [usedSecondChance, setUsedSecondChance] = useState(false);

  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [incorrectCount, setIncorrectCount] = useState(0);
  const [missedCardIds, setMissedCardIds] = useState<string[]>([]);
  const [askedCardIds, setAskedCardIds] = useState<string[]>([]);

  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [roundStartTime, setRoundStartTime] = useState(0);
  const [totalTimeMs, setTotalTimeMs] = useState(0);

  const usedCardIdsRef = useRef<Set<string>>(new Set());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const dealerDialogue = useRef<'idle' | 'correct' | 'wrong'>('idle');

  const cardAnimations = useRef([
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
  ]).current;

  const setupNextRound = useCallback(() => {
    if (!deck) return;

    const nextCard = selectNextCard({
      cards: deck.flashcards,
      usedCardIds: usedCardIdsRef.current,
      performance,
      focusWeakOnly: settings.focusWeakOnly,
    });

    if (!nextCard) {
      console.log('[Quest] No more cards available');
      return;
    }

    usedCardIdsRef.current.add(nextCard.id);
    setAskedCardIds(prev => [...prev, nextCard.id]);

    const newOptions = generateOptions({
      correctAnswer: nextCard.answer,
      deckCards: deck.flashcards,
      allCards,
      currentCardId: nextCard.id,
    });

    setCurrentCard(nextCard);
    setOptions(newOptions);
    setSelectedOption(null);
    setIsCorrect(null);
    setShowHint(false);
    setShowExplanation(false);
    setInputLocked(false);
    setUsedSecondChance(false);
    dealerDialogue.current = 'idle';
    setRoundStartTime(Date.now());

    if (settings.timerSeconds > 0) {
      setTimeRemaining(settings.timerSeconds);
    }

    cardAnimations.forEach((anim, index) => {
      anim.setValue(0);
      Animated.spring(anim, {
        toValue: 1,
        friction: 8,
        tension: 80,
        delay: index * 80,
        useNativeDriver: true,
      }).start();
    });
  }, [deck, allCards, performance, settings, cardAnimations]);

  useEffect(() => {
    if (deck) {
      setupNextRound();
    }
  }, []);

  useEffect(() => {
    if (settings.timerSeconds > 0 && timeRemaining !== null && timeRemaining > 0 && !inputLocked) {
      timerRef.current = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev === null || prev <= 1) {
            handleTimeUp();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [timeRemaining, inputLocked, settings.timerSeconds]);

  const handleTimeUp = useCallback(() => {
    if (inputLocked || !currentCard) return;

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    setInputLocked(true);
    setIsCorrect(false);
    dealerDialogue.current = 'wrong';
    setStreak(0);
    setIncorrectCount(prev => prev + 1);
    setMissedCardIds(prev => [...prev, currentCard.id]);

    const timeToAnswer = Date.now() - roundStartTime;
    setTotalTimeMs(prev => prev + timeToAnswer);

    logQuestAttempt({
      deckId: settings.deckId,
      cardId: currentCard.id,
      isCorrect: false,
      selectedOption: '',
      correctAnswer: currentCard.answer,
      timeToAnswerMs: timeToAnswer,
    });

    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }

    setTimeout(() => {
      advanceRound();
    }, 1500);
  }, [inputLocked, currentCard, roundStartTime, settings.deckId, logQuestAttempt]);

  const handleOptionPress = useCallback((option: string) => {
    if (inputLocked || !currentCard) return;

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    const correct = checkAnswer(option, currentCard.answer);
    setSelectedOption(option);
    setInputLocked(true);

    const timeToAnswer = Date.now() - roundStartTime;
    setTotalTimeMs(prev => prev + timeToAnswer);

    if (correct) {
      setIsCorrect(true);
      dealerDialogue.current = 'correct';
      
      const newStreak = streak + 1;
      setStreak(newStreak);
      if (newStreak > bestStreak) {
        setBestStreak(newStreak);
      }
      
      const points = calculateScore({
        isCorrect: true,
        mode: settings.mode,
        currentStreak: streak,
      });
      setScore(prev => prev + points);
      setCorrectCount(prev => prev + 1);

      logQuestAttempt({
        deckId: settings.deckId,
        cardId: currentCard.id,
        isCorrect: true,
        selectedOption: option,
        correctAnswer: currentCard.answer,
        timeToAnswerMs: timeToAnswer,
      });

      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      if (settings.explanationsEnabled && currentCard.explanation) {
        setTimeout(() => setShowExplanation(true), 600);
      } else {
        setTimeout(() => advanceRound(), 1000);
      }
    } else {
      setIsCorrect(false);
      dealerDialogue.current = 'wrong';

      if (settings.secondChanceEnabled && !usedSecondChance) {
        setUsedSecondChance(true);
        setInputLocked(false);
        setSelectedOption(null);
        setIsCorrect(null);
        dealerDialogue.current = 'idle';
        
        if (settings.timerSeconds > 0) {
          setTimeRemaining(Math.max(3, Math.floor(settings.timerSeconds / 2)));
        }

        if (Platform.OS !== 'web') {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }
        return;
      }

      setStreak(0);
      setIncorrectCount(prev => prev + 1);
      setMissedCardIds(prev => [...prev, currentCard.id]);

      logQuestAttempt({
        deckId: settings.deckId,
        cardId: currentCard.id,
        isCorrect: false,
        selectedOption: option,
        correctAnswer: currentCard.answer,
        timeToAnswerMs: timeToAnswer,
      });

      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }

      if (settings.explanationsEnabled && currentCard.explanation) {
        setTimeout(() => setShowExplanation(true), 600);
      } else {
        setTimeout(() => advanceRound(), 1200);
      }
    }
  }, [inputLocked, currentCard, streak, bestStreak, roundStartTime, settings, usedSecondChance, logQuestAttempt]);

  const advanceRound = useCallback(() => {
    const nextRound = currentRound + 1;
    
    if (nextRound >= settings.runLength) {
      updateBestStreak(bestStreak);
      
      const result: QuestRunResult = {
        deckId: settings.deckId,
        settings,
        totalScore: score,
        correctCount,
        incorrectCount: incorrectCount,
        accuracy: correctCount / settings.runLength,
        bestStreak,
        totalTimeMs,
        missedCardIds,
        askedCardIds,
      };

      router.replace({
        pathname: '/quest-results',
        params: { result: JSON.stringify(result) },
      });
      return;
    }

    setCurrentRound(nextRound);
    setShowExplanation(false);
    setupNextRound();
  }, [currentRound, settings, score, correctCount, incorrectCount, bestStreak, totalTimeMs, missedCardIds, askedCardIds, router, updateBestStreak, setupNextRound]);

  const handleHintPress = useCallback(() => {
    if (!settings.hintsEnabled || !currentCard?.hint1 || inputLocked) return;
    setShowHint(true);
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, [settings.hintsEnabled, currentCard, inputLocked]);

  const handleExplanationContinue = useCallback(() => {
    setShowExplanation(false);
    advanceRound();
  }, [advanceRound]);

  const handleQuit = useCallback(() => {
    router.back();
  }, [router]);

  const getOptionStyle = (option: string) => {
    if (!selectedOption) return {};
    
    const isSelected = option === selectedOption;
    const isCorrectOption = currentCard && checkAnswer(option, currentCard.answer);

    if (isCorrectOption) {
      return { backgroundColor: theme.success, borderColor: theme.success };
    }
    if (isSelected && !isCorrect) {
      return { backgroundColor: theme.error, borderColor: theme.error };
    }
    return { opacity: 0.5 };
  };

  const getOptionTextColor = (option: string) => {
    if (!selectedOption) return theme.text;
    
    const isSelected = option === selectedOption;
    const isCorrectOption = currentCard && checkAnswer(option, currentCard.answer);

    if (isCorrectOption || (isSelected && !isCorrect)) {
      return '#fff';
    }
    return theme.textTertiary;
  };

  const streakMultiplier = useMemo(() => {
    if (streak >= 4) return '2.0x';
    if (streak >= 3) return '1.6x';
    if (streak >= 2) return '1.4x';
    if (streak >= 1) return '1.2x';
    return '1.0x';
  }, [streak]);

  if (!deck || !currentCard) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <SafeAreaView style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: theme.text }]}>Loading...</Text>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <LinearGradient
        colors={[theme.gradientStart, theme.gradientMid, theme.gradientEnd]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.quitButton}
            onPress={handleQuit}
            activeOpacity={0.7}
          >
            <X color="#fff" size={24} />
          </TouchableOpacity>

          <View style={styles.hudContainer}>
            <View style={styles.hudItem}>
              <Text style={styles.hudLabel}>Round</Text>
              <Text style={styles.hudValue}>{currentRound + 1}/{settings.runLength}</Text>
            </View>
            <View style={styles.hudDivider} />
            <View style={styles.hudItem}>
              <Text style={styles.hudLabel}>Score</Text>
              <Text style={styles.hudValue}>{score}</Text>
            </View>
            <View style={styles.hudDivider} />
            <View style={styles.hudItem}>
              <Zap color="#FFD700" size={14} />
              <Text style={styles.hudValue}>{streak} ({streakMultiplier})</Text>
            </View>
          </View>

          {settings.timerSeconds > 0 && timeRemaining !== null && (
            <View style={[styles.timerContainer, timeRemaining <= 3 && styles.timerWarning]}>
              <Clock color={timeRemaining <= 3 ? theme.error : '#fff'} size={16} />
              <Text style={[styles.timerText, timeRemaining <= 3 && { color: theme.error }]}>
                {timeRemaining}s
              </Text>
            </View>
          )}
        </View>

        <View style={styles.dealerSection}>
          <DealerPlaceholder dialogueType={dealerDialogue.current} />
        </View>

        <View style={[styles.questionCard, { backgroundColor: theme.cardBackground }]}>
          <Text style={[styles.questionText, { color: theme.text }]} numberOfLines={4}>
            {currentCard.question}
          </Text>
          
          {settings.hintsEnabled && currentCard.hint1 && !showHint && !inputLocked && (
            <TouchableOpacity
              style={[styles.hintButton, { backgroundColor: theme.warning + '20' }]}
              onPress={handleHintPress}
              activeOpacity={0.7}
            >
              <Lightbulb color={theme.warning} size={16} />
              <Text style={[styles.hintButtonText, { color: theme.warning }]}>Show Hint</Text>
            </TouchableOpacity>
          )}
          
          {showHint && currentCard.hint1 && (
            <View style={[styles.hintContainer, { backgroundColor: theme.warning + '15' }]}>
              <Lightbulb color={theme.warning} size={14} />
              <Text style={[styles.hintText, { color: theme.warning }]}>{currentCard.hint1}</Text>
            </View>
          )}
        </View>

        <View style={styles.optionsGrid}>
          {options.map((option, index) => {
            const animStyle = {
              opacity: cardAnimations[index],
              transform: [
                {
                  scale: cardAnimations[index].interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.8, 1],
                  }),
                },
              ],
            };

            return (
              <Animated.View key={index} style={[styles.optionWrapper, animStyle]}>
                <TouchableOpacity
                  style={[
                    styles.optionCard,
                    { backgroundColor: theme.cardBackground, borderColor: theme.border },
                    getOptionStyle(option),
                  ]}
                  onPress={() => handleOptionPress(option)}
                  activeOpacity={0.8}
                  disabled={inputLocked}
                >
                  <Text 
                    style={[styles.optionText, { color: getOptionTextColor(option) }]}
                    numberOfLines={3}
                  >
                    {option}
                  </Text>
                </TouchableOpacity>
              </Animated.View>
            );
          })}
        </View>

        {showExplanation && currentCard.explanation && (
          <View style={styles.explanationOverlay}>
            <View style={[styles.explanationCard, { backgroundColor: theme.cardBackground }]}>
              <Text style={[styles.explanationTitle, { color: isCorrect ? theme.success : theme.error }]}>
                {isCorrect ? 'Correct!' : 'Incorrect'}
              </Text>
              <Text style={[styles.explanationAnswer, { color: theme.text }]}>
                Answer: {currentCard.answer}
              </Text>
              <Text style={[styles.explanationText, { color: theme.textSecondary }]} numberOfLines={6}>
                {currentCard.explanation}
              </Text>
              <TouchableOpacity
                style={[styles.continueButton, { backgroundColor: theme.primary }]}
                onPress={handleExplanationContinue}
                activeOpacity={0.8}
              >
                <Text style={styles.continueButtonText}>Continue</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 18,
    fontWeight: '600' as const,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  quitButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  hudContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  hudItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  hudLabel: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.7)',
    fontWeight: '500' as const,
  },
  hudValue: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '700' as const,
    marginLeft: 4,
  },
  hudDivider: {
    width: 1,
    height: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    marginHorizontal: 12,
  },
  timerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  timerWarning: {
    backgroundColor: 'rgba(239, 68, 68, 0.3)',
  },
  timerText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '700' as const,
  },
  dealerSection: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  questionCard: {
    marginHorizontal: 20,
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  questionText: {
    fontSize: 18,
    fontWeight: '600' as const,
    textAlign: 'center',
    lineHeight: 26,
  },
  hintButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignSelf: 'center',
  },
  hintButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
  },
  hintContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 16,
    padding: 12,
    borderRadius: 12,
  },
  hintText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  optionsGrid: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    paddingTop: 20,
    gap: 12,
    justifyContent: 'center',
    alignContent: 'flex-start',
  },
  optionWrapper: {
    width: CARD_WIDTH,
  },
  optionCard: {
    width: '100%',
    minHeight: 100,
    borderRadius: 16,
    borderWidth: 2,
    padding: 16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  optionText: {
    fontSize: 15,
    fontWeight: '600' as const,
    textAlign: 'center',
    lineHeight: 22,
  },
  explanationOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  explanationCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
  },
  explanationTitle: {
    fontSize: 24,
    fontWeight: '700' as const,
    marginBottom: 12,
  },
  explanationAnswer: {
    fontSize: 16,
    fontWeight: '600' as const,
    marginBottom: 16,
    textAlign: 'center',
  },
  explanationText: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 20,
  },
  continueButton: {
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 14,
  },
  continueButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#fff',
  },
});
