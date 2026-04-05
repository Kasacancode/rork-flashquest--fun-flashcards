import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef } from 'react';

import {
  CUSTOM_DECK_CATEGORY_LABEL,
  DEFAULT_DECK_CATEGORY_LIBRARY,
  buildManagedDeckCategoryList,
  canDeleteDeckCategory,
  canRenameDeckCategory,
  mergeDeckCategoryLibraries,
  sanitizeDeckCategory,
} from '@/constants/deckCategories';
import { SAMPLE_DECKS } from '@/data/sampleDecks';
import { useAvatar } from '@/context/AvatarContext';
import { supabase } from '@/lib/supabase';
import type { Achievement, Deck, Flashcard, FlashcardNormalizationSource, UserProgress, UserStats } from '@/types/flashcard';
import type { GameResultParams } from '@/types/game';
import { uploadToCloud, updateLeaderboard } from '@/utils/cloudSync';
import { mergeFlashcardUpdates, normalizeDeck, normalizeDeckCollection } from '@/utils/flashcardContent';
import { incrementDailyProgress } from '@/utils/dailyGoal';
import { computeLevel } from '@/utils/levels';
import { logger } from '@/utils/logger';
import { scheduleStudyReminders } from '@/utils/notifications';
import { CROSS_DECK_REVIEW_DECK_ID } from '@/utils/reviewUtils';
import { getPreferredProfileName } from '@/utils/userIdentity';
import { fetchUsername } from '@/utils/usernameService';
import { updateWidgetData } from '@/utils/widgetBridge';

const STORAGE_KEYS = {
  DECKS: 'flashquest_decks',
  PROGRESS: 'flashquest_progress',
  STATS: 'flashquest_stats',
  CATEGORIES: 'flashquest_categories',
  HIDDEN_DECKS: 'flashquest_hidden_deck_ids',
} as const;

const STORAGE_BACKUP_KEYS = {
  DECKS: 'flashquest_decks_backup',
  PROGRESS: 'flashquest_progress_backup',
  STATS: 'flashquest_stats_backup',
  CATEGORIES: 'flashquest_categories_backup',
  HIDDEN_DECKS: 'flashquest_hidden_deck_ids_backup',
} as const;

