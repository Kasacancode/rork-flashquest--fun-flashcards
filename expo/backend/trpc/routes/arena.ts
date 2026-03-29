import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { generateArenaQuestions, prepareArenaDeck } from '../../arena/deck-service';
import * as engine from '../../arena/engine';
import {
  createArenaDeckNotFoundError,
  createArenaDeckNotReadyError,
  createArenaDeckNotSelectedError,
  createArenaHostMismatchError,
  createArenaInvalidRoomStateError,
  createArenaMinPlayersError,
  createArenaRoomSaveFailedError,
} from '../../arena/errors';
import { roomRepository } from '../../arena/repository';
import { MAX_ARENA_DECK_UPLOAD_CARDS, type ArenaPreparedDeck, type Room } from '../../arena/types';
import { createTRPCRouter, publicProcedure } from '../create-context';

async function requireRoom(code: string): Promise<Room> {
  const room = await roomRepository.getRoom(code);
  if (!room) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Room not found or expired' });
  }
  return room;
}

function assertHost(room: Room, playerId: string, action: string): void {
  if (room.hostId !== playerId) {
    throw createArenaHostMismatchError({ roomCode: room.code, playerId, hostId: room.hostId, action });
  }
}

function assertLobbyRoom(room: Room, action: string): void {
  if (room.status !== 'lobby' || room.game !== null) {
    throw createArenaInvalidRoomStateError({
      roomCode: room.code,
      status: room.status,
      hasGame: room.game !== null,
      action,
    });
  }
}

function assertStartableRoom(room: Room, playerId: string): void {
  assertHost(room, playerId, 'startGame');
  assertLobbyRoom(room, 'startGame');

  if (room.players.length < 2) {
    throw createArenaMinPlayersError({ roomCode: room.code, playerCount: room.players.length });
  }

  if (!room.deckId) {
    throw createArenaDeckNotSelectedError({ roomCode: room.code, playerId });
  }
}

async function persistPreparedDeck(code: string, preparedDeck: ArenaPreparedDeck, stage: string): Promise<ArenaPreparedDeck> {
  try {
    return await roomRepository.savePreparedDeck(code, preparedDeck);
  } catch (error) {
    throw createArenaRoomSaveFailedError({
      roomCode: code,
      stage,
      preparedDeckId: preparedDeck.deckId,
      reason: error instanceof Error ? error.message : 'unknown',
    });
  }
}

async function persistRoom(room: Room, stage: string, meta?: Record<string, unknown>): Promise<Room> {
  try {
    return await roomRepository.saveRoom(room);
  } catch (error) {
    throw createArenaRoomSaveFailedError({
      roomCode: room.code,
      stage,
      reason: error instanceof Error ? error.message : 'unknown',
      ...meta,
    });
  }
}

