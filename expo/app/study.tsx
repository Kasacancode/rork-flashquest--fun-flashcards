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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import StudyFeed from '@/components/StudyFeed';
import { useFlashQuest } from '@/context/FlashQuestContext';
import { usePerformance } from '@/context/PerformanceContext';
import { useTheme } from '@/context/ThemeContext';
import { trackEvent } from '@/lib/analytics';
import type { Flashcard } from '@/types/flashcard';
import type { CardMemoryStatus } from '@/types/performance';
import { GAME_MODE } from '@/types/game';
import { getWeaknessScore, isCardDueForReview, getLiveCardStats } from '@/utils/mastery';
import { logger } from '@/utils/logger';
import { DECKS_ROUTE, HOME_ROUTE, deckHubHref, questHref } from '@/utils/routes';
import { maybePromptReview } from '@/utils/storeReview';
import { triggerImpact } from '@/utils/haptics';

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
  const WEAK_THRESHOLD = 5;

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

    const weakness = getWeaknessScore(stats, now);
    if (weakness >= WEAK_THRESHOLD) {
      buckets.weak.push({ card, sortKey: -weakness });
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
      const WEAK_THRESHOLD = 5;
      return orderedFlashcards.filter((card) => {
        const stats = cardStatsById[card.id];
        const live = getLiveCardStats(stats, now);
        if (live.attempts === 0) {
          return false;
        }
        return getWeaknessScore(stats, now) >= WEAK_THRESHOLD;
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

  const [showDeckSelector, setShowDeckSelector] = useState<boolean>(!params.deckId);
  const [selectedDeckId, setSelectedDeckId] = useState<string | null>(params.deckId || null);
  const [sessionResolved, setSessionResolved] = useState<number>(0);
  const [showResults, setShowResults] = useState<boolean>(false);
  const [sessionXp, setSessionXp] = useState<number>(0);
  const [reversed, setReversed] = useState<boolean>(false);
  const [studyMode, setStudyMode] = useState<StudyMode | null>(initialMode);
  const [sessionFlashcards, setSessionFlashcards] = useState<Flashcard[]>([]);
  const trackedStudyDeckIdRef = useRef<string | null>(null);
  const sessionStartRef = useRef<number>(Date.now());
  const sessionResolvedRef = useRef<number>(0);
  const allowDismissToHomeRef = useRef<boolean>(false);

  const selectedDeck = useMemo(
    () => decks.find((d) => d.id === selectedDeckId),
    [decks, selectedDeckId]
  );

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
      deckId: selectedDeck.id,
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
      deckId: selectedDeck.id,
      xpEarned,
      cardsAttempted: resolvedCount,
      timestampISO: new Date().toISOString(),
      durationMs: Date.now() - sessionStartRef.current,
    });
    trackEvent({
      event: 'study_completed',
      deckId: selectedDeck.id,
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
    if (selectedDeck) {
      updateFlashcard(selectedDeck.id, cardId, updates);
    }
  }, [selectedDeck, updateFlashcard]);

  const handleToggleReversed = useCallback(() => {
    triggerImpact();
    setReversed((prev) => !prev);
  }, []);

  const handleDismissToHome = useCallback(() => {
    allowDismissToHomeRef.current = true;
    logger.debug('[Study] Returning review flow to home');
    router.dismissTo(HOME_ROUTE);
  }, [router]);

  const handleBackFromStudy = useCallback(() => {
    if (launchedFromReviewHub) {
      handleDismissToHome();
      return;
    }

    setStudyMode(null);
  }, [handleDismissToHome, launchedFromReviewHub]);

  const handleResultsBack = useCallback(() => {
    if (launchedFromReviewHub) {
      handleDismissToHome();
      return;
    }

    router.back();
  }, [handleDismissToHome, launchedFromReviewHub, router]);

  useEffect(() => {
    if (!launchedFromReviewHub) {
      return;
    }

    const unsubscribe = navigation.addListener('beforeRemove', (event) => {
      if (allowDismissToHomeRef.current) {
        allowDismissToHomeRef.current = false;
        return;
      }

      const actionType = event.data.action.type;
      const shouldRedirectHome = actionType === 'GO_BACK' || actionType === 'POP' || actionType === 'POP_TO_TOP';

      if (!shouldRedirectHome) {
        return;
      }

      logger.debug('[Study] Redirecting back action to home', { actionType });
      event.preventDefault();
      handleDismissToHome();
    });

    return unsubscribe;
  }, [handleDismissToHome, launchedFromReviewHub, navigation]);

  if (showResults && selectedDeck) {
    const needsReviewCount = studySummary.lapsedCount + studySummary.dueCount;
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={isDark ? ['#1a1a2e', '#16213e', '#0f3460'] : ['#667eea', '#764ba2', '#F093FB']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />

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
                  style={styles.resultsTopBackButton}
                  onPress={handleResultsBack}
                  accessibilityLabel={launchedFromReviewHub ? 'Back to home' : 'Go back'}
                  accessibilityRole="button"
                  testID="study-results-top-back-button"
                >
                  <ArrowLeft color="#FFFFFF" size={20} strokeWidth={2.5} />
                </TouchableOpacity>
              </View>

              <View style={styles.resultsMainContent}>
                <View
                  style={[
                    styles.resultsEyebrow,
                    isCompactResults ? styles.resultsEyebrowCompact : null,
                    { backgroundColor: studyMode === 'due' ? 'rgba(16, 185, 129, 0.16)' : 'rgba(255, 255, 255, 0.16)' },
                  ]}
                >
                  {studyMode === 'due' ? (
                    <RefreshCw color="#6EE7B7" size={14} strokeWidth={2.3} />
                  ) : (
                    <BookOpen color="#E9D5FF" size={14} strokeWidth={2.3} />
                  )}
                  <Text style={styles.resultsEyebrowText}>
                    {studyMode === 'due'
                      ? remainingDueCount === 0 ? 'Due queue cleared' : 'Review checkpoint'
                      : 'Study session complete'}
                  </Text>
                </View>

                <Text style={[styles.resultsTitle, isCompactResults ? styles.resultsTitleCompact : null]}>
                  {studyMode === 'due'
                    ? remainingDueCount === 0 ? 'You’re all caught up' : 'Nice progress'
                    : 'Deck Complete!'}
                </Text>
                <Text style={[styles.resultsSubtitle, isCompactResults ? styles.resultsSubtitleCompact : null]}>
                  {studyMode === 'due'
                    ? remainingDueCount === 0
                      ? `${selectedDeck.name} has no cards waiting for review right now.`
                      : `You finished this round in ${selectedDeck.name}. ${remainingDueCount} card${remainingDueCount !== 1 ? 's are' : ' is'} still due.`
                    : `Great work studying ${selectedDeck.name}`}
                </Text>

                <View style={[styles.resultsCard, isCompactResults ? styles.resultsCardCompact : null]}>
                  <View style={styles.resultStat}>
                    <Text style={[styles.resultStatValue, isCompactResults ? styles.resultStatValueCompact : null]}>{sessionResolved}</Text>
                    <Text style={styles.resultStatLabel}>{studyMode === 'due' ? 'Reviewed now' : 'Reviewed'}</Text>
                  </View>
                  <View style={styles.resultStatDivider} />
                  <View style={styles.resultStat}>
                    <Text
                      style={[
                        styles.resultStatValue,
                        isCompactResults ? styles.resultStatValueCompact : null,
                        { color: studyMode === 'due' && remainingDueCount === 0 ? '#10B981' : '#667eea' },
                      ]}
                    >
                      {studyMode === 'due' ? remainingDueCount : selectedDeck.flashcards.length}
                    </Text>
                    <Text style={styles.resultStatLabel}>{studyMode === 'due' ? 'Still due' : 'In deck'}</Text>
                  </View>
                  <View style={styles.resultStatDivider} />
                  <View style={styles.resultStat}>
                    <Text style={[styles.resultStatValue, isCompactResults ? styles.resultStatValueCompact : null, { color: '#10B981' }]}>+{sessionXp}</Text>
                    <Text style={styles.resultStatLabel}>XP earned</Text>
                  </View>
                </View>

                <View style={[styles.resultsStatusCard, isCompactResults ? styles.resultsStatusCardCompact : null]}>
                  <View style={styles.resultsStatusHeader}>
                    <View
                      style={[
                        styles.resultsStatusDot,
                        { backgroundColor: studyMode === 'due' ? (remainingDueCount === 0 ? '#34D399' : '#F59E0B') : '#818CF8' },
                      ]}
                    />
                    <Text style={styles.resultsStatusTitle}>
                      {studyMode === 'due'
                        ? remainingDueCount === 0 ? 'This deck is cleared for now' : 'You can stop here or keep reinforcing'
                        : 'Nice momentum'}
                    </Text>
                  </View>
                  <Text style={styles.resultsStatusText}>
                    {studyMode === 'due'
                      ? remainingDueCount === 0
                        ? 'Head home and the review hub will bring this deck back when cards are due again.'
                        : 'You finished the current review pass. Go home now or continue with the full deck for extra reps.'
                      : 'Come back later for spaced repetition, or jump into Quest mode to test recall under pressure.'}
                  </Text>

                  {(needsReviewCount > 0 || studySummary.newCount > 0) ? (
                    <View style={styles.srsResultBanner}>
                      {needsReviewCount > 0 ? (
                        <View style={styles.srsResultRow}>
                          <RefreshCw color="#F59E0B" size={14} strokeWidth={2.2} />
                          <Text style={styles.srsResultText}>{needsReviewCount} card{needsReviewCount !== 1 ? 's' : ''} still need review in this deck</Text>
                        </View>
                      ) : null}
                      {studySummary.newCount > 0 ? (
                        <View style={styles.srsResultRow}>
                          <Sparkles color="#60A5FA" size={14} strokeWidth={2.2} />
                          <Text style={styles.srsResultText}>{studySummary.newCount} new card{studySummary.newCount !== 1 ? 's are' : ' is'} ready when you want to keep going</Text>
                        </View>
                      ) : null}
                    </View>
                  ) : null}
                </View>
              </View>

              <View style={styles.resultsActions}>
                <TouchableOpacity
                  style={styles.primaryResultsButton}
                  onPress={handleResultsBack}
                  accessibilityLabel={launchedFromReviewHub ? 'Back to home' : 'Go back'}
                  accessibilityRole="button"
                  testID="study-results-back-button"
                >
                  <Text style={styles.primaryResultsButtonText}>
                    {launchedFromReviewHub ? 'Back to Home' : studyMode === 'due' ? 'Done for Now' : 'Back to Decks'}
                  </Text>
                </TouchableOpacity>

                {studyMode === 'due' ? (
                  <TouchableOpacity
                    style={styles.secondaryResultsButton}
                    onPress={handleContinueWithAll}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                    testID="study-results-continue-all-button"
                  >
                    <RotateCcw color="#FFFFFF" size={18} strokeWidth={2} />
                    <Text style={styles.secondaryResultsButtonText}>Continue with All Cards</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity style={styles.restartButton} onPress={handleRestart} testID="study-results-restart-button">
                    <RotateCcw color="#667eea" size={20} strokeWidth={2} />
                    <Text style={styles.restartButtonText}>Study Again</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={styles.suggestButton}
                  onPress={() => router.push(questHref({ deckId: selectedDeck.id }))}
                >
                  <Target color="#fff" size={20} strokeWidth={2} />
                  <Text style={styles.suggestButtonText}>Test Yourself in Quest Mode</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.hubButton}
                  onPress={() => router.push(deckHubHref(selectedDeck.id))}
                >
                  <Zap color="rgba(255,255,255,0.7)" size={18} strokeWidth={2} />
                  <Text style={styles.hubButtonText}>View Deck Progress</Text>
                </TouchableOpacity>
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
            <TouchableOpacity onPress={() => (launchedFromReviewHub ? handleDismissToHome() : router.back())} style={styles.backButton} accessibilityLabel="Go back" accessibilityRole="button">
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
              if (launchedFromReviewHub) {
                handleDismissToHome();
              } else {
                router.back();
              }
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
                      if (launchedFromReviewHub) {
                        handleDismissToHome();
                      } else {
                        router.back();
                      }
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
                  handleDismissToHome();
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
