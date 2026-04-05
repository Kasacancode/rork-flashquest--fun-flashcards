import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, type Href } from 'expo-router';
import { ChevronRight, Trophy, BookOpen, Compass, RotateCcw, Swords, Target, User } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  Animated,
  RefreshControl,
  PanResponder,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';

import ResponsiveContainer from '@/components/ResponsiveContainer';
import { SkeletonBox, SkeletonCard } from '@/components/SkeletonLoader';
import { useDeckContext } from '@/context/DeckContext';
import { useStatsContext } from '@/context/StatsContext';
import { usePerformance } from '@/context/PerformanceContext';
import { useTheme } from '@/context/ThemeContext';
import { supabase } from '@/lib/supabase';
import { fetchIncomingChallenges, type ChallengeData } from '@/utils/challengeService';
import { computeLevel, getLevelBandPalette, getLevelEntry } from '@/utils/levels';
import { getLiveCardStats, isCardDueForReview } from '@/utils/mastery';
import { serializeQuestSettings } from '@/utils/questParams';
import { ARENA_ROUTE, DECKS_ROUTE, EXPLORE_ROUTE, deckHubHref, questHref, questSessionHref, studyHref } from '@/utils/routes';
import { logger } from '@/utils/logger';
import { buildCrossDeckReviewDeck, CROSS_DECK_REVIEW_DECK_ID } from '@/utils/reviewUtils';
import { getUserInterests } from '@/utils/userInterests';
import { useResponsiveLayout } from '@/utils/responsive';

type SmartActionKind = 'review' | 'create' | 'deck' | 'quest' | 'battle' | 'explore';

interface SmartAction {
  key: string;
  title: string;
  subtitle: string;
  route: Href;
  colors: readonly [string, string];
  kind: SmartActionKind;
  accessibilityLabel: string;
  testID: string;
}

function getSmartActionRouteKey(route: Href): string {
  return typeof route === 'string'
    ? route
    : `${route.pathname}?${JSON.stringify(route.params ?? {})}`;
}

function AnimatedStatValue({ animValue, style }: { animValue: Animated.Value; style: StyleProp<TextStyle> }) {
  const [display, setDisplay] = React.useState<string>('0');

  React.useEffect(() => {
    const listenerId = animValue.addListener(({ value }) => {
      setDisplay(Math.round(value).toLocaleString());
    });

    return () => {
      animValue.removeListener(listenerId);
    };
  }, [animValue]);

  return <Text style={style}>{display}</Text>;
}

