import React, { memo, useCallback } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import type { Theme } from '@/constants/colors';
import type { Deck } from '@/types/flashcard';

interface ArenaLobbyDeckSelectorProps {
  decks: Deck[];
  selectedDeckId: string | null | undefined;
  theme: Theme;
  isDark: boolean;
  arenaAccent: string;
  onSelectDeck: (deckId: string) => void;
}

interface ArenaLobbyDeckOptionProps {
  deck: Deck;
  isSelected: boolean;
  theme: Theme;
  isDark: boolean;
  arenaAccent: string;
  onSelectDeck: (deckId: string) => void;
}

const ITEM_WIDTH = 164;
const ITEM_SPACING = 12;

const ArenaLobbyDeckOption = memo(function ArenaLobbyDeckOption({
  deck,
  isSelected,
  theme,
  isDark,
  arenaAccent,
  onSelectDeck,
}: ArenaLobbyDeckOptionProps) {
  const handlePress = useCallback(() => {
    onSelectDeck(deck.id);
  }, [deck.id, onSelectDeck]);

  return (
    <TouchableOpacity
      style={[
        styles.deckOption,
        { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : theme.background },
        isSelected ? { borderColor: arenaAccent, borderWidth: 2 } : null,
      ]}
      onPress={handlePress}
      activeOpacity={0.7}
      testID={`battle-lobby-deck-option-${deck.id}`}
    >
      <View style={[styles.deckColorDot, { backgroundColor: deck.color }]} />
      <Text style={[styles.deckName, { color: theme.text }]} numberOfLines={1}>
        {deck.name}
      </Text>
      <Text style={[styles.deckCardCount, { color: theme.textSecondary }]}>{deck.flashcards.length} cards</Text>
      {deck.flashcards.length < 4 ? (
        <Text style={[styles.deckWarning, { color: '#F59E0B' }]}>Too few cards</Text>
      ) : null}
    </TouchableOpacity>
  );
});

function ArenaLobbyDeckSelector({ decks, selectedDeckId, theme, isDark, arenaAccent, onSelectDeck }: ArenaLobbyDeckSelectorProps) {
  const renderItem = useCallback(
    ({ item }: { item: Deck }) => (
      <ArenaLobbyDeckOption
        deck={item}
        isSelected={selectedDeckId === item.id}
        theme={theme}
        isDark={isDark}
        arenaAccent={arenaAccent}
        onSelectDeck={onSelectDeck}
      />
    ),
    [arenaAccent, isDark, onSelectDeck, selectedDeckId, theme],
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
      ItemSeparatorComponent={ItemSeparator}
      contentContainerStyle={styles.listContent}
      initialNumToRender={6}
      maxToRenderPerBatch={8}
      windowSize={5}
      getItemLayout={getItemLayout}
      testID="battle-lobby-deck-list"
    />
  );
}

function ItemSeparator() {
  return <View style={styles.separator} />;
}

export default memo(ArenaLobbyDeckSelector);

const styles = StyleSheet.create({
  listContent: {
    paddingRight: 4,
  },
  separator: {
    width: ITEM_SPACING,
  },
  deckOption: {
    width: ITEM_WIDTH,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  deckColorDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    marginBottom: 10,
  },
  deckName: {
    fontSize: 15,
    fontWeight: '700' as const,
    marginBottom: 6,
  },
  deckCardCount: {
    fontSize: 13,
    fontWeight: '600' as const,
  },
  deckWarning: {
    fontSize: 11,
    fontWeight: '700' as const,
    marginTop: 2,
  },
});
