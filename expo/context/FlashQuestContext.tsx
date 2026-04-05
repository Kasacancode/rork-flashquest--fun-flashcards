import createContextHook from '@nkzw/create-context-hook';
import { useMemo } from 'react';

import { useDeckContext } from '@/context/DeckContext';
import { useStatsContext } from '@/context/StatsContext';

export const [FlashQuestProvider, useFlashQuest] = createContextHook(() => {
  const deck = useDeckContext();
  const stats = useStatsContext();

  return useMemo(() => ({
    decks: deck.decks,
    deckCategories: deck.deckCategories,
    addDeck: deck.addDeck,
    updateDeck: deck.updateDeck,
    updateFlashcard: deck.updateFlashcard,
    deleteFlashcard: deck.deleteFlashcard,
    deleteDeck: deck.deleteDeck,
    reorderDecks: deck.reorderDecks,
    createDeckCategory: deck.createDeckCategory,
    renameDeckCategory: deck.renameDeckCategory,
    deleteDeckCategory: deck.deleteDeckCategory,
    stats: stats.stats,
    progress: stats.progress,
    recordSessionResult: stats.recordSessionResult,
    updateProgress: stats.updateProgress,
    isLoading: deck.isLoading || stats.isLoading,
  }), [deck, stats]);
});

export function useDeckProgress(deckId: string) {
  const { progress } = useStatsContext();

  return useMemo(
    () => progress.find((entry) => entry.deckId === deckId),
    [progress, deckId],
  );
}
