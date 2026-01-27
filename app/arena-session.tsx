import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { X, Hand, Zap, Trophy, Crown } from 'lucide-react-native';
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AnswerCard, getSuitForIndex, DealerReaction, getRandomDealerLine, AnswerCardState, CARD_GAP, CARD_PADDING, GRID_HORIZONTAL_MARGIN } from '@/components/AnswerCard';
import { DealerCountdownBar, MiniScoreboard, StreakIndicator } from '@/components/GameUI';
import { useFlashQuest } from '@/context/FlashQuestContext';
import { useTheme } from '@/context/ThemeContext';
import { ArenaLobbyState, ArenaPlayerResult, ArenaAnswer, ArenaMatchResult, Flashcard } from '@/types/flashcard';
import { generateOptions, checkAnswer } from '@/utils/questUtils';

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
  const [inputLocked, setInputLocked] = useState(false);

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
  
  const [dealerLine, setDealerLine] = useState<string>('');
  const [dealerReactionCorrect, setDealerReactionCorrect] = useState<boolean | undefined>(undefined);
  const lastDealerLineRef = useRef<string>('');

  const cardAnimations = useRef([
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
  ]).current;

  const cardScales = useRef([
    new Animated.Value(1),
    new Animated.Value(1),
    new Animated.Value(1),
    new Animated.Value(1),
  ]).current;

  const shakeAnims = useRef([
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
  ]).current;

  const feedbackOpacity = useRef(new Animated.Value(0)).current;
  const feedbackScale = useRef(new Animated.Value(0.8)).current;

  const currentPlayer = useMemo(() => {
    return lobby.players?.[currentPlayerIndex];
  }, [lobby.players, currentPlayerIndex]);

  const currentPlayerState = useMemo(() => {
    return playerStates[currentPlayerIndex];
  }, [playerStates, currentPlayerIndex]);

  const questionNumber = useMemo(() => {
    return currentRound * lobby.players.length + currentPlayerIndex + 1;
  }, [currentRound, currentPlayerIndex, lobby.players?.length]);

  const scoreboardPlayers = useMemo(() => {
    return playerStates.map(ps => ({
      id: ps.playerId,
      name: ps.playerName,
      color: ps.playerColor,
      points: ps.points,
    }));
  }, [playerStates]);

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
    setInputLocked(false);
    setRoundStartTime(Date.now());
    
    const line = getRandomDealerLine('idle', lastDealerLineRef.current);
    setDealerLine(line);
    lastDealerLineRef.current = line;
    setDealerReactionCorrect(undefined);

    if (lobby.settings.timerSeconds > 0) {
      setTimeRemaining(lobby.settings.timerSeconds);
    }

    cardAnimations.forEach((anim, index) => {
      anim.setValue(0);
      cardScales[index].setValue(1);
      shakeAnims[index].setValue(0);
      Animated.spring(anim, {
        toValue: 1,
        friction: 7,
        tension: 60,
        delay: index * 60,
        useNativeDriver: true,
      }).start();
    });

    feedbackOpacity.setValue(0);
    feedbackScale.setValue(0.8);
  }, [deck, allCards, lobby.settings, cardAnimations, cardScales, shakeAnims, feedbackOpacity, feedbackScale]);

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
    if (timeRemaining === 0 && gamePhase === 'question' && currentCard && !inputLocked) {
      handleTimeUp();
    }
  }, [timeRemaining, gamePhase, currentCard, inputLocked]);

  const handleTimeUp = useCallback(() => {
    if (gamePhase !== 'question' || !currentCard || inputLocked) return;

    setInputLocked(true);

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

    const correctIndex = options.findIndex(o => checkAnswer(o, currentCard.answer));
    if (correctIndex >= 0) {
      Animated.sequence([
        Animated.timing(cardScales[correctIndex], {
          toValue: 1.08,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.spring(cardScales[correctIndex], {
          toValue: 1,
          friction: 4,
          useNativeDriver: true,
        }),
      ]).start();
    }

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

    setGamePhase('feedback');
    
    const line = getRandomDealerLine('timeout', lastDealerLineRef.current);
    setDealerLine(line);
    lastDealerLineRef.current = line;
    setDealerReactionCorrect(false);

    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, [gamePhase, currentCard, roundStartTime, currentPlayerIndex, options, inputLocked, cardScales, feedbackOpacity, feedbackScale]);

  const handleOptionPress = useCallback((option: string, index: number) => {
    if (gamePhase !== 'question' || !currentCard || inputLocked) return;

    setInputLocked(true);

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    const correct = checkAnswer(option, currentCard.answer);
    const timeToAnswer = Date.now() - roundStartTime;

    setSelectedOption(option);
    setIsCorrect(correct);

    Animated.sequence([
      Animated.timing(cardScales[index], {
        toValue: 0.95,
        duration: 80,
        useNativeDriver: true,
      }),
      Animated.spring(cardScales[index], {
        toValue: correct ? 1.05 : 1,
        friction: 4,
        useNativeDriver: true,
      }),
    ]).start();

    if (!correct) {
      Animated.sequence([
        Animated.timing(shakeAnims[index], { toValue: 10, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnims[index], { toValue: -10, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnims[index], { toValue: 8, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnims[index], { toValue: -8, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnims[index], { toValue: 0, duration: 50, useNativeDriver: true }),
      ]).start();

      const correctIndex = options.findIndex(o => checkAnswer(o, currentCard.answer));
      if (correctIndex >= 0 && correctIndex !== index) {
        setTimeout(() => {
          Animated.sequence([
            Animated.timing(cardScales[correctIndex], {
              toValue: 1.08,
              duration: 150,
              useNativeDriver: true,
            }),
            Animated.spring(cardScales[correctIndex], {
              toValue: 1,
              friction: 4,
              useNativeDriver: true,
            }),
          ]).start();
        }, 200);
      }
    }

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

    setGamePhase('feedback');
    
    const lineType = correct ? 'correct' : 'wrong';
    const line = getRandomDealerLine(lineType, lastDealerLineRef.current);
    setDealerLine(line);
    lastDealerLineRef.current = line;
    setDealerReactionCorrect(correct);

    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(
        correct ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error
      );
    }
  }, [gamePhase, currentCard, roundStartTime, currentPlayerIndex, options, inputLocked, cardScales, shakeAnims, feedbackOpacity, feedbackScale]);

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

  const getCardState = (option: string, index: number): AnswerCardState => {
    if (!selectedOption && isCorrect === null) {
      return inputLocked ? 'disabled' : 'idle';
    }

    const isSelected = option === selectedOption;
    const isCorrectOption = currentCard && checkAnswer(option, currentCard.answer);

    if (isCorrectOption) {
      return 'correct';
    }
    if (isSelected && !isCorrect) {
      return 'wrong';
    }
    return 'disabled';
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
    const sortedPlayers = [...playerStates].sort((a, b) => b.points - a.points);
    const currentRank = sortedPlayers.findIndex(p => p.playerId === currentPlayer?.id) + 1;

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
                Q {questionNumber}/{totalQuestions}
              </Text>
            </View>
            <View style={styles.headerSpacer} />
          </View>

          <View style={styles.passDeviceContainer}>
            <Hand color="#fff" size={56} />
            <Text style={styles.passDeviceTitle}>Pass to {currentPlayer?.name}</Text>
            
            <View style={[styles.playerAvatarLarge, { backgroundColor: currentPlayer?.color }]}>
              <Text style={styles.playerInitialLarge}>
                {currentPlayer?.name.charAt(0).toUpperCase()}
              </Text>
            </View>

            <View style={styles.passDeviceStats}>
              <View style={styles.passDeviceStat}>
                <Text style={styles.passDeviceStatLabel}>Round</Text>
                <Text style={styles.passDeviceStatValue}>{currentRound + 1}/{totalQuestionsPerPlayer}</Text>
              </View>
              <View style={styles.passDeviceStatDivider} />
              <View style={styles.passDeviceStat}>
                <Text style={styles.passDeviceStatLabel}>Rank</Text>
                <Text style={styles.passDeviceStatValue}>#{currentRank}</Text>
              </View>
              <View style={styles.passDeviceStatDivider} />
              <View style={styles.passDeviceStat}>
                <Text style={styles.passDeviceStatLabel}>Score</Text>
                <Text style={styles.passDeviceStatValue}>{currentPlayerState?.points || 0}</Text>
              </View>
            </View>

            <View style={styles.passDeviceScoreboard}>
              <MiniScoreboard 
                players={scoreboardPlayers} 
                currentPlayerId={currentPlayer?.id}
              />
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
                <Zap color="#fff" size={22} />
                <Text style={styles.readyButtonText}>Ready!</Text>
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
        <View style={styles.gameHeader}>
          <TouchableOpacity style={styles.quitButton} onPress={handleQuit} activeOpacity={0.7}>
            <X color="#fff" size={20} />
          </TouchableOpacity>

          <View style={styles.questionBadge}>
            <Text style={styles.questionBadgeText}>{questionNumber}/{totalQuestions}</Text>
          </View>

          {currentPlayerState?.currentStreak > 0 && (
            <StreakIndicator streak={currentPlayerState.currentStreak} showMultiplier={false} />
          )}

          <View style={styles.leaderBadge}>
            <Crown color="#f59e0b" size={12} />
            <Text style={styles.leaderBadgeText}>
              {[...playerStates].sort((a, b) => b.points - a.points)[0]?.playerName.slice(0, 5)}: {[...playerStates].sort((a, b) => b.points - a.points)[0]?.points}
            </Text>
          </View>
        </View>

        <View style={styles.currentPlayerBanner}>
          <View style={[styles.currentPlayerDot, { backgroundColor: currentPlayer?.color }]} />
          <Text style={styles.currentPlayerName}>{currentPlayer?.name}</Text>
          <Text style={styles.currentPlayerScore}>{currentPlayerState?.points || 0} pts</Text>
        </View>

        {dealerLine && gamePhase === 'question' && (
          <View style={styles.dealerSection}>
            <DealerReaction text={dealerLine} isCorrect={dealerReactionCorrect} />
          </View>
        )}

        <View style={[styles.questionCard, { backgroundColor: 'rgba(255,255,255,0.95)' }]}>
          {lobby.settings.timerSeconds > 0 && timeRemaining !== null && (
            <View style={styles.inlineTimer}>
              <DealerCountdownBar 
                timeRemaining={timeRemaining} 
                totalTime={lobby.settings.timerSeconds}
              />
            </View>
          )}
          <Text style={styles.questionText} numberOfLines={3}>
            {currentCard?.question}
          </Text>
        </View>

        <View style={styles.gameArea}>
          <View style={styles.tableSurface}>
            <View style={styles.optionsGrid}>
              {options.map((option, index) => (
                <AnswerCard
                  key={index}
                  optionText={option}
                  suit={getSuitForIndex(index)}
                  index={index}
                  state={getCardState(option, index)}
                  onPress={() => handleOptionPress(option, index)}
                  animatedScale={cardScales[index]}
                  animatedShake={shakeAnims[index]}
                  animatedOpacity={cardAnimations[index]}
                />
              ))}
            </View>
          </View>

          <View style={styles.compactScoreboard}>
            {scoreboardPlayers.slice(0, 3).map((player, index) => (
              <View 
                key={player.id} 
                style={[
                  styles.compactScoreItem,
                  player.id === currentPlayer?.id && styles.compactScoreItemActive
                ]}
              >
                <Text style={styles.compactRank}>{index === 0 ? '👑' : `#${index + 1}`}</Text>
                <View style={[styles.compactDot, { backgroundColor: player.color }]} />
                <Text style={styles.compactName} numberOfLines={1}>{player.name}</Text>
                <Text style={styles.compactPoints}>{player.points}</Text>
              </View>
            ))}
          </View>
        </View>

        {gamePhase === 'feedback' && (
          <Animated.View 
            style={[
              styles.feedbackOverlay,
              { opacity: feedbackOpacity, transform: [{ scale: feedbackScale }] }
            ]}
          >
            <View style={[styles.feedbackCard, { backgroundColor: theme.cardBackground }]}>
              <View style={[styles.feedbackIconCircle, { backgroundColor: isCorrect ? '#10b981' : '#ef4444' }]}>
                <Text style={styles.feedbackIconText}>{isCorrect ? '✓' : '✗'}</Text>
              </View>
              <Text style={[styles.feedbackTitle, { color: isCorrect ? '#10b981' : '#ef4444' }]}>
                {isCorrect ? 'Correct!' : timeRemaining === 0 ? "Time's Up!" : 'Incorrect'}
              </Text>
              {!isCorrect && currentCard && (
                <View style={styles.feedbackAnswerBox}>
                  <Text style={[styles.feedbackAnswerLabel, { color: theme.textSecondary }]}>
                    Correct answer:
                  </Text>
                  <Text style={[styles.feedbackAnswer, { color: theme.text }]}>
                    {currentCard.answer}
                  </Text>
                </View>
              )}
              {isCorrect && currentPlayerState?.currentStreak > 1 && (
                <View style={styles.feedbackStreakBadge}>
                  <Trophy color="#f59e0b" size={18} />
                  <Text style={styles.feedbackStreakText}>
                    {currentPlayerState.currentStreak} in a row!
                  </Text>
                </View>
              )}
              <TouchableOpacity
                style={[styles.continueButton, { backgroundColor: theme.primary }]}
                onPress={handleContinue}
                activeOpacity={0.85}
              >
                <Text style={styles.continueButtonText}>Continue</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
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
    paddingVertical: 10,
  },
  quitButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
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
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#fff',
  },
  gameHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 8,
  },
  questionBadge: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  questionBadgeText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700' as const,
  },
  leaderBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 10,
  },
  leaderBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600' as const,
  },
  currentPlayerBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 12,
    marginBottom: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 12,
  },
  currentPlayerDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  currentPlayerName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700' as const,
  },
  currentPlayerScore: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 13,
    fontWeight: '600' as const,
    marginLeft: 'auto',
  },
  dealerSection: {
    marginBottom: 4,
  },
  gameArea: {
    flex: 1,
    justifyContent: 'flex-start',
  },
  tableSurface: {
    backgroundColor: 'rgba(0, 50, 35, 0.3)',
    marginHorizontal: GRID_HORIZONTAL_MARGIN,
    borderRadius: 14,
    padding: CARD_PADDING,
  },
  questionCard: {
    marginHorizontal: GRID_HORIZONTAL_MARGIN,
    marginBottom: 8,
    borderRadius: 14,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
  },
  inlineTimer: {
    marginBottom: 8,
    marginHorizontal: -4,
  },
  questionText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#1a1a1a',
    textAlign: 'center',
    lineHeight: 22,
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: CARD_GAP,
    justifyContent: 'space-between',
  },
  compactScoreboard: {
    flexDirection: 'row',
    marginHorizontal: GRID_HORIZONTAL_MARGIN,
    marginTop: 10,
    gap: 6,
  },
  compactScoreItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 8,
    gap: 4,
  },
  compactScoreItemActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  compactRank: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  compactDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  compactName: {
    flex: 1,
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.85)',
    fontWeight: '500' as const,
  },
  compactPoints: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '700' as const,
  },
  passDeviceContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  passDeviceTitle: {
    fontSize: 26,
    fontWeight: '800' as const,
    color: '#fff',
    marginTop: 20,
    marginBottom: 16,
    textAlign: 'center',
  },
  playerAvatarLarge: {
    width: 90,
    height: 90,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 4,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  playerInitialLarge: {
    fontSize: 42,
    fontWeight: '700' as const,
    color: '#fff',
  },
  passDeviceStats: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  passDeviceStat: {
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  passDeviceStatLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    fontWeight: '500' as const,
    marginBottom: 4,
  },
  passDeviceStatValue: {
    fontSize: 20,
    color: '#fff',
    fontWeight: '800' as const,
  },
  passDeviceStatDivider: {
    width: 1,
    height: 32,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  passDeviceScoreboard: {
    width: '100%',
    marginBottom: 24,
  },
  readyButton: {
    width: '100%',
    maxWidth: 260,
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  readyButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 18,
  },
  readyButtonText: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#fff',
  },
  feedbackOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  feedbackCard: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 28,
    padding: 32,
    alignItems: 'center',
  },
  feedbackIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  feedbackIconText: {
    fontSize: 32,
    fontWeight: '700' as const,
    color: '#fff',
  },
  feedbackTitle: {
    fontSize: 28,
    fontWeight: '800' as const,
    marginBottom: 12,
  },
  feedbackAnswerBox: {
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    width: '100%',
    alignItems: 'center',
  },
  feedbackAnswerLabel: {
    fontSize: 13,
    fontWeight: '500' as const,
    marginBottom: 6,
  },
  feedbackAnswer: {
    fontSize: 17,
    fontWeight: '700' as const,
    textAlign: 'center',
  },
  feedbackStreakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
    marginBottom: 16,
  },
  feedbackStreakText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#f59e0b',
  },
  continueButton: {
    paddingVertical: 16,
    paddingHorizontal: 48,
    borderRadius: 16,
    marginTop: 8,
  },
  continueButtonText: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: '#fff',
  },
});
