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

export default function DuelSessionPage() {
  const router = useRouter();
  const { deckId } = useLocalSearchParams<{ deckId: string }>();
  const { decks, currentDuel, updateDuel, endDuel } = useFlashQuest();
  const { theme, isDark } = useTheme();

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

  const scaleAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const feedbackOpacity = useRef(new Animated.Value(0)).current;
  const feedbackScale = useRef(new Animated.Value(0.8)).current;
  const scorePopAnim = useRef(new Animated.Value(1)).current;

  const deck = useMemo(() => decks.find((d) => d.id === deckId), [decks, deckId]);
  
  const shuffledFlashcards = useMemo(() => {
    if (!deck || !currentDuel?.shuffled) return deck?.flashcards || [];
    const cards = [...deck.flashcards];
    for (let i = cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [cards[i], cards[j]] = [cards[j], cards[i]];
    }
    return cards;
  }, [deck, currentDuel?.shuffled]);
  
  const currentCard = useMemo(() => {
    if (!deck || !currentDuel) return null;
    return shuffledFlashcards[currentDuel.currentRound];
  }, [shuffledFlashcards, currentDuel]);

  const simulateOpponentAnswer = useCallback(() => {
    const correctChance = currentDuel?.mode === 'ai' ? 0.6 : 0.5;
    const opponentCorrect = Math.random() < correctChance;
    const opponentTime = Math.floor(Math.random() * 7) + 5;
    
    setOpponentResult({
      answer: opponentCorrect ? currentCard?.answer || '' : 'Wrong answer',
      isCorrect: opponentCorrect,
      timeUsed: opponentTime,
    });
    
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
  }, [currentCard, currentDuel, feedbackOpacity, feedbackScale]);

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
  }, [currentCard, feedbackOpacity, feedbackScale]);

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
      
      if (currentDuel?.mode === 'multiplayer') {
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
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
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
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
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
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
        
        setTimeout(() => {
          setGamePhase('opponent-turn');
          setTimeLeft(QUESTION_TIME);
        }, 1200);
      }
    } else if (gamePhase === 'opponent-turn') {
      simulateOpponentAnswer();
    }
  }, [gamePhase, userAnswer, simulateOpponentAnswer, currentDuel, currentPlayer, triggerShake, feedbackOpacity, feedbackScale]);

  useEffect(() => {
    if (gamePhase === 'reveal-results' || !currentCard) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          handleTimeUp();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [currentCard, gamePhase, handleTimeUp]);

  if (!deck || !currentDuel || !currentCard) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Duel not found</Text>
      </View>
    );
  }

  const handleSubmitAnswer = () => {
    if (gamePhase !== 'player-turn' || userAnswer.trim() === '') return;

    Keyboard.dismiss();
    const correct = userAnswer.trim().toLowerCase() === currentCard?.answer.toLowerCase();
    const timeUsed = QUESTION_TIME - timeLeft;

    if (currentDuel?.mode === 'multiplayer') {
      if (currentPlayer === 1) {
        setPlayer1Result({
          name: 'Player 1',
          answer: userAnswer.trim(),
          isCorrect: correct,
          timeUsed,
        });
        setButtonState(correct ? 'correct' : 'incorrect');

        if (Platform.OS !== 'web') {
          Haptics.notificationAsync(correct ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error);
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
          Haptics.notificationAsync(correct ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error);
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
        Haptics.notificationAsync(correct ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error);
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
    if (currentDuel?.mode === 'multiplayer') {
      updateDuel(player1Result?.isCorrect || false, player2Result?.isCorrect || false);
    } else {
      updateDuel(playerResult?.isCorrect || false, opponentResult?.isCorrect || false);
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
    endDuel();
    router.back();
  };

  if (currentDuel.status === 'completed') {
    const won = currentDuel.playerScore > currentDuel.opponentScore;

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
                <Text style={[styles.scoreValue, won && { color: '#10b981' }]}>{currentDuel.playerScore}</Text>
              </View>
              <View style={styles.scoreDivider} />
              <View style={styles.scoreRow}>
                <Text style={styles.scoreLabel}>{currentDuel.opponentName}</Text>
                <Text style={[styles.scoreValue, !won && { color: '#10b981' }]}>{currentDuel.opponentScore}</Text>
              </View>
            </View>

            <TouchableOpacity style={styles.doneButton} onPress={() => {
              endDuel();
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
              {currentDuel.currentRound + 1}/{currentDuel.totalRounds}
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
              {currentDuel.playerScore}
            </Animated.Text>
          </View>
          <View style={styles.vsContainer}>
            <Swords color="rgba(255,255,255,0.6)" size={24} />
          </View>
          <View style={styles.scoreItem}>
            <View style={[styles.scoreAvatar, { backgroundColor: '#ef4444' }]}>
              <Bot color="#fff" size={20} />
            </View>
            <Text style={styles.scorePlayerLabel}>{currentDuel.opponentName}</Text>
            <Text style={styles.scorePlayerValue}>{currentDuel.opponentScore}</Text>
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
                  {currentDuel?.mode === 'multiplayer' ? `Player ${currentPlayer}'s Turn` : 'Your Turn'}
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
                editable={currentDuel?.mode === 'multiplayer' ? (currentPlayer === 1 ? !player1Result : !player2Result) : !playerResult}
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
                disabled={userAnswer.trim() === '' || (currentDuel?.mode === 'multiplayer' ? (currentPlayer === 1 ? player1Result !== null : player2Result !== null) : playerResult !== null)}
                activeOpacity={0.85}
              >
                <Text style={[
                  styles.submitButtonText,
                  buttonState !== 'idle' && styles.submitButtonTextWhite,
                ]}>
                  {buttonState === 'idle' && 'Submit'}
                  {buttonState === 'correct' && '✓ Correct!'}
                  {buttonState === 'incorrect' && '✗ Wrong'}
                </Text>
              </TouchableOpacity>
            </Animated.View>
          )}

          {gamePhase === 'opponent-turn' && (
            <View style={styles.answerSection}>
              <View style={styles.turnIndicator}>
                <View style={[styles.turnDot, { backgroundColor: '#ef4444' }]} />
                <Text style={styles.turnText}>{currentDuel.opponentName}&apos;s Turn</Text>
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
              
              {currentDuel?.mode === 'multiplayer' ? (
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
                      <Text style={styles.resultPlayerName}>{currentDuel.opponentName}</Text>
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
