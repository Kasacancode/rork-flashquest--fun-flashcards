import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { ArrowLeft, BookOpen, Edit, Plus } from 'lucide-react-native';
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useFlashQuest } from '@/context/FlashQuestContext';
import { useTheme } from '@/context/ThemeContext';
import { Deck } from '@/types/flashcard';

export default function DecksPage() {
  const router = useRouter();
  const { decks } = useFlashQuest();
  const { theme } = useTheme();

  const handleStudyDeck = (deckId: string) => {
    router.push({ pathname: '/study', params: { deckId } });
  };

  const handleEditDeck = (deckId: string) => {
    router.push({ pathname: '/create-flashcard', params: { deckId } });
  };



  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <LinearGradient
        colors={[theme.gradientStart, theme.gradientMid, theme.gradientEnd]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft color="#fff" size={28} strokeWidth={2.5} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>My Decks</Text>
          <TouchableOpacity 
            style={styles.addButton}
            onPress={() => router.push('/create-flashcard')}
          >
            <Plus color="#fff" size={28} strokeWidth={2.5} />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.deckCount}>
            {decks.length} {decks.length === 1 ? 'deck' : 'decks'} available
          </Text>

          {decks.map((deck: Deck) => (
            <View key={deck.id} style={[styles.deckCard, { backgroundColor: theme.cardBackground }]}>
              <View style={[styles.deckColorBar, { backgroundColor: deck.color }]} />
              
              <View style={styles.deckContent}>
                <View style={styles.deckHeader}>
                  <View style={styles.deckInfo}>
                    <Text style={[styles.deckName, { color: theme.text }]} numberOfLines={1}>
                      {deck.name}
                    </Text>
                    <Text style={[styles.deckDescription, { color: theme.textSecondary }]} numberOfLines={2}>
                      {deck.description}
                    </Text>
                  </View>
                </View>

                <View style={styles.deckStats}>
                  <View style={styles.statBadge}>
                    <BookOpen color={theme.textSecondary} size={16} strokeWidth={2} />
                    <Text style={[styles.statText, { color: theme.textSecondary }]}>
                      {deck.flashcards.length} cards
                    </Text>
                  </View>
                  <View style={[styles.categoryBadge, { backgroundColor: theme.background }]}>
                    <Text style={[styles.categoryText, { color: theme.text }]}>{deck.category}</Text>
                  </View>
                </View>

                <View style={styles.deckActions}>
                  <TouchableOpacity
                    style={[styles.studyButton, { backgroundColor: theme.primary }]}
                    onPress={() => handleStudyDeck(deck.id)}
                    activeOpacity={0.8}
                  >
                    <BookOpen color="#fff" size={20} strokeWidth={2.5} />
                    <Text style={styles.studyButtonText}>Study</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.actionButton, { backgroundColor: theme.background }]}
                    onPress={() => handleEditDeck(deck.id)}
                    activeOpacity={0.8}
                  >
                    <Edit color={theme.text} size={20} strokeWidth={2.5} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ))}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
    fontSize: 24,
    fontWeight: '800' as const,
    color: '#fff',
  },
  addButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  deckCount: {
    fontSize: 14,
    fontWeight: '600' as const,
    marginBottom: 16,
    color: '#fff',
  },
  deckCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    marginBottom: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  deckColorBar: {
    height: 6,
    width: '100%',
  },
  deckContent: {
    padding: 20,
  },
  deckHeader: {
    marginBottom: 12,
  },
  deckInfo: {
    flex: 1,
  },
  deckName: {
    fontSize: 20,
    fontWeight: '800' as const,
    color: '#333',
    marginBottom: 6,
  },
  deckDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    fontWeight: '500' as const,
  },
  deckStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  statBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#666',
  },
  categoryBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: '#333',
  },
  deckActions: {
    flexDirection: 'row',
    gap: 12,
  },
  studyButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#667eea',
    borderRadius: 12,
    paddingVertical: 14,
    gap: 8,
  },
  studyButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#fff',
  },
  actionButton: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: '#f5f5f5',
  },
});
