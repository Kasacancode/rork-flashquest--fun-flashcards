import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useMemo, useCallback, useEffect } from 'react';

import {
  ArenaPlayer,
  ArenaSettings,
  ArenaLobbyState,
  ArenaMatchResult,
  ArenaLeaderboardEntry,
} from '@/types/flashcard';
import { logger } from '@/utils/logger';

// AsyncStorage keys for battle leaderboard and last-used settings
const LEADERBOARD_KEY = 'flashquest_arena_leaderboard';
const LAST_SETTINGS_KEY = 'flashquest_arena_last_settings';

// Rotating colors assigned to players as they join the lobby
const PLAYER_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
  '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F',
  '#BB8FCE', '#85C1E9', '#F8B500', '#00CED1',
];

const DEFAULT_SETTINGS: ArenaSettings = {
  rounds: 10,
  timerSeconds: 0,
  showExplanationsAtEnd: true,
};

// 6-digit code displayed in lobby (cosmetic only, no networking)
const generateRoomCode = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

const generatePlayerId = (): string => {
  return `player_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

export const [ArenaProvider, useArena] = createContextHook(() => {
  const queryClient = useQueryClient();

  const [lobby, setLobby] = useState<ArenaLobbyState | null>(null);
  const [leaderboard, setLeaderboard] = useState<ArenaLeaderboardEntry[]>([]);

  const leaderboardQuery = useQuery({
    queryKey: ['arena-leaderboard'],
    queryFn: async () => {
      logger.log('[Arena] Loading leaderboard from storage');
      const stored = await AsyncStorage.getItem(LEADERBOARD_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as ArenaLeaderboardEntry[];
        logger.log('[Arena] Loaded', parsed.length, 'leaderboard entries');
        return parsed;
      }
      return [];
    },
  });

  const lastSettingsQuery = useQuery({
    queryKey: ['arena-last-settings'],
    queryFn: async () => {
      const stored = await AsyncStorage.getItem(LAST_SETTINGS_KEY);
      if (stored) {
        return JSON.parse(stored) as { deckId: string; settings: ArenaSettings };
      }
      return null;
    },
  });

  // Sync query data into local state to allow optimistic updates via setLeaderboard
  useEffect(() => {
    if (leaderboardQuery.data) {
      setLeaderboard(leaderboardQuery.data);
    }
  }, [leaderboardQuery.data]);

  const saveLeaderboardMutation = useMutation({
    mutationFn: async (entries: ArenaLeaderboardEntry[]) => {
      logger.log('[Arena] Saving leaderboard');
      await AsyncStorage.setItem(LEADERBOARD_KEY, JSON.stringify(entries));
      return entries;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['arena-leaderboard'] });
    },
  });
  const { mutate: saveLeaderboard } = saveLeaderboardMutation;

  const saveLastSettingsMutation = useMutation({
    mutationFn: async (data: { deckId: string; settings: ArenaSettings }) => {
      await AsyncStorage.setItem(LAST_SETTINGS_KEY, JSON.stringify(data));
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['arena-last-settings'] });
    },
  });
  const { mutate: saveLastSettingsMutate } = saveLastSettingsMutation;

  const createRoom = useCallback((hostName: string): ArenaLobbyState => {
    logger.log('[Arena] Creating room with host:', hostName);
    const roomCode = generateRoomCode();
    const hostPlayer: ArenaPlayer = {
      id: generatePlayerId(),
      name: hostName,
      isHost: true,
      color: PLAYER_COLORS[0],
    };

    const newLobby: ArenaLobbyState = {
      roomCode,
      players: [hostPlayer],
      deckId: null,
      settings: { ...DEFAULT_SETTINGS },
    };

    setLobby(newLobby);
    return newLobby;
  }, []);

  const joinRoom = useCallback((playerName: string, _roomCode?: string): ArenaPlayer | null => {
    logger.log('[Arena] Player joining:', playerName);
    
    setLobby(prev => {
      if (!prev) {
        logger.log('[Arena] No lobby exists, creating new one');
        const roomCode = _roomCode || generateRoomCode();
        const newPlayer: ArenaPlayer = {
          id: generatePlayerId(),
          name: playerName,
          isHost: true,
          color: PLAYER_COLORS[0],
        };
        return {
          roomCode,
          players: [newPlayer],
          deckId: null,
          settings: { ...DEFAULT_SETTINGS },
        };
      }

      const colorIndex = prev.players.length % PLAYER_COLORS.length;
      const newPlayer: ArenaPlayer = {
        id: generatePlayerId(),
        name: playerName,
        isHost: false,
        color: PLAYER_COLORS[colorIndex],
      };

      return {
        ...prev,
        players: [...prev.players, newPlayer],
      };
    });

    return null;
  }, []);

  const addPlayer = useCallback((playerName: string): ArenaPlayer | null => {
    if (!lobby) return null;

    const colorIndex = lobby.players.length % PLAYER_COLORS.length;
    const newPlayer: ArenaPlayer = {
      id: generatePlayerId(),
      name: playerName,
      isHost: false,
      color: PLAYER_COLORS[colorIndex],
    };

    setLobby(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        players: [...prev.players, newPlayer],
      };
    });

    logger.log('[Arena] Added player:', playerName);
    return newPlayer;
  }, [lobby]);

  const removePlayer = useCallback((playerId: string) => {
    setLobby(prev => {
      if (!prev) return prev;
      const player = prev.players.find(p => p.id === playerId);
      if (player?.isHost) {
        logger.log('[Arena] Cannot remove host');
        return prev;
      }
      return {
        ...prev,
        players: prev.players.filter(p => p.id !== playerId),
      };
    });
  }, []);

  const updatePlayerName = useCallback((playerId: string, newName: string) => {
    setLobby(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        players: prev.players.map(p =>
          p.id === playerId ? { ...p, name: newName } : p
        ),
      };
    });
  }, []);

  const selectDeck = useCallback((deckId: string) => {
    setLobby(prev => {
      if (!prev) return prev;
      return { ...prev, deckId };
    });
  }, []);

  const updateSettings = useCallback((updates: Partial<ArenaSettings>) => {
    setLobby(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        settings: { ...prev.settings, ...updates },
      };
    });
  }, []);

  const saveMatchResult = useCallback((result: ArenaMatchResult, deckName: string) => {
    const winner = result.playerResults.reduce((best, current) =>
      current.points > best.points ? current : best
    );

    const entry: ArenaLeaderboardEntry = {
      id: `arena_${Date.now()}`,
      deckId: result.deckId,
      deckName,
      winnerName: winner.playerName,
      winnerPoints: winner.points,
      winnerAccuracy: winner.accuracy,
      playerCount: result.playerResults.length,
      rounds: result.totalRounds,
      timerSeconds: result.settings.timerSeconds,
      completedAt: result.completedAt,
    };

    // Keep only the 50 most recent entries to bound storage size
    const updatedLeaderboard = [entry, ...leaderboard].slice(0, 50);
    setLeaderboard(updatedLeaderboard);
    saveLeaderboard(updatedLeaderboard);

    logger.log('[Arena] Saved match result, winner:', winner.playerName);
  }, [leaderboard, saveLeaderboard]);

  const saveLastSettings = useCallback((deckId: string, settings: ArenaSettings) => {
    saveLastSettingsMutate({ deckId, settings });
  }, [saveLastSettingsMutate]);

  const clearLobby = useCallback(() => {
    setLobby(null);
  }, []);

  const canStartGame = useMemo(() => {
    if (!lobby) return false;
    return lobby.players.length >= 2 && lobby.deckId !== null;
  }, [lobby]);

  const cleanupDeck = useCallback((deckId: string) => {
    logger.log('[Arena] Cleaning up leaderboard entries for deleted deck:', deckId);
    setLeaderboard(prev => {
      const filtered = prev.filter(entry => entry.deckId !== deckId);
      if (filtered.length !== prev.length) {
        saveLeaderboard(filtered);
        logger.log('[Arena] Removed', prev.length - filtered.length, 'leaderboard entries');
      }
      return filtered;
    });
  }, [saveLeaderboard]);

  return useMemo(() => ({
    lobby,
    leaderboard,
    lastSettings: lastSettingsQuery.data,
    isLoading: leaderboardQuery.isLoading,
    canStartGame,
    createRoom,
    joinRoom,
    addPlayer,
    removePlayer,
    updatePlayerName,
    selectDeck,
    updateSettings,
    saveMatchResult,
    saveLastSettings,
    clearLobby,
    cleanupDeck,
  }), [
    lobby,
    leaderboard,
    lastSettingsQuery.data,
    leaderboardQuery.isLoading,
    canStartGame,
    createRoom,
    joinRoom,
    addPlayer,
    removePlayer,
    updatePlayerName,
    selectDeck,
    updateSettings,
    saveMatchResult,
    saveLastSettings,
    clearLobby,
    cleanupDeck,
  ]);
});
