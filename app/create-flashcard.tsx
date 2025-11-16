import { Audio } from 'expo-av';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Plus, Trash2, Mic, CircleDot, Camera, Image as ImageIcon, FileText } from 'lucide-react-native';
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
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
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useFlashQuest } from '../context/FlashQuestContext';
import { useTheme } from '../context/ThemeContext';
import { trpc } from '../lib/trpc';
import { Flashcard } from '../types/flashcard';

interface CardInput {
  id: string;
  question: string;
  answer: string;
}

interface GeneratedFlashcard {
  question: string;
  answer: string;
  tags?: string[];
}

interface PreparedImage {
  base64: string;
  mimeType: string;
  name: string;
  previewUri: string;
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
  const recordingRef = useRef<Audio.Recording | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaChunksRef = useRef<Blob[]>([]);
  const [activeVoiceInput, setActiveVoiceInput] = useState<string | null>(null);
  const [recentImagePreviews, setRecentImagePreviews] = useState<string[]>([]);
  const [lastImportSummary, setLastImportSummary] = useState<string | null>(null);
  const [googleDocUrl, setGoogleDocUrl] = useState<string>('');

  const {
    mutateAsync: generateFromImagesAsync,
    isPending: isGeneratingFromImages,
  } = trpc.flashcards.fromImage.useMutation();

  const {
    mutateAsync: generateFromDocAsync,
    isPending: isImportingGoogleDoc,
  } = trpc.flashcards.fromGoogleDoc.useMutation();

  const transcribeAudioMutation = useMutation<
    { text: string; language: string },
    Error,
    { formData: FormData }
  >({
    mutationFn: async ({ formData }) => {
      console.log('Uploading audio for transcription...');
      const response = await fetch('https://toolkit.rork.com/stt/transcribe/', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Transcription failed response:', response.status, errorText);
        throw new Error(`Transcription failed: ${response.status} ${errorText}`);
      }

      const data = await response.json() as { text: string; language: string };
      return data;
    },
  });

  const isTranscribing = transcribeAudioMutation.isPending;

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

  const applyGeneratedFlashcards = useCallback(
    (payload: { flashcards: GeneratedFlashcard[]; suggestedDeckName?: string | null; summary?: string | null }) => {
      let additionsCount = 0;

      setCards((prev) => {
        const seen = new Set(prev.map((card) => card.question.trim().toLowerCase()));
        const additions: CardInput[] = [];

        payload.flashcards.forEach((item) => {
          const trimmedQuestion = item.question.trim();
          const trimmedAnswer = item.answer.trim();
          if (!trimmedQuestion || !trimmedAnswer) {
            return;
          }
          const normalizedQuestion = trimmedQuestion.toLowerCase();
          if (seen.has(normalizedQuestion)) {
            return;
          }
          additions.push({
            id: `${Date.now()}_${Math.random().toString(16).slice(2, 8)}`,
            question: trimmedQuestion,
            answer: trimmedAnswer,
          });
          seen.add(normalizedQuestion);
        });

        additionsCount = additions.length;
        if (additions.length === 0) {
          return prev;
        }
        return [...prev, ...additions];
      });

      if (!deckName.trim() && payload.suggestedDeckName?.trim()) {
        setDeckName(payload.suggestedDeckName.trim());
      }

      if (payload.summary?.trim()) {
        setLastImportSummary(payload.summary.trim());
      } else {
        setLastImportSummary(null);
      }

      if (additionsCount === 0) {
        Alert.alert('No New Cards', 'All generated flashcards already exist in this deck.');
      } else {
        Alert.alert('Flashcards Added', `${additionsCount} new flashcard${additionsCount === 1 ? '' : 's'} ready to review.`);
      }
    },
    [deckName]
  );

