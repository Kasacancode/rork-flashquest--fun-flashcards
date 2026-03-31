import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ArrowLeft,
  Check,
  Palette,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react-native';
import React, { useCallback, useMemo, useState } from 'react';
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

import { useFlashQuest } from '@/context/FlashQuestContext';
import { useTheme } from '@/context/ThemeContext';
import type { Flashcard } from '@/types/flashcard';
import { createFlashcardHref, editFlashcardHref } from '@/utils/routes';

const DECK_COLORS = [
  '#8b5cf6', '#6366f1', '#3b82f6', '#06b6d4', '#10b981',
  '#84cc16', '#eab308', '#f97316', '#ef4444', '#ec4899',
  '#a855f7', '#64748b',
];

export default function EditDeckScreen() {
  const router = useRouter();
  const { deckId } = useLocalSearchParams<{ deckId: string }>();
  const { decks, updateDeck, deleteFlashcard, deleteDeck } = useFlashQuest();
  const { theme, isDark } = useTheme();

  const deck = useMemo(() => decks.find((d) => d.id === deckId), [decks, deckId]);

  const [nameInput, setNameInput] = useState(deck?.name ?? '');
  const [descInput, setDescInput] = useState(deck?.description ?? '');
  const [selectedColor, setSelectedColor] = useState(deck?.color ?? DECK_COLORS[0]);
  const [isEditingMeta, setIsEditingMeta] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);

  const backgroundGradient = useMemo(
    () =>
      isDark
        ? (['#08111f', '#0c1730', '#09111d'] as const)
        : (['#E0E7FF', '#EDE9FE', '#E0E7FF'] as const),
    [isDark],
  );

  const surfaceBg = isDark ? 'rgba(30, 41, 59, 0.7)' : 'rgba(255, 255, 255, 0.85)';

  const filteredCards = useMemo(() => {
    if (!deck) return [];
    if (!searchQuery.trim()) return deck.flashcards;
    const q = searchQuery.toLowerCase();
    return deck.flashcards.filter(
      (c) =>
        c.question.toLowerCase().includes(q) ||
        c.answer.toLowerCase().includes(q),
    );
  }, [deck, searchQuery]);

  const handleSaveMeta = useCallback(() => {
    if (!deckId || !nameInput.trim()) return;
    updateDeck(deckId, {
      name: nameInput.trim(),
      description: descInput.trim(),
      color: selectedColor,
    });
    setIsEditingMeta(false);
  }, [deckId, nameInput, descInput, selectedColor, updateDeck]);

  const handleDeleteCard = useCallback(
    (card: Flashcard) => {
      if (!deckId) return;
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
    },
    [deckId, deleteFlashcard],
  );

  const handleDeleteDeck = useCallback(() => {
    if (!deckId) return;
    Alert.alert(
      'Delete Deck',
      'This will permanently delete this deck and all its flashcards. This cannot be undone.',
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
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <ArrowLeft color={theme.text} size={22} />
            </TouchableOpacity>
            <Text style={[styles.headerTitle, { color: theme.text }]}>Deck Not Found</Text>
            <View style={styles.headerSpacer} />
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  const renderCard = ({ item }: { item: Flashcard }) => (
    <TouchableOpacity
      style={[styles.cardItem, { backgroundColor: surfaceBg }]}
      activeOpacity={0.7}
      onPress={() => router.push(editFlashcardHref(deck.id, item.id))}
    >
      <View style={styles.cardContent}>
        <Text style={[styles.cardQuestion, { color: theme.text }]} numberOfLines={2}>
          {item.question}
        </Text>
        <Text style={[styles.cardAnswer, { color: theme.textSecondary }]} numberOfLines={1}>
          {item.answer}
        </Text>
      </View>
      <TouchableOpacity
        onPress={() => handleDeleteCard(item)}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        style={styles.cardDeleteBtn}
      >
        <Trash2 color={theme.error} size={16} />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  return (
    <LinearGradient colors={backgroundGradient} style={styles.root}>
      <SafeAreaView style={styles.safe} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <ArrowLeft color={theme.text} size={22} strokeWidth={2.2} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.text }]} numberOfLines={1}>
            Edit Deck
          </Text>
          <View style={styles.headerSpacer} />
        </View>

        <FlatList
          data={filteredCards}
          keyExtractor={(item) => item.id}
          renderItem={renderCard}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <>
              {/* Deck Meta Section */}
              <View style={[styles.metaCard, { backgroundColor: surfaceBg }]}>
                {isEditingMeta ? (
                  <>
                    <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Deck Name</Text>
                    <TextInput
                      style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: isDark ? 'rgba(15, 23, 42, 0.5)' : 'rgba(255,255,255,0.6)' }]}
                      value={nameInput}
                      onChangeText={setNameInput}
                      placeholder="Deck name"
                      placeholderTextColor={theme.textTertiary}
                      maxLength={80}
                    />

                    <Text style={[styles.fieldLabel, { color: theme.textSecondary, marginTop: 12 }]}>Description</Text>
                    <TextInput
                      style={[styles.input, styles.inputMultiline, { color: theme.text, borderColor: theme.border, backgroundColor: isDark ? 'rgba(15, 23, 42, 0.5)' : 'rgba(255,255,255,0.6)' }]}
                      value={descInput}
                      onChangeText={setDescInput}
                      placeholder="Short description"
                      placeholderTextColor={theme.textTertiary}
                      multiline
                      maxLength={200}
                    />

                    <Text style={[styles.fieldLabel, { color: theme.textSecondary, marginTop: 12 }]}>Color</Text>
                    <View style={styles.colorRow}>
                      {DECK_COLORS.map((color) => (
                        <TouchableOpacity
                          key={color}
                          onPress={() => setSelectedColor(color)}
                          style={[
                            styles.colorSwatch,
                            { backgroundColor: color },
                            selectedColor === color && styles.colorSwatchSelected,
                          ]}
                        >
                          {selectedColor === color && <Check color="#fff" size={14} strokeWidth={3} />}
                        </TouchableOpacity>
                      ))}
                    </View>

                    <View style={styles.metaActions}>
                      <TouchableOpacity
                        onPress={() => {
                          setNameInput(deck.name);
                          setDescInput(deck.description);
                          setSelectedColor(deck.color);
                          setIsEditingMeta(false);
                        }}
                        style={[styles.metaBtn, { borderColor: theme.border }]}
                      >
                        <X color={theme.textSecondary} size={16} />
                        <Text style={[styles.metaBtnText, { color: theme.textSecondary }]}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={handleSaveMeta}
                        style={[styles.metaBtn, styles.metaBtnPrimary, { backgroundColor: theme.primary }]}
                      >
                        <Check color="#fff" size={16} />
                        <Text style={[styles.metaBtnText, { color: '#fff' }]}>Save</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                ) : (
                  <TouchableOpacity onPress={() => setIsEditingMeta(true)} style={styles.metaDisplay}>
                    <View style={[styles.deckColorDot, { backgroundColor: deck.color }]} />
                    <View style={styles.metaText}>
                      <Text style={[styles.deckName, { color: theme.text }]}>{deck.name}</Text>
                      {deck.description ? (
                        <Text style={[styles.deckDesc, { color: theme.textSecondary }]} numberOfLines={2}>
                          {deck.description}
                        </Text>
                      ) : null}
                      <Text style={[styles.deckMeta, { color: theme.textTertiary }]}>
                        {deck.flashcards.length} card{deck.flashcards.length !== 1 ? 's' : ''} · {deck.category}
                      </Text>
                    </View>
                    <Pencil color={theme.textTertiary} size={18} />
                  </TouchableOpacity>
                )}
              </View>

              {/* Actions Bar */}
              <View style={styles.actionsBar}>
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: theme.primary }]}
                  onPress={() => router.push(createFlashcardHref(deck.id))}
                >
                  <Plus color="#fff" size={16} />
                  <Text style={styles.actionBtnText}>Add Card</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: surfaceBg }]}
                  onPress={() => setShowSearch(!showSearch)}
                >
                  <Search color={theme.text} size={16} />
                  <Text style={[styles.actionBtnTextAlt, { color: theme.text }]}>Search</Text>
                </TouchableOpacity>

                {deck.isCustom && (
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: 'rgba(239, 68, 68, 0.12)' }]}
                    onPress={handleDeleteDeck}
                  >
                    <Trash2 color={theme.error} size={16} />
                  </TouchableOpacity>
                )}
              </View>

              {/* Search Bar */}
              {showSearch && (
                <View style={[styles.searchBar, { backgroundColor: surfaceBg, borderColor: theme.border }]}>
                  <Search color={theme.textTertiary} size={16} />
                  <TextInput
                    style={[styles.searchInput, { color: theme.text }]}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    placeholder="Search cards…"
                    placeholderTextColor={theme.textTertiary}
                    autoFocus
                  />
                  {searchQuery.length > 0 && (
                    <TouchableOpacity onPress={() => setSearchQuery('')}>
                      <X color={theme.textTertiary} size={16} />
                    </TouchableOpacity>
                  )}
                </View>
              )}

              {/* Cards Header */}
              <Text style={[styles.cardsHeader, { color: theme.textSecondary }]}>
                {searchQuery
                  ? `${filteredCards.length} result${filteredCards.length !== 1 ? 's' : ''}`
                  : `${deck.flashcards.length} card${deck.flashcards.length !== 1 ? 's' : ''}`}
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
          ListFooterComponent={<View style={{ height: 40 }} />}
        />
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
  listContent: {
    paddingHorizontal: 20,
  },

  // Deck meta
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
    fontWeight: '700',
  },
  deckDesc: {
    fontSize: 13,
    marginTop: 2,
  },
  deckMeta: {
    fontSize: 12,
    marginTop: 4,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
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
  inputMultiline: {
    minHeight: 60,
    textAlignVertical: 'top',
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
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorSwatchSelected: {
    borderWidth: 2.5,
    borderColor: 'rgba(255,255,255,0.8)',
  },
  metaActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 16,
  },
  metaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  metaBtnPrimary: {
    borderWidth: 0,
  },
  metaBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },

  // Actions bar
  actionsBar: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },
  actionBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  actionBtnTextAlt: {
    fontSize: 14,
    fontWeight: '600',
  },

  // Search
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    padding: 0,
  },

  // Cards
  cardsHeader: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: 20,
    marginBottom: 10,
    marginLeft: 4,
  },
  cardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
  },
  cardContent: {
    flex: 1,
  },
  cardQuestion: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  cardAnswer: {
    fontSize: 13,
    marginTop: 3,
  },
  cardDeleteBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },

  // Empty
  emptyState: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
  },
});
