import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useLocalSearchParams, useNavigation } from 'expo-router';
import { ArrowLeft, ArrowLeftRight, BookOpen, Clock, AlertTriangle, RefreshCw, RotateCcw, Sparkles, Target, Zap } from 'lucide-react-native';
import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  useWindowDimensions,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import StudyDeckSelector from '@/components/StudyDeckSelector';
import StudyFeed from '@/components/StudyFeed';
import { useDeckContext } from '@/context/DeckContext';
import { useStatsContext } from '@/context/StatsContext';
import { usePerformance } from '@/context/PerformanceContext';
import { useTheme } from '@/context/ThemeContext';
import { trackEvent } from '@/lib/analytics';
import type { Deck, Flashcard } from '@/types/flashcard';
import { GAME_MODE } from '@/types/game';
import { logger } from '@/utils/logger';
import { buildCrossDeckReviewDeck, CROSS_DECK_REVIEW_DECK_ID } from '@/utils/reviewUtils';
import { DECKS_ROUTE, HOME_ROUTE, deckHubHref, questHref } from '@/utils/routes';
import { buildStudyOrder, getFlashcardsForStudyMode, type StudyMode } from '@/utils/studyHelpers';
import { maybePromptReview } from '@/utils/storeReview';
import { triggerImpact } from '@/utils/haptics';
import { waitForInitialSync } from '@/utils/cloudSync';

