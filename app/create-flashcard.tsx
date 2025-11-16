import { Audio } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Plus, Trash2, Mic, MicOff } from 'lucide-react-native';
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
  ActivityIndicator,
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

const getFileExtensionFromUri = (uri: string): string => {
  const match = /\.([a-zA-Z0-9]+)(?:\?|$)/.exec(uri);
  if (match?.[1]) {
    return match[1].toLowerCase();
  }
  if (Platform.OS === 'ios') {
    return 'wav';
  }
  if (Platform.OS === 'android') {
    return 'm4a';
  }
  return 'webm';
};

const getMimeTypeForExtension = (extension: string): string => {
  const map: Record<string, string> = {
    aac: 'audio/aac',
    m4a: 'audio/mp4',
    mp3: 'audio/mpeg',
    mp4: 'audio/mp4',
    wav: 'audio/wav',
    webm: 'audio/webm',
  };
  return map[extension] ?? 'audio/mpeg';
};

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
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [activeVoiceInput, setActiveVoiceInput] = useState<string | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);

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

  const startRecording = async (inputId: string) => {
    try {
      console.log('Requesting audio permissions...');
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission Required', 'Please grant microphone permission to use voice input');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      console.log('Starting recording...');
      const { recording: newRecording } = await Audio.Recording.createAsync({
        android: {
          extension: '.m4a',
          outputFormat: Audio.AndroidOutputFormat.MPEG_4,
          audioEncoder: Audio.AndroidAudioEncoder.AAC,
          sampleRate: 44100,
          numberOfChannels: 2,
          bitRate: 128000,
        },
        ios: {
          extension: '.wav',
          outputFormat: Audio.IOSOutputFormat.LINEARPCM,
          audioQuality: Audio.IOSAudioQuality.HIGH,
          sampleRate: 44100,
          numberOfChannels: 2,
          bitRate: 128000,
          linearPCMBitDepth: 16,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: false,
        },
        web: {
          mimeType: 'audio/webm',
          bitsPerSecond: 128000,
        },
      });

      setRecording(newRecording);
      setActiveVoiceInput(inputId);
    } catch (err) {
      console.error('Failed to start recording:', err);
      Alert.alert('Error', 'Failed to start recording');
    }
  };

  const stopRecording = async () => {
    if (!recording || !activeVoiceInput) {
      return;
    }

    const targetInput = activeVoiceInput;
    setIsTranscribing(true);
    console.log('Stopping recording...');

    try {
      await recording.stopAndUnloadAsync();
      if (Platform.OS !== 'web') {
        await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
      }

      const uri = recording.getURI();
      if (!uri) {
        throw new Error('Recording file unavailable');
      }

      console.log('Recording saved at:', uri);

      const extension = getFileExtensionFromUri(uri);
      const mimeType = getMimeTypeForExtension(extension);
      const formData = new FormData();

      if (Platform.OS === 'web') {
        console.log('Preparing web blob for transcription');
        const webResponse = await fetch(uri);
        const blob = await webResponse.blob();
        formData.append('audio', blob, `recording.${extension}`);
      } else {
        formData.append(
          'audio',
          {
            uri,
            name: `recording.${extension}`,
            type: mimeType,
          } as unknown as Blob,
        );
      }

      console.log('Transcribing audio with mime type:', mimeType);
      const response = await fetch('https://toolkit.rork.com/stt/transcribe/', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Transcription failed: ${response.status} ${errorText}`);
      }

      const data = await response.json() as { text: string; language: string };
      console.log('Transcription result:', data.text);

      if (targetInput.startsWith('card_')) {
        const [, cardId, field] = targetInput.split('_');
        updateCard(cardId, field as 'question' | 'answer', data.text);
      } else if (targetInput === 'deckName') {
        setDeckName(data.text);
      } else if (targetInput === 'deckDescription') {
        setDeckDescription(data.text);
      }
    } catch (err) {
      console.error('Failed to transcribe:', err);
      const message = err instanceof Error ? err.message : 'Failed to transcribe audio';
      Alert.alert('Error', message.includes('Transcription failed') ? 'Unable to transcribe this recording. Please try again with a clearer sample.' : 'Failed to transcribe audio');
    } finally {
      if (Platform.OS === 'web') {
        try {
          const status = await recording.getStatusAsync();
          console.log('Web recording status after stop:', status);
        } catch (statusError) {
          console.log('Unable to fetch recording status after stop:', statusError);
        }
      }
      setRecording(null);
      setActiveVoiceInput(null);
      setIsTranscribing(false);
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
              <View style={styles.inputWithMic}>
                <TextInput
                  style={[styles.input, styles.inputWithButton, { backgroundColor: theme.cardBackground, color: theme.text }]}
                  value={deckName}
                  onChangeText={setDeckName}
                  placeholder="e.g. Spanish Vocabulary"
                  placeholderTextColor={placeholderColor}
                  testID="deckNameInput"
                  editable={!isTranscribing}
                />
                <TouchableOpacity
                  style={[
                    styles.micButton,
                    { backgroundColor: activeVoiceInput === 'deckName' ? theme.error : theme.primary },
                  ]}
                  onPress={() => activeVoiceInput === 'deckName' ? stopRecording() : startRecording('deckName')}
                  disabled={isTranscribing}
                  activeOpacity={0.8}
                >
                  {isTranscribing && activeVoiceInput === 'deckName' ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : activeVoiceInput === 'deckName' ? (
                    <MicOff color="#fff" size={20} strokeWidth={2.5} />
                  ) : (
                    <Mic color="#fff" size={20} strokeWidth={2.5} />
                  )}
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.white }]}>Description (Optional)</Text>
              <View style={styles.inputWithMic}>
                <TextInput
                  style={[styles.input, styles.textArea, styles.inputWithButton, { backgroundColor: theme.cardBackground, color: theme.text }]}
                  value={deckDescription}
                  onChangeText={setDeckDescription}
                  placeholder="What is this deck about?"
                  placeholderTextColor={placeholderColor}
                  multiline
                  numberOfLines={3}
                  testID="deckDescriptionInput"
                  editable={!isTranscribing}
                />
                <TouchableOpacity
                  style={[
                    styles.micButton,
                    { backgroundColor: activeVoiceInput === 'deckDescription' ? theme.error : theme.primary },
                  ]}
                  onPress={() => activeVoiceInput === 'deckDescription' ? stopRecording() : startRecording('deckDescription')}
                  disabled={isTranscribing}
                  activeOpacity={0.8}
                >
                  {isTranscribing && activeVoiceInput === 'deckDescription' ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : activeVoiceInput === 'deckDescription' ? (
                    <MicOff color="#fff" size={20} strokeWidth={2.5} />
                  ) : (
                    <Mic color="#fff" size={20} strokeWidth={2.5} />
                  )}
                </TouchableOpacity>
              </View>
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
                  <View style={styles.inputWithMic}>
                    <TextInput
                      style={[styles.cardInput, styles.inputWithButton, { backgroundColor: cardFieldBackground, color: theme.text }]}
                      value={card.question}
                      onChangeText={(text) => updateCard(card.id, 'question', text)}
                      placeholder="Enter the question..."
                      placeholderTextColor={placeholderColor}
                      multiline
                      testID={`cardQuestionInput-${card.id}`}
                      editable={!isTranscribing}
                    />
                    <TouchableOpacity
                      style={[
                        styles.micButton,
                        { backgroundColor: activeVoiceInput === `card_${card.id}_question` ? theme.error : theme.primary },
                      ]}
                      onPress={() => activeVoiceInput === `card_${card.id}_question` ? stopRecording() : startRecording(`card_${card.id}_question`)}
                      disabled={isTranscribing}
                      activeOpacity={0.8}
                    >
                      {isTranscribing && activeVoiceInput === `card_${card.id}_question` ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : activeVoiceInput === `card_${card.id}_question` ? (
                        <MicOff color="#fff" size={18} strokeWidth={2.5} />
                      ) : (
                        <Mic color="#fff" size={18} strokeWidth={2.5} />
                      )}
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.cardInputGroup}>
                  <Text style={[styles.cardInputLabel, { color: theme.textSecondary }]}>Answer</Text>
                  <View style={styles.inputWithMic}>
                    <TextInput
                      style={[styles.cardInput, styles.inputWithButton, { backgroundColor: cardFieldBackground, color: theme.text }]}
                      value={card.answer}
                      onChangeText={(text) => updateCard(card.id, 'answer', text)}
                      placeholder="Enter the answer..."
                      placeholderTextColor={placeholderColor}
                      multiline
                      testID={`cardAnswerInput-${card.id}`}
                      editable={!isTranscribing}
                    />
                    <TouchableOpacity
                      style={[
                        styles.micButton,
                        { backgroundColor: activeVoiceInput === `card_${card.id}_answer` ? theme.error : theme.primary },
                      ]}
                      onPress={() => activeVoiceInput === `card_${card.id}_answer` ? stopRecording() : startRecording(`card_${card.id}_answer`)}
                      disabled={isTranscribing}
                      activeOpacity={0.8}
                    >
                      {isTranscribing && activeVoiceInput === `card_${card.id}_answer` ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : activeVoiceInput === `card_${card.id}_answer` ? (
                        <MicOff color="#fff" size={18} strokeWidth={2.5} />
                      ) : (
                        <Mic color="#fff" size={18} strokeWidth={2.5} />
                      )}
                    </TouchableOpacity>
                  </View>
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
  inputWithMic: {
    position: 'relative',
  },
  inputWithButton: {
    paddingRight: 60,
  },
  micButton: {
    position: 'absolute',
    right: 8,
    top: 8,
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
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