export const arenaRouter = createTRPCRouter({
  health: publicProcedure.query(async () => {
    const rooms = await roomRepository.getRoomCount();
    return { status: 'ok', rooms, timestamp: Date.now() };
  }),

  initRoom: publicProcedure
    .input(z.object({
      name: z.string().min(1).max(20),
      preferredIdentityKey: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const code = await roomRepository.generateUniqueCode();
      const { room, playerId } = engine.createNewRoom(input.name, code, input.preferredIdentityKey);
      const saved = await roomRepository.createRoom(room);
      return { roomCode: saved.code, playerId, room: engine.sanitizeRoom(saved) };
    }),

  joinRoom: publicProcedure
    .input(z.object({
      roomCode: z.string().trim().regex(/^[A-Za-z0-9]{4}$/).transform((value) => value.toUpperCase()),
      playerName: z.string().min(1).max(20),
      preferredIdentityKey: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      return roomRepository.withRoomLock(input.roomCode, async () => {
        const room = await requireRoom(input.roomCode);
        const result = engine.joinRoom(room, input.playerName, input.preferredIdentityKey);
        if (!result) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Room not found, full, or game already started',
          });
        }
        const saved = await persistRoom(result.room, 'joinRoom', { playerId: result.player.id });
        await roomRepository.updatePlayerHeartbeat(saved.code, result.player.id);
        return { playerId: result.player.id, room: engine.sanitizeRoom(saved) };
      });
    }),

  leaveRoom: publicProcedure
    .input(z.object({ roomCode: z.string(), playerId: z.string() }))
    .mutation(async ({ input }) => {
      return roomRepository.withRoomLock(input.roomCode, async () => {
        const room = await roomRepository.getRoom(input.roomCode);
        if (!room) {
          return { success: true };
        }

        const result = engine.leaveRoom(room, input.playerId);
        if (result === null) {
          await roomRepository.deleteRoom(input.roomCode);
        } else {
          await persistRoom(result, 'leaveRoom', { playerId: input.playerId });
        }
        return { success: true };
      });
    }),

  removePlayer: publicProcedure
    .input(z.object({
      roomCode: z.string(),
      playerId: z.string(),
      targetPlayerId: z.string(),
    }))
    .mutation(async ({ input }) => {
      return roomRepository.withRoomLock(input.roomCode, async () => {
        const room = await requireRoom(input.roomCode);
        const result = engine.removePlayer(room, input.targetPlayerId, input.playerId);
        if (!result) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Cannot remove player' });
        }
        const saved = await persistRoom(result, 'removePlayer', { playerId: input.playerId, targetPlayerId: input.targetPlayerId });
        return { room: engine.sanitizeRoom(saved) };
      });
    }),

  selectDeck: publicProcedure
    .input(z.object({
      roomCode: z.string(),
      playerId: z.string(),
      deckId: z.string().min(1),
      deckName: z.string().trim().min(1).max(80),
      cards: z.array(z.object({
        id: z.string().min(1),
        question: z.string().max(4000),
        answer: z.string().max(2000),
      })).min(1).max(MAX_ARENA_DECK_UPLOAD_CARDS),
    }))
    .mutation(async ({ input }) => {
      return roomRepository.withRoomLock(input.roomCode, async () => {
        const room = await requireRoom(input.roomCode);
        assertHost(room, input.playerId, 'selectDeck');
        assertLobbyRoom(room, 'selectDeck');

        const { preparedDeck, diagnostics } = prepareArenaDeck({
          deckId: input.deckId,
          deckName: input.deckName,
          sourceCards: input.cards,
        });

        await persistPreparedDeck(input.roomCode, preparedDeck, 'selectDeck.prepareDeck');

        const result = engine.selectDeck(room, input.playerId, input.deckId, input.deckName);
        if (!result) {
          throw createArenaInvalidRoomStateError({ roomCode: input.roomCode, action: 'selectDeck.engine' });
        }

        const saved = await persistRoom(result, 'selectDeck.saveRoom', {
          deckId: input.deckId,
          diagnostics,
        });

        console.log('[Arena] Prepared deck for room:', {
          roomCode: saved.code,
          deckId: input.deckId,
          originalCardCount: diagnostics.originalCardCount,
          validCardCount: diagnostics.validCardCount,
          usableCardCount: diagnostics.usableCardCount,
          distinctAnswerCount: diagnostics.distinctAnswerCount,
          approxSerializedBytes: diagnostics.approxSerializedBytes,
        });

        return { room: engine.sanitizeRoom(saved), diagnostics };
      });
    }),

  updateSettings: publicProcedure
    .input(z.object({
      roomCode: z.string(),
      playerId: z.string(),
      settings: z.object({
        rounds: z.number().optional(),
        timerSeconds: z.number().optional(),
        showExplanationsAtEnd: z.boolean().optional(),
      }),
    }))
    .mutation(async ({ input }) => {
      return roomRepository.withRoomLock(input.roomCode, async () => {
        const room = await requireRoom(input.roomCode);
        const result = engine.updateSettings(room, input.playerId, input.settings);
        if (!result) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Only host can update settings' });
        }
        const saved = await persistRoom(result, 'updateSettings', { playerId: input.playerId, settings: input.settings });
        return { room: engine.sanitizeRoom(saved) };
      });
    }),

  startGame: publicProcedure
    .input(z.object({
      roomCode: z.string(),
      playerId: z.string(),
    }))
    .mutation(async ({ input }) => {
      return roomRepository.withRoomLock(input.roomCode, async () => {
        const room = await requireRoom(input.roomCode);
        assertStartableRoom(room, input.playerId);

        const preparedDeck = await roomRepository.getPreparedDeck(input.roomCode);
        if (!preparedDeck) {
          throw createArenaDeckNotReadyError({ roomCode: input.roomCode, deckId: room.deckId });
        }

        if (!room.deckId || preparedDeck.deckId !== room.deckId) {
          throw createArenaDeckNotFoundError({
            roomCode: input.roomCode,
            roomDeckId: room.deckId,
            preparedDeckId: preparedDeck.deckId,
          });
        }

        const { questions, diagnostics } = generateArenaQuestions({
          roomCode: input.roomCode,
          playerId: input.playerId,
          preparedDeck,
          requestedRounds: room.settings.rounds,
        });

        const result = engine.startGame(room, input.playerId, questions);
        if (!result) {
          throw createArenaInvalidRoomStateError({
            roomCode: input.roomCode,
            deckId: room.deckId,
            playerCount: room.players.length,
            action: 'startGame.engine',
          });
        }

        const saved = await persistRoom(result, 'startGame.saveRoom', {
          deckId: room.deckId,
          diagnostics,
        });

        console.log('[Arena] Started battle from prepared deck:', {
          roomCode: saved.code,
          deckId: room.deckId,
          originalCardCount: diagnostics.originalCardCount,
          validCardCount: diagnostics.validCardCount,
          selectedRoundCount: diagnostics.selectedRoundCount,
          distinctAnswerCount: diagnostics.distinctAnswerCount,
          approxSerializedRoomBytes: diagnostics.approxSerializedRoomBytes,
        });

        return { room: engine.sanitizeRoom(saved), diagnostics };
      });
    }),

  submitAnswer: publicProcedure
    .input(z.object({
      roomCode: z.string(),
      playerId: z.string(),
      questionIndex: z.number(),
      selectedOption: z.string(),
    }))
    .mutation(async ({ input }) => {
      return roomRepository.withRoomLock(input.roomCode, async () => {
        const room = await requireRoom(input.roomCode);
        const tickChanged = engine.tick(room);

        if (tickChanged) {
          await persistRoom(room, 'submitAnswer.tick', { playerId: input.playerId, questionIndex: input.questionIndex });
        }

        const result = engine.submitAnswer(room, input.playerId, input.questionIndex, input.selectedOption);
        if (!result) {
          return { isCorrect: false, room: engine.sanitizeRoom(room), expired: true };
        }

        engine.tick(result.room);
        const saved = await persistRoom(result.room, 'submitAnswer.saveRoom', { playerId: input.playerId, questionIndex: input.questionIndex });
        return { isCorrect: result.isCorrect, room: engine.sanitizeRoom(saved), expired: false };
      });
    }),

  nextQuestion: publicProcedure
    .input(z.object({ roomCode: z.string(), playerId: z.string() }))
    .mutation(async ({ input }) => {
      return roomRepository.withRoomLock(input.roomCode, async () => {
        const room = await requireRoom(input.roomCode);
        const tickChanged = engine.tick(room);

        if (tickChanged) {
          await persistRoom(room, 'nextQuestion.tick', { playerId: input.playerId });
        }

        const result = engine.advanceQuestion(room, input.playerId);
        if (!result) {
          return { room: engine.sanitizeRoom(room) };
        }

        const saved = await persistRoom(result, 'nextQuestion.saveRoom', { playerId: input.playerId });
        return { room: engine.sanitizeRoom(saved) };
      });
    }),

  resetRoom: publicProcedure
    .input(z.object({ roomCode: z.string(), playerId: z.string() }))
    .mutation(async ({ input }) => {
      return roomRepository.withRoomLock(input.roomCode, async () => {
        const room = await requireRoom(input.roomCode);
        const result = engine.resetRoom(room, input.playerId);
        if (!result) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Cannot reset room' });
        }
        const saved = await persistRoom(result, 'resetRoom', { playerId: input.playerId });
        return { room: engine.sanitizeRoom(saved) };
      });
    }),

  getRoomState: publicProcedure
    .input(z.object({ roomCode: z.string(), playerId: z.string() }))
    .query(async ({ input }) => {
      const room = await requireRoom(input.roomCode);
      const heartbeats = await roomRepository.getPlayerHeartbeats(input.roomCode);
      return { room: engine.sanitizeRoom(room, heartbeats) };
    }),

  heartbeat: publicProcedure
    .input(z.object({ roomCode: z.string(), playerId: z.string() }))
    .mutation(async ({ input }) => {
      await roomRepository.updatePlayerHeartbeat(input.roomCode, input.playerId);
      return { success: true };
    }),
});
