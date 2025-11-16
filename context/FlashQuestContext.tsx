import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useMemo, useCallback } from 'react';

import { SAMPLE_DECKS } from '@/data/sampleDecks';
import { Deck, UserProgress, UserStats, DuelSession } from '@/types/flashcard';

const STORAGE_KEYS = {
  DECKS: 'flashquest_decks',
  PROGRESS: 'flashquest_progress',
  STATS: 'flashquest_stats',
};

const DEFAULT_STATS: UserStats = {
  totalScore: 0,
  currentStreak: 0,
  longestStreak: 0,
  totalCardsStudied: 0,
  totalDecksCompleted: 0,
  achievements: [],
  lastActiveDate: new Date().toISOString().split('T')[0],
};

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
        if (stats.lastActiveDate !== today) {
          const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
          const updatedStats = {
            ...stats,
            currentStreak: stats.lastActiveDate === yesterday ? stats.currentStreak : 0,
            lastActiveDate: today,
          };
          return updatedStats;
        }
        return stats;
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

  const deleteDeck = useCallback(async (deckId: string) => {
    console.log('[Context] Starting delete for deck:', deckId);
    const currentDecks = decksQuery.data || [];
    console.log('[Context] Current decks count:', currentDecks.length);

    const filteredDecks = currentDecks.filter((deck) => deck.id !== deckId);
    console.log('[Context] Filtered decks count:', filteredDecks.length);

    if (filteredDecks.length === currentDecks.length) {
      console.log('[Context] Deck not found, aborting delete');
      return currentDecks;
    }

    queryClient.setQueryData(['decks'], filteredDecks);
    console.log('[Context] Optimistically updated deck cache');

    try {
      await saveDecksMutateAsync(filteredDecks);
      console.log('[Context] Persisted decks via mutation');
    } catch (error) {
      console.log('[Context] Failed to persist decks, rolling back', error);
      queryClient.setQueryData(['decks'], currentDecks);
      throw error;
    }

    const currentProgress = progressQuery.data || [];
    const filteredProgress = currentProgress.filter((entry) => entry.deckId !== deckId);
    if (filteredProgress.length !== currentProgress.length) {
      console.log('[Context] Removing progress entries for deck');
      queryClient.setQueryData(['progress'], filteredProgress);
      saveProgressMutate(filteredProgress);
    }

    return filteredDecks;
  }, [decksQuery.data, progressQuery.data, queryClient, saveDecksMutateAsync, saveProgressMutate]);

  const updateProgress = useCallback((deckId: string, correct: boolean) => {
    const currentProgress = progressQuery.data || [];
    const currentStats = statsQuery.data || DEFAULT_STATS;

    const deckProgressIndex = currentProgress.findIndex((p) => p.deckId === deckId);
    let updatedProgress: UserProgress[];

    if (deckProgressIndex >= 0) {
      const existing = currentProgress[deckProgressIndex];
      updatedProgress = [...currentProgress];
      updatedProgress[deckProgressIndex] = {
        ...existing,
        correctAnswers: correct ? existing.correctAnswers + 1 : existing.correctAnswers,
        totalAttempts: existing.totalAttempts + 1,
        lastStudied: Date.now(),
      };
    } else {
      updatedProgress = [
        ...currentProgress,
        {
          deckId,
          correctAnswers: correct ? 1 : 0,
          totalAttempts: 1,
          lastStudied: Date.now(),
          masteredCards: [],
        },
      ];
    }

    const today = new Date().toISOString().split('T')[0];
    const updatedStats: UserStats = {
      ...currentStats,
      totalScore: currentStats.totalScore + (correct ? 10 : 0),
      totalCardsStudied: currentStats.totalCardsStudied + 1,
      currentStreak: currentStats.lastActiveDate === today ? currentStats.currentStreak : currentStats.currentStreak + 1,
      longestStreak: Math.max(currentStats.longestStreak, currentStats.currentStreak + 1),
      lastActiveDate: today,
    };

    saveProgressMutate(updatedProgress);
    saveStatsMutate(updatedStats);
  }, [progressQuery.data, statsQuery.data, saveProgressMutate, saveStatsMutate]);

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

    if (updated.status === 'completed') {
      const currentStats = statsQuery.data || DEFAULT_STATS;
      const wonDuel = updated.playerScore > updated.opponentScore;
      const updatedStats: UserStats = {
        ...currentStats,
        totalScore: currentStats.totalScore + (wonDuel ? 50 : 20),
      };
      saveStatsMutate(updatedStats);
    }
  }, [currentDuel, statsQuery.data, saveStatsMutate]);

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
    deleteDeck,
    updateProgress,
    startDuel,
    updateDuel,
    endDuel,
  }), [decksQuery.data, progressQuery.data, statsQuery.data, currentDuel, decksQuery.isLoading, progressQuery.isLoading, statsQuery.isLoading, addDeck, updateDeck, deleteDeck, updateProgress, startDuel, updateDuel, endDuel]);
});

export function useDeckProgress(deckId: string) {
  const { progress } = useFlashQuest();
  return useMemo(
    () => progress.find((p) => p.deckId === deckId),
    [progress, deckId]
  );
}