const DEFAULT_STATS: UserStats = {
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

const SAMPLE_DECKS_BY_ID = new Map<string, Deck>(SAMPLE_DECKS.map((deck) => [deck.id, deck]));
const BUILT_IN_DECK_IDS = new Set<string>(SAMPLE_DECKS.map((deck) => deck.id));

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

function parseStoredJson(raw: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch (error) {
    logger.warn('[FlashQuest] Failed to parse persisted JSON:', error);
    return null;
  }
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

function normalizeStoredDeckPayload(value: unknown): Deck[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  return value as Deck[];
}

function normalizeStoredCategoriesPayload(value: unknown): string[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const rawCategories = value.filter((item): item is string => typeof item === 'string');
  return buildManagedDeckCategoryList(rawCategories);
}

async function persistMirroredStorage<T>(primaryKey: string, backupKey: string, value: T, label: string): Promise<T> {
  const serialized = JSON.stringify(value);
  await Promise.all([
    AsyncStorage.setItem(primaryKey, serialized),
    AsyncStorage.setItem(backupKey, serialized),
  ]);
  logger.debug('[FlashQuest] Persisted mirrored storage for', label);
  return value;
}

async function readMirroredStorage<T>(options: {
  primaryKey: string;
  backupKey: string;
  label: string;
  fallback: T;
  parse: (value: unknown) => T | null;
}): Promise<T> {
  const { primaryKey, backupKey, label, fallback, parse } = options;

  try {
    const primaryRaw = await AsyncStorage.getItem(primaryKey);

    if (primaryRaw != null) {
      const parsedPrimary = parseStoredJson(primaryRaw);
      const normalizedPrimary = parsedPrimary == null ? null : parse(parsedPrimary);

      if (normalizedPrimary != null) {
        try {
          const backupRaw = await AsyncStorage.getItem(backupKey);
          if (backupRaw !== primaryRaw) {
            await persistMirroredStorage(primaryKey, backupKey, normalizedPrimary, `${label} mirror sync`);
          }
        } catch (error) {
          logger.warn('[FlashQuest] Mirror sync failed during read for', label, error);
        }
        return normalizedPrimary;
      }

      logger.warn('[FlashQuest] Primary persisted payload was invalid, trying backup for', label);
    }

    const backupRaw = await AsyncStorage.getItem(backupKey);
    if (backupRaw != null) {
      const parsedBackup = parseStoredJson(backupRaw);
      const normalizedBackup = parsedBackup == null ? null : parse(parsedBackup);

      if (normalizedBackup != null) {
        logger.debug('[FlashQuest] Recovered', label, 'from backup storage');
        try {
          await persistMirroredStorage(primaryKey, backupKey, normalizedBackup, `${label} recovery`);
        } catch (error) {
          logger.warn('[FlashQuest] Mirror recovery persist failed for', label, error);
        }
        return normalizedBackup;
      }

      logger.warn('[FlashQuest] Backup persisted payload was invalid for', label);
    }
  } catch (error) {
    logger.error('[FlashQuest] Failed to read mirrored storage for', label, error);
  }

  logger.debug('[FlashQuest] Falling back to default payload for', label);
  return fallback;
}

function syncSampleDeck(existingDeck: Deck | undefined, sampleDeck: Deck): Deck {
  const existingCardsById = new Map<string, Flashcard>((existingDeck?.flashcards ?? []).map((card) => [card.id, card]));

  return {
    ...sampleDeck,
    category: existingDeck?.category ?? sampleDeck.category,
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

function reconcileDeckCatalog(
  decks: Deck[],
  source: FlashcardNormalizationSource = 'deck_update',
  hiddenDeckIds: ReadonlySet<string> = new Set(),
): { decks: Deck[]; didChange: boolean } {
  const seenSampleDeckIds = new Set<string>();
  let didChange = false;

  const syncedDecks = decks.reduce<Deck[]>((result, deck) => {
    if (deck.isCustom) {
      result.push(deck);
      return result;
    }

    if (hiddenDeckIds.has(deck.id)) {
      didChange = true;
      return result;
    }

    const sampleDeck = SAMPLE_DECKS_BY_ID.get(deck.id);
    if (!sampleDeck) {
      result.push(deck);
      return result;
    }

    seenSampleDeckIds.add(deck.id);
    const syncedDeck = syncSampleDeck(deck, sampleDeck);

    if (JSON.stringify(deck) !== JSON.stringify(syncedDeck)) {
      didChange = true;
    }

    result.push(syncedDeck);
    return result;
  }, []);

  SAMPLE_DECKS.forEach((sampleDeck) => {
    if (seenSampleDeckIds.has(sampleDeck.id)) {
      return;
    }

    if (hiddenDeckIds.has(sampleDeck.id)) {
      return;
    }

    syncedDecks.push(sampleDeck);
    didChange = true;
  });

  const normalizedDecks = normalizeDeckCollection(syncedDecks, {
    source,
    trackDiagnostics: true,
  });

  return {
    decks: normalizedDecks.decks,
    didChange: didChange || normalizedDecks.didChange,
  };
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

async function loadDecksSnapshot(hiddenDeckIds: ReadonlySet<string> = new Set()): Promise<Deck[]> {
  try {
    const storedDecks = await readMirroredStorage<Deck[]>({
      primaryKey: STORAGE_KEYS.DECKS,
      backupKey: STORAGE_BACKUP_KEYS.DECKS,
      label: 'decks',
      fallback: SAMPLE_DECKS,
      parse: normalizeStoredDeckPayload,
    });
    const normalizedDecks = reconcileDeckCatalog(storedDecks, 'legacy_load_normalization', hiddenDeckIds);

    if (normalizedDecks.didChange) {
      logger.debug('[FlashQuest] Synced built-in decks with latest default content');
      try {
        await persistMirroredStorage(STORAGE_KEYS.DECKS, STORAGE_BACKUP_KEYS.DECKS, normalizedDecks.decks, 'decks normalization');
      } catch (error) {
        logger.warn('[FlashQuest] Failed to persist normalized deck catalog during load', error);
      }
    }

    return normalizedDecks.decks;
  } catch (error) {
    logger.error('[FlashQuest] Failed to load deck snapshot, restoring built-in decks only', error);
    return reconcileDeckCatalog(SAMPLE_DECKS, 'legacy_load_normalization', hiddenDeckIds).decks;
  }
}

async function loadHiddenDeckIdsSnapshot(): Promise<string[]> {
  return readMirroredStorage<string[]>({
    primaryKey: STORAGE_KEYS.HIDDEN_DECKS,
    backupKey: STORAGE_BACKUP_KEYS.HIDDEN_DECKS,
    label: 'hidden deck IDs',
    fallback: [],
    parse: (value) => Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : null,
  });
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

async function loadCategoriesSnapshot(): Promise<string[]> {
  return readMirroredStorage<string[]>({
    primaryKey: STORAGE_KEYS.CATEGORIES,
    backupKey: STORAGE_BACKUP_KEYS.CATEGORIES,
    label: 'categories',
    fallback: DEFAULT_DECK_CATEGORY_LIBRARY,
    parse: normalizeStoredCategoriesPayload,
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

export const [FlashQuestProvider, useFlashQuest] = createContextHook(() => {
  const queryClient = useQueryClient();
  const { selectedIdentityKey } = useAvatar();
  const persistenceQueueRef = useRef<Promise<void>>(Promise.resolve());
  const hiddenDeckIdsRef = useRef<Set<string>>(new Set());

  const hiddenDeckIdsQuery = useQuery({
    queryKey: ['hidden-deck-ids'],
    queryFn: loadHiddenDeckIdsSnapshot,
  });

  useEffect(() => {
    if (hiddenDeckIdsQuery.data != null) {
      hiddenDeckIdsRef.current = new Set(hiddenDeckIdsQuery.data);
    }
  }, [hiddenDeckIdsQuery.data]);

  const decksQuery = useQuery({
    queryKey: ['decks'],
    queryFn: async () => {
      const hiddenDeckIds = queryClient.getQueryData<string[]>(['hidden-deck-ids']) ?? await loadHiddenDeckIdsSnapshot();
      return loadDecksSnapshot(new Set(hiddenDeckIds));
    },
  });

  const progressQuery = useQuery({
    queryKey: ['progress'],
    queryFn: loadProgressSnapshot,
  });

  const statsQuery = useQuery({
    queryKey: ['stats'],
    queryFn: loadStatsSnapshot,
  });

  const categoriesQuery = useQuery({
    queryKey: ['deck-categories'],
    queryFn: loadCategoriesSnapshot,
  });

  const saveDecksMutation = useMutation({
    mutationFn: async (decks: Deck[]) => {
      const cachedHiddenDeckIds = queryClient.getQueryData<string[]>(['hidden-deck-ids']);
      const reconciledDecks = reconcileDeckCatalog(
        decks,
        'deck_update',
        cachedHiddenDeckIds != null ? new Set(cachedHiddenDeckIds) : hiddenDeckIdsRef.current,
      ).decks;
      return persistMirroredStorage(STORAGE_KEYS.DECKS, STORAGE_BACKUP_KEYS.DECKS, reconciledDecks, 'decks');
    },
    onSuccess: (decks: Deck[]) => {
      queryClient.setQueryData(['decks'], decks);
    },
  });
  const { mutateAsync: saveDecksMutateAsync } = saveDecksMutation;

  const saveHiddenDeckIdsMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      await persistMirroredStorage(STORAGE_KEYS.HIDDEN_DECKS, STORAGE_BACKUP_KEYS.HIDDEN_DECKS, ids, 'hidden deck IDs');
      return ids;
    },
    onSuccess: (ids: string[]) => {
      queryClient.setQueryData(['hidden-deck-ids'], ids);
    },
  });
  const { mutateAsync: saveHiddenDeckIdsMutateAsync } = saveHiddenDeckIdsMutation;

  const saveCategoriesMutation = useMutation({
    mutationFn: async (categories: string[]) => {
      const normalizedCategories = buildManagedDeckCategoryList(categories);
      return persistMirroredStorage(STORAGE_KEYS.CATEGORIES, STORAGE_BACKUP_KEYS.CATEGORIES, normalizedCategories, 'categories');
    },
    onSuccess: (categories: string[]) => {
      queryClient.setQueryData(['deck-categories'], categories);
    },
  });
  const { mutateAsync: saveCategoriesMutateAsync } = saveCategoriesMutation;

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

  const enqueuePersistenceTask = useCallback(async function runPersistenceTask<T>(
    label: string,
    task: () => Promise<T>,
  ): Promise<T> {
    let result: T | undefined;

    persistenceQueueRef.current = persistenceQueueRef.current
      .catch((error) => {
        logger.error('[FlashQuest] Previous persistence task failed before', label, error);
      })
      .then(async () => {
        logger.debug('[FlashQuest] Running persistence task:', label);
        result = await task();
      });

    await persistenceQueueRef.current;
    return result as T;
  }, []);

  const getHydratedDecks = useCallback(async (): Promise<Deck[]> => {
    const cachedDecks = queryClient.getQueryData<Deck[]>(['decks']);
    const cachedHiddenDeckIds = queryClient.getQueryData<string[]>(['hidden-deck-ids']);
    const hiddenDeckIds = cachedHiddenDeckIds != null ? new Set(cachedHiddenDeckIds) : hiddenDeckIdsRef.current;

    if (cachedDecks != null) {
      const reconciledCachedDecks = reconcileDeckCatalog(cachedDecks, 'deck_update', hiddenDeckIds);
      if (reconciledCachedDecks.didChange) {
        queryClient.setQueryData(['decks'], reconciledCachedDecks.decks);
      }
      return reconciledCachedDecks.decks;
    }

    const hydratedDecks = await loadDecksSnapshot(hiddenDeckIds);
    queryClient.setQueryData(['decks'], hydratedDecks);
    return hydratedDecks;
  }, [queryClient]);

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

  const getHydratedCategories = useCallback(async (): Promise<string[]> => {
    const cachedCategories = queryClient.getQueryData<string[]>(['deck-categories']);
    if (cachedCategories != null) {
      const normalizedCategories = buildManagedDeckCategoryList(cachedCategories);
      if (JSON.stringify(normalizedCategories) !== JSON.stringify(cachedCategories)) {
        queryClient.setQueryData(['deck-categories'], normalizedCategories);
      }
      return normalizedCategories;
    }

    const hydratedCategories = await loadCategoriesSnapshot();
    queryClient.setQueryData(['deck-categories'], hydratedCategories);
    return hydratedCategories;
  }, [queryClient]);

  const getHydratedHiddenDeckIds = useCallback(async (): Promise<string[]> => {
    const cachedHiddenDeckIds = queryClient.getQueryData<string[]>(['hidden-deck-ids']);
    if (cachedHiddenDeckIds != null) {
      return cachedHiddenDeckIds;
    }

    const hydratedHiddenDeckIds = await loadHiddenDeckIdsSnapshot();
    hiddenDeckIdsRef.current = new Set(hydratedHiddenDeckIds);
    queryClient.setQueryData(['hidden-deck-ids'], hydratedHiddenDeckIds);
    return hydratedHiddenDeckIds;
  }, [queryClient]);

  const deckCategories = useMemo(
    () => mergeDeckCategoryLibraries(
      categoriesQuery.data ?? DEFAULT_DECK_CATEGORY_LIBRARY,
      (decksQuery.data ?? []).map((deck) => deck.category),
    ),
    [categoriesQuery.data, decksQuery.data],
  );

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

  const addDeck = useCallback((deck: Deck) => {
    void enqueuePersistenceTask('addDeck', async () => {
      const currentDecks = await getHydratedDecks();
      const currentCategories = await getHydratedCategories();
      const normalizedDeck = normalizeDeck(deck);
      const updatedDecks = reconcileDeckCatalog([...currentDecks, normalizedDeck], 'deck_update', hiddenDeckIdsRef.current).decks;
      const updatedCategories = mergeDeckCategoryLibraries(
        currentCategories,
        updatedDecks.map((item) => item.category),
      );
      const shouldPersistCategories = JSON.stringify(updatedCategories) !== JSON.stringify(currentCategories);
      queryClient.setQueryData(['decks'], updatedDecks);
      queryClient.setQueryData(['deck-categories'], updatedCategories);

      try {
        await Promise.all([
          saveDecksMutateAsync(updatedDecks),
          shouldPersistCategories ? saveCategoriesMutateAsync(updatedCategories) : Promise.resolve(updatedCategories),
        ]);
      } catch (error) {
        queryClient.setQueryData(['decks'], currentDecks);
        queryClient.setQueryData(['deck-categories'], currentCategories);
        logger.error('[FlashQuest] Failed to persist added deck, rolled back cache', error);
        throw error;
      }
    }).catch((error) => {
      logger.error('[FlashQuest] addDeck task failed', error);
    });
  }, [enqueuePersistenceTask, getHydratedCategories, getHydratedDecks, queryClient, saveCategoriesMutateAsync, saveDecksMutateAsync]);

  const updateDeck = useCallback((deckId: string, updates: Partial<Deck>) => {
    void enqueuePersistenceTask('updateDeck', async () => {
      const currentDecks = await getHydratedDecks();
      const currentCategories = await getHydratedCategories();
      const updatedDecks = reconcileDeckCatalog(currentDecks.map((deck) => (
        deck.id === deckId ? normalizeDeck({ ...deck, ...updates }) : deck
      )), 'deck_update', hiddenDeckIdsRef.current).decks;
      const updatedCategories = mergeDeckCategoryLibraries(
        currentCategories,
        updatedDecks.map((item) => item.category),
      );
      const shouldPersistCategories = JSON.stringify(updatedCategories) !== JSON.stringify(currentCategories);
      queryClient.setQueryData(['decks'], updatedDecks);
      queryClient.setQueryData(['deck-categories'], updatedCategories);

      try {
        await Promise.all([
          saveDecksMutateAsync(updatedDecks),
          shouldPersistCategories ? saveCategoriesMutateAsync(updatedCategories) : Promise.resolve(updatedCategories),
        ]);
      } catch (error) {
        queryClient.setQueryData(['decks'], currentDecks);
        queryClient.setQueryData(['deck-categories'], currentCategories);
        logger.error('[FlashQuest] Failed to persist updated deck, rolled back cache', error);
        throw error;
      }
    }).catch((error) => {
      logger.error('[FlashQuest] updateDeck task failed', error);
    });
  }, [enqueuePersistenceTask, getHydratedCategories, getHydratedDecks, queryClient, saveCategoriesMutateAsync, saveDecksMutateAsync]);

  const updateFlashcard = useCallback((deckId: string, cardId: string, updates: Partial<Flashcard>) => {
    void enqueuePersistenceTask('updateFlashcard', async () => {
      const currentDecks = await getHydratedDecks();
      const updatedDecks = reconcileDeckCatalog(currentDecks.map((deck) => {
        if (deck.id !== deckId) {
          return deck;
        }

        return normalizeDeck({
          ...deck,
          flashcards: deck.flashcards.map((card) => (
            card.id === cardId ? mergeFlashcardUpdates(card, updates) : card
          )),
        });
      }), 'deck_update', hiddenDeckIdsRef.current).decks;

      queryClient.setQueryData(['decks'], updatedDecks);

      try {
        await saveDecksMutateAsync(updatedDecks);
      } catch (error) {
        queryClient.setQueryData(['decks'], currentDecks);
        logger.error('[FlashQuest] Failed to persist flashcard update, rolled back cache', error);
        throw error;
      }
    }).catch((error) => {
      logger.error('[FlashQuest] updateFlashcard task failed', error);
    });
  }, [enqueuePersistenceTask, getHydratedDecks, queryClient, saveDecksMutateAsync]);

  const deleteFlashcard = useCallback((deckId: string, cardId: string) => {
    void enqueuePersistenceTask('deleteFlashcard', async () => {
      const currentDecks = await getHydratedDecks();
      const updatedDecks = reconcileDeckCatalog(currentDecks.map((deck) => {
        if (deck.id !== deckId) {
          return deck;
        }

        return normalizeDeck({
          ...deck,
          flashcards: deck.flashcards.filter((card) => card.id !== cardId),
        });
      }), 'deck_update', hiddenDeckIdsRef.current).decks;

      queryClient.setQueryData(['decks'], updatedDecks);

      try {
        await saveDecksMutateAsync(updatedDecks);
      } catch (error) {
        queryClient.setQueryData(['decks'], currentDecks);
        logger.error('[FlashQuest] Failed to persist flashcard deletion, rolled back cache', error);
        throw error;
      }
    }).catch((error) => {
      logger.error('[FlashQuest] deleteFlashcard task failed', error);
    });
  }, [enqueuePersistenceTask, getHydratedDecks, queryClient, saveDecksMutateAsync]);

  const deleteDeck = useCallback(async (deckId: string) => {
    return enqueuePersistenceTask('deleteDeck', async () => {
      logger.debug('[FlashQuest] Starting delete for deck:', deckId);
      const currentDecks = await getHydratedDecks();
      const currentHiddenIds = await getHydratedHiddenDeckIds();
      hiddenDeckIdsRef.current = new Set(currentHiddenIds);

      if (BUILT_IN_DECK_IDS.has(deckId)) {
        logger.debug('[FlashQuest] Hiding built-in deck:', deckId);
        const updatedHiddenIds = [...new Set([...currentHiddenIds, deckId])];
        const filteredDecks = currentDecks.filter((deck) => deck.id !== deckId);
        const nextHiddenDeckIds = new Set(updatedHiddenIds);
        const reconciledDecks = reconcileDeckCatalog(filteredDecks, 'deck_update', nextHiddenDeckIds).decks;

        hiddenDeckIdsRef.current = nextHiddenDeckIds;
        queryClient.setQueryData(['decks'], reconciledDecks);
        queryClient.setQueryData(['hidden-deck-ids'], updatedHiddenIds);

        try {
          await Promise.all([
            saveDecksMutateAsync(reconciledDecks),
            saveHiddenDeckIdsMutateAsync(updatedHiddenIds),
          ]);
        } catch (error) {
          hiddenDeckIdsRef.current = new Set(currentHiddenIds);
          queryClient.setQueryData(['decks'], currentDecks);
          queryClient.setQueryData(['hidden-deck-ids'], currentHiddenIds);
          logger.error('[FlashQuest] Failed to hide built-in deck, rolled back', error);
          throw error;
        }

        return reconciledDecks;
      }

      const currentProgress = await getHydratedProgress();
      const filteredDecks = currentDecks.filter((deck) => deck.id !== deckId);

      if (filteredDecks.length === currentDecks.length) {
        logger.debug('[FlashQuest] Deck not found, aborting delete');
        return currentDecks;
      }

      const reconciledDecks = reconcileDeckCatalog(filteredDecks, 'deck_update', hiddenDeckIdsRef.current).decks;
      const filteredProgress = currentProgress.filter((entry) => entry.deckId !== deckId);
      queryClient.setQueryData(['decks'], reconciledDecks);
      queryClient.setQueryData(['progress'], filteredProgress);

      try {
        await Promise.all([
          saveDecksMutateAsync(reconciledDecks),
          filteredProgress.length !== currentProgress.length ? saveProgressMutateAsync(filteredProgress) : Promise.resolve([]),
        ]);
        logger.debug('[FlashQuest] Persisted deck delete via queued mutation');
      } catch (error) {
        queryClient.setQueryData(['decks'], currentDecks);
        queryClient.setQueryData(['progress'], currentProgress);
        logger.error('[FlashQuest] Failed to persist deck delete, rolled back cache', error);
        throw error;
      }

      return reconciledDecks;
    });
  }, [enqueuePersistenceTask, getHydratedDecks, getHydratedHiddenDeckIds, getHydratedProgress, queryClient, saveDecksMutateAsync, saveHiddenDeckIdsMutateAsync, saveProgressMutateAsync]);

  const reorderDecks = useCallback((deckIds: string[]) => {
    void enqueuePersistenceTask('reorderDecks', async () => {
      const currentDecks = await getHydratedDecks();
      const requestedDeckIds = new Set(deckIds);
      const decksById = new Map(currentDecks.map((deck) => [deck.id, deck]));
      const orderedDecks = deckIds
        .map((deckId) => decksById.get(deckId))
        .filter((deck): deck is Deck => Boolean(deck));
      const remainingDecks = currentDecks.filter((deck) => !requestedDeckIds.has(deck.id));
      const nextDecks = [...orderedDecks, ...remainingDecks];
      const reconciledDecks = reconcileDeckCatalog(nextDecks, 'deck_update', hiddenDeckIdsRef.current).decks;

      logger.debug('[FlashQuest] Reordering decks. Requested:', deckIds.length, 'Resolved:', reconciledDecks.length);
      queryClient.setQueryData(['decks'], reconciledDecks);

      try {
        await saveDecksMutateAsync(reconciledDecks);
      } catch (error) {
        queryClient.setQueryData(['decks'], currentDecks);
        logger.error('[FlashQuest] Failed to persist reordered decks, rolled back cache', error);
        throw error;
      }
    }).catch((error) => {
      logger.error('[FlashQuest] reorderDecks task failed', error);
    });
  }, [enqueuePersistenceTask, getHydratedDecks, queryClient, saveDecksMutateAsync]);

  const createDeckCategory = useCallback(async (categoryName: string) => {
    return enqueuePersistenceTask('createDeckCategory', async () => {
      const currentCategories = await getHydratedCategories();
      const normalizedCategory = sanitizeDeckCategory(categoryName);

      if (!normalizedCategory) {
        throw new Error('Please enter a category name.');
      }

      const updatedCategories = mergeDeckCategoryLibraries(currentCategories, [normalizedCategory]);
      queryClient.setQueryData(['deck-categories'], updatedCategories);

      try {
        await saveCategoriesMutateAsync(updatedCategories);
      } catch (error) {
        queryClient.setQueryData(['deck-categories'], currentCategories);
        logger.error('[FlashQuest] Failed to create category, rolled back cache', error);
        throw error;
      }

      return normalizedCategory;
    });
  }, [enqueuePersistenceTask, getHydratedCategories, queryClient, saveCategoriesMutateAsync]);

  const renameDeckCategory = useCallback(async (currentCategoryName: string, nextCategoryName: string) => {
    return enqueuePersistenceTask('renameDeckCategory', async () => {
      const currentCategories = await getHydratedCategories();
      const currentDecks = await getHydratedDecks();
      const normalizedCurrentCategory = sanitizeDeckCategory(currentCategoryName);
      const normalizedNextCategory = sanitizeDeckCategory(nextCategoryName);

      if (!canRenameDeckCategory(normalizedCurrentCategory)) {
        throw new Error('This category cannot be renamed.');
      }

      if (!normalizedNextCategory) {
        throw new Error('Please enter a category name.');
      }

      const hasConflict = currentCategories.some((category) => (
        category.toLowerCase() === normalizedNextCategory.toLowerCase()
        && category.toLowerCase() !== normalizedCurrentCategory.toLowerCase()
      ));

      if (hasConflict) {
        throw new Error('That category already exists.');
      }

      const updatedDecks = reconcileDeckCatalog(currentDecks.map((deck) => {
        if (deck.category.trim().toLowerCase() !== normalizedCurrentCategory.toLowerCase()) {
          return deck;
        }

        return normalizeDeck({
          ...deck,
          category: normalizedNextCategory,
        });
      }), 'deck_update', hiddenDeckIdsRef.current).decks;

      const renamedCategories = currentCategories.map((category) => (
        category.toLowerCase() === normalizedCurrentCategory.toLowerCase() ? normalizedNextCategory : category
      ));
      const updatedCategories = mergeDeckCategoryLibraries(
        renamedCategories,
        updatedDecks.map((deck) => deck.category),
      );

      queryClient.setQueryData(['decks'], updatedDecks);
      queryClient.setQueryData(['deck-categories'], updatedCategories);

      try {
        await Promise.all([
          saveDecksMutateAsync(updatedDecks),
          saveCategoriesMutateAsync(updatedCategories),
        ]);
      } catch (error) {
        queryClient.setQueryData(['decks'], currentDecks);
        queryClient.setQueryData(['deck-categories'], currentCategories);
        logger.error('[FlashQuest] Failed to rename category, rolled back cache', error);
        throw error;
      }

      return normalizedNextCategory;
    });
  }, [enqueuePersistenceTask, getHydratedCategories, getHydratedDecks, queryClient, saveCategoriesMutateAsync, saveDecksMutateAsync]);

  const deleteDeckCategory = useCallback(async (categoryName: string) => {
    return enqueuePersistenceTask('deleteDeckCategory', async () => {
      const currentCategories = await getHydratedCategories();
      const currentDecks = await getHydratedDecks();
      const normalizedCategory = sanitizeDeckCategory(categoryName);

      if (!canDeleteDeckCategory(normalizedCategory)) {
        throw new Error('This category cannot be deleted.');
      }

      const updatedDecks = reconcileDeckCatalog(currentDecks.map((deck) => {
        if (deck.category.trim().toLowerCase() !== normalizedCategory.toLowerCase()) {
          return deck;
        }

        return normalizeDeck({
          ...deck,
          category: CUSTOM_DECK_CATEGORY_LABEL,
        });
      }), 'deck_update', hiddenDeckIdsRef.current).decks;

      const updatedCategories = mergeDeckCategoryLibraries(
        currentCategories.filter((category) => category.toLowerCase() !== normalizedCategory.toLowerCase()),
        updatedDecks.map((deck) => deck.category),
      );

      queryClient.setQueryData(['decks'], updatedDecks);
      queryClient.setQueryData(['deck-categories'], updatedCategories);

      try {
        await Promise.all([
          saveDecksMutateAsync(updatedDecks),
          saveCategoriesMutateAsync(updatedCategories),
        ]);
      } catch (error) {
        queryClient.setQueryData(['decks'], currentDecks);
        queryClient.setQueryData(['deck-categories'], currentCategories);
        logger.error('[FlashQuest] Failed to delete category, rolled back cache', error);
        throw error;
      }
    });
  }, [enqueuePersistenceTask, getHydratedCategories, getHydratedDecks, queryClient, saveCategoriesMutateAsync, saveDecksMutateAsync]);

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
    decks: decksQuery.data ?? [],
    deckCategories,
    progress: progressQuery.data ?? [],
    stats: statsQuery.data ?? DEFAULT_STATS,
    isLoading: decksQuery.isLoading || progressQuery.isLoading || statsQuery.isLoading || categoriesQuery.isLoading || hiddenDeckIdsQuery.isLoading,
    addDeck,
    updateDeck,
    createDeckCategory,
    renameDeckCategory,
    deleteDeckCategory,
    updateFlashcard,
    deleteFlashcard,
    deleteDeck,
    reorderDecks,
    updateProgress,
    recordSessionResult,
  }), [
    decksQuery.data,
    deckCategories,
    progressQuery.data,
    statsQuery.data,
    decksQuery.isLoading,
    progressQuery.isLoading,
    statsQuery.isLoading,
    categoriesQuery.isLoading,
    hiddenDeckIdsQuery.isLoading,
    addDeck,
    updateDeck,
    createDeckCategory,
    renameDeckCategory,
    deleteDeckCategory,
    updateFlashcard,
    deleteFlashcard,
    deleteDeck,
    reorderDecks,
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
