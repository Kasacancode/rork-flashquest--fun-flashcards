import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ArrowLeft,
  Check,
  HelpCircle,
  Lightbulb,
  MessageSquare,
  Sparkles,
  Tag,
  Trash2,
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

import { useFlashQuest } from '@/context/FlashQuestContext';
import { useTheme } from '@/context/ThemeContext';

const DIFFICULTY_OPTIONS = ['easy', 'medium', 'hard'] as const;
type Difficulty = (typeof DIFFICULTY_OPTIONS)[number];

const DIFFICULTY_COLORS: Record<Difficulty, string> = {
  easy: '#10b981',
  medium: '#f59e0b',
  hard: '#ef4444',
};

export default function EditFlashcardScreen() {
  const router = useRouter();
  const { deckId, cardId } = useLocalSearchParams<{ deckId: string; cardId: string }>();
  const { decks, updateFlashcard, deleteFlashcard } = useFlashQuest();
  const { theme, isDark } = useTheme();

  const deck = useMemo(() => decks.find((d) => d.id === deckId), [decks, deckId]);
  const card = useMemo(
    () => deck?.flashcards.find((c) => c.id === cardId),
    [deck, cardId],
  );

  const [question, setQuestion] = useState(card?.question ?? '');
  const [answer, setAnswer] = useState(card?.answer ?? '');
  const [explanation, setExplanation] = useState(card?.explanation ?? '');
  const [hint1, setHint1] = useState(card?.hint1 ?? '');
  const [hint2, setHint2] = useState(card?.hint2 ?? '');
  const [difficulty, setDifficulty] = useState<Difficulty>(card?.difficulty ?? 'medium');
  const [hasChanges, setHasChanges] = useState(false);

  const backgroundGradient = useMemo(
    () =>
      isDark
        ? (['#08111f', '#0c1730', '#09111d'] as const)
        : (['#E0E7FF', '#EDE9FE', '#E0E7FF'] as const),
    [isDark],
  );

  const surfaceBg = isDark ? 'rgba(30, 41, 59, 0.7)' : 'rgba(255, 255, 255, 0.85)';
  const inputBg = isDark ? 'rgba(15, 23, 42, 0.5)' : 'rgba(255, 255, 255, 0.6)';

  const markChanged = useCallback(() => setHasChanges(true), []);

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
      difficulty,
    });

    setHasChanges(false);
    router.back();
  }, [deckId, cardId, question, answer, explanation, hint1, hint2, difficulty, updateFlashcard, router]);

  const handleDelete = useCallback(() => {
    if (!deckId || !cardId) return;
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
  }, [deckId, cardId, deleteFlashcard, router]);

  const handleBack = useCallback(() => {
    if (hasChanges) {
      Alert.alert('Unsaved Changes', 'You have unsaved changes. Discard them?', [
        { text: 'Keep Editing', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: () => router.back() },
      ]);
    } else {
      router.back();
    }
  }, [hasChanges, router]);

  if (!deck || !card) {
    return (
      <LinearGradient colors={backgroundGradient} style={styles.root}>
        <SafeAreaView style={styles.safe} edges={['top']}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <ArrowLeft color={theme.text} size={22} />
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
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
            <ArrowLeft color={theme.text} size={22} strokeWidth={2.2} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.text }]} numberOfLines={1}>
            Edit Card
          </Text>
          <TouchableOpacity
            onPress={handleSave}
            disabled={!question.trim() || !answer.trim()}
            style={[
              styles.saveBtn,
              {
                backgroundColor: question.trim() && answer.trim() ? theme.primary : theme.border,
              },
            ]}
          >
            <Check color="#fff" size={18} strokeWidth={2.5} />
            <Text style={styles.saveBtnText}>Save</Text>
          </TouchableOpacity>
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Deck pill */}
            <View style={styles.deckPill}>
              <View style={[styles.deckDot, { backgroundColor: deck.color }]} />
              <Text style={[styles.deckPillText, { color: theme.textSecondary }]}>
                {deck.name}
              </Text>
            </View>

            {/* Question */}
            <View style={[styles.fieldCard, { backgroundColor: surfaceBg }]}>
              <View style={styles.fieldHeader}>
                <HelpCircle color={theme.primary} size={16} />
                <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Question</Text>
              </View>
              <TextInput
                style={[styles.input, styles.inputLarge, { color: theme.text, backgroundColor: inputBg, borderColor: theme.border }]}
                value={question}
                onChangeText={(t) => { setQuestion(t); markChanged(); }}
                placeholder="Enter the question"
                placeholderTextColor={theme.textTertiary}
                multiline
                maxLength={500}
              />
            </View>

            {/* Answer */}
            <View style={[styles.fieldCard, { backgroundColor: surfaceBg }]}>
              <View style={styles.fieldHeader}>
                <MessageSquare color={theme.success} size={16} />
                <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Answer</Text>
              </View>
              <TextInput
                style={[styles.input, { color: theme.text, backgroundColor: inputBg, borderColor: theme.border }]}
                value={answer}
                onChangeText={(t) => { setAnswer(t); markChanged(); }}
                placeholder="Short answer (1–5 words ideal)"
                placeholderTextColor={theme.textTertiary}
                maxLength={200}
              />
            </View>

            {/* Explanation */}
            <View style={[styles.fieldCard, { backgroundColor: surfaceBg }]}>
              <View style={styles.fieldHeader}>
                <Sparkles color={theme.warning} size={16} />
                <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Explanation (optional)</Text>
              </View>
              <TextInput
                style={[styles.input, styles.inputLarge, { color: theme.text, backgroundColor: inputBg, borderColor: theme.border }]}
                value={explanation}
                onChangeText={(t) => { setExplanation(t); markChanged(); }}
                placeholder="Add context or examples"
                placeholderTextColor={theme.textTertiary}
                multiline
                maxLength={500}
              />
            </View>

            {/* Hints */}
            <View style={[styles.fieldCard, { backgroundColor: surfaceBg }]}>
              <View style={styles.fieldHeader}>
                <Lightbulb color={theme.primary} size={16} />
                <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Hints (optional)</Text>
              </View>
              <TextInput
                style={[styles.input, { color: theme.text, backgroundColor: inputBg, borderColor: theme.border, marginBottom: 8 }]}
                value={hint1}
                onChangeText={(t) => { setHint1(t); markChanged(); }}
                placeholder="Hint 1"
                placeholderTextColor={theme.textTertiary}
                maxLength={200}
              />
              <TextInput
                style={[styles.input, { color: theme.text, backgroundColor: inputBg, borderColor: theme.border }]}
                value={hint2}
                onChangeText={(t) => { setHint2(t); markChanged(); }}
                placeholder="Hint 2"
                placeholderTextColor={theme.textTertiary}
                maxLength={200}
              />
            </View>

            {/* Difficulty */}
            <View style={[styles.fieldCard, { backgroundColor: surfaceBg }]}>
              <View style={styles.fieldHeader}>
                <Tag color={theme.textSecondary} size={16} />
                <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Difficulty</Text>
              </View>
              <View style={styles.difficultyRow}>
                {DIFFICULTY_OPTIONS.map((opt) => {
                  const isSelected = difficulty === opt;
                  const color = DIFFICULTY_COLORS[opt];
                  return (
                    <TouchableOpacity
                      key={opt}
                      onPress={() => { setDifficulty(opt); markChanged(); }}
                      style={[
                        styles.difficultyChip,
                        {
                          backgroundColor: isSelected ? color : 'transparent',
                          borderColor: isSelected ? color : theme.border,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.difficultyChipText,
                          { color: isSelected ? '#fff' : theme.textSecondary },
                        ]}
                      >
                        {opt.charAt(0).toUpperCase() + opt.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Delete */}
            <TouchableOpacity
              style={[styles.deleteBtn, { backgroundColor: 'rgba(239, 68, 68, 0.1)' }]}
              onPress={handleDelete}
            >
              <Trash2 color={theme.error} size={18} />
              <Text style={[styles.deleteBtnText, { color: theme.error }]}>Delete This Card</Text>
            </TouchableOpacity>

            <View style={{ height: 40 }} />
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
  backBtn: {
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
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  headerSpacer: { width: 40 },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  saveBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
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
    fontWeight: '600',
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
    fontWeight: '600',
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
  inputLarge: {
    minHeight: 80,
    textAlignVertical: 'top',
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
    fontWeight: '600',
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 8,
  },
  deleteBtnText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
