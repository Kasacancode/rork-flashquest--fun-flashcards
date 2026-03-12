import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, useMemo, useCallback, useEffect, useRef } from 'react';

import type { RoomSettings, SanitizedRoom } from '@/backend/arena/types';
import { useAvatar } from '@/context/AvatarContext';
import { trpc } from '@/lib/trpc';
import type { ArenaLeaderboardEntry } from '@/types/arena';
import { logger } from '@/utils/logger';

const LEADERBOARD_KEY = 'flashquest_arena_leaderboard';
const PLAYER_NAME_KEY = 'flashquest_arena_player_name';

const POLL_LOBBY_MS = 2500;
const POLL_QUESTION_MS = 850;
const POLL_REVEAL_MS = 1200;
const POLL_FINISHED_MS = 10000;
const HEARTBEAT_INTERVAL_MS = 3000;

type PendingDeckSelection = {
  deckId: string;
  deckName: string;
};

export const [ArenaProvider, useArena] = createContextHook(() => {
  const queryClient = useQueryClient();
  const { selectedIdentityKey } = useAvatar();

  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [playerName, setPlayerName] = useState<string>('');
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [leaderboard, setLeaderboard] = useState<ArenaLeaderboardEntry[]>([]);
  const [optimisticSettings, setOptimisticSettings] = useState<Partial<RoomSettings> | null>(null);
  const [optimisticDeckSelection, setOptimisticDeckSelection] = useState<PendingDeckSelection | null>(null);
  const [hasAnsweredCurrent, setHasAnsweredCurrent] = useState(false);
  const [lastAnswerCorrect, setLastAnswerCorrect] = useState<boolean | null>(null);
  const prevQuestionIndexRef = useRef<number>(-1);
  const pollFailCountRef = useRef<number>(0);
  const connectedAtRef = useRef<number>(0);
  const lastErrorMsgRef = useRef<string | null>(null);
  const heartbeatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const MAX_POLL_FAILURES = 20;
  const GRACE_PERIOD_MS = 20000;

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

  const [pollInterval, setPollInterval] = useState<number>(POLL_LOBBY_MS);
  const lastVersionRef = useRef<number>(0);

  const roomQuery = trpc.arena.getRoomState.useQuery(
    { roomCode: roomCode!, playerId: playerId! },
    {
      enabled: !!roomCode && !!playerId,
      refetchInterval: pollInterval,
      retry: 8,
      retryDelay: 2000,
    },
  );

  useEffect(() => {
    if (roomQuery.data && roomCode) {
      pollFailCountRef.current = 0;
    }
  }, [roomQuery.data, roomCode]);

  useEffect(() => {
    if (roomQuery.error && roomCode) {
      const msg = roomQuery.error.message;
      const timeSinceConnect = Date.now() - connectedAtRef.current;
      if (timeSinceConnect < GRACE_PERIOD_MS) {
        logger.log('[Arena] Poll error during grace period, ignoring:', msg);
        return;
      }
      if (msg !== lastErrorMsgRef.current) {
        pollFailCountRef.current = 1;
        lastErrorMsgRef.current = msg;
      } else {
        pollFailCountRef.current += 1;
      }
      logger.log('[Arena] Poll error (attempt', pollFailCountRef.current, '/', MAX_POLL_FAILURES, '):', msg);
      if (pollFailCountRef.current >= MAX_POLL_FAILURES) {
        logger.log('[Arena] Max poll failures reached, disconnecting');
        setRoomCode(null);
        setPlayerId(null);
        setConnectionError('Room expired or not found');
        pollFailCountRef.current = 0;
        lastErrorMsgRef.current = null;
      }
    }
  }, [roomQuery.error, roomCode]);

  const serverRoom = roomQuery.data?.room ?? null;
  const room = useMemo<SanitizedRoom | null>(() => {
    if (!serverRoom) {
      return null;
    }

    if (!optimisticSettings && !optimisticDeckSelection) {
      return serverRoom;
    }

    return {
      ...serverRoom,
      deckId: optimisticDeckSelection?.deckId ?? serverRoom.deckId,
      deckName: optimisticDeckSelection?.deckName ?? serverRoom.deckName,
      settings: optimisticSettings
        ? {
            ...serverRoom.settings,
            ...optimisticSettings,
          }
        : serverRoom.settings,
    };
  }, [optimisticDeckSelection, optimisticSettings, serverRoom]);
  const isHost = room !== null && room.hostId === playerId;
  const myPlayer = room?.players.find((p: { id: string }) => p.id === playerId) ?? null;

  const roomVersion = room?.version ?? null;
  const roomUpdatedAt = room?.updatedAt ?? null;

  useEffect(() => {
    if (!room) {
      setPollInterval(POLL_LOBBY_MS);
      return;
    }

    const incomingVersion = room.version ?? 0;
    if (incomingVersion > 0 && incomingVersion < lastVersionRef.current) {
      logger.log('[Arena] Ignoring stale room data, version:', incomingVersion, '< last:', lastVersionRef.current);
      return;
    }
    lastVersionRef.current = incomingVersion;

    if (room.status === 'lobby') {
      setPollInterval(POLL_LOBBY_MS);
    } else if (room.status === 'finished') {
      setPollInterval(POLL_FINISHED_MS);
    } else if (room.game) {
      const phase = room.game.phase;
      if (phase === 'question') {
        setPollInterval(POLL_QUESTION_MS);
      } else if (phase === 'reveal') {
        setPollInterval(POLL_REVEAL_MS);
      } else if (phase === 'finished') {
        setPollInterval(POLL_FINISHED_MS);
      } else {
        setPollInterval(POLL_LOBBY_MS);
      }
    } else {
      setPollInterval(POLL_LOBBY_MS);
    }
  }, [room]);

  const heartbeatMut = trpc.arena.heartbeat.useMutation();

  useEffect(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }

    if (roomCode && playerId) {
      heartbeatIntervalRef.current = setInterval(() => {
        heartbeatMut.mutate({ roomCode, playerId });
      }, HEARTBEAT_INTERVAL_MS);
    }

    return () => {
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }
    };
  }, [roomCode, playerId, heartbeatMut]);

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
  }, [room?.game, playerId]);

  const createRoomMut = trpc.arena.initRoom.useMutation({
    onSuccess: (data: { roomCode: string; playerId: string }) => {
      logger.log('[Arena] Created room:', data.roomCode);
      connectedAtRef.current = Date.now();
      pollFailCountRef.current = 0;
      lastErrorMsgRef.current = null;
      setRoomCode(data.roomCode);
      setPlayerId(data.playerId);
      setConnectionError(null);
    },
    onError: (err: { message: string }) => {
      logger.log('[Arena] Create error:', err.message);
      setConnectionError(err.message);
    },
  });

  const joinRoomMut = trpc.arena.joinRoom.useMutation({
    onSuccess: (data: { playerId: string; room: { code: string } }) => {
      logger.log('[Arena] Joined room:', data.room.code);
      connectedAtRef.current = Date.now();
      pollFailCountRef.current = 0;
      lastErrorMsgRef.current = null;
      setRoomCode(data.room.code);
      setPlayerId(data.playerId);
      setConnectionError(null);
    },
    onError: (err: { message: string }) => {
      logger.log('[Arena] Join error:', err.message);
      setConnectionError(err.message);
    },
  });

  const leaveMut = trpc.arena.leaveRoom.useMutation();
  const selectDeckMut = trpc.arena.selectDeck.useMutation({
    onSuccess: () => {
      logger.log('[Arena] Deck selection saved');
      void roomQuery.refetch();
    },
    onError: (err: { message: string }) => {
      logger.log('[Arena] Select deck error:', err.message);
      setOptimisticDeckSelection(null);
      setConnectionError(err.message);
    },
  });
  const updateSettingsMut = trpc.arena.updateSettings.useMutation({
    onError: (err: { message: string }) => {
      logger.log('[Arena] Update settings error:', err.message);
      setOptimisticSettings(null);
      setConnectionError(err.message);
    },
  });
  const startGameMut = trpc.arena.startGame.useMutation({
    onError: (err: { message: string }) => {
      logger.log('[Arena] Start game error:', err.message);
      setConnectionError(err.message);
    },
  });
  const submitAnswerMut = trpc.arena.submitAnswer.useMutation({
    onSuccess: (data: { isCorrect: boolean }) => {
      setHasAnsweredCurrent(true);
      setLastAnswerCorrect(data.isCorrect);
      logger.log('[Arena] Answer submitted, correct:', data.isCorrect);
    },
    onError: (err: { message: string }) => {
      logger.log('[Arena] Submit error:', err.message);
    },
  });
  const removePlayerMut = trpc.arena.removePlayer.useMutation();
  const resetRoomMut = trpc.arena.resetRoom.useMutation();

  const createRoom = useCallback((name: string) => {
    setPlayerName(name);
    setConnectionError(null);
    setOptimisticSettings(null);
    setOptimisticDeckSelection(null);
    pollFailCountRef.current = 0;
    lastErrorMsgRef.current = null;
    connectedAtRef.current = Date.now();
    AsyncStorage.setItem(PLAYER_NAME_KEY, name).catch(() => {});
    createRoomMut.mutate({ name, preferredIdentityKey: selectedIdentityKey });
  }, [createRoomMut, selectedIdentityKey]);

  const joinRoom = useCallback((code: string, name: string) => {
    setPlayerName(name);
    setConnectionError(null);
    setOptimisticSettings(null);
    setOptimisticDeckSelection(null);
    pollFailCountRef.current = 0;
    lastErrorMsgRef.current = null;
    connectedAtRef.current = Date.now();
    AsyncStorage.setItem(PLAYER_NAME_KEY, name).catch(() => {});
    joinRoomMut.mutate({ roomCode: code, playerName: name, preferredIdentityKey: selectedIdentityKey });
  }, [joinRoomMut, selectedIdentityKey]);

  const disconnect = useCallback(() => {
    if (roomCode && playerId) {
      leaveMut.mutate({ roomCode, playerId });
    }
    setRoomCode(null);
    setPlayerId(null);
    setConnectionError(null);
    setOptimisticSettings(null);
    setOptimisticDeckSelection(null);
    setHasAnsweredCurrent(false);
    setLastAnswerCorrect(null);
    prevQuestionIndexRef.current = -1;
    pollFailCountRef.current = 0;
    lastErrorMsgRef.current = null;
    connectedAtRef.current = 0;
    lastVersionRef.current = 0;
    logger.log('[Arena] Disconnected');
  }, [roomCode, playerId, leaveMut]);

  const selectDeck = useCallback((deckId: string, deckName: string) => {
    if (!roomCode || !playerId) return;
    setConnectionError(null);
    setOptimisticDeckSelection({ deckId, deckName });
    logger.log('[Arena] Selecting deck:', deckId, deckName);
    selectDeckMut.mutate({ roomCode, playerId, deckId, deckName });
  }, [roomCode, playerId, selectDeckMut]);

  const updateSettings = useCallback((settings: { rounds?: number; timerSeconds?: number; showExplanationsAtEnd?: boolean }) => {
    if (!roomCode || !playerId) return;

    if (serverRoom?.settings) {
      setOptimisticSettings((previousSettings) => ({
        ...serverRoom.settings,
        ...previousSettings,
        ...settings,
      }));
    }

    logger.log('[Arena] Updating settings:', settings);
    updateSettingsMut.mutate({ roomCode, playerId, settings });
  }, [roomCode, playerId, serverRoom?.settings, updateSettingsMut]);

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

  useEffect(() => {
    if (!roomCode) {
      setOptimisticSettings(null);
      return;
    }

    if (!serverRoom?.settings || !optimisticSettings) {
      return;
    }

    const serverCaughtUp = Object.entries(optimisticSettings).every(([key, value]) => {
      const typedKey = key as keyof RoomSettings;
      return serverRoom.settings[typedKey] === value;
    });

    if (serverCaughtUp) {
      setOptimisticSettings(null);
    }
  }, [optimisticSettings, roomCode, serverRoom?.settings]);

  useEffect(() => {
    if (!roomCode) {
      setOptimisticDeckSelection(null);
      return;
    }

    if (!optimisticDeckSelection) {
      return;
    }

    const serverCaughtUp = serverRoom?.deckId === optimisticDeckSelection.deckId
      && serverRoom?.deckName === optimisticDeckSelection.deckName;

    if (serverCaughtUp) {
      setOptimisticDeckSelection(null);
    }
  }, [optimisticDeckSelection, roomCode, serverRoom?.deckId, serverRoom?.deckName]);

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
    isSelectingDeck: selectDeckMut.isPending,
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
    roomVersion,
    roomUpdatedAt,
  }), [
    roomCode, playerId, playerName, connectionError,
    room, isHost, myPlayer, hasAnsweredCurrent, lastAnswerCorrect,
    canStartGame,
    createRoomMut.isPending, joinRoomMut.isPending,
    selectDeckMut.isPending, startGameMut.isPending, submitAnswerMut.isPending,
    createRoom, joinRoom, disconnect, selectDeck, updateSettings,
    startGame, submitAnswer, removePlayer, resetRoom,
    leaderboard, saveMatchResult, cleanupDeck, leaderboardQuery.isLoading,
    clearError, roomVersion, roomUpdatedAt,
  ]);
});
