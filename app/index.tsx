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
        ? ['#08111f', '#0c1730', '#091220'] as const
        : ['#f3f6fb', '#edf2f9', '#f7f9fc'] as const
    ),
    [isDark],
  );
  const shellOverlayGradient = useMemo(
    () => (
      isDark
        ? ['rgba(4, 8, 18, 0.08)', 'rgba(4, 8, 18, 0.2)', 'rgba(3, 7, 16, 0.44)'] as const
        : ['rgba(255, 255, 255, 0.08)', 'rgba(245, 248, 252, 0.12)', 'rgba(236, 241, 247, 0.36)'] as const
    ),
    [isDark],
  );
  const titleColor = isDark ? '#f8fafc' : '#172033';
  const subtitleColor = isDark ? 'rgba(226, 232, 240, 0.72)' : 'rgba(71, 85, 105, 0.76)';
  const sectionTitleColor = isDark ? '#f8fafc' : '#1f2b46';
  const labelColor = isDark ? 'rgba(226, 232, 240, 0.42)' : 'rgba(71, 85, 105, 0.64)';
  const topGlowColor = isDark ? 'rgba(99, 102, 241, 0.045)' : 'rgba(99, 102, 241, 0.04)';
  const midGlowColor = isDark ? 'rgba(59, 130, 246, 0.035)' : 'rgba(59, 130, 246, 0.03)';
  const bottomGlowColor = isDark ? 'rgba(56, 189, 248, 0.028)' : 'rgba(56, 189, 248, 0.024)';
  const profileSurface = isDark ? 'rgba(9, 16, 30, 0.5)' : 'rgba(255, 255, 255, 0.84)';
  const profileBorderColor = isDark ? 'rgba(148, 163, 184, 0.16)' : 'rgba(148, 163, 184, 0.16)';
  const profileGradient = isDark
    ? ['rgba(129, 140, 248, 0.82)', 'rgba(99, 102, 241, 0.68)'] as const
    : ['rgba(129, 140, 248, 0.95)', 'rgba(99, 102, 241, 0.82)'] as const;
  const statsCardGradient = isDark
    ? ['rgba(10, 17, 31, 0.985)', 'rgba(12, 19, 35, 0.985)'] as const
    : ['rgba(255, 255, 255, 0.99)', 'rgba(243, 247, 252, 0.98)'] as const;
  const statsBorderColor = isDark ? 'rgba(148, 163, 184, 0.16)' : 'rgba(148, 163, 184, 0.14)';
  const statsDividerColor = isDark ? 'rgba(148, 163, 184, 0.16)' : 'rgba(148, 163, 184, 0.16)';
  const statsShadowColor = isDark ? '#020617' : '#94a3b8';
  const statsValueColor = isDark ? '#f8fafc' : '#13233f';
  const statsLevelColor = isDark ? '#c4b5fd' : '#5b48d9';
  const actionShadowColor = isDark ? '#020617' : '#94a3b8';
  const actionBorderColor = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(148, 163, 184, 0.16)';
  const actionDepthGradient = isDark
    ? ['rgba(255, 255, 255, 0.02)', 'rgba(2, 6, 23, 0.1)', 'rgba(2, 6, 23, 0.28)'] as const
    : ['rgba(255, 255, 255, 0.06)', 'rgba(255, 255, 255, 0.01)', 'rgba(15, 23, 42, 0.1)'] as const;
  const actionInnerBorderColor = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.2)';
  const actionIconSurface = isDark ? 'rgba(8, 13, 24, 0.18)' : 'rgba(255, 255, 255, 0.2)';
  const actionIconBorderColor = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.24)';
  const deckCardSurface = isDark ? 'rgba(9, 16, 31, 0.92)' : 'rgba(255, 255, 255, 0.96)';
  const deckCardGradient = isDark
    ? ['rgba(10, 17, 31, 0.985)', 'rgba(11, 18, 33, 0.985)'] as const
    : ['rgba(255, 255, 255, 0.985)', 'rgba(244, 247, 252, 0.98)'] as const;
  const deckCardBorderColor = isDark ? 'rgba(148, 163, 184, 0.12)' : 'rgba(148, 163, 184, 0.16)';
  const deckCardShadowColor = isDark ? '#020617' : '#94a3b8';
  const deckTrackColor = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(148, 163, 184, 0.2)';
  const emptyStateSurface = isDark ? 'rgba(10, 17, 31, 0.82)' : 'rgba(255, 255, 255, 0.94)';
  const emptyStateBorderColor = isDark ? 'rgba(148, 163, 184, 0.14)' : 'rgba(148, 163, 184, 0.16)';
  const homeActionGradients = useMemo(
    () => ({
      arena: isDark ? ['#ff8b3d', '#d65b1b'] as const : ['#ee8546', '#cc5a24'] as const,
      quest: isDark ? ['#8a6bff', '#5e38de'] as const : ['#8c72f2', '#6345de'] as const,
      stats: isDark ? ['#2eb7eb', '#117db8'] as const : ['#38bdf8', '#0f8ed0'] as const,
      decks: isDark ? ['#7482ff', '#4b57df'] as const : ['#7480ec', '#5260e2'] as const,
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
            backgroundColor: isDark ? 'rgba(7, 13, 27, 0.92)' : 'rgba(255, 255, 255, 0.9)',
            shadowColor: actionShadowColor,
            shadowOpacity: isDark ? 0.24 : 0.12,
            shadowRadius: isDark ? 16 : 10,
            elevation: isDark ? 8 : 5,
            borderWidth: 1,
            borderColor: actionBorderColor,
          },
        ]}
        onPress={() => router.push(route)}
        activeOpacity={0.88}
        testID={testID}
      >
        <LinearGradient
          colors={colors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.actionGradient}
        >
          <LinearGradient
            colors={actionDepthGradient}
            start={{ x: 0.1, y: 0 }}
            end={{ x: 0.9, y: 1 }}
            style={styles.actionDepth}
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

