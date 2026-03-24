import createContextHook from '@nkzw/create-context-hook';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState } from 'react';

import type { Flashcard } from '@/types/flashcard';
import type {
  CardStats,
  DeckStats,
  QuestPerformance,
  QuestSettings,
  RecallQuality,
} from '@/types/performance';
import {
  createDefaultCardStats,
  getLiveCardStats,
  getWeaknessScore,
  inferRecallQuality,
  isCardDue,
  migrateQuestPerformance,
  updateCardMemory,
} from '@/utils/mastery';
import { logger } from '@/utils/logger';
import { persistStorageSnapshot, readStorageSnapshot } from '@/utils/storage';

const STORAGE_KEY = 'flashquest_performance';
const STORAGE_BACKUP_KEY = 'flashquest_performance_backup';

const DEFAULT_PERFORMANCE: QuestPerformance = {
  cardStatsById: {},
  deckStatsById: {},
  bestQuestStreak: 0,
  lastQuestSettings: undefined,
};

const DEFAULT_DECK_STATS: DeckStats = {
  attempts: 0,
  correct: 0,
  incorrect: 0,
  lastAttemptAt: 0,
};

export const [PerformanceProvider, usePerformance] = createContextHook(() => {
  const queryClient = useQueryClient();
  const [performance, setPerformance] = useState<QuestPerformance>(DEFAULT_PERFORMANCE);

  const performanceQuery = useQuery({
    queryKey: ['performance'],
    queryFn: async () => {
      logger.log('[Performance] Loading performance data from storage');
      const storedPerformance = await readStorageSnapshot<QuestPerformance>({
        primaryKey: STORAGE_KEY,
        backupKey: STORAGE_BACKUP_KEY,
        label: 'performance',
        fallback: DEFAULT_PERFORMANCE,
      });
      const migrated = migrateQuestPerformance(storedPerformance);

      if (migrated.didChange) {
        await persistStorageSnapshot({
          primaryKey: STORAGE_KEY,
          backupKey: STORAGE_BACKUP_KEY,
          value: migrated.performance,
          label: 'performance migration',
        });
        logger.log('[Performance] Migrated performance model for', Object.keys(migrated.performance.cardStatsById).length, 'cards');
      } else {
        logger.log('[Performance] Loaded performance:', Object.keys(migrated.performance.cardStatsById).length, 'cards tracked');
      }

      return migrated.performance;
    },
  });

  useEffect(() => {
    if (performanceQuery.data) {
      setPerformance(performanceQuery.data);
    }
  }, [performanceQuery.data]);

  const savePerformanceMutation = useMutation({
    mutationFn: async (newPerformance: QuestPerformance) => {
      logger.log('[Performance] Saving performance data');
      await persistStorageSnapshot({
        primaryKey: STORAGE_KEY,
        backupKey: STORAGE_BACKUP_KEY,
        value: newPerformance,
        label: 'performance',
      });
      return newPerformance;
    },
    onSuccess: (newPerformance: QuestPerformance) => {
      queryClient.setQueryData(['performance'], newPerformance);
    },
  });
  const { mutate: savePerformance } = savePerformanceMutation;

  const applyPerformanceUpdate = useCallback((updater: (previous: QuestPerformance) => QuestPerformance) => {
    setPerformance((previous) => {
      const nextPerformance = updater(previous);
      if (nextPerformance === previous) {
        return previous;
      }

      savePerformance(nextPerformance);
      return nextPerformance;
    });
  }, [savePerformance]);

  const logQuestAttempt = useCallback((params: {
    deckId: string;
    cardId: string;
    isCorrect: boolean;
    selectedOption: string;
    correctAnswer: string;
    timeToAnswerMs: number;
    quality?: RecallQuality | null;
    mode?: 'quest' | 'practice' | 'study';
    hintsUsed?: number;
    usedSecondChance?: boolean;
    explanationOpened?: boolean;
  }) => {
    const now = Date.now();
    const resolvedQuality = inferRecallQuality({
      isCorrect: params.isCorrect,
      manualQuality: params.quality,
      timeToAnswerMs: params.timeToAnswerMs,
      hintsUsed: params.hintsUsed,
      usedSecondChance: params.usedSecondChance,
      explanationOpened: params.explanationOpened,
    });

    logger.log('[Performance] Logging attempt:', {
      cardId: params.cardId,
      mode: params.mode ?? 'quest',
      isCorrect: params.isCorrect,
      quality: resolvedQuality,
    });

    applyPerformanceUpdate((prev) => {
      const cardStats = prev.cardStatsById[params.cardId] || createDefaultCardStats();
      const deckStats = prev.deckStatsById[params.deckId] || { ...DEFAULT_DECK_STATS };
      const updatedCardStats = updateCardMemory(cardStats, { quality: resolvedQuality, now });
      const updatedDeckStats: DeckStats = {
        attempts: deckStats.attempts + 1,
        correct: deckStats.correct + (params.isCorrect ? 1 : 0),
        incorrect: deckStats.incorrect + (params.isCorrect ? 0 : 1),
        lastAttemptAt: now,
      };

      logger.log('[Performance] Updated card memory:', {
        cardId: params.cardId,
        status: updatedCardStats.status,
        stability: Number(updatedCardStats.stability.toFixed(2)),
        difficulty: Number(updatedCardStats.difficulty.toFixed(2)),
        lapses: updatedCardStats.lapses,
        nextReviewAt: updatedCardStats.nextReviewAt,
      });

      return {
        ...prev,
        cardStatsById: {
          ...prev.cardStatsById,
          [params.cardId]: updatedCardStats,
        },
        deckStatsById: {
          ...prev.deckStatsById,
          [params.deckId]: updatedDeckStats,
        },
      };
    });
  }, [applyPerformanceUpdate]);

  const updateBestStreak = useCallback((runStreak: number) => {
    applyPerformanceUpdate((prev) => {
      if (runStreak <= prev.bestQuestStreak) {
        return prev;
      }

      logger.log('[Performance] New best streak:', runStreak);
      return {
        ...prev,
        bestQuestStreak: runStreak,
      };
    });
  }, [applyPerformanceUpdate]);

  const getCardAccuracy = useCallback((cardId: string): number | null => {
    const stats = performance.cardStatsById[cardId];
    if (!stats || stats.attempts === 0) {
      return null;
    }

    return stats.correct / stats.attempts;
  }, [performance.cardStatsById]);

  const getDeckAccuracy = useCallback((deckId: string): number | null => {
    const stats = performance.deckStatsById[deckId];
    if (!stats || stats.attempts === 0) {
      return null;
    }

    return stats.correct / stats.attempts;
  }, [performance.deckStatsById]);

  const getWeakCards = useCallback((deckId: string, cards: Flashcard[], limit: number = 10): string[] => {
    return cards
      .filter((card) => card.deckId === deckId)
      .map((card) => ({
        cardId: card.id,
        score: getWeaknessScore(performance.cardStatsById[card.id]),
      }))
      .filter((entry) => entry.score > 0.85)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((entry) => entry.cardId);
  }, [performance.cardStatsById]);

  const getCardsDueForReview = useCallback((deckId: string, cards: Flashcard[]): string[] => {
    const now = Date.now();
    return cards
      .filter((card) => card.deckId === deckId)
      .filter((card) => isCardDue(performance.cardStatsById[card.id], now))
      .map((card) => card.id);
  }, [performance.cardStatsById]);

  const saveLastQuestSettings = useCallback((settings: QuestSettings) => {
    logger.log('[Performance] Saving last quest settings');
    applyPerformanceUpdate((prev) => ({
      ...prev,
      lastQuestSettings: settings,
    }));
  }, [applyPerformanceUpdate]);

  const getLastQuestSettings = useCallback((): QuestSettings | undefined => {
    return performance.lastQuestSettings;
  }, [performance.lastQuestSettings]);

  const getOverallQuestAccuracy = useCallback((): number | null => {
    let totalCorrect = 0;
    let totalAttempts = 0;

    Object.values(performance.deckStatsById).forEach((stats) => {
      totalCorrect += stats.correct;
      totalAttempts += stats.attempts;
    });

    if (totalAttempts === 0) {
      return null;
    }

    return totalCorrect / totalAttempts;
  }, [performance.deckStatsById]);

  const cleanupDeck = useCallback((deckId: string, cardIds: string[]) => {
    logger.log('[Performance] Cleaning up data for deleted deck:', deckId, 'cards:', cardIds.length);
    applyPerformanceUpdate((prev) => {
      const updatedCardStats = { ...prev.cardStatsById };
      for (const cardId of cardIds) {
        delete updatedCardStats[cardId];
      }

      const updatedDeckStats = { ...prev.deckStatsById };
      delete updatedDeckStats[deckId];

      return {
        ...prev,
        cardStatsById: updatedCardStats,
        deckStatsById: updatedDeckStats,
      };
    });
  }, [applyPerformanceUpdate]);

  const liveCardStatsById = useMemo<Record<string, CardStats>>(() => {
    const now = Date.now();
    return Object.fromEntries(
      Object.entries(performance.cardStatsById).map(([cardId, stats]) => [cardId, getLiveCardStats(stats, now)]),
    );
  }, [performance.cardStatsById]);

  return useMemo(() => ({
    performance: {
      ...performance,
      cardStatsById: liveCardStatsById,
    },
    isLoading: performanceQuery.isLoading,
    logQuestAttempt,
    updateBestStreak,
    getCardAccuracy,
    getDeckAccuracy,
    getWeakCards,
    getCardsDueForReview,
    saveLastQuestSettings,
    getLastQuestSettings,
    getOverallQuestAccuracy,
    cleanupDeck,
  }), [
    performance,
    liveCardStatsById,
    performanceQuery.isLoading,
    logQuestAttempt,
    updateBestStreak,
    getCardAccuracy,
    getDeckAccuracy,
    getWeakCards,
    getCardsDueForReview,
    saveLastQuestSettings,
    getLastQuestSettings,
    getOverallQuestAccuracy,
    cleanupDeck,
  ]);
});
