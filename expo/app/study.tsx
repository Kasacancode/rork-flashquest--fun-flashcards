import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useLocalSearchParams, useNavigation } from 'expo-router';
import { ArrowLeft, ArrowLeftRight, BookOpen, Clock, AlertTriangle, RefreshCw, RotateCcw, Sparkles, Target, Zap } from 'lucide-react-native';
import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  useWindowDimensions,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import StudyFeed from '@/components/StudyFeed';
import { useFlashQuest } from '@/context/FlashQuestContext';
import { usePerformance } from '@/context/PerformanceContext';
import { useTheme } from '@/context/ThemeContext';
import { trackEvent } from '@/lib/analytics';
import type { Deck, Flashcard } from '@/types/flashcard';
import type { CardMemoryStatus } from '@/types/performance';
import { GAME_MODE } from '@/types/game';
import { logger } from '@/utils/logger';
import { getWeaknessScore, isCardDueForReview, getLiveCardStats, isWeakCard } from '@/utils/mastery';
import { buildCrossDeckReviewDeck, CROSS_DECK_REVIEW_DECK_ID } from '@/utils/reviewUtils';
import { DECKS_ROUTE, HOME_ROUTE, deckHubHref, questHref } from '@/utils/routes';
import { maybePromptReview } from '@/utils/storeReview';
import { triggerImpact } from '@/utils/haptics';
import { waitForInitialSync } from '@/utils/cloudSync';

type StudyCardPriority = 'lapsed' | 'due' | 'new' | 'weak' | 'remaining';
type StudyMode = 'all' | 'due' | 'quick-5' | 'quick-10' | 'quick-15' | 'weak';

interface StudyOrderSummary {
  lapsedCount: number;
  dueCount: number;
  newCount: number;
  weakCount: number;
}

function buildStudyOrder(
  flashcards: Flashcard[],
  cardStatsById: Record<string, import('@/types/performance').CardStats>,
): { ordered: Flashcard[]; summary: StudyOrderSummary } {
  const now = Date.now();

  const buckets: Record<StudyCardPriority, { card: Flashcard; sortKey: number }[]> = {
    lapsed: [],
    due: [],
    new: [],
    weak: [],
    remaining: [],
  };

  for (const card of flashcards) {
    const stats = cardStatsById[card.id];
    const live = getLiveCardStats(stats, now);

    if (live.attempts === 0) {
      buckets.new.push({ card, sortKey: 0 });
      continue;
    }

    if (live.status === 'lapsed') {
      buckets.lapsed.push({ card, sortKey: -live.lapses });
      continue;
    }

    if (isCardDueForReview(stats, now)) {
      const overdue = live.nextReviewAt ? now - live.nextReviewAt : 0;
      buckets.due.push({ card, sortKey: -overdue });
      continue;
    }

    if (isWeakCard(stats, now)) {
      buckets.weak.push({ card, sortKey: -getWeaknessScore(stats, now) });
      continue;
    }

    buckets.remaining.push({ card, sortKey: live.retrievability });
  }

  for (const bucket of Object.values(buckets)) {
    bucket.sort((a, b) => a.sortKey - b.sortKey);
  }

  const ordered = [
    ...buckets.lapsed,
    ...buckets.due,
    ...buckets.new,
    ...buckets.weak,
    ...buckets.remaining,
  ].map((entry) => entry.card);

  const summary: StudyOrderSummary = {
    lapsedCount: buckets.lapsed.length,
    dueCount: buckets.due.length,
    newCount: buckets.new.length,
    weakCount: buckets.weak.length,
  };

  return { ordered, summary };
}

function getDeckStudySummary(
  flashcards: Flashcard[],
  cardStatsById: Record<string, import('@/types/performance').CardStats>,
): { dueCount: number; newCount: number; lapsedCount: number; status: CardMemoryStatus | 'mixed' } {
  const now = Date.now();
  let dueCount = 0;
  let newCount = 0;
  let lapsedCount = 0;

  for (const card of flashcards) {
    const stats = cardStatsById[card.id];
    const live = getLiveCardStats(stats, now);

    if (live.attempts === 0) {
      newCount++;
    } else if (live.status === 'lapsed') {
      lapsedCount++;
    } else if (isCardDueForReview(stats, now)) {
      dueCount++;
    }
  }

  const status = lapsedCount > 0 ? 'lapsed'
    : dueCount > 0 ? 'mixed'
    : newCount === flashcards.length ? 'new'
    : 'mixed';

  return { dueCount, newCount, lapsedCount, status };
}

function getFlashcardsForStudyMode(
  orderedFlashcards: Flashcard[],
  studyMode: StudyMode | null,
  cardStatsById: Record<string, import('@/types/performance').CardStats>,
): Flashcard[] {
  if (!studyMode) {
    return [] as Flashcard[];
  }

  switch (studyMode) {
    case 'all':
      return orderedFlashcards;
    case 'due': {
      const now = Date.now();
      return orderedFlashcards.filter((card) => {
        const stats = cardStatsById[card.id];
        const live = getLiveCardStats(stats, now);
        return live.status === 'lapsed' || isCardDueForReview(stats, now);
      });
    }
    case 'quick-5':
      return orderedFlashcards.slice(0, 5);
    case 'quick-10':
      return orderedFlashcards.slice(0, 10);
    case 'quick-15':
      return orderedFlashcards.slice(0, 15);
    case 'weak': {
      const now = Date.now();
      return orderedFlashcards.filter((card) => {
        const stats = cardStatsById[card.id];
        const live = getLiveCardStats(stats, now);
        if (live.attempts === 0 || live.status === 'lapsed' || isCardDueForReview(stats, now)) {
          return false;
        }
        return isWeakCard(stats, now);
      });
    }
    default:
      return orderedFlashcards;
  }
}