const styles = StyleSheet.create({
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
    right: -96,
    width: 152,
    height: 152,
    borderRadius: 76,
  },
  midGlow: {
    position: 'absolute',
    top: 364,
    left: -118,
    width: 148,
    height: 148,
    borderRadius: 74,
  },
  bottomGlow: {
    position: 'absolute',
    bottom: 168,
    right: -110,
    width: 156,
    height: 156,
    borderRadius: 78,
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
    borderRadius: 26,
    paddingHorizontal: 18,
    paddingVertical: 22,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.16,
    shadowRadius: 20,
    elevation: 9,
    overflow: 'hidden',
  },
  statsCardFrame: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 26,
    borderWidth: 1,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  levelText: {
    fontSize: 28,
    fontWeight: '800' as const,
    marginBottom: 5,
    letterSpacing: -0.8,
  },
  statValue: {
    fontSize: 34,
    fontWeight: '800' as const,
    color: '#667eea',
    marginBottom: 5,
    letterSpacing: -0.8,
  },
  statLabel: {
    fontSize: 12.5,
    color: '#666',
    fontWeight: '700' as const,
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  statDivider: {
    width: 1,
    height: 52,
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
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 8,
  },
  actionCardMedium: {
    width: (width - 64) / 2,
    height: 146,
  },
  actionGradient: {
    flex: 1,
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  actionDepth: {
    ...StyleSheet.absoluteFillObject,
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
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    zIndex: 2,
  },
  actionIconWrap: {
    width: 50,
    height: 50,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  actionTitleMedium: {
    fontSize: 20,
    fontWeight: '800' as const,
    color: '#fff',
    marginTop: 0,
    textAlign: 'left',
    letterSpacing: -0.45,
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
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 6,
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
    fontWeight: '600' as const,
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
