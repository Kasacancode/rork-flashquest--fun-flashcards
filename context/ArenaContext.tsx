import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, useMemo, useCallback, useEffect, useRef } from 'react';

import type { RoomSettings, SanitizedRoom } from '@/backend/arena/types';
import { useAvatar } from '@/context/AvatarContext';
import { trackEvent, trackEvents } from '@/lib/analytics';
import { trpc } from '@/lib/trpc';
import type { ArenaLeaderboardEntry } from '@/types/arena';
import { GAME_MODE } from '@/types/game';
import { logger } from '@/utils/logger';
import { sanitizePlayerName } from '@/utils/playerName';

const LEADERBOARD_KEY = 'flashquest_arena_leaderboard';
const PLAYER_NAME_KEY = 'flashquest_arena_player_name';

const POLL_LOBBY_MS = 1000;
const POLL_QUESTION_MS = 350;
const POLL_REVEAL_MS = 350;
const POLL_FINISHED_MS = 2500;
const HEARTBEAT_INTERVAL_MS = 3000;

type PendingDeckSelection = {
  deckId: string;
  deckName: string;
};

type ArenaBackendErrorData = {
  backendCode?: unknown;
  code?: unknown;
};

function getArenaErrorMessage(error: unknown): string {
  if (error instanceof Error && typeof error.message === 'string') {
    return error.message;
  }

  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    return typeof message === 'string' ? message : '';
  }

  return '';
}

function getArenaBackendErrorCode(error: unknown): string | null {
  if (typeof error !== 'object' || error === null || !('data' in error)) {
    return null;
  }

  const data = (error as { data?: ArenaBackendErrorData }).data;
  return typeof data?.backendCode === 'string' ? data.backendCode : null;
}

function getArenaTrpcErrorCode(error: unknown): string | null {
  if (typeof error !== 'object' || error === null || !('data' in error)) {
    return null;
  }

  const data = (error as { data?: ArenaBackendErrorData }).data;
  return typeof data?.code === 'string' ? data.code : null;
}

function isArenaRoomNotFoundError(error: unknown): boolean {
  const trpcCode = getArenaTrpcErrorCode(error);
  const normalizedMessage = getArenaErrorMessage(error).toLowerCase();

  return trpcCode === 'NOT_FOUND'
    || normalizedMessage.includes('room not found')
    || normalizedMessage.includes('room expired');
}

function isRedisConfigArenaError(error: unknown): boolean {
  const backendCode = getArenaBackendErrorCode(error);
  const normalizedMessage = getArenaErrorMessage(error).toLowerCase();

  return backendCode === 'REDIS_CONFIG_MISSING'
    || normalizedMessage.includes('missing upstash_redis_rest_url')
    || normalizedMessage.includes('service temporarily unavailable');
}

