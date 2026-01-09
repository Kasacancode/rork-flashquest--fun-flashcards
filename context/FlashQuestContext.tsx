// ============================================
// FLASHQUEST CONTEXT - Main App State Management
// ============================================
// This file manages all the app's data: decks, progress, stats, and duels
// It uses AsyncStorage to save data on the device (persists even after closing app)
// It uses React Query to manage data fetching, caching, and mutations

// ============================================
// IMPORTS
// ============================================
// AsyncStorage - saves data to device storage (like a database)
import AsyncStorage from '@react-native-async-storage/async-storage';
// createContextHook - creates a provider to share data across all screens
import createContextHook from '@nkzw/create-context-hook';
// React Query - manages data fetching, caching, and updates
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
// React hooks for optimization
import { useState, useMemo, useCallback } from 'react';

// Import sample decks (pre-made flashcard collections)
import { SAMPLE_DECKS } from '@/data/sampleDecks';
// Import TypeScript types for data structures
import { Deck, UserProgress, UserStats, DuelSession } from '@/types/flashcard';

// ============================================
// STORAGE KEYS
// ============================================
// Keys used to save/load data from device storage
// Think of these as labels for different boxes of data
const STORAGE_KEYS = {
  DECKS: 'flashquest_decks',           // Stores all flashcard decks
  PROGRESS: 'flashquest_progress',     // Stores study progress for each deck
  STATS: 'flashquest_stats',           // Stores overall user statistics
};

// ============================================
// DEFAULT STATISTICS
// ============================================
// Starting values for a new user's stats
const DEFAULT_STATS: UserStats = {
  totalScore: 0,              // No points yet
  currentStreak: 0,           // No study streak yet
  longestStreak: 0,           // No longest streak yet
  totalCardsStudied: 0,       // Haven't studied any cards
  totalDecksCompleted: 0,     // Haven't completed any decks
  achievements: [],           // No achievements earned
  lastActiveDate: new Date().toISOString().split('T')[0], // Today's date
};

