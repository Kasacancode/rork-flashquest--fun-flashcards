import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ArrowLeft,
  Camera,
  Check,
  HelpCircle,
  ImageIcon,
  Lightbulb,
  MessageSquare,
  Sparkles,
  Tag,
  Trash2,
  X,
} from 'lucide-react-native';
import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useDeckContext } from '@/context/DeckContext';
import { useTheme } from '@/context/ThemeContext';

const DIFFICULTY_OPTIONS = ['easy', 'medium', 'hard'] as const;
type Difficulty = (typeof DIFFICULTY_OPTIONS)[number];

const DIFFICULTY_COLORS: Record<Difficulty, string> = {
  easy: '#10b981',
  medium: '#f59e0b',
  hard: '#ef4444',
};

const MAX_IMAGE_BASE64_LENGTH = 100000;

export default function EditFlashcardScreen() {
  const router = useRouter();
  const { deckId, cardId } = useLocalSearchParams<{ deckId: string; cardId: string }>();
  const { decks, updateFlashcard, deleteFlashcard } = useDeckContext();
  const { theme, isDark } = useTheme();
  const deck = useMemo(() => decks.find((item) => item.id === deckId), [decks, deckId]);
  const card = useMemo(() => deck?.flashcards.find((item) => item.id === cardId), [cardId, deck]);
  const [question, setQuestion] = useState<string>(card?.question ?? '');
  const [answer, setAnswer] = useState<string>(card?.answer ?? '');
  const [explanation, setExplanation] = useState<string>(card?.explanation ?? '');
  const [hint1, setHint1] = useState<string>(card?.hint1 ?? '');
  const [hint2, setHint2] = useState<string>(card?.hint2 ?? '');
  const [difficulty, setDifficulty] = useState<Difficulty>(card?.difficulty ?? 'medium');
  const [imageUrl, setImageUrl] = useState<string | undefined>(card?.imageUrl);
  const [hasChanges, setHasChanges] = useState<boolean>(false);

  const backgroundGradient: [string, string, string] = isDark
    ? ['#08111f', '#0c1730', '#09111d']
    : ['#E0E7FF', '#EDE9FE', '#E0E7FF'];
  const surfaceBg = isDark ? 'rgba(30, 41, 59, 0.72)' : 'rgba(255, 255, 255, 0.88)';
  const inputBg = isDark ? 'rgba(15, 23, 42, 0.5)' : 'rgba(255, 255, 255, 0.6)';
  const markChanged = useCallback(() => setHasChanges(true), []);

  const handlePickImage = useCallback(async (source: 'camera' | 'gallery') => {
    try {
      let result: ImagePicker.ImagePickerResult;

      if (source === 'camera') {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          Alert.alert('Permission needed', 'Camera access is required to take a photo.');
          return;
        }

        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ['images'],
          quality: 0.3,
          base64: true,
          allowsEditing: true,
        });
      } else {
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          quality: 0.3,
          base64: true,
          allowsEditing: true,
        });
      }

      if (!result.canceled && result.assets[0]?.base64) {
        const base64 = result.assets[0].base64;

        if (base64.length > MAX_IMAGE_BASE64_LENGTH) {
          Alert.alert(
            'Image too large',
            'This image is too large after compression. Try cropping it tighter or using a simpler photo.',
          );
          return;
        }

        const dataUri = `data:image/jpeg;base64,${base64}`;
        setImageUrl(dataUri);
        markChanged();
      }
    } catch {
      Alert.alert('Error', 'Could not load the image. Please try again.');
    }
  }, [markChanged]);

  const handleRemoveImage = useCallback(() => {
    setImageUrl(undefined);
    markChanged();
  }, [markChanged]);

  const handleSave = useCallback(() => {
    if (!deckId || !cardId || !question.trim() || !answer.trim()) {
      Alert.alert('Missing Fields', 'Question and answer are required.');
      return;
    }

    updateFlashcard(deckId, cardId, {
      question: question.trim(),
      answer: answer.trim(),
      explanation: explanation.trim() || undefined,
      hint1: hint1.trim() || undefined,
      hint2: hint2.trim() || undefined,
      imageUrl: imageUrl || undefined,
      difficulty,
    });
    setHasChanges(false);
    router.back();
  }, [answer, cardId, deckId, difficulty, explanation, hint1, hint2, imageUrl, question, router, updateFlashcard]);

  const handleDelete = useCallback(() => {
    if (!deckId || !cardId) {
      return;
    }

    Alert.alert(
      'Delete Card',
      'Are you sure you want to delete this flashcard?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteFlashcard(deckId, cardId);
            router.back();
          },
        },
      ],
    );
  }, [cardId, deckId, deleteFlashcard, router]);

  const handleBack = useCallback(() => {
    if (!hasChanges) {
      router.back();
      return;
    }

    Alert.alert('Unsaved Changes', 'You have unsaved changes. Discard them?', [
      { text: 'Keep Editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: () => router.back() },
    ]);
  }, [hasChanges, router]);

  if (!deck || !card) {
    return (
      <LinearGradient colors={backgroundGradient} style={styles.root}>
        <SafeAreaView style={styles.safe} edges={['top']}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton} testID="edit-flashcard-back-button">
              <ArrowLeft color={theme.text} size={22} strokeWidth={2.2} />
            </TouchableOpacity>
            <Text style={[styles.headerTitle, { color: theme.text }]}>Card Not Found</Text>
            <View style={styles.headerSpacer} />
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={backgroundGradient} style={styles.root}>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton} testID="edit-flashcard-back-button">
            <ArrowLeft color={theme.text} size={22} strokeWidth={2.2} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.text }]} numberOfLines={1}>Edit Card</Text>
          <TouchableOpacity
            onPress={handleSave}
            disabled={!question.trim() || !answer.trim()}
            style={[styles.saveButton, { backgroundColor: question.trim() && answer.trim() ? theme.primary : theme.border }]}
            testID="edit-flashcard-save-button"
          >
            <Check color="#fff" size={18} strokeWidth={2.5} />
            <Text style={styles.saveButtonText}>Save</Text>
          </TouchableOpacity>
        </View>

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardArea}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            testID="edit-flashcard-screen"
          >
            <View style={styles.deckPill}>
              <View style={[styles.deckDot, { backgroundColor: deck.color }]} />
              <Text style={[styles.deckPillText, { color: theme.textSecondary }]}>{deck.name}</Text>
            </View>

            <View style={[styles.fieldCard, { backgroundColor: surfaceBg }]}> 
              <View style={styles.fieldHeader}>
                <HelpCircle color={theme.primary} size={16} />
                <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Question</Text>
              </View>
              <TextInput
                style={[styles.input, styles.largeInput, { color: theme.text, backgroundColor: inputBg, borderColor: theme.border }]}
                value={question}
                onChangeText={(value) => {
                  setQuestion(value);
                  markChanged();
                }}
                placeholder="Enter the question"
                placeholderTextColor={theme.textTertiary}
                multiline
                maxLength={500}
                testID="edit-flashcard-question-input"
              />
              <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Image (optional)</Text>
              {imageUrl ? (
                <View style={styles.imagePreviewContainer}>
                  <Image
                    source={{ uri: imageUrl }}
                    style={styles.imagePreview}
                    contentFit="cover"
                    transition={200}
                  />
                  <TouchableOpacity
                    style={styles.imageRemoveButton}
                    onPress={handleRemoveImage}
                    accessibilityLabel="Remove image"
                    accessibilityRole="button"
                  >
                    <X color="#fff" size={16} strokeWidth={2.5} />
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.imagePickerRow}>
                  <TouchableOpacity
                    style={[
                      styles.imagePickerButton,
                      {
                        backgroundColor: inputBg,
                        borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
                      },
                    ]}
                    onPress={() => handlePickImage('camera')}
                    accessibilityLabel="Take a photo"
                    accessibilityRole="button"
                  >
                    <Camera color={theme.textSecondary} size={18} strokeWidth={2.2} />
                    <Text style={[styles.imagePickerText, { color: theme.textSecondary }]}>Camera</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.imagePickerButton,
                      {
                        backgroundColor: inputBg,
                        borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
                      },
                    ]}
                    onPress={() => handlePickImage('gallery')}
                    accessibilityLabel="Choose from photo library"
                    accessibilityRole="button"
                  >
                    <ImageIcon color={theme.textSecondary} size={18} strokeWidth={2.2} />
                    <Text style={[styles.imagePickerText, { color: theme.textSecondary }]}>Gallery</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            <View style={[styles.fieldCard, { backgroundColor: surfaceBg }]}> 
              <View style={styles.fieldHeader}>
                <MessageSquare color={theme.success} size={16} />
                <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Answer</Text>
              </View>
              <TextInput
                style={[styles.input, { color: theme.text, backgroundColor: inputBg, borderColor: theme.border }]}
                value={answer}
                onChangeText={(value) => {
                  setAnswer(value);
                  markChanged();
                }}
                placeholder="Short answer"
                placeholderTextColor={theme.textTertiary}
                maxLength={200}
                testID="edit-flashcard-answer-input"
              />
            </View>

            <View style={[styles.fieldCard, { backgroundColor: surfaceBg }]}> 
              <View style={styles.fieldHeader}>
                <Sparkles color={theme.warning} size={16} />
                <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Explanation</Text>
              </View>
              <TextInput
                style={[styles.input, styles.largeInput, { color: theme.text, backgroundColor: inputBg, borderColor: theme.border }]}
                value={explanation}
                onChangeText={(value) => {
                  setExplanation(value);
                  markChanged();
                }}
                placeholder="Add context or examples"
                placeholderTextColor={theme.textTertiary}
                multiline
                maxLength={500}
                testID="edit-flashcard-explanation-input"
              />
            </View>

            <View style={[styles.fieldCard, { backgroundColor: surfaceBg }]}> 
              <View style={styles.fieldHeader}>
                <Lightbulb color={theme.primary} size={16} />
                <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Hints</Text>
              </View>
              <TextInput
                style={[styles.input, { color: theme.text, backgroundColor: inputBg, borderColor: theme.border, marginBottom: 8 }]}
                value={hint1}
                onChangeText={(value) => {
                  setHint1(value);
                  markChanged();
                }}
                placeholder="Hint 1"
                placeholderTextColor={theme.textTertiary}
                maxLength={200}
                testID="edit-flashcard-hint1-input"
              />
              <TextInput
                style={[styles.input, { color: theme.text, backgroundColor: inputBg, borderColor: theme.border }]}
                value={hint2}
                onChangeText={(value) => {
                  setHint2(value);
                  markChanged();
                }}
                placeholder="Hint 2"
                placeholderTextColor={theme.textTertiary}
                maxLength={200}
                testID="edit-flashcard-hint2-input"
              />
            </View>

            <View style={[styles.fieldCard, { backgroundColor: surfaceBg }]}> 
              <View style={styles.fieldHeader}>
                <Tag color={theme.textSecondary} size={16} />
                <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Difficulty</Text>
              </View>
              <View style={styles.difficultyRow}>
                {DIFFICULTY_OPTIONS.map((option) => {
                  const isSelected = difficulty === option;
                  const color = DIFFICULTY_COLORS[option];

                  return (
                    <TouchableOpacity
                      key={option}
                      onPress={() => {
                        setDifficulty(option);
                        markChanged();
                      }}
                      style={[
                        styles.difficultyChip,
                        {
                          backgroundColor: isSelected ? color : 'transparent',
                          borderColor: isSelected ? color : theme.border,
                        },
                      ]}
                      testID={`edit-flashcard-difficulty-${option}`}
                    >
                      <Text style={[styles.difficultyChipText, { color: isSelected ? '#fff' : theme.textSecondary }]}>
                        {option.charAt(0).toUpperCase() + option.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <TouchableOpacity
              style={[styles.deleteButton, { backgroundColor: 'rgba(239, 68, 68, 0.1)' }]}
              onPress={handleDelete}
              testID="edit-flashcard-delete-button"
            >
              <Trash2 color={theme.error} size={18} />
              <Text style={[styles.deleteButtonText, { color: theme.error }]}>Delete This Card</Text>
            </TouchableOpacity>

            <View style={styles.bottomSpacer} />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '700' as const,
    letterSpacing: 0.2,
  },
  headerSpacer: { width: 40 },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700' as const,
  },
  keyboardArea: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 4,
  },
  deckPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 8,
    marginBottom: 16,
    marginLeft: 2,
  },
  deckDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  deckPillText: {
    fontSize: 13,
    fontWeight: '600' as const,
  },
  fieldCard: {
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
  },
  fieldHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600' as const,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
  },
  largeInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  imagePreviewContainer: {
    marginTop: 10,
    marginBottom: 16,
    borderRadius: 14,
    overflow: 'hidden',
    position: 'relative',
  },
  imagePreview: {
    width: '100%',
    height: 180,
    borderRadius: 14,
  },
  imageRemoveButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imagePickerRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
    marginBottom: 16,
  },
  imagePickerButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  imagePickerText: {
    fontSize: 14,
    fontWeight: '600' as const,
  },
  difficultyRow: {
    flexDirection: 'row',
    gap: 10,
  },
  difficultyChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  difficultyChipText: {
    fontSize: 14,
    fontWeight: '600' as const,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 8,
  },
  deleteButtonText: {
    fontSize: 15,
    fontWeight: '600' as const,
  },
  bottomSpacer: {
    height: 40,
  },
});
