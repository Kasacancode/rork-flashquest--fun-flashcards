import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { X, Hand, Zap, Users, Trophy } from 'lucide-react-native';
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, Animated, Modal, Dimensions, ScrollView } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { getSuitForIndex, getRandomDealerLine, CARD_GAP, CARD_PADDING, GRID_HORIZONTAL_MARGIN } from '@/components/AnswerCard';
import { DealerCountdownBar, MiniScoreboard } from '@/components/GameUI';
import { useFlashQuest } from '@/context/FlashQuestContext';
import { useTheme } from '@/context/ThemeContext';
import { ArenaLobbyState, ArenaPlayerResult, ArenaAnswer, ArenaMatchResult, Flashcard } from '@/types/flashcard';
import { generateOptions, checkAnswer } from '@/utils/questUtils';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type GamePhase = 'pass-device' | 'question' | 'feedback';
type CardState = 'idle' | 'selected' | 'correct' | 'wrong' | 'disabled';

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

interface PlayerScore {
  id: string;
  name: string;
  color: string;
  points: number;
}

const CARD_BACKGROUNDS = [
  { bg: '#fefefe', border: '#e5e5e5', accent: 'rgba(0,0,0,0.02)' },
  { bg: '#fefefe', border: '#e5e5e5', accent: 'rgba(0,0,0,0.02)' },
  { bg: '#fefefe', border: '#e5e5e5', accent: 'rgba(0,0,0,0.02)' },
  { bg: '#fefefe', border: '#e5e5e5', accent: 'rgba(0,0,0,0.02)' },
];

const SUIT_COLORS: Record<string, string> = {
  '♠': '#374151',
  '♥': '#dc2626',
  '♦': '#dc2626',
  '♣': '#374151',
};

const AVAILABLE_WIDTH = SCREEN_WIDTH - (GRID_HORIZONTAL_MARGIN * 2) - (CARD_PADDING * 2) - CARD_GAP;
const CARD_WIDTH = Math.floor(AVAILABLE_WIDTH / 2);
const CARD_HEIGHT = Math.min(CARD_WIDTH * 0.85, 115);

