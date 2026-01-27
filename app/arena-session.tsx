import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { X, Clock, Hand } from 'lucide-react-native';
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, Platform, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useFlashQuest } from '@/context/FlashQuestContext';
import { useTheme } from '@/context/ThemeContext';
import { ArenaLobbyState, ArenaPlayerResult, ArenaAnswer, ArenaMatchResult, Flashcard } from '@/types/flashcard';
import { generateOptions, checkAnswer } from '@/utils/questUtils';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 60) / 2;

type GamePhase = 'pass-device' | 'question' | 'feedback';

interface PlayerState {
  playerId: string;
  playerName: string;
  playerColor: string;
  correctCount: number;
  incorrectCount: number;
  points: number;
  currentStreak: number;
  bestStreak: number;
  answers: ArenaAnswer[];
}

export default function ArenaSessionScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ lobbyState: string }>();
  const { theme } = useTheme();
  const { decks } = useFlashQuest();

  const lobby: ArenaLobbyState = useMemo(() => {
    try {
      return JSON.parse(params.lobbyState || '{}');
    } catch {
      return {} as ArenaLobbyState;
    }
  }, [params.lobbyState]);

  const deck = useMemo(() => decks.find(d => d.id === lobby.deckId), [decks, lobby.deckId]);
  const allCards = useMemo(() => decks.flatMap(d => d.flashcards), [decks]);

  const [gamePhase, setGamePhase] = useState<GamePhase>('pass-device');
  const [currentRound, setCurrentRound] = useState(0);
  const [currentPlayerIndex, setCurrentPlayerIndex] = useState(0);
  const [currentCard, setCurrentCard] = useState<Flashcard | null>(null);
  const [options, setOptions] = useState<string[]>([]);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [roundStartTime, setRoundStartTime] = useState(0);

  const [playerStates, setPlayerStates] = useState<PlayerState[]>(() =>
    lobby.players?.map(p => ({
      playerId: p.id,
      playerName: p.name,
      playerColor: p.color,
      correctCount: 0,
      incorrectCount: 0,
      points: 0,
      currentStreak: 0,
      bestStreak: 0,
      answers: [],
    })) || []
  );

  const usedCardIdsRef = useRef<Set<string>>(new Set());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const totalQuestionsPerPlayer = lobby.settings?.rounds || 10;
  const totalQuestions = totalQuestionsPerPlayer * (lobby.players?.length || 1);

  const cardAnimations = useRef([
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
  ]).current;

  const currentPlayer = useMemo(() => {
    return lobby.players?.[currentPlayerIndex];
  }, [lobby.players, currentPlayerIndex]);

  const currentPlayerState = useMemo(() => {
    return playerStates[currentPlayerIndex];
  }, [playerStates, currentPlayerIndex]);

  const questionNumber = useMemo(() => {
    return currentRound * lobby.players.length + currentPlayerIndex + 1;
  }, [currentRound, currentPlayerIndex, lobby.players?.length]);

  const setupQuestion = useCallback(() => {
    if (!deck) return;

    let nextCard: Flashcard | undefined;
    const availableCards = deck.flashcards.filter(c => !usedCardIdsRef.current.has(c.id));

    if (availableCards.length > 0) {
      const randomIndex = Math.floor(Math.random() * availableCards.length);
      nextCard = availableCards[randomIndex];
    } else {
      usedCardIdsRef.current.clear();
      const randomIndex = Math.floor(Math.random() * deck.flashcards.length);
      nextCard = deck.flashcards[randomIndex];
    }

    if (!nextCard) return;

    usedCardIdsRef.current.add(nextCard.id);

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
    setRoundStartTime(Date.now());

    if (lobby.settings.timerSeconds > 0) {
      setTimeRemaining(lobby.settings.timerSeconds);
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
  }, [deck, allCards, lobby.settings, cardAnimations]);

  useEffect(() => {
    if (lobby.settings?.timerSeconds > 0 && timeRemaining !== null && timeRemaining > 0 && gamePhase === 'question') {
      timerRef.current = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev === null || prev <= 1) {
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
  }, [timeRemaining, gamePhase, lobby.settings?.timerSeconds]);

  useEffect(() => {
    if (timeRemaining === 0 && gamePhase === 'question' && currentCard) {
      handleTimeUp();
    }
  }, [timeRemaining, gamePhase, currentCard]);

  const handleTimeUp = useCallback(() => {
    if (gamePhase !== 'question' || !currentCard) return;

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    const timeToAnswer = Date.now() - roundStartTime;

    setPlayerStates(prev => {
      const updated = [...prev];
      updated[currentPlayerIndex] = {
        ...updated[currentPlayerIndex],
        incorrectCount: updated[currentPlayerIndex].incorrectCount + 1,
        currentStreak: 0,
        answers: [
          ...updated[currentPlayerIndex].answers,
          {
            cardId: currentCard.id,
            selectedOption: '',
            correctAnswer: currentCard.answer,
            isCorrect: false,
            timeToAnswerMs: timeToAnswer,
          },
        ],
      };
      return updated;
    });

    setIsCorrect(false);
    setGamePhase('feedback');

    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, [gamePhase, currentCard, roundStartTime, currentPlayerIndex]);

  const handleOptionPress = useCallback((option: string) => {
    if (gamePhase !== 'question' || !currentCard) return;

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    const correct = checkAnswer(option, currentCard.answer);
    const timeToAnswer = Date.now() - roundStartTime;

    setSelectedOption(option);
    setIsCorrect(correct);

    setPlayerStates(prev => {
      const updated = [...prev];
      const playerState = updated[currentPlayerIndex];
      const newStreak = correct ? playerState.currentStreak + 1 : 0;
      const points = correct ? 1 : 0;

      updated[currentPlayerIndex] = {
        ...playerState,
        correctCount: playerState.correctCount + (correct ? 1 : 0),
        incorrectCount: playerState.incorrectCount + (correct ? 0 : 1),
        points: playerState.points + points,
        currentStreak: newStreak,
        bestStreak: Math.max(playerState.bestStreak, newStreak),
        answers: [
          ...playerState.answers,
          {
            cardId: currentCard.id,
            selectedOption: option,
            correctAnswer: currentCard.answer,
            isCorrect: correct,
            timeToAnswerMs: timeToAnswer,
          },
        ],
      };
      return updated;
    });

    setGamePhase('feedback');

    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(
        correct ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error
      );
    }
  }, [gamePhase, currentCard, roundStartTime, currentPlayerIndex]);

  const handleReadyPress = useCallback(() => {
    setGamePhase('question');
    setupQuestion();
  }, [setupQuestion]);

  const handleContinue = useCallback(() => {
    const nextPlayerIndex = currentPlayerIndex + 1;

    if (nextPlayerIndex >= lobby.players.length) {
      const nextRound = currentRound + 1;
      if (nextRound >= totalQuestionsPerPlayer) {
        const results: ArenaPlayerResult[] = playerStates.map(ps => ({
          playerId: ps.playerId,
          playerName: ps.playerName,
          playerColor: ps.playerColor,
          correctCount: ps.correctCount,
          incorrectCount: ps.incorrectCount,
          points: ps.points,
          accuracy: ps.correctCount / totalQuestionsPerPlayer,
          bestStreak: ps.bestStreak,
          answers: ps.answers,
        }));

        const matchResult: ArenaMatchResult = {
          roomCode: lobby.roomCode,
          deckId: lobby.deckId!,
          settings: lobby.settings,
          playerResults: results,
          totalRounds: totalQuestionsPerPlayer,
          completedAt: Date.now(),
        };

        router.replace({
          pathname: '/arena-results',
          params: { result: JSON.stringify(matchResult) },
        });
        return;
      }

      setCurrentRound(nextRound);
      setCurrentPlayerIndex(0);
    } else {
      setCurrentPlayerIndex(nextPlayerIndex);
    }

    setGamePhase('pass-device');
  }, [currentPlayerIndex, currentRound, lobby, totalQuestionsPerPlayer, playerStates, router]);

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

  if (!deck || !lobby.players) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <SafeAreaView style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: theme.text }]}>Loading...</Text>
        </SafeAreaView>
      </View>
    );
  }

  if (gamePhase === 'pass-device') {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <LinearGradient
          colors={[theme.arenaGradient[0], theme.arenaGradient[1]]}
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
            <View style={styles.progressInfo}>
              <Text style={styles.progressText}>
                Question {questionNumber}/{totalQuestions}
              </Text>
            </View>
            <View style={styles.headerSpacer} />
          </View>

          <View style={styles.passDeviceContainer}>
            <Hand color="#fff" size={64} />
            <Text style={styles.passDeviceTitle}>Pass to {currentPlayer?.name}</Text>
            <View style={[styles.playerAvatarLarge, { backgroundColor: currentPlayer?.color }]}>
              <Text style={styles.playerInitialLarge}>
                {currentPlayer?.name.charAt(0).toUpperCase()}
              </Text>
            </View>
            <Text style={styles.passDeviceSubtitle}>
              Round {currentRound + 1} of {totalQuestionsPerPlayer}
            </Text>

            <View style={[styles.scorePreview, { backgroundColor: 'rgba(255,255,255,0.15)' }]}>
              <Text style={styles.scorePreviewLabel}>Current Score</Text>
              <Text style={styles.scorePreviewValue}>{currentPlayerState?.points || 0}</Text>
            </View>

            <TouchableOpacity
              style={styles.readyButton}
              onPress={handleReadyPress}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={['#10b981', '#059669']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.readyButtonGradient}
              >
                <Text style={styles.readyButtonText}>I&apos;m Ready!</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <LinearGradient
        colors={[theme.arenaGradient[0], theme.arenaGradient[1]]}
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
              <View style={[styles.hudPlayerDot, { backgroundColor: currentPlayer?.color }]} />
              <Text style={styles.hudValue} numberOfLines={1}>{currentPlayer?.name}</Text>
            </View>
            <View style={styles.hudDivider} />
            <View style={styles.hudItem}>
              <Text style={styles.hudLabel}>Pts</Text>
              <Text style={styles.hudValue}>{currentPlayerState?.points || 0}</Text>
            </View>
          </View>

          {lobby.settings.timerSeconds > 0 && timeRemaining !== null && (
            <View style={[styles.timerContainer, timeRemaining <= 3 && styles.timerWarning]}>
              <Clock color={timeRemaining <= 3 ? theme.error : '#fff'} size={16} />
              <Text style={[styles.timerText, timeRemaining <= 3 && { color: theme.error }]}>
                {timeRemaining}s
              </Text>
            </View>
          )}
        </View>

        <View style={[styles.questionCard, { backgroundColor: theme.cardBackground }]}>
          <Text style={[styles.questionNumber, { color: theme.textSecondary }]}>
            Question {questionNumber} of {totalQuestions}
          </Text>
          <Text style={[styles.questionText, { color: theme.text }]} numberOfLines={4}>
            {currentCard?.question}
          </Text>
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
                  disabled={gamePhase === 'feedback'}
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

        {gamePhase === 'feedback' && (
          <View style={styles.feedbackOverlay}>
            <View style={[styles.feedbackCard, { backgroundColor: theme.cardBackground }]}>
              <Text style={[styles.feedbackTitle, { color: isCorrect ? theme.success : theme.error }]}>
                {isCorrect ? 'Correct!' : 'Incorrect'}
              </Text>
              {!isCorrect && currentCard && (
                <Text style={[styles.feedbackAnswer, { color: theme.text }]}>
                  Answer: {currentCard.answer}
                </Text>
              )}
              <TouchableOpacity
                style={[styles.continueButton, { backgroundColor: theme.primary }]}
                onPress={handleContinue}
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
  headerSpacer: {
    width: 40,
  },
  progressInfo: {
    alignItems: 'center',
  },
  progressText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  hudContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 10,
    maxWidth: 200,
  },
  hudItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  hudPlayerDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
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
    maxWidth: 80,
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
  passDeviceContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  passDeviceTitle: {
    fontSize: 28,
    fontWeight: '800' as const,
    color: '#fff',
    marginTop: 24,
    marginBottom: 20,
    textAlign: 'center',
  },
  playerAvatarLarge: {
    width: 100,
    height: 100,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  playerInitialLarge: {
    fontSize: 48,
    fontWeight: '700' as const,
    color: '#fff',
  },
  passDeviceSubtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 32,
  },
  scorePreview: {
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 40,
  },
  scorePreviewLabel: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: 4,
  },
  scorePreviewValue: {
    fontSize: 36,
    fontWeight: '800' as const,
    color: '#fff',
  },
  readyButton: {
    width: '100%',
    maxWidth: 280,
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },
  readyButtonGradient: {
    paddingVertical: 18,
    alignItems: 'center',
  },
  readyButtonText: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#fff',
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
  questionNumber: {
    fontSize: 13,
    fontWeight: '500' as const,
    marginBottom: 8,
    textAlign: 'center',
  },
  questionText: {
    fontSize: 18,
    fontWeight: '600' as const,
    textAlign: 'center',
    lineHeight: 26,
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
  feedbackOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  feedbackCard: {
    width: '100%',
    maxWidth: 320,
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
  },
  feedbackTitle: {
    fontSize: 28,
    fontWeight: '800' as const,
    marginBottom: 12,
  },
  feedbackAnswer: {
    fontSize: 16,
    fontWeight: '500' as const,
    marginBottom: 20,
    textAlign: 'center',
  },
  continueButton: {
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: 14,
  },
  continueButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#fff',
  },
});
