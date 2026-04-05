import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { Alert } from 'react-native';

import { ARENA_BACKEND_ERROR_CODES, type ArenaDeckSourceCard, type ArenaDeckSelectionResult, type ArenaGameStartResult, type RoomSettings, type SanitizedRoom } from '@/backend/arena/types';
import { useAuth } from '@/context/AuthContext';
import { useAvatar } from '@/context/AvatarContext';
import { trackEvent, trackEvents } from '@/lib/analytics';
import { trpc } from '@/lib/trpc';
import type { ArenaLeaderboardEntry } from '@/types/arena';
import { GAME_MODE } from '@/types/game';
import { logger } from '@/utils/logger';
import { sanitizePublicLabel } from '@/utils/contentSafety';
import { getPlayerNameValidationError, sanitizePlayerName } from '@/utils/playerName';

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
  backendMeta?: unknown;
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

function sanitizeRoomSnapshot(room: SanitizedRoom): SanitizedRoom {
  return {
    ...room,
    deckName: room.deckName ? sanitizePublicLabel(room.deckName, { maxLength: 80, fallback: 'Study Deck' }) : room.deckName,
    players: room.players.map((player) => ({
      ...player,
      name: sanitizePublicLabel(player.name, { maxLength: 20, fallback: 'Guest Player' }),
      identityLabel: sanitizePublicLabel(player.identityLabel, { maxLength: 40, fallback: player.identityLabel }),
    })),
  };
}

function normalizeArenaConnectionError(error: unknown): string {
  const message = getArenaErrorMessage(error).trim();
  const normalizedMessage = message.toLowerCase();
  const backendCode = getArenaBackendErrorCode(error);

  if (backendCode === ARENA_BACKEND_ERROR_CODES.DECK_NOT_SELECTED) {
    return 'Choose a deck before starting a battle.';
  }

  if (backendCode === ARENA_BACKEND_ERROR_CODES.DECK_NOT_READY) {
    return 'This deck is still getting ready for battle. Try again in a moment.';
  }

  if (backendCode === ARENA_BACKEND_ERROR_CODES.DECK_NOT_FOUND) {
    return 'That battle deck could not be found. Re-select the deck and try again.';
  }

  if (backendCode === ARENA_BACKEND_ERROR_CODES.DECK_TOO_FEW_VALID_CARDS) {
    return 'This deck needs at least 4 clean cards before it can be used in battle.';
  }

  if (backendCode === ARENA_BACKEND_ERROR_CODES.DECK_CONTENT_TOO_LONG) {
    return 'This deck has cards that are too long for live battle. Shorten the longest questions or answers and try again.';
  }

  if (backendCode === ARENA_BACKEND_ERROR_CODES.DECK_MALFORMED) {
    return 'This deck has empty or malformed cards that arena cannot use yet. Clean them up and try again.';
  }

  if (backendCode === ARENA_BACKEND_ERROR_CODES.NOT_ENOUGH_DISTINCT_ANSWERS) {
    return 'This deck does not have enough distinct answers to build battle rounds.';
  }

  if (backendCode === ARENA_BACKEND_ERROR_CODES.HOST_MISMATCH) {
    return 'Only the host can start this battle.';
  }

  if (backendCode === ARENA_BACKEND_ERROR_CODES.MIN_PLAYERS_REQUIRED) {
    return 'You need at least 2 players to start a battle.';
  }

  if (backendCode === ARENA_BACKEND_ERROR_CODES.INVALID_ROOM_STATE) {
    return 'This battle room is no longer ready to start.';
  }

  if (backendCode === ARENA_BACKEND_ERROR_CODES.ROOM_SAVE_FAILED || backendCode === ARENA_BACKEND_ERROR_CODES.GAME_GENERATION_FAILED) {
    return 'Battle setup failed right now. Please try again.';
  }

  if (backendCode === ARENA_BACKEND_ERROR_CODES.DECK_UPLOAD_TOO_LARGE) {
    return 'This deck is too large to prepare for battle right now.';
  }

  if (isRedisConfigArenaError(error)) {
    return __DEV__ && message ? message : 'Battle service temporarily unavailable.';
  }

  if (normalizedMessage === 'failed to fetch' || normalizedMessage.includes('network request failed')) {
    return 'Could not connect to battle service. Please try again.';
  }

  if (normalizedMessage.includes('json parse') || normalizedMessage.includes('unexpected character') || normalizedMessage.includes('unexpected token')) {
    return 'Battle service is temporarily unavailable. Please try again in a moment.';
  }

  if (message && message.length > 0 && message.length < 200) {
    return message;
  }

  return 'Could not connect to battle service. Please try again.';
}

