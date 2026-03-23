import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import {
  ArrowLeft,
  BookOpen,
  ChevronRight,
  Download,
  Edit,
  FileText,
  PenLine,
  Plus,
  Sparkles,
  Trash2,
} from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as Clipboard from 'expo-clipboard';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ALL_DECK_CATEGORIES_LABEL } from '@/constants/deckCategories';
import { useArena } from '@/context/ArenaContext';
import { useFlashQuest } from '@/context/FlashQuestContext';
import { usePerformance } from '@/context/PerformanceContext';
import { useTheme } from '@/context/ThemeContext';
import type { Deck, Flashcard } from '@/types/flashcard';
import type { CardStats } from '@/types/performance';

function computeDeckMastery(flashcards: Flashcard[], cardStatsById: Record<string, CardStats>) {
  let mastered = 0;
  let reviewing = 0;
  let learning = 0;
  let newCards = 0;

  for (const card of flashcards) {
    const stats = cardStatsById[card.id];
    if (!stats || stats.attempts === 0) {
      newCards += 1;
      continue;
    }
    if (stats.streakCorrect >= 5) {
      mastered += 1;
      continue;
    }
    if (stats.streakCorrect >= 3) {
      reviewing += 1;
      continue;
    }
    learning += 1;
  }

  return { mastered, reviewing, learning, newCards, total: flashcards.length };
}

