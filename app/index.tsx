import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, type Href } from 'expo-router';
import {
  BookOpen,
  ChevronRight,
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
  title: string;
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

function createProgressMap(progressEntries: readonly UserProgress[]): Map<string, UserProgress> {
  return new Map(progressEntries.map((entry) => [entry.deckId, entry]));
}

function createStyles(theme: Theme, isDark: boolean, width: number) {
  const horizontalPadding = 20;
  const gridGap = 14;
  const actionCardWidth = Math.max(150, Math.floor((width - horizontalPadding * 2 - gridGap) / 2));
  const deckCardWidth = Math.floor((width - horizontalPadding * 2 - gridGap) / 2);

  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    safeArea: {
      flex: 1,
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
      marginBottom: 24,
    },
    headerTextBlock: {
      flex: 1,
      paddingRight: 16,
    },
    headerTitle: {
      fontSize: 36,
      lineHeight: 40,
      fontWeight: '900' as const,
      letterSpacing: -1.4,
      color: theme.white,
      marginBottom: 6,
    },
    headerSubtitle: {
      fontSize: 17,
      lineHeight: 22,
      color: isDark ? '#94a3b8' : 'rgba(255,255,255,0.78)',
      fontWeight: '600' as const,
    },
    profileButton: {
      borderRadius: 18,
    },
    profileButtonShell: {
      width: 52,
      height: 52,
      borderRadius: 18,
      overflow: 'hidden',
      backgroundColor: isDark ? 'rgba(30, 41, 59, 0.85)' : 'rgba(255,255,255,0.18)',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(148,163,184,0.15)' : 'rgba(255,255,255,0.22)',
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
    },
    profileButtonPressed: {
      transform: [{ scale: 0.95 }],
    },
    statsBar: {
      borderRadius: 20,
      overflow: 'hidden',
      marginBottom: 22,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(148,163,184,0.12)' : 'rgba(255,255,255,0.18)',
    },
    statsBarInner: {
      flexDirection: 'row',
      paddingVertical: 16,
      paddingHorizontal: 8,
    },
    statItem: {
      flex: 1,
      alignItems: 'center',
    },
    statDivider: {
      width: 1,
      backgroundColor: isDark ? 'rgba(148,163,184,0.2)' : 'rgba(255,255,255,0.2)',
      marginVertical: 4,
    },
    statValue: {
      fontSize: 24,
      fontWeight: '900' as const,
      color: theme.primary,
      letterSpacing: -0.5,
      marginBottom: 2,
    },
    statLabel: {
      fontSize: 12,
      fontWeight: '700' as const,
      color: isDark ? '#94a3b8' : 'rgba(255,255,255,0.72)',
      letterSpacing: 0.2,
    },
    actionsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      columnGap: gridGap,
      rowGap: gridGap,
      marginBottom: 28,
    },
    actionCard: {
      width: actionCardWidth,
      borderRadius: 24,
    },
    actionCardPressed: {
      transform: [{ scale: 0.97 }],
    },
    actionCardShell: {
      borderRadius: 24,
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.25,
      shadowRadius: 16,
      elevation: 10,
    },
    actionCardSurface: {
      height: 160,
      padding: 18,
      alignItems: 'center',
      justifyContent: 'center',
    },
    actionIcon: {
      marginBottom: 14,
    },
    actionTitle: {
      fontSize: 20,
      fontWeight: '800' as const,
      color: '#FFFFFF',
      letterSpacing: -0.3,
    },
    quickStartSection: {
      marginBottom: 8,
    },
    quickStartHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 14,
    },
    quickStartTitle: {
      fontSize: 22,
      fontWeight: '800' as const,
      color: theme.white,
      letterSpacing: -0.6,
    },
    decksRow: {
      flexDirection: 'row',
      columnGap: gridGap,
    },
    deckCard: {
      width: deckCardWidth,
      borderRadius: 20,
    },
    deckCardPressed: {
      transform: [{ scale: 0.97 }],
    },
    deckCardShell: {
      borderRadius: 20,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(148,163,184,0.12)' : 'rgba(255,255,255,0.16)',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: isDark ? 0.2 : 0.12,
      shadowRadius: 12,
      elevation: 6,
    },
    deckCardSurface: {
      padding: 14,
    },
    deckAccentBar: {
      height: 4,
      borderRadius: 999,
      marginBottom: 12,
    },
    deckName: {
      fontSize: 16,
      lineHeight: 20,
      fontWeight: '700' as const,
      color: theme.text,
      marginBottom: 4,
    },
    deckMeta: {
      fontSize: 13,
      fontWeight: '600' as const,
      color: theme.textSecondary,
    },
    emptyStateCard: {
      borderRadius: 20,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(148,163,184,0.14)' : 'rgba(255,255,255,0.14)',
    },
    emptyStateSurface: {
      padding: 22,
      alignItems: 'flex-start',
    },
    emptyStateTitle: {
      fontSize: 18,
      fontWeight: '800' as const,
      color: theme.text,
      marginBottom: 6,
    },
    emptyStateDescription: {
      fontSize: 14,
      lineHeight: 20,
      fontWeight: '600' as const,
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

  const statsBarGradient = useMemo(
    () => (
      isDark
        ? ['rgba(15, 23, 42, 0.88)', 'rgba(30, 41, 59, 0.75)']
        : ['rgba(255,255,255,0.14)', 'rgba(255,255,255,0.08)']
    ) as GradientPair,
    [isDark]
  );

  const surfaceGradient = useMemo(
    () => (
      isDark
        ? ['rgba(15, 23, 42, 0.92)', 'rgba(15, 23, 42, 0.82)']
        : ['rgba(255, 255, 255, 0.96)', 'rgba(241, 245, 249, 0.88)']
    ) as GradientPair,
    [isDark]
  );

  const actions = useMemo<ReadonlyArray<HomeAction>>(
    () => [
      {
        id: 'battle',
        title: 'Battle',
        route: '/arena' as Href,
        icon: Swords,
        gradient: ['#ff8c38', '#f97316', '#d95a0b'],
      },
      {
        id: 'quest',
        title: 'Quest',
        route: '/quest' as Href,
        icon: Target,
        gradient: ['#c084fc', '#a855f7', '#8b2cf6'],
      },
      {
        id: 'stats',
        title: 'Stats',
        route: '/stats' as Href,
        icon: Trophy,
        gradient: ['#4ade80', '#22c55e', '#16a34a'],
      },
      {
        id: 'decks',
        title: 'Decks',
        route: '/decks' as Href,
        icon: BookOpen,
        gradient: ['#a78bfa', '#7c3aed', '#6d28d9'],
      },
    ],
    []
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

      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          testID="home-scroll-view"
        >
          <View style={styles.header}>
            <View style={styles.headerTextBlock}>
              <Text style={styles.headerTitle}>FlashQuest</Text>
              <Text style={styles.headerSubtitle}>Deck. Set. Match.</Text>
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
                  <User color="#94a3b8" size={22} strokeWidth={2.4} />
                </View>
              )}
            </Pressable>
          </View>

          <View style={styles.statsBar}>
            <LinearGradient
              colors={statsBarGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.statsBarInner}
            >
              {heroStats.map((item, index) => (
                <React.Fragment key={item.id}>
                  {index > 0 && <View style={styles.statDivider} />}
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>{item.value}</Text>
                    <Text style={styles.statLabel}>{item.label}</Text>
                  </View>
                </React.Fragment>
              ))}
            </LinearGradient>
          </View>

          <View style={styles.actionsGrid}>
            {actions.map((action) => {
              const Icon = action.icon;

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
                        colors={action.gradient}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.actionCardSurface}
                      >
                        <View style={styles.actionIcon}>
                          <Icon color="#FFFFFF" size={40} strokeWidth={2.2} />
                        </View>
                        <Text style={styles.actionTitle}>{action.title}</Text>
                      </LinearGradient>
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>

          <View style={styles.quickStartSection}>
            <View style={styles.quickStartHeader}>
              <Text style={styles.quickStartTitle}>Quick Start</Text>
              {featuredDecks.length > 0 && (
                <Pressable onPress={() => handleNavigate('/decks' as Href, 'Decks')}>
                  <ChevronRight color={theme.textSecondary} size={22} strokeWidth={2.4} />
                </Pressable>
              )}
            </View>

            {featuredDecks.length > 0 ? (
              <View style={styles.decksRow}>
                {featuredDecks.slice(0, 2).map((item) => {
                  const accentColor = item.deck.color || theme.primary;

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
                            <View style={[styles.deckAccentBar, { backgroundColor: accentColor }]} />
                            <Text style={styles.deckName} numberOfLines={2}>
                              {item.deck.name}
                            </Text>
                            <Text style={styles.deckMeta}>
                              {item.totalCards} cards
                            </Text>
                          </LinearGradient>
                        </View>
                      )}
                    </Pressable>
                  );
                })}
              </View>
            ) : (
              <View style={styles.emptyStateCard}>
                <LinearGradient
                  colors={surfaceGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.emptyStateSurface}
                >
                  <Text style={styles.emptyStateTitle}>No decks yet</Text>
                  <Text style={styles.emptyStateDescription}>Create your first deck to get started.</Text>
                </LinearGradient>
              </View>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
