import createContextHook from '@nkzw/create-context-hook';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';

import { useAvatar } from '@/context/AvatarContext';
import { supabase } from '@/lib/supabase';
import type { Achievement, UserProgress, UserStats } from '@/types/flashcard';
import type { GameResultParams } from '@/types/game';
import { uploadToCloud, updateLeaderboard } from '@/utils/cloudSync';
import { createPersistenceQueue, persistMirroredStorage, readMirroredStorage } from '@/utils/contextPersistence';
import { incrementDailyProgress } from '@/utils/dailyGoal';
import { computeLevel } from '@/utils/levels';
import { logger } from '@/utils/logger';
import { scheduleStudyReminders } from '@/utils/notifications';
import { CROSS_DECK_REVIEW_DECK_ID } from '@/utils/reviewUtils';
import { getPreferredProfileName } from '@/utils/userIdentity';
import { fetchUsername } from '@/utils/usernameService';
import { updateWidgetData } from '@/utils/widgetBridge';

const STORAGE_KEYS = {
  PROGRESS: 'flashquest_progress',
  STATS: 'flashquest_stats',
} as const;

const STORAGE_BACKUP_KEYS = {
  PROGRESS: 'flashquest_progress_backup',
  STATS: 'flashquest_stats_backup',
} as const;

export const DEFAULT_STATS: UserStats = {
  totalScore: 0,
  currentStreak: 0,
  longestStreak: 0,
  totalCardsStudied: 0,
  totalDecksCompleted: 0,
  achievements: [],
  lastActiveDate: '',
  totalCorrectAnswers: 0,
  totalQuestionsAttempted: 0,
  studyDates: [],
  totalStudySessions: 0,
  totalQuestSessions: 0,
  totalPracticeSessions: 0,
  totalArenaSessions: 0,
  totalArenaBattles: 0,
  totalStudyTimeMs: 0,
  weeklyAccuracy: [],
};

