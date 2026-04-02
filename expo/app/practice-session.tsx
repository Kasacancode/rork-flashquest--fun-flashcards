import { LinearGradient } from 'expo-linear-gradient';
import { triggerNotification, NotificationFeedbackType } from '@/utils/haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Bot, Swords, User, X, Zap } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Keyboard, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import ConfidenceChips from '@/components/ConfidenceChips';
import FlashcardDebugButton from '@/components/debug/FlashcardDebugButton';
import { TimerProgressBar, StreakIndicator } from '@/components/GameUI';
import PracticeSessionCompletionScreen from '@/components/practice-session/PracticeSessionCompletionScreen';
import PracticeSessionEmptyState from '@/components/practice-session/PracticeSessionEmptyState';
import {
  QUESTION_TIME,
  createPracticeSession,
  getAdaptiveOpponentBehavior,
  pickDistractor,
  type AdaptiveOpponentState,
  type GamePhase,
  type PendingCardReview,
  type PlayerInfo,
  type TurnResult,
} from '@/components/practice-session/practiceSession.utils';
import { useFlashQuest } from '@/context/FlashQuestContext';
import { usePerformance } from '@/context/PerformanceContext';
import { useTheme } from '@/context/ThemeContext';
import { trackEvent } from '@/lib/analytics';
import { GAME_MODE } from '@/types/game';
import type { RecallQuality } from '@/types/performance';
import type { PracticeMode, PracticeSessionState } from '@/types/practice';
import {
  compareAnswerValues,
  getCanonicalAnswer,
  getCardAnswerForSurface,
  getCardQuestionForSurface,
} from '@/utils/flashcardContent';
import { clearAIDistractorCache as clearDistractorCache, generateOptionsWithAI } from '@/utils/questUtils';
import { logger } from '@/utils/logger';
import { focusedQuestSessionHref, questHref, studyHref } from '@/utils/routes';
import { playSound } from '@/utils/sounds';

const FEEDBACK_REVEAL_DELAY_MS = 850;
const TURN_TRANSITION_DELAY_MS = 850;
const OPPONENT_THINK_MIN_DELAY_MS = 700;
const OPPONENT_THINK_RANGE_MS = 1100;

