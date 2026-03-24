import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';

import { SAMPLE_DECKS } from '@/data/sampleDecks';
import type { Deck, Flashcard, UserProgress, UserStats } from '@/types/flashcard';
import type { GameResultParams } from '@/types/game';
import { logger } from '@/utils/logger';
import { scheduleStreakReminder } from '@/utils/notifications';

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
  studyDates: [],
  totalStudySessions: 0,
  totalQuestSessions: 0,
  totalPracticeSessions: 0,
  totalArenaSessions: 0,
  totalStudyTimeMs: 0,
  weeklyAccuracy: [],
};

const SAMPLE_DECKS_BY_ID = new Map<string, Deck>(SAMPLE_DECKS.map((deck) => [deck.id, deck]));

function syncSampleDeck(existingDeck: Deck | undefined, sampleDeck: Deck): Deck {
  const existingCardsById = new Map<string, Flashcard>((existingDeck?.flashcards ?? []).map((card) => [card.id, card]));

  return {
    ...sampleDeck,
    createdAt: existingDeck?.createdAt ?? sampleDeck.createdAt,
    flashcards: sampleDeck.flashcards.map((card) => {
      const existingCard = existingCardsById.get(card.id);
      return {
        ...card,
        createdAt: existingCard?.createdAt ?? card.createdAt,
      };
    }),
  };
}

function normalizeStoredDecks(storedDecks: Deck[]): { decks: Deck[]; didChange: boolean } {
  const seenSampleDeckIds = new Set<string>();
  let didChange = false;

  const decks = storedDecks.map((deck) => {
    if (deck.isCustom) {
      return deck;
    }

    const sampleDeck = SAMPLE_DECKS_BY_ID.get(deck.id);
    if (!sampleDeck) {
      return deck;
    }

    seenSampleDeckIds.add(deck.id);
    const syncedDeck = syncSampleDeck(deck, sampleDeck);

    if (JSON.stringify(deck) !== JSON.stringify(syncedDeck)) {
      didChange = true;
    }

    return syncedDeck;
  });

  SAMPLE_DECKS.forEach((sampleDeck) => {
    if (seenSampleDeckIds.has(sampleDeck.id)) {
      return;
    }

    decks.push(sampleDeck);
    didChange = true;
  });

  return { decks, didChange };
}

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

function getIsoWeekString(date: Date): string {
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  normalized.setDate(normalized.getDate() + 3 - ((normalized.getDay() + 6) % 7));
  const week1 = new Date(normalized.getFullYear(), 0, 4);
  const weekNum = 1 + Math.round(
    ((normalized.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7,
  );

  return `${normalized.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

export const [FlashQuestProvider, useFlashQuest] = createContextHook(() => {
  const queryClient = useQueryClient();

  const decksQuery = useQuery({
    queryKey: ['decks'],
    queryFn: async () => {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.DECKS);
      if (stored) {
        const parsedDecks = JSON.parse(stored) as Deck[];
        const normalizedDecks = normalizeStoredDecks(parsedDecks);

        if (normalizedDecks.didChange) {
          logger.log('[FlashQuest] Synced built-in decks with latest default content');
          await AsyncStorage.setItem(STORAGE_KEYS.DECKS, JSON.stringify(normalizedDecks.decks));
        }

        return normalizedDecks.decks;
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
    const existingStudyDates = currentStats.studyDates ?? [];
    const studyDatesUpdated = existingStudyDates.includes(today) ? existingStudyDates : [...existingStudyDates, today];
    const weekNumber = getIsoWeekString(new Date());
    const existingWeekly = currentStats.weeklyAccuracy ?? [];
    const currentWeekEntry = existingWeekly.find((entry) => entry.week === weekNumber);
    const weeklyCorrectToAdd = params.correctCount ?? 0;
    const weeklyAttemptedToAdd = params.correctCount != null ? params.cardsAttempted : 0;
    let updatedWeekly: { week: string; correct: number; attempted: number }[];

    if (currentWeekEntry) {
      updatedWeekly = existingWeekly.map((entry) => (
        entry.week === weekNumber
          ? {
              ...entry,
              correct: entry.correct + weeklyCorrectToAdd,
              attempted: entry.attempted + weeklyAttemptedToAdd,
            }
          : entry
      ));
    } else {
      updatedWeekly = [
        ...existingWeekly,
        {
          week: weekNumber,
          correct: weeklyCorrectToAdd,
          attempted: weeklyAttemptedToAdd,
        },
      ];
    }

    updatedWeekly = updatedWeekly
      .sort((a, b) => a.week.localeCompare(b.week))
      .slice(-12);

    const updatedStats: UserStats = {
      ...currentStats,
      totalScore: currentStats.totalScore + params.xpEarned,
      totalCardsStudied: currentStats.totalCardsStudied + params.cardsAttempted,
      currentStreak: newStreak,
      longestStreak: newLongest,
      lastActiveDate: today,
      totalCorrectAnswers: (currentStats.totalCorrectAnswers ?? 0) + correctAnswersToAdd,
      totalQuestionsAttempted: (currentStats.totalQuestionsAttempted ?? 0) + questionsAttemptedToAdd,
      studyDates: studyDatesUpdated,
      totalStudySessions: (currentStats.totalStudySessions ?? 0) + (params.mode === 'study' ? 1 : 0),
      totalQuestSessions: (currentStats.totalQuestSessions ?? 0) + (params.mode === 'quest' ? 1 : 0),
      totalPracticeSessions: (currentStats.totalPracticeSessions ?? 0) + (params.mode === 'practice' ? 1 : 0),
      totalArenaSessions: (currentStats.totalArenaSessions ?? 0) + (params.mode === 'arena' ? 1 : 0),
      totalStudyTimeMs: (currentStats.totalStudyTimeMs ?? 0) + (params.durationMs ?? 0),
      weeklyAccuracy: updatedWeekly,
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

    scheduleStreakReminder().catch(() => {});
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