function cloneDefaultStats(): UserStats {
  return {
    ...DEFAULT_STATS,
    lastActiveDate: new Date().toISOString().split('T')[0],
    achievements: [...DEFAULT_STATS.achievements],
    studyDates: [...DEFAULT_STATS.studyDates],
    weeklyAccuracy: [...DEFAULT_STATS.weeklyAccuracy],
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeAchievement(value: unknown): Achievement | null {
  if (!isRecord(value)) {
    return null;
  }

  if (
    typeof value.id !== 'string'
    || typeof value.name !== 'string'
    || typeof value.description !== 'string'
    || typeof value.icon !== 'string'
    || typeof value.progress !== 'number'
    || typeof value.maxProgress !== 'number'
  ) {
    return null;
  }

  return {
    id: value.id,
    name: value.name,
    description: value.description,
    icon: value.icon,
    unlockedAt: typeof value.unlockedAt === 'number' ? value.unlockedAt : undefined,
    progress: value.progress,
    maxProgress: value.maxProgress,
  };
}

function normalizeWeeklyAccuracyEntry(value: unknown): { week: string; correct: number; attempted: number } | null {
  if (!isRecord(value)) {
    return null;
  }

  if (
    typeof value.week !== 'string'
    || typeof value.correct !== 'number'
    || typeof value.attempted !== 'number'
  ) {
    return null;
  }

  return {
    week: value.week,
    correct: value.correct,
    attempted: value.attempted,
  };
}

function normalizeUserStats(value: unknown): UserStats | null {
  if (!isRecord(value)) {
    return null;
  }

  const defaultStats = cloneDefaultStats();

  return {
    totalScore: typeof value.totalScore === 'number' ? value.totalScore : defaultStats.totalScore,
    currentStreak: typeof value.currentStreak === 'number' ? value.currentStreak : defaultStats.currentStreak,
    longestStreak: typeof value.longestStreak === 'number' ? value.longestStreak : defaultStats.longestStreak,
    totalCardsStudied: typeof value.totalCardsStudied === 'number' ? value.totalCardsStudied : defaultStats.totalCardsStudied,
    totalDecksCompleted: typeof value.totalDecksCompleted === 'number' ? value.totalDecksCompleted : defaultStats.totalDecksCompleted,
    achievements: Array.isArray(value.achievements)
      ? value.achievements
        .map((item) => normalizeAchievement(item))
        .filter((item): item is Achievement => item !== null)
      : defaultStats.achievements,
    lastActiveDate: typeof value.lastActiveDate === 'string' && value.lastActiveDate.length > 0
      ? value.lastActiveDate
      : defaultStats.lastActiveDate,
    totalCorrectAnswers: typeof value.totalCorrectAnswers === 'number' ? value.totalCorrectAnswers : defaultStats.totalCorrectAnswers,
    totalQuestionsAttempted: typeof value.totalQuestionsAttempted === 'number' ? value.totalQuestionsAttempted : defaultStats.totalQuestionsAttempted,
    studyDates: Array.isArray(value.studyDates)
      ? value.studyDates.filter((item): item is string => typeof item === 'string')
      : defaultStats.studyDates,
    totalStudySessions: typeof value.totalStudySessions === 'number' ? value.totalStudySessions : defaultStats.totalStudySessions,
    totalQuestSessions: typeof value.totalQuestSessions === 'number' ? value.totalQuestSessions : defaultStats.totalQuestSessions,
    totalPracticeSessions: typeof value.totalPracticeSessions === 'number' ? value.totalPracticeSessions : defaultStats.totalPracticeSessions,
    totalArenaSessions: typeof value.totalArenaSessions === 'number' ? value.totalArenaSessions : defaultStats.totalArenaSessions,
    totalArenaBattles: typeof value.totalArenaBattles === 'number' ? value.totalArenaBattles : defaultStats.totalArenaBattles,
    totalStudyTimeMs: typeof value.totalStudyTimeMs === 'number' ? value.totalStudyTimeMs : defaultStats.totalStudyTimeMs,
    weeklyAccuracy: Array.isArray(value.weeklyAccuracy)
      ? value.weeklyAccuracy
        .map((item) => normalizeWeeklyAccuracyEntry(item))
        .filter((item): item is { week: string; correct: number; attempted: number } => item !== null)
      : defaultStats.weeklyAccuracy,
  };
}

function normalizeUserProgressEntry(value: unknown): UserProgress | null {
  if (!isRecord(value)) {
    return null;
  }

  if (
    typeof value.deckId !== 'string'
    || typeof value.cardsReviewed !== 'number'
    || typeof value.lastStudied !== 'number'
  ) {
    return null;
  }

  return {
    deckId: value.deckId,
    cardsReviewed: value.cardsReviewed,
    lastStudied: value.lastStudied,
    masteredCards: Array.isArray(value.masteredCards)
      ? value.masteredCards.filter((item): item is string => typeof item === 'string')
      : [],
  };
}

function normalizeStoredProgress(value: unknown): UserProgress[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  return value
    .map((item) => normalizeUserProgressEntry(item))
    .filter((item): item is UserProgress => item !== null);
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

function normalizeLoadedStats(stats: UserStats): { stats: UserStats; didChange: boolean } {
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

  if (stats.lastActiveDate === today || stats.lastActiveDate === yesterday) {
    return { stats, didChange: false };
  }

  return {
    stats: { ...stats, currentStreak: 0 },
    didChange: true,
  };
}

async function loadProgressSnapshot(): Promise<UserProgress[]> {
  return readMirroredStorage<UserProgress[]>({
    primaryKey: STORAGE_KEYS.PROGRESS,
    backupKey: STORAGE_BACKUP_KEYS.PROGRESS,
    label: 'progress',
    fallback: [],
    parse: normalizeStoredProgress,
  });
}

async function loadStatsSnapshot(): Promise<UserStats> {
  const storedStats = await readMirroredStorage<UserStats>({
    primaryKey: STORAGE_KEYS.STATS,
    backupKey: STORAGE_BACKUP_KEYS.STATS,
    label: 'stats',
    fallback: cloneDefaultStats(),
    parse: normalizeUserStats,
  });
  const normalizedStats = normalizeLoadedStats(storedStats);

  if (normalizedStats.didChange) {
    try {
      await persistMirroredStorage(STORAGE_KEYS.STATS, STORAGE_BACKUP_KEYS.STATS, normalizedStats.stats, 'stats streak correction');
    } catch (error) {
      logger.warn('[FlashQuest] Failed to persist corrected stats during load', error);
    }
  }

  return normalizedStats.stats;
}

export const [StatsProvider, useStatsContext] = createContextHook(() => {
  const queryClient = useQueryClient();
  const { selectedIdentityKey } = useAvatar();
  const enqueuePersistenceTaskInner = useMemo(() => createPersistenceQueue(), []);

  const enqueuePersistenceTask = useCallback(async <T,>(label: string, task: () => Promise<T>): Promise<T> => {
    return enqueuePersistenceTaskInner(label, async () => {
      logger.debug('[FlashQuest] Running persistence task:', label);
      return task();
    });
  }, [enqueuePersistenceTaskInner]);

  const progressQuery = useQuery({
    queryKey: ['progress'],
    queryFn: loadProgressSnapshot,
  });

  const statsQuery = useQuery({
    queryKey: ['stats'],
    queryFn: loadStatsSnapshot,
  });

  const saveProgressMutation = useMutation({
    mutationFn: async (progress: UserProgress[]) => persistMirroredStorage(STORAGE_KEYS.PROGRESS, STORAGE_BACKUP_KEYS.PROGRESS, progress, 'progress'),
    onSuccess: (progress: UserProgress[]) => {
      queryClient.setQueryData(['progress'], progress);
    },
  });
  const { mutateAsync: saveProgressMutateAsync } = saveProgressMutation;

  const saveStatsMutation = useMutation({
    mutationFn: async (stats: UserStats) => persistMirroredStorage(STORAGE_KEYS.STATS, STORAGE_BACKUP_KEYS.STATS, stats, 'stats'),
    onSuccess: (stats: UserStats) => {
      queryClient.setQueryData(['stats'], stats);
    },
  });
  const { mutateAsync: saveStatsMutateAsync } = saveStatsMutation;

  const getHydratedProgress = useCallback(async (): Promise<UserProgress[]> => {
    const cachedProgress = queryClient.getQueryData<UserProgress[]>(['progress']);
    if (cachedProgress != null) {
      return cachedProgress;
    }

    const hydratedProgress = await loadProgressSnapshot();
    queryClient.setQueryData(['progress'], hydratedProgress);
    return hydratedProgress;
  }, [queryClient]);

  const getHydratedStats = useCallback(async (): Promise<UserStats> => {
    const cachedStats = queryClient.getQueryData<UserStats>(['stats']);
    if (cachedStats != null) {
      return cachedStats;
    }

    const hydratedStats = await loadStatsSnapshot();
    queryClient.setQueryData(['stats'], hydratedStats);
    return hydratedStats;
  }, [queryClient]);

  const recordSessionResult = useCallback((params: GameResultParams) => {
    void enqueuePersistenceTask('recordSessionResult', async () => {
      const currentStats = await getHydratedStats();
      const today = new Date().toISOString().split('T')[0];

      const { currentStreak: newStreak, longestStreak: newLongest } = computeStreak(
        currentStats.lastActiveDate,
        currentStats.currentStreak,
        currentStats.longestStreak,
      );

      const correctAnswersToAdd = params.correctCount != null ? params.correctCount : 0;
      const questionsAttemptedToAdd = params.correctCount != null ? params.cardsAttempted : 0;
      const existingStudyDates = currentStats.studyDates ?? [];
      const studyDatesUpdated = existingStudyDates.includes(today) ? existingStudyDates : [...existingStudyDates, today].slice(-365);
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
        totalArenaBattles: (currentStats.totalArenaBattles ?? 0) + (params.mode === 'arena' ? 1 : 0),
        totalStudyTimeMs: (currentStats.totalStudyTimeMs ?? 0) + (params.durationMs ?? 0),
        weeklyAccuracy: updatedWeekly,
      };

      logger.debug(
        '[FlashQuest] recordSessionResult',
        params.mode,
        'xp:',
        params.xpEarned,
        'cards:',
        params.cardsAttempted,
        'streak:',
        newStreak,
      );

      const normalizedDeckId = params.deckId === CROSS_DECK_REVIEW_DECK_ID ? undefined : params.deckId;
      const previousProgress = normalizedDeckId ? await getHydratedProgress() : null;
      const updatedProgress = normalizedDeckId
        ? (() => {
            const currentProgress = previousProgress ?? [];
            const existingIndex = currentProgress.findIndex((entry) => entry.deckId === normalizedDeckId);

            if (existingIndex >= 0) {
              const existing = currentProgress[existingIndex];
              const nextProgress = [...currentProgress];
              nextProgress[existingIndex] = {
                ...existing,
                cardsReviewed: existing.cardsReviewed + params.cardsAttempted,
                lastStudied: Date.now(),
              };
              return nextProgress;
            }

            return [
              ...currentProgress,
              {
                deckId: normalizedDeckId,
                cardsReviewed: params.cardsAttempted,
                lastStudied: Date.now(),
                masteredCards: [],
              },
            ];
          })()
        : null;

      queryClient.setQueryData(['stats'], updatedStats);
      if (updatedProgress != null) {
        queryClient.setQueryData(['progress'], updatedProgress);
      }

      try {
        await Promise.all([
          saveStatsMutateAsync(updatedStats),
          updatedProgress != null ? saveProgressMutateAsync(updatedProgress) : Promise.resolve([]),
        ]);
      } catch (error) {
        queryClient.setQueryData(['stats'], currentStats);
        if (previousProgress != null) {
          queryClient.setQueryData(['progress'], previousProgress);
        }
        logger.error('[FlashQuest] Failed to persist session result, rolled back cache', error);
        throw error;
      }

      void updateWidgetData({
        currentStreak: newStreak,
        longestStreak: newLongest,
        totalCardsStudied: updatedStats.totalCardsStudied,
        totalScore: updatedStats.totalScore,
        level: computeLevel(updatedStats.totalScore),
        dueCardCount: 0,
        lastStudiedDate: today,
        updatedAt: new Date().toISOString(),
      });

      if (params.cardsAttempted > 0) {
        void incrementDailyProgress(params.cardsAttempted);
      }

      scheduleStudyReminders(
        {
          dueCardCount: 0,
          deckCount: 0,
          currentStreak: newStreak,
        },
        { requestPermissionIfNeeded: true },
      ).catch(() => {});

      supabase.auth.getSession()
        .then(async ({ data: { session: currentSession } }) => {
          if (!currentSession?.user?.id) {
            return;
          }

          const claimedUsername = await fetchUsername(currentSession.user.id);
          const displayName = getPreferredProfileName({
            username: claimedUsername,
            user: currentSession.user,
            fallback: 'Player',
          });

          void uploadToCloud(currentSession.user.id);
          void updateLeaderboard(currentSession.user.id, {
            displayName,
            avatarKey: selectedIdentityKey,
            totalScore: updatedStats.totalScore,
            level: computeLevel(updatedStats.totalScore),
            currentStreak: newStreak,
            longestStreak: newLongest,
            totalCardsStudied: updatedStats.totalCardsStudied,
          });
        })
        .catch((error) => {
          logger.warn('[FlashQuest] Cloud sync after session failed:', error);
        });
    }).catch((error) => {
      logger.error('[FlashQuest] recordSessionResult task failed', error);
    });
  }, [enqueuePersistenceTask, getHydratedProgress, getHydratedStats, queryClient, saveProgressMutateAsync, saveStatsMutateAsync, selectedIdentityKey]);

  const updateProgress = useCallback((deckId: string) => {
    void enqueuePersistenceTask('updateProgress', async () => {
      const currentProgress = await getHydratedProgress();
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

      queryClient.setQueryData(['progress'], updatedProgress);

      try {
        await saveProgressMutateAsync(updatedProgress);
      } catch (error) {
        queryClient.setQueryData(['progress'], currentProgress);
        logger.error('[FlashQuest] Failed to persist progress update, rolled back cache', error);
        throw error;
      }
    }).catch((error) => {
      logger.error('[FlashQuest] updateProgress task failed', error);
    });
  }, [enqueuePersistenceTask, getHydratedProgress, queryClient, saveProgressMutateAsync]);

  return useMemo(() => ({
    stats: statsQuery.data ?? DEFAULT_STATS,
    progress: progressQuery.data ?? [],
    isLoading: statsQuery.isLoading || progressQuery.isLoading,
    recordSessionResult,
    updateProgress,
  }), [
    statsQuery.data,
    progressQuery.data,
    statsQuery.isLoading,
    progressQuery.isLoading,
    recordSessionResult,
    updateProgress,
  ]);
});
