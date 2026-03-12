import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Trophy, X, User, Bot, Zap, Swords } from 'lucide-react-native';
import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Platform, TextInput, Keyboard } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { TimerProgressBar, StreakIndicator } from '@/components/GameUI';
import { useFlashQuest } from '@/context/FlashQuestContext';
import { useTheme } from '@/context/ThemeContext';
import { GAME_MODE } from '@/types/game';
import type { PracticeMode, PracticeSessionState } from '@/types/practice';
import { generateDistractors, pickDistractor, getOpponentBehavior, clearDistractorCache } from '@/utils/battleAI';
import { logger } from '@/utils/logger';

const QUESTION_TIME = 15;

type GamePhase = 'player-turn' | 'opponent-turn' | 'reveal-results';

type PlayerInfo = {
  name: string;
  answer: string;
  isCorrect: boolean;
  timeUsed: number;
};

interface TurnResult {
  answer: string;
  isCorrect: boolean;
  timeUsed: number;
}

function createPracticeSession(deckId: string, mode: PracticeMode): PracticeSessionState {
  return {
    id: `practice_${Date.now()}`,
    mode,
    deckId,
    playerScore: 0,
    opponentScore: 0,
    currentRound: 0,
    totalRounds: 5,
    status: 'active',
    opponentName: mode === 'ai' ? 'AI Bot' : 'Opponent',
    shuffled: false,
  };
}

