import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Plus, Share2, Trash2, FileText, ChevronUp, ChevronDown } from 'lucide-react-native';
import React, { useCallback, useState, useEffect, useMemo } from 'react';
import * as Clipboard from 'expo-clipboard';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import DeckCategoryPicker from '@/components/DeckCategoryPicker';
import {
  MANUAL_DEFAULT_DECK_CATEGORY,
  PRESET_DECK_CATEGORIES,
} from '@/constants/deckCategories';
import { useArena } from '@/context/ArenaContext';
import { useFlashQuest } from '@/context/FlashQuestContext';
import { usePerformance } from '@/context/PerformanceContext';
import { useTheme } from '@/context/ThemeContext';
import { trackEvent } from '@/lib/analytics';
import { Flashcard } from '@/types/flashcard';
import { logger } from '@/utils/logger';
import { generateUUID } from '@/utils/uuid';

interface CardInput {
  id: string;
  originalCardId: string | null;
  question: string;
  answer: string;
}

export default function CreateFlashcardPage() {
  const router = useRouter();
  const { deckId } = useLocalSearchParams<{ deckId?: string }>();
  const { addDeck, updateDeck, deleteDeck, decks } = useFlashQuest();
  const { cleanupDeck: cleanupPerformance } = usePerformance();
  const { cleanupDeck: cleanupArena } = useArena();
  const { theme, isDark } = useTheme();

  const [deckName, setDeckName] = useState<string>('');
  const [deckDescription, setDeckDescription] = useState<string>('');
  const [cards, setCards] = useState<CardInput[]>([
    { id: '1', originalCardId: null, question: '', answer: '' },
  ]);
  const [editingDeckId, setEditingDeckId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>(MANUAL_DEFAULT_DECK_CATEGORY);
  const [showCustomCategory, setShowCustomCategory] = useState<boolean>(false);
  const [customCategoryInput, setCustomCategoryInput] = useState<string>('');

  useEffect(() => {
    if (deckId && typeof deckId === 'string') {
      const deck = decks.find(d => d.id === deckId);
      if (deck) {
        setDeckName(deck.name);
        setDeckDescription(deck.description);
        setCards(deck.flashcards.map((f, i) => ({
          id: `${i}`,
          originalCardId: f.id,
          question: f.question,
          answer: f.answer,
        })));
        const deckCategory = deck.category?.trim() || MANUAL_DEFAULT_DECK_CATEGORY;
        setSelectedCategory(deckCategory);
        setCustomCategoryInput(PRESET_DECK_CATEGORIES.includes(deckCategory as typeof PRESET_DECK_CATEGORIES[number]) ? '' : deckCategory);
        setShowCustomCategory(false);
        setEditingDeckId(deck.id);
      }
    }
  }, [deckId, decks]);

  const addCard = () => {
    setCards([...cards, { id: Date.now().toString(), originalCardId: null, question: '', answer: '' }]);
  };

  const removeCard = (id: string) => {
    if (cards.length > 1) {
      setCards(cards.filter((c) => c.id !== id));
    }
  };

  const updateCard = (id: string, field: 'question' | 'answer', value: string) => {
    setCards(
      cards.map((c) => (c.id === id ? { ...c, [field]: value } : c))
    );
  };

  const categoryOptions = useMemo(() => {
    const normalizedSelectedCategory = selectedCategory.trim();
    if (normalizedSelectedCategory && !PRESET_DECK_CATEGORIES.includes(normalizedSelectedCategory as typeof PRESET_DECK_CATEGORIES[number])) {
      return [...PRESET_DECK_CATEGORIES, normalizedSelectedCategory];
    }
    return [...PRESET_DECK_CATEGORIES];
  }, [selectedCategory]);

  const handleSelectCategory = (category: string) => {
    setSelectedCategory(category);
    setShowCustomCategory(false);
    setCustomCategoryInput('');
  };

  const handlePressCustomCategory = () => {
    const normalizedSelectedCategory = selectedCategory.trim();
    setCustomCategoryInput(
      normalizedSelectedCategory && !PRESET_DECK_CATEGORIES.includes(normalizedSelectedCategory as typeof PRESET_DECK_CATEGORIES[number])
        ? normalizedSelectedCategory
        : ''
    );
    setShowCustomCategory(true);
  };

  const handleSubmitCustomCategory = () => {
    const normalizedCustomCategory = customCategoryInput.trim();
    if (normalizedCustomCategory) {
      setSelectedCategory(normalizedCustomCategory);
      setCustomCategoryInput(normalizedCustomCategory);
    }
    setShowCustomCategory(false);
  };

  const handleShareDeck = useCallback(async () => {
    if (!editingDeckId) {
      return;
    }

    const existingDeck = decks.find((deck) => deck.id === editingDeckId);
    if (!existingDeck) {
      return;
    }

    try {
      const shareData = {
        _type: 'flashquest_deck',
        name: existingDeck.name,
        description: existingDeck.description,
        category: existingDeck.category,
        color: existingDeck.color,
        flashcards: existingDeck.flashcards.map((card) => ({
          question: card.question,
          answer: card.answer,
        })),
      };
      await Clipboard.setStringAsync(JSON.stringify(shareData));
      Alert.alert('Deck Copied!', `"${existingDeck.name}" has been copied to your clipboard. Paste it in a message to share with friends.`);
    } catch {
      Alert.alert('Error', 'Failed to copy deck. Please try again.');
    }
  }, [decks, editingDeckId]);

  const handleBulkPaste = useCallback(async () => {
    try {
      const text = await Clipboard.getStringAsync();
      if (!text || !text.trim()) {
        Alert.alert('Nothing to Paste', 'Copy a list of questions and answers to your clipboard first.\n\nFormat: one card per line, separated by | or ; or tab.\n\nExample:\nWhat is 2+2? | 4\nCapital of France? | Paris');
        return;
      }

      const lines = text.trim().split('\n').filter((line) => line.trim());
      const newCards: CardInput[] = [];

      for (const line of lines) {
        let parts: string[] = [];
        if (line.includes('|')) {
          parts = line.split('|').map((segment) => segment.trim());
        } else if (line.includes(';')) {
          parts = line.split(';').map((segment) => segment.trim());
        } else if (line.includes('\t')) {
          parts = line.split('\t').map((segment) => segment.trim());
        }

        if (parts.length >= 2 && parts[0] && parts[1]) {
          newCards.push({
            id: generateUUID(),
            originalCardId: null,
            question: parts[0].slice(0, 500),
            answer: parts[1].slice(0, 200),
          });
        }
      }

      if (newCards.length === 0) {
        Alert.alert('No Cards Found', 'Could not parse any question-answer pairs.\n\nMake sure each line has a question and answer separated by | or ; or tab.\n\nExample:\nWhat is 2+2? | 4\nCapital of France? | Paris');
        return;
      }

      Alert.alert(
        `${newCards.length} Cards Found`,
        `Add ${newCards.length} cards from your clipboard?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Add Cards',
            onPress: () => {
              const existingNonEmpty = cards.filter((card) => card.question.trim() || card.answer.trim());
              setCards([...existingNonEmpty, ...newCards]);
            },
          },
        ]
      );
    } catch {
      Alert.alert('Paste Failed', 'Could not read from clipboard.');
    }
  }, [cards]);

  const moveCardUp = useCallback((index: number) => {
    if (index <= 0) {
      return;
    }

    setCards((prev) => {
      const next = [...prev];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next;
    });
  }, []);

  const moveCardDown = useCallback((index: number) => {
    setCards((prev) => {
      if (index >= prev.length - 1) {
        return prev;
      }

      const next = [...prev];
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      return next;
    });
  }, []);

  const handleSave = () => {
    if (!deckName.trim()) {
      Alert.alert('Error', 'Please enter a deck name');
      return;
    }

    const validCards = cards.filter((c) => c.question.trim() && c.answer.trim());

    if (validCards.length === 0) {
      Alert.alert('Error', 'Please add at least one complete flashcard');
      return;
    }

    const resolvedCategory = selectedCategory.trim() || MANUAL_DEFAULT_DECK_CATEGORY;

    if (editingDeckId) {
      const existingDeck = decks.find(d => d.id === editingDeckId);
      const flashcards: Flashcard[] = validCards.map((c) => {
        if (c.originalCardId) {
          const existingCard = existingDeck?.flashcards.find(f => f.id === c.originalCardId);
          return {
            ...(existingCard || {} as Partial<Flashcard>),
            id: c.originalCardId,
            question: c.question.trim(),
            answer: c.answer.trim(),
            deckId: editingDeckId,
            difficulty: existingCard?.difficulty || 'medium' as const,
            createdAt: existingCard?.createdAt || Date.now(),
          };
        }
        return {
          id: generateUUID(),
          question: c.question.trim(),
          answer: c.answer.trim(),
          deckId: editingDeckId,
          difficulty: 'medium' as const,
          createdAt: Date.now(),
        };
      });

      updateDeck(editingDeckId, {
        name: deckName.trim(),
        description: deckDescription.trim() || 'Custom deck',
        category: resolvedCategory,
        flashcards,
      });

      Alert.alert('Success', 'Deck updated successfully!', [
        {
          text: 'OK',
          onPress: () => router.back(),
        },
      ]);
    } else {
      const colors = ['#FF6B6B', '#4ECDC4', '#FFD93D', '#9B59B6', '#E67E22'];
      const randomColor = colors[Math.floor(Math.random() * colors.length)];

      const newDeckId = `deck_${Date.now()}`;
      const flashcards: Flashcard[] = validCards.map((c) => ({
        id: generateUUID(),
        question: c.question.trim(),
        answer: c.answer.trim(),
        deckId: newDeckId,
        difficulty: 'medium',
        createdAt: Date.now(),
      }));

      addDeck({
        id: newDeckId,
        name: deckName.trim(),
        description: deckDescription.trim() || 'Custom deck',
        color: randomColor,
        icon: 'star',
        category: resolvedCategory,
        flashcards,
        isCustom: true,
        createdAt: Date.now(),
      });
      trackEvent({
        event: 'deck_created',
        properties: {
          method: 'manual',
          card_count: validCards.length,
          deck_name: deckName.trim(),
        },
      });

      Alert.alert('Success', 'Deck created successfully!', [
        {
          text: 'OK',
          onPress: () => router.back(),
        },
      ]);
    }
  };

  const handleDeleteDeck = () => {
    if (!editingDeckId) {
      logger.log('Delete failed: No deck ID found');
      Alert.alert('Error', 'Cannot delete deck - no deck ID found');
      return;
    }

    logger.log('Attempting to delete deck:', editingDeckId);

    const performDelete = async () => {
      try {
        logger.log('Deleting deck:', editingDeckId);
        const deckToDelete = decks.find(d => d.id === editingDeckId);
        const cardIds = deckToDelete?.flashcards.map(f => f.id) || [];
        await deleteDeck(editingDeckId);
        cleanupPerformance(editingDeckId, cardIds);
        cleanupArena(editingDeckId);
        logger.log('Deck deleted successfully, cleaned up performance & arena data');
        router.replace('/decks' as any);
      } catch (error) {
        logger.error('Error deleting deck:', error);
        Alert.alert('Error', 'Failed to delete deck. Please try again.');
      }
    };

    if (Platform.OS === 'web') {
      const globalConfirm = (globalThis as { confirm?: (message?: string) => boolean }).confirm;
      const shouldDelete = typeof globalConfirm === 'function'
        ? globalConfirm('Delete this deck? This action cannot be undone.')
        : true;

      if (shouldDelete) {
        void performDelete();
      }
      return;
    }

    Alert.alert(
      'Delete Deck',
      'Are you sure you want to delete this deck? This action cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void performDelete();
          },
        },
      ]
    );
  };

  const placeholderColor = useMemo(() => theme.textTertiary, [theme.textTertiary]);
  const cardFieldBackground = useMemo(
    () => (isDark ? 'rgba(15, 23, 42, 0.85)' : 'rgba(243, 246, 255, 0.9)'),
    [isDark]
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.gradientStart }] }>
      <LinearGradient
        colors={[theme.gradientStart, theme.gradientMid, theme.gradientEnd]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft color={theme.white} size={28} strokeWidth={2.5} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.white }]}>{editingDeckId ? 'Edit Deck' : 'Create Deck'}</Text>
          {editingDeckId ? (
            <View style={styles.headerActions}>
              <TouchableOpacity
                onPress={() => void handleShareDeck()}
                style={styles.iconButton}
                activeOpacity={0.8}
                testID="deckShareButton"
              >
                <Share2 color={theme.white} size={22} strokeWidth={2.5} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleDeleteDeck}
                style={styles.iconButton}
                activeOpacity={0.8}
                testID="deckDeleteButton"
              >
                <Trash2 color={theme.white} size={24} strokeWidth={2.5} />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.placeholder} />
          )}
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.deckInfoSection}>
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.white }]}>Deck Name *</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.cardBackground, color: theme.text }]}
                value={deckName}
                onChangeText={setDeckName}
                placeholder="e.g. Spanish Vocabulary"
                placeholderTextColor={placeholderColor}
                testID="deckNameInput"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.white }]}>Description (Optional)</Text>
              <TextInput
                style={[styles.input, styles.textArea, { backgroundColor: theme.cardBackground, color: theme.text }]}
                value={deckDescription}
                onChangeText={setDeckDescription}
                placeholder="What is this deck about?"
                placeholderTextColor={placeholderColor}
                multiline
                numberOfLines={3}
                testID="deckDescriptionInput"
              />
            </View>

            <DeckCategoryPicker
              categories={categoryOptions}
              selectedCategory={selectedCategory}
              showCustomCategory={showCustomCategory}
              customCategoryInput={customCategoryInput}
              onSelectCategory={handleSelectCategory}
              onPressCustom={handlePressCustomCategory}
              onChangeCustomCategoryInput={setCustomCategoryInput}
              onSubmitCustomCategory={handleSubmitCustomCategory}
              theme={theme}
              isDark={isDark}
              testIDPrefix="create-deck-category"
            />
          </View>

          <View style={styles.cardsSection}>
            <View style={styles.cardsSectionHeader}>
              <Text style={[styles.sectionTitle, { color: theme.white }]}>Flashcards</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity
                  onPress={() => void handleBulkPaste()}
                  style={[styles.addCardButton, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.25)' }]}
                  activeOpacity={0.85}
                  testID="pasteCardsButton"
                >
                  <FileText color={theme.white} size={18} strokeWidth={2.5} />
                  <Text style={[styles.addCardText, { color: theme.white }]}>Paste</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={addCard} style={[styles.addCardButton, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.25)' }]} activeOpacity={0.85} testID="addCardButton">
                  <Plus color={theme.white} size={20} strokeWidth={2.5} />
                  <Text style={[styles.addCardText, { color: theme.white }]}>Add Card</Text>
                </TouchableOpacity>
              </View>
            </View>

            {cards.map((card, index) => (
              <View key={card.id} style={[styles.cardForm, { backgroundColor: theme.cardBackground, shadowColor: theme.shadow }]}
                testID={`cardForm-${index + 1}`}>
                <View style={styles.cardHeader}>
                  <Text style={[styles.cardNumber, { color: theme.text }]}>Card {index + 1}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    {index > 0 && (
                      <TouchableOpacity
                        onPress={() => moveCardUp(index)}
                        style={{ width: 32, height: 32, justifyContent: 'center', alignItems: 'center', borderRadius: 8, backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }}
                        activeOpacity={0.7}
                        testID={`moveCardUpButton-${card.id}`}
                      >
                        <ChevronUp color={theme.textSecondary} size={18} strokeWidth={2.5} />
                      </TouchableOpacity>
                    )}
                    {index < cards.length - 1 && (
                      <TouchableOpacity
                        onPress={() => moveCardDown(index)}
                        style={{ width: 32, height: 32, justifyContent: 'center', alignItems: 'center', borderRadius: 8, backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }}
                        activeOpacity={0.7}
                        testID={`moveCardDownButton-${card.id}`}
                      >
                        <ChevronDown color={theme.textSecondary} size={18} strokeWidth={2.5} />
                      </TouchableOpacity>
                    )}
                    {cards.length > 1 && (
                      <TouchableOpacity
                        onPress={() => removeCard(card.id)}
                        style={styles.deleteButton}
                        activeOpacity={0.8}
                        testID={`removeCardButton-${card.id}`}
                      >
                        <Trash2 color={theme.error} size={20} strokeWidth={2} />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>

                <View style={styles.cardInputGroup}>
                  <Text style={[styles.cardInputLabel, { color: theme.textSecondary }]}>Question</Text>
                  <TextInput
                    style={[styles.cardInput, { backgroundColor: cardFieldBackground, color: theme.text }]}
                    value={card.question}
                    onChangeText={(text) => updateCard(card.id, 'question', text)}
                    placeholder="Enter the question..."
                    placeholderTextColor={placeholderColor}
                    multiline
                    maxLength={500}
                    testID={`cardQuestionInput-${card.id}`}
                  />
                </View>

                <View style={styles.cardInputGroup}>
                  <Text style={[styles.cardInputLabel, { color: theme.textSecondary }]}>Answer</Text>
                  <TextInput
                    style={[styles.cardInput, { backgroundColor: cardFieldBackground, color: theme.text }]}
                    value={card.answer}
                    onChangeText={(text) => updateCard(card.id, 'answer', text)}
                    placeholder="Enter the answer..."
                    placeholderTextColor={placeholderColor}
                    multiline
                    maxLength={200}
                    testID={`cardAnswerInput-${card.id}`}
                  />
                </View>
              </View>
            ))}
          </View>
        </ScrollView>

        <View style={[styles.footer, { borderTopColor: isDark ? 'rgba(148, 163, 184, 0.15)' : 'rgba(255, 255, 255, 0.35)' }] }>
          <TouchableOpacity style={[styles.saveButton, { backgroundColor: theme.cardBackground, shadowColor: theme.shadow }]} onPress={handleSave} activeOpacity={0.9} testID="deckSaveButton">
            <Text style={[styles.saveButtonText, { color: theme.primary }]}>{editingDeckId ? 'Update Deck' : 'Create Deck'}</Text>
          </TouchableOpacity>
        </View>
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
    fontSize: 20,
    fontWeight: '700',
  },
  placeholder: {
    width: 88,
  },
  headerActions: {
    width: 88,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 8,
  },
  iconButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 140,
  },
  deckInfoSection: {
    paddingHorizontal: 24,
    marginBottom: 32,
    gap: 20,
  },
  inputGroup: {
    gap: 12,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '700',
  },
  input: {
    borderRadius: 16,
    padding: 18,
    fontSize: 16,
    fontWeight: '500',
  },
  textArea: {
    minHeight: 96,
    textAlignVertical: 'top',
  },
  cardsSection: {
    paddingHorizontal: 24,
    gap: 16,
  },
  cardsSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '700',
  },
  addCardButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 14,
    gap: 8,
  },
  addCardText: {
    fontSize: 15,
    fontWeight: '700',
  },
  cardForm: {
    borderRadius: 24,
    padding: 22,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 10,
    gap: 20,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardNumber: {
    fontSize: 18,
    fontWeight: '700',
  },
  deleteButton: {
    padding: 4,
  },
  cardInputGroup: {
    gap: 10,
  },
  cardInputLabel: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  cardInput: {
    borderRadius: 14,
    padding: 16,
    fontSize: 15,
    minHeight: 56,
    fontWeight: '500',
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 24,
    paddingBottom: 32,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  saveButton: {
    borderRadius: 18,
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 12,
  },
  saveButtonText: {
    fontSize: 18,
    fontWeight: '700',
  },
});
