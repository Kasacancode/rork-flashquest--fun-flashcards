import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useMemo, useCallback } from 'react';

import { SAMPLE_DECKS } from '@/data/sampleDecks';
import { Deck, Flashcard, UserProgress, UserStats, DuelSession } from '@/types/flashcard';
import { logger } from '@/utils/logger';

// AsyncStorage keys for persisting app data between sessions
const STORAGE_KEYS = {
  DECKS: 'flashquest_decks',
  PROGRESS: 'flashquest_progress',
  STATS: 'flashquest_stats',
};

// Initial stats for new users
const DEFAULT_STATS: UserStats = {
  totalScore: 0,
  currentStreak: 0,
  longestStreak: 0,
  totalCardsStudied: 0,
  totalDecksCompleted: 0,
  achievements: [],
  lastActiveDate: new Date().toISOString().split('T')[0],
};

// Shared type used by all game modes when recording session results
export type GameMode = 'study' | 'quest' | 'duel' | 'battle';

export interface GameResultParams {
  mode: GameMode;
  deckId?: string;
  xpEarned: number;
  cardsAttempted: number;
  correctCount?: number;
  timestampISO: string;
}

/**
 * Calculates updated streak values based on when the user was last active.
 * - Same day: no change
 * - Yesterday: increment streak
 * - Older: reset to 1
 */
function computeStreak(lastActiveDate: string, currentStreak: number, longestStreak: number): { currentStreak: number; longestStreak: number } {
  const today = new Date().toISOString().split('T')[0];

  // Already active today, streak unchanged
  if (lastActiveDate === today) {
    return { currentStreak, longestStreak };
  }

  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

  // Active yesterday, continue the streak
  if (lastActiveDate === yesterday) {
    const newStreak = currentStreak + 1;
    return {
      currentStreak: newStreak,
      longestStreak: Math.max(longestStreak, newStreak),
    };
  }

  // Missed a day or more, reset streak to 1
  return {
    currentStreak: 1,
    longestStreak: Math.max(longestStreak, 1),
  };
}

