import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Check, Pencil, Plus, Search, Trash2, X } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import CategoryManagerSheet from '@/components/CategoryManagerSheet';
import DeckCategoryPicker from '@/components/DeckCategoryPicker';
import {
  buildDeckCategoryOptions,
  getCustomCategoryDraft,
  MANUAL_DEFAULT_DECK_CATEGORY,
  normalizeDeckCategory,
  sanitizeDeckCategory,
} from '@/constants/deckCategories';
import { useFlashQuest } from '@/context/FlashQuestContext';
import { useTheme } from '@/context/ThemeContext';
import type { Flashcard } from '@/types/flashcard';
import { createFlashcardHref, editFlashcardHref } from '@/utils/routes';

const DECK_COLORS = [
  '#8b5cf6', '#6366f1', '#3b82f6', '#06b6d4', '#10b981', '#84cc16',
  '#eab308', '#f97316', '#ef4444', '#ec4899', '#a855f7', '#64748b',
] as const;

export default function EditDeckScreen() {
  const router = useRouter();
  const { deckId } = useLocalSearchParams<{ deckId: string }>();
  const { decks, updateDeck, deleteFlashcard, deleteDeck, deckCategories } = useFlashQuest();
  const { theme, isDark } = useTheme();
  const deck = useMemo(() => decks.find((item) => item.id === deckId), [decks, deckId]);
  const [nameInput, setNameInput] = useState<string>(deck?.name ?? '');
  const [descriptionInput, setDescriptionInput] = useState<string>(deck?.description ?? '');
  const [selectedColor, setSelectedColor] = useState<string>(deck?.color ?? DECK_COLORS[0]);
  const [selectedCategory, setSelectedCategory] = useState<string>(normalizeDeckCategory(deck?.category, MANUAL_DEFAULT_DECK_CATEGORY));
  const [showCustomCategory, setShowCustomCategory] = useState<boolean>(false);
  const [customCategoryInput, setCustomCategoryInput] = useState<string>('');
  const [showCategoryManager, setShowCategoryManager] = useState<boolean>(false);
  const [isEditingMeta, setIsEditingMeta] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showSearch, setShowSearch] = useState<boolean>(false);

  const backgroundGradient: [string, string, string] = isDark
    ? ['#08111f', '#0c1730', '#09111d']
    : ['#E0E7FF', '#EDE9FE', '#E0E7FF'];
  const surfaceBg = isDark ? 'rgba(30, 41, 59, 0.72)' : 'rgba(255, 255, 255, 0.88)';
  const inputBg = isDark ? 'rgba(15, 23, 42, 0.5)' : 'rgba(255,255,255,0.6)';

  const syncCategoryState = useCallback((category?: string) => {
    const normalizedCategory = normalizeDeckCategory(category, MANUAL_DEFAULT_DECK_CATEGORY);
    setSelectedCategory(normalizedCategory);
    setCustomCategoryInput(getCustomCategoryDraft(normalizedCategory));
    setShowCustomCategory(false);
  }, []);

  useEffect(() => {
    if (!deck || isEditingMeta) {
      return;
    }

    setNameInput(deck.name);
    setDescriptionInput(deck.description);
    setSelectedColor(deck.color);
    syncCategoryState(deck.category);
  }, [deck, isEditingMeta, syncCategoryState]);

  const categoryOptions = useMemo(
    () => buildDeckCategoryOptions(selectedCategory, deckCategories),
    [deckCategories, selectedCategory],
  );

  const filteredCards = useMemo(() => {
    if (!deck) {
      return [] as Flashcard[];
    }

    const normalizedQuery = searchQuery.trim().toLowerCase();
    if (!normalizedQuery) {
      return deck.flashcards;
    }

    return deck.flashcards.filter((card) => {
      return card.question.toLowerCase().includes(normalizedQuery)
        || card.answer.toLowerCase().includes(normalizedQuery);
    });
  }, [deck, searchQuery]);

  const handleSelectCategory = useCallback((category: string) => {
    setSelectedCategory(normalizeDeckCategory(category, MANUAL_DEFAULT_DECK_CATEGORY));
    setShowCustomCategory(false);
    setCustomCategoryInput('');
  }, []);

  const handlePressCustomCategory = useCallback(() => {
    setCustomCategoryInput(getCustomCategoryDraft(selectedCategory));
    setShowCustomCategory(true);
  }, [selectedCategory]);

  const handleSubmitCustomCategory = useCallback(() => {
    const normalizedCustomCategory = sanitizeDeckCategory(customCategoryInput);
    if (normalizedCustomCategory) {
      setSelectedCategory(normalizedCustomCategory);
      setCustomCategoryInput(getCustomCategoryDraft(normalizedCustomCategory));
    }
    setShowCustomCategory(false);
  }, [customCategoryInput]);

  const handleSaveMeta = useCallback(() => {
    if (!deckId || !nameInput.trim()) {
      return;
    }

    const resolvedCategory = normalizeDeckCategory(selectedCategory, MANUAL_DEFAULT_DECK_CATEGORY);

    updateDeck(deckId, {
      name: nameInput.trim(),
      description: descriptionInput.trim(),
      color: selectedColor,
      category: resolvedCategory,
    });
    setIsEditingMeta(false);
  }, [deckId, descriptionInput, nameInput, selectedCategory, selectedColor, updateDeck]);

  const handleDeleteCard = useCallback((card: Flashcard) => {
    if (!deckId) {
      return;
    }

    Alert.alert(
      'Delete Card',
      `Delete "${card.question.slice(0, 60)}${card.question.length > 60 ? '…' : ''}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteFlashcard(deckId, card.id),
        },
      ],
    );
  }, [deckId, deleteFlashcard]);

  const handleDeleteDeck = useCallback(() => {
    if (!deckId) {
      return;
    }

    Alert.alert(
      'Delete Deck',
      'This will permanently delete this deck and all of its cards. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Deck',
          style: 'destructive',
          onPress: async () => {
            await deleteDeck(deckId);
            router.back();
          },
        },
      ],
    );
  }, [deckId, deleteDeck, router]);

  if (!deck) {
    return (
      <LinearGradient colors={backgroundGradient} style={styles.root}>
        <SafeAreaView style={styles.safe} edges={['top']}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton} testID="edit-deck-back-button">
              <ArrowLeft color={theme.text} size={22} strokeWidth={2.2} />
            </TouchableOpacity>
            <Text style={[styles.headerTitle, { color: theme.text }]}>Deck Not Found</Text>
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
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton} testID="edit-deck-back-button">
            <ArrowLeft color={theme.text} size={22} strokeWidth={2.2} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.text }]} numberOfLines={1}>Edit Deck</Text>
          <View style={styles.headerSpacer} />
        </View>

        <FlatList
          data={filteredCards}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          testID="edit-deck-screen"
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.cardItem, { backgroundColor: surfaceBg }]}
              activeOpacity={0.7}
              onPress={() => router.push(editFlashcardHref(deck.id, item.id))}
              testID={`edit-deck-card-${item.id}`}
            >
              <View style={styles.cardContent}>
                <Text style={[styles.cardQuestion, { color: theme.text }]} numberOfLines={2}>{item.question}</Text>
                <Text style={[styles.cardAnswer, { color: theme.textSecondary }]} numberOfLines={1}>{item.answer}</Text>
              </View>
              <TouchableOpacity
                onPress={() => handleDeleteCard(item)}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                style={styles.cardDeleteButton}
                testID={`edit-deck-delete-card-${item.id}`}
              >
                <Trash2 color={theme.error} size={16} />
              </TouchableOpacity>
            </TouchableOpacity>
          )}
          ListHeaderComponent={
            <>
              <View style={[styles.metaCard, { backgroundColor: surfaceBg }]}> 
                {isEditingMeta ? (
                  <>
                    <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Deck Name</Text>
                    <TextInput
                      style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: inputBg }]}
                      value={nameInput}
                      onChangeText={setNameInput}
                      placeholder="Deck name"
                      placeholderTextColor={theme.textTertiary}
                      maxLength={80}
                      testID="edit-deck-name-input"
                    />
                    <Text style={[styles.fieldLabel, { color: theme.textSecondary, marginTop: 12 }]}>Description</Text>
                    <TextInput
                      style={[styles.input, styles.multilineInput, { color: theme.text, borderColor: theme.border, backgroundColor: inputBg }]}
                      value={descriptionInput}
                      onChangeText={setDescriptionInput}
                      placeholder="Short description"
                      placeholderTextColor={theme.textTertiary}
                      multiline
                      maxLength={200}
                      testID="edit-deck-description-input"
                    />
                    <View style={styles.categorySection}>
                      <DeckCategoryPicker
                        labelColor={theme.textSecondary}
                        categories={categoryOptions}
                        selectedCategory={selectedCategory}
                        showCustomCategory={showCustomCategory}
                        customCategoryInput={customCategoryInput}
                        onSelectCategory={handleSelectCategory}
                        onPressCustom={handlePressCustomCategory}
                        onChangeCustomCategoryInput={setCustomCategoryInput}
                        onSubmitCustomCategory={handleSubmitCustomCategory}
                        onPressManageCategories={() => setShowCategoryManager(true)}
                        theme={theme}
                        isDark={isDark}
                        testIDPrefix="edit-deck-category"
                      />
                    </View>
                    <Text style={[styles.fieldLabel, { color: theme.textSecondary, marginTop: 12 }]}>Color</Text>
                    <View style={styles.colorRow}>
                      {DECK_COLORS.map((color) => (
                        <TouchableOpacity
                          key={color}
                          onPress={() => setSelectedColor(color)}
                          style={[
                            styles.colorSwatch,
                            { backgroundColor: color },
                            selectedColor === color ? styles.colorSwatchSelected : null,
                          ]}
                          testID={`edit-deck-color-${color.replace('#', '')}`}
                        >
                          {selectedColor === color ? <Check color="#fff" size={14} strokeWidth={3} /> : null}
                        </TouchableOpacity>
                      ))}
                    </View>
                    <View style={styles.metaActions}>
                      <TouchableOpacity
                        onPress={() => {
                          setNameInput(deck.name);
                          setDescriptionInput(deck.description);
                          setSelectedColor(deck.color);
                          syncCategoryState(deck.category);
                          setIsEditingMeta(false);
                        }}
                        style={[styles.metaButton, { borderColor: theme.border }]}
                        testID="edit-deck-cancel-button"
                      >
                        <X color={theme.textSecondary} size={16} />
                        <Text style={[styles.metaButtonText, { color: theme.textSecondary }]}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={handleSaveMeta}
                        style={[styles.metaButton, styles.primaryMetaButton, { backgroundColor: theme.primary }]}
                        testID="edit-deck-save-button"
                      >
                        <Check color="#fff" size={16} />
                        <Text style={[styles.metaButtonText, { color: '#fff' }]}>Save</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                ) : (
                  <TouchableOpacity onPress={() => setIsEditingMeta(true)} style={styles.metaDisplay} activeOpacity={0.78} testID="edit-deck-open-meta-editor">
                    <View style={[styles.deckColorDot, { backgroundColor: deck.color }]} />
                    <View style={styles.metaText}>
                      <Text style={[styles.deckName, { color: theme.text }]}>{deck.name}</Text>
                      {deck.description ? (
                        <Text style={[styles.deckDescription, { color: theme.textSecondary }]} numberOfLines={2}>{deck.description}</Text>
                      ) : null}
                      <Text style={[styles.deckMeta, { color: theme.textTertiary }]}> 
                        {deck.flashcards.length} card{deck.flashcards.length === 1 ? '' : 's'} · {deck.category}
                      </Text>
                    </View>
                    <Pencil color={theme.textTertiary} size={18} />
                  </TouchableOpacity>
                )}
              </View>

              <View style={styles.actionsBar}>
                <TouchableOpacity
                  style={[styles.actionButton, { backgroundColor: theme.primary }]}
                  onPress={() => router.push(createFlashcardHref(deck.id))}
                  testID="edit-deck-add-card-button"
                >
                  <Plus color="#fff" size={16} />
                  <Text style={styles.actionButtonText}>Add Card</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionButton, { backgroundColor: surfaceBg }]}
                  onPress={() => setShowSearch((current) => !current)}
                  testID="edit-deck-toggle-search-button"
                >
                  <Search color={theme.text} size={16} />
                  <Text style={[styles.secondaryActionText, { color: theme.text }]}>Search</Text>
                </TouchableOpacity>
                {deck.isCustom ? (
                  <TouchableOpacity
                    style={[styles.actionButton, { backgroundColor: 'rgba(239, 68, 68, 0.12)' }]}
                    onPress={handleDeleteDeck}
                    testID="edit-deck-delete-deck-button"
                  >
                    <Trash2 color={theme.error} size={16} />
                  </TouchableOpacity>
                ) : null}
              </View>

              {showSearch ? (
                <View style={[styles.searchBar, { backgroundColor: surfaceBg, borderColor: theme.border }]}> 
                  <Search color={theme.textTertiary} size={16} />
                  <TextInput
                    style={[styles.searchInput, { color: theme.text }]}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    placeholder="Search cards…"
                    placeholderTextColor={theme.textTertiary}
                    autoFocus
                    testID="edit-deck-search-input"
                  />
                  {searchQuery.length > 0 ? (
                    <TouchableOpacity onPress={() => setSearchQuery('')} testID="edit-deck-clear-search-button">
                      <X color={theme.textTertiary} size={16} />
                    </TouchableOpacity>
                  ) : null}
                </View>
              ) : null}

              <Text style={[styles.cardsHeader, { color: theme.textSecondary }]}> 
                {searchQuery
                  ? `${filteredCards.length} result${filteredCards.length === 1 ? '' : 's'}`
                  : `${deck.flashcards.length} card${deck.flashcards.length === 1 ? '' : 's'}`}
              </Text>
            </>
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={[styles.emptyText, { color: theme.textTertiary }]}> 
                {searchQuery ? 'No cards match your search.' : 'This deck has no cards yet.'}
              </Text>
            </View>
          }
          ListFooterComponent={<View style={styles.footerSpacer} />}
        />
      </SafeAreaView>
      <CategoryManagerSheet
        visible={showCategoryManager}
        onClose={() => setShowCategoryManager(false)}
        selectedCategory={selectedCategory}
        onSelectCategory={handleSelectCategory}
        title="Manage Deck Categories"
        testID="edit-deck-category-manager"
      />
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
  listContent: {
    paddingHorizontal: 20,
  },
  metaCard: {
    borderRadius: 16,
    padding: 16,
    marginTop: 4,
  },
  metaDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  deckColorDot: {
    width: 36,
    height: 36,
    borderRadius: 10,
  },
  metaText: {
    flex: 1,
    marginLeft: 14,
  },
  deckName: {
    fontSize: 17,
    fontWeight: '700' as const,
  },
  deckDescription: {
    fontSize: 13,
    marginTop: 2,
  },
  deckMeta: {
    fontSize: 12,
    marginTop: 4,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600' as const,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
  },
  multilineInput: {
    minHeight: 60,
    textAlignVertical: 'top',
  },
  categorySection: {
    marginTop: 12,
  },
  colorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 4,
  },
  colorSwatch: {
    width: 32,
    height: 32,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorSwatchSelected: {
    borderWidth: 2,
    borderColor: '#fff',
  },
  metaActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 16,
  },
  metaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  primaryMetaButton: {
    borderWidth: 0,
  },
  metaButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
  },
  actionsBar: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
    marginBottom: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700' as const,
  },
  secondaryActionText: {
    fontSize: 14,
    fontWeight: '600' as const,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
  },
  cardsHeader: {
    fontSize: 13,
    fontWeight: '600' as const,
    marginBottom: 10,
    marginLeft: 2,
  },
  cardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 10,
  },
  cardContent: {
    flex: 1,
  },
  cardQuestion: {
    fontSize: 15,
    fontWeight: '600' as const,
    lineHeight: 21,
  },
  cardAnswer: {
    fontSize: 13,
    marginTop: 4,
  },
  cardDeleteButton: {
    marginLeft: 12,
    padding: 4,
  },
  emptyState: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
  },
  footerSpacer: {
    height: 40,
  },
});