  const processImageAssets = useCallback(
    async (assets: ImagePicker.ImagePickerAsset[]) => {
      const prepared = assets.reduce<PreparedImage[]>((acc, asset, index) => {
        if (!asset.base64) {
          console.log('[ImageIntake] Asset missing base64, skipping', asset.uri);
          return acc;
        }
        const mimeType = asset.mimeType ?? 'image/jpeg';
        const name = asset.fileName ?? `scan-${Date.now()}-${index + 1}.jpg`;
        acc.push({
          base64: asset.base64,
          mimeType,
          name,
          previewUri: asset.uri,
        });
        return acc;
      }, []);

      if (prepared.length === 0) {
        Alert.alert('Image Unavailable', 'We could not read these images. Please try again with clearer photos.');
        return;
      }

      setRecentImagePreviews((prev) => {
        const combined = [...prepared.map((item) => item.previewUri), ...prev];
        return combined.slice(0, 8);
      });

      const contextPieces = [deckName.trim(), deckDescription.trim()].filter(Boolean);

      const result = await generateFromImagesAsync({
        images: prepared.map(({ base64, mimeType, name }) => ({ base64, mimeType, name })),
        deckContext: contextPieces.length ? contextPieces.join('. ') : undefined,
      });

      applyGeneratedFlashcards(result);
    },
    [deckName, deckDescription, generateFromImagesAsync, applyGeneratedFlashcards]
  );

  const handleImageIntake = useCallback(
    async (source: 'camera' | 'library') => {
      if (isTranscribing || isGeneratingFromImages) {
        return;
      }

      try {
        if (source === 'camera') {
          const permission = await ImagePicker.requestCameraPermissionsAsync();
          if (!permission.granted) {
            Alert.alert('Permission Required', 'Please allow camera access to capture your notes.');
            return;
          }

          const cameraResult = await ImagePicker.launchCameraAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            base64: true,
            quality: 0.8,
          });

          if (cameraResult.canceled) {
            return;
          }

          await processImageAssets(cameraResult.assets ?? []);
        } else {
          const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (!permission.granted) {
            Alert.alert('Permission Required', 'Please allow photo library access to import images.');
            return;
          }

          const libraryResult = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsMultipleSelection: true,
            selectionLimit: 6,
            base64: true,
            quality: 0.75,
          });

          if (libraryResult.canceled) {
            return;
          }

