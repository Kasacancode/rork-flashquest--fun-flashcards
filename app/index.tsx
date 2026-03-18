import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, type Href } from 'expo-router';
import {
  BookOpen,
  ChevronRight,
  Sparkles,
  Swords,
  Target,
  Trophy,
  User,
} from 'lucide-react-native';
import React, { useCallback, useMemo, useRef } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { type Theme } from '@/constants/colors';
import { useDeveloperAccess } from '@/context/DeveloperAccessContext';
import { useFlashQuest } from '@/context/FlashQuestContext';
import { useTheme } from '@/context/ThemeContext';
import type { Deck, UserProgress } from '@/types/flashcard';
import { logger } from '@/utils/logger';

type IconComponent = React.ComponentType<{
  color?: string;
  size?: number;
  strokeWidth?: number;
}>;

type GradientPair = readonly [string, string];
type GradientTriplet = readonly [string, string, string];

interface HomeAction {
  id: string;
  label: string;
  title: string;
  description: string;
  route: Href;
  icon: IconComponent;
  gradient: GradientTriplet;
}

interface FeaturedDeckItem {
  deck: Deck;
  reviewedCount: number;
  totalCards: number;
  progressRatio: number;
  statusLabel: string;
  lastStudied: number;
  sortIndex: number;
}

function formatMetric(value: number): string {
  return value.toLocaleString();
}

function withAlphaColor(color: string, alpha: number): string {
  const normalizedAlpha = Math.max(0, Math.min(1, alpha));

  if (!color.startsWith('#')) {
    return color;
  }

  let normalizedHex = color.slice(1);

  if (normalizedHex.length === 3) {
    normalizedHex = normalizedHex
      .split('')
      .map((segment) => segment + segment)
      .join('');
  }

  if (normalizedHex.length !== 6) {
    return color;
  }

  const red = Number.parseInt(normalizedHex.slice(0, 2), 16);
  const green = Number.parseInt(normalizedHex.slice(2, 4), 16);
  const blue = Number.parseInt(normalizedHex.slice(4, 6), 16);

  if ([red, green, blue].some((channel) => Number.isNaN(channel))) {
    return color;
  }

  return `rgba(${red}, ${green}, ${blue}, ${normalizedAlpha})`;
}

function createProgressMap(progressEntries: readonly UserProgress[]): Map<string, UserProgress> {
  return new Map(progressEntries.map((entry) => [entry.deckId, entry]));
}