export default function PracticeSessionPage() {
  const router = useRouter();
  const params = useLocalSearchParams<{ deckId?: string | string[]; mode?: PracticeMode | PracticeMode[] }>();
  const { decks, recordSessionResult } = useFlashQuest();
  const { logQuestAttempt } = usePerformance();
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
  const [aiState, setAiState] = useState<AdaptiveOpponentState>({ streak: 0, confidence: 0.5 });
  const [reviewQuality, setReviewQuality] = useState<RecallQuality | null>(null);
  const [pendingReview, setPendingReview] = useState<PendingCardReview | null>(null);
  const [missedCardIds, setMissedCardIds] = useState<string[]>([]);

  const sessionStartRef = useRef<number>(Date.now());
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const feedbackOpacity = useRef(new Animated.Value(0)).current;
  const feedbackScale = useRef(new Animated.Value(0.8)).current;
  const scorePopAnim = useRef(new Animated.Value(1)).current;
  const handleTimeUpRef = useRef<() => void>(() => {});
  const resultRecordedRef = useRef(false);
  const pendingTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const pulseLoopRef = useRef<Animated.CompositeAnimation | null>(null);

  const clearPendingTimeouts = useCallback(() => {
    pendingTimeoutsRef.current.forEach((timeoutId) => {
      clearTimeout(timeoutId);
    });
    pendingTimeoutsRef.current = [];
  }, []);

  const scheduleTimeout = useCallback((callback: () => void, delay: number) => {
    const timeoutId = setTimeout(() => {
      pendingTimeoutsRef.current = pendingTimeoutsRef.current.filter((existingId) => existingId !== timeoutId);
      callback();
    }, delay);

    pendingTimeoutsRef.current = [...pendingTimeoutsRef.current, timeoutId];
    return timeoutId;
  }, []);

  useEffect(() => {
    return () => {
      clearPendingTimeouts();
      pulseLoopRef.current?.stop();
    };
  }, [clearPendingTimeouts]);

  useEffect(() => {
    clearPendingTimeouts();
    if (!deckId) {
      setCurrentBattle(null);
      return;
    }

    sessionStartRef.current = Date.now();
    resultRecordedRef.current = false;
    setCurrentBattle(createPracticeSession(deckId, practiceMode));
    setAiState({ streak: 0, confidence: 0.5 });
    setMissedCardIds([]);
  }, [deckId, practiceMode, clearPendingTimeouts]);

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
  const allFlashcards = useMemo(() => decks.flatMap((existingDeck) => existingDeck.flashcards), [decks]);
  
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
  const canonicalAnswer = useMemo(() => (currentCard ? getCanonicalAnswer(currentCard) : ''), [currentCard]);
  const displayQuestion = useMemo(() => (currentCard ? getCardQuestionForSurface(currentCard, 'quest') : ''), [currentCard]);
  const displayAnswer = useMemo(() => (currentCard ? getCardAnswerForSurface(currentCard, 'study') : ''), [currentCard]);

  const revealResults = useCallback(() => {
    Animated.parallel([
      Animated.timing(feedbackOpacity, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.spring(feedbackScale, {
        toValue: 1,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();
    setGamePhase('reveal-results');
  }, [feedbackOpacity, feedbackScale]);

  const advanceToSecondPlayerTurn = useCallback(() => {
    setCurrentPlayer(2);
    setUserAnswer('');
    setButtonState('idle');
    setTimeLeft(QUESTION_TIME);
  }, []);

  const advanceToOpponentTurn = useCallback(() => {
    setGamePhase('opponent-turn');
    setTimeLeft(QUESTION_TIME);
  }, []);

  const simulateOpponentAnswer = useCallback(() => {
    if (!currentCard || !currentBattle) return;

    const difficulty = currentCard.difficulty || 'medium';
    const behavior = currentBattle.mode === 'ai'
      ? getAdaptiveOpponentBehavior(
          difficulty,
          currentBattle.playerScore,
          currentBattle.opponentScore,
          currentBattle.currentRound,
          aiState,
        )
      : { correctChance: 0.5, minTime: 4, maxTime: 10 };

    const opponentCorrect = Math.random() < behavior.correctChance;
    const opponentTime = Math.floor(Math.random() * (behavior.maxTime - behavior.minTime + 1)) + behavior.minTime;

    const wrongAnswer = distractors.length > 0
      ? pickDistractor(distractors)
      : 'Incorrect answer';

    setAiState((prev) => ({
      streak: opponentCorrect ? Math.max(prev.streak + 1, 1) : Math.min(prev.streak - 1, -1),
      confidence: opponentCorrect
        ? Math.min(prev.confidence + 0.1, 1)
        : Math.max(prev.confidence - 0.1, 0),
    }));

    setOpponentResult({
      answer: opponentCorrect ? displayAnswer : wrongAnswer,
      isCorrect: opponentCorrect,
      timeUsed: opponentTime,
    });

    logger.debug('[Practice] AI answered:', opponentCorrect ? 'correct' : wrongAnswer, 'in', opponentTime, 's', 'streak:', aiState.streak);

    scheduleTimeout(revealResults, FEEDBACK_REVEAL_DELAY_MS);
  }, [aiState, currentBattle, currentCard, displayAnswer, distractors, revealResults, scheduleTimeout]);

  useEffect(() => {
    if (!currentCard) return;
    clearPendingTimeouts();
    setTimeLeft(QUESTION_TIME);
    setGamePhase('player-turn');
    setUserAnswer('');
    setPlayerResult(null);
    setOpponentResult(null);
    setButtonState('idle');
    setCurrentPlayer(1);
    setPlayer1Result(null);
    setPlayer2Result(null);
    setReviewQuality(null);
    setPendingReview(null);
    feedbackOpacity.setValue(0);
    feedbackScale.setValue(0.8);

    let isCancelled = false;

    if (currentBattle?.mode === 'ai') {
      void generateOptionsWithAI({
        question: displayQuestion,
        correctAnswer: canonicalAnswer,
        deckCards: deck?.flashcards ?? [],
        allCards: allFlashcards,
        currentCardId: currentCard.id,
      })
        .then((options) => {
          if (isCancelled) {
            return;
          }

          const generatedDistractors = options
            .filter((option) => !compareAnswerValues(option.canonicalValue, canonicalAnswer))
            .map((option) => option.displayText);
          setDistractors(generatedDistractors);
          logger.debug('[Practice] Pre-loaded distractors for card:', currentCard.id);
        })
        .catch(() => {
          if (!isCancelled) {
            setDistractors([]);
          }
        });
    } else {
      setDistractors([]);
    }

    return () => {
      isCancelled = true;
    };
  }, [allFlashcards, canonicalAnswer, clearPendingTimeouts, currentBattle?.mode, currentCard, deck?.flashcards, displayQuestion, feedbackOpacity, feedbackScale]);

  useEffect(() => {
    pulseLoopRef.current?.stop();
    pulseLoopRef.current = null;

    if (gamePhase === 'opponent-turn') {
      const pulseLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.15,
            duration: 450,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 450,
            useNativeDriver: true,
          }),
        ])
      );
      pulseLoopRef.current = pulseLoop;
      pulseLoop.start();
      return () => {
        pulseLoop.stop();
      };
    }

    pulseAnim.stopAnimation();
    pulseAnim.setValue(1);
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

  const markCardMissed = useCallback((cardId: string | undefined) => {
    if (!cardId) {
      return;
    }

    setMissedCardIds((previous) => {
      if (previous.includes(cardId)) {
        return previous;
      }

      return [...previous, cardId];
    });
  }, []);

  const handleReviewQualitySelect = useCallback((quality: RecallQuality) => {
    setReviewQuality(quality);
    setPendingReview((previousReview) => (
      previousReview
        ? {
            ...previousReview,
            quality,
          }
        : previousReview
    ));
  }, []);

  const commitPendingReview = useCallback(() => {
    if (!pendingReview || currentBattle?.mode === 'multiplayer') {
      return;
    }

    logQuestAttempt({
      deckId: pendingReview.deckId,
      cardId: pendingReview.cardId,
      isCorrect: pendingReview.isCorrect,
      selectedOption: pendingReview.selectedOption,
      correctAnswer: pendingReview.correctAnswer,
      timeToAnswerMs: pendingReview.timeToAnswerMs,
      quality: reviewQuality ?? pendingReview.quality,
      mode: 'practice',
    });
    setPendingReview(null);
  }, [pendingReview, currentBattle?.mode, logQuestAttempt, reviewQuality]);

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
          void playSound('wrong');
          markCardMissed(currentCard?.id);
          triggerShake();
          triggerNotification(NotificationFeedbackType.Error);

          scheduleTimeout(advanceToSecondPlayerTurn, TURN_TRANSITION_DELAY_MS);
        } else {
          setPlayer2Result({
            name: 'Player 2',
            answer: userAnswer.trim() || '(No answer)',
            isCorrect: correct,
            timeUsed: QUESTION_TIME,
          });
          setButtonState('incorrect');
          void playSound('wrong');
          markCardMissed(currentCard?.id);
          triggerShake();
          triggerNotification(NotificationFeedbackType.Error);

          scheduleTimeout(revealResults, TURN_TRANSITION_DELAY_MS);
        }
      } else {
        setPlayerResult({
          answer: userAnswer.trim() || '(No answer)',
          isCorrect: correct,
          timeUsed: QUESTION_TIME,
        });
        setReviewQuality(1);
        setPendingReview({
          deckId: deckId ?? currentBattle?.deckId ?? '',
          cardId: currentCard?.id ?? '',
          isCorrect: false,
          selectedOption: userAnswer.trim() || '(No answer)',
          correctAnswer: canonicalAnswer,
          timeToAnswerMs: QUESTION_TIME * 1000,
          quality: 1,
        });
        setButtonState('incorrect');
        void playSound('wrong');
        setPlayerStreak(0);
        markCardMissed(currentCard?.id);
        triggerShake();
        triggerNotification(NotificationFeedbackType.Error);

        scheduleTimeout(advanceToOpponentTurn, TURN_TRANSITION_DELAY_MS);
      }
    } else if (gamePhase === 'opponent-turn') {
      simulateOpponentAnswer();
    }
  }, [
    advanceToOpponentTurn,
    advanceToSecondPlayerTurn,
    canonicalAnswer,
    currentBattle,
    currentCard,
    currentPlayer,
    deckId,
    gamePhase,
    markCardMissed,
    revealResults,
    scheduleTimeout,
    simulateOpponentAnswer,
    triggerShake,
    userAnswer,
  ]);

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

  if (!deckId || !currentBattle || !deck) {
    return (
      <PracticeSessionEmptyState
        isDark={isDark}
        title="Session not available"
        ctaLabel="Go Back"
        onPress={() => router.back()}
      />
    );
  }

  if (!currentCard) {
    return <PracticeSessionEmptyState isDark={isDark} title="Practice session not found" />;
  }

  const handleSubmitAnswer = () => {
    if (gamePhase !== 'player-turn' || userAnswer.trim() === '') return;

    Keyboard.dismiss();
    const correct = compareAnswerValues(userAnswer.trim(), canonicalAnswer);
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
        void playSound(correct ? 'correct' : 'wrong');

        triggerNotification(correct ? NotificationFeedbackType.Success : NotificationFeedbackType.Error);

        if (!correct) {
          markCardMissed(currentCard?.id);
          triggerShake();
        }

        Animated.sequence([
          Animated.spring(scaleAnim, { toValue: 1.05, useNativeDriver: true, speed: 50 }),
          Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, speed: 50 }),
        ]).start();

        scheduleTimeout(advanceToSecondPlayerTurn, TURN_TRANSITION_DELAY_MS);
      } else {
        setPlayer2Result({
          name: 'Player 2',
          answer: userAnswer.trim(),
          isCorrect: correct,
          timeUsed,
        });
        setButtonState(correct ? 'correct' : 'incorrect');
        void playSound(correct ? 'correct' : 'wrong');

        triggerNotification(correct ? NotificationFeedbackType.Success : NotificationFeedbackType.Error);

        if (!correct) {
          markCardMissed(currentCard?.id);
          triggerShake();
        }

        Animated.sequence([
          Animated.spring(scaleAnim, { toValue: 1.05, useNativeDriver: true, speed: 50 }),
          Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, speed: 50 }),
        ]).start();

        scheduleTimeout(revealResults, TURN_TRANSITION_DELAY_MS);
      }
    } else {
      setPlayerResult({
        answer: userAnswer.trim(),
        isCorrect: correct,
        timeUsed,
      });
      setReviewQuality(correct ? 3 : 1);
      setPendingReview({
        deckId: deckId ?? currentBattle?.deckId ?? currentCard.deckId,
        cardId: currentCard.id,
        isCorrect: correct,
        selectedOption: userAnswer.trim(),
        correctAnswer: canonicalAnswer,
        timeToAnswerMs: timeUsed * 1000,
        quality: correct ? 3 : 1,
      });
      setButtonState(correct ? 'correct' : 'incorrect');
      void playSound(correct ? 'correct' : 'wrong');
      setPlayerStreak(correct ? playerStreak + 1 : 0);

      if (!correct) {
        markCardMissed(currentCard.id);
      }

      triggerNotification(correct ? NotificationFeedbackType.Success : NotificationFeedbackType.Error);

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

      scheduleTimeout(() => {
        advanceToOpponentTurn();
        scheduleTimeout(
          simulateOpponentAnswer,
          OPPONENT_THINK_MIN_DELAY_MS + Math.round(Math.random() * OPPONENT_THINK_RANGE_MS),
        );
      }, TURN_TRANSITION_DELAY_MS);
    }
  };

  const handleNext = () => {
    clearPendingTimeouts();
    commitPendingReview();

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
    setReviewQuality(null);
    setPendingReview(null);
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
    clearPendingTimeouts();
    commitPendingReview();
    clearDistractorCache();
    endBattle();
    router.back();
  };

  const finalizeCompletedSession = useCallback((destination: 'back' | 'quest' | 'study' | 'retry-missed') => {
    if (!currentBattle || !deckId) {
      endBattle();
      router.back();
      return;
    }

    const won = currentBattle.playerScore > currentBattle.opponentScore;
    const accuracy = currentBattle.totalRounds > 0 ? currentBattle.playerScore / currentBattle.totalRounds : 0;
    const practiceXp = won ? Math.round(30 + accuracy * 40) : Math.round(10 + accuracy * 20);

    if (!resultRecordedRef.current) {
      resultRecordedRef.current = true;
      recordSessionResult({
        mode: GAME_MODE.PRACTICE,
        deckId,
        xpEarned: practiceXp,
        cardsAttempted: currentBattle.totalRounds,
        correctCount: currentBattle.playerScore,
        timestampISO: new Date().toISOString(),
        durationMs: Date.now() - sessionStartRef.current,
      });
      trackEvent({
        event: 'practice_completed',
        deckId,
        properties: {
          won,
          player_score: currentBattle.playerScore,
          opponent_score: currentBattle.opponentScore,
          total_rounds: currentBattle.totalRounds,
          accuracy: currentBattle.totalRounds > 0 ? Math.round((currentBattle.playerScore / currentBattle.totalRounds) * 100) : 0,
        },
      });
      logger.debug('[Practice] Recorded session result, xp:', practiceXp);
    }

    clearPendingTimeouts();
    endBattle();

    if (destination === 'quest') {
      router.push(questHref({ deckId }));
      return;
    }

    if (destination === 'study') {
      router.push(studyHref(deckId));
      return;
    }

    if (destination === 'retry-missed' && missedCardIds.length > 0) {
      logger.debug('[Practice] Retrying missed cards:', missedCardIds.length);
      router.push(focusedQuestSessionHref({ deckId, cardIds: missedCardIds }));
      return;
    }

    router.back();
  }, [clearPendingTimeouts, currentBattle, deckId, endBattle, missedCardIds, recordSessionResult, router]);

  if (currentBattle.status === 'completed') {
    const won = currentBattle.playerScore > currentBattle.opponentScore;

    return (
      <PracticeSessionCompletionScreen
        isDark={isDark}
        won={won}
        pulseAnim={pulseAnim}
        opponentName={currentBattle.opponentName}
        playerScore={currentBattle.playerScore}
        opponentScore={currentBattle.opponentScore}
        missedCount={missedCardIds.length}
        onDone={() => finalizeCompletedSession('back')}
        onRetryMissed={() => finalizeCompletedSession('retry-missed')}
        onQuest={() => finalizeCompletedSession('quest')}
        onStudy={() => finalizeCompletedSession('study')}
      />
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
            <View style={styles.questionDebugRow}>
              <FlashcardDebugButton
                deckId={currentCard?.deckId}
                cardId={currentCard?.id}
                surface="practice"
                testID="practice-flashcard-debug-button"
              />
            </View>
            <Text style={[styles.questionText, { color: isDark ? theme.text : '#1a1a1a' }]}>
              {displayQuestion}
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
                <Text style={styles.turnText}>{`${currentBattle.opponentName}'s Turn`}</Text>
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
                  {displayAnswer}
                </Text>
              </View>

              {currentBattle?.mode !== 'multiplayer' ? (
                <View style={styles.reviewSection}>
                  {playerResult?.isCorrect ? (
                    <ConfidenceChips
                      compact
                      selectedQuality={reviewQuality ?? 3}
                      onSelect={handleReviewQualitySelect}
                      prompt="How did that feel?"
                      promptColor="rgba(255,255,255,0.96)"
                      testIDPrefix="practice-review"
                    />
                  ) : (
                    <Text style={styles.reviewStatusText}>Marked as forgot</Text>
                  )}
                </View>
              ) : null}

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
  questionDebugRow: {
    alignItems: 'flex-end',
    marginBottom: 12,
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
  reviewSection: {
    marginTop: 10,
    marginBottom: 4,
    alignItems: 'center',
  },
  reviewStatusText: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: 'rgba(255,255,255,0.82)',
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
