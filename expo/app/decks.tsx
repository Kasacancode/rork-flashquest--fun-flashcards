import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import {
  ArrowLeft,
  BookOpen,
  Download,
  FileText,
  PenLine,
  Plus,
  Sparkles,
} from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import * as Clipboard from 'expo-clipboard';
import {
  Alert,
  FlatList,
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

import DeckCard from '@/components/decks/DeckCard';
import { ALL_DECK_CATEGORIES_LABEL } from '@/constants/deckCategories';
import { useArena } from '@/context/ArenaContext';
import { useFlashQuest } from '@/context/FlashQuestContext';
import { usePerformance } from '@/context/PerformanceContext';
import { useTheme } from '@/context/ThemeContext';
import { importDeckFromClipboardText } from '@/utils/deckImport';
import { getDeckListSummaries } from '@/utils/deckSelectors';
import {
  createFlashcardHref,
  deckHubHref,
  SCAN_NOTES_ROUTE,
  studyHref,
  TEXT_TO_DECK_ROUTE,
} from '@/utils/routes';

export default function DecksPage() {
  const router = useRouter();
  const { decks, deleteDeck, addDeck } = useFlashQuest();
  const { cleanupDeck } = useArena();
  const { performance, getCardsDueForReview } = usePerformance();
  const { theme, isDark } = useTheme();

  const [showMenu, setShowMenu] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeCategory, setActiveCategory] = useState<string>(ALL_DECK_CATEGORIES_LABEL);

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

  const filteredDeckSummaries = useMemo(() => {
    return getDeckListSummaries(filteredDecks, performance.cardStatsById, getCardsDueForReview);
  }, [filteredDecks, getCardsDueForReview, performance.cardStatsById]);

  const hasNoDecks = decks.length === 0;
  const hasNoSearchResults = decks.length > 0 && filteredDeckSummaries.length === 0;

  useEffect(() => {
    if (!categories.includes(activeCategory)) {
      setActiveCategory(ALL_DECK_CATEGORIES_LABEL);
    }
  }, [activeCategory, categories]);

  const handleCreateManual = useCallback(() => {
    setShowMenu(false);
    router.push(createFlashcardHref());
  }, [router]);

  const handleScanNotes = useCallback(() => {
    setShowMenu(false);
    router.push(SCAN_NOTES_ROUTE);
  }, [router]);

  const handleTextToDeck = useCallback(() => {
    setShowMenu(false);
    router.push(TEXT_TO_DECK_ROUTE);
  }, [router]);

  const handleStudyDeck = useCallback((deckId: string) => {
    router.push(studyHref(deckId));
  }, [router]);

  const handleOpenDeckHub = useCallback((deckId: string) => {
    router.push(deckHubHref(deckId));
  }, [router]);

  const handleImportDeck = useCallback(async () => {
    try {
      const text = await Clipboard.getStringAsync();
      if (!text || !text.trim()) {
        Alert.alert('Nothing to Import', 'Copy a shared deck to your clipboard first, then tap Import.');
        return;
      }

      const imported = importDeckFromClipboardText(text);
      if (!imported) {
        Alert.alert('Invalid Deck', 'The clipboard does not contain a valid FlashQuest deck.');
        return;
      }

      addDeck(imported.deck);
      Alert.alert('Deck Imported!', `"${imported.deck.name}" with ${imported.cardCount} cards has been added to your decks.`);
    } catch {
      Alert.alert('Import Failed', 'Could not import the deck. Make sure you copied a valid FlashQuest deck.');
    }
  }, [addDeck]);

  const handleEditDeck = useCallback((deckId: string) => {
    router.push(createFlashcardHref(deckId));
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
  }, []);

  const backgroundGradient = useMemo(
    () => (
      isDark
        ? ['#0b1427', '#13213c', '#091224'] as const
        : ['#e5ebff', '#e0e7ff', '#ece9ff', '#f4edf7'] as const
    ),
    [isDark],
  );
  const upperAtmosphereGradient = useMemo(
    () => (
      isDark
        ? ['rgba(8, 15, 29, 0.05)', 'rgba(53, 74, 130, 0.08)', 'rgba(14, 20, 36, 0)'] as const
        : ['rgba(98, 127, 246, 0.18)', 'rgba(123, 130, 236, 0.1)', 'rgba(255, 255, 255, 0)'] as const
    ),
    [isDark],
  );
  const lowerAtmosphereGradient = useMemo(
    () => (
      isDark
        ? ['rgba(16, 24, 39, 0)', 'rgba(86, 65, 176, 0.05)', 'rgba(20, 28, 46, 0.08)'] as const
        : ['rgba(255, 255, 255, 0)', 'rgba(202, 176, 237, 0.08)', 'rgba(226, 196, 235, 0.16)'] as const
    ),
    [isDark],
  );
  const shellOverlayGradient = useMemo(
    () => (
      isDark
        ? ['rgba(6, 10, 22, 0.04)', 'rgba(6, 10, 22, 0.28)', 'rgba(5, 8, 20, 0.74)'] as const
        : ['rgba(255, 255, 255, 0.16)', 'rgba(128, 139, 235, 0.05)', 'rgba(236, 232, 248, 0.14)'] as const
    ),
    [isDark],
  );
  const headerControlSurface = isDark ? 'rgba(10, 17, 34, 0.46)' : 'rgba(255, 255, 255, 0.74)';
  const headerControlBorder = isDark ? 'rgba(148, 163, 184, 0.16)' : 'rgba(126, 143, 212, 0.24)';
  const searchSurface = isDark ? 'rgba(9, 18, 35, 0.78)' : 'rgba(255, 255, 255, 0.94)';
  const quietSurface = isDark ? 'rgba(13, 21, 38, 0.8)' : 'rgba(248, 247, 255, 0.9)';
  const deckSurface = isDark ? 'rgba(8, 17, 32, 0.84)' : 'rgba(255, 255, 255, 0.94)';
  const surfaceBorderColor = isDark ? 'rgba(148, 163, 184, 0.12)' : 'rgba(126, 143, 212, 0.22)';
  const subtleBorderColor = isDark ? 'rgba(148, 163, 184, 0.1)' : 'rgba(129, 140, 248, 0.16)';
  const headerContentColor = isDark ? '#F8FAFC' : '#283460';
  const topGlowColor = isDark ? 'rgba(99, 102, 241, 0.14)' : 'rgba(105, 134, 255, 0.08)';
  const bottomGlowColor = isDark ? 'rgba(56, 189, 248, 0.1)' : 'rgba(224, 171, 231, 0.1)';

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}> 
      <LinearGradient
        colors={backgroundGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={upperAtmosphereGradient}
        start={{ x: 0.02, y: 0 }}
        end={{ x: 0.84, y: 0.4 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <LinearGradient
        colors={lowerAtmosphereGradient}
        start={{ x: 0.18, y: 0.48 }}
        end={{ x: 0.92, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <LinearGradient
        colors={shellOverlayGradient}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.95, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <View pointerEvents="none" style={[styles.topGlow, { backgroundColor: topGlowColor }]} />
      <View pointerEvents="none" style={[styles.bottomGlow, { backgroundColor: bottomGlowColor }]} />

      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={[
              styles.backButton,
              {
                backgroundColor: headerControlSurface,
                borderColor: headerControlBorder,
                shadowColor: isDark ? '#000' : '#8b5cf6',
                shadowOpacity: isDark ? 0.22 : 0.1,
                shadowRadius: isDark ? 14 : 12,
                elevation: isDark ? 6 : 4,
              },
            ]}
            activeOpacity={0.78}
          >
            <ArrowLeft color={headerContentColor} size={24} strokeWidth={2.5} />
          </TouchableOpacity>

          <View style={[styles.headerTitleWrap, { backgroundColor: isDark ? 'rgba(10, 17, 34, 0.42)' : 'rgba(255, 255, 255, 0.62)', borderColor: headerControlBorder }]}> 
            <BookOpen color={headerContentColor} size={21} strokeWidth={2.35} />
            <Text style={[styles.headerTitle, { color: headerContentColor }]}>Decks</Text>
          </View>

          <TouchableOpacity
            style={[
              styles.addButton,
              {
                backgroundColor: headerControlSurface,
                borderColor: headerControlBorder,
                shadowColor: isDark ? '#000' : '#8b5cf6',
                shadowOpacity: isDark ? 0.22 : 0.1,
                shadowRadius: isDark ? 14 : 12,
                elevation: isDark ? 6 : 4,
              },
            ]}
            onPress={() => setShowMenu(true)}
            testID="decksAddButton"
            activeOpacity={0.78}
          >
            <Plus color={headerContentColor} size={24} strokeWidth={2.5} />
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
              backgroundColor: searchSurface,
              color: theme.text,
              borderColor: surfaceBorderColor,
              shadowColor: isDark ? '#000' : '#93a0ee',
              shadowOpacity: isDark ? 0.06 : 0.08,
              shadowRadius: isDark ? 14 : 18,
              elevation: isDark ? 2 : 5,
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
                    backgroundColor: isActive ? theme.primary : quietSurface,
                    borderColor: isActive ? theme.primary : subtleBorderColor,
                    shadowColor: isDark ? '#000' : '#98a4ec',
                    shadowOpacity: isDark ? 0 : isActive ? 0.12 : 0.04,
                    shadowRadius: isDark ? 0 : isActive ? 12 : 8,
                    shadowOffset: { width: 0, height: isActive ? 6 : 4 },
                    elevation: isDark ? 0 : isActive ? 3 : 1,
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
          <Text style={[styles.deckCount, { color: theme.textSecondary }]}> 
            {filteredDeckSummaries.length} {filteredDeckSummaries.length === 1 ? 'deck' : 'decks'} {activeCategory === ALL_DECK_CATEGORIES_LABEL ? 'total' : `in ${activeCategory}`}
          </Text>

          {hasNoDecks ? (
            <View style={styles.emptyStateContainer}>
              <View style={[styles.emptyState, { backgroundColor: deckSurface, borderColor: surfaceBorderColor, borderWidth: 1 }]}> 
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
              <View style={[styles.emptyState, { backgroundColor: deckSurface, borderColor: surfaceBorderColor, borderWidth: 1 }]}> 
              <Text style={[styles.emptyStateTitle, { color: theme.text }]}>No decks match your search</Text>
              <Text style={[styles.emptyStateSubtitle, { color: theme.textSecondary }]}>Try a different search term.</Text>
              </View>
            </View>
          ) : (
            <FlatList
              data={filteredDeckSummaries}
              keyExtractor={(item) => item.deck.id}
              renderItem={({ item }) => (
                <DeckCard
                  summary={item}
                  theme={theme}
                  isDark={isDark}
                  deckSurface={deckSurface}
                  quietSurface={quietSurface}
                  subtleBorderColor={subtleBorderColor}
                  surfaceBorderColor={surfaceBorderColor}
                  onOpenDeckHub={handleOpenDeckHub}
                  onStudyDeck={handleStudyDeck}
                  onEditDeck={handleEditDeck}
                  onDeleteDeck={handleDeleteDeck}
                />
              )}
              style={styles.scrollView}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              testID="decks-flat-list"
              removeClippedSubviews
              initialNumToRender={6}
              maxToRenderPerBatch={8}
              windowSize={7}
              ItemSeparatorComponent={() => <View style={styles.listSeparator} />}
            />
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
  topGlow: {
    position: 'absolute',
    top: -148,
    right: -118,
    width: 360,
    height: 360,
    borderRadius: 180,
  },
  bottomGlow: {
    position: 'absolute',
    bottom: 64,
    left: -124,
    width: 380,
    height: 380,
    borderRadius: 190,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
  },
  headerTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 18,
    borderWidth: 1,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800' as const,
    color: '#fff',
    letterSpacing: -0.5,
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
  },
  searchInput: {
    marginHorizontal: 20,
    marginBottom: 12,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 15,
    fontSize: 15,
    fontWeight: '600' as const,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 2,
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
  listSeparator: {
    height: 16,
  },
  deckCount: {
    fontSize: 13,
    fontWeight: '700' as const,
    marginHorizontal: 20,
    marginBottom: 14,
    letterSpacing: 0.2,
  },
  deckCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    marginBottom: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 4,
  },
  deckColorBar: {
    height: 5,
    width: '100%',
  },
  deckAura: {
    position: 'absolute',
    top: -36,
    right: -22,
    width: 120,
    height: 120,
    borderRadius: 60,
    opacity: 0.08,
  },
  deckContent: {
    padding: 20,
    gap: 2,
  },
  deckHeader: {
    marginBottom: 14,
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
    maxWidth: '96%',
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
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
  },
  statText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#666',
  },
  categoryBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
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
  deckStatusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
    marginBottom: 14,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700' as const,
  },
  deckActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 2,
  },
  studyButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#667eea',
    borderRadius: 18,
    paddingVertical: 15,
    gap: 8,
    shadowOffset: { width: 0, height: 10 },
  },
  studyButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#fff',
  },
  actionButton: {
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1,
    backgroundColor: '#f5f5f5',
  },
  deleteButton: {
    width: 38,
    height: 38,
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    opacity: 0.84,
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
    borderRadius: 24,
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
