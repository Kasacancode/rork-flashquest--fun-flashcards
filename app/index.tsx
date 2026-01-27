import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Trophy, BookOpen, Swords, Target, User, Shuffle } from 'lucide-react-native';
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Dimensions, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useFlashQuest } from '@/context/FlashQuestContext';
import { useTheme } from '@/context/ThemeContext';

const { width } = Dimensions.get('window');

export default function HomePage() {
  const router = useRouter();
  const { stats, decks, startDuel } = useFlashQuest();
  const { theme } = useTheme();
  const [showDeckSelector, setShowDeckSelector] = useState<boolean>(false);
  const [selectedMode, setSelectedMode] = useState<'ai' | 'multiplayer' | null>(null);
  const [shouldShuffle, setShouldShuffle] = useState<boolean>(false);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <LinearGradient
        colors={[theme.gradientStart, theme.gradientMid, theme.gradientEnd]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>FlashQuest</Text>
              <Text style={styles.subtitle}>Learn. Battle. Conquer.</Text>
            </View>
            <TouchableOpacity
              style={styles.profileButton}
              onPress={() => router.push('/profile')}
              activeOpacity={0.8}
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

          <View style={[styles.statsCard, { backgroundColor: theme.statsCard }]}>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: theme.primary }]}>{stats.totalScore}</Text>
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Total Score</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: theme.primary }]}>{stats.currentStreak}</Text>
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Day Streak</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: theme.primary }]}>{decks.length}</Text>
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Decks</Text>
            </View>
          </View>

          <View style={styles.actionsGrid}>
            <TouchableOpacity
              style={[styles.actionCard, styles.actionCardMedium]}
              onPress={() => router.push('/stats')}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={theme.scoreGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.actionGradient}
              >
                <Trophy color="#fff" size={36} strokeWidth={2} />
                <Text style={styles.actionTitleMedium}>Score</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionCard, styles.actionCardMedium]}
              onPress={() => router.push('/decks')}
              activeOpacity={0.85}
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

            <TouchableOpacity
              style={[styles.actionCard, styles.actionCardMedium]}
              onPress={() => {
                setSelectedMode('multiplayer');
                setShowDeckSelector(true);
              }}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={theme.arenaGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.actionGradient}
              >
                <Swords color="#fff" size={36} strokeWidth={2} />
                <Text style={styles.actionTitleMedium}>Arena</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionCard, styles.actionCardMedium]}
              onPress={() => router.push('/quest')}
              activeOpacity={0.85}
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
          </View>

          <View style={styles.decksSection}>
            <Text style={styles.sectionTitle}>Quick Start</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.decksScroll}
            >
              {decks.slice(0, 5).map((deck) => (
                <TouchableOpacity
                  key={deck.id}
                  style={[styles.deckCard, { backgroundColor: theme.deckCardBg }]}
                  onPress={() => router.push({ pathname: '/study', params: { deckId: deck.id } })}
                  activeOpacity={0.9}
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

      <Modal
        visible={showDeckSelector}
        animationType="slide"
        transparent
        onRequestClose={() => setShowDeckSelector(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.cardBackground }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>Select a Deck</Text>
              <TouchableOpacity onPress={() => setShowDeckSelector(false)}>
                <Text style={[styles.modalClose, { color: theme.textSecondary }]}>✕</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.shuffleButton, { backgroundColor: shouldShuffle ? theme.primary : theme.background }]}
              onPress={() => setShouldShuffle(!shouldShuffle)}
              activeOpacity={0.7}
            >
              <Shuffle color={shouldShuffle ? '#fff' : theme.text} size={20} strokeWidth={2.5} />
              <Text style={[styles.shuffleText, { color: shouldShuffle ? '#fff' : theme.text }]}>
                {shouldShuffle ? 'Shuffled' : 'Shuffle Deck'}
              </Text>
            </TouchableOpacity>

            <ScrollView style={styles.deckList} showsVerticalScrollIndicator={false}>
              {decks.map((deck) => (
                <TouchableOpacity
                  key={deck.id}
                  style={[styles.deckOption, { backgroundColor: theme.background }]}
                  onPress={() => {
                    if (selectedMode) {
                      startDuel(deck.id, selectedMode, shouldShuffle);
                      setShowDeckSelector(false);
                      setShouldShuffle(false);
                      router.push({ pathname: '/duel-session', params: { deckId: deck.id } });
                    }
                  }}
                  activeOpacity={0.7}
                >
                  <View style={[styles.deckColorDot, { backgroundColor: deck.color }]} />
                  <View style={styles.deckOptionInfo}>
                    <Text style={[styles.deckOptionName, { color: theme.text }]}>{deck.name}</Text>
                    <Text style={[styles.deckOptionCards, { color: theme.textSecondary }]}>{deck.flashcards.length} cards</Text>
                  </View>
                </TouchableOpacity>
              ))}
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
  actionIcon: {
    marginBottom: 12,
  },
  actionTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#fff',
    marginBottom: 4,
    textAlign: 'center',
  },
  actionSubtitle: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    fontWeight: '500' as const,
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
  shuffleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 24,
    marginBottom: 16,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 16,
    gap: 10,
  },
  shuffleText: {
    fontSize: 16,
    fontWeight: '700' as const,
  },
});
