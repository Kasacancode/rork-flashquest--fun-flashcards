import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, type Href } from 'expo-router';
import { Trophy, BookOpen, Swords, Target, User } from 'lucide-react-native';
import React, { useCallback, useRef } from 'react';
import { Alert, View, Text, StyleSheet, TouchableOpacity, ScrollView, Dimensions, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useDeveloperAccess } from '@/context/DeveloperAccessContext';
import { useFlashQuest } from '@/context/FlashQuestContext';
import { useTheme } from '@/context/ThemeContext';

const { width } = Dimensions.get('window');

export default function HomePage() {
  const router = useRouter();
  const { stats, decks } = useFlashQuest();
  const { theme, isDark } = useTheme();
  const {
    canAccessDeveloperTools,
    disableDeveloperAccess,
    enableDeveloperAccess,
    isReady: isDeveloperAccessReady,
  } = useDeveloperAccess();
  const didHandleLongPressRef = useRef<boolean>(false);

  const handleOpenProfile = useCallback(() => {
    if (didHandleLongPressRef.current) {
      didHandleLongPressRef.current = false;
      return;
    }

    router.push('/profile' as Href);
  }, [router]);

  const handleProfileLongPress = useCallback(() => {
    if (!__DEV__ || !isDeveloperAccessReady) {
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
              <View style={styles.titleRow}>
                <Image
                  source={require('@/assets/images/flashquest-q-logo.png')}
                  style={styles.headerLogo}
                  resizeMode="contain"
                />
                <Text style={styles.title}>FlashQuest</Text>
              </View>
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
              <Text style={[styles.statValue, { color: theme.primary }]}>{stats.totalScore}</Text>
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Total XP</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: isDark ? 'rgba(148, 163, 184, 0.14)' : '#e0e0e0' }]} />
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: theme.primary }]}>{stats.currentStreak}</Text>
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Day Streak</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: isDark ? 'rgba(148, 163, 184, 0.14)' : '#e0e0e0' }]} />
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: theme.primary }]}>{stats.totalCardsStudied}</Text>
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Cards Studied</Text>
            </View>
          </View>

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
                <Text style={styles.actionTitleMedium}>Stats</Text>
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
            <Text style={styles.sectionTitle}>Quick Start</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.decksScroll}
              testID="home-quick-start-scroll"
            >
              {decks.slice(0, 5).map((deck) => (
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
                  onPress={() => router.push({ pathname: '/study', params: { deckId: deck.id } } as Href)}
                  activeOpacity={0.9}
                  testID={`home-quick-start-${deck.id}`}
                >
                  <View style={[styles.deckColorStrip, { backgroundColor: deck.color }]} />
                  <View style={styles.deckContent}>
                    <Text style={[styles.deckName, { color: theme.text }]} numberOfLines={2}>
                      {deck.name}
                    </Text>
                    <Text style={[styles.deckCards, { color: theme.textSecondary }]}>{deck.flashcards.length} cards</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
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
  titleRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10,
  },
  headerLogo: {
    width: 38,
    height: 38,
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
  actionsGrid: {
    paddingHorizontal: 24,
    marginTop: 32,
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
  deckCard: {
    width: 160,
    height: 100,
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
});