function AnswerCardNew({
  optionText,
  suit,
  index,
  state,
  onPress,
  animatedScale,
  animatedShake,
}: {
  optionText: string;
  suit: string;
  index: number;
  state: CardState;
  onPress: () => void;
  animatedScale?: Animated.Value;
  animatedShake?: Animated.Value;
}) {
  const localScale = useRef(new Animated.Value(1)).current;
  const tiltAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

  const scale = animatedScale || localScale;
  const shake = animatedShake || new Animated.Value(0);

  useEffect(() => {
    if (state === 'correct') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, { toValue: 1, duration: 500, useNativeDriver: false }),
          Animated.timing(glowAnim, { toValue: 0.5, duration: 500, useNativeDriver: false }),
        ])
      ).start();
    } else {
      glowAnim.stopAnimation();
      glowAnim.setValue(0);
    }
  }, [state, glowAnim]);

  const handlePressIn = () => {
    if (state === 'idle') {
      Animated.parallel([
        Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, speed: 50 }),
        Animated.timing(tiltAnim, { toValue: 1, duration: 80, useNativeDriver: true }),
      ]).start();
    }
  };

  const handlePressOut = () => {
    if (state === 'idle') {
      Animated.parallel([
        Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 4 }),
        Animated.timing(tiltAnim, { toValue: 0, duration: 120, useNativeDriver: true }),
      ]).start();
    }
  };

  const handlePress = () => {
    if (state !== 'idle') return;
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    onPress();
  };

  const cardColors = CARD_BACKGROUNDS[index % CARD_BACKGROUNDS.length];
  const suitColor = SUIT_COLORS[suit] || '#374151';

  const getCardStyle = () => {
    switch (state) {
      case 'correct':
        return { bg: '#dcfce7', border: '#22c55e', shadow: '#22c55e' };
      case 'wrong':
        return { bg: '#fee2e2', border: '#ef4444', shadow: '#ef4444' };
      case 'selected':
        return { bg: '#fef3c7', border: '#f59e0b', shadow: '#f59e0b' };
      case 'disabled':
        return { bg: cardColors.bg, border: cardColors.border, shadow: '#000', opacity: 0.45 };
      default:
        return { bg: cardColors.bg, border: cardColors.border, shadow: '#000', opacity: 1 };
    }
  };

  const cardStyle = getCardStyle();

  return (
    <Animated.View
      style={[
        cardStyles.wrapper,
        {
          transform: [{ scale }, { translateX: shake }],
          opacity: cardStyle.opacity ?? 1,
        },
      ]}
    >
      <TouchableOpacity
        style={[
          cardStyles.card,
          {
            backgroundColor: cardStyle.bg,
            borderColor: cardStyle.border,
            shadowColor: cardStyle.shadow,
          },
        ]}
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={1}
        disabled={state !== 'idle'}
      >
        <View style={cardStyles.suitTop}>
          <Text style={[cardStyles.suitText, { color: suitColor }]}>{suit}</Text>
        </View>
        <View style={cardStyles.suitBottom}>
          <Text style={[cardStyles.suitText, cardStyles.suitRotated, { color: suitColor }]}>{suit}</Text>
        </View>

        <View style={cardStyles.content}>
          <Text
            style={[
              cardStyles.optionText,
              state === 'correct' && { color: '#166534' },
              state === 'wrong' && { color: '#991b1b' },
            ]}
            numberOfLines={4}
            adjustsFontSizeToFit
            minimumFontScale={0.7}
          >
            {optionText}
          </Text>
        </View>

        {state === 'correct' && (
          <View style={[cardStyles.badge, { backgroundColor: '#22c55e' }]}>
            <Text style={cardStyles.badgeText}>✓</Text>
          </View>
        )}
        {state === 'wrong' && (
          <View style={[cardStyles.badge, { backgroundColor: '#ef4444' }]}>
            <Text style={cardStyles.badgeText}>✗</Text>
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

const cardStyles = StyleSheet.create({
  wrapper: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
  },
  card: {
    width: '100%',
    height: '100%',
    borderRadius: 14,
    borderWidth: 1.5,
    padding: 10,
    justifyContent: 'center',
    alignItems: 'center',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
    position: 'relative',
  },
  suitTop: {
    position: 'absolute',
    top: 6,
    left: 8,
  },
  suitBottom: {
    position: 'absolute',
    bottom: 6,
    right: 8,
  },
  suitText: {
    fontSize: 12,
    fontWeight: '600' as const,
    opacity: 0.3,
  },
  suitRotated: {
    transform: [{ rotate: '180deg' }],
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  optionText: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#1f2937',
    textAlign: 'center',
    lineHeight: 18,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 4,
  },
  badgeText: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: '#fff',
  },
});

function BottomScoreBar({
  players,
  currentPlayerId,
  onPress,
}: {
  players: PlayerScore[];
  currentPlayerId?: string;
  onPress: () => void;
}) {
  const sorted = [...players].sort((a, b) => b.points - a.points);
  const top2 = sorted.slice(0, 2);
  const insets = useSafeAreaInsets();

  return (
    <TouchableOpacity
      style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 8) }]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      {top2.map((player, idx) => {
        const isMe = player.id === currentPlayerId;
        return (
          <View key={player.id} style={[styles.bottomBarPlayer, isMe && styles.bottomBarPlayerActive]}>
            <View style={styles.bottomBarRank}>
              <Text style={styles.bottomBarRankText}>#{idx + 1}</Text>
            </View>
            <View style={[styles.bottomBarDot, { backgroundColor: player.color }]} />
            <Text style={styles.bottomBarName} numberOfLines={1}>{player.name}</Text>
            <Text style={styles.bottomBarPoints}>{player.points}</Text>
          </View>
        );
      })}
    </TouchableOpacity>
  );
}

