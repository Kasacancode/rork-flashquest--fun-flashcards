import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, type Href } from 'expo-router';
import { Trophy, BookOpen, Swords, Target, User } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  Alert,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Animated,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useDeveloperAccess } from '@/context/DeveloperAccessContext';
import { useFlashQuest } from '@/context/FlashQuestContext';
import { usePerformance } from '@/context/PerformanceContext';
import { useTheme } from '@/context/ThemeContext';
import { computeLevel, getLevelEntry } from '@/utils/levels';
import { computeDeckMastery } from '@/utils/mastery';

const { width } = Dimensions.get('window');

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
  const { stats, decks } = useFlashQuest();
  const { performance, getWeakCards } = usePerformance();
  const { theme, isDark } = useTheme();
  const {
    canAccessDeveloperTools,
    disableDeveloperAccess,
    enableDeveloperAccess,
    isReady: isDeveloperAccessReady,
  } = useDeveloperAccess();
  const didHandleLongPressRef = useRef<boolean>(false);
  const streakAnim = useRef<Animated.Value>(new Animated.Value(0)).current;
  const cardsAnim = useRef<Animated.Value>(new Animated.Value(0)).current;
  const level = useMemo(() => computeLevel(stats.totalScore), [stats.totalScore]);
  const levelEntry = useMemo(() => getLevelEntry(level), [level]);

  const backgroundGradient = useMemo(
    () => (
      isDark
        ? ['#07101d', '#0c1730', '#08111f'] as const
        : ['#f6f8fc', '#eef2f8', '#f8fafd'] as const
    ),
    [isDark],
  );
  const shellOverlayGradient = useMemo(
    () => (
      isDark
        ? ['rgba(4, 8, 18, 0.04)', 'rgba(4, 8, 18, 0.18)', 'rgba(3, 7, 16, 0.38)'] as const
        : ['rgba(255, 255, 255, 0.08)', 'rgba(244, 247, 251, 0.14)', 'rgba(236, 241, 247, 0.34)'] as const
    ),
    [isDark],
  );
  const titleColor = isDark ? '#f8fafc' : '#172033';
  const subtitleColor = isDark ? 'rgba(226, 232, 240, 0.72)' : 'rgba(71, 85, 105, 0.76)';
  const sectionTitleColor = isDark ? '#f8fafc' : '#1f2b46';
  const labelColor = isDark ? 'rgba(226, 232, 240, 0.44)' : 'rgba(71, 85, 105, 0.62)';
  const topGlowColor = isDark ? 'rgba(99, 102, 241, 0.03)' : 'rgba(99, 102, 241, 0.03)';
  const midGlowColor = isDark ? 'rgba(56, 189, 248, 0.024)' : 'rgba(59, 130, 246, 0.022)';
  const bottomGlowColor = isDark ? 'rgba(249, 115, 22, 0.018)' : 'rgba(56, 189, 248, 0.018)';
  const profileSurface = isDark ? 'rgba(8, 14, 27, 0.56)' : 'rgba(255, 255, 255, 0.86)';
  const profileBorderColor = isDark ? 'rgba(148, 163, 184, 0.18)' : 'rgba(148, 163, 184, 0.18)';
  const profileGradient = isDark
    ? ['rgba(129, 140, 248, 0.8)', 'rgba(99, 102, 241, 0.66)'] as const
    : ['rgba(129, 140, 248, 0.96)', 'rgba(99, 102, 241, 0.82)'] as const;
  const statsCardGradient = isDark
    ? ['rgba(8, 14, 27, 0.99)', 'rgba(12, 20, 36, 0.99)'] as const
    : ['rgba(255, 255, 255, 0.99)', 'rgba(245, 248, 253, 0.99)'] as const;
  const statsBorderColor = isDark ? 'rgba(148, 163, 184, 0.18)' : 'rgba(148, 163, 184, 0.16)';
  const statsDividerColor = isDark ? 'rgba(148, 163, 184, 0.2)' : 'rgba(148, 163, 184, 0.18)';
  const statsShadowColor = isDark ? '#020617' : '#94a3b8';
  const statsValueColor = isDark ? '#f8fafc' : '#13233f';
  const statsLevelColor = isDark ? '#c4b5fd' : '#5b48d9';
  const actionShadowColor = isDark ? '#020617' : '#94a3b8';
  const actionBorderColor = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(148, 163, 184, 0.18)';
  const actionTopTintGradient = isDark
    ? ['rgba(255, 255, 255, 0.08)', 'rgba(255, 255, 255, 0.02)'] as const
    : ['rgba(255, 255, 255, 0.18)', 'rgba(255, 255, 255, 0.04)'] as const;
  const actionBottomShadeGradient = isDark
    ? ['rgba(2, 6, 23, 0)', 'rgba(2, 6, 23, 0.2)', 'rgba(2, 6, 23, 0.34)'] as const
    : ['rgba(15, 23, 42, 0)', 'rgba(15, 23, 42, 0.08)', 'rgba(15, 23, 42, 0.14)'] as const;
  const actionInnerBorderColor = isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.2)';
  const actionIconSurface = isDark ? 'rgba(7, 13, 24, 0.16)' : 'rgba(255, 255, 255, 0.16)';
  const actionIconBorderColor = isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.18)';
  const deckCardSurface = isDark ? 'rgba(9, 15, 29, 0.95)' : 'rgba(255, 255, 255, 0.98)';
  const deckCardGradient = isDark
    ? ['rgba(9, 15, 29, 0.99)', 'rgba(13, 21, 37, 0.99)'] as const
    : ['rgba(255, 255, 255, 0.99)', 'rgba(245, 248, 253, 0.98)'] as const;
  const deckCardBorderColor = isDark ? 'rgba(148, 163, 184, 0.14)' : 'rgba(148, 163, 184, 0.16)';
  const deckCardShadowColor = isDark ? '#020617' : '#94a3b8';
  const deckTrackColor = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(148, 163, 184, 0.18)';
  const emptyStateSurface = isDark ? 'rgba(9, 15, 29, 0.88)' : 'rgba(255, 255, 255, 0.96)';
  const emptyStateBorderColor = isDark ? 'rgba(148, 163, 184, 0.14)' : 'rgba(148, 163, 184, 0.16)';
  const homeActionGradients = useMemo(
    () => ({
      arena: isDark ? ['#f08940', '#c85319'] as const : ['#ef8750', '#d46230'] as const,
      quest: isDark ? ['#846af3', '#5736cf'] as const : ['#8771ee', '#6248d8'] as const,
      stats: isDark ? ['#2fa9dd', '#136fa9'] as const : ['#36abe0', '#1981be'] as const,
      decks: isDark ? ['#6978ef', '#4957cf'] as const : ['#6d7ae6', '#5260d9'] as const,
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

  const handleOpenProfile = useCallback(() => {
    if (didHandleLongPressRef.current) {
      didHandleLongPressRef.current = false;
      return;
    }

    router.push('/profile' as Href);
  }, [router]);

  const handleProfileLongPress = useCallback(() => {
    if (!isDeveloperAccessReady) {
      return;
    }

    didHandleLongPressRef.current = true;

    if (canAccessDeveloperTools) {
      disableDeveloperAccess();
      Alert.alert('Developer tools hidden', 'Analytics debug is now hidden on this device.');
      return;
    }

    enableDeveloperAccess();
    Alert.alert('Developer tools unlocked', 'Analytics debug is now available inside Profile on this device.');
  }, [canAccessDeveloperTools, disableDeveloperAccess, enableDeveloperAccess, isDeveloperAccessReady]);

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
            backgroundColor: isDark ? 'rgba(7, 13, 27, 0.92)' : 'rgba(255, 255, 255, 0.94)',
            shadowColor: actionShadowColor,
            shadowOpacity: isDark ? 0.24 : 0.1,
            shadowRadius: isDark ? 18 : 12,
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
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.actionGradient}
        >
          <LinearGradient
            colors={actionTopTintGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0.4 }}
            style={styles.actionTopTint}
          />
          <LinearGradient
            colors={actionBottomShadeGradient}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={styles.actionBottomShade}
          />
          <View style={[styles.actionInnerBorder, { borderColor: actionInnerBorderColor }]} />
          <View style={styles.actionContent}>
            <View
              style={[
                styles.actionIconWrap,
                {
                  backgroundColor: actionIconSurface,
                  borderColor: actionIconBorderColor,
                },
              ]}
            >
              {icon}
            </View>
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
          testID="home-scroll-view"
        >
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
              onLongPress={handleProfileLongPress}
              delayLongPress={700}
              activeOpacity={0.8}
              testID="home-profile-button"
            >
              <LinearGradient
                colors={profileGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.profileGradient}
              >
                <User color="#fff" size={24} strokeWidth={2.5} />
              </LinearGradient>
            </TouchableOpacity>
          </View>

          <View
            style={[
              styles.statsCard,
              {
                backgroundColor: isDark ? 'rgba(10, 17, 31, 0.9)' : theme.statsCard,
                borderWidth: 1,
                borderColor: statsBorderColor,
                shadowColor: statsShadowColor,
                shadowOpacity: isDark ? 0.24 : 0.12,
                shadowRadius: isDark ? 18 : 12,
                elevation: isDark ? 10 : 5,
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

            <View style={styles.statItem}>
              <Text style={[styles.levelText, { color: statsLevelColor }]}>LV {level}</Text>
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>{levelEntry.title}</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: statsDividerColor }]} />
            <View style={styles.statItem}>
              <AnimatedStatValue animValue={streakAnim} style={[styles.statValue, { color: statsValueColor }]} />
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Day Streak</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: statsDividerColor }]} />
            <View style={styles.statItem}>
              <AnimatedStatValue animValue={cardsAnim} style={[styles.statValue, { color: statsValueColor }]} />
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Cards Studied</Text>
            </View>
          </View>

          <Text style={[styles.gridLabel, { color: labelColor }]}>MODES</Text>

          <View style={styles.actionsGrid}>
            {renderActionCard({
              route: '/arena' as Href,
              colors: homeActionGradients.arena,
              title: 'Battle',
              icon: <Swords color="#fff" size={34} strokeWidth={2.1} />,
              testID: 'home-action-battle',
            })}
            {renderActionCard({
              route: '/quest' as Href,
              colors: homeActionGradients.quest,
              title: 'Quest',
              icon: <Target color="#fff" size={34} strokeWidth={2.1} />,
              testID: 'home-action-quest',
            })}
            {renderActionCard({
              route: '/stats' as Href,
              colors: homeActionGradients.stats,
              title: 'Your Stats',
              icon: <Trophy color="#fff" size={34} strokeWidth={2.1} />,
              testID: 'home-action-stats',
            })}
            {renderActionCard({
              route: '/decks' as Href,
              colors: homeActionGradients.decks,
              title: 'Decks',
              icon: <BookOpen color="#fff" size={34} strokeWidth={2.1} />,
              testID: 'home-action-decks',
            })}
          </View>

          <View style={styles.decksSection}>
            <Text style={[styles.sectionTitle, { color: sectionTitleColor }]}>
              {recommendations.length > 0 ? 'Recommended for You' : 'Quick Start'}
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
                          shadowOpacity: isDark ? 0.18 : 0.1,
                          shadowRadius: isDark ? 14 : 10,
                          elevation: isDark ? 6 : 4,
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
                          shadowOpacity: isDark ? 0.18 : 0.1,
                          shadowRadius: isDark ? 14 : 10,
                          elevation: isDark ? 6 : 4,
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
  statItem: ViewStyle;
  levelText: TextStyle;
  statValue: TextStyle;
  statLabel: TextStyle;
  statDivider: ViewStyle;
  gridLabel: TextStyle;
  actionsGrid: ViewStyle;
  actionCard: ViewStyle;
  actionCardMedium: ViewStyle;
  actionGradient: ViewStyle;
  actionTopTint: ViewStyle;
  actionBottomShade: ViewStyle;
  actionInnerBorder: ViewStyle;
  actionContent: ViewStyle;
  actionIconWrap: ViewStyle;
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
    backgroundColor: '#667eea',
  },
  safeArea: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 56,
  },
  topGlow: {
    position: 'absolute',
    top: -92,
    right: -92,
    width: 144,
    height: 144,
    borderRadius: 72,
  },
  midGlow: {
    position: 'absolute',
    top: 388,
    left: -108,
    width: 136,
    height: 136,
    borderRadius: 68,
  },
  bottomGlow: {
    position: 'absolute',
    bottom: 184,
    right: -98,
    width: 144,
    height: 144,
    borderRadius: 72,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 26,
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
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 7,
  },
  profileGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 42,
    fontWeight: '800' as const,
    color: '#fff',
    marginBottom: 4,
    letterSpacing: -1,
  },
  subtitle: {
    fontSize: 18,
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '500' as const,
  },
  statsCard: {
    marginHorizontal: 24,
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 21,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.18,
    shadowRadius: 22,
    elevation: 10,
    overflow: 'hidden',
  },
  statsCardFrame: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 24,
    borderWidth: 1,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  levelText: {
    fontSize: 30,
    fontWeight: '800' as const,
    marginBottom: 4,
    letterSpacing: -0.9,
  },
  statValue: {
    fontSize: 33,
    fontWeight: '800' as const,
    color: '#667eea',
    marginBottom: 4,
    letterSpacing: -0.8,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    fontWeight: '700' as const,
    textAlign: 'center',
    letterSpacing: 0.18,
  },
  statDivider: {
    width: 1,
    height: 56,
    backgroundColor: '#e0e0e0',
  },
  gridLabel: {
    fontSize: 11.5,
    fontWeight: '700' as const,
    color: 'rgba(255, 255, 255, 0.45)',
    textTransform: 'uppercase',
    letterSpacing: 1.6,
    paddingHorizontal: 24,
    marginTop: 30,
    marginBottom: 14,
  },
  actionsGrid: {
    paddingHorizontal: 24,
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
    shadowRadius: 18,
    elevation: 9,
  },
  actionCardMedium: {
    width: (width - 64) / 2,
    height: 146,
  },
  actionGradient: {
    flex: 1,
    paddingHorizontal: 18,
    paddingVertical: 18,
  },
  actionTopTint: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 54,
  },
  actionBottomShade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 84,
  },
  actionInnerBorder: {
    position: 'absolute',
    top: 1,
    left: 1,
    right: 1,
    bottom: 1,
    borderRadius: 23,
    borderWidth: 1,
  },
  actionContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  actionIconWrap: {
    width: 58,
    height: 58,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
    borderWidth: 1,
  },
  actionTitleMedium: {
    fontSize: 19,
    fontWeight: '800' as const,
    color: '#fff',
    marginTop: 0,
    textAlign: 'center',
    letterSpacing: -0.42,
  },
  decksSection: {
    marginTop: 42,
    paddingHorizontal: 24,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '800' as const,
    color: '#fff',
    marginBottom: 18,
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
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 14,
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
    width: 170,
    height: 126,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 9 },
    shadowOpacity: 0.1,
    shadowRadius: 14,
    elevation: 5,
  },
  deckCardFrame: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 18,
    borderWidth: 1,
  },
  deckColorStrip: {
    height: 4,
    width: '100%',
  },
  deckContent: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 13,
    justifyContent: 'flex-start',
  },
  deckName: {
    fontSize: 15,
    fontWeight: '800' as const,
    color: '#333',
    marginBottom: 7,
    lineHeight: 20,
    letterSpacing: -0.2,
  },
  deckCards: {
    fontSize: 12.5,
    color: '#666',
    fontWeight: '700' as const,
    letterSpacing: 0.1,
  },
  deckMiniBar: {
    height: 4,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginTop: 8,
    overflow: 'hidden',
  },
  deckMiniBarFill: {
    height: '100%',
    borderRadius: 3,
  },
});
