import { LinearGradient } from 'expo-linear-gradient';
import { triggerImpact, triggerNotification, ImpactFeedbackStyle, NotificationFeedbackType } from '@/utils/haptics';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { X, Zap, Lightbulb, Clock } from 'lucide-react-native';
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { ActivityIndicator, View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AnswerCard, getSuitForIndex, AnswerCardState, CARD_GAP, CARD_HEIGHT, CARD_PADDING, CARD_WIDTH, GRID_HORIZONTAL_MARGIN } from '@/components/AnswerCard';
import DealerPlaceholder from '@/components/DealerPlaceholder';
import FlashcardDebugButton from '@/components/debug/FlashcardDebugButton';
import { useDeckContext } from '@/context/DeckContext';
import { useStatsContext } from '@/context/StatsContext';
import { usePerformance } from '@/context/PerformanceContext';
import { useTheme } from '@/context/ThemeContext';
import { trackEvent } from '@/lib/analytics';
import type { Flashcard, FlashcardOption } from '@/types/flashcard';
import { GAME_MODE } from '@/types/game';
import type { QuestRunResult, QuestSettings } from '@/types/performance';
import { isMeaningfulQuestSlump, isMeaningfulQuestStreak, selectAssistantDialogue, type QuestDialogueEvent } from '@/utils/dialogue';
import { formatGameplayHint } from '@/utils/gameplayCopy';
import { createFlashcardOptionFromCard, getCanonicalAnswer, getCardAnswerForSurface, getCardQuestionForSurface } from '@/utils/flashcardContent';
import { logger } from '@/utils/logger';
import { parseDrillCardIdsParam, parseQuestSettingsParam, serializeQuestResult } from '@/utils/questParams';
import { getFirstRouteParam } from '@/utils/safeJson';
import { playSound } from '@/utils/sounds';
import { useResponsiveLayout } from '@/utils/responsive';
import { QUEST_ROUTE, questResultsHref } from '@/utils/routes';
import { selectNextCard, generateAIDistractors, generateOptions, checkAnswer, calculateScore } from '@/utils/questUtils';
import { waitForInitialSync } from '@/utils/cloudSync';

const FALLBACK_QUEST_SETTINGS: QuestSettings = {
  deckId: '',
  mode: 'learn',
  runLength: 5,
  timerSeconds: 0,
  focusWeakOnly: false,
  hintsEnabled: true,
  explanationsEnabled: true,
  secondChanceEnabled: false,
};

