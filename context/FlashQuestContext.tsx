import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';

import { SAMPLE_DECKS } from '@/data/sampleDecks';
import type { Deck, Flashcard, UserProgress, UserStats } from '@/types/flashcard';
import type { GameResultParams } from '@/types/game';
import { logger } from '@/utils/logger';

const STORAGE_KEYS = {
  DECKS: 'flashquest_decks',
  PROGRESS: 'flashquest_progress',
  STATS: 'flashquest_stats',
} as const;

const DEFAULT_STATS: UserStats = {
  totalScore: 0,
  currentStreak: 0,
  longestStreak: 0,
  totalCardsStudied: 0,
  totalDecksCompleted: 0,
  achievements: [],
  lastActiveDate: new Date().toISOString().split('T')[0],
  totalCorrectAnswers: 0,
  totalQuestionsAttempted: 0,
};

function computeStreak(
  lastActiveDate: string,
  currentStreak: number,
  longestStreak: number,
): { currentStreak: number; longestStreak: number } {
  const today = new Date().toISOString().split('T')[0];

  if (lastActiveDate === today) {
    return { currentStreak, longestStreak };
  }

  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

  if (lastActiveDate === yesterday) {
    const newStreak = currentStreak + 1;
    return {
      currentStreak: newStreak,
      longestStreak: Math.max(longestStreak, newStreak),
    };
  }

  return {
    currentStreak: 1,
    longestStreak: Math.max(longestStreak, 1),
  };
}