function ScoreboardSheet({
  visible,
  onClose,
  players,
  currentPlayerId,
}: {
  visible: boolean;
  onClose: () => void;
  players: PlayerScore[];
  currentPlayerId?: string;
}) {
  const insets = useSafeAreaInsets();
  const sorted = [...players].sort((a, b) => b.points - a.points);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.sheetBackdrop}>
        <TouchableOpacity style={styles.sheetBackdropTap} onPress={onClose} activeOpacity={1} />
        <View style={[styles.sheetContainer, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>Scoreboard</Text>
          <ScrollView style={styles.sheetList} showsVerticalScrollIndicator={false}>
            {sorted.map((player, idx) => {
              const isMe = player.id === currentPlayerId;
              return (
                <View key={player.id} style={[styles.sheetRow, isMe && styles.sheetRowActive]}>
                  <View style={styles.sheetRank}>
                    {idx === 0 ? (
                      <Text style={styles.sheetRankCrown}>👑</Text>
                    ) : (
                      <Text style={styles.sheetRankText}>#{idx + 1}</Text>
                    )}
                  </View>
                  <View style={[styles.sheetDot, { backgroundColor: player.color }]} />
                  <Text style={[styles.sheetName, isMe && styles.sheetNameActive]} numberOfLines={1}>
                    {player.name}
                  </Text>
                  <Text style={[styles.sheetPoints, isMe && styles.sheetPointsActive]}>{player.points}</Text>
                </View>
              );
            })}
          </ScrollView>
          <TouchableOpacity style={styles.sheetClose} onPress={onClose} activeOpacity={0.8}>
            <Text style={styles.sheetCloseText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
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
  const [showScoreboard, setShowScoreboard] = useState(false);
  const [helperVisible, setHelperVisible] = useState(true);

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
  const lastDealerLineRef = useRef<string>('');

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
  const helperOpacity = useRef(new Animated.Value(1)).current;

  const currentPlayer = useMemo(() => lobby.players?.[currentPlayerIndex], [lobby.players, currentPlayerIndex]);
  const currentPlayerState = useMemo(() => playerStates[currentPlayerIndex], [playerStates, currentPlayerIndex]);

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

  useEffect(() => {
    if (helperVisible && gamePhase === 'question') {
      const timer = setTimeout(() => {
        Animated.timing(helperOpacity, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }).start(() => setHelperVisible(false));
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [helperVisible, gamePhase, helperOpacity]);

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
    setHelperVisible(true);
    helperOpacity.setValue(1);

    const line = getRandomDealerLine('idle', lastDealerLineRef.current);
    setDealerLine(line);
    lastDealerLineRef.current = line;

    if (lobby.settings.timerSeconds > 0) {
      setTimeRemaining(lobby.settings.timerSeconds);
    }

    cardScales.forEach((anim, index) => {
      anim.setValue(0.9);
      shakeAnims[index].setValue(0);
      Animated.spring(anim, {
        toValue: 1,
        friction: 6,
        tension: 80,
        delay: index * 50,
        useNativeDriver: true,
      }).start();
    });

    feedbackOpacity.setValue(0);
    feedbackScale.setValue(0.8);
  }, [deck, allCards, lobby.settings, cardScales, shakeAnims, feedbackOpacity, feedbackScale, helperOpacity]);

  useEffect(() => {
    if (lobby.settings?.timerSeconds > 0 && timeRemaining !== null && timeRemaining > 0 && gamePhase === 'question') {
      timerRef.current = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev === null || prev <= 1) return 0;
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
        Animated.timing(cardScales[correctIndex], { toValue: 1.06, duration: 150, useNativeDriver: true }),
        Animated.spring(cardScales[correctIndex], { toValue: 1, friction: 4, useNativeDriver: true }),
      ]).start();
    }

    Animated.parallel([
      Animated.timing(feedbackOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
      Animated.spring(feedbackScale, { toValue: 1, friction: 6, useNativeDriver: true }),
    ]).start();

    setGamePhase('feedback');

    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, [gamePhase, currentCard, roundStartTime, currentPlayerIndex, options, inputLocked, cardScales, feedbackOpacity, feedbackScale]);

  useEffect(() => {
    if (timeRemaining === 0 && gamePhase === 'question' && currentCard && !inputLocked) {
      handleTimeUp();
    }
  }, [timeRemaining, gamePhase, currentCard, inputLocked, handleTimeUp]);

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
      Animated.timing(cardScales[index], { toValue: 0.94, duration: 60, useNativeDriver: true }),
      Animated.spring(cardScales[index], { toValue: correct ? 1.04 : 1, friction: 4, useNativeDriver: true }),
    ]).start();

    if (!correct) {
      Animated.sequence([
        Animated.timing(shakeAnims[index], { toValue: 8, duration: 40, useNativeDriver: true }),
        Animated.timing(shakeAnims[index], { toValue: -8, duration: 40, useNativeDriver: true }),
        Animated.timing(shakeAnims[index], { toValue: 6, duration: 40, useNativeDriver: true }),
        Animated.timing(shakeAnims[index], { toValue: -6, duration: 40, useNativeDriver: true }),
        Animated.timing(shakeAnims[index], { toValue: 0, duration: 40, useNativeDriver: true }),
      ]).start();

      const correctIndex = options.findIndex(o => checkAnswer(o, currentCard.answer));
      if (correctIndex >= 0 && correctIndex !== index) {
        setTimeout(() => {
          Animated.sequence([
            Animated.timing(cardScales[correctIndex], { toValue: 1.06, duration: 150, useNativeDriver: true }),
            Animated.spring(cardScales[correctIndex], { toValue: 1, friction: 4, useNativeDriver: true }),
          ]).start();
        }, 180);
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
      Animated.timing(feedbackOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
      Animated.spring(feedbackScale, { toValue: 1, friction: 6, useNativeDriver: true }),
    ]).start();

    setGamePhase('feedback');

    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(correct ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error);
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

  const getCardState = (option: string): CardState => {
    if (!selectedOption && isCorrect === null) {
      return inputLocked ? 'disabled' : 'idle';
    }
    const isSelected = option === selectedOption;
    const isCorrectOption = currentCard && checkAnswer(option, currentCard.answer);

    if (isCorrectOption) return 'correct';
    if (isSelected && !isCorrect) return 'wrong';
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
      <View style={styles.container}>
        <LinearGradient
          colors={['#f97316', '#ea580c']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.headerBtn} onPress={handleQuit} activeOpacity={0.7}>
              <X color="#fff" size={22} />
            </TouchableOpacity>
            <View style={styles.progressPill}>
              <Text style={styles.progressText}>{questionNumber}/{totalQuestions}</Text>
            </View>
            <TouchableOpacity style={styles.headerBtn} onPress={() => setShowScoreboard(true)} activeOpacity={0.7}>
              <Users color="#fff" size={20} />
            </TouchableOpacity>
          </View>

          <View style={styles.passDeviceContainer}>
            <Hand color="#fff" size={52} />
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
              <MiniScoreboard players={scoreboardPlayers} currentPlayerId={currentPlayer?.id} />
            </View>

            <TouchableOpacity style={styles.readyButton} onPress={handleReadyPress} activeOpacity={0.85}>
              <LinearGradient
                colors={['#22c55e', '#16a34a']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.readyButtonGradient}
              >
                <Zap color="#fff" size={20} />
                <Text style={styles.readyButtonText}>Ready!</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </SafeAreaView>

        <ScoreboardSheet
          visible={showScoreboard}
          onClose={() => setShowScoreboard(false)}
          players={scoreboardPlayers}
          currentPlayerId={currentPlayer?.id}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#fb923c', '#f97316']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.headerBtn} onPress={handleQuit} activeOpacity={0.7}>
            <X color="#fff" size={22} />
          </TouchableOpacity>
          <View style={styles.progressPill}>
            <Text style={styles.progressText}>{questionNumber}/{totalQuestions}</Text>
          </View>
          <TouchableOpacity style={styles.headerBtn} onPress={() => setShowScoreboard(true)} activeOpacity={0.7}>
            <Users color="#fff" size={20} />
          </TouchableOpacity>
        </View>

        <View style={styles.gameContent}>
          <View style={styles.questionPanel}>
            {lobby.settings.timerSeconds > 0 && timeRemaining !== null && (
              <View style={styles.timerContainer}>
                <DealerCountdownBar timeRemaining={timeRemaining} totalTime={lobby.settings.timerSeconds} />
              </View>
            )}
            <Text style={styles.questionText} numberOfLines={4}>
              {currentCard?.question}
            </Text>
            {helperVisible && (
              <Animated.Text style={[styles.helperText, { opacity: helperOpacity }]}>
                {dealerLine}
              </Animated.Text>
            )}
          </View>

          <View style={styles.answersContainer}>
            <View style={styles.answersGrid}>
              {options.map((option, index) => (
                <AnswerCardNew
                  key={index}
                  optionText={option}
                  suit={getSuitForIndex(index)}
                  index={index}
                  state={getCardState(option)}
                  onPress={() => handleOptionPress(option, index)}
                  animatedScale={cardScales[index]}
                  animatedShake={shakeAnims[index]}
                />
              ))}
            </View>
          </View>
        </View>
      </SafeAreaView>

      <BottomScoreBar
        players={scoreboardPlayers}
        currentPlayerId={currentPlayer?.id}
        onPress={() => setShowScoreboard(true)}
      />

      <ScoreboardSheet
        visible={showScoreboard}
        onClose={() => setShowScoreboard(false)}
        players={scoreboardPlayers}
        currentPlayerId={currentPlayer?.id}
      />

      {gamePhase === 'feedback' && (
        <Animated.View
          style={[
            styles.feedbackOverlay,
            { opacity: feedbackOpacity, transform: [{ scale: feedbackScale }] },
          ]}
        >
          <View style={[styles.feedbackCard, { backgroundColor: theme.cardBackground }]}>
            <View style={[styles.feedbackIconCircle, { backgroundColor: isCorrect ? '#22c55e' : '#ef4444' }]}>
              <Text style={styles.feedbackIconText}>{isCorrect ? '✓' : '✗'}</Text>
            </View>
            <Text style={[styles.feedbackTitle, { color: isCorrect ? '#22c55e' : '#ef4444' }]}>
              {isCorrect ? 'Correct!' : timeRemaining === 0 ? "Time's Up!" : 'Incorrect'}
            </Text>
            {!isCorrect && currentCard && (
              <View style={styles.feedbackAnswerBox}>
                <Text style={[styles.feedbackAnswerLabel, { color: theme.textSecondary }]}>Correct answer:</Text>
                <Text style={[styles.feedbackAnswer, { color: theme.text }]}>{currentCard.answer}</Text>
              </View>
            )}
            {isCorrect && currentPlayerState?.currentStreak > 1 && (
              <View style={styles.feedbackStreakBadge}>
                <Trophy color="#f59e0b" size={18} />
                <Text style={styles.feedbackStreakText}>{currentPlayerState.currentStreak} in a row!</Text>
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
    paddingVertical: 8,
    height: 52,
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressPill: {
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  progressText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700' as const,
  },
  gameContent: {
    flex: 1,
    paddingHorizontal: GRID_HORIZONTAL_MARGIN,
  },
  questionPanel: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 18,
    padding: 18,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  timerContainer: {
    marginBottom: 12,
    marginHorizontal: -8,
  },
  questionText: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#1f2937',
    textAlign: 'center',
    lineHeight: 26,
  },
  helperText: {
    fontSize: 13,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 8,
    fontStyle: 'italic',
  },
  answersContainer: {
    flex: 1,
    justifyContent: 'flex-start',
  },
  answersGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: CARD_GAP,
    justifyContent: 'space-between',
  },
  bottomBar: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    paddingTop: 10,
    paddingHorizontal: 12,
    gap: 8,
  },
  bottomBarPlayer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 6,
  },
  bottomBarPlayerActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
  },
  bottomBarRank: {
    width: 24,
  },
  bottomBarRankText: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.7)',
    fontWeight: '600' as const,
  },
  bottomBarDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  bottomBarName: {
    flex: 1,
    fontSize: 13,
    color: '#fff',
    fontWeight: '600' as const,
  },
  bottomBarPoints: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '700' as const,
  },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  sheetBackdropTap: {
    flex: 1,
  },
  sheetContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    paddingHorizontal: 20,
    maxHeight: '70%',
  },
  sheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#d1d5db',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#1f2937',
    textAlign: 'center',
    marginBottom: 16,
  },
  sheetList: {
    maxHeight: 300,
  },
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 6,
    gap: 10,
  },
  sheetRowActive: {
    backgroundColor: '#fef3c7',
  },
  sheetRank: {
    width: 32,
    alignItems: 'center',
  },
  sheetRankCrown: {
    fontSize: 18,
  },
  sheetRankText: {
    fontSize: 13,
    color: '#6b7280',
    fontWeight: '600' as const,
  },
  sheetDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  sheetName: {
    flex: 1,
    fontSize: 15,
    color: '#374151',
    fontWeight: '500' as const,
  },
  sheetNameActive: {
    fontWeight: '700' as const,
    color: '#1f2937',
  },
  sheetPoints: {
    fontSize: 16,
    color: '#374151',
    fontWeight: '700' as const,
  },
  sheetPointsActive: {
    color: '#f59e0b',
  },
  sheetClose: {
    backgroundColor: '#f3f4f6',
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 12,
  },
  sheetCloseText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#374151',
    textAlign: 'center',
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
    width: 88,
    height: 88,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 4,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  playerInitialLarge: {
    fontSize: 40,
    fontWeight: '700' as const,
    color: '#fff',
  },
  passDeviceStats: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  passDeviceStat: {
    alignItems: 'center',
    paddingHorizontal: 14,
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
    shadowOpacity: 0.25,
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
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  feedbackCard: {
    width: '100%',
    maxWidth: 320,
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
  },
  feedbackIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  feedbackIconText: {
    fontSize: 30,
    fontWeight: '700' as const,
    color: '#fff',
  },
  feedbackTitle: {
    fontSize: 26,
    fontWeight: '800' as const,
    marginBottom: 12,
  },
  feedbackAnswerBox: {
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
    width: '100%',
    alignItems: 'center',
  },
  feedbackAnswerLabel: {
    fontSize: 12,
    fontWeight: '500' as const,
    marginBottom: 4,
  },
  feedbackAnswer: {
    fontSize: 16,
    fontWeight: '700' as const,
    textAlign: 'center',
  },
  feedbackStreakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    marginBottom: 14,
  },
  feedbackStreakText: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#f59e0b',
  },
  continueButton: {
    paddingVertical: 14,
    paddingHorizontal: 44,
    borderRadius: 14,
    marginTop: 6,
  },
  continueButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#fff',
  },
});
