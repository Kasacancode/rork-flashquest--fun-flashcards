import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, type Href } from 'expo-router';
import { Trophy, BookOpen, RotateCcw, Swords, Target, User } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Animated,
  RefreshControl,
  PanResponder,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';

import { SkeletonBox, SkeletonCard } from '@/components/SkeletonLoader';
import { useFlashQuest } from '@/context/FlashQuestContext';
import { usePerformance } from '@/context/PerformanceContext';
import { useTheme } from '@/context/ThemeContext';
import { computeLevel, getLevelBandPalette, getLevelEntry } from '@/utils/levels';
import { computeDeckMastery, getLiveCardStats, isCardDueForReview } from '@/utils/mastery';
import { studyHref } from '@/utils/routes';

const { width } = Dimensions.get('window');
const quickStartSectionPadding = 24;
const quickStartCardGap = 14;
const quickStartCardWidth = Math.max(
  152,
  Math.min(166, Math.floor((width - quickStartSectionPadding * 2 - quickStartCardGap - 2) / 2)),
);
const statsCardInnerWidth = width - 80;

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
  const { stats, decks, isLoading } = useFlashQuest();
  const { performance, getWeakCards } = usePerformance();
  const { theme, isDark } = useTheme();
  const streakAnim = useRef<Animated.Value>(new Animated.Value(0)).current;
  const cardsAnim = useRef<Animated.Value>(new Animated.Value(0)).current;
  const statsPagerTranslateX = useRef<Animated.Value>(new Animated.Value(0)).current;
  const statsPagerDragStartX = useRef<number>(0);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [statsPage, setStatsPage] = useState<number>(0);
  const level = useMemo(() => computeLevel(stats.totalScore), [stats.totalScore]);
  const levelEntry = useMemo(() => getLevelEntry(level), [level]);
  const levelPalette = useMemo(() => getLevelBandPalette(level, isDark), [level, isDark]);

  const backgroundGradient = useMemo(
    () => (
      isDark
        ? ['#08111f', '#0c1730', '#09111d'] as const
        : ['#7490f6', '#8b87ef', '#b193ec', '#d8aaed'] as const
    ),
    [isDark],
  );
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
  const titleColor = isDark ? '#f8fbff' : '#ffffff';
  const subtitleColor = isDark ? 'rgba(229, 236, 248, 0.84)' : 'rgba(241, 236, 252, 0.88)';
  const sectionTitleColor = isDark ? '#f8fafc' : 'rgba(255, 255, 255, 0.985)';
  const topGlowColor = isDark ? 'rgba(88, 97, 215, 0.075)' : 'rgba(97, 131, 255, 0.24)';
  const midGlowColor = isDark ? 'rgba(44, 166, 154, 0.038)' : 'rgba(133, 114, 237, 0.08)';
  const bottomGlowColor = isDark ? 'rgba(96, 72, 191, 0.035)' : 'rgba(220, 160, 228, 0.22)';
  const profileSurface = isDark ? 'rgba(29, 38, 57, 0.92)' : 'rgba(255, 255, 255, 0.94)';
  const profileBorderColor = isDark ? 'rgba(148, 163, 184, 0.18)' : 'rgba(148, 163, 184, 0.18)';
  const profileGradient = isDark
    ? ['rgba(40, 52, 74, 0.98)', 'rgba(31, 41, 60, 0.98)'] as const
    : ['rgba(255, 255, 255, 0.98)', 'rgba(245, 248, 252, 0.98)'] as const;
  const profileIconColor = isDark ? '#f8fafc' : '#334155';
  const statsCardGradient = isDark
    ? ['rgba(18, 28, 45, 0.99)', 'rgba(14, 22, 37, 0.99)'] as const
    : ['rgba(255, 255, 255, 0.97)', 'rgba(248, 245, 255, 0.97)'] as const;
  const statsBorderColor = isDark ? 'rgba(110, 130, 162, 0.18)' : 'rgba(148, 163, 184, 0.16)';
  const statsDividerColor = isDark ? 'rgba(112, 132, 163, 0.24)' : 'rgba(148, 163, 184, 0.22)';
  const statsShadowColor = isDark ? '#020617' : '#94a3b8';
  const statsValueColor = isDark ? '#f8fafc' : '#13233f';
  const statsLabelColor = isDark ? 'rgba(203, 213, 225, 0.86)' : 'rgba(71, 85, 105, 0.86)';
  const statsLevelColor = isDark && levelPalette.band === 'early'
    ? levelPalette.badgeGradient[0]
    : levelPalette.badgeGradient[1];
  const actionShadowColor = isDark ? '#020617' : '#94a3b8';
  const actionBorderColor = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(15, 23, 42, 0.1)';
  const deckCardSurface = isDark ? 'rgba(9, 17, 31, 0.98)' : 'rgba(255, 255, 255, 0.99)';
  const deckCardGradient = isDark
    ? ['rgba(9, 18, 31, 0.995)', 'rgba(13, 21, 36, 0.995)'] as const
    : ['rgba(255, 255, 255, 0.97)', 'rgba(250, 247, 255, 0.97)'] as const;
  const deckCardBorderColor = isDark ? 'rgba(124, 140, 168, 0.14)' : 'rgba(148, 163, 184, 0.14)';
  const deckCardShadowColor = isDark ? '#020617' : '#94a3b8';
  const deckTrackColor = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(148, 163, 184, 0.16)';
  const emptyStateSurface = isDark ? 'rgba(10, 17, 31, 0.96)' : 'rgba(255, 255, 255, 0.98)';
  const emptyStateBorderColor = isDark ? 'rgba(124, 140, 168, 0.14)' : 'rgba(148, 163, 184, 0.14)';
  const homeActionGradients = useMemo(
    () => ({
      arena: isDark ? ['#ff6d10', '#ff6208'] as const : ['#ef7721', '#e46512'] as const,
      quest: isDark ? ['#935ff7', '#7d45eb'] as const : ['#8e63ef', '#7648df'] as const,
      stats: isDark ? ['#12b985', '#0ea678'] as const : ['#18b382', '#109f76'] as const,
      decks: isDark ? ['#6870f1', '#565ee7'] as const : ['#6870eb', '#5860df'] as const,
    }),
    [isDark],
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
        recs.push({ deckId: deck.id, name: deck.name, color: deck.color, message: 'Not started yet — try it!', priority: 10 });
        continue;
      }
      if (accuracy !== null && accuracy < 0.6) {
        recs.push({ deckId: deck.id, name: deck.name, color: deck.color, message: `${Math.round(accuracy * 100)}% accuracy — needs practice`, priority: 8 });
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
        recs.push({ deckId: deck.id, name: deck.name, color: deck.color, message: `${Math.round(accuracy * 100)}% — keep improving`, priority: 3 });
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

  const hasReviewPage = reviewSummary !== null;

  const handleOpenProfile = useCallback(() => {
    router.push('/profile' as Href);
  }, [router]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await queryClient.refetchQueries();
    setRefreshing(false);
  }, [queryClient]);

  const animateStatsPagerTo = useCallback((page: number) => {
    Animated.spring(statsPagerTranslateX, {
      toValue: hasReviewPage ? -page * statsCardInnerWidth : 0,
      useNativeDriver: true,
      tension: 90,
      friction: 10,
    }).start();
  }, [hasReviewPage, statsPagerTranslateX]);

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
    [animateStatsPagerTo, handleSetStatsPage, hasReviewPage, statsPage, statsPagerTranslateX],
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
            <Text style={styles.actionTitleMedium}>{title}</Text>
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
              colors={['#667eea']}
            />
          }
          testID="home-scroll-view"
        >
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
                    backgroundColor: isDark ? '#111b2f' : 'rgba(255, 255, 255, 0.99)',
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
                  style={styles.statsPager}
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
                    <View style={[styles.statsPage, { width: statsCardInnerWidth }]}>

                    <View style={styles.statItem}>
                      <Text
                        style={[styles.levelText, { color: statsLevelColor }]}
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        minimumFontScale={0.84}
                      >
                        LV {level}
                      </Text>
                      <Text
                        style={[styles.statLabel, styles.rankLabel, { color: statsLabelColor }]}
                        numberOfLines={2}
                        adjustsFontSizeToFit
                        minimumFontScale={0.8}
                      >
                        {levelEntry.title}
                      </Text>
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
                    <TouchableOpacity
                      style={[styles.reviewPage, { width: statsCardInnerWidth }]}
                      onPress={() => router.push(studyHref(reviewSummary!.deckSummaries[0].deckId))}
                      activeOpacity={0.85}
                      testID="stats-card-review-page"
                    >
                      <View style={styles.reviewPageHeader}>
                        <View style={[styles.reviewIconWrap, { backgroundColor: isDark ? 'rgba(99, 102, 241, 0.15)' : 'rgba(99, 102, 241, 0.1)' }]}>
                          <RotateCcw color={isDark ? '#a5b4fc' : '#6366f1'} size={16} strokeWidth={2.4} />
                        </View>
                        <View style={styles.reviewPageText}>
                          <Text style={[styles.reviewTitle, { color: statsValueColor }]}>
                            {reviewSummary!.totalReviewCount} {reviewSummary!.totalReviewCount === 1 ? 'card' : 'cards'} ready for review
                          </Text>
                          <Text style={[styles.reviewSubtitle, { color: statsLabelColor }]}> 
                            across {reviewSummary!.deckSummaries.length} {reviewSummary!.deckSummaries.length === 1 ? 'deck' : 'decks'}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.reviewChips}>
                        {reviewSummary!.deckSummaries.slice(0, 3).map((entry) => (
                          <TouchableOpacity
                            key={entry.deckId}
                            style={[styles.reviewChip, { backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)' }]}
                            onPress={(event) => {
                              event.stopPropagation();
                              router.push(studyHref(entry.deckId));
                            }}
                            activeOpacity={0.75}
                            testID={`review-chip-${entry.deckId}`}
                          >
                            <View style={[styles.reviewChipDot, { backgroundColor: entry.color }]} />
                            <Text style={[styles.reviewChipName, { color: statsValueColor }]} numberOfLines={1}>{entry.name}</Text>
                            <Text style={[styles.reviewChipCount, { color: statsLabelColor }]}>{entry.reviewCount}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </TouchableOpacity>
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
                      <View style={[styles.statsPageDot, { backgroundColor: statsPage === 0 ? (isDark ? '#a5b4fc' : '#6366f1') : (isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)') }]} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.statsPageDotButton}
                      onPress={() => handleSetStatsPage(1)}
                      activeOpacity={0.8}
                      hitSlop={8}
                      testID="stats-page-dot-1"
                    >
                      <View style={[styles.statsPageDot, { backgroundColor: statsPage === 1 ? (isDark ? '#a5b4fc' : '#6366f1') : (isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)') }]} />
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              <View style={styles.actionsGrid}>
                {renderActionCard({
                  route: '/arena' as Href,
                  colors: homeActionGradients.arena,
                  title: 'Battle',
                  icon: <Swords color="#fff" size={40} strokeWidth={2.15} />,
                  testID: 'home-action-battle',
                })}
                {renderActionCard({
                  route: '/quest' as Href,
                  colors: homeActionGradients.quest,
                  title: 'Quest',
                  icon: <Target color="#fff" size={40} strokeWidth={2.15} />,
                  testID: 'home-action-quest',
                })}
                {renderActionCard({
                  route: '/stats' as Href,
                  colors: homeActionGradients.stats,
                  title: 'Stats',
                  icon: <Trophy color="#fff" size={40} strokeWidth={2.15} />,
                  testID: 'home-action-stats',
                })}
                {renderActionCard({
                  route: '/decks' as Href,
                  colors: homeActionGradients.decks,
                  title: 'Decks',
                  icon: <BookOpen color="#fff" size={40} strokeWidth={2.15} />,
                  testID: 'home-action-decks',
                })}
              </View>

              <View style={styles.decksSection}>
                <Text style={[styles.sectionTitle, { color: sectionTitleColor }]}>
              {'Quick Start'}
            </Text>
            {decks.length === 0 ? (
              <View
                style={[
                  styles.quickStartEmptyState,
                  {
                    backgroundColor: emptyStateSurface,
                    borderColor: emptyStateBorderColor,
                    shadowColor: deckCardShadowColor,
                  },
                ]}
              >
                <Text style={[styles.quickStartEmptyTitle, { color: theme.text }]}>No decks yet</Text>
                <Text style={[styles.quickStartEmptySubtitle, { color: theme.textSecondary }]}>Create a deck to see it here.</Text>
                <TouchableOpacity
                  style={[styles.quickStartEmptyButton, { backgroundColor: theme.primary }]}
                  onPress={() => router.push('/decks' as Href)}
                  activeOpacity={0.8}
                  testID="home-empty-create-deck"
                >
                  <Text style={styles.quickStartEmptyButtonText}>Create Deck</Text>
                </TouchableOpacity>
              </View>
            ) : recommendations.length > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.decksScroll}
                testID="home-recommendations-scroll"
              >
                {recommendations.map((rec) => {
                  const recDeck = decks.find((d) => d.id === rec.deckId);
                  const recMastery = recDeck ? computeDeckMastery(recDeck.flashcards, performance.cardStatsById) : null;
                  const recPct = recMastery && recMastery.total > 0 ? Math.round((recMastery.mastered / recMastery.total) * 100) : 0;

                  return (
                    <TouchableOpacity
                      key={rec.deckId}
                      style={[
                        styles.deckCard,
                        {
                          backgroundColor: deckCardSurface,
                          borderWidth: 1,
                          borderColor: deckCardBorderColor,
                          shadowColor: deckCardShadowColor,
                          shadowOpacity: isDark ? 0.18 : 0.14,
                          shadowRadius: isDark ? 14 : 12,
                          elevation: isDark ? 6 : 5,
                        },
                      ]}
                      onPress={() => router.push({ pathname: '/deck-hub', params: { deckId: rec.deckId } } as Href)}
                      activeOpacity={0.9}
                      testID={`home-recommendation-${rec.deckId}`}
                    >
                      <LinearGradient
                        colors={deckCardGradient}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={StyleSheet.absoluteFill}
                      />
                      <View style={[styles.deckCardFrame, { borderColor: deckCardBorderColor }]} />
                      <View style={[styles.deckColorStrip, { backgroundColor: rec.color }]} />
                      <View style={styles.deckContent}>
                        <Text style={[styles.deckName, { color: theme.text }]} numberOfLines={2}>{rec.name}</Text>
                        <Text style={[styles.deckCards, { color: theme.textSecondary }]}>{recDeck?.flashcards.length ?? 0} cards · {recPct}%</Text>
                        {recMastery && recMastery.total > 0 ? (
                          <View style={[styles.deckMiniBar, { backgroundColor: deckTrackColor }]}>
                            <View style={[styles.deckMiniBarFill, { width: `${recPct}%`, backgroundColor: rec.color }]} />
                          </View>
                        ) : null}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.decksScroll}
                testID="home-quick-start-scroll"
              >
                {decks.slice(0, 5).map((deck) => {
                  const deckMastery = computeDeckMastery(deck.flashcards, performance.cardStatsById);
                  const deckPct = deckMastery.total > 0 ? Math.round((deckMastery.mastered / deckMastery.total) * 100) : 0;

                  return (
                    <TouchableOpacity
                      key={deck.id}
                      style={[
                        styles.deckCard,
                        {
                          backgroundColor: deckCardSurface,
                          borderWidth: 1,
                          borderColor: deckCardBorderColor,
                          shadowColor: deckCardShadowColor,
                          shadowOpacity: isDark ? 0.18 : 0.14,
                          shadowRadius: isDark ? 14 : 12,
                          elevation: isDark ? 6 : 5,
                        },
                      ]}
                      onPress={() => router.push({ pathname: '/deck-hub', params: { deckId: deck.id } } as Href)}
                      activeOpacity={0.9}
                      testID={`home-quick-start-${deck.id}`}
                    >
                      <LinearGradient
                        colors={deckCardGradient}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={StyleSheet.absoluteFill}
                      />
                      <View style={[styles.deckCardFrame, { borderColor: deckCardBorderColor }]} />
                      <View style={[styles.deckColorStrip, { backgroundColor: deck.color }]} />
                      <View style={styles.deckContent}>
                        <Text style={[styles.deckName, { color: theme.text }]} numberOfLines={2}>
                          {deck.name}
                        </Text>
                        <Text style={[styles.deckCards, { color: theme.textSecondary }]}>{deck.flashcards.length} cards · {deckPct}%</Text>
                        {deckMastery.total > 0 ? (
                          <View style={[styles.deckMiniBar, { backgroundColor: deckTrackColor }]}>
                            <View style={[styles.deckMiniBarFill, { width: `${deckPct}%`, backgroundColor: deck.color }]} />
                          </View>
                        ) : null}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}
              </View>
            </>
          )}
        </ScrollView>
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
  actionsGrid: ViewStyle;
  actionCard: ViewStyle;
  actionCardMedium: ViewStyle;
  actionGradient: ViewStyle;
  actionContent: ViewStyle;
  actionIconSlot: ViewStyle;
  actionTitleMedium: TextStyle;
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
    paddingBottom: 50,
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
    color: '#fff',
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
    width: statsCardInnerWidth,
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
  },
  levelText: {
    fontSize: 29,
    fontWeight: '800' as const,
    marginBottom: 4,
    letterSpacing: -0.7,
  },
  statValue: {
    fontSize: 32,
    fontWeight: '800' as const,
    color: '#667eea',
    marginBottom: 4,
    letterSpacing: -0.8,
  },
  statLabel: {
    fontSize: 12.5,
    color: '#666',
    fontWeight: '700' as const,
    textAlign: 'center',
    letterSpacing: 0.08,
  },
  rankLabel: {
    minHeight: 30,
    paddingHorizontal: 4,
    lineHeight: 15,
  },
  statDivider: {
    width: 1,
    height: 56,
    backgroundColor: '#e0e0e0',
  },
  reviewPage: {
    justifyContent: 'center',
    paddingBottom: 2,
    gap: 9,
  },
  reviewPageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  reviewIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewPageText: {
    flex: 1,
  },
  reviewTitle: {
    fontSize: 14,
    fontWeight: '700' as const,
  },
  reviewSubtitle: {
    fontSize: 11,
    fontWeight: '500' as const,
    marginTop: 1,
  },
  reviewChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  reviewChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 7,
  },
  reviewChipDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  reviewChipName: {
    fontSize: 11,
    fontWeight: '600' as const,
    maxWidth: 72,
  },
  reviewChipCount: {
    fontSize: 11,
    fontWeight: '700' as const,
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
    width: (width - 64) / 2,
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
    color: '#fff',
    marginTop: 0,
    textAlign: 'center',
    letterSpacing: -0.42,
  },
  decksSection: {
    marginTop: 38,
    paddingHorizontal: 24,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '800' as const,
    color: '#fff',
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
    color: '#fff',
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
    color: '#fff',
  },
  deckCard: {
    width: quickStartCardWidth,
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
    color: '#333',
    marginBottom: 5,
    lineHeight: 20,
    letterSpacing: -0.24,
  },
  deckCards: {
    fontSize: 12,
    color: '#666',
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