export const [FlashQuestProvider, useFlashQuest] = createContextHook(() => {
  const queryClient = useQueryClient();

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

        if (stats.lastActiveDate === today || stats.lastActiveDate === yesterday) {
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
      void queryClient.invalidateQueries({ queryKey: ['decks'] });
    },
  });
  const { mutate: saveDecksMutate, mutateAsync: saveDecksMutateAsync } = saveDecksMutation;

  const saveProgressMutation = useMutation({
    mutationFn: async (progress: UserProgress[]) => {
      await AsyncStorage.setItem(STORAGE_KEYS.PROGRESS, JSON.stringify(progress));
      return progress;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['progress'] });
    },
  });
  const { mutate: saveProgressMutate } = saveProgressMutation;

  const saveStatsMutation = useMutation({
    mutationFn: async (stats: UserStats) => {
      await AsyncStorage.setItem(STORAGE_KEYS.STATS, JSON.stringify(stats));
      return stats;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['stats'] });
    },
  });
  const { mutate: saveStatsMutate } = saveStatsMutation;

  const recordSessionResult = useCallback((params: GameResultParams) => {
    const currentStats = queryClient.getQueryData<UserStats>(['stats']) ?? DEFAULT_STATS;
    const today = new Date().toISOString().split('T')[0];

    const { currentStreak: newStreak, longestStreak: newLongest } = computeStreak(
      currentStats.lastActiveDate,
      currentStats.currentStreak,
      currentStats.longestStreak,
    );

    const correctAnswersToAdd = params.correctCount != null ? params.correctCount : 0;
    const questionsAttemptedToAdd = params.correctCount != null ? params.cardsAttempted : 0;

    const updatedStats: UserStats = {
      ...currentStats,
      totalScore: currentStats.totalScore + params.xpEarned,
      totalCardsStudied: currentStats.totalCardsStudied + params.cardsAttempted,
      currentStreak: newStreak,
      longestStreak: newLongest,
      lastActiveDate: today,
      totalCorrectAnswers: (currentStats.totalCorrectAnswers ?? 0) + correctAnswersToAdd,
      totalQuestionsAttempted: (currentStats.totalQuestionsAttempted ?? 0) + questionsAttemptedToAdd,
    };

    logger.log(
      '[FlashQuest] recordSessionResult',
      params.mode,
      'xp:',
      params.xpEarned,
      'cards:',
      params.cardsAttempted,
      'streak:',
      newStreak,
    );

    queryClient.setQueryData(['stats'], updatedStats);
    saveStatsMutate(updatedStats);

    if (params.deckId) {
      const currentProgress = queryClient.getQueryData<UserProgress[]>(['progress']) ?? [];
      const existingIndex = currentProgress.findIndex((entry) => entry.deckId === params.deckId);
      let updatedProgress: UserProgress[];

      if (existingIndex >= 0) {
        const existing = currentProgress[existingIndex];
        updatedProgress = [...currentProgress];
        updatedProgress[existingIndex] = {
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
  }, [queryClient, saveProgressMutate, saveStatsMutate]);

  const addDeck = useCallback((deck: Deck) => {
    const currentDecks = decksQuery.data ?? [];
    saveDecksMutate([...currentDecks, deck]);
  }, [decksQuery.data, saveDecksMutate]);

  const updateDeck = useCallback((deckId: string, updates: Partial<Deck>) => {
    const currentDecks = decksQuery.data ?? [];
    const updatedDecks = currentDecks.map((deck) => (
      deck.id === deckId ? { ...deck, ...updates } : deck
    ));
    saveDecksMutate(updatedDecks);
  }, [decksQuery.data, saveDecksMutate]);

  const updateFlashcard = useCallback((deckId: string, cardId: string, updates: Partial<Flashcard>) => {
    const currentDecks = decksQuery.data ?? [];
    const updatedDecks = currentDecks.map((deck) => {
      if (deck.id !== deckId) {
        return deck;
      }

      return {
        ...deck,
        flashcards: deck.flashcards.map((card) => (
          card.id === cardId ? { ...card, ...updates } : card
        )),
      };
    });

    queryClient.setQueryData(['decks'], updatedDecks);
    saveDecksMutate(updatedDecks);
  }, [decksQuery.data, queryClient, saveDecksMutate]);

  const deleteDeck = useCallback(async (deckId: string) => {
    logger.log('[FlashQuest] Starting delete for deck:', deckId);
    const currentDecks = decksQuery.data ?? [];
    const filteredDecks = currentDecks.filter((deck) => deck.id !== deckId);

    if (filteredDecks.length === currentDecks.length) {
      logger.log('[FlashQuest] Deck not found, aborting delete');
      return currentDecks;
    }

    queryClient.setQueryData(['decks'], filteredDecks);

    try {
      await saveDecksMutateAsync(filteredDecks);
      logger.log('[FlashQuest] Persisted decks via mutation');
    } catch (error) {
      logger.error('[FlashQuest] Failed to persist decks, rolling back', error);
      queryClient.setQueryData(['decks'], currentDecks);
      throw error;
    }

    const currentProgress = progressQuery.data ?? [];
    const filteredProgress = currentProgress.filter((entry) => entry.deckId !== deckId);
    if (filteredProgress.length !== currentProgress.length) {
      queryClient.setQueryData(['progress'], filteredProgress);
      saveProgressMutate(filteredProgress);
    }

    return filteredDecks;
  }, [decksQuery.data, progressQuery.data, queryClient, saveDecksMutateAsync, saveProgressMutate]);

  const updateProgress = useCallback((deckId: string) => {
    const currentProgress = progressQuery.data ?? [];
    const existingIndex = currentProgress.findIndex((entry) => entry.deckId === deckId);
    let updatedProgress: UserProgress[];

    if (existingIndex >= 0) {
      const existing = currentProgress[existingIndex];
      updatedProgress = [...currentProgress];
      updatedProgress[existingIndex] = {
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

  return useMemo(() => ({
    decks: decksQuery.data ?? [],
    progress: progressQuery.data ?? [],
    stats: statsQuery.data ?? DEFAULT_STATS,
    isLoading: decksQuery.isLoading || progressQuery.isLoading || statsQuery.isLoading,
    addDeck,
    updateDeck,
    updateFlashcard,
    deleteDeck,
    updateProgress,
    recordSessionResult,
  }), [
    decksQuery.data,
    progressQuery.data,
    statsQuery.data,
    decksQuery.isLoading,
    progressQuery.isLoading,
    statsQuery.isLoading,
    addDeck,
    updateDeck,
    updateFlashcard,
    deleteDeck,
    updateProgress,
    recordSessionResult,
  ]);
});

export function useDeckProgress(deckId: string) {
  const { progress } = useFlashQuest();

  return useMemo(
    () => progress.find((entry) => entry.deckId === deckId),
    [progress, deckId],
  );
}
