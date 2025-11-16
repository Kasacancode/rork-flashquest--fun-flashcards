import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Trophy, X, Clock, User, Bot } from 'lucide-react-native';
import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Vibration, Platform, TextInput, Keyboard } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

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

  const scaleAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(1)).current;


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
      setGamePhase('reveal-results');
    }, 1500);
  }, [currentCard, currentDuel]);

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
    progressAnim.setValue(1);
  }, [currentCard, progressAnim]);

  useEffect(() => {
    if (gamePhase === 'opponent-turn') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      pulseAnim.stopAnimation();
      pulseAnim.setValue(1);
    }
  }, [gamePhase, pulseAnim]);

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
          if (Platform.OS !== 'web') {
            Vibration.vibrate(200);
          }
          
          setTimeout(() => {
            setCurrentPlayer(2);
            setUserAnswer('');
            setButtonState('idle');
            setTimeLeft(QUESTION_TIME);
            progressAnim.setValue(1);
          }, 1500);
        } else {
          setPlayer2Result({
            name: 'Player 2',
            answer: userAnswer.trim() || '(No answer)',
            isCorrect: correct,
            timeUsed: QUESTION_TIME,
          });
          setButtonState('incorrect');
          if (Platform.OS !== 'web') {
            Vibration.vibrate(200);
          }
          
          setTimeout(() => {
            setGamePhase('reveal-results');
          }, 1500);
        }
      } else {
        setPlayerResult({
          answer: userAnswer.trim() || '(No answer)',
          isCorrect: correct,
          timeUsed: QUESTION_TIME,
        });
        setButtonState('incorrect');
        if (Platform.OS !== 'web') {
          Vibration.vibrate(200);
        }
        
        setTimeout(() => {
          setGamePhase('opponent-turn');
          setTimeLeft(QUESTION_TIME);
          progressAnim.setValue(1);
        }, 1500);
      }
    } else if (gamePhase === 'opponent-turn') {
      simulateOpponentAnswer();
    }
  }, [gamePhase, userAnswer, progressAnim, simulateOpponentAnswer, currentDuel, currentPlayer]);

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

    Animated.timing(progressAnim, {
      toValue: 0,
      duration: QUESTION_TIME * 1000,
      useNativeDriver: false,
    }).start();

    return () => clearInterval(timer);
  }, [currentCard, gamePhase, progressAnim, handleTimeUp]);

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
          Vibration.vibrate(correct ? [0, 100] : [0, 100, 100, 100]);
        }

        Animated.sequence([
          Animated.spring(scaleAnim, {
            toValue: 1.05,
            useNativeDriver: true,
            speed: 50,
          }),
          Animated.spring(scaleAnim, {
            toValue: 1,
            useNativeDriver: true,
            speed: 50,
          }),
        ]).start();

        setTimeout(() => {
          setCurrentPlayer(2);
          setUserAnswer('');
          setButtonState('idle');
          setTimeLeft(QUESTION_TIME);
          progressAnim.setValue(1);
        }, 1500);
      } else {
        setPlayer2Result({
          name: 'Player 2',
          answer: userAnswer.trim(),
          isCorrect: correct,
          timeUsed,
        });
        setButtonState(correct ? 'correct' : 'incorrect');

        if (Platform.OS !== 'web') {
          Vibration.vibrate(correct ? [0, 100] : [0, 100, 100, 100]);
        }

        Animated.sequence([
          Animated.spring(scaleAnim, {
            toValue: 1.05,
            useNativeDriver: true,
            speed: 50,
          }),
          Animated.spring(scaleAnim, {
            toValue: 1,
            useNativeDriver: true,
            speed: 50,
          }),
        ]).start();

        setTimeout(() => {
          setGamePhase('reveal-results');
        }, 1500);
      }
    } else {
      setPlayerResult({
        answer: userAnswer.trim(),
        isCorrect: correct,
        timeUsed,
      });
      setButtonState(correct ? 'correct' : 'incorrect');

      if (Platform.OS !== 'web') {
        Vibration.vibrate(correct ? [0, 100] : [0, 100, 100, 100]);
      }

      Animated.sequence([
        Animated.spring(scaleAnim, {
          toValue: 1.05,
          useNativeDriver: true,
          speed: 50,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          useNativeDriver: true,
          speed: 50,
        }),
      ]).start();

      setTimeout(() => {
        setGamePhase('opponent-turn');
        setTimeLeft(QUESTION_TIME);
        progressAnim.setValue(1);
        
        setTimeout(() => {
          simulateOpponentAnswer();
        }, Math.random() * 8000 + 2000);
      }, 1500);
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
  };

  const handleQuit = () => {
    endDuel();
    router.back();
  };



  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  if (currentDuel.status === 'completed') {
    const won = currentDuel.playerScore > currentDuel.opponentScore;

    return (
      <View style={styles.container}>
        <LinearGradient
          colors={won ? ['#FFD93D', '#F6C23E'] : isDark ? ['#1a1a2e', '#16213e'] : ['#667eea', '#764ba2']}
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
                <Text style={styles.scoreValue}>{currentDuel.playerScore}</Text>
              </View>
              <View style={styles.scoreDivider} />
              <View style={styles.scoreRow}>
                <Text style={styles.scoreLabel}>{currentDuel.opponentName}</Text>
                <Text style={styles.scoreValue}>{currentDuel.opponentScore}</Text>
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
        colors={isDark ? ['#0f0f1e', '#1a1a2e'] : ['#46178F', '#5C2BA8']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleQuit} style={styles.quitButton}>
            <X color="#fff" size={28} strokeWidth={2.5} />
          </TouchableOpacity>
          <View style={styles.roundIndicator}>
            <Text style={styles.roundText}>
              {currentDuel.currentRound + 1}/{currentDuel.totalRounds}
            </Text>
          </View>
          <View style={styles.placeholder} />
        </View>

        <View style={styles.progressBarContainer}>
          <Animated.View style={[styles.progressBar, { width: progressWidth }]} />
        </View>

        <View style={styles.timerContainer}>
          <Clock color={timeLeft <= 5 ? '#FF6B6B' : '#fff'} size={24} strokeWidth={2.5} />
          <Text style={[styles.timerText, timeLeft <= 5 && styles.timerWarning]}>
            {timeLeft}s
          </Text>
        </View>

        <View style={styles.scoreBoard}>
          <View style={styles.scoreItem}>
            <Text style={styles.scorePlayerLabel}>You</Text>
            <Animated.Text style={[styles.scorePlayerValue, { transform: [{ scale: scaleAnim }] }]}>
              {currentDuel.playerScore}
            </Animated.Text>
          </View>
          <Text style={styles.scoreVs}>VS</Text>
          <View style={styles.scoreItem}>
            <Text style={styles.scorePlayerLabel}>{currentDuel.opponentName}</Text>
            <Text style={styles.scorePlayerValue}>{currentDuel.opponentScore}</Text>
          </View>
        </View>

        <View style={styles.content}>
          <View style={[styles.questionCard, { backgroundColor: isDark ? theme.card : 'rgba(255, 255, 255, 0.95)' }]}>
            <Text style={[styles.questionText, { color: isDark ? '#1a1a2e' : '#333' }]}>{currentCard.question}</Text>
          </View>

          {gamePhase === 'player-turn' && (
            <View style={styles.answerSection}>
              <View style={styles.turnIndicator}>
                <User color="#fff" size={24} strokeWidth={2.5} />
                <Text style={styles.turnText}>
                  {currentDuel?.mode === 'multiplayer' ? `Player ${currentPlayer}'s Turn` : 'Your Turn'}
                </Text>
              </View>
              <Text style={styles.answerLabel}>Type your answer:</Text>
              <TextInput
                style={[styles.answerInput, { 
                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.15)',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.3)'
                }]}
                value={userAnswer}
                onChangeText={setUserAnswer}
                placeholder="Enter answer..."
                placeholderTextColor="rgba(255, 255, 255, 0.5)"
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
              >
                <Text style={[
                  styles.submitButtonText,
                  (buttonState === 'correct' || buttonState === 'incorrect') && styles.submitButtonTextWhite,
                ]}>
                  {buttonState === 'idle' && 'Submit'}
                  {buttonState === 'correct' && '✓ Correct!'}
                  {buttonState === 'incorrect' && '✗ Wrong'}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {gamePhase === 'opponent-turn' && (
            <View style={styles.answerSection}>
              <View style={styles.turnIndicator}>
                <Bot color="#fff" size={24} strokeWidth={2.5} />
                <Text style={styles.turnText}>{currentDuel.opponentName}&apos;s Turn</Text>
              </View>
              <View style={styles.waitingCard}>
                <Text style={styles.waitingText}>Waiting for opponent...</Text>
                <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                  <Text style={styles.waitingEmoji}>⏳</Text>
                </Animated.View>
              </View>
            </View>
          )}

          {gamePhase === 'reveal-results' && (
            <Animated.View style={[styles.resultsContainer, { transform: [{ scale: scaleAnim }] }]}>
              <Text style={styles.resultsTitle}>Round Results</Text>
              
              {currentDuel?.mode === 'multiplayer' ? (
                <>
                  <View style={styles.resultCard}>
                    <View style={styles.resultHeader}>
                      <User color="#fff" size={20} strokeWidth={2.5} />
                      <Text style={styles.resultPlayerName}>Player 1</Text>
                    </View>
                    <View style={[styles.resultBadge, player1Result?.isCorrect ? styles.resultBadgeCorrect : styles.resultBadgeIncorrect]}>
                      <Text style={styles.resultBadgeText}>
                        {player1Result?.isCorrect ? '✓ Correct' : '✗ Wrong'}
                      </Text>
                    </View>
                    {!player1Result?.isCorrect && (
                      <Text style={styles.resultAnswer}>Answer: {player1Result?.answer}</Text>
                    )}
                  </View>

                  <View style={styles.resultCard}>
                    <View style={styles.resultHeader}>
                      <User color="#fff" size={20} strokeWidth={2.5} />
                      <Text style={styles.resultPlayerName}>Player 2</Text>
                    </View>
                    <View style={[styles.resultBadge, player2Result?.isCorrect ? styles.resultBadgeCorrect : styles.resultBadgeIncorrect]}>
                      <Text style={styles.resultBadgeText}>
                        {player2Result?.isCorrect ? '✓ Correct' : '✗ Wrong'}
                      </Text>
                    </View>
                    {!player2Result?.isCorrect && (
                      <Text style={styles.resultAnswer}>Answer: {player2Result?.answer}</Text>
                    )}
                  </View>
                </>
              ) : (
                <>
                  <View style={styles.resultCard}>
                    <View style={styles.resultHeader}>
                      <User color="#fff" size={20} strokeWidth={2.5} />
                      <Text style={styles.resultPlayerName}>You</Text>
                    </View>
                    <View style={[styles.resultBadge, playerResult?.isCorrect ? styles.resultBadgeCorrect : styles.resultBadgeIncorrect]}>
                      <Text style={styles.resultBadgeText}>
                        {playerResult?.isCorrect ? '✓ Correct' : '✗ Wrong'}
                      </Text>
                    </View>
                    {!playerResult?.isCorrect && (
                      <Text style={styles.resultAnswer}>Your answer: {playerResult?.answer}</Text>
                    )}
                  </View>

                  <View style={styles.resultCard}>
                    <View style={styles.resultHeader}>
                      <Bot color="#fff" size={20} strokeWidth={2.5} />
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

              <View style={[styles.correctAnswerCard, { backgroundColor: isDark ? theme.card : 'rgba(255, 255, 255, 0.95)' }]}>
                <Text style={[styles.correctAnswerLabel, { color: isDark ? '#666' : '#666' }]}>Correct Answer:</Text>
                <Text style={[styles.correctAnswerText, { color: isDark ? '#1a1a2e' : '#333' }]}>{currentCard.answer}</Text>
              </View>

              <TouchableOpacity style={styles.nextButton} onPress={handleNext}>
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
    backgroundColor: '#4ECDC4',
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
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  quitButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  roundIndicator: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  roundText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#fff',
  },
  placeholder: {
    width: 40,
  },
  scoreBoard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 24,
    marginBottom: 32,
  },
  scoreItem: {
    alignItems: 'center',
  },
  scorePlayerLabel: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: 4,
    fontWeight: '600' as const,
  },
  scorePlayerValue: {
    fontSize: 40,
    fontWeight: '800' as const,
    color: '#fff',
  },
  scoreVs: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  questionCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 24,
    padding: 32,
    marginBottom: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 10,
  },
  questionLabel: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#4ECDC4',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  questionText: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: '#333',
    lineHeight: 32,
  },
  answerSection: {
    flex: 1,
  },
  answerLabel: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#fff',
    marginBottom: 16,
  },
  answerInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 16,
    padding: 20,
    fontSize: 20,
    color: '#fff',
    fontWeight: '600' as const,
    marginBottom: 20,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  submitButton: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#46178F',
  },
  submitButtonCorrect: {
    backgroundColor: '#26890C',
  },
  submitButtonIncorrect: {
    backgroundColor: '#DC3545',
  },
  submitButtonTextWhite: {
    color: '#fff',
  },
  turnIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 24,
    justifyContent: 'center',
  },
  turnText: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#fff',
  },
  waitingCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 20,
    padding: 40,
    alignItems: 'center',
    gap: 20,
  },
  waitingText: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: '#fff',
  },
  waitingEmoji: {
    fontSize: 48,
  },
  resultsContainer: {
    flex: 1,
    gap: 16,
  },
  resultsTitle: {
    fontSize: 24,
    fontWeight: '800' as const,
    color: '#fff',
    textAlign: 'center',
    marginBottom: 8,
  },
  resultCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 16,
    padding: 20,
    gap: 12,
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  resultPlayerName: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#fff',
  },
  resultBadge: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  resultBadgeCorrect: {
    backgroundColor: '#26890C',
  },
  resultBadgeIncorrect: {
    backgroundColor: '#DC3545',
  },
  resultBadgeText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#fff',
  },
  resultAnswer: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: 'rgba(255, 255, 255, 0.9)',
    fontStyle: 'italic',
  },
  correctAnswerCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 16,
    padding: 20,
    marginTop: 8,
  },
  correctAnswerLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#666',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  correctAnswerText: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#333',
  },

  nextButton: {
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingHorizontal: 48,
    paddingVertical: 20,
    alignItems: 'center',
    marginTop: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  nextButtonText: {
    fontSize: 20,
    fontWeight: '800' as const,
    color: '#46178F',
    textAlign: 'center',
  },
  resultContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  resultTitle: {
    fontSize: 42,
    fontWeight: '800' as const,
    color: '#fff',
    marginTop: 24,
    marginBottom: 8,
  },
  resultSubtitle: {
    fontSize: 18,
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: 40,
    textAlign: 'center',
    fontWeight: '600' as const,
  },
  finalScoreCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 24,
    padding: 32,
    width: '100%',
    marginBottom: 32,
  },
  scoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  scoreLabel: {
    fontSize: 20,
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
    backgroundColor: '#e0e0e0',
    marginVertical: 20,
  },
  doneButton: {
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingHorizontal: 48,
    paddingVertical: 16,
    width: '100%',
  },
  doneButtonText: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#667eea',
    textAlign: 'center',
  },
  progressBarContainer: {
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    marginHorizontal: 20,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#fff',
    borderRadius: 3,
  },
  timerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
    marginBottom: 8,
  },
  timerText: {
    fontSize: 28,
    fontWeight: '800' as const,
    color: '#fff',
  },
  timerWarning: {
    color: '#FF6B6B',
  },
  answersGrid: {
    gap: 12,
  },
  answerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    minHeight: 80,
  },
  answerShape: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  answerShapeText: {
    fontSize: 28,
    color: '#fff',
    fontWeight: '700' as const,
  },
  answerText: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#fff',
    lineHeight: 24,
  },
  answerCorrect: {
    backgroundColor: '#26890C',
  },
  answerIncorrect: {
    backgroundColor: '#666',
    opacity: 0.6,
  },
  answerIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  answerIconText: {
    fontSize: 20,
    color: '#fff',
    fontWeight: '700' as const,
  },
  feedbackCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 20,
    padding: 24,
    marginTop: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
  },
  feedbackHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  feedbackTitle: {
    fontSize: 28,
    fontWeight: '800' as const,
    color: '#333',
  },
  feedbackSubtitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: '#666',
    marginBottom: 20,
  },
  feedbackCorrect: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: '#666',
    marginTop: 8,
    marginBottom: 20,
  },
});