function createStyles(theme: Theme, isDark: boolean, width: number) {
  const horizontalPadding = 24;
  const gridGap = 14;
  const actionCardWidth = Math.max(150, Math.floor((width - horizontalPadding * 2 - gridGap) / 2));
  const deckCardWidth = Math.min(Math.max(width * 0.74, 230), 280);

  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    safeArea: {
      flex: 1,
    },
    backgroundLayer: {
      ...StyleSheet.absoluteFillObject,
    },
    orbPrimary: {
      position: 'absolute',
      width: 240,
      height: 240,
      borderRadius: 120,
      top: 96,
      right: -40,
      opacity: isDark ? 0.22 : 0.18,
      transform: [{ scaleX: 1.1 }, { scaleY: 1.25 }],
    },
    orbSecondary: {
      position: 'absolute',
      width: 280,
      height: 280,
      borderRadius: 140,
      bottom: 40,
      left: -110,
      opacity: isDark ? 0.2 : 0.15,
      transform: [{ rotate: '18deg' }],
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: horizontalPadding,
      paddingTop: 14,
      paddingBottom: 40,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      marginBottom: 22,
    },
    headerTextBlock: {
      flex: 1,
      paddingRight: 16,
    },
    headerEyebrow: {
      fontSize: 13,
      fontWeight: '800',
      letterSpacing: 2.6,
      textTransform: 'uppercase',
      color: withAlphaColor(theme.white, isDark ? 0.75 : 0.68),
      marginBottom: 10,
    },
    headerTitle: {
      fontSize: 38,
      lineHeight: 42,
      fontWeight: '900',
      letterSpacing: -1.6,
      color: theme.white,
      marginBottom: 8,
    },
    headerSubtitle: {
      fontSize: 16,
      lineHeight: 23,
      color: isDark ? '#CBD5E1' : 'rgba(255, 255, 255, 0.88)',
      maxWidth: 260,
      fontWeight: '600',
    },
    profileButton: {
      borderRadius: 22,
    },
    profileButtonPressed: {
      transform: [{ scale: 0.97 }],
    },
    profileButtonShell: {
      width: 62,
      height: 62,
      borderRadius: 22,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.2)',
      shadowColor: '#020617',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: isDark ? 0.28 : 0.16,
      shadowRadius: 18,
      elevation: 10,
    },
    profileButtonGradient: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    heroCardShell: {
      borderRadius: 32,
      overflow: 'hidden',
      marginBottom: 22,
      shadowColor: '#020617',
      shadowOffset: { width: 0, height: 14 },
      shadowOpacity: isDark ? 0.34 : 0.18,
      shadowRadius: 26,
      elevation: 14,
    },
    heroCard: {
      borderRadius: 32,
      padding: 22,
      minHeight: 214,
      overflow: 'hidden',
    },
    heroGlow: {
      position: 'absolute',
      width: 210,
      height: 210,
      borderRadius: 105,
      backgroundColor: 'rgba(255, 255, 255, 0.12)',
      top: -40,
      right: -30,
      transform: [{ scaleX: 1.3 }, { scaleY: 1.1 }],
    },
    heroTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 18,
    },
    heroBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: 'rgba(255, 255, 255, 0.16)',
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    heroBadgeText: {
      color: '#F8FAFC',
      fontSize: 12,
      fontWeight: '800',
      letterSpacing: 1.2,
      textTransform: 'uppercase',
    },
    heroStatus: {
      color: '#FFF7ED',
      fontSize: 13,
      fontWeight: '700',
    },
    heroTitle: {
      color: '#FFFFFF',
      fontSize: 28,
      lineHeight: 34,
      fontWeight: '900',
      letterSpacing: -1.1,
      marginBottom: 10,
      maxWidth: 270,
    },
    heroDescription: {
      color: 'rgba(255, 255, 255, 0.88)',
      fontSize: 15,
      lineHeight: 22,
      fontWeight: '600',
      maxWidth: 280,
      marginBottom: 18,
    },
    heroMetaRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
      marginBottom: 18,
    },
    heroMetaPill: {
      borderRadius: 999,
      backgroundColor: 'rgba(15, 23, 42, 0.2)',
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.16)',
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    heroMetaText: {
      color: '#F8FAFC',
      fontSize: 12,
      fontWeight: '700',
    },
    heroStatsRow: {
      flexDirection: 'row',
      columnGap: 10,
    },
    heroStatPill: {
      flex: 1,
      borderRadius: 20,
      backgroundColor: 'rgba(15, 23, 42, 0.22)',
      paddingHorizontal: 14,
      paddingVertical: 14,
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.12)',
    },
    heroStatValue: {
      color: '#FFFFFF',
      fontSize: 22,
      lineHeight: 26,
      fontWeight: '900',
      marginBottom: 4,
      letterSpacing: -0.4,
    },
    heroStatLabel: {
      color: 'rgba(255, 255, 255, 0.82)',
      fontSize: 12,
      fontWeight: '700',
    },
    sectionHeader: {
      marginBottom: 14,
    },
    sectionHeaderRow: {
      marginTop: 8,
      marginBottom: 14,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    sectionEyebrow: {
      color: isDark ? '#A78BFA' : '#E9D5FF',
      fontSize: 12,
      fontWeight: '800',
      letterSpacing: 1.8,
      textTransform: 'uppercase',
      marginBottom: 6,
    },
    sectionTitle: {
      color: theme.white,
      fontSize: 26,
      lineHeight: 30,
      fontWeight: '800',
      letterSpacing: -0.9,
    },
    quickStartBadge: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: isDark ? 'rgba(15, 23, 42, 0.5)' : 'rgba(255, 255, 255, 0.12)',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(148, 163, 184, 0.2)' : 'rgba(255, 255, 255, 0.16)',
    },
    quickStartBadgeText: {
      color: isDark ? '#CBD5E1' : '#F8FAFC',
      fontSize: 12,
      fontWeight: '800',
      letterSpacing: 0.6,
      textTransform: 'uppercase',
    },
    actionsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      columnGap: gridGap,
      rowGap: gridGap,
      marginBottom: 26,
    },
    actionCard: {
      width: actionCardWidth,
      borderRadius: 28,
    },
    actionCardPressed: {
      transform: [{ scale: 0.985 }],
    },
    actionCardShell: {
      borderRadius: 28,
      overflow: 'hidden',
      shadowColor: '#020617',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: isDark ? 0.28 : 0.16,
      shadowRadius: 18,
      elevation: 10,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(148, 163, 184, 0.12)' : 'rgba(255, 255, 255, 0.16)',
    },
    actionCardSurface: {
      minHeight: 186,
      padding: 18,
      justifyContent: 'space-between',
    },
    actionIconBadge: {
      width: 58,
      height: 58,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#020617',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.18,
      shadowRadius: 14,
      elevation: 6,
    },
    actionTextWrap: {
      marginTop: 18,
    },
    actionLabel: {
      fontSize: 12,
      fontWeight: '800',
      letterSpacing: 1.5,
      textTransform: 'uppercase',
      marginBottom: 8,
    },
    actionTitle: {
      fontSize: 24,
      lineHeight: 28,
      fontWeight: '800',
      letterSpacing: -0.8,
      color: theme.text,
      marginBottom: 8,
    },
    actionDescription: {
      fontSize: 14,
      lineHeight: 20,
      fontWeight: '600',
      color: theme.textSecondary,
      minHeight: 40,
    },
    actionFooter: {
      marginTop: 18,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    actionFooterText: {
      fontSize: 13,
      fontWeight: '700',
      color: theme.textSecondary,
    },
    actionAccentBar: {
      height: 4,
      flex: 1,
      borderRadius: 999,
      marginRight: 12,
    },
    decksScrollContent: {
      paddingRight: horizontalPadding,
      columnGap: 14,
    },
    deckCard: {
      width: deckCardWidth,
      borderRadius: 28,
    },
    deckCardPressed: {
      transform: [{ scale: 0.985 }],
    },
    deckCardShell: {
      borderRadius: 28,
      overflow: 'hidden',
      shadowColor: '#020617',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: isDark ? 0.24 : 0.14,
      shadowRadius: 18,
      elevation: 9,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(148, 163, 184, 0.12)' : 'rgba(255, 255, 255, 0.14)',
    },
    deckCardSurface: {
      minHeight: 186,
      padding: 18,
      justifyContent: 'space-between',
    },
    deckTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 18,
      gap: 12,
    },
    deckStatusPill: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
      borderWidth: 1,
    },
    deckStatusText: {
      fontSize: 12,
      fontWeight: '800',
      letterSpacing: 0.7,
      textTransform: 'uppercase',
    },
    deckCountText: {
      fontSize: 13,
      fontWeight: '700',
      color: theme.textSecondary,
    },
    deckName: {
      fontSize: 24,
      lineHeight: 28,
      fontWeight: '800',
      letterSpacing: -0.8,
      color: theme.text,
      marginBottom: 8,
    },
    deckCategory: {
      fontSize: 14,
      lineHeight: 20,
      fontWeight: '700',
      color: theme.textSecondary,
      marginBottom: 16,
    },
    deckProgressRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 10,
      gap: 12,
    },
    deckProgressLabel: {
      fontSize: 13,
      fontWeight: '700',
      color: theme.textSecondary,
    },
    deckProgressValue: {
      fontSize: 13,
      fontWeight: '800',
      color: theme.text,
    },
    progressTrack: {
      height: 8,
      borderRadius: 999,
      backgroundColor: isDark ? 'rgba(148, 163, 184, 0.16)' : 'rgba(148, 163, 184, 0.18)',
      overflow: 'hidden',
      marginBottom: 16,
    },
    progressFill: {
      height: '100%',
      borderRadius: 999,
    },
    deckFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    deckFooterText: {
      fontSize: 13,
      fontWeight: '700',
      color: theme.textSecondary,
    },
    emptyStateCard: {
      borderRadius: 28,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(148, 163, 184, 0.14)' : 'rgba(255, 255, 255, 0.14)',
    },
    emptyStateSurface: {
      padding: 22,
      alignItems: 'flex-start',
    },
    emptyStateTitle: {
      fontSize: 22,
      lineHeight: 26,
      fontWeight: '800',
      letterSpacing: -0.6,
      color: theme.text,
      marginBottom: 8,
    },
    emptyStateDescription: {
      fontSize: 15,
      lineHeight: 22,
      fontWeight: '600',
      color: theme.textSecondary,
    },
  });
}

