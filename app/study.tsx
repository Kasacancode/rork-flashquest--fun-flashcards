import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Check, X, RotateCcw } from 'lucide-react-native';
import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useFlashQuest } from '@/context/FlashQuestContext';
import { useTheme } from '@/context/ThemeContext';

export default function StudyPage() {
  const router = useRouter();
  const params = useLocalSearchParams<{ deckId?: string }>();
  const { decks, updateProgress } = useFlashQuest();
  const { theme, isDark } = useTheme();

  const [showDeckSelector, setShowDeckSelector] = useState<boolean>(!params.deckId);
  const [selectedDeckId, setSelectedDeckId] = useState<string | null>(params.deckId || null);
  const [currentCardIndex, setCurrentCardIndex] = useState<number>(0);
  const [showAnswer, setShowAnswer] = useState<boolean>(false);
  const [flipAnimation] = useState(new Animated.Value(0));
  const [sessionCorrect, setSessionCorrect] = useState<number>(0);
  const [sessionTotal, setSessionTotal] = useState<number>(0);
  const [showResults, setShowResults] = useState<boolean>(false);

  const selectedDeck = useMemo(
    () => decks.find((d) => d.id === selectedDeckId),
    [decks, selectedDeckId]
  );

  const currentCard = useMemo(() => {
    if (!selectedDeck) return null;
    return selectedDeck.flashcards[currentCardIndex];
  }, [selectedDeck, currentCardIndex]);

  const handleDeckSelect = (deckId: string) => {
    setSelectedDeckId(deckId);
    setShowDeckSelector(false);
    setCurrentCardIndex(0);
    setShowAnswer(false);
    setSessionCorrect(0);
    setSessionTotal(0);
    setShowResults(false);
  };

  const handleFlipCard = () => {
    Animated.timing(flipAnimation, {
      toValue: showAnswer ? 0 : 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
    setShowAnswer(!showAnswer);
  };

  const handleAnswer = (correct: boolean) => {
    if (!selectedDeck) return;

    updateProgress(selectedDeck.id, correct);
    setSessionCorrect(sessionCorrect + (correct ? 1 : 0));
    setSessionTotal(sessionTotal + 1);

    if (currentCardIndex + 1 < selectedDeck.flashcards.length) {
      setCurrentCardIndex(currentCardIndex + 1);
      setShowAnswer(false);
      flipAnimation.setValue(0);
    } else {
      setShowResults(true);
    }
  };

  const handleRestart = () => {
    setCurrentCardIndex(0);
    setShowAnswer(false);
    setSessionCorrect(0);
    setSessionTotal(0);
    setShowResults(false);
    flipAnimation.setValue(0);
  };

  if (showResults && selectedDeck) {
    const accuracy = Math.round((sessionCorrect / sessionTotal) * 100);

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
            <Text style={styles.resultsTitle}>🎓 Session Complete!</Text>
            <Text style={styles.resultsSubtitle}>Great work studying {selectedDeck.name}</Text>

            <View style={styles.resultsCard}>
              <View style={styles.resultStat}>
                <Text style={styles.resultStatValue}>{sessionCorrect}</Text>
                <Text style={styles.resultStatLabel}>Correct</Text>
              </View>
              <View style={styles.resultStatDivider} />
              <View style={styles.resultStat}>
                <Text style={styles.resultStatValue}>{sessionTotal}</Text>
                <Text style={styles.resultStatLabel}>Total</Text>
              </View>
              <View style={styles.resultStatDivider} />
              <View style={styles.resultStat}>
                <Text style={styles.resultStatValue}>{accuracy}%</Text>
                <Text style={styles.resultStatLabel}>Accuracy</Text>
              </View>
            </View>

            <TouchableOpacity style={styles.restartButton} onPress={handleRestart}>
              <RotateCcw color="#fff" size={24} strokeWidth={2} />
              <Text style={styles.restartButtonText}>Study Again</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.homeButton} onPress={() => router.back()}>
              <Text style={styles.homeButtonText}>Back to Home</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  if (!selectedDeck || !currentCard) {
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

  const progress = ((currentCardIndex + 1) / selectedDeck.flashcards.length) * 100;

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

        <View style={styles.progressContainer}>
          <Text style={styles.progressText}>
            {currentCardIndex + 1} / {selectedDeck.flashcards.length}
          </Text>
          <View style={styles.progressBar}>
            <View style={[styles.progressBarFill, { width: `${progress}%` }]} />
          </View>
        </View>

        <View style={styles.cardContainer}>
          <TouchableOpacity
            style={[styles.flashcard, { backgroundColor: isDark ? theme.card : '#fff' }]}
            onPress={handleFlipCard}
            activeOpacity={0.95}
          >
            <View style={styles.flashcardContent}>
              {!showAnswer ? (
                <>
                  <Text style={styles.cardLabel}>QUESTION</Text>
                  <Text style={[styles.cardText, { color: isDark ? theme.text : '#333' }]}>{currentCard.question}</Text>
                  <Text style={[styles.tapHint, { color: isDark ? theme.textSecondary : '#999' }]}>Tap to reveal answer</Text>
                </>
              ) : (
                <>
                  <Text style={styles.cardLabel}>ANSWER</Text>
                  <Text style={[styles.cardText, { color: isDark ? theme.text : '#333' }]}>{currentCard.answer}</Text>
                  <Text style={[styles.tapHint, { color: isDark ? theme.textSecondary : '#999' }]}>How did you do?</Text>
                </>
              )}
            </View>
          </TouchableOpacity>

          {showAnswer && (
            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={[styles.actionButton, styles.wrongButton]}
                onPress={() => handleAnswer(false)}
              >
                <X color="#fff" size={32} strokeWidth={2.5} />
                <Text style={styles.actionButtonText}>Wrong</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, styles.correctButton]}
                onPress={() => handleAnswer(true)}
              >
                <Check color="#fff" size={32} strokeWidth={2.5} />
                <Text style={styles.actionButtonText}>Correct</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
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
  progressContainer: {
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  progressText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#fff',
    marginBottom: 8,
    textAlign: 'center',
  },
  progressBar: {
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#fff',
    borderRadius: 4,
  },
  cardContainer: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  flashcard: {
    backgroundColor: '#fff',
    borderRadius: 32,
    padding: 40,
    minHeight: 400,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
    elevation: 16,
  },
  flashcardContent: {
    alignItems: 'center',
  },
  cardLabel: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#667eea',
    marginBottom: 20,
    letterSpacing: 2,
  },
  cardText: {
    fontSize: 26,
    fontWeight: '700' as const,
    color: '#333',
    textAlign: 'center',
    lineHeight: 38,
    marginBottom: 24,
  },
  tapHint: {
    fontSize: 14,
    color: '#999',
    fontWeight: '500' as const,
  },
  actionButtons: {
    flexDirection: 'row',
    marginTop: 32,
    gap: 16,
  },
  actionButton: {
    flex: 1,
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  wrongButton: {
    backgroundColor: '#F44336',
  },
  correctButton: {
    backgroundColor: '#4CAF50',
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#fff',
    marginTop: 8,
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