function normalizeArenaConnectionError(error: unknown): string {
  const message = getArenaErrorMessage(error).trim();
  const normalizedMessage = message.toLowerCase();

  if (isRedisConfigArenaError(error)) {
    return __DEV__ && message ? message : 'Battle service temporarily unavailable.';
  }

  if (normalizedMessage === 'failed to fetch' || normalizedMessage.includes('network request failed')) {
    return 'Could not connect to battle service. Please try again.';
  }

  if (normalizedMessage.includes('json parse') || normalizedMessage.includes('unexpected character') || normalizedMessage.includes('unexpected token')) {
    return 'Battle service is temporarily unavailable. Please try again in a moment.';
  }

  return message || 'Could not connect to battle service.';
}

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
  const [stableRoom, setStableRoom] = useState<SanitizedRoom | null>(null);
  const prevQuestionRoundRef = useRef<string | null>(null);
  const pollFailCountRef = useRef<number>(0);
  const connectedAtRef = useRef<number>(0);
  const lastErrorMsgRef = useRef<string | null>(null);
  const heartbeatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const MAX_POLL_FAILURES = 20;
  const GRACE_PERIOD_MS = 20000;

  const playerNameQuery = useQuery({
    queryKey: ['arena-player-name'],
    queryFn: async () => {
      const storedName = (await AsyncStorage.getItem(PLAYER_NAME_KEY)) ?? '';
      const sanitizedStoredName = sanitizePlayerName(storedName);

      if (storedName !== sanitizedStoredName) {
        if (sanitizedStoredName) {
          await AsyncStorage.setItem(PLAYER_NAME_KEY, sanitizedStoredName);
        } else {
          await AsyncStorage.removeItem(PLAYER_NAME_KEY);
        }
      }

      setPlayerName(sanitizedStoredName);
      return sanitizedStoredName;
    },
  });

  const leaderboardQuery = useQuery({
    queryKey: ['arena-leaderboard'],
    queryFn: async () => {
      const stored = await AsyncStorage.getItem(LEADERBOARD_KEY);
      if (!stored) return [];
      try {
        return JSON.parse(stored) as ArenaLeaderboardEntry[];
      } catch {
        return [];
      }
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

  const savePlayerNameMut = useMutation({
    mutationFn: async (name: string) => {
      await AsyncStorage.setItem(PLAYER_NAME_KEY, name);
      return name;
    },
    onSuccess: (name: string) => {
      queryClient.setQueryData(['arena-player-name'], name);
    },
    onError: (error: unknown) => {
      logger.warn('[Arena] Failed to persist player name:', error);
    },
  });

  const [pollInterval, setPollInterval] = useState<number>(POLL_LOBBY_MS);
  const lastVersionRef = useRef<number>(0);

  const clearArenaConnection = useCallback((nextError: string | null) => {
    setRoomCode(null);
    setPlayerId(null);
    setConnectionError(nextError);
    setOptimisticSettings(null);
    setOptimisticDeckSelection(null);
    setHasAnsweredCurrent(false);
    setLastAnswerCorrect(null);
    setStableRoom(null);
    prevQuestionRoundRef.current = null;
    pollFailCountRef.current = 0;
    lastErrorMsgRef.current = null;
    connectedAtRef.current = 0;
    lastVersionRef.current = 0;
    logger.log('[Arena] Disconnected');
  }, []);

  const getRoomClosedMessage = useCallback((currentRoom: SanitizedRoom | null) => {
    if (currentRoom && playerId && currentRoom.hostId !== playerId) {
      return currentRoom.status === 'playing'
        ? 'The host left the match.'
        : 'The host closed the room.';
    }

    return 'Room expired or not found';
  }, [playerId]);

  const roomQuery = trpc.arena.getRoomState.useQuery(
    { roomCode: roomCode!, playerId: playerId! },
    {
      enabled: !!roomCode && !!playerId,
      refetchInterval: pollInterval,
      refetchOnWindowFocus: false,
      retry: 8,
      retryDelay: 2000,
    },
  );

  const applyIncomingRoom = useCallback((incomingRoom: SanitizedRoom | null) => {
    setStableRoom((currentRoom) => {
      if (!incomingRoom) {
        lastVersionRef.current = 0;
        return null;
      }

      const incomingVersion = incomingRoom.version ?? 0;
      const currentVersion = currentRoom?.version ?? 0;
      const incomingUpdatedAt = incomingRoom.updatedAt ?? 0;
      const currentUpdatedAt = currentRoom?.updatedAt ?? 0;

      if (
        incomingVersion < lastVersionRef.current
        || incomingVersion < currentVersion
        || (incomingVersion === currentVersion && incomingUpdatedAt < currentUpdatedAt)
      ) {
        logger.log('[Arena] Ignoring stale room snapshot:', {
          incomingVersion,
          currentVersion,
          incomingUpdatedAt,
          currentUpdatedAt,
          roomCode: incomingRoom.code,
        });
        return currentRoom;
      }

      lastVersionRef.current = incomingVersion;
      return incomingRoom;
    });
  }, []);

  useEffect(() => {
    if (roomQuery.data && roomCode) {
      pollFailCountRef.current = 0;
      applyIncomingRoom(roomQuery.data.room ?? null);
    }
  }, [applyIncomingRoom, roomQuery.data, roomCode]);

  useEffect(() => {
    if (roomQuery.error && roomCode) {
      const msg = normalizeArenaConnectionError(roomQuery.error);
      const hasRedisConfigError = isRedisConfigArenaError(roomQuery.error);

      if (isArenaRoomNotFoundError(roomQuery.error)) {
        const nextMessage = getRoomClosedMessage(stableRoom);
        logger.log('[Arena] Room closed while polling, disconnecting:', nextMessage);
        clearArenaConnection(nextMessage);
        return;
      }

      const timeSinceConnect = Date.now() - connectedAtRef.current;
      if (timeSinceConnect < GRACE_PERIOD_MS) {
        logger.log('[Arena] Poll error during grace period, ignoring:', msg);
        return;
      }
      if (hasRedisConfigError) {
        logger.log('[Arena] Backend configuration error while polling, disconnecting:', msg);
        clearArenaConnection(msg);
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
        clearArenaConnection('Room expired or not found');
      }
    }
  }, [clearArenaConnection, getRoomClosedMessage, roomCode, roomQuery.error, stableRoom]);

  const serverRoom = stableRoom;
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

  const currentQuestionRoundKey = room?.game?.currentQuestion
    ? `${room.game.currentQuestionIndex}:${room.game.questionStartedAt}:${room.game.currentQuestion.cardId}`
    : null;
  const currentPlayerAnswer = playerId && room?.game?.currentAnswers
    ? room.game.currentAnswers[playerId] ?? null
    : null;

  useEffect(() => {
    if (currentQuestionRoundKey !== prevQuestionRoundRef.current) {
      prevQuestionRoundRef.current = currentQuestionRoundKey;
      setHasAnsweredCurrent(false);
      setLastAnswerCorrect(null);
    }
  }, [currentQuestionRoundKey]);

  useEffect(() => {
    if (room?.game && playerId && room.game.answeredPlayerIds.includes(playerId)) {
      setHasAnsweredCurrent(true);
    }
  }, [room?.game, playerId]);

  useEffect(() => {
    if (currentPlayerAnswer) {
      setHasAnsweredCurrent(true);
      setLastAnswerCorrect(currentPlayerAnswer.isCorrect);
    }
  }, [currentPlayerAnswer]);

  const createRoomMut = trpc.arena.initRoom.useMutation({
    onSuccess: (data: { roomCode: string; playerId: string; room: SanitizedRoom }) => {
      logger.log('[Arena] Created room:', data.roomCode);
      connectedAtRef.current = Date.now();
      pollFailCountRef.current = 0;
      lastErrorMsgRef.current = null;
      applyIncomingRoom(data.room);
      setRoomCode(data.roomCode);
      setPlayerId(data.playerId);
      setConnectionError(null);
      trackEvent({
        event: 'battle_created',
        roomCode: data.roomCode,
        userId: data.playerId,
        properties: {
          rounds: data.room.settings.rounds,
          timer_seconds: data.room.settings.timerSeconds,
          mode: GAME_MODE.ARENA,
        },
      });
    },
    onError: (error) => {
      const normalizedError = normalizeArenaConnectionError(error);
      logger.log('[Arena] Create error:', normalizedError);
      setConnectionError(normalizedError);
    },
  });

  const joinRoomMut = trpc.arena.joinRoom.useMutation({
    onSuccess: (data: { playerId: string; room: SanitizedRoom }) => {
      logger.log('[Arena] Joined room:', data.room.code);
      connectedAtRef.current = Date.now();
      pollFailCountRef.current = 0;
      lastErrorMsgRef.current = null;
      applyIncomingRoom(data.room);
      setRoomCode(data.room.code);
      setPlayerId(data.playerId);
      setConnectionError(null);
      trackEvent({
        event: 'battle_joined',
        roomCode: data.room.code,
        userId: data.playerId,
        deckId: data.room.deckId ?? undefined,
        properties: {
          mode: GAME_MODE.ARENA,
          player_count: data.room.players.length,
        },
      });
    },
    onError: (error) => {
      const normalizedError = normalizeArenaConnectionError(error);
      logger.log('[Arena] Join error:', normalizedError);
      setConnectionError(normalizedError);
    },
  });

  const leaveMut = trpc.arena.leaveRoom.useMutation();
  const selectDeckMut = trpc.arena.selectDeck.useMutation({
    onSuccess: (data: { room: SanitizedRoom }) => {
      logger.log('[Arena] Deck selection saved');
      applyIncomingRoom(data.room);
    },
    onError: (error) => {
      const normalizedError = normalizeArenaConnectionError(error);
      logger.log('[Arena] Select deck error:', normalizedError);
      setOptimisticDeckSelection(null);
      setConnectionError(normalizedError);
    },
  });
  const updateSettingsMut = trpc.arena.updateSettings.useMutation({
    onSuccess: (data: { room: SanitizedRoom }) => {
      applyIncomingRoom(data.room);
    },
    onError: (error) => {
      const normalizedError = normalizeArenaConnectionError(error);
      logger.log('[Arena] Update settings error:', normalizedError);
      setOptimisticSettings(null);
      setConnectionError(normalizedError);
    },
  });
  const startGameMut = trpc.arena.startGame.useMutation({
    onSuccess: (data: { room: SanitizedRoom }) => {
      applyIncomingRoom(data.room);
      trackEvents([
        {
          event: 'battle_started',
          roomCode: data.room.code,
          userId: data.room.hostId,
          deckId: data.room.deckId ?? undefined,
          properties: {
            players_per_battle: data.room.players.length,
            rounds: data.room.settings.rounds,
            timer_seconds: data.room.settings.timerSeconds,
            mode: GAME_MODE.ARENA,
            deck_name: data.room.deckName ?? null,
          },
        },
        {
          event: 'deck_played',
          roomCode: data.room.code,
          userId: data.room.hostId,
          deckId: data.room.deckId ?? undefined,
          properties: {
            mode: GAME_MODE.ARENA,
            deck_name: data.room.deckName ?? null,
            player_count: data.room.players.length,
            rounds: data.room.settings.rounds,
            timer_seconds: data.room.settings.timerSeconds,
          },
        },
      ]);
    },
    onError: (error) => {
      const normalizedError = normalizeArenaConnectionError(error);
      logger.log('[Arena] Start game error:', normalizedError);
      setConnectionError(normalizedError);
    },
  });
  const submitAnswerMut = trpc.arena.submitAnswer.useMutation({
    onSuccess: (data: { isCorrect: boolean; room: SanitizedRoom; expired?: boolean }) => {
      applyIncomingRoom(data.room);
      if (data.expired) {
        logger.log('[Arena] Answer expired before submission completed');
        return;
      }
      setHasAnsweredCurrent(true);
      setLastAnswerCorrect(data.isCorrect);
      logger.log('[Arena] Answer submitted, correct:', data.isCorrect);
    },
    onError: (error: unknown) => {
      if (isArenaRoomNotFoundError(error)) {
        const nextMessage = getRoomClosedMessage(stableRoom);
        logger.log('[Arena] Submit failed because room closed:', nextMessage);
        clearArenaConnection(nextMessage);
        return;
      }

      const normalizedError = normalizeArenaConnectionError(error);
      logger.log('[Arena] Submit error:', normalizedError);
      void roomQuery.refetch();
    },
  });
  const removePlayerMut = trpc.arena.removePlayer.useMutation({
    onSuccess: (data: { room: SanitizedRoom }) => {
      applyIncomingRoom(data.room);
    },
  });
  const resetRoomMut = trpc.arena.resetRoom.useMutation({
    onSuccess: (data: { room: SanitizedRoom }) => {
      applyIncomingRoom(data.room);
    },
  });

  const updatePlayerName = useCallback((name: string): string => {
    const sanitizedName = sanitizePlayerName(name);

    if (!sanitizedName) {
      return '';
    }

    logger.log('[Arena] Updating player name:', sanitizedName);
    setPlayerName(sanitizedName);
    queryClient.setQueryData(['arena-player-name'], sanitizedName);
    savePlayerNameMut.mutate(sanitizedName);
    return sanitizedName;
  }, [queryClient, savePlayerNameMut]);

  const createRoom = useCallback((name: string) => {
    const sanitizedName = updatePlayerName(name);
    if (!sanitizedName) {
      setConnectionError('Enter a player name.');
      return;
    }

    setConnectionError(null);
    setOptimisticSettings(null);
    setOptimisticDeckSelection(null);
    pollFailCountRef.current = 0;
    lastErrorMsgRef.current = null;
    connectedAtRef.current = Date.now();
    createRoomMut.mutate({ name: sanitizedName, preferredIdentityKey: selectedIdentityKey });
  }, [createRoomMut, selectedIdentityKey, updatePlayerName]);

  const joinRoom = useCallback((code: string, name: string) => {
    const sanitizedName = updatePlayerName(name);
    if (!sanitizedName) {
      setConnectionError('Enter a player name.');
      return;
    }

    setConnectionError(null);
    setOptimisticSettings(null);
    setOptimisticDeckSelection(null);
    pollFailCountRef.current = 0;
    lastErrorMsgRef.current = null;
    connectedAtRef.current = Date.now();
    joinRoomMut.mutate({ roomCode: code, playerName: sanitizedName, preferredIdentityKey: selectedIdentityKey });
  }, [joinRoomMut, selectedIdentityKey, updatePlayerName]);

  const disconnect = useCallback(() => {
    if (roomCode && playerId) {
      leaveMut.mutate({ roomCode, playerId });
    }
    clearArenaConnection(null);
  }, [clearArenaConnection, roomCode, playerId, leaveMut]);

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

  const startGame = useCallback((questions: { cardId: string; question: string; correctAnswer: string; options: string[] }[]) => {
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
    isPlayerNameReady: !playerNameQuery.isLoading,
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
    updatePlayerName,
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
    roomCode, playerId, playerName, playerNameQuery.isLoading, connectionError,
    room, isHost, myPlayer, hasAnsweredCurrent, lastAnswerCorrect,
    canStartGame,
    createRoomMut.isPending, joinRoomMut.isPending,
    selectDeckMut.isPending, startGameMut.isPending, submitAnswerMut.isPending,
    createRoom, joinRoom, updatePlayerName, disconnect, selectDeck, updateSettings,
    startGame, submitAnswer, removePlayer, resetRoom,
    leaderboard, saveMatchResult, cleanupDeck, leaderboardQuery.isLoading,
    clearError, roomVersion, roomUpdatedAt,
  ]);
});