export default function QuestSessionScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    settings?: string | string[];
    drillCardIds?: string | string[];
    challengeId?: string | string[];
    challengerScore?: string | string[];
    challengeOpponentId?: string | string[];
    challengeCardIds?: string | string[];
  }>();
  const { theme } = useTheme();
  const { gameAreaMaxWidth } = useResponsiveLayout();
  const { decks } = useDeckContext();
  const { recordSessionResult } = useStatsContext();
  const { performance, logQuestAttempt, updateBestStreak } = usePerformance();

  const parsedSettings = useMemo(() => parseQuestSettingsParam(params.settings), [params.settings]);
  const settings = parsedSettings ?? FALLBACK_QUEST_SETTINGS;

  const drillCardIds = useMemo(() => parseDrillCardIdsParam(params.drillCardIds), [params.drillCardIds]);
  const challengeId = useMemo(() => getFirstRouteParam(params.challengeId), [params.challengeId]);
  const challengerScore = useMemo(() => getFirstRouteParam(params.challengerScore), [params.challengerScore]);
  const challengeOpponentId = useMemo(() => getFirstRouteParam(params.challengeOpponentId), [params.challengeOpponentId]);
  const challengeCardIds = useMemo(() => getFirstRouteParam(params.challengeCardIds), [params.challengeCardIds]);

  const deck = useMemo(() => decks.find(d => d.id === settings.deckId), [decks, settings.deckId]);

  const drillCards = useMemo(() => {
    if (!drillCardIds || !deck) return null;
    return deck.flashcards.filter(c => drillCardIds.includes(c.id));
  }, [drillCardIds, deck]);

  const effectiveRunLength = useMemo(() => {
    if (!drillCards) return settings.runLength;
    const len = drillCards.length;
    if (len >= 20) return 20;
    if (len >= 10) return 10;
    if (len >= 5) return 5;
    return len > 0 ? len : 1;
  }, [drillCards, settings.runLength]);

  const allCards = useMemo(() => decks.flatMap(d => d.flashcards), [decks]);

  const [round, setRound] = useState({
    number: 0,
    card: null as Flashcard | null,
    options: [] as FlashcardOption[],
    optionsRenderKey: 0,
    timeRemaining: null as number | null,
    startTime: Date.now(),
  });
  const [answer, setAnswer] = useState({
    selectedOption: null as string | null,
    isCorrect: null as boolean | null,
    inputLocked: false,
    usedSecondChance: false,
  });
  const [scoring, setScoring] = useState({
    score: 0,
    streak: 0,
    bestStreak: 0,
    correctCount: 0,
    incorrectCount: 0,
    totalTimeMs: 0,
  });
  const [assistant, setAssistant] = useState({
    line: '',
    tone: 'idle' as 'idle' | 'correct' | 'wrong',
    missStreak: 0,
  });
  const [tracking, setTracking] = useState({
    missedCardIds: [] as string[],
    askedCardIds: [] as string[],
  });
  const [showHint, setShowHint] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);
  const [syncReady, setSyncReady] = useState<boolean>(false);

  const usedCardIdsRef = useRef<Set<string>>(new Set());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const advanceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const explanationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const advanceRoundRef = useRef<() => void>(() => {});
  const finishSessionEarlyRef = useRef<() => void>(() => {});
  const performanceRef = useRef(performance);
  const initializedDeckIdRef = useRef<string | null>(null);
  const recentDistractorHistoryRef = useRef<string[]>([]);
  const analyticsTrackedRef = useRef(false);

  useEffect(() => {
    performanceRef.current = performance;
  }, [performance]);

  useEffect(() => {
    let isMounted = true;

    void waitForInitialSync(3000).then(() => {
      if (isMounted) {
        setSyncReady(true);
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!deck || analyticsTrackedRef.current) {
      return;
    }

    analyticsTrackedRef.current = true;
    trackEvent({
      event: 'deck_played',
      deckId: deck.id,
      properties: {
        deck_name: deck.name,
        mode: GAME_MODE.QUEST,
        rounds: effectiveRunLength,
        timer_seconds: settings.timerSeconds,
      },
    });
  }, [deck, effectiveRunLength, settings.timerSeconds]);

  const showQuestDialogue = useCallback((event: QuestDialogueEvent, tone: 'idle' | 'correct' | 'wrong') => {
    const line = selectAssistantDialogue({ mode: 'quest', event });
    setAssistant((prev) => ({ ...prev, tone, line }));
    logger.log('[QuestDialogue] Showing line:', { event, tone, line });
  }, []);

  const setupNextRound = useCallback(() => {
    if (!deck) return;

    const cardPool = drillCards || deck.flashcards;
    const nextCard = selectNextCard({
      cards: cardPool,
      usedCardIds: usedCardIdsRef.current,
      performance: performanceRef.current,
      focusWeakOnly: drillCards ? false : settings.focusWeakOnly,
    });

    if (!nextCard) {
      logger.log('[Quest] No more cards available, ending session');
      finishSessionEarlyRef.current();
      return;
    }

    const immediateOptions = generateOptions({
      correctAnswer: getCanonicalAnswer(nextCard),
      deckCards: deck.flashcards,
      allCards,
      currentCardId: nextCard.id,
      recentDistractors: recentDistractorHistoryRef.current,
    });
    const roundDistractors = immediateOptions
      .filter((option) => !checkAnswer(option.canonicalValue, getCanonicalAnswer(nextCard)))
      .map((option) => option.canonicalValue);

    recentDistractorHistoryRef.current = [
      ...recentDistractorHistoryRef.current,
      ...roundDistractors,
    ].slice(-12);

    logger.log('[Quest] Starting round with card:', nextCard.id, 'options ready:', immediateOptions.length);

    usedCardIdsRef.current.add(nextCard.id);
    setTracking((prev) => ({
      ...prev,
      askedCardIds: [...prev.askedCardIds, nextCard.id],
    }));
    setRound((prev) => ({
      number: prev.number,
      card: nextCard,
      options: immediateOptions,
      optionsRenderKey: prev.optionsRenderKey + 1,
      timeRemaining: settings.timerSeconds > 0 ? settings.timerSeconds : null,
      startTime: Date.now(),
    }));
    setAnswer({
      selectedOption: null,
      isCorrect: null,
      inputLocked: false,
      usedSecondChance: false,
    });
    setShowHint(false);
    setShowExplanation(false);
    showQuestDialogue('intro', 'idle');

    void generateAIDistractors(getCardQuestionForSurface(nextCard, 'quest'), getCanonicalAnswer(nextCard), nextCard.id)
      .then(() => {
        logger.log('[Quest] Warmed AI distractors for card:', nextCard.id);
      })
      .catch((err) => {
        logger.log('[Quest] AI distractor warmup failed:', err);
      });
  }, [deck, allCards, settings.focusWeakOnly, settings.timerSeconds, drillCards, showQuestDialogue]);

  const clearAdvanceTimeout = useCallback(() => {
    if (advanceTimeoutRef.current) {
      clearTimeout(advanceTimeoutRef.current);
      advanceTimeoutRef.current = null;
    }
  }, []);

  const scheduleAdvance = useCallback((delayMs: number) => {
    clearAdvanceTimeout();
    advanceTimeoutRef.current = setTimeout(() => {
      advanceTimeoutRef.current = null;
      advanceRoundRef.current();
    }, delayMs);
  }, [clearAdvanceTimeout]);

  const finishSessionEarly = useCallback(() => {
    updateBestStreak(scoring.bestStreak);

    const totalRounds = round.number;
    const finalAccuracy = totalRounds > 0 ? scoring.correctCount / totalRounds : 0;

    recordSessionResult({
      mode: GAME_MODE.QUEST,
      deckId: settings.deckId,
      xpEarned: Math.round(scoring.score * 0.4),
      cardsAttempted: totalRounds,
      correctCount: scoring.correctCount,
      timestampISO: new Date().toISOString(),
      durationMs: scoring.totalTimeMs,
    });
    trackEvent({
      event: 'quest_completed',
      deckId: settings.deckId,
      properties: {
        mode: settings.mode,
        rounds: totalRounds,
        correct: scoring.correctCount,
        accuracy: totalRounds > 0 ? Math.round((scoring.correctCount / totalRounds) * 100) : 0,
        best_streak: scoring.bestStreak,
        score: scoring.score,
        timer_seconds: settings.timerSeconds,
        focus_weak: settings.focusWeakOnly,
      },
    });
    logger.log('[Quest] Early finish - no more cards. score:', scoring.score, 'rounds:', totalRounds);

    const result: QuestRunResult = {
      deckId: settings.deckId,
      settings,
      totalScore: scoring.score,
      totalRounds,
      correctCount: scoring.correctCount,
      incorrectCount: scoring.incorrectCount,
      accuracy: finalAccuracy,
      bestStreak: scoring.bestStreak,
      totalTimeMs: scoring.totalTimeMs,
      missedCardIds: tracking.missedCardIds,
      askedCardIds: tracking.askedCardIds,
    };

    router.replace(questResultsHref({
      result: serializeQuestResult(result),
      challengeId,
      challengerScore,
      challengeOpponentId,
      challengeCardIds,
    }));
  }, [challengeCardIds, challengeId, challengeOpponentId, challengerScore, recordSessionResult, round.number, router, scoring.bestStreak, scoring.correctCount, scoring.incorrectCount, scoring.score, scoring.totalTimeMs, settings, tracking.askedCardIds, tracking.missedCardIds, updateBestStreak]);

  finishSessionEarlyRef.current = finishSessionEarly;

  useEffect(() => {
    if (!deck) {
      return;
    }

    if (initializedDeckIdRef.current === deck.id) {
      return;
    }

    initializedDeckIdRef.current = deck.id;
    recentDistractorHistoryRef.current = [];
    logger.log('[Quest] Initializing session for deck:', deck.id);
    setupNextRound();
  }, [deck, setupNextRound]);

  useEffect(() => {
    if (settings.timerSeconds > 0 && round.timeRemaining !== null && round.timeRemaining > 0 && !answer.inputLocked) {
      timerRef.current = setInterval(() => {
        setRound((prev) => ({
          ...prev,
          timeRemaining: prev.timeRemaining === null || prev.timeRemaining <= 1 ? 0 : prev.timeRemaining - 1,
        }));
      }, 1000);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [answer.inputLocked, round.timeRemaining, settings.timerSeconds]);

  useEffect(() => {
    return () => {
      clearAdvanceTimeout();
      if (explanationTimeoutRef.current) {
        clearTimeout(explanationTimeoutRef.current);
      }
    };
  }, [clearAdvanceTimeout]);

  useEffect(() => {
    if (!deck || !round.card || round.options.length > 0) {
      return;
    }

    const currentCard = round.card;

    logger.warn('[Quest] Empty options detected, regenerating for card:', currentCard.id);
    const recoveredOptions = generateOptions({
      correctAnswer: getCanonicalAnswer(currentCard),
      deckCards: deck.flashcards,
      allCards,
      currentCardId: currentCard.id,
      recentDistractors: recentDistractorHistoryRef.current,
    });

    setRound((prev) => ({
      ...prev,
      options: recoveredOptions.length > 0 ? recoveredOptions : [createFlashcardOptionFromCard(currentCard, 'tile')],
      optionsRenderKey: prev.optionsRenderKey + 1,
    }));
  }, [allCards, deck, round.card, round.options.length]);

  const handleTimeUp = useCallback(() => {
    if (answer.inputLocked || !round.card) return;

    const currentCard = round.card;

    clearAdvanceTimeout();

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    const nextMissStreak = assistant.missStreak + 1;
    const dialogueEvent: QuestDialogueEvent = isMeaningfulQuestSlump(nextMissStreak) ? 'slump' : 'wrong';
    const timeToAnswer = Date.now() - round.startTime;

    setAnswer((prev) => ({ ...prev, inputLocked: true, isCorrect: false }));
    showQuestDialogue(dialogueEvent, 'wrong');
    void playSound('wrong');
    setScoring((prev) => ({
      ...prev,
      streak: 0,
      incorrectCount: prev.incorrectCount + 1,
      totalTimeMs: prev.totalTimeMs + timeToAnswer,
    }));
    setAssistant((prev) => ({ ...prev, missStreak: nextMissStreak }));
    setTracking((prev) => ({
      ...prev,
      missedCardIds: [...prev.missedCardIds, currentCard.id],
    }));

    logQuestAttempt({
      deckId: settings.deckId,
      cardId: currentCard.id,
      isCorrect: false,
      selectedOption: '',
      correctAnswer: getCanonicalAnswer(currentCard),
      timeToAnswerMs: timeToAnswer,
      mode: 'quest',
      hintsUsed: showHint ? 1 : 0,
      usedSecondChance: answer.usedSecondChance,
      explanationOpened: showExplanation,
    });

    triggerNotification(NotificationFeedbackType.Error);

    scheduleAdvance(1500);
  }, [answer.inputLocked, answer.usedSecondChance, assistant.missStreak, clearAdvanceTimeout, logQuestAttempt, round.card, round.startTime, scheduleAdvance, settings.deckId, showExplanation, showHint, showQuestDialogue]);

  useEffect(() => {
    if (round.timeRemaining === 0 && !answer.inputLocked && round.card) {
      handleTimeUp();
    }
  }, [answer.inputLocked, handleTimeUp, round.card, round.timeRemaining]);

  const handleOptionPress = useCallback((option: string) => {
    if (answer.inputLocked || !round.card) return;

    const currentCard = round.card;

    clearAdvanceTimeout();

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    const correct = checkAnswer(option, getCanonicalAnswer(currentCard));
    const timeToAnswer = Date.now() - round.startTime;

    if (correct) {
      const newStreak = scoring.streak + 1;
      const dialogueEvent: QuestDialogueEvent = isMeaningfulQuestStreak(newStreak) ? 'streak' : 'correct';
      const points = calculateScore({
        isCorrect: true,
        mode: settings.mode,
        currentStreak: scoring.streak,
      });

      setAnswer((prev) => ({ ...prev, selectedOption: option, isCorrect: true, inputLocked: true }));
      showQuestDialogue(dialogueEvent, 'correct');
      void playSound(newStreak >= 3 ? 'streak' : 'correct');
      setScoring((prev) => ({
        ...prev,
        score: prev.score + points,
        correctCount: prev.correctCount + 1,
        streak: newStreak,
        bestStreak: Math.max(prev.bestStreak, newStreak),
        totalTimeMs: prev.totalTimeMs + timeToAnswer,
      }));
      setAssistant((prev) => ({ ...prev, missStreak: 0 }));

      logQuestAttempt({
        deckId: settings.deckId,
        cardId: currentCard.id,
        isCorrect: true,
        selectedOption: option,
        correctAnswer: getCanonicalAnswer(currentCard),
        timeToAnswerMs: timeToAnswer,
        mode: 'quest',
        hintsUsed: showHint ? 1 : 0,
        usedSecondChance: answer.usedSecondChance,
        explanationOpened: showExplanation,
      });

      triggerNotification(NotificationFeedbackType.Success);

      if (settings.explanationsEnabled && currentCard.explanation) {
        explanationTimeoutRef.current = setTimeout(() => setShowExplanation(true), 600);
      } else {
        scheduleAdvance(1000);
      }
      return;
    }

    const nextMissStreak = assistant.missStreak + 1;
    const dialogueEvent: QuestDialogueEvent = isMeaningfulQuestSlump(nextMissStreak) ? 'slump' : 'wrong';

    showQuestDialogue(dialogueEvent, 'wrong');
    void playSound('wrong');
    setAssistant((prev) => ({ ...prev, missStreak: nextMissStreak }));

    if (settings.secondChanceEnabled && !answer.usedSecondChance) {
      setAnswer({
        selectedOption: null,
        isCorrect: null,
        inputLocked: false,
        usedSecondChance: true,
      });
      setScoring((prev) => ({
        ...prev,
        totalTimeMs: prev.totalTimeMs + timeToAnswer,
      }));

      if (settings.timerSeconds > 0) {
        setRound((prev) => ({
          ...prev,
          timeRemaining: Math.max(3, Math.floor(settings.timerSeconds / 2)),
        }));
      }

      triggerImpact(ImpactFeedbackStyle.Medium);
      return;
    }

    setAnswer((prev) => ({ ...prev, selectedOption: option, isCorrect: false, inputLocked: true }));
    setScoring((prev) => ({
      ...prev,
      streak: 0,
      incorrectCount: prev.incorrectCount + 1,
      totalTimeMs: prev.totalTimeMs + timeToAnswer,
    }));
    setTracking((prev) => ({
      ...prev,
      missedCardIds: [...prev.missedCardIds, currentCard.id],
    }));

    logQuestAttempt({
      deckId: settings.deckId,
      cardId: currentCard.id,
      isCorrect: false,
      selectedOption: option,
      correctAnswer: getCanonicalAnswer(currentCard),
      timeToAnswerMs: timeToAnswer,
      mode: 'quest',
      hintsUsed: showHint ? 1 : 0,
      usedSecondChance: answer.usedSecondChance,
      explanationOpened: showExplanation,
    });

    triggerNotification(NotificationFeedbackType.Error);

    if (settings.explanationsEnabled && currentCard.explanation) {
      explanationTimeoutRef.current = setTimeout(() => setShowExplanation(true), 600);
    } else {
      scheduleAdvance(1200);
    }
  }, [answer.inputLocked, answer.usedSecondChance, assistant.missStreak, clearAdvanceTimeout, logQuestAttempt, round.card, round.startTime, scheduleAdvance, scoring.streak, settings, showExplanation, showHint, showQuestDialogue]);

  const advanceRound = useCallback(() => {
    const nextRound = round.number + 1;

    if (nextRound >= effectiveRunLength) {
      updateBestStreak(scoring.bestStreak);

      recordSessionResult({
        mode: GAME_MODE.QUEST,
        deckId: settings.deckId,
        xpEarned: Math.round(scoring.score * 0.4),
        cardsAttempted: effectiveRunLength,
        correctCount: scoring.correctCount,
        timestampISO: new Date().toISOString(),
        durationMs: scoring.totalTimeMs,
      });
      trackEvent({
        event: 'quest_completed',
        deckId: settings.deckId,
        properties: {
          mode: settings.mode,
          rounds: effectiveRunLength,
          correct: scoring.correctCount,
          accuracy: effectiveRunLength > 0 ? Math.round((scoring.correctCount / effectiveRunLength) * 100) : 0,
          best_streak: scoring.bestStreak,
          score: scoring.score,
          timer_seconds: settings.timerSeconds,
          focus_weak: settings.focusWeakOnly,
        },
      });
      logger.log('[Quest] Recorded session result, score:', scoring.score, 'cards:', effectiveRunLength);

      const result: QuestRunResult = {
        deckId: settings.deckId,
        settings,
        totalScore: scoring.score,
        totalRounds: effectiveRunLength,
        correctCount: scoring.correctCount,
        incorrectCount: scoring.incorrectCount,
        accuracy: scoring.correctCount / effectiveRunLength,
        bestStreak: scoring.bestStreak,
        totalTimeMs: scoring.totalTimeMs,
        missedCardIds: tracking.missedCardIds,
        askedCardIds: tracking.askedCardIds,
      };

      router.replace(questResultsHref({
        result: serializeQuestResult(result),
        challengeId,
        challengerScore,
        challengeOpponentId,
        challengeCardIds,
      }));
      return;
    }

    setRound((prev) => ({ ...prev, number: nextRound }));
    setShowExplanation(false);
    setupNextRound();
  }, [challengeCardIds, challengeId, challengeOpponentId, challengerScore, effectiveRunLength, recordSessionResult, round.number, router, scoring.bestStreak, scoring.correctCount, scoring.incorrectCount, scoring.score, scoring.totalTimeMs, settings, setupNextRound, tracking.askedCardIds, tracking.missedCardIds, updateBestStreak]);

  advanceRoundRef.current = advanceRound;

  const displayedOptions = useMemo(() => {
    if (!round.card) {
      return [] as FlashcardOption[];
    }

    if (round.options.length > 0) {
      return round.options;
    }

    logger.warn('[Quest] Rendering fallback option for card:', round.card.id);
    return [createFlashcardOptionFromCard(round.card, 'tile')];
  }, [round.card, round.options]);

  const displayQuestion = useMemo(() => (round.card ? getCardQuestionForSurface(round.card, 'quest') : ''), [round.card]);
  const displayHint = useMemo(() => formatGameplayHint(round.card?.hint1 ?? ''), [round.card?.hint1]);
  const displayOptions = useMemo(() => {
    return displayedOptions.map((option) => ({
      value: option.canonicalValue,
      label: option.displayText,
    }));
  }, [displayedOptions]);
  const displayOptionRows = useMemo<{ value: string; label: string }[][]>(() => {
    const rows: { value: string; label: string }[][] = [];

    for (let index = 0; index < displayOptions.length; index += 2) {
      rows.push(displayOptions.slice(index, index + 2));
    }

    return rows;
  }, [displayOptions]);
  const questionFooterText = useMemo(() => {
    const parts = ['4 answer cards', '1 correct'];

    if (settings.timerSeconds > 0) {
      parts.push(`${settings.timerSeconds}s clock`);
    } else {
      parts.push(settings.mode === 'learn' ? 'steady pace' : 'fast round');
    }

    return parts.join(' • ');
  }, [settings.mode, settings.timerSeconds]);

  const handleHintPress = useCallback(() => {
    if (!settings.hintsEnabled || !round.card?.hint1 || answer.inputLocked) return;
    setShowHint(true);
    triggerImpact(ImpactFeedbackStyle.Light);
  }, [answer.inputLocked, round.card, settings.hintsEnabled]);

  const handleExplanationContinue = useCallback(() => {
    setShowExplanation(false);
    advanceRound();
  }, [advanceRound]);

  const handleQuit = useCallback(() => {
    router.back();
  }, [router]);

  const getCardState = (option: string): AnswerCardState => {
    if (!answer.selectedOption) {
      return answer.inputLocked ? 'disabled' : 'idle';
    }

    const isSelected = option === answer.selectedOption;
    const isCorrectOption = round.card && checkAnswer(option, getCanonicalAnswer(round.card));

    if (isCorrectOption) {
      return 'correct';
    }
    if (isSelected && !answer.isCorrect) {
      return 'wrong';
    }
    return 'disabled';
  };

  if (!syncReady) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <LinearGradient
          colors={[theme.gradientStart, theme.gradientMid, theme.gradientEnd]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
          <View style={styles.loadingContainer} testID="quest-sync-loading">
            <ActivityIndicator size="large" color={theme.primary} />
          </View>
        </SafeAreaView>
      </View>
    );
  }

  if (!deck || !round.card) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.background }}>
        <LinearGradient
          colors={[theme.gradientStart, theme.gradientMid, theme.gradientEnd]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }} edges={['top', 'bottom']}>
          <Text maxFontSizeMultiplier={1.3} style={{ fontSize: 18, fontWeight: '700', color: '#fff', marginBottom: 8 }}>Unable to start Quest</Text>
          <Text maxFontSizeMultiplier={1.3} style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)', marginBottom: 24, textAlign: 'center' }}>The deck or settings could not be loaded.</Text>
          <TouchableOpacity onPress={() => router.replace(QUEST_ROUTE)} style={{ backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 16, paddingVertical: 14, paddingHorizontal: 24 }}>
            <Text maxFontSizeMultiplier={1.3} style={{ fontSize: 16, fontWeight: '700', color: '#fff' }}>Back to Quest Menu</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </View>
    );
  }

  const currentRoundCard = round.card;

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
            accessibilityLabel="Close quest"
            accessibilityRole="button"
          >
            <X color="#fff" size={20} />
          </TouchableOpacity>

          <View style={styles.hudContainer} accessible={true} accessibilityLabel={`Question ${round.number + 1} of ${effectiveRunLength}. Score: ${scoring.score} points.`}>
            <Text maxFontSizeMultiplier={1.2} style={styles.hudValue}>{round.number + 1}/{effectiveRunLength}</Text>
            <View style={styles.hudDivider} />
            <Text maxFontSizeMultiplier={1.2} style={styles.hudValue}>{scoring.score} pts</Text>
            <View style={styles.hudDivider} />
            <View style={styles.hudItem}>
              <Zap color="#FFD700" size={12} />
              <Text maxFontSizeMultiplier={1.2} style={styles.hudValue}>{scoring.streak}</Text>
            </View>
          </View>

          {settings.timerSeconds > 0 && round.timeRemaining !== null && (
            <View style={[styles.timerContainer, round.timeRemaining <= 3 && styles.timerWarning]}>
              <Clock color={round.timeRemaining <= 3 ? theme.error : '#fff'} size={14} />
              <Text maxFontSizeMultiplier={1.2} style={[styles.timerText, round.timeRemaining <= 3 && { color: theme.error }]}>
                {round.timeRemaining}s
              </Text>
            </View>
          )}
        </View>

        <View style={styles.topStage}>
          <View
            style={[
              styles.assistantCard,
              { backgroundColor: 'rgba(8, 15, 30, 0.18)', borderColor: 'rgba(255, 255, 255, 0.12)' },
            ]}
            testID="questAssistantRow"
          >
            <View style={styles.assistantMetaRow}>
              <Text maxFontSizeMultiplier={1.3} style={styles.assistantEyebrow}>FLASHQUEST AI</Text>
              <Text maxFontSizeMultiplier={1.3} style={styles.assistantMode}>{settings.mode === 'learn' ? 'Learn round' : 'Battle round'}</Text>
            </View>
            <DealerPlaceholder dialogueType={assistant.tone} customDialogue={assistant.line} size="small" title="Round assistant" />
          </View>

          <View style={[styles.questionCard, { backgroundColor: theme.cardBackground }]} testID="questQuestionCard">
            <View style={styles.questionMetaRow}>
              <View style={[styles.questionPill, { backgroundColor: `${theme.primary}22` }]}>
                <Text maxFontSizeMultiplier={1.3} style={[styles.questionPillText, { color: theme.primary }]} numberOfLines={1}>
                  {deck.name}
                </Text>
              </View>
              <FlashcardDebugButton
                deckId={currentRoundCard.deckId}
                cardId={currentRoundCard.id}
                surface="quest"
                options={round.options}
                testID="quest-flashcard-debug-button"
              />
            </View>
            <Text maxFontSizeMultiplier={1.3} style={[styles.questionText, { color: theme.text }]} numberOfLines={4} accessibilityRole="header">
              {displayQuestion}
            </Text>
            <View style={styles.questionFooter}>
              <Text maxFontSizeMultiplier={1.3} style={[styles.questionFooterText, { color: theme.textSecondary }]} numberOfLines={1}>
                {questionFooterText}
              </Text>
            </View>

          {settings.hintsEnabled && !!currentRoundCard.hint1 && !showHint && !answer.inputLocked && (
            <TouchableOpacity
              style={[styles.hintButton, { backgroundColor: theme.warning + '20' }]}
              onPress={handleHintPress}
              activeOpacity={0.7}
              accessibilityLabel="Hint"
              accessibilityRole="button"
            >
              <Lightbulb color={theme.warning} size={14} />
              <Text maxFontSizeMultiplier={1.3} style={[styles.hintButtonText, { color: theme.warning }]}>Hint</Text>
            </TouchableOpacity>
          )}
          
          {showHint && !!currentRoundCard.hint1 && (
            <View style={[styles.hintContainer, { backgroundColor: theme.warning + '15' }]}>
              <Lightbulb color={theme.warning} size={12} />
              <Text maxFontSizeMultiplier={1.3} style={[styles.hintText, { color: theme.warning }]}>{displayHint}</Text>
            </View>
          )}
          </View>
        </View>

        <View style={styles.gameArea}>
          <View style={[styles.answerGridContainer, { maxWidth: gameAreaMaxWidth }]}> 
            <View style={styles.tableSurface}>
              <View key={`${currentRoundCard.id}-${round.optionsRenderKey}`} style={styles.optionsGrid} testID="questAnswerGrid">
              {displayOptionRows.map((row, rowIndex) => {
                const isLastRow = rowIndex === displayOptionRows.length - 1;

                return (
                  <View
                    key={`${currentRoundCard.id}-${round.optionsRenderKey}-row-${rowIndex}`}
                    style={[styles.optionsRow, isLastRow && styles.optionsRowLast]}
                  >
                    {row.map(({ value, label }, columnIndex) => {
                      const optionIndex = (rowIndex * 2) + columnIndex;

                      return (
                        <AnswerCard
                          key={`${currentRoundCard.id}-${round.optionsRenderKey}-${optionIndex}-${value}`}
                          optionText={label}
                          suit={getSuitForIndex(optionIndex)}
                          index={optionIndex}
                          state={getCardState(value)}
                          onPress={() => handleOptionPress(value)}
                        />
                      );
                    })}
                    {row.length === 1 ? <View style={styles.answerCardSpacer} /> : null}
                  </View>
                );
              })}
              </View>
            </View>
          </View>
        </View>

        {showExplanation && !!currentRoundCard.explanation && (
          <View style={styles.explanationOverlay}>
            <View style={[styles.explanationCard, { backgroundColor: theme.cardBackground }]}>
              <Text maxFontSizeMultiplier={1.3} style={[styles.explanationTitle, { color: answer.isCorrect ? theme.success : theme.error }]}>
                {answer.isCorrect ? 'Correct!' : 'Incorrect'}
              </Text>
              <Text maxFontSizeMultiplier={1.3} style={[styles.explanationAnswer, { color: theme.text }]}>
                Answer: {getCardAnswerForSurface(currentRoundCard, 'study')}
              </Text>
              <Text maxFontSizeMultiplier={1.3} style={[styles.explanationText, { color: theme.textSecondary }]} numberOfLines={6}>
                {currentRoundCard.explanation}
              </Text>
              <TouchableOpacity
                style={[styles.continueButton, { backgroundColor: theme.primary }]}
                onPress={handleExplanationContinue}
                activeOpacity={0.8}
                accessibilityLabel="Continue"
                accessibilityRole="button"
              >
                <Text maxFontSizeMultiplier={1.3} style={styles.continueButtonText}>Continue</Text>
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
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 8,
  },
  quitButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  hudContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  hudItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  hudValue: {
    fontSize: 13,
    color: '#fff',
    fontWeight: '700' as const,
  },
  hudDivider: {
    width: 1,
    height: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    marginHorizontal: 10,
  },
  timerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  timerWarning: {
    backgroundColor: 'rgba(239, 68, 68, 0.3)',
  },
  timerText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '700' as const,
  },
  topStage: {
    paddingTop: 4,
    paddingBottom: 8,
    gap: 10,
  },
  assistantCard: {
    marginHorizontal: GRID_HORIZONTAL_MARGIN,
    borderRadius: 20,
    borderWidth: 1,
    minHeight: 86,
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
    marginBottom: 2,
  },
  assistantEyebrow: {
    fontSize: 11,
    fontWeight: '800' as const,
    color: 'rgba(255, 255, 255, 0.9)',
    letterSpacing: 0.8,
  },
  assistantMode: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: 'rgba(255, 255, 255, 0.72)',
  },
  gameArea: {
    flex: 1,
    justifyContent: 'center',
    paddingBottom: 8,
  },
  questionCard: {
    marginHorizontal: GRID_HORIZONTAL_MARGIN,
    marginBottom: 4,
    borderRadius: 22,
    paddingHorizontal: 20,
    paddingVertical: 18,
    minHeight: 156,
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.14,
    shadowRadius: 12,
    elevation: 6,
  },
  questionMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    gap: 10,
  },
  questionPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    maxWidth: '82%',
  },
  questionPillText: {
    fontSize: 12,
    fontWeight: '700' as const,
  },
  questionText: {
    fontSize: 20,
    fontWeight: '700' as const,
    textAlign: 'center',
    lineHeight: 27,
  },
  questionFooter: {
    marginTop: 12,
    alignItems: 'center',
  },
  questionFooterText: {
    fontSize: 12,
    fontWeight: '700' as const,
    letterSpacing: 0.2,
  },
  hintButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: 14,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 10,
    alignSelf: 'center',
  },
  hintButtonText: {
    fontSize: 12,
    fontWeight: '600' as const,
  },
  hintContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: 14,
    padding: 12,
    borderRadius: 12,
  },
  hintText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  answerGridContainer: {
    alignItems: 'center',
    alignSelf: 'center',
    width: '100%',
  },
  tableSurface: {
    backgroundColor: 'rgba(0, 50, 35, 0.34)',
    marginHorizontal: GRID_HORIZONTAL_MARGIN,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: CARD_PADDING,
    paddingVertical: CARD_PADDING + 2,
  },
  optionsGrid: {
    width: '100%',
  },
  optionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: CARD_GAP,
  },
  optionsRowLast: {
    marginBottom: 0,
  },
  answerCardSpacer: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    opacity: 0,
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
