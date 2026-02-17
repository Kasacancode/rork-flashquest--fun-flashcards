import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { ArrowLeft, Sparkles, Check, Plus, Trash2, FileText, Wand2, RotateCcw } from 'lucide-react-native';
import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
  Animated,
  Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as z from 'zod/v4';

import { useFlashQuest } from '@/context/FlashQuestContext';
import { useTheme } from '@/context/ThemeContext';
import { Flashcard } from '@/types/flashcard';
import { generateObject } from '@rork-ai/toolkit-sdk';

const flashcardSchema = z.object({
  cards: z.array(z.object({
    question: z.string().describe('A clear question based on the text content'),
    answer: z.string().describe('A concise, accurate answer to the question'),
  })).describe('Array of flashcard question-answer pairs extracted from the text'),
  deckName: z.string().describe('A short descriptive name for this deck based on the content'),
  deckDescription: z.string().describe('A brief description of what these flashcards cover'),
});

type GeneratedCard = {
  id: string;
  question: string;
  answer: string;
};

type Step = 'input' | 'processing' | 'review';

export default function TextToDeckPage() {
  const router = useRouter();
  const { addDeck } = useFlashQuest();
  const { theme, isDark } = useTheme();

  const [step, setStep] = useState<Step>('input');
  const [sourceText, setSourceText] = useState<string>('');
  const [generatedCards, setGeneratedCards] = useState<GeneratedCard[]>([]);
  const [deckName, setDeckName] = useState<string>('');
  const [deckDescription, setDeckDescription] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const charCount = sourceText.length;
  const isTextValid = charCount >= 20;

  const startPulse = useCallback(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.5, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
      ])
    ).start();
  }, [pulseAnim]);

  const stopPulse = useCallback(() => {
    pulseAnim.stopAnimation();
    pulseAnim.setValue(1);
  }, [pulseAnim]);

  const handleGenerate = useCallback(async () => {
    if (!isTextValid) {
      Alert.alert('Too short', 'Please paste at least a few sentences of notes or text.');
      return;
    }

    Keyboard.dismiss();
    setStep('processing');
    setIsProcessing(true);
    startPulse();
    setErrorMessage(null);

    try {
      

      const result = await generateObject({
        messages: [
          {
            role: 'user',
            content: `Read the following notes/text and create flashcard question-answer pairs from it. Extract the key concepts, definitions, facts, and important details. Create between 3-20 flashcards depending on how much content there is. Make questions clear and specific. Make answers concise but complete. Also suggest a deck name and description based on the content.\n\nText:\n${sourceText}`,
          },
        ],
        schema: flashcardSchema,
      });

      

      const cards: GeneratedCard[] = result.cards.map((card, index) => ({
        id: `gen_${Date.now()}_${index}`,
        question: card.question,
        answer: card.answer,
      }));

      setGeneratedCards(cards);
      setDeckName(result.deckName);
      setDeckDescription(result.deckDescription);
      setStep('review');
    } catch (error) {
      
      setErrorMessage('Failed to generate flashcards. Please try again.');
      setStep('input');
    } finally {
      setIsProcessing(false);
      stopPulse();
    }
  }, [sourceText, isTextValid, startPulse, stopPulse]);

  const updateCard = useCallback((id: string, field: 'question' | 'answer', value: string) => {
    setGeneratedCards(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c));
  }, []);

  const removeCard = useCallback((id: string) => {
    setGeneratedCards(prev => {
      if (prev.length <= 1) return prev;
      return prev.filter(c => c.id !== id);
    });
  }, []);

  const addCard = useCallback(() => {
    setGeneratedCards(prev => [...prev, {
      id: `gen_${Date.now()}_new`,
      question: '',
      answer: '',
    }]);
  }, []);

  const handleSave = useCallback(() => {
    if (!deckName.trim()) {
      Alert.alert('Error', 'Please enter a deck name');
      return;
    }

    const validCards = generatedCards.filter(c => c.question.trim() && c.answer.trim());
    if (validCards.length === 0) {
      Alert.alert('Error', 'Please have at least one complete flashcard');
      return;
    }

    const colors = ['#FF6B6B', '#4ECDC4', '#FFD93D', '#9B59B6', '#E67E22', '#3498DB', '#1ABC9C'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];
    const newDeckId = `deck_${Date.now()}`;

    const flashcards: Flashcard[] = validCards.map((c, index) => ({
      id: `ai_${newDeckId}_${index}`,
      question: c.question.trim(),
      answer: c.answer.trim(),
      deckId: newDeckId,
      difficulty: 'medium' as const,
      createdAt: Date.now(),
    }));

    addDeck({
      id: newDeckId,
      name: deckName.trim(),
      description: deckDescription.trim() || 'AI-generated deck from text',
      color: randomColor,
      icon: 'file-text',
      category: 'AI Generated',
      flashcards,
      isCustom: true,
      createdAt: Date.now(),
    });

    Alert.alert('Deck Created!', `${validCards.length} flashcards generated from your text.`, [
      { text: 'View Decks', onPress: () => router.replace('/decks' as any) },
    ]);
  }, [deckName, deckDescription, generatedCards, addDeck, router]);

  const handleReset = useCallback(() => {
    setStep('input');
    setGeneratedCards([]);
    setDeckName('');
    setDeckDescription('');
    setErrorMessage(null);
  }, []);

  const cardBg = isDark ? 'rgba(15, 23, 42, 0.85)' : 'rgba(243, 246, 255, 0.9)';
  const placeholderColor = theme.textTertiary;
  const inputBg = isDark ? 'rgba(15, 23, 42, 0.6)' : 'rgba(255, 255, 255, 0.85)';

  return (
    <View style={[styles.container, { backgroundColor: theme.gradientStart }]}>
      <LinearGradient
        colors={[theme.gradientStart, theme.gradientMid, theme.gradientEnd]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton} testID="textToDeckBack">
            <ArrowLeft color={theme.white} size={28} strokeWidth={2.5} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.white }]}>Text to Deck</Text>
          <View style={styles.headerSpacer} />
        </View>

        {step === 'input' && (
          <ScrollView
            style={styles.inputScroll}
            contentContainerStyle={styles.inputScrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={[styles.heroCard, { backgroundColor: theme.cardBackground }]}>
              <View style={[styles.iconCircle, { backgroundColor: isDark ? 'rgba(59, 130, 246, 0.15)' : 'rgba(59, 130, 246, 0.1)' }]}>
                <FileText color={isDark ? '#60a5fa' : '#3b82f6'} size={36} strokeWidth={1.8} />
              </View>
              <Text style={[styles.heroTitle, { color: theme.text }]}>Paste Your Notes</Text>
              <Text style={[styles.heroSubtitle, { color: theme.textSecondary }]}>
                Paste any text — lecture notes, textbook passages, articles — and AI will turn it into study-ready flashcards.
              </Text>
            </View>

            {errorMessage && (
              <View style={[styles.errorBanner, { backgroundColor: 'rgba(239, 68, 68, 0.12)' }]}>
                <Text style={[styles.errorText, { color: theme.error }]}>{errorMessage}</Text>
              </View>
            )}

            <View style={[styles.textAreaCard, { backgroundColor: theme.cardBackground }]}>
              <TextInput
                style={[styles.textArea, { color: theme.text, backgroundColor: inputBg }]}
                value={sourceText}
                onChangeText={setSourceText}
                placeholder="Paste or type your notes here..."
                placeholderTextColor={placeholderColor}
                multiline
                textAlignVertical="top"
                testID="textToDeckInput"
              />
              <View style={styles.charRow}>
                <Text style={[styles.charCount, { color: isTextValid ? theme.success : theme.textTertiary }]}>
                  {charCount} characters
                </Text>
                {!isTextValid && charCount > 0 && (
                  <Text style={[styles.charHint, { color: theme.warning }]}>
                    Need at least 20 characters
                  </Text>
                )}
              </View>
            </View>

            <TouchableOpacity
              style={[
                styles.generateButton,
                { backgroundColor: isTextValid ? theme.primary : isDark ? 'rgba(148,163,184,0.2)' : 'rgba(0,0,0,0.1)' },
              ]}
              onPress={handleGenerate}
              activeOpacity={0.85}
              disabled={!isTextValid}
              testID="textToDeckGenerate"
            >
              <Wand2 color={isTextValid ? '#fff' : theme.textTertiary} size={22} strokeWidth={2.2} />
              <Text style={[
                styles.generateButtonText,
                { color: isTextValid ? '#fff' : theme.textTertiary },
              ]}>
                Generate Flashcards
              </Text>
            </TouchableOpacity>
          </ScrollView>
        )}

        {step === 'processing' && (
          <View style={styles.processingContainer}>
            <View style={[styles.processingCard, { backgroundColor: theme.cardBackground }]}>
              <Animated.View style={[styles.processingIconWrap, { opacity: pulseAnim }]}>
                <View style={[styles.processingIconCircle, { backgroundColor: isDark ? 'rgba(59, 130, 246, 0.15)' : 'rgba(59, 130, 246, 0.1)' }]}>
                  <Sparkles color={theme.primary} size={48} strokeWidth={1.5} />
                </View>
              </Animated.View>
              <ActivityIndicator size="large" color={theme.primary} style={styles.processingSpinner} />
              <Text style={[styles.processingTitle, { color: theme.text }]}>Reading your notes...</Text>
              <Text style={[styles.processingSubtitle, { color: theme.textSecondary }]}>
                AI is extracting key concepts and creating flashcards
              </Text>
              <View style={[styles.processingTextPreview, { backgroundColor: inputBg }]}>
                <Text style={[styles.processingPreviewText, { color: theme.textTertiary }]} numberOfLines={3}>
                  {sourceText}
                </Text>
              </View>
            </View>
          </View>
        )}

        {step === 'review' && (
          <>
            <ScrollView
              style={styles.reviewScroll}
              contentContainerStyle={styles.reviewContent}
              showsVerticalScrollIndicator={false}
            >
              <View style={[styles.sourcePreviewRow, { backgroundColor: theme.cardBackground }]}>
                <View style={[styles.sourceIconWrap, { backgroundColor: isDark ? 'rgba(59, 130, 246, 0.15)' : 'rgba(59, 130, 246, 0.1)' }]}>
                  <FileText color={isDark ? '#60a5fa' : '#3b82f6'} size={20} strokeWidth={2} />
                </View>
                <View style={styles.sourceInfo}>
                  <Text style={[styles.sourceLabel, { color: theme.textSecondary }]}>
                    {charCount} chars · {generatedCards.length} cards generated
                  </Text>
                  <TouchableOpacity onPress={handleReset}>
                    <View style={styles.sourceActionRow}>
                      <RotateCcw color={theme.primary} size={14} strokeWidth={2.5} />
                      <Text style={[styles.sourceAction, { color: theme.primary }]}>Start over</Text>
                    </View>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.deckInfoSection}>
                <Text style={[styles.sectionLabel, { color: theme.white }]}>Deck Info</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.cardBackground, color: theme.text }]}
                  value={deckName}
                  onChangeText={setDeckName}
                  placeholder="Deck name"
                  placeholderTextColor={placeholderColor}
                  testID="textToDeckName"
                />
                <TextInput
                  style={[styles.input, styles.inputMultiline, { backgroundColor: theme.cardBackground, color: theme.text }]}
                  value={deckDescription}
                  onChangeText={setDeckDescription}
                  placeholder="Description (optional)"
                  placeholderTextColor={placeholderColor}
                  multiline
                  testID="textToDeckDesc"
                />
              </View>

              <View style={styles.cardsSection}>
                <View style={styles.cardsSectionHeader}>
                  <Text style={[styles.sectionLabel, { color: theme.white }]}>
                    {generatedCards.length} Flashcards
                  </Text>
                  <TouchableOpacity
                    onPress={addCard}
                    style={[styles.addBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.25)' }]}
                    testID="textToDeckAddCard"
                  >
                    <Plus color={theme.white} size={18} strokeWidth={2.5} />
                    <Text style={[styles.addBtnText, { color: theme.white }]}>Add</Text>
                  </TouchableOpacity>
                </View>

                {generatedCards.map((card, index) => (
                  <View key={card.id} style={[styles.cardForm, { backgroundColor: theme.cardBackground }]}>
                    <View style={styles.cardFormHeader}>
                      <View style={[styles.cardBadge, { backgroundColor: isDark ? 'rgba(59, 130, 246, 0.15)' : 'rgba(59, 130, 246, 0.1)' }]}>
                        <Sparkles color={isDark ? '#60a5fa' : '#3b82f6'} size={14} strokeWidth={2} />
                        <Text style={[styles.cardBadgeText, { color: isDark ? '#60a5fa' : '#3b82f6' }]}>Card {index + 1}</Text>
                      </View>
                      {generatedCards.length > 1 && (
                        <TouchableOpacity onPress={() => removeCard(card.id)} style={styles.removeBtn} testID={`textToDeckRemoveCard-${card.id}`}>
                          <Trash2 color={theme.error} size={18} strokeWidth={2} />
                        </TouchableOpacity>
                      )}
                    </View>
                    <View style={styles.cardFieldGroup}>
                      <Text style={[styles.cardFieldLabel, { color: theme.textSecondary }]}>Question</Text>
                      <TextInput
                        style={[styles.cardField, { backgroundColor: cardBg, color: theme.text }]}
                        value={card.question}
                        onChangeText={(v) => updateCard(card.id, 'question', v)}
                        placeholder="Question..."
                        placeholderTextColor={placeholderColor}
                        multiline
                        testID={`textToDeckCardQ-${card.id}`}
                      />
                    </View>
                    <View style={styles.cardFieldGroup}>
                      <Text style={[styles.cardFieldLabel, { color: theme.textSecondary }]}>Answer</Text>
                      <TextInput
                        style={[styles.cardField, { backgroundColor: cardBg, color: theme.text }]}
                        value={card.answer}
                        onChangeText={(v) => updateCard(card.id, 'answer', v)}
                        placeholder="Answer..."
                        placeholderTextColor={placeholderColor}
                        multiline
                        testID={`textToDeckCardA-${card.id}`}
                      />
                    </View>
                  </View>
                ))}
              </View>
            </ScrollView>

            <View style={[styles.footer, { borderTopColor: isDark ? 'rgba(148,163,184,0.15)' : 'rgba(255,255,255,0.35)' }]}>
              <TouchableOpacity
                style={[styles.saveButton, { backgroundColor: theme.cardBackground }]}
                onPress={handleSave}
                activeOpacity={0.9}
                testID="textToDeckSave"
              >
                <Check color={theme.primary} size={22} strokeWidth={2.5} />
                <Text style={[styles.saveButtonText, { color: theme.primary }]}>Save Deck</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
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
    fontWeight: '700' as const,
  },
  headerSpacer: {
    width: 40,
  },
  inputScroll: {
    flex: 1,
  },
  inputScrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 40,
    gap: 20,
  },
  heroCard: {
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
    gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 8,
  },
  iconCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '800' as const,
    textAlign: 'center',
  },
  heroSubtitle: {
    fontSize: 14,
    fontWeight: '500' as const,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 8,
  },
  errorBanner: {
    borderRadius: 14,
    padding: 14,
  },
  errorText: {
    fontSize: 14,
    fontWeight: '600' as const,
    textAlign: 'center',
  },
  textAreaCard: {
    borderRadius: 20,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  textArea: {
    borderRadius: 14,
    padding: 16,
    fontSize: 15,
    fontWeight: '400' as const,
    minHeight: 200,
    lineHeight: 22,
  },
  charRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingHorizontal: 4,
  },
  charCount: {
    fontSize: 12,
    fontWeight: '600' as const,
  },
  charHint: {
    fontSize: 12,
    fontWeight: '600' as const,
  },
  generateButton: {
    borderRadius: 18,
    paddingVertical: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 14,
    elevation: 6,
  },
  generateButtonText: {
    fontSize: 17,
    fontWeight: '700' as const,
  },
  processingContainer: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  processingCard: {
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 10,
  },
  processingIconWrap: {
    marginBottom: 4,
  },
  processingIconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  processingSpinner: {
    marginTop: 4,
  },
  processingTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    textAlign: 'center',
  },
  processingSubtitle: {
    fontSize: 14,
    fontWeight: '500' as const,
    textAlign: 'center',
    lineHeight: 20,
  },
  processingTextPreview: {
    borderRadius: 12,
    padding: 14,
    width: '100%',
    marginTop: 4,
  },
  processingPreviewText: {
    fontSize: 13,
    fontWeight: '400' as const,
    lineHeight: 18,
  },
  reviewScroll: {
    flex: 1,
  },
  reviewContent: {
    paddingHorizontal: 24,
    paddingBottom: 120,
    gap: 20,
  },
  sourcePreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    padding: 14,
    gap: 14,
  },
  sourceIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sourceInfo: {
    flex: 1,
    gap: 4,
  },
  sourceLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
  },
  sourceActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  sourceAction: {
    fontSize: 14,
    fontWeight: '700' as const,
  },
  deckInfoSection: {
    gap: 12,
  },
  sectionLabel: {
    fontSize: 18,
    fontWeight: '700' as const,
    marginBottom: 2,
  },
  input: {
    borderRadius: 16,
    padding: 16,
    fontSize: 16,
    fontWeight: '500' as const,
  },
  inputMultiline: {
    minHeight: 72,
    textAlignVertical: 'top',
  },
  cardsSection: {
    gap: 14,
  },
  cardsSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    gap: 6,
  },
  addBtnText: {
    fontSize: 14,
    fontWeight: '700' as const,
  },
  cardForm: {
    borderRadius: 20,
    padding: 18,
    gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  cardFormHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    gap: 6,
  },
  cardBadgeText: {
    fontSize: 13,
    fontWeight: '700' as const,
  },
  removeBtn: {
    padding: 6,
  },
  cardFieldGroup: {
    gap: 6,
  },
  cardFieldLabel: {
    fontSize: 12,
    fontWeight: '700' as const,
    letterSpacing: 0.4,
  },
  cardField: {
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    fontWeight: '500' as const,
    minHeight: 48,
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
    paddingVertical: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  saveButtonText: {
    fontSize: 18,
    fontWeight: '700' as const,
  },
});
