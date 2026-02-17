import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { ArrowLeft, Camera, ImageIcon, Sparkles, Check, Plus, Trash2 } from 'lucide-react-native';
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
  Platform,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as z from 'zod/v4';

import { useFlashQuest } from '@/context/FlashQuestContext';
import { useTheme } from '@/context/ThemeContext';
import { Flashcard } from '@/types/flashcard';
import { generateObject } from '@rork-ai/toolkit-sdk';

const flashcardSchema = z.object({
  cards: z.array(z.object({
    question: z.string().describe('A clear question based on the notes content'),
    answer: z.string().describe('A concise, accurate answer to the question'),
  })).describe('Array of flashcard question-answer pairs extracted from the image'),
  deckName: z.string().describe('A short descriptive name for this deck based on the content'),
  deckDescription: z.string().describe('A brief description of what these flashcards cover'),
});

type GeneratedCard = {
  id: string;
  question: string;
  answer: string;
};

type ScanStep = 'pick' | 'processing' | 'review';

export default function ScanNotesPage() {
  const router = useRouter();
  const { addDeck } = useFlashQuest();
  const { theme, isDark } = useTheme();

  const [step, setStep] = useState<ScanStep>('pick');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [generatedCards, setGeneratedCards] = useState<GeneratedCard[]>([]);
  const [deckName, setDeckName] = useState<string>('');
  const [deckDescription, setDeckDescription] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const startPulse = useCallback(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.6, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, [pulseAnim]);

  const stopPulse = useCallback(() => {
    pulseAnim.stopAnimation();
    pulseAnim.setValue(1);
  }, [pulseAnim]);

  const pickImage = useCallback(async (source: 'camera' | 'gallery') => {
    try {
      setErrorMessage(null);
      let result: ImagePicker.ImagePickerResult;

      if (source === 'camera') {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          Alert.alert('Permission needed', 'Camera access is required to take photos of your notes.');
          return;
        }
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ['images'],
          quality: 0.8,
          base64: true,
        });
      } else {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
          Alert.alert('Permission needed', 'Photo library access is required to select images.');
          return;
        }
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          quality: 0.8,
          base64: true,
        });
      }

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        setImageUri(asset.uri);
        processImage(asset.base64 ?? null, asset.uri);
      }
    } catch (error) {
      
      setErrorMessage('Failed to pick image. Please try again.');
    }
  }, []);

  const processImage = useCallback(async (base64: string | null, uri: string) => {
    if (!base64) {
      setErrorMessage('Could not read image data. Please try another image.');
      return;
    }

    setStep('processing');
    setIsProcessing(true);
    startPulse();
    setErrorMessage(null);

    try {
      

      const result = await generateObject({
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Look at this image of notes/study material. Extract key concepts and create flashcard question-answer pairs from it. Create between 3-15 flashcards depending on how much content is visible. Make questions clear and specific. Make answers concise but complete. Also suggest a deck name and description based on the content.',
              },
              {
                type: 'image',
                image: base64,
              },
            ],
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
      
      setErrorMessage('Failed to extract flashcards. Please try again with a clearer image.');
      setStep('pick');
    } finally {
      setIsProcessing(false);
      stopPulse();
    }
  }, [startPulse, stopPulse]);

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
      description: deckDescription.trim() || 'AI-generated deck from notes',
      color: randomColor,
      icon: 'sparkles',
      category: 'AI Generated',
      flashcards,
      isCustom: true,
      createdAt: Date.now(),
    });

    Alert.alert('Deck Created!', `${validCards.length} flashcards generated from your notes.`, [
      { text: 'View Decks', onPress: () => router.replace('/decks' as any) },
    ]);
  }, [deckName, deckDescription, generatedCards, addDeck, router]);

  const handleRetry = useCallback(() => {
    setStep('pick');
    setImageUri(null);
    setGeneratedCards([]);
    setDeckName('');
    setDeckDescription('');
    setErrorMessage(null);
  }, []);

  const cardBg = isDark ? 'rgba(15, 23, 42, 0.85)' : 'rgba(243, 246, 255, 0.9)';
  const placeholderColor = theme.textTertiary;

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
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton} testID="scanNotesBack">
            <ArrowLeft color={theme.white} size={28} strokeWidth={2.5} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.white }]}>Scan Notes</Text>
          <View style={styles.headerSpacer} />
        </View>

        {step === 'pick' && (
          <View style={styles.pickContainer}>
            <View style={[styles.heroCard, { backgroundColor: theme.cardBackground }]}>
              <View style={[styles.iconCircle, { backgroundColor: isDark ? 'rgba(139, 92, 246, 0.15)' : 'rgba(102, 126, 234, 0.12)' }]}>
                <Sparkles color={theme.primary} size={40} strokeWidth={1.8} />
              </View>
              <Text style={[styles.heroTitle, { color: theme.text }]}>AI Flashcard Generator</Text>
              <Text style={[styles.heroSubtitle, { color: theme.textSecondary }]}>
                Take a photo of your notes, textbook, or whiteboard and AI will create flashcards for you automatically.
              </Text>
            </View>

            {errorMessage && (
              <View style={[styles.errorBanner, { backgroundColor: 'rgba(239, 68, 68, 0.12)' }]}>
                <Text style={[styles.errorText, { color: theme.error }]}>{errorMessage}</Text>
              </View>
            )}

            {imageUri && (
              <View style={[styles.previewCard, { backgroundColor: theme.cardBackground }]}>
                <Image source={{ uri: imageUri }} style={styles.previewImage} resizeMode="cover" />
              </View>
            )}

            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={[styles.actionCard, { backgroundColor: theme.cardBackground }]}
                onPress={() => pickImage('camera')}
                activeOpacity={0.8}
                testID="scanCamera"
              >
                <View style={[styles.actionIconWrap, { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : 'rgba(16, 185, 129, 0.1)' }]}>
                  <Camera color={theme.success} size={28} strokeWidth={2} />
                </View>
                <Text style={[styles.actionCardTitle, { color: theme.text }]}>Take Photo</Text>
                <Text style={[styles.actionCardDesc, { color: theme.textSecondary }]}>
                  Use your camera to capture notes
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionCard, { backgroundColor: theme.cardBackground }]}
                onPress={() => pickImage('gallery')}
                activeOpacity={0.8}
                testID="scanGallery"
              >
                <View style={[styles.actionIconWrap, { backgroundColor: isDark ? 'rgba(139, 92, 246, 0.15)' : 'rgba(102, 126, 234, 0.1)' }]}>
                  <ImageIcon color={theme.primary} size={28} strokeWidth={2} />
                </View>
                <Text style={[styles.actionCardTitle, { color: theme.text }]}>Choose Photo</Text>
                <Text style={[styles.actionCardDesc, { color: theme.textSecondary }]}>
                  Pick an image from your library
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {step === 'processing' && (
          <View style={styles.processingContainer}>
            <View style={[styles.processingCard, { backgroundColor: theme.cardBackground }]}>
              {imageUri && (
                <Animated.View style={[styles.processingImageWrap, { opacity: pulseAnim }]}>
                  <Image source={{ uri: imageUri }} style={styles.processingImage} resizeMode="cover" />
                  <View style={[styles.processingOverlay, { backgroundColor: isDark ? 'rgba(15, 23, 42, 0.7)' : 'rgba(255, 255, 255, 0.7)' }]} />
                </Animated.View>
              )}
              <View style={styles.processingContent}>
                <ActivityIndicator size="large" color={theme.primary} />
                <Text style={[styles.processingTitle, { color: theme.text }]}>Analyzing your notes...</Text>
                <Text style={[styles.processingSubtitle, { color: theme.textSecondary }]}>
                  AI is reading the image and creating flashcards
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
              {imageUri && (
                <View style={[styles.thumbRow, { backgroundColor: theme.cardBackground }]}>
                  <Image source={{ uri: imageUri }} style={styles.thumbImage} resizeMode="cover" />
                  <View style={styles.thumbInfo}>
                    <Text style={[styles.thumbLabel, { color: theme.textSecondary }]}>Source image</Text>
                    <TouchableOpacity onPress={handleRetry}>
                      <Text style={[styles.thumbAction, { color: theme.primary }]}>Scan another</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              <View style={styles.deckInfoSection}>
                <Text style={[styles.sectionLabel, { color: theme.white }]}>Deck Info</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.cardBackground, color: theme.text }]}
                  value={deckName}
                  onChangeText={setDeckName}
                  placeholder="Deck name"
                  placeholderTextColor={placeholderColor}
                  testID="scanDeckName"
                />
                <TextInput
                  style={[styles.input, styles.inputMultiline, { backgroundColor: theme.cardBackground, color: theme.text }]}
                  value={deckDescription}
                  onChangeText={setDeckDescription}
                  placeholder="Description (optional)"
                  placeholderTextColor={placeholderColor}
                  multiline
                  testID="scanDeckDesc"
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
                    testID="scanAddCard"
                  >
                    <Plus color={theme.white} size={18} strokeWidth={2.5} />
                    <Text style={[styles.addBtnText, { color: theme.white }]}>Add</Text>
                  </TouchableOpacity>
                </View>

                {generatedCards.map((card, index) => (
                  <View key={card.id} style={[styles.cardForm, { backgroundColor: theme.cardBackground }]}>
                    <View style={styles.cardFormHeader}>
                      <View style={[styles.cardBadge, { backgroundColor: isDark ? 'rgba(139,92,246,0.15)' : 'rgba(102,126,234,0.1)' }]}>
                        <Sparkles color={theme.primary} size={14} strokeWidth={2} />
                        <Text style={[styles.cardBadgeText, { color: theme.primary }]}>Card {index + 1}</Text>
                      </View>
                      {generatedCards.length > 1 && (
                        <TouchableOpacity onPress={() => removeCard(card.id)} style={styles.removeBtn} testID={`scanRemoveCard-${card.id}`}>
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
                        testID={`scanCardQ-${card.id}`}
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
                        testID={`scanCardA-${card.id}`}
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
                testID="scanSaveDeck"
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
  pickContainer: {
    flex: 1,
    paddingHorizontal: 24,
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
    width: 80,
    height: 80,
    borderRadius: 40,
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
  previewCard: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  previewImage: {
    width: '100%',
    height: 140,
    borderRadius: 16,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 14,
  },
  actionCard: {
    flex: 1,
    borderRadius: 20,
    padding: 22,
    alignItems: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  actionIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionCardTitle: {
    fontSize: 15,
    fontWeight: '700' as const,
    textAlign: 'center',
  },
  actionCardDesc: {
    fontSize: 12,
    fontWeight: '500' as const,
    textAlign: 'center',
    lineHeight: 17,
  },
  processingContainer: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  processingCard: {
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 10,
  },
  processingImageWrap: {
    width: '100%',
    height: 180,
  },
  processingImage: {
    width: '100%',
    height: '100%',
  },
  processingOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  processingContent: {
    padding: 32,
    alignItems: 'center',
    gap: 14,
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
  reviewScroll: {
    flex: 1,
  },
  reviewContent: {
    paddingHorizontal: 24,
    paddingBottom: 120,
    gap: 20,
  },
  thumbRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    padding: 10,
    gap: 14,
  },
  thumbImage: {
    width: 56,
    height: 56,
    borderRadius: 12,
  },
  thumbInfo: {
    flex: 1,
    gap: 4,
  },
  thumbLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
  },
  thumbAction: {
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