export const [ArenaProvider, useArena] = createContextHook(() => {
  const queryClient = useQueryClient();
  const { username } = useAuth();
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
    queryKey: ['arena-player-name', username ?? 'guest'],
    queryFn: async () => {
      if (username) {
        setPlayerName(username);
        return username;
      }

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
      } catch (error) {
        logger.warn('[Arena] Failed to parse stored leaderboard:', error);
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
      queryClient.setQueryData(['arena-player-name', 'guest'], name);
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
    logger.debug('[Arena] Disconnected');
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
        logger.debug('[Arena] Ignoring stale room snapshot:', {
          incomingVersion,
          currentVersion,
          incomingUpdatedAt,
          currentUpdatedAt,
          roomCode: incomingRoom.code,
        });
        return currentRoom;
      }

      lastVersionRef.current = incomingVersion;
      return sanitizeRoomSnapshot(incomingRoom);
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
        logger.debug('[Arena] Room closed while polling, disconnecting:', nextMessage);
        clearArenaConnection(nextMessage);
        return;
      }

      const timeSinceConnect = Date.now() - connectedAtRef.current;
      if (timeSinceConnect < GRACE_PERIOD_MS) {
        logger.debug('[Arena] Poll error during grace period, ignoring:', msg);
        return;
      }
      if (hasRedisConfigError) {
        logger.debug('[Arena] Backend configuration error while polling, disconnecting:', msg);
        clearArenaConnection(msg);
        return;
      }
      if (msg !== lastErrorMsgRef.current) {
        pollFailCountRef.current = 1;
        lastErrorMsgRef.current = msg;
      } else {
        pollFailCountRef.current += 1;
      }
      logger.debug('[Arena] Poll error (attempt', pollFailCountRef.current, '/', MAX_POLL_FAILURES, '):', msg);
      if (pollFailCountRef.current >= MAX_POLL_FAILURES) {
        logger.debug('[Arena] Max poll failures reached, disconnecting');
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
      logger.debug('[Arena] Created room:', data.roomCode);
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
      logger.debug('[Arena] Create error:', normalizedError);
      setConnectionError(normalizedError);
    },
  });

  const joinRoomMut = trpc.arena.joinRoom.useMutation({
    onSuccess: (data: { playerId: string; room: SanitizedRoom }) => {
      logger.debug('[Arena] Joined room:', data.room.code);
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
      logger.debug('[Arena] Join error:', normalizedError);
      setConnectionError(normalizedError);
    },
  });

  const leaveMut = trpc.arena.leaveRoom.useMutation();
  const selectDeckMut = trpc.arena.selectDeck.useMutation({
    onSuccess: (data: ArenaDeckSelectionResult) => {
      logger.debug('[Arena] Deck prepared for battle:', data.diagnostics);
      applyIncomingRoom(data.room);
    },
    onError: (error) => {
      const normalizedError = normalizeArenaConnectionError(error);
      const backendCode = getArenaBackendErrorCode(error);
      logger.debug('[Arena] Select deck error:', normalizedError, 'code:', backendCode);
      setOptimisticDeckSelection(null);

      const isDeckError = backendCode === ARENA_BACKEND_ERROR_CODES.DECK_TOO_FEW_VALID_CARDS
        || backendCode === ARENA_BACKEND_ERROR_CODES.DECK_CONTENT_TOO_LONG
        || backendCode === ARENA_BACKEND_ERROR_CODES.DECK_MALFORMED
        || backendCode === ARENA_BACKEND_ERROR_CODES.NOT_ENOUGH_DISTINCT_ANSWERS
        || backendCode === ARENA_BACKEND_ERROR_CODES.DECK_UPLOAD_TOO_LARGE;

      if (isDeckError) {
        Alert.alert('Deck Issue', normalizedError);
        return;
      }

      setConnectionError(normalizedError);
    },
  });
  const updateSettingsMut = trpc.arena.updateSettings.useMutation({
    onSuccess: (data: { room: SanitizedRoom }) => {
      applyIncomingRoom(data.room);
    },
    onError: (error) => {
      const normalizedError = normalizeArenaConnectionError(error);
      logger.debug('[Arena] Update settings error:', normalizedError);
      setOptimisticSettings(null);
      setConnectionError(normalizedError);
    },
  });
  const startGameMut = trpc.arena.startGame.useMutation({
    onSuccess: (data: ArenaGameStartResult) => {
      logger.debug('[Arena] Battle started from prepared deck:', data.diagnostics);
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
      logger.debug('[Arena] Start game error:', normalizedError);
      setConnectionError(normalizedError);
    },
  });
  const submitAnswerMut = trpc.arena.submitAnswer.useMutation({
    onSuccess: (data: { isCorrect: boolean; room: SanitizedRoom; expired?: boolean }) => {
      applyIncomingRoom(data.room);
      if (data.expired) {
        logger.debug('[Arena] Answer expired before submission completed');
        return;
      }
      setHasAnsweredCurrent(true);
      setLastAnswerCorrect(data.isCorrect);
      logger.debug('[Arena] Answer submitted, correct:', data.isCorrect);
    },
    onError: (error: unknown) => {
      if (isArenaRoomNotFoundError(error)) {
        const nextMessage = getRoomClosedMessage(stableRoom);
        logger.debug('[Arena] Submit failed because room closed:', nextMessage);
        clearArenaConnection(nextMessage);
        return;
      }

      const normalizedError = normalizeArenaConnectionError(error);
      logger.debug('[Arena] Submit error:', normalizedError);
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
    if (username) {
      logger.debug('[Arena] Ignoring local player name override because username is active:', username);
      setPlayerName(username);
      queryClient.setQueryData(['arena-player-name', username], username);
      return username;
    }

    const validationError = getPlayerNameValidationError(name);
    if (validationError) {
      return '';
    }

    const sanitizedName = sanitizePlayerName(name);
    logger.debug('[Arena] Updating player name:', sanitizedName);
    setPlayerName(sanitizedName);
    queryClient.setQueryData(['arena-player-name', 'guest'], sanitizedName);
    savePlayerNameMut.mutate(sanitizedName);
    return sanitizedName;
  }, [queryClient, savePlayerNameMut, username]);

  const createRoom = useCallback((name: string) => {
    const validationError = getPlayerNameValidationError(name);
    if (validationError) {
      setConnectionError(validationError);
      return;
    }

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
    const validationError = getPlayerNameValidationError(name);
    if (validationError) {
      setConnectionError(validationError);
      return;
    }

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

  const selectDeck = useCallback((deckId: string, deckName: string, cards: ArenaDeckSourceCard[]) => {
    if (!roomCode || !playerId) {
      return;
    }

    const safeDeckName = sanitizePublicLabel(deckName, { maxLength: 80, fallback: 'Study Deck' });
    setConnectionError(null);
    setOptimisticDeckSelection({ deckId, deckName: safeDeckName });
    logger.debug('[Arena] Preparing selected deck for battle:', deckId, safeDeckName, 'cards:', cards.length);
    selectDeckMut.mutate({ roomCode, playerId, deckId, deckName: safeDeckName, cards });
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

    logger.debug('[Arena] Updating settings:', settings);
    updateSettingsMut.mutate({ roomCode, playerId, settings });
  }, [roomCode, playerId, serverRoom?.settings, updateSettingsMut]);

  const startGame = useCallback(() => {
    if (!roomCode || !playerId) return;
    logger.debug('[Arena] Requesting backend-generated battle start:', { roomCode, playerId });
    startGameMut.mutate({ roomCode, playerId });
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
    logger.debug('[Arena] Cleaning up leaderboard entries for deleted deck:', deckId);
    setLeaderboard(prev => {
      const filtered = prev.filter(entry => entry.deckId !== deckId);
      if (filtered.length !== prev.length) {
        saveLeaderboardMut.mutate(filtered);
        logger.debug('[Arena] Removed', prev.length - filtered.length, 'leaderboard entries');
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