// ============================================
// FLASHQUEST PROVIDER & HOOK
// ============================================
// Creates the main provider for the app and a hook to access the data
// Usage: Wrap app with <FlashQuestProvider>, then call useFlashQuest() anywhere
export const [FlashQuestProvider, useFlashQuest] = createContextHook(() => {
  // Get query client to manage cache and invalidate data when needed
  const queryClient = useQueryClient();
  
  // Track the current duel session (null means no duel is active)
  const [currentDuel, setCurrentDuel] = useState<DuelSession | null>(null);

  // ============================================
  // LOAD DECKS FROM STORAGE
  // ============================================
  // useQuery automatically loads and caches deck data
  // On first load, it returns sample decks if no saved data exists
  const decksQuery = useQuery({
    queryKey: ['decks'],  // Unique identifier for this data
    queryFn: async () => {
      // Try to load saved decks from device storage
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.DECKS);
      if (stored) {
        // Parse the JSON string back into JavaScript objects
        return JSON.parse(stored) as Deck[];
      }
      // If no saved decks, use the pre-made sample decks
      return SAMPLE_DECKS;
    },
  });

  // ============================================
  // LOAD PROGRESS FROM STORAGE
  // ============================================
  // Loads user's study progress for each deck
  const progressQuery = useQuery({
    queryKey: ['progress'],  // Unique identifier
    queryFn: async () => {
      // Try to load saved progress
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.PROGRESS);
      // Return saved progress or empty array if none exists
      return stored ? (JSON.parse(stored) as UserProgress[]) : [];
    },
  });

  // ============================================
  // LOAD STATS FROM STORAGE
  // ============================================
  // Loads user statistics and handles streak calculation
  const statsQuery = useQuery({
    queryKey: ['stats'],  // Unique identifier
    queryFn: async () => {
      // Try to load saved stats
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.STATS);
      if (stored) {
        const stats = JSON.parse(stored) as UserStats;
        // Get today's date in YYYY-MM-DD format
        const today = new Date().toISOString().split('T')[0];
        
        // Check if user was active yesterday to maintain streak
        if (stats.lastActiveDate !== today) {
          // Calculate yesterday's date
          const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
          // Update stats with new date and reset streak if not consecutive
          const updatedStats = {
            ...stats,
            // Keep streak if last active was yesterday, otherwise reset to 0
            currentStreak: stats.lastActiveDate === yesterday ? stats.currentStreak : 0,
            lastActiveDate: today,
          };
          return updatedStats;
        }
        return stats;
      }
      // If no saved stats, return default starting values
      return DEFAULT_STATS;
    },
  });

  // ============================================
  // SAVE DECKS TO STORAGE
  // ============================================
  // useMutation handles saving deck changes to device storage
  const saveDecksMutation = useMutation({
    mutationFn: async (decks: Deck[]) => {
      // Convert decks array to JSON string and save to storage
      await AsyncStorage.setItem(STORAGE_KEYS.DECKS, JSON.stringify(decks));
      return decks;
    },
    onSuccess: () => {
      // After successful save, tell React Query to refresh the decks data
      queryClient.invalidateQueries({ queryKey: ['decks'] });
    },
  });
  // Extract the mutation functions for easier use
  const { mutate: saveDecksMutate, mutateAsync: saveDecksMutateAsync } = saveDecksMutation;

  // ============================================
  // SAVE PROGRESS TO STORAGE
  // ============================================
  // useMutation handles saving progress changes
  const saveProgressMutation = useMutation({
    mutationFn: async (progress: UserProgress[]) => {
      // Save progress array to storage
      await AsyncStorage.setItem(STORAGE_KEYS.PROGRESS, JSON.stringify(progress));
      return progress;
    },
    onSuccess: () => {
      // Refresh progress data after successful save
      queryClient.invalidateQueries({ queryKey: ['progress'] });
    },
  });
  const { mutate: saveProgressMutate } = saveProgressMutation;

  // ============================================
  // SAVE STATS TO STORAGE
  // ============================================
  // useMutation handles saving stats changes
  const saveStatsMutation = useMutation({
    mutationFn: async (stats: UserStats) => {
      // Save stats object to storage
      await AsyncStorage.setItem(STORAGE_KEYS.STATS, JSON.stringify(stats));
      return stats;
    },
    onSuccess: () => {
      // Refresh stats data after successful save
      queryClient.invalidateQueries({ queryKey: ['stats'] });
    },
  });
  const { mutate: saveStatsMutate } = saveStatsMutation;

  // ============================================
  // ADD NEW DECK
  // ============================================
  // Function to add a new deck to the collection
  // useCallback prevents recreating this function on every render (optimization)
  const addDeck = useCallback((deck: Deck) => {
    // Get current decks or empty array if none
    const currentDecks = decksQuery.data || [];
    // Add new deck to the end of the array and save
    saveDecksMutate([...currentDecks, deck]);
  }, [decksQuery.data, saveDecksMutate]);

  // ============================================
  // UPDATE EXISTING DECK
  // ============================================
  // Function to modify an existing deck's properties
  const updateDeck = useCallback((deckId: string, updates: Partial<Deck>) => {
    const currentDecks = decksQuery.data || [];
    // Map through decks and update the one that matches the ID
    const updatedDecks = currentDecks.map(deck => 
      // If this deck matches the ID, merge in the updates
      deck.id === deckId ? { ...deck, ...updates } : deck
    );
    // Save the updated decks array
    saveDecksMutate(updatedDecks);
  }, [decksQuery.data, saveDecksMutate]);

  // ============================================
  // DELETE DECK
  // ============================================
  // Function to remove a deck and its associated progress
  // Uses optimistic updates for instant UI feedback
  const deleteDeck = useCallback(async (deckId: string) => {
    console.log('[Context] Starting delete for deck:', deckId);
    const currentDecks = decksQuery.data || [];
    console.log('[Context] Current decks count:', currentDecks.length);

    // Filter out the deck to be deleted
    const filteredDecks = currentDecks.filter((deck) => deck.id !== deckId);
    console.log('[Context] Filtered decks count:', filteredDecks.length);

    // If no deck was removed, it wasn't found
    if (filteredDecks.length === currentDecks.length) {
      console.log('[Context] Deck not found, aborting delete');
      return currentDecks;
    }

    // Optimistically update the UI immediately (before saving to storage)
    queryClient.setQueryData(['decks'], filteredDecks);
    console.log('[Context] Optimistically updated deck cache');

    try {
      // Save the changes to device storage
      await saveDecksMutateAsync(filteredDecks);
      console.log('[Context] Persisted decks via mutation');
    } catch (error) {
      // If save fails, roll back to previous state
      console.log('[Context] Failed to persist decks, rolling back', error);
      queryClient.setQueryData(['decks'], currentDecks);
      throw error;
    }

    // Also remove any progress entries for this deck
    const currentProgress = progressQuery.data || [];
    const filteredProgress = currentProgress.filter((entry) => entry.deckId !== deckId);
    if (filteredProgress.length !== currentProgress.length) {
      console.log('[Context] Removing progress entries for deck');
      queryClient.setQueryData(['progress'], filteredProgress);
      saveProgressMutate(filteredProgress);
    }

    return filteredDecks;
  }, [decksQuery.data, progressQuery.data, queryClient, saveDecksMutateAsync, saveProgressMutate]);

  // ============================================
  // UPDATE STUDY PROGRESS
  // ============================================
  // Function to record when user completes/reviews a card (no correctness tracking)
  const updateProgress = useCallback((deckId: string) => {
    const currentProgress = progressQuery.data || [];
    const currentStats = statsQuery.data || DEFAULT_STATS;

    // Find if user has already studied this deck before
    const deckProgressIndex = currentProgress.findIndex((p) => p.deckId === deckId);
    let updatedProgress: UserProgress[];

    if (deckProgressIndex >= 0) {
      // Deck exists - update existing progress
      const existing = currentProgress[deckProgressIndex];
      updatedProgress = [...currentProgress];
      updatedProgress[deckProgressIndex] = {
        ...existing,
        // Increment cards reviewed counter
        cardsReviewed: existing.cardsReviewed + 1,
        // Update last studied timestamp
        lastStudied: Date.now(),
      };
    } else {
      // First time studying this deck - create new progress entry
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

    // Update overall user statistics
    const today = new Date().toISOString().split('T')[0];
    const updatedStats: UserStats = {
      ...currentStats,
      // Award points for completing a card review
      totalScore: currentStats.totalScore + 5,
      // Increment total cards studied counter
      totalCardsStudied: currentStats.totalCardsStudied + 1,
      // Maintain or increment streak
      currentStreak: currentStats.lastActiveDate === today ? currentStats.currentStreak : currentStats.currentStreak + 1,
      // Update longest streak if current streak is higher
      longestStreak: Math.max(currentStats.longestStreak, currentStats.currentStreak + 1),
      // Update last active date to today
      lastActiveDate: today,
    };

    // Save both progress and stats to storage
    saveProgressMutate(updatedProgress);
    saveStatsMutate(updatedStats);
  }, [progressQuery.data, statsQuery.data, saveProgressMutate, saveStatsMutate]);

  // ============================================
  // START DUEL SESSION
  // ============================================
  // Function to begin a new battle/duel with AI or another player
  const startDuel = useCallback((deckId: string, mode: 'ai' | 'multiplayer', shouldShuffle?: boolean) => {
    // Create a new duel session with initial values
    const duel: DuelSession = {
      id: `duel_${Date.now()}`,          // Unique ID based on timestamp
      mode,                               // 'ai' or 'multiplayer'
      deckId,                             // Which deck to use for questions
      playerScore: 0,                     // Player starts with 0 points
      opponentScore: 0,                   // Opponent starts with 0 points
      currentRound: 0,                    // Starting at round 0
      totalRounds: 5,                     // Best of 5 rounds
      status: 'active',                   // Duel is ongoing
      opponentName: mode === 'ai' ? 'AI Bot' : 'Opponent',
      shuffled: shouldShuffle || false,   // Are cards shuffled?
    };
    // Set this as the active duel
    setCurrentDuel(duel);
  }, []);

  // ============================================
  // UPDATE DUEL PROGRESS
  // ============================================
  // Function to update duel after each round
  const updateDuel = useCallback((playerCorrect: boolean, opponentCorrect: boolean) => {
    // Exit if no active duel
    if (!currentDuel) return;

    // Create updated duel session
    const updated: DuelSession = {
      ...currentDuel,
      // Add 1 point if player answered correctly
      playerScore: currentDuel.playerScore + (playerCorrect ? 1 : 0),
      // Add 1 point if opponent answered correctly
      opponentScore: currentDuel.opponentScore + (opponentCorrect ? 1 : 0),
      // Move to next round
      currentRound: currentDuel.currentRound + 1,
      // Mark as completed if we've reached final round
      status: currentDuel.currentRound + 1 >= currentDuel.totalRounds ? 'completed' : 'active',
      // Add completion timestamp if duel is done
      completedAt: currentDuel.currentRound + 1 >= currentDuel.totalRounds ? Date.now() : undefined,
    };

    // Update the duel state
    setCurrentDuel(updated);

    // If duel is complete, award points based on result
    if (updated.status === 'completed') {
      const currentStats = statsQuery.data || DEFAULT_STATS;
      const wonDuel = updated.playerScore > updated.opponentScore;
      const updatedStats: UserStats = {
        ...currentStats,
        // Winner gets 50 points, loser gets 20 points for participation
        totalScore: currentStats.totalScore + (wonDuel ? 50 : 20),
      };
      saveStatsMutate(updatedStats);
    }
  }, [currentDuel, statsQuery.data, saveStatsMutate]);

  // ============================================
  // END DUEL SESSION
  // ============================================
  // Function to clear the current duel (return to normal mode)
  const endDuel = useCallback(() => {
    setCurrentDuel(null);
  }, []);

  // ============================================
  // RETURN ALL DATA AND FUNCTIONS
  // ============================================
  // useMemo prevents recreating this object unless dependencies change
  // This optimization prevents unnecessary re-renders in components
  return useMemo(() => ({
    // DATA:
    decks: decksQuery.data || [],                    // All flashcard decks
    progress: progressQuery.data || [],              // Study progress per deck
    stats: statsQuery.data || DEFAULT_STATS,         // Overall user statistics
    currentDuel,                                      // Active duel session (if any)
    isLoading: decksQuery.isLoading || progressQuery.isLoading || statsQuery.isLoading,
    
    // FUNCTIONS:
    addDeck,           // Add a new deck
    updateDeck,        // Modify existing deck
    deleteDeck,        // Remove a deck
    updateProgress,    // Record study session
    startDuel,         // Begin a battle
    updateDuel,        // Update battle progress
    endDuel,           // End current battle
  }), [decksQuery.data, progressQuery.data, statsQuery.data, currentDuel, decksQuery.isLoading, progressQuery.isLoading, statsQuery.isLoading, addDeck, updateDeck, deleteDeck, updateProgress, startDuel, updateDuel, endDuel]);
});

// ============================================
// HELPER HOOK - GET SPECIFIC DECK PROGRESS
// ============================================
// Custom hook to easily get progress for a specific deck
// Usage: const deckProgress = useDeckProgress('deck-id');
export function useDeckProgress(deckId: string) {
  // Get all progress data from main context
  const { progress } = useFlashQuest();
  
  // Find and return only the progress for the requested deck
  // useMemo prevents recalculating unless progress or deckId changes
  return useMemo(
    () => progress.find((p) => p.deckId === deckId),
    [progress, deckId]
  );
}
