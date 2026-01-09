import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react-native';
import React, { useState, useEffect, useMemo } from 'react';
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

import { useFlashQuest } from '@/context/FlashQuestContext';
import { useTheme } from '@/context/ThemeContext';
import { Flashcard } from '@/types/flashcard';

interface CardInput {
  id: string;
  question: string;
  answer: string;
}

export default function CreateFlashcardPage() {
  const router = useRouter();
  const { deckId } = useLocalSearchParams<{ deckId?: string }>();
  const { addDeck, updateDeck, deleteDeck, decks } = useFlashQuest();
  const { theme, isDark } = useTheme();

  const [deckName, setDeckName] = useState<string>('');
  const [deckDescription, setDeckDescription] = useState<string>('');
  const [cards, setCards] = useState<CardInput[]>([
    { id: '1', question: '', answer: '' },
  ]);
  const [editingDeckId, setEditingDeckId] = useState<string | null>(null);

  useEffect(() => {
    if (deckId && typeof deckId === 'string') {
      const deck = decks.find(d => d.id === deckId);
      if (deck) {
        setDeckName(deck.name);
        setDeckDescription(deck.description);
        setCards(deck.flashcards.map((f, i) => ({
          id: `${i}`,
          question: f.question,
          answer: f.answer,
        })));
        setEditingDeckId(deck.id);
      }
    }
  }, [deckId, decks]);

  const addCard = () => {
    setCards([...cards, { id: Date.now().toString(), question: '', answer: '' }]);
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

    if (editingDeckId) {
      const flashcards: Flashcard[] = validCards.map((c, index) => ({
        id: `custom_${editingDeckId}_${index}`,
        question: c.question.trim(),
        answer: c.answer.trim(),
        deckId: editingDeckId,
        difficulty: 'medium',
        createdAt: Date.now(),
      }));

      updateDeck(editingDeckId, {
        name: deckName.trim(),
        description: deckDescription.trim() || 'Custom deck',
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
      const flashcards: Flashcard[] = validCards.map((c, index) => ({
        id: `custom_${newDeckId}_${index}`,
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
        category: 'Custom',
        flashcards,
        isCustom: true,
        createdAt: Date.now(),
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
      console.log('Delete failed: No deck ID found');
      Alert.alert('Error', 'Cannot delete deck - no deck ID found');
      return;
    }

    console.log('Attempting to delete deck:', editingDeckId);

    const performDelete = async () => {
      try {
        console.log('Deleting deck:', editingDeckId);
        await deleteDeck(editingDeckId);
        console.log('Deck deleted successfully');
        router.replace('/decks');
      } catch (error) {
        console.error('Error deleting deck:', error);
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
            <TouchableOpacity
              onPress={handleDeleteDeck}
              style={styles.deleteIconButton}
              activeOpacity={0.8}
              testID="deckDeleteButton"
            >
              <Trash2 color={theme.white} size={24} strokeWidth={2.5} />
            </TouchableOpacity>
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
          </View>

          <View style={styles.cardsSection}>
            <View style={styles.cardsSectionHeader}>
              <Text style={[styles.sectionTitle, { color: theme.white }]}>Flashcards</Text>
              <TouchableOpacity onPress={addCard} style={[styles.addCardButton, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.25)' }]} activeOpacity={0.85} testID="addCardButton">
                <Plus color={theme.white} size={20} strokeWidth={2.5} />
                <Text style={[styles.addCardText, { color: theme.white }]}>Add Card</Text>
              </TouchableOpacity>
            </View>

            {cards.map((card, index) => (
              <View key={card.id} style={[styles.cardForm, { backgroundColor: theme.cardBackground, shadowColor: theme.shadow }]}
                testID={`cardForm-${index + 1}`}>
                <View style={styles.cardHeader}>
                  <Text style={[styles.cardNumber, { color: theme.text }]}>Card {index + 1}</Text>
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

                <View style={styles.cardInputGroup}>
                  <Text style={[styles.cardInputLabel, { color: theme.textSecondary }]}>Question</Text>
                  <TextInput
                    style={[styles.cardInput, { backgroundColor: cardFieldBackground, color: theme.text }]}
                    value={card.question}
                    onChangeText={(text) => updateCard(card.id, 'question', text)}
                    placeholder="Enter the question..."
                    placeholderTextColor={placeholderColor}
                    multiline
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
    width: 40,
  },
  deleteIconButton: {
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
