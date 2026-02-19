import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, useMemo, useCallback, useEffect, useRef } from 'react';

import { trpc } from '@/lib/trpc';
import type { ArenaLeaderboardEntry } from '@/types/flashcard';
import { logger } from '@/utils/logger';

const LEADERBOARD_KEY = 'flashquest_arena_leaderboard';
const PLAYER_NAME_KEY = 'flashquest_arena_player_name';

export const [ArenaProvider, useArena] = createContextHook(() => {
  const queryClient = useQueryClient();

  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [playerName, setPlayerName] = useState<string>('');
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [leaderboard, setLeaderboard] = useState<ArenaLeaderboardEntry[]>([]);
  const [hasAnsweredCurrent, setHasAnsweredCurrent] = useState(false);
  const [lastAnswerCorrect, setLastAnswerCorrect] = useState<boolean | null>(null);
  const prevQuestionIndexRef = useRef<number>(-1);

  useQuery({
    queryKey: ['arena-player-name'],
    queryFn: async () => {
      const stored = await AsyncStorage.getItem(PLAYER_NAME_KEY);
      if (stored) setPlayerName(stored);
      return stored || '';
    },
  });

  const leaderboardQuery = useQuery({
    queryKey: ['arena-leaderboard'],
    queryFn: async () => {
      const stored = await AsyncStorage.getItem(LEADERBOARD_KEY);
      return stored ? (JSON.parse(stored) as ArenaLeaderboardEntry[]) : [];
    },
  });

  useEffect(() => {
    if (leaderboardQuery.data) setLeaderboard(leaderboardQuery.data);
  }, [leaderboardQuery.data]);

  const saveLeaderboardMut = useMutation({
    mutationFn: async (entries: ArenaLeaderboardEntry[]) => {
      await AsyncStorage.setItem(LEADERBOARD_KEY, JSON.stringify(entries));
      return entries;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['arena-leaderboard'] }),
  });

  const roomQuery = trpc.arena.getRoomState.useQuery(
    { roomCode: roomCode!, playerId: playerId! },
    {
      enabled: !!roomCode && !!playerId,
      refetchInterval: 1500,
      retry: 2,
    },
  );

  useEffect(() => {
    if (roomQuery.error) {
      const msg = roomQuery.error.message;
      logger.log('[Arena] Poll error:', msg);
      if (msg.includes('not found') || msg.includes('expired')) {
        setRoomCode(null);
        setPlayerId(null);
        setConnectionError('Room expired or not found');
      }
    }
  }, [roomQuery.error]);

  const room = roomQuery.data?.room ?? null;
  const isHost = room !== null && room.hostId === playerId;
  const myPlayer = room?.players.find((p: any) => p.id === playerId) ?? null;

  const currentQuestionIndex = room?.game?.currentQuestionIndex ?? -1;
  useEffect(() => {
    if (currentQuestionIndex !== prevQuestionIndexRef.current) {
      prevQuestionIndexRef.current = currentQuestionIndex;
      setHasAnsweredCurrent(false);
      setLastAnswerCorrect(null);
    }
  }, [currentQuestionIndex]);

  useEffect(() => {
    if (room?.game && playerId && room.game.answeredPlayerIds.includes(playerId)) {
      setHasAnsweredCurrent(true);
    }
  }, [room?.game?.answeredPlayerIds, playerId]);

  const createRoomMut = trpc.arena.initRoom.useMutation({
    onSuccess: (data: any) => {
      logger.log('[Arena] Created room:', data.roomCode);
      setRoomCode(data.roomCode);
      setPlayerId(data.playerId);
      setConnectionError(null);
    },
    onError: (err: any) => {
      logger.log('[Arena] Create error:', err.message);
      setConnectionError(err.message);
    },
  });

  const joinRoomMut = trpc.arena.joinRoom.useMutation({
    onSuccess: (data: any) => {
      logger.log('[Arena] Joined room:', data.room.code);
      setRoomCode(data.room.code);
      setPlayerId(data.playerId);
      setConnectionError(null);
    },
    onError: (err: any) => {
      logger.log('[Arena] Join error:', err.message);
      setConnectionError(err.message);
    },
  });

  const leaveMut = trpc.arena.leaveRoom.useMutation();
  const selectDeckMut = trpc.arena.selectDeck.useMutation();
  const updateSettingsMut = trpc.arena.updateSettings.useMutation();
  const startGameMut = trpc.arena.startGame.useMutation({
    onError: (err: any) => {
      logger.log('[Arena] Start game error:', err.message);
      setConnectionError(err.message);
    },
  });
  const submitAnswerMut = trpc.arena.submitAnswer.useMutation({
    onSuccess: (data: any) => {
      setHasAnsweredCurrent(true);
      setLastAnswerCorrect(data.isCorrect);
      logger.log('[Arena] Answer submitted, correct:', data.isCorrect);
    },
    onError: (err: any) => {
      logger.log('[Arena] Submit error:', err.message);
    },
  });
  const removePlayerMut = trpc.arena.removePlayer.useMutation();
  const resetRoomMut = trpc.arena.resetRoom.useMutation();

  const createRoom = useCallback((name: string) => {
    setPlayerName(name);
    AsyncStorage.setItem(PLAYER_NAME_KEY, name).catch(() => {});
    createRoomMut.mutate({ name });
  }, [createRoomMut]);

  const joinRoom = useCallback((code: string, name: string) => {
    setPlayerName(name);
    AsyncStorage.setItem(PLAYER_NAME_KEY, name).catch(() => {});
    joinRoomMut.mutate({ roomCode: code, playerName: name });
  }, [joinRoomMut]);

  const disconnect = useCallback(() => {
    if (roomCode && playerId) {
      leaveMut.mutate({ roomCode, playerId });
    }
    setRoomCode(null);
    setPlayerId(null);
    setConnectionError(null);
    setHasAnsweredCurrent(false);
    setLastAnswerCorrect(null);
    prevQuestionIndexRef.current = -1;
    logger.log('[Arena] Disconnected');
  }, [roomCode, playerId, leaveMut]);

  const selectDeck = useCallback((deckId: string, deckName: string) => {
    if (!roomCode || !playerId) return;
    selectDeckMut.mutate({ roomCode, playerId, deckId, deckName });
  }, [roomCode, playerId, selectDeckMut]);

  const updateSettings = useCallback((settings: { rounds?: number; timerSeconds?: number; showExplanationsAtEnd?: boolean }) => {
    if (!roomCode || !playerId) return;
    updateSettingsMut.mutate({ roomCode, playerId, settings });
  }, [roomCode, playerId, updateSettingsMut]);

  const startGame = useCallback((questions: Array<{ cardId: string; question: string; correctAnswer: string; options: string[] }>) => {
    if (!roomCode || !playerId) return;
    startGameMut.mutate({ roomCode, playerId, questions });
  }, [roomCode, playerId, startGameMut]);

  const submitAnswer = useCallback((questionIndex: number, selectedOption: string) => {
    if (!roomCode || !playerId || hasAnsweredCurrent) return;
    submitAnswerMut.mutate({ roomCode, playerId, questionIndex, selectedOption });
  }, [roomCode, playerId, hasAnsweredCurrent, submitAnswerMut]);

  const removePlayer = useCallback((targetPlayerId: string) => {
    if (!roomCode || !playerId) return;
    removePlayerMut.mutate({ roomCode, playerId, targetPlayerId });
  }, [roomCode, playerId, removePlayerMut]);

  const resetRoom = useCallback(() => {
    if (!roomCode || !playerId) return;
    resetRoomMut.mutate({ roomCode, playerId });
  }, [roomCode, playerId, resetRoomMut]);

  const saveMatchResult = useCallback((entry: ArenaLeaderboardEntry) => {
    const updated = [entry, ...leaderboard].slice(0, 50);
    setLeaderboard(updated);
    saveLeaderboardMut.mutate(updated);
  }, [leaderboard, saveLeaderboardMut]);

  const canStartGame = useMemo(() => {
    if (!room || !isHost) return false;
    return room.players.length >= 2 && room.deckId !== null;
  }, [room, isHost]);

  const cleanupDeck = useCallback((deckId: string) => {
    logger.log('[Arena] Cleaning up leaderboard entries for deleted deck:', deckId);
    setLeaderboard(prev => {
      const filtered = prev.filter(entry => entry.deckId !== deckId);
      if (filtered.length !== prev.length) {
        saveLeaderboardMut.mutate(filtered);
        logger.log('[Arena] Removed', prev.length - filtered.length, 'leaderboard entries');
      }
      return filtered;
    });
  }, [saveLeaderboardMut]);

  const clearError = useCallback(() => setConnectionError(null), []);

  return useMemo(() => ({
    roomCode,
    playerId,
    playerName,
    connectionError,
    room,
    isHost,
    myPlayer,
    hasAnsweredCurrent,
    lastAnswerCorrect,
    canStartGame,
    isConnecting: createRoomMut.isPending || joinRoomMut.isPending,
    isStartingGame: startGameMut.isPending,
    isSubmitting: submitAnswerMut.isPending,
    createRoom,
    joinRoom,
    disconnect,
    selectDeck,
    updateSettings,
    startGame,
    submitAnswer,
    removePlayer,
    resetRoom,
    leaderboard,
    saveMatchResult,
    cleanupDeck,
    isLoading: leaderboardQuery.isLoading,
    clearError,
  }), [
    roomCode, playerId, playerName, connectionError,
    room, isHost, myPlayer, hasAnsweredCurrent, lastAnswerCorrect,
    canStartGame,
    createRoomMut.isPending, joinRoomMut.isPending,
    startGameMut.isPending, submitAnswerMut.isPending,
    createRoom, joinRoom, disconnect, selectDeck, updateSettings,
    startGame, submitAnswer, removePlayer, resetRoom,
    leaderboard, saveMatchResult, cleanupDeck, leaderboardQuery.isLoading,
    clearError,
  ]);
});