export default function HomePage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { decks, isLoading } = useDeckContext();
  const { stats } = useStatsContext();
  const { performance, getWeakCards } = usePerformance();
  const { theme, isDark } = useTheme();
  const { contentMaxWidth, screenWidth } = useResponsiveLayout();
  const streakAnim = useRef<Animated.Value>(new Animated.Value(0)).current;
  const cardsAnim = useRef<Animated.Value>(new Animated.Value(0)).current;
  const statsPagerTranslateX = useRef<Animated.Value>(new Animated.Value(0)).current;
  const statsPagerDragStartX = useRef<number>(0);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [statsPage, setStatsPage] = useState<number>(0);
  const [userInterests, setUserInterests] = useState<string[]>([]);
  const [incomingChallenges, setIncomingChallenges] = useState<ChallengeData[]>([]);
  const [showReviewSheet, setShowReviewSheet] = useState<boolean>(false);
  const reviewSheetTranslateY = useRef<Animated.Value>(new Animated.Value(520)).current;
  const reviewSheetBackdropOpacity = useRef<Animated.Value>(new Animated.Value(0)).current;
  const reviewSheetDragStartY = useRef<number>(0);
  const reviewSheetCloseActionRef = useRef<null | (() => void)>(null);
  const hasCustomDecks = useMemo<boolean>(() => decks.some((deck) => deck.isCustom), [decks]);
  const availableContentWidth = contentMaxWidth ?? screenWidth;
  const isCompactHomeLayout = availableContentWidth < 390;
  const statsCardInnerWidth = Math.max(260, availableContentWidth - 80);
  const actionCardWidth = Math.max(140, Math.floor((availableContentWidth - 64) / 2));
  const level = useMemo(() => computeLevel(stats.totalScore), [stats.totalScore]);
  const levelEntry = useMemo(() => getLevelEntry(level), [level]);
  const levelPalette = useMemo(() => getLevelBandPalette(level, isDark), [level, isDark]);

  const loadIncomingChallenges = useCallback(async () => {
    try {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      if (!currentSession?.user?.id) {
        setIncomingChallenges([]);
        return;
      }

      const nextChallenges = await fetchIncomingChallenges(currentSession.user.id);
      setIncomingChallenges(nextChallenges);
    } catch (error) {
      logger.warn('[Home] Failed to load incoming challenges:', error);
    }
  }, []);

  useEffect(() => {
    getUserInterests().then(setUserInterests).catch(() => {});
  }, []);

  useEffect(() => {
    void loadIncomingChallenges();
  }, [loadIncomingChallenges]);

  const backgroundGradient = theme.homeGradient;
  const upperAtmosphereGradient = useMemo(
    () => (
      isDark
        ? ['rgba(8, 15, 29, 0)', 'rgba(47, 72, 134, 0.07)', 'rgba(14, 20, 36, 0)'] as const
        : ['rgba(110, 145, 255, 0.34)', 'rgba(121, 112, 241, 0.16)', 'rgba(255, 255, 255, 0)'] as const
    ),
    [isDark],
  );
  const lowerAtmosphereGradient = useMemo(
    () => (
      isDark
        ? ['rgba(16, 24, 39, 0)', 'rgba(86, 65, 176, 0.04)', 'rgba(20, 28, 46, 0.08)'] as const
        : ['rgba(255, 255, 255, 0)', 'rgba(199, 141, 232, 0.14)', 'rgba(230, 173, 222, 0.28)'] as const
    ),
    [isDark],
  );
  const shellOverlayGradient = useMemo(
    () => (
      isDark
        ? ['rgba(10, 16, 29, 0)', 'rgba(9, 16, 29, 0.08)', 'rgba(4, 8, 18, 0.18)'] as const
        : ['rgba(255, 255, 255, 0.08)', 'rgba(111, 125, 236, 0.1)', 'rgba(219, 160, 229, 0.16)'] as const
    ),
    [isDark],
  );
  const titleColor = theme.white;
  const subtitleColor = isDark ? 'rgba(229, 236, 248, 0.84)' : 'rgba(241, 236, 252, 0.88)';
  const topGlowColor = isDark ? 'rgba(88, 97, 215, 0.075)' : 'rgba(97, 131, 255, 0.24)';
  const midGlowColor = isDark ? 'rgba(44, 166, 154, 0.038)' : 'rgba(133, 114, 237, 0.08)';
  const bottomGlowColor = isDark ? 'rgba(96, 72, 191, 0.035)' : 'rgba(220, 160, 228, 0.22)';
  const profileSurface = isDark ? 'rgba(29, 38, 57, 0.92)' : 'rgba(255, 255, 255, 0.94)';
  const profileBorderColor = isDark ? 'rgba(148, 163, 184, 0.18)' : 'rgba(148, 163, 184, 0.18)';
  const profileGradient = isDark
    ? ['rgba(40, 52, 74, 0.98)', 'rgba(31, 41, 60, 0.98)'] as const
    : ['rgba(255, 255, 255, 0.98)', 'rgba(245, 248, 252, 0.98)'] as const;
  const profileIconColor = theme.homeIconColor;
  const statsCardGradient = isDark
    ? ['rgba(18, 28, 45, 0.99)', 'rgba(14, 22, 37, 0.99)'] as const
    : ['rgba(255, 255, 255, 0.97)', 'rgba(248, 245, 255, 0.97)'] as const;
  const statsBorderColor = isDark ? 'rgba(110, 130, 162, 0.18)' : 'rgba(148, 163, 184, 0.16)';
  const statsDividerColor = isDark ? 'rgba(112, 132, 163, 0.24)' : 'rgba(148, 163, 184, 0.22)';
  const statsShadowColor = theme.homeShadow;
  const statsValueColor = theme.homeStatsValue;
  const statsLabelColor = isDark ? 'rgba(203, 213, 225, 0.86)' : 'rgba(71, 85, 105, 0.86)';
  const statsLevelColor = isDark && levelPalette.band === 'early'
    ? levelPalette.badgeGradient[0]
    : levelPalette.badgeGradient[1];
  const actionShadowColor = theme.homeShadow;
  const actionBorderColor = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(15, 23, 42, 0.1)';
  const actionGradients = useMemo(
    () => ({
      arena: theme.homeArenaGradient,
      quest: theme.homeQuestGradient,
      stats: theme.homeStatsGradient,
      decks: theme.homeDecksGradient,
    }),
    [theme.homeArenaGradient, theme.homeDecksGradient, theme.homeQuestGradient, theme.homeStatsGradient],
  );
  const smartActionGradients = useMemo(
    () => ({
      review: theme.homeSmartReviewGradient,
      create: theme.homeSmartCreateGradient,
      deck: theme.homeSmartDeckGradient,
      quest: theme.homeSmartQuestGradient,
      battle: theme.homeSmartBattleGradient,
      explore: theme.homeSmartExploreGradient,
    }),
    [
      theme.homeSmartBattleGradient,
      theme.homeSmartCreateGradient,
      theme.homeSmartDeckGradient,
      theme.homeSmartExploreGradient,
      theme.homeSmartQuestGradient,
      theme.homeSmartReviewGradient,
    ],
  );

  useEffect(() => {
    streakAnim.setValue(0);
    cardsAnim.setValue(0);

    Animated.stagger(100, [
      Animated.timing(streakAnim, { toValue: stats.currentStreak, duration: 600, useNativeDriver: false }),
      Animated.timing(cardsAnim, { toValue: stats.totalCardsStudied, duration: 800, useNativeDriver: false }),
    ]).start();
  }, [cardsAnim, stats.currentStreak, stats.totalCardsStudied, streakAnim]);

  const recommendations = useMemo(() => {
    if (decks.length === 0) {
      return [] as { deckId: string; name: string; color: string; message: string; priority: number }[];
    }

    const hasPerformanceData = Object.keys(performance.deckStatsById).length > 0 || Object.keys(performance.cardStatsById).length > 0;
    if (!hasPerformanceData) {
      return [] as { deckId: string; name: string; color: string; message: string; priority: number }[];
    }

    const recs: { deckId: string; name: string; color: string; message: string; priority: number }[] = [];
    const now = Date.now();
    const oneDay = 86400000;

    for (const deck of decks) {
      const deckStats = performance.deckStatsById[deck.id];
      const accuracy = deckStats && deckStats.attempts > 0 ? deckStats.correct / deckStats.attempts : null;
      const daysSince = deckStats?.lastAttemptAt ? Math.floor((now - deckStats.lastAttemptAt) / oneDay) : null;
      const weakCards = getWeakCards(deck.id, deck.flashcards, 5);

      if (!deckStats || deckStats.attempts === 0) {
        recs.push({ deckId: deck.id, name: deck.name, color: deck.color, message: 'Not started yet. Try it!', priority: 10 });
        continue;
      }
      if (accuracy !== null && accuracy < 0.6) {
        recs.push({ deckId: deck.id, name: deck.name, color: deck.color, message: `${Math.round(accuracy * 100)}% accuracy. Needs practice`, priority: 8 });
        continue;
      }
      if (weakCards.length >= 3) {
        recs.push({ deckId: deck.id, name: deck.name, color: deck.color, message: `${weakCards.length} cards need review`, priority: 7 });
        continue;
      }
      if (daysSince !== null && daysSince >= 3) {
        recs.push({ deckId: deck.id, name: deck.name, color: deck.color, message: `Last studied ${daysSince} days ago`, priority: 5 + Math.min(daysSince, 5) });
        continue;
      }
      if (accuracy !== null && accuracy < 0.85) {
        recs.push({ deckId: deck.id, name: deck.name, color: deck.color, message: `${Math.round(accuracy * 100)}%. Keep improving`, priority: 3 });
      }
    }

    return recs.sort((a, b) => b.priority - a.priority).slice(0, 5);
  }, [decks, getWeakCards, performance.cardStatsById, performance.deckStatsById]);

  const reviewSummary = useMemo(() => {
    if (decks.length === 0) return null;

    const now = Date.now();
    const deckSummaries: { deckId: string; name: string; color: string; reviewCount: number }[] = [];
    let totalReviewCount = 0;

    for (const deck of decks) {
      let reviewCount = 0;
      for (const card of deck.flashcards) {
        const stats = performance.cardStatsById[card.id];
        if (!stats || stats.attempts === 0) continue;
        const live = getLiveCardStats(stats, now);
        if (live.status === 'lapsed' || isCardDueForReview(stats, now)) {
          reviewCount += 1;
        }
      }
      if (reviewCount > 0) {
        deckSummaries.push({ deckId: deck.id, name: deck.name, color: deck.color, reviewCount });
        totalReviewCount += reviewCount;
      }
    }

    if (totalReviewCount === 0) return null;

    deckSummaries.sort((a, b) => b.reviewCount - a.reviewCount);
    return { deckSummaries, totalReviewCount };
  }, [decks, performance.cardStatsById]);

  const topReviewDeck = reviewSummary?.deckSummaries[0] ?? null;
  const previewReviewDecks = reviewSummary?.deckSummaries.slice(1, 3) ?? [];
  const reviewDeckCount = reviewSummary?.deckSummaries.length ?? 0;
  const reviewTotalCount = reviewSummary?.totalReviewCount ?? 0;
  const remainingReviewDeckCount = Math.max(0, reviewDeckCount - 1 - previewReviewDecks.length);
  const reviewPageTitle = reviewSummary
    ? `${reviewTotalCount} ${reviewTotalCount === 1 ? 'card needs' : 'cards need'} attention`
    : 'All caught up for now';
  const reviewPageSubtitle = reviewSummary
    ? `${reviewDeckCount} ${reviewDeckCount === 1 ? 'deck is' : 'decks are'} ready now. Tap to open the review hub.`
    : `${decks.length} ${decks.length === 1 ? 'deck is' : 'decks are'} in good shape. Tap to double-check your review hub.`;
  const primaryRecommendation = recommendations[0] ?? null;
  const newestDeck = useMemo(() => {
    if (decks.length === 0) {
      return null;
    }

    return [...decks].sort((a, b) => b.createdAt - a.createdAt)[0] ?? null;
  }, [decks]);
  const smartActions = useMemo<SmartAction[]>(() => {
    const items: SmartAction[] = [];
    const pushAction = (action: SmartAction) => {
      if (items.some((existing) => existing.key === action.key)) {
        return;
      }

      const nextRouteKey = getSmartActionRouteKey(action.route);
      if (items.some((existing) => getSmartActionRouteKey(existing.route) === nextRouteKey)) {
        return;
      }

      items.push(action);
    };

    if (!hasCustomDecks) {
      const interestsCopy = userInterests
        .slice(0, 2)
        .map((interest) => interest.trim())
        .filter(Boolean);
      const interestHint = interestsCopy.length > 0
        ? `Start with ${interestsCopy.join(' + ')}.`
        : 'Scan notes or paste text to build one fast.';

      pushAction({
        key: 'create-first-deck',
        title: 'Build your first deck',
        subtitle: interestHint,
        route: DECKS_ROUTE,
        colors: smartActionGradients.create,
        kind: 'create',
        accessibilityLabel: 'Build your first deck',
        testID: 'home-smart-create-deck',
      });
      pushAction({
        key: 'explore-community-decks',
        title: 'Scout community decks',
        subtitle: 'Save a strong deck and jump in right away.',
        route: EXPLORE_ROUTE,
        colors: smartActionGradients.explore,
        kind: 'explore',
        accessibilityLabel: 'Explore community decks',
        testID: 'home-smart-explore',
      });

      if (newestDeck) {
        pushAction({
          key: `starter-${newestDeck.id}`,
          title: 'Warm up with a starter deck',
          subtitle: `${newestDeck.name} is ready for a first run.`,
          route: studyHref(newestDeck.id),
          colors: smartActionGradients.review,
          kind: 'review',
          accessibilityLabel: `Study ${newestDeck.name}`,
          testID: `home-smart-starter-${newestDeck.id}`,
        });
      }

      if (items.length < 3) {
        pushAction({
          key: 'open-deck-lab',
          title: 'Open your deck lab',
          subtitle: 'Create, import, and organize your collection.',
          route: DECKS_ROUTE,
          colors: smartActionGradients.deck,
          kind: 'deck',
          accessibilityLabel: 'Open decks',
          testID: 'home-smart-open-decks',
        });
      }

      return items.slice(0, 3);
    }

    if (topReviewDeck) {
      pushAction({
        key: `review-${topReviewDeck.deckId}`,
        title: `Review ${topReviewDeck.reviewCount} due`,
        subtitle: `${topReviewDeck.name} is ready right now.`,
        route: studyHref(topReviewDeck.deckId, 'due', 'review-hub'),
        colors: smartActionGradients.review,
        kind: 'review',
        accessibilityLabel: `Review ${topReviewDeck.reviewCount} due cards in ${topReviewDeck.name}`,
        testID: `home-smart-review-${topReviewDeck.deckId}`,
      });
    }

    if (primaryRecommendation) {
      const isNewDeck = /Not started yet/i.test(primaryRecommendation.message);
      const isRustyDeck = /days ago/i.test(primaryRecommendation.message);
      const recommendationTitle = isNewDeck
        ? `Start ${primaryRecommendation.name}`
        : isRustyDeck
          ? `Return to ${primaryRecommendation.name}`
          : `Sharpen ${primaryRecommendation.name}`;

      pushAction({
        key: `recommend-${primaryRecommendation.deckId}`,
        title: recommendationTitle,
        subtitle: primaryRecommendation.message,
        route: studyHref(primaryRecommendation.deckId),
        colors: smartActionGradients.deck,
        kind: 'deck',
        accessibilityLabel: `${recommendationTitle}. ${primaryRecommendation.message}`,
        testID: `home-smart-recommend-${primaryRecommendation.deckId}`,
      });
    }

    if (stats.currentStreak === 0 && stats.totalCardsStudied > 0) {
      pushAction({
        key: 'reignite-streak',
        title: 'Reignite your streak',
        subtitle: 'One quick run gets today back on the board.',
        route: primaryRecommendation ? studyHref(primaryRecommendation.deckId) : questHref(),
        colors: smartActionGradients.quest,
        kind: 'quest',
        accessibilityLabel: 'Reignite your streak',
        testID: 'home-smart-streak',
      });
    } else if (stats.totalQuestSessions < 3) {
      pushAction({
        key: 'quick-quest',
        title: 'Try a quick quest',
        subtitle: 'Fast multiple-choice reps sharpen recall.',
        route: primaryRecommendation ? questHref({ deckId: primaryRecommendation.deckId }) : questHref(),
        colors: smartActionGradients.quest,
        kind: 'quest',
        accessibilityLabel: 'Try a quick quest',
        testID: 'home-smart-quest',
      });
    } else if (stats.totalArenaBattles === 0 && stats.totalCardsStudied >= 20) {
      pushAction({
        key: 'first-battle',
        title: 'Enter your first battle',
        subtitle: 'You have enough reps to step into the arena.',
        route: ARENA_ROUTE,
        colors: smartActionGradients.battle,
        kind: 'battle',
        accessibilityLabel: 'Enter your first battle',
        testID: 'home-smart-battle',
      });
    }

    if (decks.length < 3) {
      pushAction({
        key: 'expand-deck-roster',
        title: 'Scout more decks',
        subtitle: 'Add a few more community decks for variety.',
        route: EXPLORE_ROUTE,
        colors: smartActionGradients.explore,
        kind: 'explore',
        accessibilityLabel: 'Explore more community decks',
        testID: 'home-smart-expand-roster',
      });
    }

    if (items.length < 3 && newestDeck) {
      pushAction({
        key: `open-${newestDeck.id}`,
        title: `Open ${newestDeck.name}`,
        subtitle: `${newestDeck.flashcards.length} cards ready whenever you are.`,
        route: deckHubHref(newestDeck.id),
        colors: smartActionGradients.deck,
        kind: 'deck',
        accessibilityLabel: `Open ${newestDeck.name}`,
        testID: `home-smart-open-${newestDeck.id}`,
      });
    }

    if (items.length < 3) {
      pushAction({
        key: 'deck-lineup',
        title: 'Tune your deck lineup',
        subtitle: 'Create, import, and organize your collection.',
        route: DECKS_ROUTE,
        colors: smartActionGradients.create,
        kind: 'create',
        accessibilityLabel: 'Open decks',
        testID: 'home-smart-decks',
      });
    }

    return items.slice(0, 3);
  }, [
    decks,
    hasCustomDecks,
    newestDeck,
    primaryRecommendation,
    smartActionGradients,
    stats.currentStreak,
    stats.totalArenaBattles,
    stats.totalCardsStudied,
    stats.totalQuestSessions,
    topReviewDeck,
    userInterests,
  ]);
  const communityDeckAction = useMemo<SmartAction>(() => {
    return smartActions.find((action) => action.kind === 'explore') ?? {
      key: 'community-decks-banner',
      title: 'Scout community decks',
      subtitle: 'Save a strong deck and jump in right away.',
      route: EXPLORE_ROUTE,
      colors: smartActionGradients.explore,
      kind: 'explore',
      accessibilityLabel: 'Explore community decks',
      testID: 'home-community-decks-banner',
    };
  }, [smartActionGradients.explore, smartActions]);
  const communityBannerBackground = isDark
    ? ['rgba(18, 27, 43, 0.96)', 'rgba(11, 19, 33, 0.94)'] as const
    : ['rgba(251, 252, 255, 0.98)', 'rgba(241, 246, 255, 0.96)'] as const;
  const communityBannerBorderColor = isDark ? 'rgba(148, 163, 184, 0.16)' : 'rgba(255, 255, 255, 0.58)';
  const communityBannerIconSurface = theme.communityIconSurface;
  const communityBannerIconColor = theme.communityIconColor;
  const communityBannerTitleColor = theme.communityTitle;
  const communityBannerSubtitleColor = theme.communitySubtitle;
  const communityBannerDecorColor = isDark ? 'rgba(99, 102, 241, 0.12)' : 'rgba(198, 208, 255, 0.36)';
  const communityBannerAccentColor = isDark ? 'rgba(129, 140, 248, 0.08)' : 'rgba(224, 231, 255, 0.82)';
  const communityBannerTitle = 'Explore Community Decks';
  const communityBannerSubtitle = 'Discover decks from other FlashQuest players and save them offline';
  const reviewChevronColor = isDark ? 'rgba(255,255,255,0.7)' : theme.homeReviewAccent;

  const hasReviewPage = decks.length > 0;

  const animateReviewSheetOpen = useCallback(() => {
    Animated.parallel([
      Animated.spring(reviewSheetTranslateY, {
        toValue: 0,
        useNativeDriver: true,
        tension: 82,
        friction: 12,
      }),
      Animated.timing(reviewSheetBackdropOpacity, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start();
  }, [reviewSheetBackdropOpacity, reviewSheetTranslateY]);

  const handleCloseReviewSheet = useCallback((afterClose?: () => void) => {
    if (!showReviewSheet) {
      if (afterClose) {
        requestAnimationFrame(afterClose);
      }
      return;
    }

    logger.debug('[Home] Closing review hub', { hasAfterClose: Boolean(afterClose) });
    reviewSheetCloseActionRef.current = afterClose ?? null;
    Animated.parallel([
      Animated.timing(reviewSheetTranslateY, {
        toValue: 520,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.timing(reviewSheetBackdropOpacity, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (!finished) {
        return;
      }

      setShowReviewSheet(false);
      reviewSheetTranslateY.setValue(520);
      const nextAction = reviewSheetCloseActionRef.current;
      reviewSheetCloseActionRef.current = null;

      if (nextAction) {
        requestAnimationFrame(nextAction);
      }
    });
  }, [reviewSheetBackdropOpacity, reviewSheetTranslateY, showReviewSheet]);

  const handleOpenReviewSheet = useCallback(() => {
    if (!hasReviewPage) {
      return;
    }

    logger.debug('[Home] Opening review hub', {
      totalReviewCount: reviewTotalCount,
      deckCount: reviewDeckCount,
      hasDueCards: reviewSummary !== null,
    });
    reviewSheetCloseActionRef.current = null;
    reviewSheetTranslateY.setValue(520);
    reviewSheetBackdropOpacity.setValue(0);
    setShowReviewSheet(true);
    requestAnimationFrame(() => {
      animateReviewSheetOpen();
    });
  }, [animateReviewSheetOpen, hasReviewPage, reviewDeckCount, reviewSheetBackdropOpacity, reviewSheetTranslateY, reviewSummary, reviewTotalCount]);

  const handleLaunchDueDeck = useCallback((deckId: string) => {
    logger.debug('[Home] Launching due review deck', { deckId, source: 'review-hub' });
    handleCloseReviewSheet(() => {
      router.push(studyHref(deckId, 'due', 'review-hub'));
    });
  }, [handleCloseReviewSheet, router]);

  const handleStartReviewing = useCallback(() => {
    const reviewDeck = buildCrossDeckReviewDeck(decks, performance.cardStatsById);
    if (!reviewDeck) {
      Alert.alert('All caught up!', 'No cards are due for review right now.');
      return;
    }

    logger.debug('[Home] Launching cross-deck review', {
      reviewCardCount: reviewDeck.flashcards.length,
      source: 'review-hub',
    });
    handleCloseReviewSheet(() => {
      router.push(studyHref(CROSS_DECK_REVIEW_DECK_ID, 'due', 'review-hub'));
    });
  }, [decks, handleCloseReviewSheet, performance.cardStatsById, router]);

  const handleOpenDecksFromReviewSheet = useCallback(() => {
    handleCloseReviewSheet(() => {
      router.push(DECKS_ROUTE);
    });
  }, [handleCloseReviewSheet, router]);

  useEffect(() => {
    if (!hasReviewPage && showReviewSheet) {
      setShowReviewSheet(false);
      reviewSheetTranslateY.setValue(520);
      reviewSheetBackdropOpacity.setValue(0);
      reviewSheetCloseActionRef.current = null;
    }
  }, [hasReviewPage, reviewSheetBackdropOpacity, reviewSheetTranslateY, showReviewSheet]);

  const reviewSheetPanResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) => {
          if (!showReviewSheet) {
            return false;
          }

          return gestureState.dy > 6 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx) * 1.2;
        },
        onMoveShouldSetPanResponderCapture: (_, gestureState) => {
          if (!showReviewSheet) {
            return false;
          }

          return gestureState.dy > 6 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx) * 1.2;
        },
        onPanResponderGrant: () => {
          reviewSheetTranslateY.stopAnimation((value) => {
            reviewSheetDragStartY.current = value;
          });
          reviewSheetBackdropOpacity.stopAnimation();
        },
        onPanResponderMove: (_, gestureState) => {
          const nextTranslateY = Math.max(0, reviewSheetDragStartY.current + gestureState.dy);
          reviewSheetTranslateY.setValue(nextTranslateY);
          reviewSheetBackdropOpacity.setValue(Math.max(0, 1 - nextTranslateY / 320));
        },
        onPanResponderRelease: (_, gestureState) => {
          const projectedY = reviewSheetDragStartY.current + gestureState.dy + gestureState.vy * 140;
          if (projectedY > 140) {
            handleCloseReviewSheet();
            return;
          }

          animateReviewSheetOpen();
        },
        onPanResponderTerminate: () => {
          animateReviewSheetOpen();
        },
        onPanResponderTerminationRequest: () => false,
      }),
    [animateReviewSheetOpen, handleCloseReviewSheet, reviewSheetBackdropOpacity, reviewSheetTranslateY, showReviewSheet],
  );

  const handleOpenProfile = useCallback(() => {
    router.push('/profile' as Href);
  }, [router]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      queryClient.refetchQueries(),
      loadIncomingChallenges(),
    ]);
    setRefreshing(false);
  }, [loadIncomingChallenges, queryClient]);

  const animateStatsPagerTo = useCallback((page: number) => {
    Animated.spring(statsPagerTranslateX, {
      toValue: hasReviewPage ? -page * statsCardInnerWidth : 0,
      useNativeDriver: true,
      tension: 90,
      friction: 10,
    }).start();
  }, [hasReviewPage, statsCardInnerWidth, statsPagerTranslateX]);

  const handleSetStatsPage = useCallback((page: number) => {
    const nextPage = hasReviewPage ? Math.max(0, Math.min(1, page)) : 0;

    if (nextPage === statsPage) {
      animateStatsPagerTo(nextPage);
      return;
    }

    setStatsPage(nextPage);
  }, [animateStatsPagerTo, hasReviewPage, statsPage]);

  useEffect(() => {
    if (!hasReviewPage && statsPage !== 0) {
      setStatsPage(0);
    }
  }, [hasReviewPage, statsPage]);

  useEffect(() => {
    animateStatsPagerTo(statsPage);
  }, [animateStatsPagerTo, statsPage]);

  const statsPanResponder = useMemo(
    () => PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        if (!hasReviewPage) {
          return false;
        }

        return Math.abs(gestureState.dx) > 6 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.1;
      },
      onMoveShouldSetPanResponderCapture: (_, gestureState) => {
        if (!hasReviewPage) {
          return false;
        }

        return Math.abs(gestureState.dx) > 6 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.1;
      },
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        statsPagerTranslateX.stopAnimation((value) => {
          statsPagerDragStartX.current = value;
        });
      },
      onPanResponderMove: (_, gestureState) => {
        const rawTranslateX = statsPagerDragStartX.current + gestureState.dx;
        let nextTranslateX = rawTranslateX;

        if (rawTranslateX > 0) {
          nextTranslateX = rawTranslateX * 0.2;
        } else if (rawTranslateX < -statsCardInnerWidth) {
          nextTranslateX = -statsCardInnerWidth + (rawTranslateX + statsCardInnerWidth) * 0.2;
        }

        statsPagerTranslateX.setValue(nextTranslateX);
      },
      onPanResponderRelease: (_, gestureState) => {
        const projectedTranslateX = statsPagerDragStartX.current + gestureState.dx + gestureState.vx * 96;
        const nextPage = Math.max(0, Math.min(1, Math.round(Math.abs(projectedTranslateX) / statsCardInnerWidth)));

        handleSetStatsPage(nextPage);
      },
      onPanResponderTerminate: () => {
        animateStatsPagerTo(statsPage);
      },
    }),
    [animateStatsPagerTo, handleSetStatsPage, hasReviewPage, statsCardInnerWidth, statsPage, statsPagerTranslateX],
  );

  const renderActionCard = ({
    route,
    colors,
    title,
    icon,
    testID,
  }: {
    route: Href;
    colors: readonly [string, string];
    title: string;
    icon: React.ReactNode;
    testID: string;
  }) => {
    return (
      <TouchableOpacity
        style={[
          styles.actionCard,
          styles.actionCardMedium,
          {
            width: actionCardWidth,
            backgroundColor: colors[1],
            shadowColor: actionShadowColor,
            shadowOpacity: isDark ? 0.24 : 0.12,
            shadowRadius: isDark ? 16 : 10,
            elevation: isDark ? 9 : 5,
            borderWidth: 1,
            borderColor: actionBorderColor,
          },
        ]}
        onPress={() => router.push(route)}
        activeOpacity={0.9}
        accessibilityLabel={`Open ${title}`}
        accessibilityRole="button"
        testID={testID}
      >
        <LinearGradient
          colors={colors}
          start={{ x: 0.12, y: 0.08 }}
          end={{ x: 0.88, y: 0.92 }}
          style={styles.actionGradient}
        >
          <View style={styles.actionContent}>
            <View style={styles.actionIconSlot}>{icon}</View>
            <Text style={[styles.actionTitleMedium, { color: theme.white }]}>{title}</Text>
          </View>
        </LinearGradient>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <LinearGradient
        colors={backgroundGradient}
        start={{ x: 0.04, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={upperAtmosphereGradient}
        start={{ x: 0.02, y: 0 }}
        end={{ x: 0.82, y: 0.42 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <LinearGradient
        colors={lowerAtmosphereGradient}
        start={{ x: 0.18, y: 0.5 }}
        end={{ x: 0.92, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <LinearGradient
        colors={shellOverlayGradient}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.95, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <View pointerEvents="none" style={[styles.topGlow, { backgroundColor: topGlowColor }]} />
      <View pointerEvents="none" style={[styles.midGlow, { backgroundColor: midGlowColor }]} />
      <View pointerEvents="none" style={[styles.bottomGlow, { backgroundColor: bottomGlowColor }]} />

      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor="rgba(255,255,255,0.7)"
              colors={[theme.primary]}
            />
          }
          testID="home-scroll-view"
        >
          <ResponsiveContainer>
            {isLoading && decks.length === 0 ? (
            <View style={{ paddingHorizontal: 24, paddingTop: 20, gap: 20 }}>
              <SkeletonBox width="50%" height={28} borderRadius={12} />
              <SkeletonBox width="80%" height={16} />
              <View style={{ flexDirection: 'row', gap: 14, marginTop: 8 }}>
                <SkeletonCard style={{ flex: 1 }} />
                <SkeletonCard style={{ flex: 1 }} />
              </View>
              <SkeletonCard style={{ marginTop: 8 }} />
              <SkeletonCard />
            </View>
          ) : (
            <>
              <View style={styles.header}>
                <View>
                  <Text style={[styles.title, { color: titleColor }]}>FlashQuest</Text>
                  <Text style={[styles.subtitle, { color: subtitleColor }]}>Deck. Set. Match.</Text>
                </View>
                <TouchableOpacity
                  style={[
                    styles.profileButton,
                    {
                      backgroundColor: profileSurface,
                      borderWidth: 1,
                      borderColor: profileBorderColor,
                      shadowColor: actionShadowColor,
                    },
                  ]}
                  onPress={handleOpenProfile}
                  activeOpacity={0.8}
                  accessibilityLabel="Open profile"
                  accessibilityRole="button"
                  testID="home-profile-button"
                >
                  <LinearGradient
                    colors={profileGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.profileGradient}
                  >
                    <User color={profileIconColor} size={24} strokeWidth={2.5} />
                  </LinearGradient>
                </TouchableOpacity>
              </View>

              <View
                style={[
                  styles.statsCard,
                  {
                    backgroundColor: theme.homeCardBg,
                    borderWidth: 1,
                    borderColor: statsBorderColor,
                    shadowColor: statsShadowColor,
                    shadowOpacity: isDark ? 0.26 : 0.12,
                    shadowRadius: isDark ? 20 : 12,
                    elevation: isDark ? 11 : 5,
                  },
                ]}
              >
                <LinearGradient
                  colors={statsCardGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
                <View style={[styles.statsCardFrame, { borderColor: statsBorderColor }]} />

                <View
                  style={[styles.statsPager, { width: statsCardInnerWidth }]}
                  testID="stats-card-pager"
                  {...(hasReviewPage ? statsPanResponder.panHandlers : {})}
                >
                  <Animated.View
                    style={[
                      styles.statsPagerTrack,
                      {
                        width: hasReviewPage ? statsCardInnerWidth * 2 : statsCardInnerWidth,
                        transform: [{ translateX: statsPagerTranslateX }],
                      },
                    ]}
                  >
                    <View style={[styles.statsPage, { width: statsCardInnerWidth }]} accessible={true} accessibilityLabel={`Level ${level}: ${levelEntry.title}. ${stats.totalScore} XP. Current streak: ${stats.currentStreak} days. ${stats.totalCardsStudied} cards studied.`}>

                    <View style={[styles.statItem, { transform: [{ translateY: 4 }] }]}>
                      <Text
                        style={[styles.levelText, { color: statsLevelColor }]}
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        minimumFontScale={0.84}
                      >
                        LV {level}
                      </Text>
                      <View style={styles.rankLabelWrap}>
                        <Text
                          style={[styles.statLabel, styles.rankLabel, { color: statsLabelColor }]}
                          numberOfLines={2}
                          adjustsFontSizeToFit
                          minimumFontScale={0.8}
                        >
                          {levelEntry.title}
                        </Text>
                      </View>
                    </View>
                    <View style={[styles.statDivider, { backgroundColor: statsDividerColor }]} />
                    <View style={styles.statItem}>
                      <AnimatedStatValue animValue={streakAnim} style={[styles.statValue, { color: statsValueColor }]} />
                      <Text style={[styles.statLabel, { color: statsLabelColor }]}>Day Streak</Text>
                    </View>
                    <View style={[styles.statDivider, { backgroundColor: statsDividerColor }]} />
                    <View style={styles.statItem}>
                      <AnimatedStatValue animValue={cardsAnim} style={[styles.statValue, { color: statsValueColor }]} />
                      <Text style={[styles.statLabel, { color: statsLabelColor }]}>Cards Studied</Text>
                    </View>
                  </View>

                  {hasReviewPage && (
                    <View style={[styles.reviewPage, { width: statsCardInnerWidth }]}>
                      <TouchableOpacity
                        style={[
                          styles.reviewPageSummaryButton,
                          {
                            backgroundColor: isDark ? 'rgba(19, 31, 52, 0.96)' : 'rgba(247, 248, 255, 0.98)',
                            borderColor: isDark ? 'rgba(129, 140, 248, 0.18)' : 'rgba(99, 102, 241, 0.12)',
                            shadowColor: theme.homeShadow,
                            shadowOpacity: isDark ? 0.28 : 0.12,
                            shadowRadius: isDark ? 18 : 10,
                            elevation: isDark ? 8 : 4,
                          },
                        ]}
                        onPress={handleOpenReviewSheet}
                        activeOpacity={0.9}
                        accessibilityLabel={reviewSummary
                          ? `${reviewTotalCount} cards ready for review across ${reviewDeckCount} decks`
                          : `All caught up across ${decks.length} decks. Open the review hub.`}
                        accessibilityRole="button"
                        testID="stats-card-review-page"
                      >
                        <LinearGradient
                          colors={theme.homeSmartReviewCardGradient}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={StyleSheet.absoluteFill}
                        />
                      <View style={styles.reviewPageHeader}>
                        <View style={[styles.reviewIconWrap, { backgroundColor: isDark ? 'rgba(99, 102, 241, 0.15)' : 'rgba(99, 102, 241, 0.1)' }]}>
                          {reviewSummary ? (
                            <RotateCcw color={theme.homeReviewIcon} size={15} strokeWidth={2.4} />
                          ) : (
                            <BookOpen color={theme.homeReviewSecondaryIcon} size={15} strokeWidth={2.4} />
                          )}
                        </View>
                        <View style={styles.reviewPageText}>
                          <Text style={[styles.reviewTitle, { color: statsValueColor }]} numberOfLines={1}>
                            {reviewPageTitle}
                          </Text>
                          <Text style={[styles.reviewSubtitle, { color: statsLabelColor }]} numberOfLines={1}>
                            {reviewPageSubtitle}
                          </Text>
                        </View>
                        <ChevronRight color={reviewChevronColor} size={17} strokeWidth={2.4} />
                      </View>
                      </TouchableOpacity>
                      <View style={styles.reviewChips}>
                        {reviewSummary ? (
                          <>
                            {previewReviewDecks.map((entry) => (
                              <TouchableOpacity
                                key={entry.deckId}
                                style={[styles.reviewChip, { backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)' }]}
                                onPress={handleOpenReviewSheet}
                                activeOpacity={0.75}
                                accessibilityLabel={`${entry.name}: ${entry.reviewCount} cards due for review`}
                                accessibilityRole="button"
                                testID={`review-chip-${entry.deckId}`}
                              >
                                <View style={[styles.reviewChipDot, { backgroundColor: entry.color }]} />
                                <Text style={[styles.reviewChipName, { color: statsValueColor }]} numberOfLines={1}>{entry.name}</Text>
                                <Text style={[styles.reviewChipCount, { color: statsLabelColor }]}>{entry.reviewCount}</Text>
                              </TouchableOpacity>
                            ))}
                            {remainingReviewDeckCount > 0 ? (
                              <TouchableOpacity
                                style={[styles.reviewChip, { backgroundColor: isDark ? 'rgba(129,140,248,0.14)' : 'rgba(99,102,241,0.1)', paddingHorizontal: 10 }]}
                                onPress={handleOpenReviewSheet}
                                activeOpacity={0.8}
                                accessibilityLabel={`Open review hub for ${remainingReviewDeckCount} more decks`}
                                accessibilityRole="button"
                                testID="review-chip-more"
                              >
                                <Text style={[styles.reviewChipCount, { color: theme.homeReviewChip }]}>+{remainingReviewDeckCount} more</Text>
                              </TouchableOpacity>
                            ) : null}
                          </>
                        ) : (
                          <TouchableOpacity
                            style={[styles.reviewChip, { backgroundColor: isDark ? 'rgba(52,211,153,0.14)' : 'rgba(16,185,129,0.1)', paddingHorizontal: 10 }]}
                            onPress={handleOpenReviewSheet}
                            activeOpacity={0.8}
                            accessibilityLabel={`Open review hub. ${decks.length} decks are currently caught up.`}
                            accessibilityRole="button"
                            testID="review-chip-caught-up"
                          >
                            <View style={[styles.reviewChipDot, { backgroundColor: theme.homeReviewDot }]} />
                            <Text style={[styles.reviewChipName, { color: statsValueColor }]}>All clear</Text>
                            <Text style={[styles.reviewChipCount, { color: statsLabelColor }]}>{decks.length}</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  )}
                  </Animated.View>
                </View>

                {hasReviewPage && (
                  <View style={styles.statsPageDots}>
                    <TouchableOpacity
                      style={styles.statsPageDotButton}
                      onPress={() => handleSetStatsPage(0)}
                      activeOpacity={0.8}
                      hitSlop={8}
                      testID="stats-page-dot-0"
                    >
                      <View style={[styles.statsPageDot, { backgroundColor: statsPage === 0 ? theme.homeDotActive : theme.homeDotInactive }]} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.statsPageDotButton}
                      onPress={() => handleSetStatsPage(1)}
                      activeOpacity={0.8}
                      hitSlop={8}
                      testID="stats-page-dot-1"
                    >
                      <View style={[styles.statsPageDot, { backgroundColor: statsPage === 1 ? theme.homeDotActive : theme.homeDotInactive }]} />
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              <View style={styles.actionsGrid}>
                {renderActionCard({
                  route: '/arena' as Href,
                  colors: actionGradients.arena,
                  title: 'Battle',
                  icon: <Swords color={theme.white} size={40} strokeWidth={2.15} />,
                  testID: 'home-action-battle',
                })}
                {renderActionCard({
                  route: '/quest' as Href,
                  colors: actionGradients.quest,
                  title: 'Quest',
                  icon: <Target color={theme.white} size={40} strokeWidth={2.15} />,
                  testID: 'home-action-quest',
                })}
                {renderActionCard({
                  route: '/stats' as Href,
                  colors: actionGradients.stats,
                  title: 'Stats',
                  icon: <Trophy color={theme.white} size={40} strokeWidth={2.15} />,
                  testID: 'home-action-stats',
                })}
                {renderActionCard({
                  route: '/decks' as Href,
                  colors: actionGradients.decks,
                  title: 'Decks',
                  icon: <BookOpen color={theme.white} size={40} strokeWidth={2.15} />,
                  testID: 'home-action-decks',
                })}
              </View>


              {incomingChallenges.length > 0 ? (
                <View
                  style={[
                    styles.challengeCard,
                    {
                      backgroundColor: isDark ? 'rgba(245,158,11,0.08)' : 'rgba(245,158,11,0.06)',
                      borderColor: isDark ? 'rgba(245,158,11,0.2)' : 'rgba(245,158,11,0.15)',
                    },
                  ]}
                  testID="home-incoming-challenge-card"
                >
                  <View style={styles.challengeCardHeader}>
                    <Swords color={theme.warning} size={18} strokeWidth={2.2} />
                    <Text style={[styles.challengeCardTitle, { color: theme.text }]} numberOfLines={1}>
                      Challenge from @{incomingChallenges[0]?.challengerUsername || incomingChallenges[0]?.challengerDisplayName || 'friend'}
                    </Text>
                  </View>
                  <Text style={[styles.challengeCardSubtitle, { color: theme.textSecondary }]}>
                    {incomingChallenges[0]?.deckName} · Beat their score of {incomingChallenges[0]?.challengerScore}!
                  </Text>
                  <TouchableOpacity
                    style={[styles.challengeAcceptButton, { backgroundColor: theme.warning }]}
                    onPress={() => {
                      const challenge = incomingChallenges[0];
                      if (!challenge) {
                        return;
                      }

                      const normalizedDeckName = challenge.deckName.trim().toLowerCase();
                      const deckMatch = decks.find((deck) => deck.name.trim().toLowerCase() === normalizedDeckName);
                      if (!deckMatch) {
                        Alert.alert('Deck Not Found', 'You need this deck to accept the challenge. Check the community marketplace.');
                        return;
                      }

                      router.push(questSessionHref({
                        settings: serializeQuestSettings({
                          deckId: deckMatch.id,
                          mode: 'test',
                          runLength: challenge.questionIds.length >= 20 ? 20 : challenge.questionIds.length >= 10 ? 10 : 5,
                          timerSeconds: 0,
                          focusWeakOnly: false,
                          hintsEnabled: false,
                          explanationsEnabled: true,
                          secondChanceEnabled: false,
                        }),
                        drillCardIds: JSON.stringify(challenge.questionIds),
                        challengeId: challenge.id,
                        challengerScore: String(challenge.challengerScore),
                      }));
                    }}
                    activeOpacity={0.85}
                    testID="home-accept-challenge-button"
                  >
                    <Text style={[styles.challengeAcceptText, { color: theme.white }]}>Accept Challenge</Text>
                  </TouchableOpacity>
                  {incomingChallenges.length > 1 ? (
                    <Text style={[styles.challengeMoreText, { color: theme.textTertiary }]}>
                      +{incomingChallenges.length - 1} more challenge{incomingChallenges.length - 1 === 1 ? '' : 's'}
                    </Text>
                  ) : null}
                </View>
              ) : null}

              <View style={styles.smartActionsSection}>
                <TouchableOpacity
                  style={[
                    styles.exploreBanner,
                    {
                      width: Math.min(availableContentWidth - 48, 520),
                      alignSelf: 'center',
                      backgroundColor: isDark ? theme.homeCardBg : 'rgba(249, 251, 255, 0.98)',
                      shadowColor: actionShadowColor,
                      shadowOpacity: isDark ? 0.22 : 0.12,
                      shadowRadius: isDark ? 18 : 10,
                      elevation: isDark ? 8 : 5,
                      borderColor: communityBannerBorderColor,
                      minHeight: isCompactHomeLayout ? 94 : 98,
                    },
                  ]}
                  onPress={() => router.push(communityDeckAction.route)}
                  activeOpacity={0.9}
                  accessibilityLabel={communityDeckAction.accessibilityLabel}
                  accessibilityRole="button"
                  testID={communityDeckAction.testID}
                >
                  <LinearGradient
                    colors={communityBannerBackground}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={StyleSheet.absoluteFill}
                  />
                  <View pointerEvents="none" style={[styles.exploreBannerOrb, { backgroundColor: communityBannerDecorColor }]} />
                  <View
                    pointerEvents="none"
                    style={[
                      styles.exploreBannerOrb,
                      {
                        right: isCompactHomeLayout ? -18 : -2,
                        bottom: isCompactHomeLayout ? -36 : -28,
                        width: isCompactHomeLayout ? 96 : 112,
                        height: isCompactHomeLayout ? 96 : 112,
                        borderRadius: isCompactHomeLayout ? 48 : 56,
                        backgroundColor: communityBannerAccentColor,
                      },
                    ]}
                  />
                  <View
                    style={[
                      styles.exploreBannerContent,
                      {
                        paddingHorizontal: isCompactHomeLayout ? 18 : 20,
                        paddingVertical: isCompactHomeLayout ? 14 : 16,
                        gap: isCompactHomeLayout ? 12 : 14,
                        alignItems: 'center',
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.exploreBannerIconWrap,
                        {
                          backgroundColor: communityBannerIconSurface,
                          borderColor: communityBannerBorderColor,
                          width: isCompactHomeLayout ? 42 : 44,
                          height: isCompactHomeLayout ? 42 : 44,
                          borderRadius: isCompactHomeLayout ? 14 : 15,
                        },
                      ]}
                    >
                      <Compass color={communityBannerIconColor} size={isCompactHomeLayout ? 18 : 19} strokeWidth={2.35} />
                    </View>
                    <View style={[styles.exploreBannerCopy, { gap: isCompactHomeLayout ? 4 : 5 }]}>
                      <Text
                        style={[
                          styles.exploreBannerTitle,
                          {
                            color: communityBannerTitleColor,
                            fontSize: isCompactHomeLayout ? 15.5 : 16.5,
                            lineHeight: isCompactHomeLayout ? 19 : 20,
                          },
                        ]}
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        minimumFontScale={0.82}
                      >
                        {communityBannerTitle}
                      </Text>
                      <Text
                        style={[
                          styles.exploreBannerSubtitle,
                          {
                            color: communityBannerSubtitleColor,
                            fontSize: isCompactHomeLayout ? 11.5 : 12.5,
                            lineHeight: isCompactHomeLayout ? 15 : 17,
                          },
                        ]}
                        numberOfLines={2}
                      >
                        {communityBannerSubtitle}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              </View>
            </>
          )}
          </ResponsiveContainer>
        </ScrollView>

        <Modal
          visible={showReviewSheet && hasReviewPage}
          transparent
          animationType="none"
          onRequestClose={() => handleCloseReviewSheet()}
          testID="review-hub-sheet"
        >
          <View style={{ flex: 1, justifyContent: 'flex-end' }}>
            <Animated.View
              style={[
                StyleSheet.absoluteFillObject,
                styles.reviewSheetBackdrop,
                { opacity: reviewSheetBackdropOpacity },
              ]}
            >
              <TouchableOpacity
                style={StyleSheet.absoluteFill}
                activeOpacity={1}
                onPress={() => handleCloseReviewSheet()}
                testID="review-hub-backdrop"
              />
            </Animated.View>

            <Animated.View
              style={[
                styles.reviewSheetAvoidDismiss,
                { transform: [{ translateY: reviewSheetTranslateY }] },
              ]}
            >
              <View style={[styles.reviewSheet, { backgroundColor: isDark ? theme.background : theme.white, shadowColor: theme.homeShadow }]}> 
                <View style={styles.reviewSheetHandle} {...reviewSheetPanResponder.panHandlers}>
                  <View
                    style={[
                      styles.reviewSheetHandleBar,
                      { backgroundColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)' },
                    ]}
                  />
                </View>

                <Text style={[styles.reviewSheetTitle, { color: theme.text }]}>Review hub</Text>
                <Text style={[styles.reviewSheetSubtitle, { color: theme.textSecondary }]}> 
                  {reviewSummary
                    ? `${reviewTotalCount} cards are ready across ${reviewDeckCount} decks`
                    : `Nothing is due right now across ${decks.length} decks`}
                </Text>

                {topReviewDeck ? (
                  <View
                    style={{
                      marginBottom: 18,
                      borderRadius: 18,
                      paddingHorizontal: 16,
                      paddingVertical: 15,
                      backgroundColor: isDark ? 'rgba(99,102,241,0.12)' : 'rgba(99,102,241,0.08)',
                      borderWidth: 1,
                      borderColor: isDark ? 'rgba(129,140,248,0.12)' : 'rgba(99,102,241,0.08)',
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 12,
                    }}
                  >
                    <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: topReviewDeck.color }} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: theme.homeReviewAccent, fontSize: 11, fontWeight: '800' as const, textTransform: 'uppercase', letterSpacing: 0.7 }}>Up first</Text>
                      <Text style={{ color: theme.text, fontSize: 17, fontWeight: '800' as const, marginTop: 3 }} numberOfLines={1}>{topReviewDeck.name}</Text>
                    </View>
                    <View style={[styles.reviewSheetCountBadge, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.78)' }]}> 
                      <Text style={[styles.reviewSheetCountText, { color: theme.homeReviewCount }]}>{topReviewDeck.reviewCount}</Text>
                    </View>
                  </View>
                ) : null}

                <TouchableOpacity
                  style={[styles.reviewAllButton, { backgroundColor: theme.primary, shadowColor: theme.primaryDark }]}
                  onPress={reviewSummary ? handleStartReviewing : handleOpenDecksFromReviewSheet}
                  activeOpacity={0.88}
                  testID="review-all-button"
                >
                  {reviewSummary ? (
                    <RotateCcw color={theme.white} size={18} strokeWidth={2.5} />
                  ) : (
                    <BookOpen color={theme.white} size={18} strokeWidth={2.5} />
                  )}
                  <Text style={[styles.reviewAllButtonText, { color: theme.white }]}>{reviewSummary ? 'Start Reviewing' : 'Browse Decks'}</Text>
                </TouchableOpacity>

                <ScrollView
                  style={styles.reviewSheetList}
                  showsVerticalScrollIndicator={false}
                  bounces={false}
                >
                  {reviewSummary ? (
                    reviewSummary.deckSummaries.map((entry, index) => (
                      <TouchableOpacity
                        key={entry.deckId}
                        style={[
                          styles.reviewSheetRow,
                          index < reviewDeckCount - 1
                            ? [
                                styles.reviewSheetRowBorder,
                                { borderBottomColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' },
                              ]
                            : null,
                        ]}
                        onPress={() => handleLaunchDueDeck(entry.deckId)}
                        activeOpacity={0.82}
                        testID={`review-sheet-deck-${entry.deckId}`}
                      >
                        <View style={[styles.reviewSheetDot, { backgroundColor: entry.color }]} />
                        <View style={{ flex: 1, gap: 2 }}>
                          <Text style={[styles.reviewSheetDeckName, { color: theme.text }]} numberOfLines={1}>
                            {entry.name}
                          </Text>
                          <Text style={{ color: theme.textSecondary, fontSize: 12.5, fontWeight: '500' as const }}>
                            {entry.reviewCount} {entry.reviewCount === 1 ? 'card' : 'cards'} ready now
                          </Text>
                        </View>
                        <View
                          style={[
                            styles.reviewSheetCountBadge,
                            { backgroundColor: isDark ? 'rgba(99,102,241,0.15)' : 'rgba(99,102,241,0.1)' },
                          ]}
                        >
                          <Text style={[styles.reviewSheetCountText, { color: theme.homeDotActive }]}>
                            {entry.reviewCount}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    ))
                  ) : (
                    <View style={styles.reviewSheetEmptyState}>
                      <Text style={[styles.reviewSheetEmptyTitle, { color: theme.text }]}>Nothing needs review right now</Text>
                      <Text style={[styles.reviewSheetEmptyText, { color: theme.textSecondary }]}>Your decks are in a good spot. Open Decks to study ahead, or leave it alone until more cards come due.</Text>
                    </View>
                  )}
                </ScrollView>
              </View>
            </Animated.View>
          </View>
        </Modal>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create<{
  container: ViewStyle;
  safeArea: ViewStyle;
  scrollView: ViewStyle;
  scrollContent: ViewStyle;
  topGlow: ViewStyle;
  midGlow: ViewStyle;
  bottomGlow: ViewStyle;
  header: ViewStyle;
  profileButton: ViewStyle;
  profileGradient: ViewStyle;
  title: TextStyle;
  subtitle: TextStyle;
  statsCard: ViewStyle;
  statsCardFrame: ViewStyle;
  statsPager: ViewStyle;
  statsPagerTrack: ViewStyle;
  statsPage: ViewStyle;
  statsPageDots: ViewStyle;
  statsPageDotButton: ViewStyle;
  statsPageDot: ViewStyle;
  statItem: ViewStyle;
  levelText: TextStyle;
  statValue: TextStyle;
  statLabel: TextStyle;
  statDivider: ViewStyle;
  reviewPage: ViewStyle;
  reviewPageSummaryButton: ViewStyle;
  reviewPageHeader: ViewStyle;
  reviewIconWrap: ViewStyle;
  reviewPageText: ViewStyle;
  reviewTitle: TextStyle;
  reviewSubtitle: TextStyle;
  reviewChips: ViewStyle;
  reviewChip: ViewStyle;
  reviewChipDot: ViewStyle;
  reviewChipName: TextStyle;
  reviewChipCount: TextStyle;
  reviewSheetBackdrop: ViewStyle;
  reviewSheetAvoidDismiss: ViewStyle;
  reviewSheet: ViewStyle;
  reviewSheetHandle: ViewStyle;
  reviewSheetHandleBar: ViewStyle;
  reviewSheetTitle: TextStyle;
  reviewSheetSubtitle: TextStyle;
  reviewAllButton: ViewStyle;
  reviewAllButtonText: TextStyle;
  reviewSheetEmptyState: ViewStyle;
  reviewSheetEmptyTitle: TextStyle;
  reviewSheetEmptyText: TextStyle;
  reviewSheetList: ViewStyle;
  reviewSheetRow: ViewStyle;
  reviewSheetRowBorder: ViewStyle;
  reviewSheetDot: ViewStyle;
  reviewSheetDeckName: TextStyle;
  reviewSheetCountBadge: ViewStyle;
  reviewSheetCountText: TextStyle;
  actionsGrid: ViewStyle;
  actionCard: ViewStyle;
  actionCardMedium: ViewStyle;
  actionGradient: ViewStyle;
  actionContent: ViewStyle;
  actionIconSlot: ViewStyle;
  actionTitleMedium: TextStyle;
  challengeCard: ViewStyle;
  challengeCardHeader: ViewStyle;
  challengeCardTitle: TextStyle;
  challengeCardSubtitle: TextStyle;
  challengeAcceptButton: ViewStyle;
  challengeAcceptText: TextStyle;
  challengeMoreText: TextStyle;
  smartActionsSection: ViewStyle;
  smartActionsHeader: ViewStyle;
  smartActionsEyebrow: TextStyle;
  smartActionsLead: TextStyle;
  smartActionsScroll: ViewStyle;
  smartActionCard: ViewStyle;
  smartActionGradient: ViewStyle;
  smartActionOrb: ViewStyle;
  smartActionTopRow: ViewStyle;
  smartActionIconWrap: ViewStyle;
  smartActionIndex: TextStyle;
  smartActionTextWrap: ViewStyle;
  smartActionTitle: TextStyle;
  smartActionSubtitle: TextStyle;
  exploreBanner: ViewStyle;
  exploreBannerOrb: ViewStyle;
  exploreBannerContent: ViewStyle;
  exploreBannerCopy: ViewStyle;
  exploreBannerBadge: ViewStyle;
  exploreBannerBadgeText: TextStyle;
  exploreBannerIconWrap: ViewStyle;
  exploreBannerTextWrap: ViewStyle;
  exploreBannerTitle: TextStyle;
  exploreBannerSubtitle: TextStyle;
  exploreBannerCta: ViewStyle;
  exploreBannerCtaText: TextStyle;
  decksSection: ViewStyle;
  sectionTitle: TextStyle;
  decksScroll: ViewStyle;
  quickStartEmptyState: ViewStyle;
  quickStartEmptyTitle: TextStyle;
  quickStartEmptySubtitle: TextStyle;
  quickStartEmptyButton: ViewStyle;
  quickStartEmptyButtonText: TextStyle;
  deckCard: ViewStyle;
  deckCardFrame: ViewStyle;
  deckColorStrip: ViewStyle;
  deckContent: ViewStyle;
  deckName: TextStyle;
  deckCards: TextStyle;
  deckMiniBar: ViewStyle;
  deckMiniBarFill: ViewStyle;
}>({
  container: {
    flex: 1,
    backgroundColor: '#081120',
  },
  safeArea: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 26,
  },
  topGlow: {
    position: 'absolute',
    top: -92,
    right: -126,
    width: 252,
    height: 252,
    borderRadius: 126,
  },
  midGlow: {
    position: 'absolute',
    top: 566,
    left: -172,
    width: 288,
    height: 288,
    borderRadius: 144,
  },
  bottomGlow: {
    position: 'absolute',
    bottom: -98,
    right: -118,
    width: 228,
    height: 228,
    borderRadius: 114,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 22,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  profileButton: {
    width: 52,
    height: 52,
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 6,
  },
  profileGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 44,
    fontWeight: '800' as const,
    marginBottom: 3,
    letterSpacing: -1.1,
  },
  subtitle: {
    fontSize: 18,
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '600' as const,
  },
  statsCard: {
    marginHorizontal: 24,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 9,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 11,
    overflow: 'hidden',
  },
  statsCardFrame: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 24,
    borderWidth: 1,
  },
  statsPager: {
    overflow: 'hidden',
    alignSelf: 'center',
  },
  statsPagerTrack: {
    flexDirection: 'row',
  },
  statsPage: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingBottom: 2,
  },
  statsPageDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 5,
    paddingTop: 7,
    paddingBottom: 0,
  },
  statsPageDotButton: {
    paddingHorizontal: 4,
    paddingVertical: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsPageDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  levelText: {
    fontSize: 29,
    fontWeight: '800' as const,
    marginBottom: 4,
    letterSpacing: -0.7,
    transform: [{ translateY: 4 }],
  },
  statValue: {
    fontSize: 32,
    fontWeight: '800' as const,
    marginBottom: 4,
    letterSpacing: -0.8,
  },
  statLabel: {
    fontSize: 12.5,
    fontWeight: '700' as const,
    textAlign: 'center',
    letterSpacing: 0.08,
  },
  rankLabelWrap: {
    minHeight: 30,
    justifyContent: 'center',
  },
  rankLabel: {
    paddingHorizontal: 4,
    lineHeight: 15,
  },
  statDivider: {
    width: 1,
    height: 56,
  },
  reviewPage: {
    justifyContent: 'center',
    paddingBottom: 2,
    gap: 7,
  },
  reviewPageSummaryButton: {
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  reviewPageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  reviewIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewPageText: {
    flex: 1,
    gap: 2,
  },
  reviewTitle: {
    fontSize: 15,
    lineHeight: 18,
    fontWeight: '800' as const,
    letterSpacing: -0.3,
  },
  reviewSubtitle: {
    fontSize: 11.5,
    lineHeight: 15,
    fontWeight: '600' as const,
  },
  reviewChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
  },
  reviewChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 7,
  },
  reviewChipDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  reviewChipName: {
    fontSize: 10.5,
    fontWeight: '700' as const,
    maxWidth: 64,
  },
  reviewChipCount: {
    fontSize: 10.5,
    fontWeight: '700' as const,
  },
  reviewSheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.54)',
    justifyContent: 'flex-end',
  },
  reviewSheetAvoidDismiss: {
    maxHeight: '74%',
  },
  reviewSheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 40,
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 18,
  },
  reviewSheetHandle: {
    alignItems: 'center',
    marginBottom: 16,
  },
  reviewSheetHandleBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
  },
  reviewSheetTitle: {
    fontSize: 24,
    fontWeight: '800' as const,
    marginBottom: 4,
    letterSpacing: -0.55,
  },
  reviewSheetSubtitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    marginBottom: 18,
    lineHeight: 19,
  },
  reviewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    height: 54,
    borderRadius: 18,
    marginBottom: 18,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.24,
    shadowRadius: 18,
    elevation: 8,
  },
  reviewAllButtonText: {
    fontSize: 16,
    fontWeight: '800' as const,
  },
  reviewSheetEmptyState: {
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: 'rgba(99,102,241,0.08)',
    gap: 8,
  },
  reviewSheetEmptyTitle: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '800' as const,
  },
  reviewSheetEmptyText: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '500' as const,
  },
  reviewSheetList: {
    maxHeight: 300,
  },
  reviewSheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    gap: 12,
  },
  reviewSheetRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  reviewSheetDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  reviewSheetDeckName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600' as const,
  },
  reviewSheetCountBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  reviewSheetCountText: {
    fontSize: 14,
    fontWeight: '800' as const,
  },
  actionsGrid: {
    paddingHorizontal: 24,
    marginTop: 28,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  actionCard: {
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 9,
  },
  actionCardMedium: {
    height: 148,
  },
  actionGradient: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 18,
  },
  actionContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionIconSlot: {
    width: 54,
    height: 54,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  actionTitleMedium: {
    fontSize: 18.5,
    fontWeight: '800' as const,
    marginTop: 0,
    textAlign: 'center',
    letterSpacing: -0.42,
  },
  challengeCard: {
    marginTop: 22,
    marginHorizontal: 24,
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
  },
  challengeCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  challengeCardTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '800' as const,
  },
  challengeCardSubtitle: {
    fontSize: 14,
    fontWeight: '500' as const,
    marginBottom: 12,
  },
  challengeAcceptButton: {
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  challengeAcceptText: {
    fontSize: 15,
    fontWeight: '800' as const,
  },
  challengeMoreText: {
    fontSize: 12,
    fontWeight: '600' as const,
    marginTop: 8,
    textAlign: 'center',
  },
  smartActionsSection: {
    marginTop: 22,
  },
  smartActionsHeader: {
    paddingHorizontal: 24,
    marginBottom: 14,
  },
  smartActionsEyebrow: {
    fontSize: 11,
    fontWeight: '800' as const,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  smartActionsLead: {
    fontSize: 22,
    fontWeight: '800' as const,
    letterSpacing: -0.5,
  },
  smartActionsScroll: {
    paddingHorizontal: 24,
    paddingBottom: 4,
  },
  smartActionCard: {
    minHeight: 118,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    shadowOffset: { width: 0, height: 12 },
  },
  smartActionGradient: {
    flex: 1,
    paddingHorizontal: 18,
    paddingVertical: 16,
    justifyContent: 'space-between',
  },
  smartActionOrb: {
    position: 'absolute',
    right: -24,
    top: -18,
    width: 94,
    height: 94,
    borderRadius: 47,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  smartActionTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  smartActionIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
  },
  smartActionIndex: {
    fontSize: 11,
    fontWeight: '800' as const,
    letterSpacing: 1.1,
  },
  smartActionTextWrap: {
    gap: 6,
  },
  smartActionTitle: {
    fontSize: 18,
    fontWeight: '800' as const,
    lineHeight: 22,
    letterSpacing: -0.36,
  },
  smartActionSubtitle: {
    fontSize: 12.5,
    fontWeight: '600' as const,
    lineHeight: 17,
  },
  exploreBanner: {
    marginTop: 0,
    marginHorizontal: 24,
    minHeight: 98,
    borderRadius: 24,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
  },
  exploreBannerOrb: {
    position: 'absolute',
    right: -18,
    bottom: -44,
    width: 144,
    height: 144,
    borderRadius: 72,
  },
  exploreBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  exploreBannerCopy: {
    flex: 1,
    gap: 6,
  },
  exploreBannerBadge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  exploreBannerBadgeText: {
    fontSize: 10.5,
    fontWeight: '800' as const,
    letterSpacing: 1.1,
  },
  exploreBannerIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  exploreBannerTextWrap: {
    gap: 4,
  },
  exploreBannerTitle: {
    fontSize: 16.5,
    fontWeight: '800' as const,
    letterSpacing: -0.32,
  },
  exploreBannerSubtitle: {
    fontSize: 12.5,
    fontWeight: '700' as const,
    lineHeight: 17,
  },
  exploreBannerCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginLeft: 8,
  },
  exploreBannerCtaText: {
    fontSize: 13,
    fontWeight: '800' as const,
    letterSpacing: -0.12,
  },
  decksSection: {
    marginTop: 38,
    paddingHorizontal: 24,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '800' as const,
    marginBottom: 16,
    letterSpacing: -0.5,
  },
  decksScroll: {
    gap: 14,
    paddingRight: 24,
    paddingBottom: 4,
  },
  quickStartEmptyState: {
    alignItems: 'flex-start',
    padding: 20,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 6,
  },
  quickStartEmptyTitle: {
    fontSize: 18,
    fontWeight: '800' as const,
    marginBottom: 8,
  },
  quickStartEmptySubtitle: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500' as const,
    color: 'rgba(255, 255, 255, 0.82)',
    marginBottom: 16,
  },
  quickStartEmptyButton: {
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  quickStartEmptyButtonText: {
    fontSize: 14,
    fontWeight: '800' as const,
  },
  deckCard: {
    height: 124,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 5,
  },
  deckCardFrame: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 20,
    borderWidth: 1,
  },
  deckColorStrip: {
    height: 5,
    width: '100%',
  },
  deckContent: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 14,
    justifyContent: 'flex-start',
  },
  deckName: {
    fontSize: 15.5,
    fontWeight: '800' as const,
    marginBottom: 5,
    lineHeight: 20,
    letterSpacing: -0.24,
  },
  deckCards: {
    fontSize: 12,
    fontWeight: '700' as const,
    letterSpacing: 0.08,
  },
  deckMiniBar: {
    height: 4,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginTop: 10,
    overflow: 'hidden',
  },
  deckMiniBarFill: {
    height: '100%',
    borderRadius: 3,
  },
});
