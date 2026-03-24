import React, { memo, useCallback } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import type { Theme } from '@/constants/colors';
import type { Deck } from '@/types/flashcard';

interface QuestDeckSelectorProps {
  decks: Deck[];
  selectedDeckId: string;
  onSelectDeck: (deckId: string) => void;
  theme: Theme;
  isDark: boolean;
  selectedSurface: string;
  insetSurface: string;
  surfaceBorderColor: string;
}

interface QuestDeckOptionProps {
  deck: Deck;
  isSelected: boolean;
  onPress: (deckId: string) => void;
  theme: Theme;
  isDark: boolean;
  selectedSurface: string;
  insetSurface: string;
  surfaceBorderColor: string;
}

const ITEM_WIDTH = 164;
const ITEM_SPACING = 12;

const QuestDeckOption = memo(function QuestDeckOption({
  deck,
  isSelected,
  onPress,
  theme,
  isDark,
  selectedSurface,
  insetSurface,
  surfaceBorderColor,
}: QuestDeckOptionProps) {
  const handlePress = useCallback(() => {
    onPress(deck.id);
  }, [deck.id, onPress]);

  return (
    <TouchableOpacity
      style={[
        styles.deckOption,
        {
          backgroundColor: isSelected ? selectedSurface : insetSurface,
          borderWidth: isSelected ? 1.5 : 1,
          borderColor: isSelected ? theme.primary : surfaceBorderColor,
          shadowColor: deck.color,
          shadowOpacity: isSelected ? (isDark ? 0.18 : 0.08) : 0,
          shadowRadius: isSelected ? 12 : 0,
          elevation: isSelected ? 4 : 0,
        },
      ]}
      onPress={handlePress}
      activeOpacity={0.7}
      testID={`quest-deck-option-${deck.id}`}
    >
      <View style={[styles.deckColorDot, { backgroundColor: deck.color }]} />
      <Text style={[styles.deckName, { color: theme.text }]} numberOfLines={1}>
        {deck.name}
      </Text>
      <Text style={[styles.deckCardCount, { color: theme.textSecondary }]}>
        {deck.flashcards.length} cards
      </Text>
    </TouchableOpacity>
  );
});

function QuestDeckSelector({
  decks,
  selectedDeckId,
  onSelectDeck,
  theme,
  isDark,
  selectedSurface,
  insetSurface,
  surfaceBorderColor,
}: QuestDeckSelectorProps) {
  const renderItem = useCallback(
    ({ item }: { item: Deck }) => (
      <QuestDeckOption
        deck={item}
        isSelected={selectedDeckId === item.id}
        onPress={onSelectDeck}
        theme={theme}
        isDark={isDark}
        selectedSurface={selectedSurface}
        insetSurface={insetSurface}
        surfaceBorderColor={surfaceBorderColor}
      />
    ),
    [insetSurface, isDark, onSelectDeck, selectedDeckId, selectedSurface, surfaceBorderColor, theme],
  );

  const keyExtractor = useCallback((item: Deck) => item.id, []);

  const getItemLayout = useCallback(
    (_: ArrayLike<Deck> | null | undefined, index: number) => ({
      length: ITEM_WIDTH + ITEM_SPACING,
      offset: (ITEM_WIDTH + ITEM_SPACING) * index,
      index,
    }),
    [],
  );

  return (
    <FlatList
      data={decks}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.listContent}
      ItemSeparatorComponent={ItemSeparator}
      initialNumToRender={6}
      maxToRenderPerBatch={8}
      windowSize={5}
      getItemLayout={getItemLayout}
      testID="quest-deck-list"
    />
  );
}

function ItemSeparator() {
  return <View style={styles.separator} />;
}

export default memo(QuestDeckSelector);

const styles = StyleSheet.create({
  listContent: {
    paddingRight: 4,
  },
  separator: {
    width: ITEM_SPACING,
  },
  deckOption: {
    width: ITEM_WIDTH,
    borderRadius: 18,
    padding: 16,
    gap: 8,
  },
  deckColorDot: {
    width: 12,
    height: 12,
    borderRadius: 999,
  },
  deckName: {
    fontSize: 16,
    fontWeight: '700' as const,
  },
  deckCardCount: {
    fontSize: 13,
    fontWeight: '600' as const,
  },
});
