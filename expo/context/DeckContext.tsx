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
import type { Deck, Flashcard, FlashcardNormalizationSource, UserProgress } from '@/types/flashcard';
import { createPersistenceQueue, persistMirroredStorage, readMirroredStorage } from '@/utils/contextPersistence';
import { mergeFlashcardUpdates, normalizeDeck, normalizeDeckCollection } from '@/utils/flashcardContent';
import { logger } from '@/utils/logger';

const STORAGE_KEYS = {
  DECKS: 'flashquest_decks',
  PROGRESS: 'flashquest_progress',
  CATEGORIES: 'flashquest_categories',
  HIDDEN_DECKS: 'flashquest_hidden_deck_ids',
} as const;

const STORAGE_BACKUP_KEYS = {
  DECKS: 'flashquest_decks_backup',
  PROGRESS: 'flashquest_progress_backup',
  CATEGORIES: 'flashquest_categories_backup',
  HIDDEN_DECKS: 'flashquest_hidden_deck_ids_backup',
} as const;

const SAMPLE_DECKS_BY_ID = new Map<string, Deck>(SAMPLE_DECKS.map((deck) => [deck.id, deck]));
const BUILT_IN_DECK_IDS = new Set<string>(SAMPLE_DECKS.map((deck) => deck.id));

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
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

async function loadCategoriesSnapshot(): Promise<string[]> {
  return readMirroredStorage<string[]>({
    primaryKey: STORAGE_KEYS.CATEGORIES,
    backupKey: STORAGE_BACKUP_KEYS.CATEGORIES,
    label: 'categories',
    fallback: DEFAULT_DECK_CATEGORY_LIBRARY,
    parse: normalizeStoredCategoriesPayload,
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

export const [DeckProvider, useDeckContext] = createContextHook(() => {
  const queryClient = useQueryClient();
  const hiddenDeckIdsRef = useRef<Set<string>>(new Set());
  const enqueuePersistenceTaskInner = useMemo(() => createPersistenceQueue(), []);

  const enqueuePersistenceTask = useCallback(async <T,>(label: string, task: () => Promise<T>): Promise<T> => {
    return enqueuePersistenceTaskInner(label, async () => {
      logger.debug('[FlashQuest] Running persistence task:', label);
      return task();
    });
  }, [enqueuePersistenceTaskInner]);

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

  const getHydratedProgress = useCallback(async (): Promise<UserProgress[]> => {
    const cachedProgress = queryClient.getQueryData<UserProgress[]>(['progress']);
    if (cachedProgress != null) {
      return cachedProgress;
    }

    const hydratedProgress = await loadProgressSnapshot();
    queryClient.setQueryData(['progress'], hydratedProgress);
    return hydratedProgress;
  }, [queryClient]);

  const deckCategories = useMemo(
    () => mergeDeckCategoryLibraries(
      categoriesQuery.data ?? DEFAULT_DECK_CATEGORY_LIBRARY,
      (decksQuery.data ?? []).map((deck) => deck.category),
    ),
    [categoriesQuery.data, decksQuery.data],
  );

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
          filteredProgress.length !== currentProgress.length
            ? persistMirroredStorage(STORAGE_KEYS.PROGRESS, STORAGE_BACKUP_KEYS.PROGRESS, filteredProgress, 'progress')
            : Promise.resolve([]),
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
  }, [enqueuePersistenceTask, getHydratedDecks, getHydratedHiddenDeckIds, getHydratedProgress, queryClient, saveDecksMutateAsync, saveHiddenDeckIdsMutateAsync]);

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

  return useMemo(() => ({
    decks: decksQuery.data ?? [],
    deckCategories,
    isLoading: decksQuery.isLoading || categoriesQuery.isLoading || hiddenDeckIdsQuery.isLoading,
    addDeck,
    updateDeck,
    updateFlashcard,
    deleteFlashcard,
    deleteDeck,
    reorderDecks,
    createDeckCategory,
    renameDeckCategory,
    deleteDeckCategory,
  }), [
    decksQuery.data,
    deckCategories,
    decksQuery.isLoading,
    categoriesQuery.isLoading,
    hiddenDeckIdsQuery.isLoading,
    addDeck,
    updateDeck,
    updateFlashcard,
    deleteFlashcard,
    deleteDeck,
    reorderDecks,
    createDeckCategory,
    renameDeckCategory,
    deleteDeckCategory,
  ]);
});
