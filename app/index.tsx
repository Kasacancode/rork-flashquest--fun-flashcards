import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, type Href } from 'expo-router';
import { Trophy, BookOpen, Swords, Target, User } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { Alert, View, Text, StyleSheet, TouchableOpacity, ScrollView, Dimensions, Animated, type StyleProp, type TextStyle } from 'react-native';
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
  const xpAnim = useRef<Animated.Value>(new Animated.Value(0)).current;
  const streakAnim = useRef<Animated.Value>(new Animated.Value(0)).current;
  const cardsAnim = useRef<Animated.Value>(new Animated.Value(0)).current;
  const level = useMemo(() => computeLevel(stats.totalScore), [stats.totalScore]);
  const levelEntry = useMemo(() => getLevelEntry(level), [level]);

  useEffect(() => {
    xpAnim.setValue(0);
    streakAnim.setValue(0);
    cardsAnim.setValue(0);

    Animated.stagger(100, [
      Animated.timing(xpAnim, { toValue: stats.totalScore, duration: 800, useNativeDriver: false }),
      Animated.timing(streakAnim, { toValue: stats.currentStreak, duration: 600, useNativeDriver: false }),
      Animated.timing(cardsAnim, { toValue: stats.totalCardsStudied, duration: 800, useNativeDriver: false }),
    ]).start();
  }, [cardsAnim, stats.currentStreak, stats.totalCardsStudied, stats.totalScore, streakAnim, xpAnim]);

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

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}> 
      <LinearGradient
        colors={[theme.gradientStart, theme.gradientMid, theme.gradientEnd]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {isDark ? (
        <LinearGradient
          colors={['rgba(6, 10, 22, 0.06)', 'rgba(6, 10, 22, 0.34)', 'rgba(5, 8, 20, 0.76)']}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.95, y: 1 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      ) : null}

      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          testID="home-scroll-view"
        >
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>FlashQuest</Text>
              <Text style={styles.subtitle}>Deck. Set. Match.</Text>
            </View>
            <TouchableOpacity
              style={[
                styles.profileButton,
                isDark
                  ? {
                      backgroundColor: 'rgba(15, 23, 42, 0.42)',
                      borderWidth: 1,
                      borderColor: 'rgba(148, 163, 184, 0.18)',
                    }
                  : null,
              ]}
              onPress={handleOpenProfile}
              onLongPress={handleProfileLongPress}
              delayLongPress={700}
              activeOpacity={0.8}
              testID="home-profile-button"
            >
              <LinearGradient
                colors={['rgba(255, 255, 255, 0.25)', 'rgba(255, 255, 255, 0.15)']}
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
                backgroundColor: isDark ? 'rgba(15, 23, 42, 0.78)' : theme.statsCard,
                borderWidth: isDark ? 1 : 0,
                borderColor: isDark ? 'rgba(148, 163, 184, 0.16)' : 'transparent',
              },
            ]}
          >
            <View style={styles.statItem}>
              <Text style={[styles.levelText, { color: theme.primary }]}>LV {level}</Text>
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>{levelEntry.title}</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: isDark ? 'rgba(148, 163, 184, 0.14)' : '#e0e0e0' }]} />
            <View style={styles.statItem}>
              <AnimatedStatValue animValue={streakAnim} style={[styles.statValue, { color: theme.primary }]} />
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Day Streak</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: isDark ? 'rgba(148, 163, 184, 0.14)' : '#e0e0e0' }]} />
            <View style={styles.statItem}>
              <AnimatedStatValue animValue={cardsAnim} style={[styles.statValue, { color: theme.primary }]} />
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Cards Studied</Text>
            </View>
          </View>

          <Text style={styles.gridLabel}>MODES</Text>

          <View style={styles.actionsGrid}>
            <TouchableOpacity
              style={[styles.actionCard, styles.actionCardMedium]}
              onPress={() => router.push('/arena' as Href)}
              activeOpacity={0.85}
              testID="home-action-battle"
            >
              <LinearGradient
                colors={theme.arenaGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.actionGradient}
              >
                <Swords color="#fff" size={36} strokeWidth={2} />
                <Text style={styles.actionTitleMedium}>Battle</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionCard, styles.actionCardMedium]}
              onPress={() => router.push('/quest' as Href)}
              activeOpacity={0.85}
              testID="home-action-quest"
            >
              <LinearGradient
                colors={theme.questGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.actionGradient}
              >
                <Target color="#fff" size={36} strokeWidth={2} />
                <Text style={styles.actionTitleMedium}>Quest</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionCard, styles.actionCardMedium]}
              onPress={() => router.push('/stats' as Href)}
              activeOpacity={0.85}
              testID="home-action-stats"
            >
              <LinearGradient
                colors={theme.scoreGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.actionGradient}
              >
                <Trophy color="#fff" size={36} strokeWidth={2} />
                <Text style={styles.actionTitleMedium}>Your Stats</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionCard, styles.actionCardMedium]}
              onPress={() => router.push('/decks' as Href)}
              activeOpacity={0.85}
              testID="home-action-decks"
            >
              <LinearGradient
                colors={theme.deckGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.actionGradient}
              >
                <BookOpen color="#fff" size={36} strokeWidth={2} />
                <Text style={styles.actionTitleMedium}>Decks</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>

          <View style={styles.decksSection}>
            <Text style={styles.sectionTitle}>
              {recommendations.length > 0 ? 'Recommended for You' : 'Quick Start'}
            </Text>
            {decks.length === 0 ? (
              <View style={styles.quickStartEmptyState}>
                <Text style={styles.quickStartEmptyTitle}>No decks yet</Text>
                <Text style={styles.quickStartEmptySubtitle}>Create a deck to see it here.</Text>
                <TouchableOpacity
                  style={styles.quickStartEmptyButton}
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
                          backgroundColor: isDark ? 'rgba(10, 17, 34, 0.88)' : theme.deckCardBg,
                          borderWidth: isDark ? 1 : 0,
                          borderColor: isDark ? 'rgba(148, 163, 184, 0.12)' : 'transparent',
                        },
                      ]}
                      onPress={() => router.push({ pathname: '/deck-hub', params: { deckId: rec.deckId } } as Href)}
                      activeOpacity={0.9}
                      testID={`home-recommendation-${rec.deckId}`}
                    >
                      <View style={[styles.deckColorStrip, { backgroundColor: rec.color }]} />
                      <View style={styles.deckContent}>
                        <Text style={[styles.deckName, { color: theme.text }]} numberOfLines={2}>{rec.name}</Text>
                        <Text style={[styles.deckCards, { color: theme.textSecondary }]}>{recDeck?.flashcards.length ?? 0} cards · {recPct}%</Text>
                        {recMastery && recMastery.total > 0 ? (
                          <View style={styles.deckMiniBar}>
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
                          backgroundColor: isDark ? 'rgba(10, 17, 34, 0.88)' : theme.deckCardBg,
                          borderWidth: isDark ? 1 : 0,
                          borderColor: isDark ? 'rgba(148, 163, 184, 0.12)' : 'transparent',
                        },
                      ]}
                      onPress={() => router.push({ pathname: '/deck-hub', params: { deckId: deck.id } } as Href)}
                      activeOpacity={0.9}
                      testID={`home-quick-start-${deck.id}`}
                    >
                      <View style={[styles.deckColorStrip, { backgroundColor: deck.color }]} />
                      <View style={styles.deckContent}>
                        <Text style={[styles.deckName, { color: theme.text }]} numberOfLines={2}>
                          {deck.name}
                        </Text>
                        <Text style={[styles.deckCards, { color: theme.textSecondary }]}>{deck.flashcards.length} cards · {deckPct}%</Text>
                        {deckMastery.total > 0 ? (
                          <View style={styles.deckMiniBar}>
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
    paddingBottom: 40,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  profileButton: {
    width: 50,
    height: 50,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
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
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 20,
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  statItem: {
    alignItems: 'center',
  },
  levelText: {
    fontSize: 28,
    fontWeight: '800' as const,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 32,
    fontWeight: '800' as const,
    color: '#667eea',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 13,
    color: '#666',
    fontWeight: '600' as const,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#e0e0e0',
  },
  gridLabel: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: 'rgba(255, 255, 255, 0.45)',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    paddingHorizontal: 24,
    marginTop: 28,
    marginBottom: 12,
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
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 6,
  },
  actionCardMedium: {
    width: (width - 64) / 2,
    height: 140,
  },
  actionGradient: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionTitleMedium: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#fff',
    marginTop: 12,
    textAlign: 'center',
  },
  decksSection: {
    marginTop: 40,
    paddingHorizontal: 24,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: '#fff',
    marginBottom: 16,
  },
  decksScroll: {
    gap: 12,
    paddingRight: 24,
  },
  quickStartEmptyState: {
    alignItems: 'flex-start',
    padding: 18,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
  },
  quickStartEmptyTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
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
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  quickStartEmptyButtonText: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#fff',
  },
  deckCard: {
    width: 160,
    height: 110,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  deckColorStrip: {
    height: 6,
    width: '100%',
  },
  deckContent: {
    flex: 1,
    padding: 12,
    justifyContent: 'center',
  },
  deckName: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#333',
    marginBottom: 4,
  },
  deckCards: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500' as const,
  },
  deckMiniBar: {
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginTop: 8,
    overflow: 'hidden',
  },
  deckMiniBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  recommendationMessage: {
    fontSize: 12,
    fontWeight: '600' as const,
    marginTop: 4,
  },
});