export default function DecksPage() {
  const router = useRouter();
  const { decks, deleteDeck, addDeck } = useFlashQuest();
  const { cleanupDeck } = useArena();
  const { performance } = usePerformance();
  const { theme, isDark } = useTheme();

  const [showMenu, setShowMenu] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeCategory, setActiveCategory] = useState<string>(ALL_DECK_CATEGORIES_LABEL);
  const deckListScrollRef = useRef<ScrollView | null>(null);

  const categories = useMemo(() => {
    const uniqueCategories = Array.from(new Set(decks.map((deck) => deck.category).filter(Boolean)));
    return [ALL_DECK_CATEGORIES_LABEL, ...uniqueCategories.sort()];
  }, [decks]);

  const categoryCounts = useMemo(() => {
    return categories.reduce<Record<string, number>>((accumulator, category) => {
      accumulator[category] = category === ALL_DECK_CATEGORIES_LABEL
        ? decks.length
        : decks.filter((deck) => deck.category === category).length;
      return accumulator;
    }, {});
  }, [categories, decks]);

  const filteredDecks = useMemo(() => {
    let result = decks;

    if (activeCategory !== ALL_DECK_CATEGORIES_LABEL) {
      result = result.filter((deck) => deck.category === activeCategory);
    }

    const normalizedQuery = searchQuery.trim().toLowerCase();
    if (normalizedQuery) {
      result = result.filter((deck) => deck.name.toLowerCase().includes(normalizedQuery));
    }

    return result;
  }, [decks, activeCategory, searchQuery]);

  const hasNoDecks = decks.length === 0;
  const hasNoSearchResults = decks.length > 0 && filteredDecks.length === 0;

  useEffect(() => {
    if (!categories.includes(activeCategory)) {
      setActiveCategory(ALL_DECK_CATEGORIES_LABEL);
    }
  }, [activeCategory, categories]);

  const handleCreateManual = useCallback(() => {
    setShowMenu(false);
    router.push('/create-flashcard' as any);
  }, [router]);

  const handleScanNotes = useCallback(() => {
    setShowMenu(false);
    router.push('/scan-notes' as any);
  }, [router]);

  const handleTextToDeck = useCallback(() => {
    setShowMenu(false);
    router.push('/text-to-deck' as any);
  }, [router]);

  const handleStudyDeck = useCallback((deckId: string) => {
    router.push({ pathname: '/study' as any, params: { deckId } });
  }, [router]);

  const handleOpenDeckHub = useCallback((deckId: string) => {
    router.push({ pathname: '/deck-hub' as any, params: { deckId } });
  }, [router]);

  const handleImportDeck = useCallback(async () => {
    try {
      const text = await Clipboard.getStringAsync();
      if (!text || !text.trim()) {
        Alert.alert('Nothing to Import', 'Copy a shared deck to your clipboard first, then tap Import.');
        return;
      }

      type ImportedFlashcard = {
        question?: unknown;
        answer?: unknown;
      };

      type ImportedDeckPayload = {
        _type?: unknown;
        name?: unknown;
        description?: unknown;
        color?: unknown;
        category?: unknown;
        flashcards?: ImportedFlashcard[];
      };

      let data: ImportedDeckPayload;
      try {
        data = JSON.parse(text) as ImportedDeckPayload;
      } catch {
        Alert.alert('Invalid Data', 'The clipboard does not contain a valid FlashQuest deck.');
        return;
      }

      if (data._type !== 'flashquest_deck' || typeof data.name !== 'string' || !Array.isArray(data.flashcards) || data.flashcards.length === 0) {
        Alert.alert('Invalid Deck', 'The clipboard does not contain a valid FlashQuest deck.');
        return;
      }

      const getStringValue = (value: unknown, fallback: string): string => {
        return typeof value === 'string' ? value : fallback;
      };

      const newDeckId = `deck_${Date.now()}`;
      const createdAt = Date.now();
      const flashcards: Flashcard[] = data.flashcards.map((card, index) => ({
        id: `import_${newDeckId}_${index}`,
        question: getStringValue(card.question, '').slice(0, 500),
        answer: getStringValue(card.answer, '').slice(0, 200),
        deckId: newDeckId,
        difficulty: 'medium' as const,
        createdAt,
      })).filter((card) => card.question.trim().length > 0 && card.answer.trim().length > 0);

      if (flashcards.length === 0) {
        Alert.alert('Invalid Deck', 'The clipboard deck has no valid cards to import.');
        return;
      }

      const importedName = data.name.slice(0, 100);
      const importedDescription = getStringValue(data.description, 'Imported deck').slice(0, 200);
      const importedCategory = getStringValue(data.category, 'Imported').slice(0, 30);

      addDeck({
        id: newDeckId,
        name: importedName,
        description: importedDescription,
        color: typeof data.color === 'string' ? data.color : '#667EEA',
        icon: 'download',
        category: importedCategory,
        flashcards,
        isCustom: true,
        createdAt,
      });

      Alert.alert('Deck Imported!', `"${importedName}" with ${flashcards.length} cards has been added to your decks.`);
    } catch {
      Alert.alert('Import Failed', 'Could not import the deck. Make sure you copied a valid FlashQuest deck.');
    }
  }, [addDeck]);

  const handleEditDeck = useCallback((deckId: string) => {
    router.push({ pathname: '/create-flashcard' as any, params: { deckId } });
  }, [router]);

  const handleDeleteDeck = useCallback(async (deckId: string) => {
    try {
      await deleteDeck(deckId);
      cleanupDeck(deckId);
    } catch {
      Alert.alert('Error', 'Failed to delete deck. Please try again.');
    }
  }, [cleanupDeck, deleteDeck]);

  const handleSelectCategory = useCallback((category: string) => {
    setActiveCategory(category);
    setSearchQuery('');
    requestAnimationFrame(() => {
      deckListScrollRef.current?.scrollTo({ y: 0, animated: false });
    });
  }, []);

  useEffect(() => {
    requestAnimationFrame(() => {
      deckListScrollRef.current?.scrollTo({ y: 0, animated: false });
    });
  }, [activeCategory, searchQuery]);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}> 
      <LinearGradient
        colors={[theme.gradientStart, theme.gradientMid, theme.gradientEnd]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {isDark ? (
        <LinearGradient
          colors={['rgba(6, 10, 22, 0.06)', 'rgba(6, 10, 22, 0.34)', 'rgba(5, 8, 20, 0.76)']}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.95, y: 1 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      ) : null}

      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft color="#fff" size={28} strokeWidth={2.5} />
          </TouchableOpacity>

          <Text style={styles.headerTitle}>My Decks</Text>

          <TouchableOpacity
            style={styles.addButton}
            onPress={() => setShowMenu(true)}
            testID="decksAddButton"
          >
            <Plus color="#fff" size={28} strokeWidth={2.5} />
          </TouchableOpacity>
        </View>

        <TextInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search decks..."
          placeholderTextColor={theme.textTertiary}
          style={[
            styles.searchInput,
            {
              backgroundColor: theme.cardBackground,
              color: theme.text,
              borderColor: isDark ? 'rgba(148, 163, 184, 0.18)' : theme.border,
            },
          ]}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          testID="decks-search-input"
        />

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.categoryScroll}
          contentContainerStyle={styles.categoryScrollContent}
        >
          {categories.map((category) => {
            const isActive = activeCategory === category;
            const count = categoryCounts[category] ?? 0;

            return (
              <TouchableOpacity
                key={category}
                onPress={() => handleSelectCategory(category)}
                activeOpacity={0.84}
                style={[
                  styles.categoryPill,
                  {
                    backgroundColor: isActive ? theme.primary : theme.cardBackground,
                    borderColor: isActive ? theme.primary : theme.border,
                  },
                ]}
                testID={`deck-category-pill-${category.replace(/\s+/g, '-').toLowerCase()}`}
              >
                <Text style={[styles.categoryPillText, { color: isActive ? '#fff' : theme.textSecondary }]}>
                  {category} ({count})
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <View style={styles.listSection}>
          <Text style={styles.deckCount}>
            {filteredDecks.length} {filteredDecks.length === 1 ? 'deck' : 'decks'} {activeCategory === ALL_DECK_CATEGORIES_LABEL ? 'total' : `in ${activeCategory}`}
          </Text>

          {hasNoDecks ? (
            <View style={styles.emptyStateContainer}>
              <View style={styles.emptyState}>
              <BookOpen color={theme.textTertiary} size={48} strokeWidth={2.2} />
              <Text style={[styles.emptyStateTitle, { color: theme.text }]}>No decks yet</Text>
              <Text style={[styles.emptyStateSubtitle, { color: theme.textSecondary }]}>Create your first deck to start studying.</Text>
              <TouchableOpacity
                style={[styles.emptyStateButton, { backgroundColor: theme.primary }]}
                onPress={() => setShowMenu(true)}
                activeOpacity={0.85}
                testID="decks-empty-create-button"
              >
                <Text style={styles.emptyStateButtonText}>Create Deck</Text>
              </TouchableOpacity>
              </View>
            </View>
          ) : hasNoSearchResults ? (
            <View style={styles.emptyStateContainer}>
              <View style={styles.emptyState}>
              <Text style={[styles.emptyStateTitle, { color: theme.text }]}>No decks match your search</Text>
              <Text style={[styles.emptyStateSubtitle, { color: theme.textSecondary }]}>Try a different search term.</Text>
              </View>
            </View>
          ) : (
            <ScrollView
              ref={deckListScrollRef}
              style={styles.scrollView}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              {filteredDecks.map((deck: Deck) => (
              <View
                key={deck.id}
                style={[
                  styles.deckCard,
                  {
                    backgroundColor: isDark ? 'rgba(10, 17, 34, 0.88)' : theme.cardBackground,
                    borderWidth: isDark ? 1 : 0,
                    borderColor: isDark ? 'rgba(148, 163, 184, 0.12)' : 'transparent',
                    shadowOpacity: isDark ? 0.24 : 0.1,
                    shadowRadius: isDark ? 16 : 12,
                    elevation: isDark ? 8 : 4,
                  },
                ]}
              >
                <View style={[styles.deckColorBar, { backgroundColor: deck.color }]} />

                <View style={styles.deckContent}>
                  <View style={styles.deckHeader}>
                    <TouchableOpacity
                      style={styles.deckInfo}
                      onPress={() => handleOpenDeckHub(deck.id)}
                      activeOpacity={0.72}
                      testID={`deck-hub-open-${deck.id}`}
                    >
                      <View style={styles.deckNameRow}>
                        <Text style={[styles.deckName, styles.deckNameInline, { color: theme.text }]} numberOfLines={1}>
                          {deck.name}
                        </Text>
                        <ChevronRight color={theme.textTertiary} size={14} strokeWidth={2.4} />
                      </View>
                      <Text style={[styles.deckDescription, { color: theme.textSecondary }]} numberOfLines={2}>
                        {deck.description}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.deleteButton,
                        {
                          backgroundColor: isDark ? 'rgba(15, 23, 42, 0.72)' : 'rgba(15, 23, 42, 0.04)',
                          borderColor: isDark ? 'rgba(148, 163, 184, 0.12)' : 'rgba(15, 23, 42, 0.06)',
                        },
                      ]}
                      onPress={() => {
                        Alert.alert(
                          'Delete Deck',
                          `Are you sure you want to delete "${deck.name}"? This cannot be undone.`,
                          [
                            { text: 'Cancel', style: 'cancel' },
                            { text: 'Delete', style: 'destructive', onPress: () => void handleDeleteDeck(deck.id) },
                          ]
                        );
                      }}
                      activeOpacity={0.8}
                      testID={`deck-delete-button-${deck.id}`}
                    >
                      <Trash2 color={theme.textSecondary} size={16} strokeWidth={2.3} />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.deckStats}>
                    <View style={styles.statBadge}>
                      <BookOpen color={theme.textSecondary} size={16} strokeWidth={2} />
                      <Text style={[styles.statText, { color: theme.textSecondary }]}>
                        {deck.flashcards.length} cards
                      </Text>
                    </View>
                    <View style={[styles.categoryBadge, { backgroundColor: isDark ? 'rgba(15, 23, 42, 0.82)' : theme.background }]}> 
                      <Text style={[styles.categoryText, { color: theme.text }]}>{deck.category}</Text>
                    </View>
                  </View>

                  {(() => {
                    const mastery = computeDeckMastery(deck.flashcards, performance.cardStatsById);
                    if (mastery.total === 0) {
                      return null;
                    }

                    const pMastered = (mastery.mastered / mastery.total) * 100;
                    const pReviewing = (mastery.reviewing / mastery.total) * 100;
                    const pLearning = (mastery.learning / mastery.total) * 100;

                    return (
                      <View style={styles.masterySection}>
                        <View style={styles.masteryHeaderRow}>
                          <Text style={[styles.masteryLabel, { color: theme.textSecondary }]}>
                            {mastery.mastered}/{mastery.total} mastered
                          </Text>
                          <Text style={[styles.masteryPercent, { color: theme.textTertiary }]}>
                            {Math.round(pMastered)}%
                          </Text>
                        </View>
                        <View style={[styles.masteryTrack, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }]}>
                          {pMastered > 0 ? <View style={[styles.masterySegment, { width: `${pMastered}%`, backgroundColor: '#10B981' }]} /> : null}
                          {pReviewing > 0 ? <View style={[styles.masterySegment, { width: `${pReviewing}%`, backgroundColor: '#3B82F6' }]} /> : null}
                          {pLearning > 0 ? <View style={[styles.masterySegment, { width: `${pLearning}%`, backgroundColor: '#F59E0B' }]} /> : null}
                        </View>
                      </View>
                    );
                  })()}

                  <View style={styles.deckActions}>
                    <TouchableOpacity
                      style={[styles.studyButton, { backgroundColor: theme.primary }]}
                      onPress={() => handleStudyDeck(deck.id)}
                      activeOpacity={0.8}
                    >
                      <BookOpen color="#fff" size={20} strokeWidth={2.5} />
                      <Text style={styles.studyButtonText}>Study</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.actionButton, { backgroundColor: isDark ? 'rgba(15, 23, 42, 0.82)' : theme.background }]}
                      onPress={() => handleEditDeck(deck.id)}
                      activeOpacity={0.8}
                    >
                      <Edit color={theme.text} size={20} strokeWidth={2.5} />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
              ))}
            </ScrollView>
          )}
        </View>
      </SafeAreaView>

      <Modal
        visible={showMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowMenu(false)}
      >
        <Pressable style={styles.menuOverlay} onPress={() => setShowMenu(false)}>
          <View
            style={[
              styles.menuSheet,
              {
                backgroundColor: isDark ? 'rgba(10, 17, 34, 0.98)' : theme.cardBackground,
                borderTopWidth: isDark ? 1 : 0,
                borderColor: isDark ? 'rgba(148, 163, 184, 0.12)' : 'transparent',
              },
            ]}
          >
            <View style={[styles.menuHandle, { backgroundColor: theme.sheetHandle }]} />
            <Text style={[styles.menuTitle, { color: theme.text }]}>Create New Deck</Text>

            <TouchableOpacity
              style={[styles.menuOption, { backgroundColor: isDark ? 'rgba(139,92,246,0.1)' : 'rgba(102,126,234,0.08)' }]}
              onPress={handleScanNotes}
              activeOpacity={0.8}
              testID="menuScanNotes"
            >
              <View style={[styles.menuIconWrap, { backgroundColor: isDark ? 'rgba(139,92,246,0.2)' : 'rgba(102,126,234,0.15)' }]}> 
                <Sparkles color={theme.primary} size={24} strokeWidth={2} />
              </View>
              <View style={styles.menuOptionText}>
                <Text style={[styles.menuOptionTitle, { color: theme.text }]}>Scan Notes with AI</Text>
                <Text style={[styles.menuOptionDesc, { color: theme.textSecondary }]}>Take a photo and let AI create flashcards</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.menuOption, { backgroundColor: isDark ? 'rgba(59,130,246,0.1)' : 'rgba(59,130,246,0.08)' }]}
              onPress={handleTextToDeck}
              activeOpacity={0.8}
              testID="menuTextToDeck"
            >
              <View style={[styles.menuIconWrap, { backgroundColor: isDark ? 'rgba(59,130,246,0.2)' : 'rgba(59,130,246,0.15)' }]}> 
                <FileText color={isDark ? '#60a5fa' : '#3b82f6'} size={24} strokeWidth={2} />
              </View>
              <View style={styles.menuOptionText}>
                <Text style={[styles.menuOptionTitle, { color: theme.text }]}>Text to Deck</Text>
                <Text style={[styles.menuOptionDesc, { color: theme.textSecondary }]}>Paste notes or text and AI creates flashcards</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.menuOption, { backgroundColor: isDark ? 'rgba(16,185,129,0.1)' : 'rgba(16,185,129,0.08)' }]}
              onPress={handleCreateManual}
              activeOpacity={0.8}
              testID="menuCreateManual"
            >
              <View style={[styles.menuIconWrap, { backgroundColor: isDark ? 'rgba(16,185,129,0.2)' : 'rgba(16,185,129,0.15)' }]}> 
                <PenLine color={theme.success} size={24} strokeWidth={2} />
              </View>
              <View style={styles.menuOptionText}>
                <Text style={[styles.menuOptionTitle, { color: theme.text }]}>Create Manually</Text>
                <Text style={[styles.menuOptionDesc, { color: theme.textSecondary }]}>Type your own questions and answers</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.menuOption, { backgroundColor: isDark ? 'rgba(14,165,233,0.1)' : 'rgba(14,165,233,0.08)' }]}
              onPress={() => {
                setShowMenu(false);
                void handleImportDeck();
              }}
              activeOpacity={0.8}
              testID="menuImportDeck"
            >
              <View style={[styles.menuIconWrap, { backgroundColor: isDark ? 'rgba(14,165,233,0.2)' : 'rgba(14,165,233,0.15)' }]}> 
                <Download color={isDark ? '#38bdf8' : '#0ea5e9'} size={24} strokeWidth={2} />
              </View>
              <View style={styles.menuOptionText}>
                <Text style={[styles.menuOptionTitle, { color: theme.text }]}>Import from Clipboard</Text>
                <Text style={[styles.menuOptionDesc, { color: theme.textSecondary }]}>Paste a deck shared by a friend</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.menuCancel, { backgroundColor: isDark ? 'rgba(148,163,184,0.1)' : 'rgba(0,0,0,0.04)' }]}
              onPress={() => setShowMenu(false)}
              activeOpacity={0.8}
            >
              <Text style={[styles.menuCancelText, { color: theme.textSecondary }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
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
    fontSize: 24,
    fontWeight: '800' as const,
    color: '#fff',
  },
  addButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchInput: {
    marginHorizontal: 20,
    marginBottom: 12,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 13,
    fontSize: 15,
    fontWeight: '600' as const,
  },
  categoryScroll: {
    marginBottom: 12,
    flexGrow: 0,
  },
  categoryScrollContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  categoryPill: {
    height: 34,
    paddingHorizontal: 14,
    borderRadius: 17,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryPillText: {
    fontSize: 13,
    fontWeight: '600' as const,
  },
  listSection: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  deckCount: {
    fontSize: 14,
    fontWeight: '600' as const,
    marginHorizontal: 20,
    marginBottom: 16,
    color: '#fff',
  },
  deckCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    marginBottom: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  deckColorBar: {
    height: 6,
    width: '100%',
  },
  deckContent: {
    padding: 20,
  },
  deckHeader: {
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  deckInfo: {
    flex: 1,
  },
  deckNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  deckName: {
    fontSize: 20,
    fontWeight: '800' as const,
    color: '#333',
    marginBottom: 6,
  },
  deckNameInline: {
    flex: 1,
    marginBottom: 0,
  },
  deckDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    fontWeight: '500' as const,
  },
  deckStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  statBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#666',
  },
  categoryBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: '#333',
  },
  masterySection: {
    marginTop: 10,
    marginBottom: 14,
  },
  masteryHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  masteryLabel: {
    fontSize: 11,
    fontWeight: '600' as const,
  },
  masteryPercent: {
    fontSize: 11,
  },
  masteryTrack: {
    height: 6,
    borderRadius: 3,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  masterySegment: {
    height: '100%',
  },
  deckActions: {
    flexDirection: 'row',
    gap: 12,
  },
  studyButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#667eea',
    borderRadius: 12,
    paddingVertical: 14,
    gap: 8,
  },
  studyButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#fff',
  },
  actionButton: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: '#f5f5f5',
  },
  deleteButton: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    opacity: 0.8,
  },
  emptyStateContainer: {
    flex: 1,
    paddingHorizontal: 20,
  },
  emptyState: {
    minHeight: 320,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  emptyStateTitle: {
    marginTop: 20,
    marginBottom: 10,
    fontSize: 18,
    fontWeight: '700' as const,
    textAlign: 'center' as const,
  },
  emptyStateSubtitle: {
    maxWidth: 280,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '500' as const,
    textAlign: 'center' as const,
  },
  emptyStateButton: {
    marginTop: 20,
    minWidth: 148,
    borderRadius: 14,
    paddingHorizontal: 22,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyStateButtonText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#fff',
  },
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  menuSheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingBottom: 40,
    paddingTop: 14,
    gap: 14,
  },
  menuHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(128,128,128,0.3)',
    alignSelf: 'center',
    marginBottom: 6,
  },
  menuTitle: {
    fontSize: 20,
    fontWeight: '800' as const,
    marginBottom: 4,
  },
  menuOption: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 18,
    padding: 16,
    gap: 16,
  },
  menuIconWrap: {
    width: 50,
    height: 50,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuOptionText: {
    flex: 1,
    gap: 3,
  },
  menuOptionTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
  },
  menuOptionDesc: {
    fontSize: 13,
    fontWeight: '500' as const,
    lineHeight: 18,
  },
  menuCancel: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  menuCancelText: {
    fontSize: 16,
    fontWeight: '600' as const,
  },
});