export default function StudyPage() {
  const router = useRouter();
  const navigation = useNavigation();
  const params = useLocalSearchParams<{ deckId?: string; initialMode?: string; source?: string }>();
  const { decks, stats, updateFlashcard, recordSessionResult } = useFlashQuest();
  const { performance } = usePerformance();
  const { theme, isDark } = useTheme();
  const { height: windowHeight } = useWindowDimensions();
  const isCompactResults = windowHeight < 780;
  const validModes: StudyMode[] = ['all', 'due', 'quick-5', 'quick-10', 'quick-15', 'weak'];
  const initialMode = validModes.includes(params.initialMode as StudyMode) ? (params.initialMode as StudyMode) : null;
  const launchedFromReviewHub = params.source === 'review-hub';
  const launchedFromDeckHub = params.source === 'deck-hub';

  const [showDeckSelector, setShowDeckSelector] = useState<boolean>(!params.deckId);
  const [selectedDeckId, setSelectedDeckId] = useState<string | null>(params.deckId || null);
  const [sessionResolved, setSessionResolved] = useState<number>(0);
  const [showResults, setShowResults] = useState<boolean>(false);
  const [sessionXp, setSessionXp] = useState<number>(0);
  const [reversed, setReversed] = useState<boolean>(false);
  const [studyMode, setStudyMode] = useState<StudyMode | null>(initialMode);
  const [sessionFlashcards, setSessionFlashcards] = useState<Flashcard[]>([]);
  const [syncReady, setSyncReady] = useState<boolean>(false);
  const [crossDeckReviewDeck, setCrossDeckReviewDeck] = useState<Deck | null>(
    () => (params.deckId === CROSS_DECK_REVIEW_DECK_ID ? buildCrossDeckReviewDeck(decks, performance.cardStatsById) : null),
  );
  const trackedStudyDeckIdRef = useRef<string | null>(null);
  const sessionStartRef = useRef<number>(Date.now());
  const sessionResolvedRef = useRef<number>(0);
  const allowExitRedirectRef = useRef<boolean>(false);

  const exitRoute = launchedFromReviewHub
    ? HOME_ROUTE
    : launchedFromDeckHub && selectedDeckId
      ? deckHubHref(selectedDeckId)
      : DECKS_ROUTE;

  const isCrossDeckReview = selectedDeckId === CROSS_DECK_REVIEW_DECK_ID;

  const liveCrossDeckReviewDeck = useMemo(
    () => (isCrossDeckReview ? buildCrossDeckReviewDeck(decks, performance.cardStatsById) : null),
    [decks, isCrossDeckReview, performance.cardStatsById],
  );

  useEffect(() => {
    if (!isCrossDeckReview) {
      setCrossDeckReviewDeck(null);
      return;
    }

    if (sessionFlashcards.length > 0 || showResults) {
      return;
    }

    setCrossDeckReviewDeck((currentDeck) => {
      if (!liveCrossDeckReviewDeck) {
        return null;
      }

      return currentDeck ?? liveCrossDeckReviewDeck;
    });
  }, [isCrossDeckReview, liveCrossDeckReviewDeck, sessionFlashcards.length, showResults]);

  const selectedDeck = useMemo(() => {
    if (isCrossDeckReview) {
      return crossDeckReviewDeck ?? liveCrossDeckReviewDeck;
    }

    return decks.find((deck) => deck.id === selectedDeckId);
  }, [crossDeckReviewDeck, decks, isCrossDeckReview, liveCrossDeckReviewDeck, selectedDeckId]);

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

  const { orderedFlashcards, studySummary } = useMemo(() => {
    if (!selectedDeck) {
      return { orderedFlashcards: [], studySummary: { lapsedCount: 0, dueCount: 0, newCount: 0, weakCount: 0 } };
    }

    const { ordered, summary } = buildStudyOrder(selectedDeck.flashcards, performance.cardStatsById);
    return { orderedFlashcards: ordered, studySummary: summary };
  }, [selectedDeck, performance.cardStatsById]);

  const remainingDueCount = useMemo(() => {
    return getFlashcardsForStudyMode(orderedFlashcards, 'due', performance.cardStatsById).length;
  }, [orderedFlashcards, performance.cardStatsById]);

  const deckSummaries = useMemo(() => {
    const entries = new Map<string, { dueCount: number; newCount: number; lapsedCount: number }>();
    for (const deck of decks) {
      entries.set(deck.id, getDeckStudySummary(deck.flashcards, performance.cardStatsById));
    }
    return entries;
  }, [decks, performance.cardStatsById]);

  useEffect(() => {
    if (!selectedDeck || !studyMode || showResults || sessionFlashcards.length > 0) {
      return;
    }

    const nextSessionFlashcards = getFlashcardsForStudyMode(orderedFlashcards, studyMode, performance.cardStatsById);
    if (nextSessionFlashcards.length === 0) {
      return;
    }

    logger.debug('[Study] Initializing stable session flashcards', {
      deckId: selectedDeck.id,
      studyMode,
      count: nextSessionFlashcards.length,
    });
    setSessionFlashcards(nextSessionFlashcards);
  }, [orderedFlashcards, performance.cardStatsById, selectedDeck, sessionFlashcards.length, showResults, studyMode]);

  const handleDeckSelect = useCallback((deckId: string) => {
    trackedStudyDeckIdRef.current = null;
    sessionStartRef.current = Date.now();
    sessionResolvedRef.current = 0;
    setSelectedDeckId(deckId);
    setShowDeckSelector(false);
    setSessionResolved(0);
    setSessionXp(0);
    setShowResults(false);
    setStudyMode(null);
    setSessionFlashcards([]);
  }, []);

  const handleSelectStudyMode = useCallback((mode: StudyMode) => {
    trackedStudyDeckIdRef.current = null;
    sessionStartRef.current = Date.now();
    sessionResolvedRef.current = 0;
    const nextSessionFlashcards = getFlashcardsForStudyMode(orderedFlashcards, mode, performance.cardStatsById);
    logger.debug('[Study] Starting session', {
      deckId: selectedDeck?.id,
      mode,
      count: nextSessionFlashcards.length,
    });
    setSessionResolved(0);
    setSessionXp(0);
    setShowResults(false);
    setStudyMode(mode);
    setSessionFlashcards(nextSessionFlashcards);
  }, [orderedFlashcards, performance.cardStatsById, selectedDeck?.id]);

  const handleCardResolved = useCallback((_cardId: string) => {
    if (selectedDeck) {
      sessionResolvedRef.current += 1;
    }
  }, [selectedDeck]);

  useEffect(() => {
    if (!selectedDeck || !studyMode || showResults) {
      return;
    }

    if (trackedStudyDeckIdRef.current === selectedDeck.id) {
      return;
    }

    trackedStudyDeckIdRef.current = selectedDeck.id;
    trackEvent({
      event: 'deck_played',
      deckId: selectedDeck.id === CROSS_DECK_REVIEW_DECK_ID ? undefined : selectedDeck.id,
      properties: {
        deck_name: selectedDeck.name,
        mode: GAME_MODE.STUDY,
        study_mode: studyMode,
      },
    });
  }, [selectedDeck, showResults, studyMode]);

  const handleComplete = useCallback(() => {
    if (!selectedDeck) {
      return;
    }

    const resolvedCount = sessionResolvedRef.current;
    const recordedDeckId = selectedDeck.id === CROSS_DECK_REVIEW_DECK_ID ? undefined : selectedDeck.id;
    setSessionResolved(resolvedCount);

    if (resolvedCount === 0) {
      setSessionXp(0);
      setShowResults(true);
      return;
    }

    const xpEarned = resolvedCount * 2;
    setSessionXp(xpEarned);
    recordSessionResult({
      mode: GAME_MODE.STUDY,
      deckId: recordedDeckId,
      xpEarned,
      cardsAttempted: resolvedCount,
      timestampISO: new Date().toISOString(),
      durationMs: Date.now() - sessionStartRef.current,
    });
    trackEvent({
      event: 'study_completed',
      deckId: recordedDeckId,
      properties: {
        cards_studied: resolvedCount,
        deck_name: selectedDeck.name,
      },
    });
    logger.debug('[Study] Session complete, cards:', resolvedCount, 'xp:', xpEarned);
    setShowResults(true);
    void maybePromptReview({
      totalStudySessions: stats.totalStudySessions,
      totalQuestSessions: stats.totalQuestSessions,
      currentStreak: stats.currentStreak,
    });
  }, [recordSessionResult, selectedDeck, stats.currentStreak, stats.totalQuestSessions, stats.totalStudySessions]);

  const handleRestart = useCallback(() => {
    trackedStudyDeckIdRef.current = null;
    sessionStartRef.current = Date.now();
    sessionResolvedRef.current = 0;
    setSessionResolved(0);
    setSessionXp(0);
    setShowResults(false);
    setSessionFlashcards(getFlashcardsForStudyMode(orderedFlashcards, studyMode, performance.cardStatsById));
  }, [orderedFlashcards, performance.cardStatsById, studyMode]);

  const handleContinueWithAll = useCallback(() => {
    trackedStudyDeckIdRef.current = null;
    sessionStartRef.current = Date.now();
    sessionResolvedRef.current = 0;
    const nextSessionFlashcards = getFlashcardsForStudyMode(orderedFlashcards, 'all', performance.cardStatsById);
    logger.debug('[Study] Continuing with all cards', {
      deckId: selectedDeck?.id,
      count: nextSessionFlashcards.length,
    });
    setSessionResolved(0);
    setSessionXp(0);
    setShowResults(false);
    setStudyMode('all');
    setSessionFlashcards(nextSessionFlashcards);
  }, [orderedFlashcards, performance.cardStatsById, selectedDeck?.id]);

  const handleUpdateCard = useCallback((cardId: string, updates: Partial<Flashcard>) => {
    const card = sessionFlashcards.find((entry) => entry.id === cardId)
      ?? selectedDeck?.flashcards.find((entry) => entry.id === cardId);
    const deckId = card?.deckId ?? selectedDeck?.id ?? '';

    if (deckId) {
      updateFlashcard(deckId, cardId, updates);
    }
  }, [selectedDeck, sessionFlashcards, updateFlashcard]);

  const handleToggleReversed = useCallback(() => {
    triggerImpact();
    setReversed((prev) => !prev);
  }, []);

  const handleExitStudy = useCallback(() => {
    allowExitRedirectRef.current = true;

    if (launchedFromReviewHub) {
      logger.debug('[Study] Exiting study to home');
      router.dismissTo(HOME_ROUTE);
      return;
    }

    if (launchedFromDeckHub) {
      const fallbackRoute = selectedDeckId ? deckHubHref(selectedDeckId) : DECKS_ROUTE;
      logger.debug('[Study] Exiting study to deck hub', {
        deckId: selectedDeckId,
        canGoBack: navigation.canGoBack(),
      });

      if (navigation.canGoBack()) {
        router.back();
      } else {
        router.replace(fallbackRoute);
      }
      return;
    }

    logger.debug('[Study] Exiting study to decks');
    router.replace(DECKS_ROUTE);
  }, [launchedFromDeckHub, launchedFromReviewHub, navigation, router, selectedDeckId]);

  const handleBackFromStudy = useCallback(() => {
    handleExitStudy();
  }, [handleExitStudy]);

  const handleResultsBack = useCallback(() => {
    handleExitStudy();
  }, [handleExitStudy]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (event) => {
      if (allowExitRedirectRef.current) {
        allowExitRedirectRef.current = false;
        return;
      }

      const actionType = event.data.action.type;
      const shouldRedirectExit = actionType === 'GO_BACK' || actionType === 'POP' || actionType === 'POP_TO_TOP';

      if (!shouldRedirectExit) {
        return;
      }

      logger.debug('[Study] Redirecting back action to exit route', {
        actionType,
        target: exitRoute,
      });
      event.preventDefault();
      handleExitStudy();
    });

    return unsubscribe;
  }, [exitRoute, handleExitStudy, navigation]);

  if (!syncReady) {
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={isDark ? ['#1a1a2e', '#16213e'] : ['#667eea', '#764ba2']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />

        <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
          <View style={styles.syncLoadingContainer} testID="study-sync-loading">
            <ActivityIndicator size="large" color={theme.primary} />
          </View>
        </SafeAreaView>
      </View>
    );
  }

  if (showResults && selectedDeck) {
    const needsReviewCount = studySummary.lapsedCount + studySummary.dueCount;
    const resultsBackgroundColors = isDark
      ? ['#071120', '#102447', '#173E67'] as [string, string, string]
      : ['#F8FBFF', '#EAF1FF', '#F3ECFF'] as [string, string, string];
    const resultsPrimaryGradient = isDark
      ? ['#A78BFA', '#6366F1'] as [string, string]
      : ['#4F46E5', '#6366F1'] as [string, string];
    const resultsInsightGradient = isDark
      ? ['rgba(8, 15, 28, 0.92)', 'rgba(24, 37, 61, 0.84)'] as [string, string]
      : ['rgba(255, 255, 255, 0.92)', 'rgba(239, 244, 255, 0.98)'] as [string, string];
    const resultsSurface = isDark ? 'rgba(9, 18, 34, 0.62)' : 'rgba(255, 255, 255, 0.76)';
    const resultsSurfaceStrong = isDark ? 'rgba(7, 15, 30, 0.72)' : 'rgba(255, 255, 255, 0.94)';
    const resultsSecondarySurface = isDark ? 'rgba(15, 23, 42, 0.52)' : 'rgba(255, 255, 255, 0.8)';
    const resultsBorder = isDark ? 'rgba(148, 163, 184, 0.16)' : 'rgba(99, 102, 241, 0.12)';
    const resultsTitleColor = isDark ? '#FFFFFF' : '#182033';
    const resultsMutedText = isDark ? 'rgba(226, 232, 240, 0.82)' : '#5B6474';
    const resultsSoftText = isDark ? '#94A3B8' : '#6B7280';
    const resultsChipText = isDark ? '#E2E8F0' : '#374151';
    const resultsGlowColor = studyMode === 'due'
      ? remainingDueCount === 0
        ? isDark ? 'rgba(16, 185, 129, 0.2)' : 'rgba(16, 185, 129, 0.12)'
        : isDark ? 'rgba(245, 158, 11, 0.16)' : 'rgba(245, 158, 11, 0.1)'
      : isDark ? 'rgba(129, 140, 248, 0.24)' : 'rgba(99, 102, 241, 0.14)';
    const eyebrowBackground = studyMode === 'due'
      ? remainingDueCount === 0
        ? isDark ? 'rgba(16, 185, 129, 0.16)' : 'rgba(16, 185, 129, 0.12)'
        : isDark ? 'rgba(245, 158, 11, 0.16)' : 'rgba(245, 158, 11, 0.12)'
      : isDark ? 'rgba(129, 140, 248, 0.18)' : 'rgba(79, 70, 229, 0.1)';
    const eyebrowIconColor = studyMode === 'due'
      ? remainingDueCount === 0 ? '#34D399' : '#F59E0B'
      : isDark ? '#C4B5FD' : '#4F46E5';
    const statusAccentColor = studyMode === 'due'
      ? remainingDueCount === 0 ? '#34D399' : '#F59E0B'
      : '#818CF8';
    const secondaryStatValue = studyMode === 'due' ? remainingDueCount : selectedDeck.flashcards.length;
    const secondaryStatLabel = studyMode === 'due' ? 'Still due' : 'In deck';
    const secondaryStatValueColor = studyMode === 'due' && remainingDueCount === 0
      ? '#10B981'
      : isDark ? '#A5B4FC' : '#4F46E5';
    const resultsDeckLabel = isCrossDeckReview ? 'Multiple decks' : selectedDeck.name;
    const resultsModeLabel = studyMode === 'due'
      ? isCrossDeckReview ? 'Cross-deck review' : remainingDueCount === 0 ? 'Queue cleared' : 'Review run'
      : studyMode === 'quick-5' ? 'Fast 5'
      : studyMode === 'quick-10' ? 'Fast 10'
      : studyMode === 'quick-15' ? 'Fast 15'
      : studyMode === 'weak' ? 'Weak spots'
      : 'Full deck';
    const resultsEyebrowLabel = studyMode === 'due'
      ? remainingDueCount === 0 ? 'Due queue cleared' : 'Review checkpoint'
      : 'Study session complete';
    const resultsTitleText = studyMode === 'due'
      ? remainingDueCount === 0 ? 'You’re all caught up' : 'Nice progress'
      : 'Deck Complete!';
    const resultsSubtitleText = studyMode === 'due'
      ? remainingDueCount === 0
        ? isCrossDeckReview
          ? 'Your due queue is clear across every deck in this session'
          : `${selectedDeck.name} has no cards waiting for review right now`
        : isCrossDeckReview
          ? `You finished this pass across multiple decks and ${remainingDueCount} card${remainingDueCount !== 1 ? 's are' : ' is'} still due`
          : `You finished this pass in ${selectedDeck.name} and ${remainingDueCount} card${remainingDueCount !== 1 ? 's are' : ' is'} still due`
      : `Great work studying ${selectedDeck.name}`;
    const resultsStatusTitleText = studyMode === 'due'
      ? remainingDueCount === 0
        ? isCrossDeckReview ? 'This review run is cleared for now' : 'This deck is cleared for now'
        : isCrossDeckReview ? 'Nice pass across your review queue' : 'You can stop here or keep reinforcing'
      : 'Nice momentum';
    const resultsStatusBodyText = studyMode === 'due'
      ? remainingDueCount === 0
        ? isCrossDeckReview
          ? 'Head home and the review hub will pull these decks back in when more cards are due'
          : 'Head home and the review hub will bring this deck back when cards are due again'
        : isCrossDeckReview
          ? 'You finished the current cross-deck pass, so head home now and come back when more cards are ready'
          : 'You finished the current review pass, so go home now or continue with the full deck for extra reps'
      : 'Come back later for spaced repetition or jump into Quest mode to test recall under pressure';

    return (
      <View style={styles.container}>
        <LinearGradient
          colors={resultsBackgroundColors}
          start={{ x: 0.05, y: 0 }}
          end={{ x: 0.95, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={[styles.resultsAmbientOrbTop, { backgroundColor: isDark ? 'rgba(110, 231, 183, 0.16)' : 'rgba(129, 140, 248, 0.16)' }]} pointerEvents="none" />
        <View style={[styles.resultsAmbientOrbBottom, { backgroundColor: isDark ? 'rgba(129, 140, 248, 0.18)' : 'rgba(59, 130, 246, 0.14)' }]} pointerEvents="none" />

        <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
          <ScrollView
            contentContainerStyle={[
              styles.resultsScrollContent,
              isCompactResults ? styles.resultsScrollContentCompact : null,
            ]}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            <View
              style={[
                styles.resultsContainer,
                isCompactResults ? styles.resultsContainerCompact : null,
              ]}
            >
              <View style={styles.resultsTopBar}>
                <TouchableOpacity
                  style={[
                    styles.resultsTopBackButton,
                    {
                      backgroundColor: resultsSecondarySurface,
                      borderColor: resultsBorder,
                      shadowColor: theme.shadow,
                      shadowOffset: { width: 0, height: 10 },
                      shadowOpacity: isDark ? 0.22 : 0.08,
                      shadowRadius: 20,
                      elevation: isDark ? 6 : 3,
                    },
                  ]}
                  onPress={handleResultsBack}
                  accessibilityLabel={launchedFromReviewHub ? 'Back to home' : 'Go back'}
                  accessibilityRole="button"
                  testID="study-results-top-back-button"
                >
                  <ArrowLeft color={resultsTitleColor} size={20} strokeWidth={2.5} />
                </TouchableOpacity>
              </View>

              <View style={styles.resultsMainContent}>
                <View
                  style={[
                    styles.resultsHeroCard,
                    isCompactResults ? styles.resultsHeroCardCompact : null,
                    {
                      backgroundColor: resultsSurface,
                      borderColor: resultsBorder,
                      shadowColor: theme.shadow,
                      shadowOffset: { width: 0, height: 18 },
                      shadowOpacity: isDark ? 0.28 : 0.08,
                      shadowRadius: isDark ? 28 : 18,
                      elevation: isDark ? 8 : 4,
                    },
                  ]}
                >
                  <View style={[styles.resultsHeroGlow, { backgroundColor: resultsGlowColor }]} pointerEvents="none" />

                  <View
                    style={[
                      styles.resultsEyebrow,
                      isCompactResults ? styles.resultsEyebrowCompact : null,
                      { alignSelf: 'flex-start', backgroundColor: eyebrowBackground },
                    ]}
                  >
                    {studyMode === 'due' ? (
                      <RefreshCw color={eyebrowIconColor} size={14} strokeWidth={2.3} />
                    ) : (
                      <BookOpen color={eyebrowIconColor} size={14} strokeWidth={2.3} />
                    )}
                    <Text style={[styles.resultsEyebrowText, { color: resultsTitleColor }]}>{resultsEyebrowLabel}</Text>
                  </View>

                  <Text style={[styles.resultsTitle, isCompactResults ? styles.resultsTitleCompact : null, { color: resultsTitleColor }]}>
                    {resultsTitleText}
                  </Text>
                  <Text style={[styles.resultsSubtitle, isCompactResults ? styles.resultsSubtitleCompact : null, { color: resultsMutedText, maxWidth: 360 }]}> 
                    {resultsSubtitleText}
                  </Text>

                  <View style={styles.resultsMetaRow}>
                    <View style={[styles.resultsMetaChip, { backgroundColor: resultsSecondarySurface, borderColor: resultsBorder }]}> 
                      <BookOpen color={theme.primary} size={14} strokeWidth={2.2} />
                      <Text style={[styles.resultsMetaText, { color: resultsChipText }]} numberOfLines={1}>
                        {resultsDeckLabel}
                      </Text>
                    </View>
                    <View style={[styles.resultsMetaChip, { backgroundColor: resultsSecondarySurface, borderColor: resultsBorder }]}> 
                      <Clock color={statusAccentColor} size={14} strokeWidth={2.2} />
                      <Text style={[styles.resultsMetaText, { color: resultsChipText }]}>{resultsModeLabel}</Text>
                    </View>
                  </View>
                </View>

                <View style={styles.resultsStatsGrid}>
                  <View
                    style={[
                      styles.resultsStatCard,
                      isCompactResults ? styles.resultsStatCardCompact : null,
                      { backgroundColor: resultsSurfaceStrong, borderColor: resultsBorder },
                    ]}
                  >
                    <View style={[styles.resultsStatIconWrap, { backgroundColor: isDark ? 'rgba(99, 102, 241, 0.16)' : 'rgba(79, 70, 229, 0.08)' }]}>
                      <BookOpen color={theme.primary} size={16} strokeWidth={2.2} />
                    </View>
                    <Text style={[styles.resultsStatCardValue, isCompactResults ? styles.resultsStatCardValueCompact : null, { color: resultsTitleColor }]}>
                      {sessionResolved}
                    </Text>
                    <Text style={[styles.resultsStatCardLabel, { color: resultsSoftText }]}>
                      {studyMode === 'due' ? 'Reviewed now' : 'Reviewed'}
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.resultsStatCard,
                      isCompactResults ? styles.resultsStatCardCompact : null,
                      { backgroundColor: resultsSurfaceStrong, borderColor: resultsBorder },
                    ]}
                  >
                    <View style={[styles.resultsStatIconWrap, { backgroundColor: isDark ? 'rgba(129, 140, 248, 0.16)' : 'rgba(99, 102, 241, 0.08)' }]}>
                      {studyMode === 'due' ? (
                        <RefreshCw color={secondaryStatValueColor} size={16} strokeWidth={2.2} />
                      ) : (
                        <ArrowLeftRight color={secondaryStatValueColor} size={16} strokeWidth={2.2} />
                      )}
                    </View>
                    <Text style={[styles.resultsStatCardValue, isCompactResults ? styles.resultsStatCardValueCompact : null, { color: secondaryStatValueColor }]}>
                      {secondaryStatValue}
                    </Text>
                    <Text style={[styles.resultsStatCardLabel, { color: resultsSoftText }]}>{secondaryStatLabel}</Text>
                  </View>

                  <View
                    style={[
                      styles.resultsStatCard,
                      isCompactResults ? styles.resultsStatCardCompact : null,
                      { backgroundColor: resultsSurfaceStrong, borderColor: resultsBorder },
                    ]}
                  >
                    <View style={[styles.resultsStatIconWrap, { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.16)' : 'rgba(16, 185, 129, 0.1)' }]}>
                      <Zap color="#10B981" size={16} strokeWidth={2.2} />
                    </View>
                    <Text style={[styles.resultsStatCardValue, isCompactResults ? styles.resultsStatCardValueCompact : null, { color: '#10B981' }]}>+{sessionXp}</Text>
                    <Text style={[styles.resultsStatCardLabel, { color: resultsSoftText }]}>XP earned</Text>
                  </View>
                </View>

                <LinearGradient
                  colors={resultsInsightGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[
                    styles.resultsStatusCardNew,
                    isCompactResults ? styles.resultsStatusCardCompactNew : null,
                    { borderColor: resultsBorder },
                  ]}
                >
                  <View style={styles.resultsStatusHeader}>
                    <View style={[styles.resultsStatusDot, { backgroundColor: statusAccentColor }]} />
                    <Text style={[styles.resultsStatusTitle, { color: resultsTitleColor }]}>{resultsStatusTitleText}</Text>
                  </View>
                  <Text style={[styles.resultsStatusText, { color: resultsMutedText }]}>{resultsStatusBodyText}</Text>

                  {(needsReviewCount > 0 || studySummary.newCount > 0) ? (
                    <View style={styles.resultsInsightChips}>
                      {needsReviewCount > 0 ? (
                        <View style={[styles.resultsInsightChip, { backgroundColor: resultsSecondarySurface, borderColor: resultsBorder }]}>
                          <RefreshCw color="#F59E0B" size={14} strokeWidth={2.2} />
                          <Text style={[styles.resultsInsightChipText, { color: resultsChipText }]}>
                            {needsReviewCount} card{needsReviewCount !== 1 ? 's' : ''} still need review {isCrossDeckReview ? 'in this session' : 'in this deck'}
                          </Text>
                        </View>
                      ) : null}
                      {studySummary.newCount > 0 ? (
                        <View style={[styles.resultsInsightChip, { backgroundColor: resultsSecondarySurface, borderColor: resultsBorder }]}>
                          <Sparkles color="#60A5FA" size={14} strokeWidth={2.2} />
                          <Text style={[styles.resultsInsightChipText, { color: resultsChipText }]}>
                            {studySummary.newCount} new card{studySummary.newCount !== 1 ? 's are' : ' is'} ready when you want to keep going
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  ) : null}
                </LinearGradient>
              </View>

              <View style={styles.resultsActions}>
                <TouchableOpacity
                  style={styles.resultsPrimaryButtonWrap}
                  onPress={handleResultsBack}
                  accessibilityLabel={launchedFromReviewHub ? 'Back to home' : 'Go back'}
                  accessibilityRole="button"
                  testID="study-results-back-button"
                  activeOpacity={0.9}
                >
                  <LinearGradient
                    colors={resultsPrimaryGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.resultsPrimaryButtonFill}
                  >
                    <Text style={styles.resultsPrimaryButtonTextNew}>
                      {launchedFromReviewHub ? 'Back to Home' : studyMode === 'due' ? 'Done for Now' : 'Back to Decks'}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>

                {!isCrossDeckReview ? (
                  <View style={[styles.resultsActionRow, isCompactResults ? styles.resultsActionRowCompact : null]}>
                    {studyMode === 'due' ? (
                      <TouchableOpacity
                        style={[
                          styles.resultsSecondaryAction,
                          isCompactResults ? styles.resultsSecondaryActionCompact : null,
                          { backgroundColor: resultsSecondarySurface, borderColor: resultsBorder },
                        ]}
                        onPress={handleContinueWithAll}
                        activeOpacity={0.86}
                        accessibilityRole="button"
                        testID="study-results-continue-all-button"
                      >
                        <View style={[styles.resultsSecondaryActionIconRow, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(79, 70, 229, 0.08)' }]}>
                          <RotateCcw color={resultsTitleColor} size={18} strokeWidth={2.2} />
                        </View>
                        <View style={styles.resultsSecondaryActionTextWrap}>
                          <Text style={[styles.resultsSecondaryActionTitle, { color: resultsTitleColor }]}>Continue All Cards</Text>
                          <Text style={[styles.resultsSecondaryActionSubtitle, { color: resultsSoftText }]}>Run the full deck now</Text>
                        </View>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        style={[
                          styles.resultsSecondaryAction,
                          isCompactResults ? styles.resultsSecondaryActionCompact : null,
                          { backgroundColor: resultsSecondarySurface, borderColor: resultsBorder },
                        ]}
                        onPress={handleRestart}
                        activeOpacity={0.86}
                        testID="study-results-restart-button"
                      >
                        <View style={[styles.resultsSecondaryActionIconRow, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(79, 70, 229, 0.08)' }]}>
                          <RotateCcw color={resultsTitleColor} size={18} strokeWidth={2.2} />
                        </View>
                        <View style={styles.resultsSecondaryActionTextWrap}>
                          <Text style={[styles.resultsSecondaryActionTitle, { color: resultsTitleColor }]}>Study Again</Text>
                          <Text style={[styles.resultsSecondaryActionSubtitle, { color: resultsSoftText }]}>Go once more right away</Text>
                        </View>
                      </TouchableOpacity>
                    )}

                    <TouchableOpacity
                      style={[
                        styles.resultsSecondaryAction,
                        isCompactResults ? styles.resultsSecondaryActionCompact : null,
                        { backgroundColor: resultsSecondarySurface, borderColor: resultsBorder },
                      ]}
                      onPress={() => router.push(questHref({ deckId: selectedDeck.id }))}
                      activeOpacity={0.86}
                    >
                      <View style={[styles.resultsSecondaryActionIconRow, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(79, 70, 229, 0.08)' }]}>
                        <Target color={resultsTitleColor} size={18} strokeWidth={2.2} />
                      </View>
                      <View style={styles.resultsSecondaryActionTextWrap}>
                        <Text style={[styles.resultsSecondaryActionTitle, { color: resultsTitleColor }]}>Quest Mode</Text>
                        <Text style={[styles.resultsSecondaryActionSubtitle, { color: resultsSoftText }]}>Pressure test recall</Text>
                      </View>
                    </TouchableOpacity>
                  </View>
                ) : null}

                {!isCrossDeckReview ? (
                  <TouchableOpacity
                    style={styles.resultsLinkButtonNew}
                    onPress={() => router.push(deckHubHref(selectedDeck.id))}
                    activeOpacity={0.78}
                  >
                    <Zap color={isDark ? 'rgba(255,255,255,0.72)' : '#4F46E5'} size={17} strokeWidth={2.2} />
                    <Text style={[styles.resultsLinkButtonTextNew, { color: isDark ? 'rgba(255,255,255,0.78)' : '#4F46E5' }]}>View Deck Progress</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
          </ScrollView>
        </SafeAreaView>
      </View>
    );
  }

  if (!selectedDeck) {
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={isDark ? ['#1a1a2e', '#16213e'] : ['#667eea', '#764ba2']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />

        <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
          <View style={styles.header}>
            <TouchableOpacity onPress={handleExitStudy} style={styles.backButton} accessibilityLabel={launchedFromReviewHub ? 'Back to home' : 'Back to decks'} accessibilityRole="button">
              <ArrowLeft color="#fff" size={28} strokeWidth={2.5} />
            </TouchableOpacity>
            <Text style={styles.headerTitle} accessibilityRole="header">Study Mode</Text>
            <View style={styles.placeholder} />
          </View>

          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>Select a deck to start studying</Text>
            <TouchableOpacity
              style={styles.selectButton}
              onPress={() => setShowDeckSelector(true)}
            >
              <Text style={styles.selectButtonText}>Choose Deck</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>

        <Modal
          visible={showDeckSelector}
          animationType="slide"
          transparent
          onRequestClose={() => {
            if (!selectedDeckId) {
              handleExitStudy();
            } else {
              setShowDeckSelector(false);
            }
          }}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: isDark ? theme.card : '#fff' }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: isDark ? theme.text : '#333' }]}>Select a Deck</Text>
                <TouchableOpacity
                  onPress={() => {
                    if (!selectedDeckId) {
                      handleExitStudy();
                    } else {
                      setShowDeckSelector(false);
                    }
                  }}
                >
                  <Text style={[styles.modalClose, { color: isDark ? theme.textSecondary : '#666' }]}>✕</Text>
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.deckList} showsVerticalScrollIndicator={false}>
                {decks.length === 0 ? (
                  <View style={{ alignItems: 'center', padding: 32 }}>
                    <Text style={{ fontSize: 16, fontWeight: '700', color: isDark ? '#fff' : '#333', marginBottom: 8, textAlign: 'center' }}>No Decks Yet</Text>
                    <Text style={{ fontSize: 14, color: isDark ? 'rgba(255,255,255,0.6)' : '#666', textAlign: 'center', marginBottom: 20 }}>Create your first deck to start studying.</Text>
                    <TouchableOpacity
                      onPress={() => {
                        setShowDeckSelector(false);
                        router.push(DECKS_ROUTE);
                      }}
                      style={{ backgroundColor: theme.primary, borderRadius: 16, paddingVertical: 14, paddingHorizontal: 24 }}
                      testID="study-empty-go-to-decks-button"
                    >
                      <Text style={{ fontSize: 16, fontWeight: '700', color: '#fff' }}>Go to Decks</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  decks.map((deck) => {
                    const summary = deckSummaries.get(deck.id);
                    const actionCount = (summary?.dueCount ?? 0) + (summary?.lapsedCount ?? 0);
                    const hasAction = actionCount > 0;
                    const allNew = (summary?.newCount ?? 0) === deck.flashcards.length;
                    return (
                      <TouchableOpacity
                        key={deck.id}
                        style={[styles.deckOption, { backgroundColor: theme.deckOption }]}
                        onPress={() => handleDeckSelect(deck.id)}
                        activeOpacity={0.7}
                        accessibilityLabel={`${deck.name}. ${deck.flashcards.length} cards`}
                        accessibilityRole="button"
                      >
                        <View style={[styles.deckColorDot, { backgroundColor: deck.color }]} />
                        <View style={styles.deckOptionInfo}>
                          <Text style={[styles.deckOptionName, { color: isDark ? '#f1f5f9' : '#333' }]}>{deck.name}</Text>
                          <View style={styles.deckOptionMeta}>
                            <Text style={[styles.deckOptionCards, { color: isDark ? '#cbd5e1' : '#666' }]}>{deck.flashcards.length} cards</Text>
                            {hasAction ? (
                              <View style={styles.deckDueBadge}>
                                <Clock color="#F59E0B" size={11} strokeWidth={2.5} />
                                <Text style={styles.deckDueBadgeText}>{actionCount} due</Text>
                              </View>
                            ) : allNew ? (
                              <View style={[styles.deckDueBadge, styles.deckNewBadge]}>
                                <Sparkles color="#60A5FA" size={11} strokeWidth={2.5} />
                                <Text style={[styles.deckDueBadgeText, styles.deckNewBadgeText]}>New</Text>
                              </View>
                            ) : null}
                          </View>
                        </View>
                      </TouchableOpacity>
                    );
                  })
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  const dueOnlyCount = studySummary.lapsedCount + studySummary.dueCount;
  const modeCardBg = isDark ? 'rgba(15, 23, 42, 0.88)' : 'rgba(255, 255, 255, 0.93)';
  const modeCardBorder = isDark ? 'rgba(148, 163, 184, 0.18)' : 'rgba(255, 255, 255, 0.6)';
  const modeCardShadow = isDark ? '#000' : 'rgba(80, 50, 120, 0.2)';
  const breakdownBg = isDark ? 'rgba(15, 23, 42, 0.6)' : 'rgba(255, 255, 255, 0.35)';
  const weakChipBg = isDark ? 'rgba(249, 115, 22, 0.15)' : 'rgba(255, 237, 213, 0.96)';
  const weakChipBorder = isDark ? 'rgba(249, 115, 22, 0.22)' : 'rgba(234, 88, 12, 0.2)';
  const modeTextPrimary = isDark ? '#F8FAFC' : '#FFFFFF';
  const modeTextSecondary = isDark ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.75)';
  const heroBg = isDark ? 'rgba(99, 102, 241, 0.2)' : 'rgba(255, 255, 255, 0.95)';
  const heroBorder = isDark ? 'rgba(99, 102, 241, 0.4)' : 'rgba(99, 102, 241, 0.3)';

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={isDark ? ['#1a1a2e', '#16213e'] : ['#667eea', '#764ba2']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        {selectedDeck && !studyMode && !showResults ? (
          <View style={styles.modePickerContainer}>
            <TouchableOpacity
              style={styles.modePickerBackButton}
              onPress={() => {
                if (launchedFromReviewHub) {
                  handleExitStudy();
                  return;
                }

                setSelectedDeckId(null);
                setShowDeckSelector(true);
              }}
              accessibilityLabel={launchedFromReviewHub ? 'Back to home' : 'Back to deck selection'}
              accessibilityRole="button"
              testID="study-mode-picker-back"
            >
              <ArrowLeft color={modeTextPrimary} size={22} strokeWidth={2.2} />
            </TouchableOpacity>

            <Text style={[styles.modePickerTitle, { color: modeTextPrimary }]}>{selectedDeck.name}</Text>
            <Text style={[styles.modePickerSubtitle, { color: modeTextSecondary }]}>
              {selectedDeck.flashcards.length} cards in deck
            </Text>

            <View style={styles.breakdownChips}>
              {studySummary.lapsedCount > 0 ? (
                <View style={[styles.breakdownChip, { backgroundColor: 'rgba(239, 68, 68, 0.15)' }]}>
                  <View style={[styles.chipDot, { backgroundColor: '#EF4444' }]} />
                  <Text style={[styles.chipText, { color: isDark ? '#FCA5A5' : '#DC2626' }]}>{studySummary.lapsedCount} lapsed</Text>
                </View>
              ) : null}
              {studySummary.dueCount > 0 ? (
                <View style={[styles.breakdownChip, { backgroundColor: 'rgba(245, 158, 11, 0.15)' }]}>
                  <View style={[styles.chipDot, { backgroundColor: '#F59E0B' }]} />
                  <Text style={[styles.chipText, { color: isDark ? '#FCD34D' : '#B45309' }]}>{studySummary.dueCount} due</Text>
                </View>
              ) : null}
              {studySummary.newCount > 0 ? (
                <View style={[styles.breakdownChip, { backgroundColor: breakdownBg }]}>
                  <View style={[styles.chipDot, { backgroundColor: isDark ? '#64748B' : 'rgba(255,255,255,0.7)' }]} />
                  <Text style={[styles.chipText, { color: modeTextSecondary }]}>{studySummary.newCount} new</Text>
                </View>
              ) : null}
              {studySummary.weakCount > 0 ? (
                <View
                  style={[
                    styles.breakdownChip,
                    !isDark ? styles.breakdownChipLight : null,
                    { backgroundColor: weakChipBg, borderColor: weakChipBorder },
                  ]}
                >
                  <View style={[styles.chipDot, { backgroundColor: isDark ? '#F97316' : '#EA580C' }]} />
                  <Text style={[styles.chipText, { color: isDark ? '#FDBA74' : '#9A3412' }]}>{studySummary.weakCount} weak</Text>
                </View>
              ) : null}
            </View>

            <View style={styles.modePickerOptions}>
              <TouchableOpacity
                style={[
                  styles.modeActionButton,
                  {
                    backgroundColor: heroBg,
                    borderColor: heroBorder,
                    shadowColor: modeCardShadow,
                    shadowOffset: { width: 0, height: 6 },
                    shadowOpacity: 0.18,
                    shadowRadius: 14,
                    elevation: 5,
                  },
                ]}
                onPress={() => handleSelectStudyMode('all')}
                activeOpacity={0.85}
                accessibilityLabel={`Study all ${orderedFlashcards.length} cards`}
                accessibilityRole="button"
                testID="study-mode-all"
              >
                <View style={[styles.modeIconWrap, { backgroundColor: isDark ? 'rgba(99,102,241,0.2)' : 'rgba(99,102,241,0.12)' }]}>
                  <BookOpen color={isDark ? '#818CF8' : '#6366F1'} size={20} strokeWidth={2.2} />
                </View>
                <View style={styles.modeActionText}>
                  <Text style={[styles.modeActionTitle, { color: isDark ? '#F8FAFC' : '#1E293B' }]}>All Cards</Text>
                  <Text style={[styles.modeActionDesc, { color: isDark ? 'rgba(255,255,255,0.5)' : '#64748B' }]}>Study every card in priority order</Text>
                </View>
                <View style={[styles.modeCountBadge, { backgroundColor: isDark ? 'rgba(99,102,241,0.2)' : 'rgba(99,102,241,0.1)' }]}>
                  <Text style={[styles.modeCountText, { color: isDark ? '#818CF8' : '#6366F1' }]}>{orderedFlashcards.length}</Text>
                </View>
              </TouchableOpacity>

              {dueOnlyCount > 0 ? (
                <TouchableOpacity
                  style={[
                    styles.modeActionButton,
                    {
                      backgroundColor: isDark ? 'rgba(245,158,11,0.1)' : 'rgba(255,255,255,0.93)',
                      borderColor: isDark ? 'rgba(245,158,11,0.25)' : 'rgba(245,158,11,0.3)',
                      shadowColor: modeCardShadow,
                      shadowOffset: { width: 0, height: 4 },
                      shadowOpacity: 0.12,
                      shadowRadius: 10,
                      elevation: 3,
                    },
                  ]}
                  onPress={() => handleSelectStudyMode('due')}
                  activeOpacity={0.85}
                  accessibilityLabel={`Study ${dueOnlyCount} due cards`}
                  accessibilityRole="button"
                  testID="study-mode-due"
                >
                  <View style={[styles.modeIconWrap, { backgroundColor: 'rgba(245,158,11,0.15)' }]}>
                    <Clock color="#F59E0B" size={20} strokeWidth={2.2} />
                  </View>
                  <View style={styles.modeActionText}>
                    <Text style={[styles.modeActionTitle, { color: isDark ? '#FCD34D' : '#92400E' }]}>Due Cards</Text>
                    <Text style={[styles.modeActionDesc, { color: isDark ? 'rgba(255,255,255,0.5)' : '#64748B' }]}>Lapsed and overdue cards only</Text>
                  </View>
                  <View style={[styles.modeCountBadge, { backgroundColor: 'rgba(245,158,11,0.15)' }]}>
                    <Text style={[styles.modeCountText, { color: '#F59E0B' }]}>{dueOnlyCount}</Text>
                  </View>
                </TouchableOpacity>
              ) : null}

              <View style={styles.quickReviewSection}>
                <Text style={[styles.quickReviewHeader, { color: modeTextSecondary }]}>Quick Review</Text>
                <View style={styles.quickReviewRow}>
                  {[5, 10, 15].map((count) => {
                    const mode = `quick-${count}` as StudyMode;
                    const disabled = orderedFlashcards.length < count;
                    return (
                      <TouchableOpacity
                        key={count}
                        style={[
                          styles.quickReviewPill,
                          {
                            backgroundColor: disabled ? 'transparent' : modeCardBg,
                            borderColor: disabled ? 'rgba(255,255,255,0.1)' : modeCardBorder,
                            shadowColor: disabled ? 'transparent' : modeCardShadow,
                            shadowOffset: { width: 0, height: 3 },
                            shadowOpacity: disabled ? 0 : 0.1,
                            shadowRadius: 8,
                            elevation: disabled ? 0 : 3,
                            opacity: disabled ? 0.35 : 1,
                          },
                        ]}
                        onPress={() => handleSelectStudyMode(mode)}
                        disabled={disabled}
                        activeOpacity={0.85}
                        accessibilityLabel={`Quick review of ${count} cards`}
                        accessibilityRole="button"
                        testID={`study-mode-quick-${count}`}
                      >
                        <Zap color={isDark ? '#38BDF8' : '#6366F1'} size={14} strokeWidth={2.5} />
                        <Text style={[styles.quickPillNumber, { color: isDark ? '#38BDF8' : '#6366F1' }]}>{count}</Text>
                        <Text style={[styles.quickPillLabel, { color: isDark ? 'rgba(255,255,255,0.45)' : '#64748B' }]}>cards</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {studySummary.weakCount > 0 ? (
                <TouchableOpacity
                  style={[
                    styles.modeActionButton,
                    {
                      backgroundColor: isDark ? 'rgba(249,115,22,0.1)' : 'rgba(255,255,255,0.93)',
                      borderColor: isDark ? 'rgba(249,115,22,0.25)' : 'rgba(249,115,22,0.3)',
                      shadowColor: modeCardShadow,
                      shadowOffset: { width: 0, height: 4 },
                      shadowOpacity: 0.12,
                      shadowRadius: 10,
                      elevation: 3,
                    },
                  ]}
                  onPress={() => handleSelectStudyMode('weak')}
                  activeOpacity={0.85}
                  accessibilityLabel={`Study ${studySummary.weakCount} weak cards`}
                  accessibilityRole="button"
                  testID="study-mode-weak"
                >
                  <View style={[styles.modeIconWrap, { backgroundColor: 'rgba(249,115,22,0.15)' }]}>
                    <AlertTriangle color="#F97316" size={20} strokeWidth={2.2} />
                  </View>
                  <View style={styles.modeActionText}>
                    <Text style={[styles.modeActionTitle, { color: isDark ? '#FDBA74' : '#9A3412' }]}>Weakest Cards</Text>
                    <Text style={[styles.modeActionDesc, { color: isDark ? 'rgba(255,255,255,0.5)' : '#64748B' }]}>Focus on cards with low accuracy</Text>
                  </View>
                  <View style={[styles.modeCountBadge, { backgroundColor: 'rgba(249,115,22,0.15)' }]}>
                    <Text style={[styles.modeCountText, { color: '#F97316' }]}>{studySummary.weakCount}</Text>
                  </View>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        ) : null}

        {selectedDeck && studyMode && !showResults && sessionFlashcards.length === 0 ? (
          <View style={styles.emptyModeContainer}>
            <Text style={[styles.emptyModeText, { color: theme.textSecondary }]}>No cards match this filter right now.</Text>
            <TouchableOpacity
              style={[styles.emptyModeButton, { backgroundColor: theme.primary }]}
              onPress={() => setStudyMode(null)}
              accessibilityRole="button"
              testID="study-mode-empty-reset"
            >
              <Text style={styles.emptyModeButtonText}>Choose Another Mode</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {selectedDeck && studyMode && !showResults && sessionFlashcards.length > 0 ? (
          <>
            <View style={styles.header}>
              <TouchableOpacity onPress={handleBackFromStudy} style={styles.backButton} accessibilityRole="button" accessibilityLabel={launchedFromReviewHub ? 'Back to home' : 'Back to study modes'}>
                <ArrowLeft color="#fff" size={28} strokeWidth={2.5} />
              </TouchableOpacity>
              <Text style={[styles.headerTitle, { flex: 1, textAlign: 'center' }]} numberOfLines={1}>{selectedDeck.name}</Text>
              <TouchableOpacity
                onPress={handleToggleReversed}
                style={styles.reverseToggle}
                activeOpacity={0.75}
                accessibilityLabel="Reverse question and answer"
                accessibilityRole="button"
                testID="study-reverse-toggle"
              >
                <ArrowLeftRight color="#fff" size={14} strokeWidth={2.2} />
                <Text style={styles.reverseToggleText}>{reversed ? 'A → Q' : 'Q → A'}</Text>
              </TouchableOpacity>
            </View>

            <StudyFeed
              flashcards={sessionFlashcards}
              theme={theme}
              isDark={isDark}
              reversed={reversed}
              onComplete={handleComplete}
              onCardResolved={handleCardResolved}
              onUpdateCard={handleUpdateCard}
            />
          </>
        ) : null}
      </SafeAreaView>

      <Modal
        visible={showDeckSelector}
        animationType="slide"
        transparent
        onRequestClose={() => setShowDeckSelector(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: isDark ? theme.card : '#fff' }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: isDark ? theme.text : '#333' }]}>Select a Deck</Text>
              <TouchableOpacity onPress={() => setShowDeckSelector(false)}>
                <Text style={[styles.modalClose, { color: isDark ? theme.textSecondary : '#666' }]}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.deckList} showsVerticalScrollIndicator={false}>
              {decks.length === 0 ? (
                <View style={{ alignItems: 'center', padding: 32 }}>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: isDark ? '#fff' : '#333', marginBottom: 8, textAlign: 'center' }}>No Decks Yet</Text>
                  <Text style={{ fontSize: 14, color: isDark ? 'rgba(255,255,255,0.6)' : '#666', textAlign: 'center', marginBottom: 20 }}>Create your first deck to start studying.</Text>
                  <TouchableOpacity
                    onPress={() => {
                      setShowDeckSelector(false);
                      router.push(DECKS_ROUTE);
                    }}
                    style={{ backgroundColor: theme.primary, borderRadius: 16, paddingVertical: 14, paddingHorizontal: 24 }}
                    testID="study-empty-go-to-decks-button"
                  >
                    <Text style={{ fontSize: 16, fontWeight: '700', color: '#fff' }}>Go to Decks</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                decks.map((deck) => {
                  const summary = deckSummaries.get(deck.id);
                  const actionCount = (summary?.dueCount ?? 0) + (summary?.lapsedCount ?? 0);
                  const hasAction = actionCount > 0;
                  const allNew = (summary?.newCount ?? 0) === deck.flashcards.length;
                  return (
                    <TouchableOpacity
                      key={deck.id}
                      style={[styles.deckOption, { backgroundColor: theme.deckOption }]}
                      onPress={() => handleDeckSelect(deck.id)}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.deckColorDot, { backgroundColor: deck.color }]} />
                      <View style={styles.deckOptionInfo}>
                        <Text style={[styles.deckOptionName, { color: isDark ? '#f1f5f9' : '#333' }]}>{deck.name}</Text>
                        <View style={styles.deckOptionMeta}>
                          <Text style={[styles.deckOptionCards, { color: isDark ? '#cbd5e1' : '#666' }]}>{deck.flashcards.length} cards</Text>
                          {hasAction ? (
                            <View style={styles.deckDueBadge}>
                              <Clock color="#F59E0B" size={11} strokeWidth={2.5} />
                              <Text style={styles.deckDueBadgeText}>{actionCount} due</Text>
                            </View>
                          ) : allNew ? (
                            <View style={[styles.deckDueBadge, styles.deckNewBadge]}>
                              <Sparkles color="#60A5FA" size={11} strokeWidth={2.5} />
                              <Text style={[styles.deckDueBadgeText, styles.deckNewBadgeText]}>New</Text>
                            </View>
                          ) : null}
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#667eea',
  },
  safeArea: {
    flex: 1,
  },
  syncLoadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#fff',
  },
  reverseToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  reverseToggleText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700' as const,
    letterSpacing: 0.3,
  },
  placeholder: {
    width: 40,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  emptyText: {
    fontSize: 18,
    color: '#fff',
    marginBottom: 24,
    textAlign: 'center',
    fontWeight: '600' as const,
  },
  selectButton: {
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingHorizontal: 32,
    paddingVertical: 16,
  },
  selectButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#667eea',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingTop: 24,
    paddingBottom: 40,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: '#333',
  },
  modalClose: {
    fontSize: 28,
    color: '#666',
    fontWeight: '400' as const,
  },
  deckList: {
    paddingHorizontal: 24,
  },
  deckOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  deckColorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 16,
  },
  deckOptionInfo: {
    flex: 1,
  },
  deckOptionName: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: '#333',
    marginBottom: 2,
  },
  deckOptionCards: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500' as const,
  },
  deckOptionMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 1,
  },
  deckDueBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(245, 158, 11, 0.14)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  deckDueBadgeText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: '#D97706',
  },
  deckNewBadge: {
    backgroundColor: 'rgba(96, 165, 250, 0.14)',
  },
  deckNewBadgeText: {
    color: '#2563EB',
  },
  srsResultBanner: {
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 24,
    gap: 8,
  },
  srsResultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  srsResultText: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: 'rgba(255, 255, 255, 0.78)',
    flex: 1,
  },
  resultsScrollContent: {
    flexGrow: 1,
  },
  resultsScrollContentCompact: {
    paddingBottom: 8,
  },
  resultsContainer: {
    flexGrow: 1,
    width: '100%',
    maxWidth: 460,
    alignSelf: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 18,
  },
  resultsContainerCompact: {
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  resultsTopBar: {
    width: '100%',
    marginBottom: 8,
  },
  resultsTopBackButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  resultsMainContent: {
    width: '100%',
    alignItems: 'center',
  },
  resultsEyebrow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 14,
  },
  resultsEyebrowCompact: {
    marginBottom: 12,
  },
  resultsEyebrowText: {
    fontSize: 12,
    fontWeight: '800' as const,
    color: '#FFFFFF',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  resultsTitle: {
    fontSize: 34,
    fontWeight: '800' as const,
    color: '#fff',
    marginBottom: 8,
    textAlign: 'center',
    letterSpacing: -0.8,
  },
  resultsTitleCompact: {
    fontSize: 30,
  },
  resultsSubtitle: {
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.88)',
    marginBottom: 20,
    textAlign: 'center',
    fontWeight: '600' as const,
    lineHeight: 22,
    maxWidth: 320,
  },
  resultsSubtitleCompact: {
    marginBottom: 16,
    maxWidth: 300,
  },
  resultsCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 20,
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 14,
  },
  resultsCardCompact: {
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 16,
    marginBottom: 12,
  },
  resultStat: {
    flex: 1,
    alignItems: 'center',
  },
  resultStatValue: {
    fontSize: 32,
    fontWeight: '800' as const,
    color: '#667eea',
    marginBottom: 4,
  },
  resultStatValueCompact: {
    fontSize: 28,
  },
  resultStatLabel: {
    fontSize: 13,
    color: '#666',
    fontWeight: '600' as const,
    textAlign: 'center',
  },
  resultStatDivider: {
    width: 1,
    backgroundColor: '#e0e0e0',
  },
  resultsStatusCard: {
    width: '100%',
    borderRadius: 22,
    backgroundColor: 'rgba(8, 15, 33, 0.22)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    padding: 16,
    marginBottom: 14,
    gap: 10,
  },
  resultsStatusCardCompact: {
    padding: 14,
    marginBottom: 12,
  },
  resultsStatusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  resultsStatusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  resultsStatusTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '800' as const,
    color: '#FFFFFF',
  },
  resultsStatusText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500' as const,
    color: 'rgba(255, 255, 255, 0.82)',
  },
  resultsActions: {
    width: '100%',
  },
  primaryResultsButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingHorizontal: 24,
    paddingVertical: 15,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  primaryResultsButtonText: {
    fontSize: 17,
    fontWeight: '800' as const,
    color: '#4F46E5',
  },
  secondaryResultsButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    borderRadius: 18,
    paddingHorizontal: 24,
    paddingVertical: 14,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  secondaryResultsButtonText: {
    fontSize: 16,
    fontWeight: '800' as const,
    color: '#FFFFFF',
  },
  restartButton: {
    backgroundColor: '#fff',
    borderRadius: 18,
    paddingHorizontal: 28,
    paddingVertical: 15,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    width: '100%',
    justifyContent: 'center',
    marginBottom: 10,
  },
  restartButtonText: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#667eea',
  },
  homeButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 16,
    paddingHorizontal: 32,
    paddingVertical: 16,
    width: '100%',
  },
  homeButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#fff',
    textAlign: 'center',
  },
  suggestButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 20,
    marginTop: 0,
    width: '100%',
  },
  suggestButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#fff',
  },
  hubButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    marginTop: 2,
  },
  hubButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  resultsAmbientOrbTop: {
    position: 'absolute',
    width: 240,
    height: 240,
    borderRadius: 240,
    top: -36,
    right: -92,
  },
  resultsAmbientOrbBottom: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 280,
    bottom: -96,
    left: -120,
  },
  resultsHeroCard: {
    width: '100%',
    borderRadius: 28,
    borderWidth: 1,
    padding: 20,
    marginBottom: 14,
    overflow: 'hidden',
  },
  resultsHeroCardCompact: {
    borderRadius: 24,
    padding: 18,
    marginBottom: 12,
  },
  resultsHeroGlow: {
    position: 'absolute',
    width: 190,
    height: 190,
    borderRadius: 190,
    top: -84,
    right: -40,
  },
  resultsMetaRow: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  resultsMetaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 1,
    minWidth: 0,
    maxWidth: '100%',
  },
  resultsMetaText: {
    fontSize: 13,
    fontWeight: '700' as const,
    flexShrink: 1,
  },
  resultsStatsGrid: {
    width: '100%',
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  resultsStatCard: {
    flex: 1,
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 14,
    minHeight: 108,
  },
  resultsStatCardCompact: {
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 12,
    minHeight: 100,
  },
  resultsStatIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  resultsStatCardValue: {
    fontSize: 30,
    fontWeight: '800' as const,
    letterSpacing: -0.7,
    marginBottom: 4,
  },
  resultsStatCardValueCompact: {
    fontSize: 26,
  },
  resultsStatCardLabel: {
    fontSize: 13,
    fontWeight: '700' as const,
    lineHeight: 18,
  },
  resultsStatusCardNew: {
    width: '100%',
    borderRadius: 24,
    borderWidth: 1,
    padding: 18,
    marginBottom: 16,
  },
  resultsStatusCardCompactNew: {
    borderRadius: 22,
    padding: 16,
    marginBottom: 14,
  },
  resultsInsightChips: {
    gap: 8,
    marginTop: 6,
  },
  resultsInsightChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: 14,
    borderWidth: 1,
  },
  resultsInsightChipText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600' as const,
    lineHeight: 18,
  },
  resultsPrimaryButtonWrap: {
    width: '100%',
    borderRadius: 22,
    overflow: 'hidden',
    marginBottom: 12,
  },
  resultsPrimaryButtonFill: {
    width: '100%',
    paddingHorizontal: 24,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultsPrimaryButtonTextNew: {
    fontSize: 17,
    fontWeight: '800' as const,
    color: '#FFFFFF',
  },
  resultsActionRow: {
    width: '100%',
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  resultsActionRowCompact: {
    flexDirection: 'column',
  },
  resultsSecondaryAction: {
    flex: 1,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 14,
    minHeight: 88,
  },
  resultsSecondaryActionCompact: {
    flex: 0,
  },
  resultsSecondaryActionIconRow: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  resultsSecondaryActionTextWrap: {
    gap: 2,
  },
  resultsSecondaryActionTitle: {
    fontSize: 15,
    fontWeight: '800' as const,
  },
  resultsSecondaryActionSubtitle: {
    fontSize: 12,
    fontWeight: '600' as const,
    lineHeight: 16,
  },
  resultsLinkButtonNew: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
  },
  resultsLinkButtonTextNew: {
    fontSize: 14,
    fontWeight: '700' as const,
  },
  modePickerContainer: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  modePickerBackButton: {
    padding: 8,
    marginLeft: -8,
    marginBottom: 16,
    alignSelf: 'flex-start',
  },
  modePickerTitle: {
    fontSize: 28,
    fontWeight: '800' as const,
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  modePickerSubtitle: {
    fontSize: 15,
    fontWeight: '500' as const,
    marginBottom: 16,
  },
  breakdownChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 24,
  },
  breakdownChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  breakdownChipLight: {
    shadowColor: 'rgba(80, 50, 120, 0.16)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 10,
    elevation: 2,
  },
  chipDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '700' as const,
  },
  modePickerOptions: {
    gap: 10,
  },
  modeActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    gap: 12,
  },
  modeIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeActionText: {
    flex: 1,
  },
  modeActionTitle: {
    fontSize: 16,
    fontWeight: '800' as const,
    marginBottom: 2,
  },
  modeActionDesc: {
    fontSize: 12,
    fontWeight: '500' as const,
  },
  modeCountBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    minWidth: 36,
    alignItems: 'center',
  },
  modeCountText: {
    fontSize: 14,
    fontWeight: '800' as const,
  },
  quickReviewSection: {
    gap: 8,
  },
  quickReviewHeader: {
    fontSize: 12,
    fontWeight: '700' as const,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginLeft: 4,
  },
  quickReviewRow: {
    flexDirection: 'row',
    gap: 10,
  },
  quickReviewPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  quickPillNumber: {
    fontSize: 18,
    fontWeight: '800' as const,
  },
  quickPillLabel: {
    fontSize: 12,
    fontWeight: '600' as const,
  },
  emptyModeContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyModeText: {
    fontSize: 16,
    fontWeight: '500' as const,
    textAlign: 'center',
    marginBottom: 16,
  },
  emptyModeButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  emptyModeButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700' as const,
  },
});