export default function HomePage() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { stats, decks, progress } = useFlashQuest();
  const { theme, isDark } = useTheme();
  const {
    canAccessDeveloperTools,
    disableDeveloperAccess,
    enableDeveloperAccess,
    isReady: isDeveloperAccessReady,
  } = useDeveloperAccess();
  const didHandleLongPressRef = useRef<boolean>(false);

  const styles = useMemo(() => createStyles(theme, isDark, width), [theme, isDark, width]);

  const backgroundGradient = useMemo(
    () => [theme.gradientStart, theme.gradientMid, theme.gradientEnd] as GradientTriplet,
    [theme.gradientEnd, theme.gradientMid, theme.gradientStart]
  );
  const overlayGradient = useMemo(
    () => (
      isDark
        ? ['rgba(2, 6, 23, 0.08)', 'rgba(2, 6, 23, 0.48)', 'rgba(2, 6, 23, 0.82)']
        : ['rgba(255, 255, 255, 0.04)', 'rgba(15, 23, 42, 0.18)', 'rgba(15, 23, 42, 0.4)']
    ) as GradientTriplet,
    [isDark]
  );
  const surfaceGradient = useMemo(
    () => (
      isDark
        ? ['rgba(15, 23, 42, 0.96)', 'rgba(15, 23, 42, 0.86)']
        : ['rgba(255, 255, 255, 0.96)', 'rgba(241, 245, 249, 0.88)']
    ) as GradientPair,
    [isDark]
  );
  const heroGradient = useMemo(
    () => (isDark ? ['#312E81', '#7C3AED', '#F97316'] : ['#4338CA', '#7C3AED', '#F97316']) as GradientTriplet,
    [isDark]
  );

  const actions = useMemo<ReadonlyArray<HomeAction>>(
    () => [
      {
        id: 'battle',
        label: 'Competitive',
        title: 'Battle',
        description: 'Fast rounds, head-to-head energy, and a louder visual punch.',
        route: '/arena' as Href,
        icon: Swords,
        gradient: [theme.arenaGradient[0], theme.arenaGradient[1], '#FB923C'],
      },
      {
        id: 'quest',
        label: 'Focus Mode',
        title: 'Quest',
        description: 'Keep the flow going with guided study runs and clean momentum.',
        route: '/quest' as Href,
        icon: Target,
        gradient: [theme.questGradient[0], theme.questGradient[1], '#A78BFA'],
      },
      {
        id: 'stats',
        label: 'Progress',
        title: 'Stats',
        description: 'Track streaks, XP, and the sessions that are building consistency.',
        route: '/stats' as Href,
        icon: Trophy,
        gradient: [theme.scoreGradient[0], theme.scoreGradient[1], '#5EEAD4'],
      },
      {
        id: 'decks',
        label: 'Library',
        title: 'Decks',
        description: 'Organize your sets and jump back into the cards that matter most.',
        route: '/decks' as Href,
        icon: BookOpen,
        gradient: [theme.deckGradient[0], theme.deckGradient[1], '#818CF8'],
      },
    ],
    [theme.arenaGradient, theme.deckGradient, theme.questGradient, theme.scoreGradient]
  );

  const progressMap = useMemo(() => createProgressMap(progress), [progress]);

  const featuredDecks = useMemo<ReadonlyArray<FeaturedDeckItem>>(() => {
    return decks
      .map((deck, index) => {
        const progressEntry = progressMap.get(deck.id);
        const totalCards = deck.flashcards.length;
        const reviewedCount = progressEntry?.cardsReviewed ?? 0;
        const progressRatio = totalCards > 0 ? Math.min(reviewedCount / totalCards, 1) : 0;
        let statusLabel = 'Fresh deck';

        if (progressRatio >= 1) {
          statusLabel = 'Mastered';
        } else if (reviewedCount > 0) {
          statusLabel = 'In rotation';
        }

        return {
          deck,
          reviewedCount,
          totalCards,
          progressRatio,
          statusLabel,
          lastStudied: progressEntry?.lastStudied ?? 0,
          sortIndex: index,
        } satisfies FeaturedDeckItem;
      })
      .sort((left, right) => {
        if (left.lastStudied === right.lastStudied) {
          return left.sortIndex - right.sortIndex;
        }

        return right.lastStudied - left.lastStudied;
      })
      .slice(0, 6);
  }, [decks, progressMap]);

  const heroStats = useMemo(
    () => [
      { id: 'xp', label: 'Total XP', value: formatMetric(stats.totalScore) },
      { id: 'streak', label: 'Day Streak', value: formatMetric(stats.currentStreak) },
      { id: 'cards', label: 'Cards Studied', value: formatMetric(stats.totalCardsStudied) },
    ],
    [stats.currentStreak, stats.totalCardsStudied, stats.totalScore]
  );

  const streakText = useMemo(() => {
    if (stats.currentStreak > 1) {
      return `${stats.currentStreak}-day streak live`;
    }

    if (stats.currentStreak === 1) {
      return '1-day streak started';
    }

    return 'Start today’s streak';
  }, [stats.currentStreak]);

  const deckCountText = useMemo(() => {
    if (decks.length === 1) {
      return '1 deck ready';
    }

    return `${decks.length} decks ready`;
  }, [decks.length]);

  const handleNavigate = useCallback(
    (route: Href, label: string) => {
      logger.log('[Home] Navigating to', label, route);
      router.push(route);
    },
    [router]
  );

  const handleOpenDeck = useCallback(
    (deckId: string, deckName: string) => {
      logger.log('[Home] Opening deck', deckName, deckId);
      router.push({ pathname: '/study', params: { deckId } } as Href);
    },
    [router]
  );

  const handleOpenProfile = useCallback(() => {
    if (didHandleLongPressRef.current) {
      didHandleLongPressRef.current = false;
      return;
    }

    logger.log('[Home] Opening profile');
    router.push('/profile' as Href);
  }, [router]);

  const handleProfileLongPress = useCallback(() => {
    if (!__DEV__ || !isDeveloperAccessReady) {
      return;
    }

    didHandleLongPressRef.current = true;

    if (canAccessDeveloperTools) {
      logger.log('[Home] Developer tools hidden from profile shortcut');
      disableDeveloperAccess();
      Alert.alert('Developer tools hidden', 'Analytics debug is now hidden on this device.');
      return;
    }

    logger.log('[Home] Developer tools enabled from profile shortcut');
    enableDeveloperAccess();
    Alert.alert('Developer tools unlocked', 'Analytics debug is now available inside Profile on this device.');
  }, [canAccessDeveloperTools, disableDeveloperAccess, enableDeveloperAccess, isDeveloperAccessReady]);

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={backgroundGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={overlayGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View pointerEvents="none" style={styles.backgroundLayer}>
        <View style={[styles.orbPrimary, { backgroundColor: withAlphaColor(theme.primary, isDark ? 0.32 : 0.26) }]} />
        <View
          style={[styles.orbSecondary, { backgroundColor: withAlphaColor(theme.arenaGradient[0], isDark ? 0.22 : 0.18) }]}
        />
      </View>

      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          testID="home-scroll-view"
        >
          <View style={styles.header}>
            <View style={styles.headerTextBlock}>
              <Text style={styles.headerEyebrow}>FlashQuest</Text>
              <Text style={styles.headerTitle}>Choose your mode</Text>
              <Text style={styles.headerSubtitle}>A cleaner, richer home for battles, quests, stats, and decks.</Text>
            </View>

            <Pressable
              style={styles.profileButton}
              onPress={handleOpenProfile}
              onLongPress={handleProfileLongPress}
              delayLongPress={700}
              testID="home-profile-button"
            >
              {({ pressed }) => (
                <View style={[styles.profileButtonShell, pressed ? styles.profileButtonPressed : null]}>
                  <LinearGradient
                    colors={surfaceGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.profileButtonGradient}
                  >
                    <User color="#FFFFFF" size={24} strokeWidth={2.4} />
                  </LinearGradient>
                </View>
              )}
            </Pressable>
          </View>

          <View style={styles.heroCardShell}>
            <LinearGradient
              colors={heroGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.heroCard}
            >
              <View style={styles.heroGlow} />

              <View style={styles.heroTopRow}>
                <View style={styles.heroBadge}>
                  <Sparkles color="#FFFFFF" size={14} strokeWidth={2.5} />
                  <Text style={styles.heroBadgeText}>Main Menu Refresh</Text>
                </View>
                <Text style={styles.heroStatus}>Ready now</Text>
              </View>

              <Text style={styles.heroTitle}>Bring the profile energy into every first tap.</Text>
              <Text style={styles.heroDescription}>
                Stronger surfaces, sharper contrast, and better hierarchy across the app’s main hub.
              </Text>

              <View style={styles.heroMetaRow}>
                <View style={styles.heroMetaPill}>
                  <Text style={styles.heroMetaText}>{streakText}</Text>
                </View>
                <View style={styles.heroMetaPill}>
                  <Text style={styles.heroMetaText}>{deckCountText}</Text>
                </View>
              </View>

              <View style={styles.heroStatsRow}>
                {heroStats.map((item) => (
                  <View key={item.id} style={styles.heroStatPill}>
                    <Text style={styles.heroStatValue}>{item.value}</Text>
                    <Text style={styles.heroStatLabel}>{item.label}</Text>
                  </View>
                ))}
              </View>
            </LinearGradient>
          </View>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionEyebrow}>Play</Text>
            <Text style={styles.sectionTitle}>Jump into FlashQuest</Text>
          </View>

          <View style={styles.actionsGrid}>
            {actions.map((action) => {
              const Icon = action.icon;
              const accentColor = action.gradient[1];

              return (
                <Pressable
                  key={action.id}
                  style={styles.actionCard}
                  onPress={() => handleNavigate(action.route, action.title)}
                  testID={`home-action-${action.id}`}
                >
                  {({ pressed }) => (
                    <View style={[styles.actionCardShell, pressed ? styles.actionCardPressed : null]}>
                      <LinearGradient
                        colors={surfaceGradient}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.actionCardSurface}
                      >
                        <LinearGradient
                          colors={action.gradient}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={styles.actionIconBadge}
                        >
                          <Icon color="#FFFFFF" size={28} strokeWidth={2.4} />
                        </LinearGradient>

                        <View style={styles.actionTextWrap}>
                          <Text style={[styles.actionLabel, { color: accentColor }]}>{action.label}</Text>
                          <Text style={styles.actionTitle}>{action.title}</Text>
                          <Text style={styles.actionDescription}>{action.description}</Text>
                        </View>

                        <View style={styles.actionFooter}>
                          <View style={[styles.actionAccentBar, { backgroundColor: withAlphaColor(accentColor, 0.9) }]} />
                          <Text style={styles.actionFooterText}>Open</Text>
                          <ChevronRight color={theme.textSecondary} size={18} strokeWidth={2.4} />
                        </View>
                      </LinearGradient>
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>

          <View style={styles.sectionHeaderRow}>
            <View>
              <Text style={styles.sectionEyebrow}>Quick Start</Text>
              <Text style={styles.sectionTitle}>Continue with a deck</Text>
            </View>
            <View style={styles.quickStartBadge}>
              <Text style={styles.quickStartBadgeText}>{featuredDecks.length} ready</Text>
            </View>
          </View>

          {featuredDecks.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.decksScrollContent}
              testID="home-quick-start-scroll"
            >
              {featuredDecks.map((item) => {
                const accentColor = item.deck.color || theme.primary;
                const statusTint = withAlphaColor(accentColor, isDark ? 0.2 : 0.14);
                const statusBorder = withAlphaColor(accentColor, isDark ? 0.42 : 0.24);

                return (
                  <Pressable
                    key={item.deck.id}
                    style={styles.deckCard}
                    onPress={() => handleOpenDeck(item.deck.id, item.deck.name)}
                    testID={`home-quick-start-${item.deck.id}`}
                  >
                    {({ pressed }) => (
                      <View style={[styles.deckCardShell, pressed ? styles.deckCardPressed : null]}>
                        <LinearGradient
                          colors={surfaceGradient}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={styles.deckCardSurface}
                        >
                          <View>
                            <View style={styles.deckTopRow}>
                              <View style={[styles.deckStatusPill, { backgroundColor: statusTint, borderColor: statusBorder }]}>
                                <Text style={[styles.deckStatusText, { color: accentColor }]}>{item.statusLabel}</Text>
                              </View>
                              <Text style={styles.deckCountText}>{item.totalCards} cards</Text>
                            </View>

                            <Text style={styles.deckName} numberOfLines={2}>
                              {item.deck.name}
                            </Text>
                            <Text style={styles.deckCategory} numberOfLines={1}>
                              {item.deck.category}
                            </Text>

                            <View style={styles.deckProgressRow}>
                              <Text style={styles.deckProgressLabel}>Reviewed</Text>
                              <Text style={styles.deckProgressValue}>
                                {Math.min(item.reviewedCount, item.totalCards)}/{item.totalCards}
                              </Text>
                            </View>
                            <View style={styles.progressTrack}>
                              <View
                                style={[
                                  styles.progressFill,
                                  { width: `${Math.max(item.progressRatio * 100, item.progressRatio > 0 ? 8 : 0)}%`, backgroundColor: accentColor },
                                ]}
                              />
                            </View>
                          </View>

                          <View style={styles.deckFooter}>
                            <Text style={styles.deckFooterText}>Open deck</Text>
                            <ChevronRight color={theme.textSecondary} size={18} strokeWidth={2.4} />
                          </View>
                        </LinearGradient>
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>
          ) : (
            <View style={styles.emptyStateCard}>
              <LinearGradient
                colors={surfaceGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.emptyStateSurface}
              >
                <Text style={styles.emptyStateTitle}>No decks yet</Text>
                <Text style={styles.emptyStateDescription}>Create your first deck to unlock quick start from this upgraded home screen.</Text>
              </LinearGradient>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