export const [FlashQuestProvider, useFlashQuest] = createContextHook(() => {
  const queryClient = useQueryClient();
  const [currentDuel, setCurrentDuel] = useState<DuelSession | null>(null);

  const decksQuery = useQuery({
    queryKey: ['decks'],
    queryFn: async () => {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.DECKS);
      if (stored) {
        return JSON.parse(stored) as Deck[];
      }
      return SAMPLE_DECKS;
    },
  });

  const progressQuery = useQuery({
    queryKey: ['progress'],
    queryFn: async () => {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.PROGRESS);
      return stored ? (JSON.parse(stored) as UserProgress[]) : [];
    },
  });

  const statsQuery = useQuery({
    queryKey: ['stats'],
    queryFn: async () => {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.STATS);
      if (stored) {
        const stats = JSON.parse(stored) as UserStats;
        const today = new Date().toISOString().split('T')[0];
        const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

        if (stats.lastActiveDate === today) {
          return stats;
        }

        if (stats.lastActiveDate === yesterday) {
          return stats;
        }

        const corrected: UserStats = { ...stats, currentStreak: 0 };
        await AsyncStorage.setItem(STORAGE_KEYS.STATS, JSON.stringify(corrected));
        return corrected;
      }
      return DEFAULT_STATS;
    },
  });

  const saveDecksMutation = useMutation({
    mutationFn: async (decks: Deck[]) => {
      await AsyncStorage.setItem(STORAGE_KEYS.DECKS, JSON.stringify(decks));
      return decks;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['decks'] });
    },
  });
  const { mutate: saveDecksMutate, mutateAsync: saveDecksMutateAsync } = saveDecksMutation;

  const saveProgressMutation = useMutation({
    mutationFn: async (progress: UserProgress[]) => {
      await AsyncStorage.setItem(STORAGE_KEYS.PROGRESS, JSON.stringify(progress));
      return progress;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['progress'] });
    },
  });
  const { mutate: saveProgressMutate } = saveProgressMutation;

  const saveStatsMutation = useMutation({
    mutationFn: async (stats: UserStats) => {
      await AsyncStorage.setItem(STORAGE_KEYS.STATS, JSON.stringify(stats));
      return stats;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stats'] });
    },
  });
  const { mutate: saveStatsMutate } = saveStatsMutation;

  const recordSessionResult = useCallback((params: GameResultParams) => {
    const currentStats = statsQuery.data || DEFAULT_STATS;
    const today = new Date().toISOString().split('T')[0];

    const { currentStreak: newStreak, longestStreak: newLongest } = computeStreak(
      currentStats.lastActiveDate,
      currentStats.currentStreak,
      currentStats.longestStreak
    );

    const updatedStats: UserStats = {
      ...currentStats,
      totalScore: currentStats.totalScore + params.xpEarned,
      totalCardsStudied: currentStats.totalCardsStudied + params.cardsAttempted,
      currentStreak: newStreak,
      longestStreak: newLongest,
      lastActiveDate: today,
    };

    logger.log('[Context] recordSessionResult', params.mode, 'xp:', params.xpEarned, 'cards:', params.cardsAttempted, 'streak:', newStreak);

    queryClient.setQueryData(['stats'], updatedStats);
    saveStatsMutate(updatedStats);

    if (params.deckId) {
      const currentProgress = progressQuery.data || [];
      const idx = currentProgress.findIndex((p) => p.deckId === params.deckId);
      let updatedProgress: UserProgress[];

      if (idx >= 0) {
        const existing = currentProgress[idx];
        updatedProgress = [...currentProgress];
        updatedProgress[idx] = {
          ...existing,
          cardsReviewed: existing.cardsReviewed + params.cardsAttempted,
          lastStudied: Date.now(),
        };
      } else {
        updatedProgress = [
          ...currentProgress,
          {
            deckId: params.deckId,
            cardsReviewed: params.cardsAttempted,
            lastStudied: Date.now(),
            masteredCards: [],
          },
        ];
      }

      queryClient.setQueryData(['progress'], updatedProgress);
      saveProgressMutate(updatedProgress);
    }
  }, [statsQuery.data, progressQuery.data, saveStatsMutate, saveProgressMutate, queryClient]);

  const addDeck = useCallback((deck: Deck) => {
    const currentDecks = decksQuery.data || [];
    saveDecksMutate([...currentDecks, deck]);
  }, [decksQuery.data, saveDecksMutate]);

  const updateDeck = useCallback((deckId: string, updates: Partial<Deck>) => {
    const currentDecks = decksQuery.data || [];
    const updatedDecks = currentDecks.map(deck =>
      deck.id === deckId ? { ...deck, ...updates } : deck
    );
    saveDecksMutate(updatedDecks);
  }, [decksQuery.data, saveDecksMutate]);

  const updateFlashcard = useCallback((deckId: string, cardId: string, updates: Partial<Flashcard>) => {
    const currentDecks = decksQuery.data || [];
    const updatedDecks = currentDecks.map(deck => {
      if (deck.id !== deckId) return deck;
      return {
        ...deck,
        flashcards: deck.flashcards.map(card =>
          card.id === cardId ? { ...card, ...updates } : card
        ),
      };
    });
    queryClient.setQueryData(['decks'], updatedDecks);
    saveDecksMutate(updatedDecks);
  }, [decksQuery.data, queryClient, saveDecksMutate]);

  /**
   * Deletes a deck with optimistic update and rollback on failure.
   * Also cleans up any associated progress entries.
   */
  const deleteDeck = useCallback(async (deckId: string) => {
    logger.log('[Context] Starting delete for deck:', deckId);
    const currentDecks = decksQuery.data || [];
    const filteredDecks = currentDecks.filter((deck) => deck.id !== deckId);

    if (filteredDecks.length === currentDecks.length) {
      logger.log('[Context] Deck not found, aborting delete');
      return currentDecks;
    }

    // Optimistic update for instant UI feedback
    queryClient.setQueryData(['decks'], filteredDecks);

    try {
      await saveDecksMutateAsync(filteredDecks);
      logger.log('[Context] Persisted decks via mutation');
    } catch (error) {
      // Rollback on failure to keep UI consistent with storage
      logger.error('[Context] Failed to persist decks, rolling back', error);
      queryClient.setQueryData(['decks'], currentDecks);
      throw error;
    }

    // Clean up orphaned progress entries for the deleted deck
    const currentProgress = progressQuery.data || [];
    const filteredProgress = currentProgress.filter((entry) => entry.deckId !== deckId);
    if (filteredProgress.length !== currentProgress.length) {
      queryClient.setQueryData(['progress'], filteredProgress);
      saveProgressMutate(filteredProgress);
    }

    return filteredDecks;
  }, [decksQuery.data, progressQuery.data, queryClient, saveDecksMutateAsync, saveProgressMutate]);

  const updateProgress = useCallback((deckId: string) => {
    const currentProgress = progressQuery.data || [];

    const deckProgressIndex = currentProgress.findIndex((p) => p.deckId === deckId);
    let updatedProgress: UserProgress[];

    if (deckProgressIndex >= 0) {
      const existing = currentProgress[deckProgressIndex];
      updatedProgress = [...currentProgress];
      updatedProgress[deckProgressIndex] = {
        ...existing,
        cardsReviewed: existing.cardsReviewed + 1,
        lastStudied: Date.now(),
      };
    } else {
      updatedProgress = [
        ...currentProgress,
        {
          deckId,
          cardsReviewed: 1,
          lastStudied: Date.now(),
          masteredCards: [],
        },
      ];
    }

    saveProgressMutate(updatedProgress);
  }, [progressQuery.data, saveProgressMutate]);

  const startDuel = useCallback((deckId: string, mode: 'ai' | 'multiplayer', shouldShuffle?: boolean) => {
    const duel: DuelSession = {
      id: `duel_${Date.now()}`,
      mode,
      deckId,
      playerScore: 0,
      opponentScore: 0,
      currentRound: 0,
      totalRounds: 5,
      status: 'active',
      opponentName: mode === 'ai' ? 'AI Bot' : 'Opponent',
      shuffled: shouldShuffle || false,
    };
    setCurrentDuel(duel);
  }, []);

  const updateDuel = useCallback((playerCorrect: boolean, opponentCorrect: boolean) => {
    if (!currentDuel) return;

    const updated: DuelSession = {
      ...currentDuel,
      playerScore: currentDuel.playerScore + (playerCorrect ? 1 : 0),
      opponentScore: currentDuel.opponentScore + (opponentCorrect ? 1 : 0),
      currentRound: currentDuel.currentRound + 1,
      status: currentDuel.currentRound + 1 >= currentDuel.totalRounds ? 'completed' : 'active',
      completedAt: currentDuel.currentRound + 1 >= currentDuel.totalRounds ? Date.now() : undefined,
    };

    setCurrentDuel(updated);
  }, [currentDuel]);

  const endDuel = useCallback(() => {
    setCurrentDuel(null);
  }, []);

  return useMemo(() => ({
    decks: decksQuery.data || [],
    progress: progressQuery.data || [],
    stats: statsQuery.data || DEFAULT_STATS,
    currentDuel,
    isLoading: decksQuery.isLoading || progressQuery.isLoading || statsQuery.isLoading,

    addDeck,
    updateDeck,
    updateFlashcard,
    deleteDeck,
    updateProgress,
    recordSessionResult,
    startDuel,
    updateDuel,
    endDuel,
  }), [decksQuery.data, progressQuery.data, statsQuery.data, currentDuel, decksQuery.isLoading, progressQuery.isLoading, statsQuery.isLoading, addDeck, updateDeck, updateFlashcard, deleteDeck, updateProgress, recordSessionResult, startDuel, updateDuel, endDuel]);
});

export function useDeckProgress(deckId: string) {
  const { progress } = useFlashQuest();
  return useMemo(
    () => progress.find((p) => p.deckId === deckId),
    [progress, deckId]
  );
}