          await processImageAssets(libraryResult.assets ?? []);
        }
      } catch (error) {
        console.error('[ImageIntake] Failed to process images', error);
        Alert.alert('Image Error', 'We could not process those images. Please try again.');
      }
    },
    [isTranscribing, isGeneratingFromImages, processImageAssets]
  );

  const handleGoogleDocImport = useCallback(async () => {
    if (isImportingGoogleDoc) {
      return;
    }

    if (!googleDocUrl.trim()) {
      Alert.alert('Missing Link', 'Paste a Google Docs link to convert it into flashcards.');
      return;
    }

    try {
      console.log('[GoogleDocImport] Starting import');
      const contextPieces = [deckName.trim(), deckDescription.trim()].filter(Boolean);

      const result = await generateFromDocAsync({
        docUrl: googleDocUrl.trim(),
        deckContext: contextPieces.length ? contextPieces.join('. ') : undefined,
      });

      applyGeneratedFlashcards(result);
      setGoogleDocUrl('');
    } catch (error) {
      console.error('[GoogleDocImport] Failed', error);
      const message = error instanceof Error ? error.message : 'Unable to import that document.';
      Alert.alert('Import Failed', message);
    }
  }, [isImportingGoogleDoc, googleDocUrl, deckName, deckDescription, generateFromDocAsync, applyGeneratedFlashcards]);

  const addCard = () => {
    setCards([...cards, { id: Date.now().toString(), question: '', answer: '' }]);
  };

  const removeCard = (id: string) => {
    if (cards.length > 1) {
      setCards(cards.filter((c) => c.id !== id));
    }
  };

  const startRecording = async (inputId: string) => {
    if (transcribeAudioMutation.isPending) {
      console.log('Transcription is in progress, ignoring new recording request');
      return;
    }

    if (activeVoiceInput) {
      console.log('Recording already active for input:', activeVoiceInput);
      return;
    }

    try {
      console.log('Preparing to start recording for input:', inputId);

      if (Platform.OS === 'web') {
        if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
          Alert.alert('Unsupported', 'Voice recording is not supported in this browser');
          return;
        }

        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaStreamRef.current = stream;

        const preferredMimeTypes = [
          'audio/webm;codecs=opus',
          'audio/webm',
          'audio/ogg;codecs=opus',
        ];
        const selectedMimeType = preferredMimeTypes.find((type) => {
          try {
            return typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type);
          } catch (mimeError) {
            console.log('Unable to validate mime type support:', mimeError);
            return false;
          }
        }) ?? 'audio/webm';

        const recorder = new MediaRecorder(stream, { mimeType: selectedMimeType });
        mediaChunksRef.current = [];
        mediaRecorderRef.current = recorder;

        recorder.addEventListener('dataavailable', (event) => {
          if (event.data && event.data.size > 0) {
            mediaChunksRef.current.push(event.data);
          }
        });

        recorder.start();
        console.log('Web recording started with mime type:', selectedMimeType);
      } else {
        const permission = await Audio.requestPermissionsAsync();
        if (!permission.granted) {
          Alert.alert('Permission Required', 'Please grant microphone permission to use voice input');
          return;
        }

        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
          shouldDuckAndroid: true,
          staysActiveInBackground: false,
        });

        const recording = new Audio.Recording();
        await recording.prepareToRecordAsync({
          android: {
            extension: '.m4a',
            outputFormat: Audio.AndroidOutputFormat.MPEG_4,
            audioEncoder: Audio.AndroidAudioEncoder.AAC,
            sampleRate: 44100,
            numberOfChannels: 1,
            bitRate: 128000,
          },
          ios: {
            extension: '.wav',
            outputFormat: Audio.IOSOutputFormat.LINEARPCM,
            audioQuality: Audio.IOSAudioQuality.HIGH,
            sampleRate: 44100,
            numberOfChannels: 1,
            bitRate: 128000,
            linearPCMBitDepth: 16,
            linearPCMIsBigEndian: false,
            linearPCMIsFloat: false,
          },
        });
        await recording.startAsync();
        recordingRef.current = recording;
        console.log('Native recording started');
      }

      setActiveVoiceInput(inputId);
    } catch (err) {
      console.error('Failed to start recording:', err);
      if (Platform.OS !== 'web') {
        try {
          await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
        } catch (modeError) {
          console.log('Failed to reset audio mode after start failure', modeError);
        }
      }
      if (mediaStreamRef.current) {
        try {
          mediaStreamRef.current.getTracks().forEach((track) => track.stop());
        } catch (streamError) {
          console.log('Failed to stop media stream after start failure', streamError);
        }
        mediaStreamRef.current = null;
      }
      mediaRecorderRef.current = null;
      mediaChunksRef.current = [];
      Alert.alert('Error', 'Failed to start recording');
    }
  };

  const stopRecording = async () => {
    if (!activeVoiceInput) {
      return;
    }

    const targetInput = activeVoiceInput;
    console.log('Stopping recording for input:', targetInput);

    try {
      let formData: FormData | null = null;

      if (Platform.OS === 'web') {
        const recorder = mediaRecorderRef.current;
        if (!recorder) {
          console.log('No active web recorder found when stopping');
          setActiveVoiceInput(null);
          return;
        }

        const blob = await new Promise<Blob>((resolve, reject) => {
          const handleStop = () => {
            recorder.removeEventListener('stop', handleStop);
            recorder.removeEventListener('error', handleError as EventListener);
            try {
              mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
            } catch (streamError) {
              console.log('Failed to stop stream tracks after recording', streamError);
            }
            const output = new Blob(mediaChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
            mediaChunksRef.current = [];
            resolve(output);
          };

          const handleError = (event: Event) => {
            recorder.removeEventListener('stop', handleStop);
            recorder.removeEventListener('error', handleError as EventListener);
            mediaChunksRef.current = [];
            reject(event instanceof ErrorEvent ? event.error : new Error('MediaRecorder error'));
          };

          recorder.addEventListener('stop', handleStop);
          recorder.addEventListener('error', handleError as EventListener);
          recorder.stop();
        });

        mediaRecorderRef.current = null;
        mediaStreamRef.current = null;

        console.log('Web recording size (bytes):', blob.size);

        const file = new File([blob], 'recording.webm', {
          type: blob.type || 'audio/webm',
        });

        formData = new FormData();
        formData.append('audio', file);
      } else {
        const recording = recordingRef.current;
        if (!recording) {
          console.log('No native recording active when stopping');
          setActiveVoiceInput(null);
          return;
        }

        await recording.stopAndUnloadAsync();
        try {
          await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
        } catch (modeError) {
          console.log('Audio mode reset failed after stop', modeError);
        }

        const uri = recording.getURI();
        recordingRef.current = null;

        if (!uri) {
          throw new Error('Recording file unavailable');
        }

        console.log('Recording saved at:', uri);

        const extension = getFileExtensionFromUri(uri);
        const mimeType = getMimeTypeForExtension(extension);
        formData = new FormData();
        formData.append(
          'audio',
          {
            uri,
            name: `recording.${extension}`,
            type: mimeType,
          } as unknown as Blob,
        );
      }

      if (!formData) {
        throw new Error('Failed to assemble audio payload');
      }

      const data = await transcribeAudioMutation.mutateAsync({ formData });
      console.log('Transcription result:', data.text);

      const transcript = data.text.trim();
      if (targetInput.startsWith('card_')) {
        const [, cardId, field] = targetInput.split('_');
        updateCard(cardId, field as 'question' | 'answer', transcript);
      } else if (targetInput === 'deckName') {
        setDeckName(transcript);
      } else if (targetInput === 'deckDescription') {
        setDeckDescription(transcript);
      }
    } catch (err) {
      console.error('Failed to transcribe:', err);
      const message = err instanceof Error ? err.message : 'Failed to transcribe audio';
      Alert.alert('Error', message.includes('Transcription failed') ? 'Unable to transcribe this recording. Please try again with a clearer sample.' : 'Failed to transcribe audio');
    } finally {
      if (Platform.OS === 'web') {
        mediaChunksRef.current = [];
        if (mediaStreamRef.current) {
          try {
            mediaStreamRef.current.getTracks().forEach((track) => track.stop());
          } catch (streamError) {
            console.log('Failed to stop media stream during cleanup', streamError);
          }
          mediaStreamRef.current = null;
        }
        mediaRecorderRef.current = null;
      } else {
        recordingRef.current = null;
        try {
          await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
        } catch (modeError) {
          console.log('Audio mode reset failed during cleanup', modeError);
        }
      }

      setActiveVoiceInput(null);
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
                  editable={!isTranscribing && !isGeneratingFromImages && !isImportingGoogleDoc}
                />
                <TouchableOpacity
                  style={[
                    styles.micButton,
                    { backgroundColor: activeVoiceInput === 'deckName' ? theme.error : theme.primary },
                  ]}
                  onPress={() => {
                    if (activeVoiceInput === 'deckName') {
                      void stopRecording();
                    } else {
                      void startRecording('deckName');
                    }
                  }}
                  disabled={isTranscribing || isGeneratingFromImages || isImportingGoogleDoc}
                  activeOpacity={0.8}
                >
                  {isTranscribing && activeVoiceInput === 'deckName' ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : activeVoiceInput === 'deckName' ? (
                    <CircleDot color="#fff" size={20} strokeWidth={2.5} />
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
                  editable={!isTranscribing && !isGeneratingFromImages && !isImportingGoogleDoc}
                />
                <TouchableOpacity
                  style={[
                    styles.micButton,
                    { backgroundColor: activeVoiceInput === 'deckDescription' ? theme.error : theme.primary },
                  ]}
                  onPress={() => {
                    if (activeVoiceInput === 'deckDescription') {
                      void stopRecording();
                    } else {
                      void startRecording('deckDescription');
                    }
                  }}
                  disabled={isTranscribing || isGeneratingFromImages || isImportingGoogleDoc}
                  activeOpacity={0.8}
                >
                  {isTranscribing && activeVoiceInput === 'deckDescription' ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : activeVoiceInput === 'deckDescription' ? (
                    <CircleDot color="#fff" size={20} strokeWidth={2.5} />
                  ) : (
                    <Mic color="#fff" size={20} strokeWidth={2.5} />
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>

          <View style={styles.smartImportSection}>
            <Text style={[styles.sectionTitle, { color: theme.white }]}>Smart Imports</Text>
            <Text style={[styles.smartImportSubtitle, { color: theme.textSecondary }]}>Scan handwritten notes, upload study sheets, or convert a Google Doc into ready-to-study flashcards.</Text>

            <View style={styles.smartActionsRow}>
              <TouchableOpacity
                style={[
                  styles.smartActionCard,
                  { backgroundColor: isDark ? 'rgba(30, 41, 59, 0.85)' : 'rgba(255, 255, 255, 0.7)' },
                  isGeneratingFromImages ? styles.disabledCard : null,
                ]}
                onPress={() => {
                  void handleImageIntake('camera');
                }}
                disabled={isGeneratingFromImages || isTranscribing}
                activeOpacity={0.85}
                testID="scanNotesCameraButton"
              >
                <View style={[styles.smartActionIconWrapper, { backgroundColor: theme.primary }] }>
                  {isGeneratingFromImages ? (
                    <ActivityIndicator color={theme.white} />
                  ) : (
                    <Camera color={theme.white} size={20} strokeWidth={2.5} />
                  )}
                </View>
                <Text style={[styles.smartActionTitle, { color: theme.white }]}>Scan Notes</Text>
                <Text style={[styles.smartActionSubtitle, { color: theme.textSecondary }]}>Snap a photo and let AI draft cards instantly.</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.smartActionCard,
                  { backgroundColor: isDark ? 'rgba(30, 41, 59, 0.7)' : 'rgba(255, 255, 255, 0.55)' },
                  isGeneratingFromImages ? styles.disabledCard : null,
                ]}
                onPress={() => {
                  void handleImageIntake('library');
                }}
                disabled={isGeneratingFromImages || isTranscribing}
                activeOpacity={0.85}
                testID="scanNotesUploadButton"
              >
                <View style={[styles.smartActionIconWrapper, { backgroundColor: theme.primaryDark }] }>
                  {isGeneratingFromImages ? (
                    <ActivityIndicator color={theme.white} />
                  ) : (
                    <ImageIcon color={theme.white} size={20} strokeWidth={2.5} />
                  )}
                </View>
                <Text style={[styles.smartActionTitle, { color: theme.white }]}>Upload Study Sheets</Text>
                <Text style={[styles.smartActionSubtitle, { color: theme.textSecondary }]}>Import PDFs or screenshots from your device.</Text>
              </TouchableOpacity>
            </View>

            {recentImagePreviews.length > 0 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.imagePreviewList}
                contentContainerStyle={styles.imagePreviewContent}
              >
                {recentImagePreviews.map((uri) => (
                  <View key={uri} style={[styles.imagePreviewItem, { borderColor: theme.white }] }>
                    <Image source={{ uri }} style={styles.imagePreviewImage} contentFit="cover" />
                  </View>
                ))}
              </ScrollView>
            )}

            <View style={[styles.smartDocContainer, { backgroundColor: isDark ? 'rgba(30, 41, 59, 0.85)' : 'rgba(255, 255, 255, 0.65)' }] }>
              <View style={styles.smartDocHeader}>
                <View style={[styles.smartActionIconWrapper, { backgroundColor: theme.primary }] }>
                  {isImportingGoogleDoc ? (
                    <ActivityIndicator color={theme.white} />
                  ) : (
                    <FileText color={theme.white} size={20} strokeWidth={2.5} />
                  )}
                </View>
                <View style={styles.smartDocHeaderText}>
                  <Text style={[styles.smartActionTitle, { color: theme.white }]}>Google Docs Import</Text>
                  <Text style={[styles.smartActionSubtitle, { color: theme.textSecondary }]}>Paste a shareable link to your lecture notes and turn them into flashcards.</Text>
                </View>
              </View>

              <TextInput
                style={[styles.docInput, { backgroundColor: isDark ? 'rgba(15, 23, 42, 0.65)' : 'rgba(255, 255, 255, 0.9)', color: theme.text }]}
                value={googleDocUrl}
                onChangeText={setGoogleDocUrl}
                placeholder="https://docs.google.com/document/d/..."
                placeholderTextColor={placeholderColor}
                autoCapitalize="none"
                keyboardType="url"
                editable={!isImportingGoogleDoc && !isGeneratingFromImages}
              />

              <TouchableOpacity
                style={[styles.docImportButton, { backgroundColor: theme.primary }]}
                onPress={() => {
                  void handleGoogleDocImport();
                }}
                disabled={isImportingGoogleDoc || isGeneratingFromImages}
                activeOpacity={0.85}
                testID="googleDocImportButton"
              >
                {isImportingGoogleDoc ? (
                  <ActivityIndicator color={theme.white} />
                ) : (
                  <Text style={[styles.docImportButtonText, { color: theme.white }]}>Convert Google Doc</Text>
                )}
              </TouchableOpacity>

              {lastImportSummary && (
                <View style={[styles.importSummaryCard, { backgroundColor: isDark ? 'rgba(15, 23, 42, 0.65)' : 'rgba(255, 255, 255, 0.9)' }] }>
                  <Text style={[styles.importSummaryTitle, { color: theme.textSecondary }]}>Study Summary</Text>
                  <Text style={[styles.importSummaryText, { color: theme.text }]}>{lastImportSummary}</Text>
                </View>
              )}
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
                      editable={!isTranscribing && !isGeneratingFromImages && !isImportingGoogleDoc}
                    />
                    <TouchableOpacity
                      style={[
                        styles.micButton,
                        { backgroundColor: activeVoiceInput === `card_${card.id}_question` ? theme.error : theme.primary },
                      ]}
                      onPress={() => {
                        if (activeVoiceInput === `card_${card.id}_question`) {
                          void stopRecording();
                        } else {
                          void startRecording(`card_${card.id}_question`);
                        }
                      }}
                      disabled={isTranscribing || isGeneratingFromImages || isImportingGoogleDoc}
                      activeOpacity={0.8}
                    >
                      {isTranscribing && activeVoiceInput === `card_${card.id}_question` ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : activeVoiceInput === `card_${card.id}_question` ? (
                        <CircleDot color="#fff" size={18} strokeWidth={2.5} />
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
                      editable={!isTranscribing && !isGeneratingFromImages && !isImportingGoogleDoc}
                    />
                    <TouchableOpacity
                      style={[
                        styles.micButton,
                        { backgroundColor: activeVoiceInput === `card_${card.id}_answer` ? theme.error : theme.primary },
                      ]}
                      onPress={() => {
                        if (activeVoiceInput === `card_${card.id}_answer`) {
                          void stopRecording();
                        } else {
                          void startRecording(`card_${card.id}_answer`);
                        }
                      }}
                      disabled={isTranscribing || isGeneratingFromImages || isImportingGoogleDoc}
                      activeOpacity={0.8}
                    >
                      {isTranscribing && activeVoiceInput === `card_${card.id}_answer` ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : activeVoiceInput === `card_${card.id}_answer` ? (
                        <CircleDot color="#fff" size={18} strokeWidth={2.5} />
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
    gap: 32,
  },
  deckInfoSection: {
    paddingHorizontal: 24,
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
  smartImportSection: {
    paddingHorizontal: 24,
    gap: 20,
  },
  smartImportSubtitle: {
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
  },
  smartActionsRow: {
    flexDirection: 'row',
    gap: 16,
  },
  smartActionCard: {
    flex: 1,
    borderRadius: 24,
    paddingVertical: 20,
    paddingHorizontal: 20,
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
    gap: 8,
  },
  smartActionIconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  smartActionTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  smartActionSubtitle: {
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
  },
  smartDocContainer: {
    borderRadius: 24,
    padding: 20,
    gap: 16,
  },
  smartDocHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  smartDocHeaderText: {
    flex: 1,
    gap: 8,
  },
  docInput: {
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 15,
    fontWeight: '500',
  },
  docImportButton: {
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  docImportButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
  imagePreviewList: {
    marginTop: 8,
  },
  imagePreviewContent: {
    gap: 12,
    paddingRight: 12,
  },
  imagePreviewItem: {
    width: 72,
    height: 72,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1.5,
  },
  imagePreviewImage: {
    width: '100%',
    height: '100%',
  },
  importSummaryCard: {
    borderRadius: 18,
    padding: 16,
    gap: 8,
  },
  importSummaryTitle: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  importSummaryText: {
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
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
  disabledCard: {
    opacity: 0.6,
  },
});
