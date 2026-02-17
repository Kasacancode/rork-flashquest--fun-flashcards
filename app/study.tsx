import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, RotateCcw } from 'lucide-react-native';
import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import StudyFeed from '@/components/StudyFeed';
import { useFlashQuest } from '@/context/FlashQuestContext';
import { Flashcard } from '@/types/flashcard';
import { useTheme } from '@/context/ThemeContext';
import { logger } from '@/utils/logger';

export default function StudyPage() {
  const router = useRouter();
  const params = useLocalSearchParams<{ deckId?: string }>();
  const { decks, updateProgress, updateFlashcard, applyGameResult } = useFlashQuest();
  const { theme, isDark } = useTheme();

  const [showDeckSelector, setShowDeckSelector] = useState<boolean>(!params.deckId);
  const [selectedDeckId, setSelectedDeckId] = useState<string | null>(params.deckId || null);
  const [sessionResolved, setSessionResolved] = useState<number>(0);
  const [showResults, setShowResults] = useState<boolean>(false);

  const selectedDeck = useMemo(
    () => decks.find((d) => d.id === selectedDeckId),
    [decks, selectedDeckId]
  );

  const handleDeckSelect = useCallback((deckId: string) => {
    setSelectedDeckId(deckId);
    setShowDeckSelector(false);
    setSessionResolved(0);
    setShowResults(false);
  }, []);

  const handleCardResolved = useCallback((cardId: string) => {
    if (selectedDeck) {
      updateProgress(selectedDeck.id);
      setSessionResolved(prev => prev + 1);
    }
  }, [selectedDeck, updateProgress]);

  const handleComplete = useCallback(() => {
    if (selectedDeck) {
      const xpEarned = sessionResolved * 5;
      applyGameResult({
        mode: 'study',
        deckId: selectedDeck.id,
        xpEarned,
        cardsAttempted: sessionResolved,
        timestampISO: new Date().toISOString(),
      });
      logger.log('[Study] Session complete, cards:', sessionResolved, 'xp:', xpEarned);
    }
    setShowResults(true);
  }, [selectedDeck, sessionResolved, applyGameResult]);

  const handleRestart = useCallback(() => {
    setSessionResolved(0);
    setShowResults(false);
  }, []);

  const handleUpdateCard = useCallback((cardId: string, updates: Partial<Flashcard>) => {
    if (selectedDeck) {
      updateFlashcard(selectedDeck.id, cardId, updates);
    }
  }, [selectedDeck, updateFlashcard]);

  if (showResults && selectedDeck) {
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={isDark ? ['#1a1a2e', '#16213e', '#0f3460'] : ['#667eea', '#764ba2', '#F093FB']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />

        <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
          <View style={styles.resultsContainer}>
            <Text style={styles.resultsTitle}>Deck Complete!</Text>
            <Text style={styles.resultsSubtitle}>Great work studying {selectedDeck.name}</Text>

            <View style={styles.resultsCard}>
              <View style={styles.resultStat}>
                <Text style={styles.resultStatValue}>{sessionResolved}</Text>
                <Text style={styles.resultStatLabel}>Completed</Text>
              </View>
              <View style={styles.resultStatDivider} />
              <View style={styles.resultStat}>
                <Text style={styles.resultStatValue}>{selectedDeck.flashcards.length}</Text>
                <Text style={styles.resultStatLabel}>Total Cards</Text>
              </View>
            </View>

            <TouchableOpacity style={styles.restartButton} onPress={handleRestart}>
              <RotateCcw color="#fff" size={24} strokeWidth={2} />
              <Text style={styles.restartButtonText}>Study Again</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.homeButton} onPress={() => router.back()}>
              <Text style={styles.homeButtonText}>Back to Decks</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  if (!selectedDeck) {
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={isDark ? ['#1a1a2e', '#16213e'] : ['#667eea', '#764ba2']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />

        <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <ArrowLeft color="#fff" size={28} strokeWidth={2.5} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Study Mode</Text>
            <View style={styles.placeholder} />
          </View>

          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>Select a deck to start studying</Text>
            <TouchableOpacity
              style={styles.selectButton}
              onPress={() => setShowDeckSelector(true)}
            >
              <Text style={styles.selectButtonText}>Choose Deck</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>

        <Modal
          visible={showDeckSelector}
          animationType="slide"
          transparent
          onRequestClose={() => {
            if (!selectedDeckId) {
              router.back();
            } else {
              setShowDeckSelector(false);
            }
          }}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: isDark ? theme.card : '#fff' }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: isDark ? theme.text : '#333' }]}>Select a Deck</Text>
                <TouchableOpacity
                  onPress={() => {
                    if (!selectedDeckId) {
                      router.back();
                    } else {
                      setShowDeckSelector(false);
                    }
                  }}
                >
                  <Text style={[styles.modalClose, { color: isDark ? theme.textSecondary : '#666' }]}>✕</Text>
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.deckList} showsVerticalScrollIndicator={false}>
                {decks.map((deck) => (
                  <TouchableOpacity
                    key={deck.id}
                    style={[styles.deckOption, { backgroundColor: theme.deckOption }]}
                    onPress={() => handleDeckSelect(deck.id)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.deckColorDot, { backgroundColor: deck.color }]} />
                    <View style={styles.deckOptionInfo}>
                      <Text style={[styles.deckOptionName, { color: isDark ? '#f1f5f9' : '#333' }]}>{deck.name}</Text>
                      <Text style={[styles.deckOptionCards, { color: isDark ? '#cbd5e1' : '#666' }]}>{deck.flashcards.length} cards</Text>
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

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={isDark ? ['#1a1a2e', '#16213e'] : ['#667eea', '#764ba2']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft color="#fff" size={28} strokeWidth={2.5} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{selectedDeck.name}</Text>
          <View style={styles.placeholder} />
        </View>

        <StudyFeed
          flashcards={selectedDeck.flashcards}
          theme={theme}
          isDark={isDark}
          onComplete={handleComplete}
          onCardResolved={handleCardResolved}
          onUpdateCard={handleUpdateCard}
        />
      </SafeAreaView>

      <Modal
        visible={showDeckSelector}
        animationType="slide"
        transparent
        onRequestClose={() => setShowDeckSelector(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: isDark ? theme.card : '#fff' }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: isDark ? theme.text : '#333' }]}>Select a Deck</Text>
              <TouchableOpacity onPress={() => setShowDeckSelector(false)}>
                <Text style={[styles.modalClose, { color: isDark ? theme.textSecondary : '#666' }]}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.deckList} showsVerticalScrollIndicator={false}>
              {decks.map((deck) => (
                <TouchableOpacity
                  key={deck.id}
                  style={[styles.deckOption, { backgroundColor: theme.deckOption }]}
                  onPress={() => handleDeckSelect(deck.id)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.deckColorDot, { backgroundColor: deck.color }]} />
                  <View style={styles.deckOptionInfo}>
                    <Text style={[styles.deckOptionName, { color: isDark ? '#f1f5f9' : '#333' }]}>{deck.name}</Text>
                    <Text style={[styles.deckOptionCards, { color: isDark ? '#cbd5e1' : '#666' }]}>{deck.flashcards.length} cards</Text>
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
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#fff',
  },
  placeholder: {
    width: 40,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  emptyText: {
    fontSize: 18,
    color: '#fff',
    marginBottom: 24,
    textAlign: 'center',
    fontWeight: '600' as const,
  },
  selectButton: {
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingHorizontal: 32,
    paddingVertical: 16,
  },
  selectButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#667eea',
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
  resultsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  resultsTitle: {
    fontSize: 42,
    fontWeight: '800' as const,
    color: '#fff',
    marginBottom: 8,
    textAlign: 'center',
  },
  resultsSubtitle: {
    fontSize: 18,
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: 40,
    textAlign: 'center',
    fontWeight: '600' as const,
  },
  resultsCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 24,
    padding: 32,
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 32,
  },
  resultStat: {
    alignItems: 'center',
  },
  resultStatValue: {
    fontSize: 36,
    fontWeight: '800' as const,
    color: '#667eea',
    marginBottom: 4,
  },
  resultStatLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '600' as const,
  },
  resultStatDivider: {
    width: 1,
    backgroundColor: '#e0e0e0',
  },
  restartButton: {
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingHorizontal: 32,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    width: '100%',
    justifyContent: 'center',
    marginBottom: 16,
  },
  restartButtonText: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#667eea',
  },
  homeButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 16,
    paddingHorizontal: 32,
    paddingVertical: 16,
    width: '100%',
  },
  homeButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#fff',
    textAlign: 'center',
  },
});