export default function StudyPage() {
  const router = useRouter();
  const navigation = useNavigation();
  const params = useLocalSearchParams<{ deckId?: string; initialMode?: string; source?: string }>();
  const { decks, updateFlashcard } = useDeckContext();
  const { stats, recordSessionResult } = useStatsContext();
  const { performance } = usePerformance();
  const { theme, isDark } = useTheme();
  const { height: windowHeight } = useWindowDimensions();
  const isCompactResults = windowHeight < 780;
  const validModes: StudyMode[] = ['all', 'due', 'quick-5', 'quick-10', 'quick-15', 'weak'];
  const initialMode = validModes.includes(params.initialMode as StudyMode) ? (params.initialMode as StudyMode) : null;
  const launchedFromReviewHub = params.source === 'review-hub';
  const launchedFromDeckHub = params.source === 'deck-hub';
  const initialDeckId = params.deckId ?? null;
  const launchedWithDeckId = initialDeckId !== null;

  const [showDeckSelector, setShowDeckSelector] = useState<boolean>(!params.deckId);
  const [selectedDeckId, setSelectedDeckId] = useState<string | null>(params.deckId || null);
  const deckHubTargetDeckId = launchedFromDeckHub ? selectedDeckId ?? initialDeckId : null;
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
    : launchedFromDeckHub && deckHubTargetDeckId
      ? deckHubHref(deckHubTargetDeckId)
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

  const handleReturnToModePicker = useCallback(() => {
    logger.debug('[Study] Returning to study mode picker', {
      deckId: selectedDeck?.id,
      studyMode,
      source: params.source ?? 'direct',
    });
    trackedStudyDeckIdRef.current = null;
    sessionStartRef.current = Date.now();
    sessionResolvedRef.current = 0;
    setSessionResolved(0);
    setSessionXp(0);
    setShowResults(false);
    setSessionFlashcards([]);
    setStudyMode(null);
  }, [params.source, selectedDeck?.id, studyMode]);

  const handleExitStudy = useCallback(() => {
    allowExitRedirectRef.current = true;

    if (launchedFromReviewHub) {
      logger.debug('[Study] Exiting study to home');
      router.dismissTo(HOME_ROUTE);
      return;
    }

    if (launchedFromDeckHub) {
      logger.debug('[Study] Exiting study to deck hub', {
        deckId: deckHubTargetDeckId,
        canGoBack: navigation.canGoBack(),
        exitRoute,
      });
      router.dismissTo(exitRoute);
      return;
    }

    logger.debug('[Study] Exiting study to decks');
    router.dismissTo(DECKS_ROUTE);
  }, [deckHubTargetDeckId, exitRoute, launchedFromDeckHub, launchedFromReviewHub, navigation, router]);

  const handleBackFromStudy = useCallback(() => {
    if (!launchedFromReviewHub && studyMode && !showResults) {
      handleReturnToModePicker();
      return;
    }

    handleExitStudy();
  }, [handleExitStudy, handleReturnToModePicker, launchedFromReviewHub, showResults, studyMode]);

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

      event.preventDefault();

      if (!launchedFromReviewHub && studyMode && !showResults) {
        logger.debug('[Study] Redirecting back action to study mode picker', {
          actionType,
          deckId: selectedDeck?.id,
          studyMode,
        });
        handleReturnToModePicker();
        return;
      }

      logger.debug('[Study] Redirecting back action to exit route', {
        actionType,
        target: exitRoute,
      });
      handleExitStudy();
    });

    return unsubscribe;
  }, [exitRoute, handleExitStudy, handleReturnToModePicker, launchedFromReviewHub, navigation, selectedDeck?.id, showResults, studyMode]);

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

        <StudyDeckSelector
          visible={showDeckSelector}
          onSelectDeck={handleDeckSelect}
          onClose={() => {
            if (!selectedDeckId) {
              handleExitStudy();
            } else {
              setShowDeckSelector(false);
            }
          }}
          decks={decks}
          selectedDeckId={selectedDeckId}
          studyMode={studyMode}
        />
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
  const modePickerBackBg = isDark ? 'rgba(15, 23, 42, 0.5)' : 'rgba(255, 255, 255, 0.16)';
  const modePickerBackBorder = isDark ? 'rgba(148, 163, 184, 0.18)' : 'rgba(255, 255, 255, 0.22)';
  const modePickerStatBg = isDark ? 'rgba(15, 23, 42, 0.55)' : 'rgba(255, 255, 255, 0.14)';
  const modePickerStatBorder = isDark ? 'rgba(148, 163, 184, 0.16)' : 'rgba(255, 255, 255, 0.16)';
  const studyFocusLabel = dueOnlyCount > 0
    ? 'Best next move'
    : studySummary.weakCount > 0
      ? 'Recommended focus'
      : studySummary.newCount > 0
        ? 'Fresh cards waiting'
        : 'Ready to review';
  const studyFocusValue = dueOnlyCount > 0
    ? `${dueOnlyCount} cards want attention first`
    : studySummary.weakCount > 0
      ? `${studySummary.weakCount} low-confidence cards to tighten up`
      : studySummary.newCount > 0
        ? `${studySummary.newCount} untouched cards ready to learn`
        : `${orderedFlashcards.length} cards ready for a full pass`;
  const focusMode: StudyMode = dueOnlyCount > 0
    ? 'due'
    : studySummary.weakCount > 0
      ? 'weak'
      : 'all';
  const focusCount = dueOnlyCount > 0
    ? dueOnlyCount
    : studySummary.weakCount > 0
      ? studySummary.weakCount
      : studySummary.newCount > 0
        ? studySummary.newCount
        : orderedFlashcards.length;
  const focusAccent = dueOnlyCount > 0
    ? '#F59E0B'
    : studySummary.weakCount > 0
      ? '#F97316'
      : isDark
        ? '#A5B4FC'
        : '#6366F1';
  const focusAccentBg = dueOnlyCount > 0
    ? 'rgba(245,158,11,0.14)'
    : studySummary.weakCount > 0
      ? 'rgba(249,115,22,0.14)'
      : isDark
        ? 'rgba(129,140,248,0.18)'
        : 'rgba(99,102,241,0.1)';
  const focusCardBg = dueOnlyCount > 0
    ? isDark
      ? 'rgba(245,158,11,0.08)'
      : 'rgba(255,255,255,0.9)'
    : studySummary.weakCount > 0
      ? isDark
        ? 'rgba(249,115,22,0.08)'
        : 'rgba(255,247,237,0.96)'
      : isDark
        ? 'rgba(15,23,42,0.42)'
        : 'rgba(255,255,255,0.22)';
  const focusCardBorder = dueOnlyCount > 0
    ? isDark
      ? 'rgba(245,158,11,0.22)'
      : 'rgba(245,158,11,0.26)'
    : studySummary.weakCount > 0
      ? isDark
        ? 'rgba(249,115,22,0.24)'
        : 'rgba(249,115,22,0.22)'
      : modePickerStatBorder;
  const focusBadgeLabel = dueOnlyCount > 0
    ? 'Due now'
    : studySummary.weakCount > 0
      ? 'Weak drill'
      : studySummary.newCount > 0
        ? 'Start fresh'
        : 'Full pass';
  const quickReviewHelper = orderedFlashcards.length >= 15
    ? 'Fast, focused reps when you only have a minute.'
    : `Great for a shorter pass with up to ${Math.max(orderedFlashcards.length, 1)} cards.`;

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
              style={[
                styles.modePickerBackButton,
                { backgroundColor: modePickerBackBg, borderColor: modePickerBackBorder },
              ]}
              onPress={() => {
                if (launchedFromReviewHub || launchedFromDeckHub || launchedWithDeckId) {
                  handleExitStudy();
                  return;
                }

                setSelectedDeckId(null);
                setShowDeckSelector(true);
              }}
              accessibilityLabel={launchedFromReviewHub ? 'Back to home' : launchedFromDeckHub ? 'Back to deck dashboard' : launchedWithDeckId ? 'Back to decks' : 'Back to deck selection'}
              accessibilityRole="button"
              testID="study-mode-picker-back"
            >
              <ArrowLeft color={modeTextPrimary} size={22} strokeWidth={2.2} />
            </TouchableOpacity>

            <LinearGradient
              colors={isDark ? ['rgba(99,102,241,0.28)', 'rgba(8,15,35,0.6)'] : ['rgba(129,140,248,0.4)', 'rgba(255,255,255,0.08)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.modePickerHeroCard, { borderColor: heroBorder }]}
            >
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

              <View style={styles.modeStatsRow}>
                <View style={[styles.modeStatCard, { backgroundColor: modePickerStatBg, borderColor: modePickerStatBorder }]}>
                  <Text style={[styles.modeStatValue, { color: isDark ? '#F8FAFC' : '#FFFFFF' }]}>{studySummary.newCount}</Text>
                  <Text style={[styles.modeStatLabel, { color: modeTextSecondary }]}>New</Text>
                </View>
                <View style={[styles.modeStatCard, { backgroundColor: modePickerStatBg, borderColor: modePickerStatBorder }]}>
                  <Text style={[styles.modeStatValue, { color: isDark ? '#FCD34D' : '#FFFFFF' }]}>{dueOnlyCount}</Text>
                  <Text style={[styles.modeStatLabel, { color: modeTextSecondary }]}>Due now</Text>
                </View>
                <View style={[styles.modeStatCard, { backgroundColor: modePickerStatBg, borderColor: modePickerStatBorder }]}>
                  <Text style={[styles.modeStatValue, { color: isDark ? '#FDBA74' : '#FFFFFF' }]}>{studySummary.weakCount}</Text>
                  <Text style={[styles.modeStatLabel, { color: modeTextSecondary }]}>Weak</Text>
                </View>
              </View>

            </LinearGradient>

            <View style={styles.modePickerOptions}>
              <TouchableOpacity
                style={[
                  styles.modeFocusCard,
                  {
                    backgroundColor: focusCardBg,
                    borderColor: focusCardBorder,
                    shadowColor: modeCardShadow,
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: isDark ? 0.16 : 0.08,
                    shadowRadius: 10,
                    elevation: 2,
                  },
                ]}
                onPress={() => handleSelectStudyMode(focusMode)}
                activeOpacity={0.86}
                accessibilityLabel={
                  focusMode === 'due'
                    ? `Study ${dueOnlyCount} due cards`
                    : focusMode === 'weak'
                      ? `Study ${studySummary.weakCount} weak cards`
                      : `Study all ${orderedFlashcards.length} cards`
                }
                accessibilityRole="button"
                testID="study-mode-focus"
              >
                <View style={[styles.modeFocusIconWrap, { backgroundColor: focusAccentBg }]}>
                  {focusMode === 'due' ? (
                    <Clock color={focusAccent} size={18} strokeWidth={2.2} />
                  ) : focusMode === 'weak' ? (
                    <AlertTriangle color={focusAccent} size={18} strokeWidth={2.2} />
                  ) : studySummary.newCount > 0 ? (
                    <Sparkles color={focusAccent} size={18} strokeWidth={2.2} />
                  ) : (
                    <Target color={focusAccent} size={18} strokeWidth={2.2} />
                  )}
                </View>
                <View style={styles.modeFocusTextWrap}>
                  <Text style={[styles.modeFocusEyebrow, { color: modeTextSecondary }]}>{studyFocusLabel}</Text>
                  <Text style={[styles.modeFocusValue, { color: modeTextPrimary }]}>{studyFocusValue}</Text>
                </View>
                <View style={[styles.modeFocusBadge, { backgroundColor: focusAccentBg, borderColor: focusCardBorder }]}>
                  <Text style={[styles.modeFocusBadgeCount, { color: focusAccent }]}>{focusCount}</Text>
                  <Text style={[styles.modeFocusBadgeLabel, { color: focusAccent }]}>{focusBadgeLabel}</Text>
                </View>
              </TouchableOpacity>
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

              <View
                style={[
                  styles.quickReviewSection,
                  {
                    backgroundColor: isDark ? 'rgba(8, 15, 35, 0.42)' : 'rgba(255, 255, 255, 0.12)',
                    borderColor: isDark ? 'rgba(148, 163, 184, 0.16)' : 'rgba(255, 255, 255, 0.16)',
                  },
                ]}
              >
                <View style={styles.quickReviewHeaderRow}>
                  <View style={styles.quickReviewHeaderBlock}>
                    <Text style={[styles.quickReviewHeader, { color: modeTextPrimary }]}>Quick Review</Text>
                    <Text style={[styles.quickReviewSubtext, { color: modeTextSecondary }]}>{quickReviewHelper}</Text>
                  </View>
                  <View style={[styles.quickReviewTag, { backgroundColor: isDark ? 'rgba(56,189,248,0.16)' : 'rgba(255,255,255,0.14)' }]}>
                    <Text style={[styles.quickReviewTagText, { color: isDark ? '#7DD3FC' : '#FFFFFF' }]}>Fast lane</Text>
                  </View>
                </View>
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

              {studySummary.weakCount > 0 && focusMode !== 'weak' ? (
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

      <StudyDeckSelector
        visible={showDeckSelector}
        onSelectDeck={handleDeckSelect}
        onClose={() => setShowDeckSelector(false)}
        decks={decks}
        selectedDeckId={selectedDeckId}
        studyMode={studyMode}
      />
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
    paddingTop: 14,
    paddingBottom: 32,
    gap: 18,
  },
  modePickerBackButton: {
    width: 44,
    height: 44,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  modePickerHeroCard: {
    borderRadius: 30,
    borderWidth: 1,
    padding: 22,
    gap: 18,
    overflow: 'hidden',
  },
  modePickerTitle: {
    fontSize: 34,
    lineHeight: 38,
    fontWeight: '800' as const,
    letterSpacing: -1.1,
    marginBottom: 8,
  },
  modePickerSubtitle: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '600' as const,
    marginBottom: 0,
  },
  breakdownChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  breakdownChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 7,
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
  modeStatsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  modeStatCard: {
    flex: 1,
    borderRadius: 20,
    borderWidth: 1,
    paddingVertical: 16,
    paddingHorizontal: 14,
    gap: 6,
  },
  modeStatValue: {
    fontSize: 26,
    lineHeight: 30,
    fontWeight: '800' as const,
    letterSpacing: -0.7,
  },
  modeStatLabel: {
    fontSize: 12,
    fontWeight: '700' as const,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  modeFocusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 14,
    minHeight: 84,
  },
  modeFocusIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeFocusTextWrap: {
    flex: 1,
    gap: 3,
  },
  modeFocusBadge: {
    minWidth: 74,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  modeFocusBadgeCount: {
    fontSize: 18,
    lineHeight: 20,
    fontWeight: '800' as const,
    letterSpacing: -0.4,
  },
  modeFocusBadgeLabel: {
    fontSize: 10,
    fontWeight: '800' as const,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  modeFocusEyebrow: {
    fontSize: 11,
    fontWeight: '800' as const,
    textTransform: 'uppercase',
    letterSpacing: 0.9,
  },
  modeFocusValue: {
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '700' as const,
  },
  modePickerOptions: {
    gap: 16,
    marginTop: 'auto',
  },
  modeActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 22,
    borderWidth: 1,
    padding: 16,
    minHeight: 88,
    gap: 14,
  },
  modeIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeActionText: {
    flex: 1,
    gap: 2,
  },
  modeActionTitle: {
    fontSize: 17,
    fontWeight: '800' as const,
    letterSpacing: -0.2,
    marginBottom: 0,
  },
  modeActionDesc: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600' as const,
  },
  modeCountBadge: {
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 12,
    minWidth: 42,
    alignItems: 'center',
  },
  modeCountText: {
    fontSize: 15,
    fontWeight: '800' as const,
  },
  quickReviewSection: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 16,
    gap: 14,
  },
  quickReviewHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  quickReviewHeaderBlock: {
    flex: 1,
    gap: 4,
  },
  quickReviewHeader: {
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '800' as const,
    letterSpacing: -0.4,
  },
  quickReviewSubtext: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600' as const,
  },
  quickReviewTag: {
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  quickReviewTagText: {
    fontSize: 11,
    fontWeight: '800' as const,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
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
    paddingVertical: 18,
    borderRadius: 18,
    borderWidth: 1,
  },
  quickPillNumber: {
    fontSize: 22,
    lineHeight: 24,
    fontWeight: '800' as const,
    letterSpacing: -0.4,
  },
  quickPillLabel: {
    fontSize: 12,
    fontWeight: '700' as const,
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