export default function PracticeSessionPage() {
  const router = useRouter();
  const params = useLocalSearchParams<{ deckId?: string | string[]; mode?: PracticeMode | PracticeMode[] }>();
  const { decks, recordSessionResult } = useFlashQuest();
  const { theme, isDark } = useTheme();
  const deckId = useMemo(() => (Array.isArray(params.deckId) ? params.deckId[0] : params.deckId), [params.deckId]);
  const practiceMode = useMemo<PracticeMode>(() => {
    const rawMode = Array.isArray(params.mode) ? params.mode[0] : params.mode;
    return rawMode === 'multiplayer' ? 'multiplayer' : 'ai';
  }, [params.mode]);
  const [currentBattle, setCurrentBattle] = useState<PracticeSessionState | null>(() => (
    deckId ? createPracticeSession(deckId, practiceMode) : null
  ));

  const [gamePhase, setGamePhase] = useState<GamePhase>('player-turn');
  const [userAnswer, setUserAnswer] = useState<string>('');
  const [playerResult, setPlayerResult] = useState<TurnResult | null>(null);
  const [opponentResult, setOpponentResult] = useState<TurnResult | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(QUESTION_TIME);
  const [buttonState, setButtonState] = useState<'idle' | 'correct' | 'incorrect'>('idle');
  const [currentPlayer, setCurrentPlayer] = useState<1 | 2>(1);
  const [player1Result, setPlayer1Result] = useState<PlayerInfo | null>(null);
  const [player2Result, setPlayer2Result] = useState<PlayerInfo | null>(null);
  const [playerStreak, setPlayerStreak] = useState(0);
  const [distractors, setDistractors] = useState<string[]>([]);

  const scaleAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const feedbackOpacity = useRef(new Animated.Value(0)).current;
  const feedbackScale = useRef(new Animated.Value(0.8)).current;
  const scorePopAnim = useRef(new Animated.Value(1)).current;
  const handleTimeUpRef = useRef<() => void>(() => {});

  useEffect(() => {
    if (!deckId) {
      setCurrentBattle(null);
      return;
    }

    setCurrentBattle(createPracticeSession(deckId, practiceMode));
  }, [deckId, practiceMode]);

  const updateBattle = useCallback((playerCorrect: boolean, opponentCorrect: boolean) => {
    setCurrentBattle((previousBattle) => {
      if (!previousBattle) {
        return previousBattle;
      }

      const nextRound = previousBattle.currentRound + 1;
      const isComplete = nextRound >= previousBattle.totalRounds;

      return {
        ...previousBattle,
        playerScore: previousBattle.playerScore + (playerCorrect ? 1 : 0),
        opponentScore: previousBattle.opponentScore + (opponentCorrect ? 1 : 0),
        currentRound: nextRound,
        status: isComplete ? 'completed' : 'active',
        completedAt: isComplete ? Date.now() : undefined,
      };
    });
  }, []);

  const endBattle = useCallback(() => {
    setCurrentBattle(null);
  }, []);

  const deck = useMemo(() => decks.find((d) => d.id === deckId), [decks, deckId]);
  
  const shuffledFlashcards = useMemo(() => {
    if (!deck || !currentBattle?.shuffled) return deck?.flashcards || [];
    const cards = [...deck.flashcards];
    for (let i = cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [cards[i], cards[j]] = [cards[j], cards[i]];
    }
    return cards;
  }, [deck, currentBattle?.shuffled]);
  
  const currentCard = useMemo(() => {
    if (!deck || !currentBattle) return null;
    return shuffledFlashcards[currentBattle.currentRound];
  }, [deck, shuffledFlashcards, currentBattle]);

  const simulateOpponentAnswer = useCallback(() => {
    const difficulty = currentCard?.difficulty || 'medium';
    const behavior = currentBattle?.mode === 'ai'
      ? getOpponentBehavior(difficulty)
      : { correctChance: 0.5, minTime: 4, maxTime: 10 };

    const opponentCorrect = Math.random() < behavior.correctChance;
    const opponentTime = Math.floor(Math.random() * (behavior.maxTime - behavior.minTime + 1)) + behavior.minTime;

    const wrongAnswer = distractors.length > 0
      ? pickDistractor(distractors)
      : 'Incorrect answer';

    setOpponentResult({
      answer: opponentCorrect ? currentCard?.answer || '' : wrongAnswer,
      isCorrect: opponentCorrect,
      timeUsed: opponentTime,
    });

    logger.log('[Practice] Opponent answered:', opponentCorrect ? 'correct' : wrongAnswer, 'in', opponentTime, 's');
    
    setTimeout(() => {
      Animated.parallel([
        Animated.timing(feedbackOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(feedbackScale, {
          toValue: 1,
          friction: 6,
          useNativeDriver: true,
        }),
      ]).start();
      setGamePhase('reveal-results');
    }, 1200);
  }, [currentCard, currentBattle, feedbackOpacity, feedbackScale, distractors]);

  useEffect(() => {
    if (!currentCard) return;
    setTimeLeft(QUESTION_TIME);
    setGamePhase('player-turn');
    setUserAnswer('');
    setPlayerResult(null);
    setOpponentResult(null);
    setButtonState('idle');
    setCurrentPlayer(1);
    setPlayer1Result(null);
    setPlayer2Result(null);
    feedbackOpacity.setValue(0);
    feedbackScale.setValue(0.8);

    if (currentBattle?.mode === 'ai') {
      generateDistractors(currentCard.question, currentCard.answer, currentCard.id)
        .then((result) => {
          setDistractors(result);
          logger.log('[Practice] Pre-loaded distractors for card:', currentCard.id);
        })
        .catch(() => setDistractors([]));
    }
  }, [currentCard, feedbackOpacity, feedbackScale, currentBattle?.mode]);

  useEffect(() => {
    if (gamePhase === 'opponent-turn') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.15,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      pulseAnim.stopAnimation();
      pulseAnim.setValue(1);
    }
  }, [gamePhase, pulseAnim]);

  const triggerShake = useCallback(() => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 8, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  }, [shakeAnim]);

  const handleTimeUp = useCallback(() => {
    if (gamePhase === 'player-turn') {
      const correct = false;
      
      if (currentBattle?.mode === 'multiplayer') {
        if (currentPlayer === 1) {
          setPlayer1Result({
            name: 'Player 1',
            answer: userAnswer.trim() || '(No answer)',
            isCorrect: correct,
            timeUsed: QUESTION_TIME,
          });
          setButtonState('incorrect');
          triggerShake();
          if (Platform.OS !== 'web') {
            void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          }
          
          setTimeout(() => {
            setCurrentPlayer(2);
            setUserAnswer('');
            setButtonState('idle');
            setTimeLeft(QUESTION_TIME);
          }, 1200);
        } else {
          setPlayer2Result({
            name: 'Player 2',
            answer: userAnswer.trim() || '(No answer)',
            isCorrect: correct,
            timeUsed: QUESTION_TIME,
          });
          setButtonState('incorrect');
          triggerShake();
          if (Platform.OS !== 'web') {
            void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          }
          
          setTimeout(() => {
            Animated.parallel([
              Animated.timing(feedbackOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
              Animated.spring(feedbackScale, { toValue: 1, friction: 6, useNativeDriver: true }),
            ]).start();
            setGamePhase('reveal-results');
          }, 1200);
        }
      } else {
        setPlayerResult({
          answer: userAnswer.trim() || '(No answer)',
          isCorrect: correct,
          timeUsed: QUESTION_TIME,
        });
        setButtonState('incorrect');
        setPlayerStreak(0);
        triggerShake();
        if (Platform.OS !== 'web') {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
        
        setTimeout(() => {
          setGamePhase('opponent-turn');
          setTimeLeft(QUESTION_TIME);
        }, 1200);
      }
    } else if (gamePhase === 'opponent-turn') {
      simulateOpponentAnswer();
    }
  }, [gamePhase, userAnswer, simulateOpponentAnswer, currentBattle, currentPlayer, triggerShake, feedbackOpacity, feedbackScale]);

  handleTimeUpRef.current = handleTimeUp;

  useEffect(() => {
    if (gamePhase === 'reveal-results' || !currentCard) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) return 0;
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [currentCard, gamePhase]);

  useEffect(() => {
    if (timeLeft === 0 && gamePhase !== 'reveal-results' && currentCard) {
      handleTimeUpRef.current();
    }
  }, [timeLeft, gamePhase, currentCard]);

  if (!deck || !currentBattle || !currentCard) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Practice session not found</Text>
      </View>
    );
  }

  const handleSubmitAnswer = () => {
    if (gamePhase !== 'player-turn' || userAnswer.trim() === '') return;

    Keyboard.dismiss();
    const correct = userAnswer.trim().toLowerCase() === currentCard?.answer.toLowerCase();
    const timeUsed = QUESTION_TIME - timeLeft;

    if (currentBattle?.mode === 'multiplayer') {
      if (currentPlayer === 1) {
        setPlayer1Result({
          name: 'Player 1',
          answer: userAnswer.trim(),
          isCorrect: correct,
          timeUsed,
        });
        setButtonState(correct ? 'correct' : 'incorrect');

        if (Platform.OS !== 'web') {
          void Haptics.notificationAsync(correct ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error);
        }

        if (!correct) triggerShake();

        Animated.sequence([
          Animated.spring(scaleAnim, { toValue: 1.05, useNativeDriver: true, speed: 50 }),
          Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, speed: 50 }),
        ]).start();

        setTimeout(() => {
          setCurrentPlayer(2);
          setUserAnswer('');
          setButtonState('idle');
          setTimeLeft(QUESTION_TIME);
        }, 1200);
      } else {
        setPlayer2Result({
          name: 'Player 2',
          answer: userAnswer.trim(),
          isCorrect: correct,
          timeUsed,
        });
        setButtonState(correct ? 'correct' : 'incorrect');

        if (Platform.OS !== 'web') {
          void Haptics.notificationAsync(correct ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error);
        }

        if (!correct) triggerShake();

        Animated.sequence([
          Animated.spring(scaleAnim, { toValue: 1.05, useNativeDriver: true, speed: 50 }),
          Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, speed: 50 }),
        ]).start();

        setTimeout(() => {
          Animated.parallel([
            Animated.timing(feedbackOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
            Animated.spring(feedbackScale, { toValue: 1, friction: 6, useNativeDriver: true }),
          ]).start();
          setGamePhase('reveal-results');
        }, 1200);
      }
    } else {
      setPlayerResult({
        answer: userAnswer.trim(),
        isCorrect: correct,
        timeUsed,
      });
      setButtonState(correct ? 'correct' : 'incorrect');
      setPlayerStreak(correct ? playerStreak + 1 : 0);

      if (Platform.OS !== 'web') {
        void Haptics.notificationAsync(correct ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error);
      }

      if (correct) {
        Animated.sequence([
          Animated.timing(scorePopAnim, { toValue: 1.3, duration: 150, useNativeDriver: true }),
          Animated.spring(scorePopAnim, { toValue: 1, friction: 4, useNativeDriver: true }),
        ]).start();
      } else {
        triggerShake();
      }

      Animated.sequence([
        Animated.spring(scaleAnim, { toValue: 1.05, useNativeDriver: true, speed: 50 }),
        Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, speed: 50 }),
      ]).start();

      setTimeout(() => {
        setGamePhase('opponent-turn');
        setTimeLeft(QUESTION_TIME);
        
        setTimeout(() => {
          simulateOpponentAnswer();
        }, Math.random() * 6000 + 2000);
      }, 1200);
    }
  };

  const handleNext = () => {
    if (currentBattle?.mode === 'multiplayer') {
      updateBattle(player1Result?.isCorrect || false, player2Result?.isCorrect || false);
    } else {
      updateBattle(playerResult?.isCorrect || false, opponentResult?.isCorrect || false);
    }
    setUserAnswer('');
    setPlayerResult(null);
    setOpponentResult(null);
    setPlayer1Result(null);
    setPlayer2Result(null);
    setGamePhase('player-turn');
    setButtonState('idle');
    setCurrentPlayer(1);
    setTimeLeft(QUESTION_TIME);
    scaleAnim.setValue(1);
    pulseAnim.stopAnimation();
    pulseAnim.setValue(1);
    feedbackOpacity.setValue(0);
    feedbackScale.setValue(0.8);
  };

  const handleQuit = () => {
    clearDistractorCache();
    endBattle();
    router.back();
  };

  if (currentBattle.status === 'completed') {
    const won = currentBattle.playerScore > currentBattle.opponentScore;
    const practiceXp = won ? 50 : 20;

    return (
      <View style={styles.container}>
        <LinearGradient
          colors={won ? ['#f59e0b', '#d97706'] : isDark ? ['#1e293b', '#0f172a'] : ['#6366f1', '#4f46e5']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />

        <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
          <View style={styles.resultContainer}>
            <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
              <Trophy color="#fff" size={80} strokeWidth={2} />
            </Animated.View>
            <Text style={styles.resultTitle}>
              {won ? '🎉 Victory!' : '💪 Good Try!'}
            </Text>
            <Text style={styles.resultSubtitle}>
              {won ? 'You defeated your opponent!' : 'Keep practicing to improve!'}
            </Text>

            <View style={styles.finalScoreCard}>
              <View style={styles.scoreRow}>
                <Text style={styles.scoreLabel}>You</Text>
                <Text style={[styles.scoreValue, won && { color: '#10b981' }]}>{currentBattle.playerScore}</Text>
              </View>
              <View style={styles.scoreDivider} />
              <View style={styles.scoreRow}>
                <Text style={styles.scoreLabel}>{currentBattle.opponentName}</Text>
                <Text style={[styles.scoreValue, !won && { color: '#10b981' }]}>{currentBattle.opponentScore}</Text>
              </View>
            </View>

            <TouchableOpacity style={styles.doneButton} onPress={() => {
              recordSessionResult({
                mode: GAME_MODE.PRACTICE,
                deckId: deckId,
                xpEarned: practiceXp,
                cardsAttempted: currentBattle.totalRounds,
                correctCount: currentBattle.playerScore,
                timestampISO: new Date().toISOString(),
              });
              logger.log('[Practice] Recorded session result, xp:', practiceXp);
              endBattle();
              router.back();
            }}>
              <Text style={styles.doneButtonText}>Done</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={isDark ? ['#0f172a', '#1e293b'] : ['#4338ca', '#6366f1']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleQuit} style={styles.quitButton}>
            <X color="#fff" size={24} />
          </TouchableOpacity>
          <View style={styles.roundBadge}>
            <Text style={styles.roundText}>
              {currentBattle.currentRound + 1}/{currentBattle.totalRounds}
            </Text>
          </View>
          {playerStreak > 0 && <StreakIndicator streak={playerStreak} showMultiplier={false} />}
          {playerStreak === 0 && <View style={styles.placeholder} />}
        </View>

        <View style={styles.scoreBoard}>
          <View style={styles.scoreItem}>
            <View style={[styles.scoreAvatar, { backgroundColor: '#10b981' }]}>
              <User color="#fff" size={20} />
            </View>
            <Text style={styles.scorePlayerLabel}>You</Text>
            <Animated.Text style={[styles.scorePlayerValue, { transform: [{ scale: scorePopAnim }] }]}>
              {currentBattle.playerScore}
            </Animated.Text>
          </View>
          <View style={styles.vsContainer}>
            <Swords color="rgba(255,255,255,0.6)" size={24} />
          </View>
          <View style={styles.scoreItem}>
            <View style={[styles.scoreAvatar, { backgroundColor: '#ef4444' }]}>
              <Bot color="#fff" size={20} />
            </View>
            <Text style={styles.scorePlayerLabel}>{currentBattle.opponentName}</Text>
            <Text style={styles.scorePlayerValue}>{currentBattle.opponentScore}</Text>
          </View>
        </View>

        {gamePhase === 'player-turn' && (
          <View style={styles.timerSection}>
            <TimerProgressBar 
              timeRemaining={timeLeft} 
              totalTime={QUESTION_TIME}
              isUrgent={true}
            />
          </View>
        )}

        <View style={styles.content}>
          <View style={[styles.questionCard, { backgroundColor: isDark ? theme.card : 'rgba(255, 255, 255, 0.97)' }]}>
            <Text style={[styles.questionText, { color: isDark ? theme.text : '#1a1a1a' }]}>
              {currentCard.question}
            </Text>
          </View>

          {gamePhase === 'player-turn' && (
            <Animated.View style={[styles.answerSection, { transform: [{ translateX: shakeAnim }] }]}>
              <View style={styles.turnIndicator}>
                <View style={[styles.turnDot, { backgroundColor: '#10b981' }]} />
                <Text style={styles.turnText}>
                  {currentBattle?.mode === 'multiplayer' ? `Player ${currentPlayer}'s Turn` : 'Your Turn'}
                </Text>
              </View>
              <TextInput
                style={[styles.answerInput, { 
                  backgroundColor: 'rgba(255, 255, 255, 0.12)',
                  borderColor: buttonState === 'correct' ? '#10b981' : buttonState === 'incorrect' ? '#ef4444' : 'rgba(255, 255, 255, 0.25)'
                }]}
                value={userAnswer}
                onChangeText={setUserAnswer}
                placeholder="Type your answer..."
                placeholderTextColor="rgba(255, 255, 255, 0.4)"
                autoCapitalize="none"
                autoCorrect={false}
                editable={currentBattle?.mode === 'multiplayer' ? (currentPlayer === 1 ? !player1Result : !player2Result) : !playerResult}
                onSubmitEditing={handleSubmitAnswer}
                returnKeyType="done"
              />
              <TouchableOpacity
                style={[
                  styles.submitButton,
                  userAnswer.trim() === '' && styles.submitButtonDisabled,
                  buttonState === 'correct' && styles.submitButtonCorrect,
                  buttonState === 'incorrect' && styles.submitButtonIncorrect,
                ]}
                onPress={handleSubmitAnswer}
                disabled={userAnswer.trim() === '' || (currentBattle?.mode === 'multiplayer' ? (currentPlayer === 1 ? player1Result !== null : player2Result !== null) : playerResult !== null)}
                activeOpacity={0.85}
              >
                <Text style={[
                  styles.submitButtonText,
                  buttonState !== 'idle' && styles.submitButtonTextWhite,
                ]}>
                  {buttonState === 'idle' ? 'Submit' : buttonState === 'correct' ? '✓ Correct!' : '✗ Wrong'}
                </Text>
              </TouchableOpacity>
            </Animated.View>
          )}

          {gamePhase === 'opponent-turn' && (
            <View style={styles.answerSection}>
              <View style={styles.turnIndicator}>
                <View style={[styles.turnDot, { backgroundColor: '#ef4444' }]} />
                <Text style={styles.turnText}>{currentBattle.opponentName}'s Turn</Text>
              </View>
              <View style={styles.waitingCard}>
                <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                  <Bot color="rgba(255,255,255,0.8)" size={48} />
                </Animated.View>
                <Text style={styles.waitingText}>Thinking...</Text>
              </View>
            </View>
          )}

          {gamePhase === 'reveal-results' && (
            <Animated.View style={[styles.resultsContainer, { opacity: feedbackOpacity, transform: [{ scale: feedbackScale }] }]}>
              <Text style={styles.resultsTitle}>Round Results</Text>
              
              {currentBattle?.mode === 'multiplayer' ? (
                <>
                  <View style={[styles.resultCard, player1Result?.isCorrect && styles.resultCardCorrect]}>
                    <View style={styles.resultHeader}>
                      <User color="#fff" size={18} />
                      <Text style={styles.resultPlayerName}>Player 1</Text>
                    </View>
                    <View style={[styles.resultBadge, player1Result?.isCorrect ? styles.resultBadgeCorrect : styles.resultBadgeIncorrect]}>
                      <Text style={styles.resultBadgeText}>
                        {player1Result?.isCorrect ? '✓ Correct' : '✗ Wrong'}
                      </Text>
                    </View>
                  </View>

                  <View style={[styles.resultCard, player2Result?.isCorrect && styles.resultCardCorrect]}>
                    <View style={styles.resultHeader}>
                      <User color="#fff" size={18} />
                      <Text style={styles.resultPlayerName}>Player 2</Text>
                    </View>
                    <View style={[styles.resultBadge, player2Result?.isCorrect ? styles.resultBadgeCorrect : styles.resultBadgeIncorrect]}>
                      <Text style={styles.resultBadgeText}>
                        {player2Result?.isCorrect ? '✓ Correct' : '✗ Wrong'}
                      </Text>
                    </View>
                  </View>
                </>
              ) : (
                <>
                  <View style={[styles.resultCard, playerResult?.isCorrect && styles.resultCardCorrect]}>
                    <View style={styles.resultHeader}>
                      <User color="#fff" size={18} />
                      <Text style={styles.resultPlayerName}>You</Text>
                    </View>
                    <View style={[styles.resultBadge, playerResult?.isCorrect ? styles.resultBadgeCorrect : styles.resultBadgeIncorrect]}>
                      <Text style={styles.resultBadgeText}>
                        {playerResult?.isCorrect ? '✓ Correct' : '✗ Wrong'}
                      </Text>
                    </View>
                  </View>

                  <View style={[styles.resultCard, opponentResult?.isCorrect && styles.resultCardCorrect]}>
                    <View style={styles.resultHeader}>
                      <Bot color="#fff" size={18} />
                      <Text style={styles.resultPlayerName}>{currentBattle.opponentName}</Text>
                    </View>
                    <View style={[styles.resultBadge, opponentResult?.isCorrect ? styles.resultBadgeCorrect : styles.resultBadgeIncorrect]}>
                      <Text style={styles.resultBadgeText}>
                        {opponentResult?.isCorrect ? '✓ Correct' : '✗ Wrong'}
                      </Text>
                    </View>
                  </View>
                </>
              )}

              <View style={[styles.correctAnswerCard, { backgroundColor: isDark ? theme.card : 'rgba(255, 255, 255, 0.97)' }]}>
                <Text style={[styles.correctAnswerLabel, { color: isDark ? theme.textSecondary : '#666' }]}>
                  Correct Answer
                </Text>
                <Text style={[styles.correctAnswerText, { color: isDark ? theme.text : '#1a1a1a' }]}>
                  {currentCard.answer}
                </Text>
              </View>

              <TouchableOpacity style={styles.nextButton} onPress={handleNext} activeOpacity={0.85}>
                <Zap color="#4338ca" size={20} />
                <Text style={styles.nextButtonText}>Next Question</Text>
              </TouchableOpacity>
            </Animated.View>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#4338ca',
  },
  safeArea: {
    flex: 1,
  },
  errorText: {
    color: '#fff',
    fontSize: 18,
    textAlign: 'center',
    marginTop: 100,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  quitButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  roundBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 16,
  },
  roundText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#fff',
  },
  placeholder: {
    width: 42,
  },
  scoreBoard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    marginTop: 8,
    marginBottom: 16,
    gap: 20,
  },
  scoreItem: {
    alignItems: 'center',
    flex: 1,
  },
  scoreAvatar: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  scorePlayerLabel: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 4,
    fontWeight: '600' as const,
  },
  scorePlayerValue: {
    fontSize: 36,
    fontWeight: '800' as const,
    color: '#fff',
  },
  vsContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  timerSection: {
    marginBottom: 16,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  questionCard: {
    borderRadius: 24,
    padding: 28,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 10,
    minHeight: 120,
    justifyContent: 'center',
  },
  questionText: {
    fontSize: 21,
    fontWeight: '700' as const,
    lineHeight: 30,
    textAlign: 'center',
  },
  answerSection: {
    flex: 1,
  },
  turnIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 20,
  },
  turnDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  turnText: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#fff',
  },
  answerInput: {
    borderRadius: 18,
    padding: 20,
    fontSize: 18,
    color: '#fff',
    fontWeight: '600' as const,
    marginBottom: 16,
    borderWidth: 2,
  },
  submitButton: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 18,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#4338ca',
  },
  submitButtonCorrect: {
    backgroundColor: '#10b981',
  },
  submitButtonIncorrect: {
    backgroundColor: '#ef4444',
  },
  submitButtonTextWhite: {
    color: '#fff',
  },
  waitingCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 24,
    padding: 48,
    alignItems: 'center',
    gap: 16,
  },
  waitingText: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  resultsContainer: {
    flex: 1,
    gap: 12,
  },
  resultsTitle: {
    fontSize: 22,
    fontWeight: '800' as const,
    color: '#fff',
    textAlign: 'center',
    marginBottom: 8,
  },
  resultCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 18,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  resultCardCorrect: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.4)',
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  resultPlayerName: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#fff',
  },
  resultBadge: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
  },
  resultBadgeCorrect: {
    backgroundColor: '#10b981',
  },
  resultBadgeIncorrect: {
    backgroundColor: '#ef4444',
  },
  resultBadgeText: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#fff',
  },
  correctAnswerCard: {
    borderRadius: 18,
    padding: 20,
    marginTop: 8,
    alignItems: 'center',
  },
  correctAnswerLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  correctAnswerText: {
    fontSize: 20,
    fontWeight: '700' as const,
  },
  nextButton: {
    backgroundColor: '#fff',
    borderRadius: 18,
    paddingHorizontal: 40,
    paddingVertical: 18,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginTop: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  nextButtonText: {
    fontSize: 18,
    fontWeight: '800' as const,
    color: '#4338ca',
  },
  resultContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  resultTitle: {
    fontSize: 40,
    fontWeight: '800' as const,
    color: '#fff',
    marginTop: 24,
    marginBottom: 8,
  },
  resultSubtitle: {
    fontSize: 17,
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: 40,
    textAlign: 'center',
    fontWeight: '600' as const,
  },
  finalScoreCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.97)',
    borderRadius: 24,
    padding: 28,
    width: '100%',
    marginBottom: 32,
  },
  scoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  scoreLabel: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#333',
  },
  scoreValue: {
    fontSize: 32,
    fontWeight: '800' as const,
    color: '#333',
  },
  scoreDivider: {
    height: 1,
    backgroundColor: '#e5e7eb',
    marginVertical: 18,
  },
  doneButton: {
    backgroundColor: '#fff',
    borderRadius: 18,
    paddingHorizontal: 48,
    paddingVertical: 18,
    width: '100%',
  },
  doneButtonText: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#4338ca',
    textAlign: 'center',
  },
});
