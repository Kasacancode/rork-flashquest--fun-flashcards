import * as Clipboard from 'expo-clipboard';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { ArrowLeft, Clipboard as ClipboardIcon, FileText, Sparkles } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Keyboard,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import ResponsiveContainer from '@/components/ResponsiveContainer';
import { useDeckContext } from '@/context/DeckContext';
import { useTheme } from '@/context/ThemeContext';
import type { Deck } from '@/types/flashcard';
import { importDeckFromClipboardText, type ImportedDeckResult } from '@/utils/deckImport';
import { createNormalizedFlashcard, normalizeDeck } from '@/utils/flashcardContent';
import { logger } from '@/utils/logger';
import { smartParseText, type ImportedCard, type SmartImportResult } from '@/utils/smartImport';
import { TEXT_TO_DECK_ROUTE } from '@/utils/routes';

function formatCardLabel(count: number): string {
  return count === 1 ? 'card' : 'cards';
}

function createDeckNameSuggestion(cards: ImportedCard[]): string {
  const firstQuestion = cards[0]?.question?.trim() ?? '';
  if (!firstQuestion) {
    return 'Imported Deck';
  }

  const simplified = firstQuestion
    .replace(/[^a-zA-Z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const words = simplified.split(' ').filter((word) => word.length > 0).slice(0, 4);
  const suggestion = words.join(' ').trim();

  if (suggestion.length < 3) {
    return 'Imported Deck';
  }

  return suggestion.slice(0, 60);
}

export default function SmartImportPage() {
  const router = useRouter();
  const { addDeck } = useDeckContext();
  const { theme, isDark } = useTheme();

  const [pastedText, setPastedText] = useState<string>('');
  const [parseResult, setParseResult] = useState<SmartImportResult | null>(null);
  const [deckName, setDeckName] = useState<string>('Imported Deck');
  const [deckNameEdited, setDeckNameEdited] = useState<boolean>(false);
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [showQuizletHelp, setShowQuizletHelp] = useState<boolean>(false);
  const [jsonImportResult, setJsonImportResult] = useState<ImportedDeckResult | null>(null);

  useEffect(() => {
    if (!pastedText.trim()) {
      setParseResult(null);
      setJsonImportResult(null);
      if (!deckNameEdited) {
        setDeckName('Imported Deck');
      }
      return;
    }

    const timer = setTimeout(() => {
      try {
        const importedDeck = importDeckFromClipboardText(pastedText);
        if (importedDeck) {
          const jsonCards = importedDeck.deck.flashcards.map((card) => ({
            question: card.question,
            answer: card.answer,
          }));
          const nextResult: SmartImportResult = {
            cards: jsonCards,
            format: 'json',
            formatLabel: 'FlashQuest deck',
            confidence: 1,
          };
          setJsonImportResult(importedDeck);
          setParseResult(nextResult);
          if (!deckNameEdited) {
            setDeckName(importedDeck.deck.name);
          }
          logger.debug('[SmartImport] Parsed FlashQuest deck with cards:', jsonCards.length);
          return;
        }

        const result = smartParseText(pastedText);
        setJsonImportResult(null);
        setParseResult(result);
        if (!deckNameEdited) {
          setDeckName(createDeckNameSuggestion(result.cards));
        }
        logger.debug('[SmartImport] Parsed text import result:', result.format, result.cards.length, result.confidence);
      } catch (error) {
        logger.warn('[SmartImport] Failed to process pasted text:', error);
        setJsonImportResult(null);
        setParseResult(null);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [deckNameEdited, pastedText]);

  const previewCards = useMemo<ImportedCard[]>(() => {
    return parseResult?.cards.slice(0, 10) ?? [];
  }, [parseResult?.cards]);

  const detectedCardCount = parseResult?.cards.length ?? 0;
  const canImport = Boolean(jsonImportResult) || detectedCardCount > 0;
  const showNoPairsMessage = pastedText.trim().length > 0 && !jsonImportResult && detectedCardCount === 0;
  const showOneCardMessage = pastedText.trim().length > 0 && !jsonImportResult && detectedCardCount === 1;
  const badgeTone = parseResult?.format === 'json'
    ? 'primary'
    : (parseResult?.confidence ?? 0) >= 0.65
      ? 'success'
      : 'warning';

  const badgeColors = useMemo(() => {
    if (badgeTone === 'success') {
      return {
        backgroundColor: isDark ? 'rgba(16,185,129,0.14)' : 'rgba(16,185,129,0.1)',
        borderColor: isDark ? 'rgba(16,185,129,0.28)' : 'rgba(16,185,129,0.18)',
        textColor: theme.success,
      };
    }

    if (badgeTone === 'primary') {
      return {
        backgroundColor: isDark ? 'rgba(139,92,246,0.16)' : 'rgba(99,102,241,0.1)',
        borderColor: isDark ? 'rgba(139,92,246,0.3)' : 'rgba(99,102,241,0.18)',
        textColor: theme.primary,
      };
    }

    return {
      backgroundColor: isDark ? 'rgba(245,158,11,0.14)' : 'rgba(245,158,11,0.1)',
      borderColor: isDark ? 'rgba(245,158,11,0.28)' : 'rgba(245,158,11,0.18)',
      textColor: theme.warning,
    };
  }, [badgeTone, isDark, theme.primary, theme.success, theme.warning]);

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  const handlePasteFromClipboard = useCallback(async () => {
    try {
      Keyboard.dismiss();
      const text = await Clipboard.getStringAsync();
      if (!text?.trim()) {
        Alert.alert('Clipboard Empty', 'Copy some flashcards first, then come back and paste.');
        return;
      }

      logger.debug('[SmartImport] Clipboard text length:', text.length);
      const flashquestDeck = importDeckFromClipboardText(text);
      if (flashquestDeck) {
        addDeck(flashquestDeck.deck);
        Alert.alert(
          'Deck Imported!',
          `"${flashquestDeck.deck.name}" with ${flashquestDeck.cardCount} cards has been added.`,
          [{ text: 'OK', onPress: () => router.back() }],
        );
        return;
      }

      setPastedText(text);
    } catch (error) {
      logger.warn('[SmartImport] Clipboard paste failed:', error);
      Alert.alert('Paste Failed', 'Could not read the clipboard. Please try again.');
    }
  }, [addDeck, router]);

  const handleImport = useCallback(() => {
    if (isImporting) {
      return;
    }

    Keyboard.dismiss();
    setIsImporting(true);

    try {
      if (jsonImportResult) {
        addDeck(jsonImportResult.deck);
        Alert.alert(
          'Deck Imported!',
          `"${jsonImportResult.deck.name}" with ${jsonImportResult.cardCount} cards has been added to your decks.`,
          [{ text: 'OK', onPress: () => router.back() }],
        );
        return;
      }

      if (!parseResult || parseResult.cards.length === 0) {
        setIsImporting(false);
        return;
      }

      const trimmedName = deckName.trim() || 'Imported Deck';
      const newDeckId = `deck_${Date.now()}`;
      const createdAt = Date.now();
      const flashcards = parseResult.cards.map((card, index) => createNormalizedFlashcard({
        id: `import_${newDeckId}_${index}`,
        question: card.question.slice(0, 500),
        answer: card.answer.slice(0, 200),
        deckId: newDeckId,
        difficulty: 'medium',
        tags: [],
        createdAt: createdAt + index,
        imageUrl: undefined,
      }));

      const deck = normalizeDeck({
        id: newDeckId,
        name: trimmedName.slice(0, 100),
        description: `Imported ${flashcards.length} cards (${parseResult.formatLabel})`,
        color: '#6366F1',
        icon: 'download',
        category: 'Imported',
        flashcards,
        isCustom: true,
        createdAt,
      } satisfies Deck, { source: 'import', trackDiagnostics: true });

      addDeck(deck);
      Alert.alert(
        'Deck Imported!',
        `"${deck.name}" with ${flashcards.length} cards has been added to your decks.`,
        [{ text: 'OK', onPress: () => router.back() }],
      );
    } catch (error) {
      logger.warn('[SmartImport] Import failed:', error);
      Alert.alert('Import Failed', 'Could not import these cards. Please review the content and try again.');
      setIsImporting(false);
      return;
    }

    setIsImporting(false);
  }, [addDeck, deckName, isImporting, jsonImportResult, parseResult, router]);

  const handleDeckNameChange = useCallback((text: string) => {
    setDeckNameEdited(true);
    setDeckName(text);
  }, []);

  const handleClear = useCallback(() => {
    setPastedText('');
    setParseResult(null);
    setJsonImportResult(null);
    setDeckName('Imported Deck');
    setDeckNameEdited(false);
  }, []);

  const handleOpenAiImport = useCallback(() => {
    Keyboard.dismiss();
    router.push(TEXT_TO_DECK_ROUTE);
  }, [router]);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <LinearGradient
        colors={isDark ? ['#08111f', '#0c1730', '#09111d'] : ['#eef2ff', '#f5f3ff', '#fff7ed']}
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.topGlow, { backgroundColor: isDark ? 'rgba(99,102,241,0.2)' : 'rgba(129,140,248,0.28)' }]} />
      <View style={[styles.bottomGlow, { backgroundColor: isDark ? 'rgba(16,185,129,0.14)' : 'rgba(45,212,191,0.18)' }]} />

      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <ResponsiveContainer fill style={styles.shell}>
          <View style={styles.header}>
            <TouchableOpacity
              style={[styles.headerButton, { backgroundColor: isDark ? 'rgba(148,163,184,0.12)' : 'rgba(255,255,255,0.7)' }]}
              onPress={handleBack}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Go back"
              testID="smartImportBackButton"
            >
              <ArrowLeft color={theme.text} size={20} strokeWidth={2.4} />
            </TouchableOpacity>

            <View style={styles.headerTextWrap}>
              <Text style={[styles.eyebrow, { color: theme.primary }]}>Universal paste import</Text>
              <Text style={[styles.title, { color: theme.text }]}>Smart Import</Text>
              <Text style={[styles.subtitle, { color: theme.textSecondary }]}>Paste from Quizlet, Anki, sheets, notes, or a FlashQuest share.</Text>
            </View>
          </View>

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={[styles.card, { backgroundColor: theme.cardBackground, borderColor: isDark ? 'rgba(148,163,184,0.12)' : 'rgba(255,255,255,0.8)' }]}> 
              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={[styles.primaryAction, { backgroundColor: theme.primary }]}
                  onPress={() => {
                    void handlePasteFromClipboard();
                  }}
                  activeOpacity={0.86}
                  testID="smartImportPasteButton"
                >
                  <ClipboardIcon color="#FFFFFF" size={18} strokeWidth={2.4} />
                  <Text style={styles.primaryActionText}>Paste from Clipboard</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.secondaryAction, { borderColor: theme.border, backgroundColor: isDark ? 'rgba(15,23,42,0.5)' : 'rgba(255,255,255,0.8)' }]}
                  onPress={handleClear}
                  activeOpacity={0.8}
                  testID="smartImportClearButton"
                >
                  <Text style={[styles.secondaryActionText, { color: theme.textSecondary }]}>Clear</Text>
                </TouchableOpacity>
              </View>

              <View style={[styles.inputWrap, { backgroundColor: isDark ? 'rgba(15,23,42,0.38)' : 'rgba(255,255,255,0.72)', borderColor: theme.border }]}>
                <TextInput
                  style={[styles.textArea, { color: theme.text }]}
                  value={pastedText}
                  onChangeText={setPastedText}
                  multiline
                  textAlignVertical="top"
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholder={"Paste your flashcards here.\n\nWorks with:\n- Quizlet export or copied terms\n- Anki plain text export\n- CSV or tab-separated text\n- term: definition lists\n- term - definition lists\n- FlashQuest share JSON"}
                  placeholderTextColor={theme.textTertiary}
                  testID="smartImportTextInput"
                />
              </View>

              {parseResult ? (
                <View style={[styles.badge, { backgroundColor: badgeColors.backgroundColor, borderColor: badgeColors.borderColor }]}>
                  <Text style={[styles.badgeText, { color: badgeColors.textColor }]}>
                    {jsonImportResult
                      ? `${parseResult.formatLabel} • ready to import`
                      : `${parseResult.formatLabel} • ${detectedCardCount} ${formatCardLabel(detectedCardCount)} found`}
                  </Text>
                </View>
              ) : null}

              {showNoPairsMessage ? (
                <View style={[styles.messageCard, { backgroundColor: isDark ? 'rgba(245,158,11,0.08)' : 'rgba(245,158,11,0.08)', borderColor: isDark ? 'rgba(245,158,11,0.18)' : 'rgba(245,158,11,0.18)' }]}>
                  <Text style={[styles.messageTitle, { color: theme.text }]}>Couldn&apos;t detect flashcard pairs</Text>
                  <Text style={[styles.messageBody, { color: theme.textSecondary }]}>Try tab-separated format with one card per line, or use AI Import to turn notes into cards.</Text>
                  <TouchableOpacity
                    style={[styles.inlineActionButton, { backgroundColor: isDark ? 'rgba(139,92,246,0.14)' : 'rgba(99,102,241,0.1)' }]}
                    onPress={handleOpenAiImport}
                    activeOpacity={0.8}
                    testID="smartImportOpenAiButton"
                  >
                    <Sparkles color={theme.primary} size={16} strokeWidth={2.3} />
                    <Text style={[styles.inlineActionText, { color: theme.primary }]}>Open AI Import</Text>
                  </TouchableOpacity>
                </View>
              ) : null}

              {showOneCardMessage ? (
                <View style={[styles.messageCard, { backgroundColor: isDark ? 'rgba(245,158,11,0.08)' : 'rgba(245,158,11,0.08)', borderColor: isDark ? 'rgba(245,158,11,0.18)' : 'rgba(245,158,11,0.18)' }]}>
                  <Text style={[styles.messageTitle, { color: theme.text }]}>Only 1 card found</Text>
                  <Text style={[styles.messageBody, { color: theme.textSecondary }]}>Add a little more content for a more useful deck, or import this one card now.</Text>
                </View>
              ) : null}
            </View>

            {parseResult && detectedCardCount > 0 ? (
              <View style={[styles.card, { backgroundColor: theme.cardBackground, borderColor: isDark ? 'rgba(148,163,184,0.12)' : 'rgba(255,255,255,0.8)' }]}>
                <View style={styles.sectionHeader}>
                  <View>
                    <Text style={[styles.sectionEyebrow, { color: theme.textTertiary }]}>Preview</Text>
                    <Text style={[styles.sectionTitle, { color: theme.text }]}>First {previewCards.length} {formatCardLabel(previewCards.length)}</Text>
                  </View>
                  <View style={[styles.sectionIcon, { backgroundColor: isDark ? 'rgba(59,130,246,0.16)' : 'rgba(59,130,246,0.1)' }]}>
                    <FileText color={isDark ? '#93c5fd' : '#2563eb'} size={18} strokeWidth={2.2} />
                  </View>
                </View>

                <View style={styles.previewList}>
                  {previewCards.map((card, index) => (
                    <View
                      key={`${card.question}-${card.answer}-${index}`}
                      style={[
                        styles.previewCard,
                        {
                          backgroundColor: index % 2 === 0
                            ? (isDark ? 'rgba(15,23,42,0.38)' : 'rgba(248,250,252,0.8)')
                            : (isDark ? 'rgba(30,41,59,0.62)' : 'rgba(241,245,249,0.88)'),
                          borderColor: isDark ? 'rgba(148,163,184,0.08)' : 'rgba(148,163,184,0.12)',
                        },
                      ]}
                    >
                      <View style={styles.previewHeader}>
                        <Text style={[styles.previewIndex, { color: theme.textTertiary }]}>Card {index + 1}</Text>
                      </View>
                      <Text style={[styles.previewQuestion, { color: theme.text }]} numberOfLines={3}>{card.question}</Text>
                      <Text style={[styles.previewAnswer, { color: theme.textSecondary }]} numberOfLines={4}>{card.answer}</Text>
                    </View>
                  ))}
                </View>

                {detectedCardCount > previewCards.length ? (
                  <Text style={[styles.moreText, { color: theme.textTertiary }]}>+ {detectedCardCount - previewCards.length} more {formatCardLabel(detectedCardCount - previewCards.length)}</Text>
                ) : null}

                {jsonImportResult ? (
                  <View style={[styles.messageCard, { backgroundColor: isDark ? 'rgba(99,102,241,0.08)' : 'rgba(99,102,241,0.08)', borderColor: isDark ? 'rgba(99,102,241,0.18)' : 'rgba(99,102,241,0.18)' }]}>
                    <Text style={[styles.messageTitle, { color: theme.text }]}>Shared FlashQuest deck detected</Text>
                    <Text style={[styles.messageBody, { color: theme.textSecondary }]}>This import keeps the original deck name and share metadata intact.</Text>
                  </View>
                ) : (
                  <>
                    <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Deck name</Text>
                    <TextInput
                      style={[styles.deckNameInput, { color: theme.text, backgroundColor: isDark ? 'rgba(15,23,42,0.38)' : 'rgba(255,255,255,0.8)', borderColor: theme.border }]}
                      value={deckName}
                      onChangeText={handleDeckNameChange}
                      placeholder="Imported Deck"
                      placeholderTextColor={theme.textTertiary}
                      maxLength={100}
                      testID="smartImportDeckNameInput"
                    />
                  </>
                )}

                <TouchableOpacity
                  style={[styles.importButton, { backgroundColor: canImport ? theme.primary : (isDark ? 'rgba(148,163,184,0.18)' : 'rgba(148,163,184,0.3)') }]}
                  onPress={handleImport}
                  disabled={!canImport || isImporting}
                  activeOpacity={0.86}
                  testID="smartImportConfirmButton"
                >
                  <Text style={styles.importButtonText}>
                    {jsonImportResult
                      ? 'Import Shared Deck'
                      : `Import ${detectedCardCount} ${formatCardLabel(detectedCardCount)}`}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : null}

            <View style={[styles.card, { backgroundColor: theme.cardBackground, borderColor: isDark ? 'rgba(148,163,184,0.12)' : 'rgba(255,255,255,0.8)' }]}>
              <TouchableOpacity
                style={styles.helpToggle}
                onPress={() => setShowQuizletHelp((current) => !current)}
                activeOpacity={0.8}
                testID="smartImportQuizletHelpToggle"
              >
                <Text style={[styles.sectionTitle, { color: theme.text }]}>How to get cards from Quizlet</Text>
                <Text style={[styles.helpToggleText, { color: theme.primary }]}>{showQuizletHelp ? 'Hide' : 'Show'}</Text>
              </TouchableOpacity>

              {showQuizletHelp ? (
                <View style={styles.helpList}>
                  {[
                    'Open your Quizlet set in a browser',
                    'Tap the three dots menu, then Export',
                    'Set “Between term and definition” to Tab',
                    'Set “Between rows” to New line',
                    'Tap Copy text',
                    'Come back here and tap Paste from Clipboard',
                  ].map((step, index) => (
                    <View key={step} style={styles.helpRow}>
                      <View style={[styles.helpStepBadge, { backgroundColor: isDark ? 'rgba(139,92,246,0.16)' : 'rgba(99,102,241,0.1)' }]}>
                        <Text style={[styles.helpStepText, { color: theme.primary }]}>{index + 1}</Text>
                      </View>
                      <Text style={[styles.helpBody, { color: theme.textSecondary }]}>{step}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          </ScrollView>
        </ResponsiveContainer>
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
  shell: {
    flex: 1,
  },
  topGlow: {
    position: 'absolute',
    top: -120,
    right: -90,
    width: 260,
    height: 260,
    borderRadius: 130,
  },
  bottomGlow: {
    position: 'absolute',
    bottom: 40,
    left: -80,
    width: 240,
    height: 240,
    borderRadius: 120,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 10,
    flexDirection: 'row',
    gap: 14,
    alignItems: 'flex-start',
  },
  headerButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTextWrap: {
    flex: 1,
    paddingTop: 2,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.8,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 6,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 32,
    gap: 16,
  },
  card: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 18,
    shadowColor: '#020617',
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 2,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  primaryAction: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  primaryActionText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  secondaryAction: {
    borderRadius: 16,
    paddingHorizontal: 16,
    justifyContent: 'center',
    borderWidth: 1,
  },
  secondaryActionText: {
    fontSize: 14,
    fontWeight: '700',
  },
  inputWrap: {
    borderRadius: 18,
    borderWidth: 1,
    minHeight: 220,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  textArea: {
    minHeight: 190,
    fontSize: 15,
    lineHeight: 22,
  },
  badge: {
    marginTop: 14,
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '800',
  },
  messageCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginTop: 14,
    gap: 8,
  },
  messageTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  messageBody: {
    fontSize: 13,
    lineHeight: 19,
  },
  inlineActionButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
  },
  inlineActionText: {
    fontSize: 13,
    fontWeight: '800',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionEyebrow: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  sectionIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewList: {
    gap: 10,
  },
  previewCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 8,
  },
  previewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  previewIndex: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  previewQuestion: {
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 20,
  },
  previewAnswer: {
    fontSize: 13,
    lineHeight: 19,
  },
  moreText: {
    marginTop: 12,
    fontSize: 12,
    fontWeight: '700',
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    marginTop: 14,
    marginBottom: 8,
  },
  deckNameInput: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
    fontWeight: '700',
  },
  importButton: {
    marginTop: 16,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  importButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },
  helpToggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  helpToggleText: {
    fontSize: 13,
    fontWeight: '800',
  },
  helpList: {
    marginTop: 14,
    gap: 12,
  },
  helpRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  helpStepBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  helpStepText: {
    fontSize: 12,
    fontWeight: '800',
  },
  helpBody: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
});
