import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useMemo, useCallback, useEffect } from 'react';

import { 
  QuestPerformance, 
  QuestSettings, 
  CardStats, 
  DeckStats,
  Flashcard 
} from '@/types/flashcard';
import { logger } from '@/utils/logger';

// Persists per-card accuracy data so Quest mode can prioritize weak cards
const STORAGE_KEY = 'flashquest_performance';

const DEFAULT_PERFORMANCE: QuestPerformance = {
  cardStatsById: {},
  deckStatsById: {},
  bestQuestStreak: 0,
  lastQuestSettings: undefined,
};

const DEFAULT_CARD_STATS: CardStats = {
  attempts: 0,
  correct: 0,
  incorrect: 0,
  streakCorrect: 0,
  lastAttemptAt: 0,
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
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as QuestPerformance;
        logger.log('[Performance] Loaded performance:', Object.keys(parsed.cardStatsById).length, 'cards tracked');
        return parsed;
      }
      logger.log('[Performance] No stored performance, using defaults');
      return DEFAULT_PERFORMANCE;
    },
  });

  // Sync query data into local state to allow synchronous reads and optimistic updates
  useEffect(() => {
    if (performanceQuery.data) {
      setPerformance(performanceQuery.data);
    }
  }, [performanceQuery.data]);

  const savePerformanceMutation = useMutation({
    mutationFn: async (newPerformance: QuestPerformance) => {
      logger.log('[Performance] Saving performance data');
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newPerformance));
      return newPerformance;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['performance'] });
    },
  });
  const { mutate: savePerformance } = savePerformanceMutation;

  const logQuestAttempt = useCallback((params: {
    deckId: string;
    cardId: string;
    isCorrect: boolean;
    selectedOption: string;
    correctAnswer: string;
    timeToAnswerMs: number;
  }) => {
    logger.log('[Performance] Logging attempt:', params.cardId, 'correct:', params.isCorrect);
    
    setPerformance(prev => {
      const now = Date.now();
      const cardStats = prev.cardStatsById[params.cardId] || { ...DEFAULT_CARD_STATS };
      const deckStats = prev.deckStatsById[params.deckId] || { ...DEFAULT_DECK_STATS };

      const updatedCardStats: CardStats = {
        attempts: cardStats.attempts + 1,
        correct: cardStats.correct + (params.isCorrect ? 1 : 0),
        incorrect: cardStats.incorrect + (params.isCorrect ? 0 : 1),
        streakCorrect: params.isCorrect ? cardStats.streakCorrect + 1 : 0,
        lastAttemptAt: now,
      };

      const updatedDeckStats: DeckStats = {
        attempts: deckStats.attempts + 1,
        correct: deckStats.correct + (params.isCorrect ? 1 : 0),
        incorrect: deckStats.incorrect + (params.isCorrect ? 0 : 1),
        lastAttemptAt: now,
      };

      const newPerformance: QuestPerformance = {
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

      savePerformance(newPerformance);
      return newPerformance;
    });
  }, [savePerformance]);

  const updateBestStreak = useCallback((runStreak: number) => {
    setPerformance(prev => {
      if (runStreak <= prev.bestQuestStreak) return prev;
      
      logger.log('[Performance] New best streak:', runStreak);
      const newPerformance: QuestPerformance = {
        ...prev,
        bestQuestStreak: runStreak,
      };
      savePerformance(newPerformance);
      return newPerformance;
    });
  }, [savePerformance]);

  const getCardAccuracy = useCallback((cardId: string): number | null => {
    const stats = performance.cardStatsById[cardId];
    if (!stats || stats.attempts === 0) return null;
    return stats.correct / stats.attempts;
  }, [performance.cardStatsById]);

  const getDeckAccuracy = useCallback((deckId: string): number | null => {
    const stats = performance.deckStatsById[deckId];
    if (!stats || stats.attempts === 0) return null;
    return stats.correct / stats.attempts;
  }, [performance.deckStatsById]);

  /**
   * Scores each card by weakness (low accuracy, few attempts, more wrong than right)
   * and returns the top N weakest card IDs for focused drilling.
   */
  const getWeakCards = useCallback((deckId: string, cards: Flashcard[], limit: number = 10): string[] => {
    const weakCards: { cardId: string; score: number }[] = [];

    for (const card of cards) {
      if (card.deckId !== deckId) continue;
      
      const stats = performance.cardStatsById[card.id];
      let score = 0;

      if (!stats || stats.attempts === 0) {
        // Never attempted cards are highest priority
        score = 10;
      } else {
        const accuracy = stats.correct / stats.attempts;
        if (accuracy < 0.7) score += 5;
        if (stats.incorrect > stats.correct) score += 4;
        if (stats.attempts < 3) score += 3;
      }

      if (score > 0) {
        weakCards.push({ cardId: card.id, score });
      }
    }

    return weakCards
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(w => w.cardId);
  }, [performance.cardStatsById]);

  const saveLastQuestSettings = useCallback((settings: QuestSettings) => {
    logger.log('[Performance] Saving last quest settings');
    setPerformance(prev => {
      const newPerformance: QuestPerformance = {
        ...prev,
        lastQuestSettings: settings,
      };
      savePerformance(newPerformance);
      return newPerformance;
    });
  }, [savePerformance]);

  const getLastQuestSettings = useCallback((): QuestSettings | undefined => {
    return performance.lastQuestSettings;
  }, [performance.lastQuestSettings]);

  const getOverallQuestAccuracy = useCallback((): number | null => {
    let totalCorrect = 0;
    let totalAttempts = 0;

    Object.values(performance.deckStatsById).forEach(stats => {
      totalCorrect += stats.correct;
      totalAttempts += stats.attempts;
    });

    if (totalAttempts === 0) return null;
    return totalCorrect / totalAttempts;
  }, [performance.deckStatsById]);

  const cleanupDeck = useCallback((deckId: string, cardIds: string[]) => {
    logger.log('[Performance] Cleaning up data for deleted deck:', deckId, 'cards:', cardIds.length);
    setPerformance(prev => {
      const updatedCardStats = { ...prev.cardStatsById };
      for (const cardId of cardIds) {
        delete updatedCardStats[cardId];
      }

      const updatedDeckStats = { ...prev.deckStatsById };
      delete updatedDeckStats[deckId];

      const newPerformance: QuestPerformance = {
        ...prev,
        cardStatsById: updatedCardStats,
        deckStatsById: updatedDeckStats,
      };

      savePerformance(newPerformance);
      return newPerformance;
    });
  }, [savePerformance]);

  return useMemo(() => ({
    performance,
    isLoading: performanceQuery.isLoading,
    logQuestAttempt,
    updateBestStreak,
    getCardAccuracy,
    getDeckAccuracy,
    getWeakCards,
    saveLastQuestSettings,
    getLastQuestSettings,
    getOverallQuestAccuracy,
    cleanupDeck,
  }), [
    performance,
    performanceQuery.isLoading,
    logQuestAttempt,
    updateBestStreak,
    getCardAccuracy,
    getDeckAccuracy,
    getWeakCards,
    saveLastQuestSettings,
    getLastQuestSettings,
    getOverallQuestAccuracy,
    cleanupDeck,
  ]);
});
