import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import * as engine from '../../arena/engine';
import { roomRepository } from '../../arena/repository';
import { createTRPCRouter, publicProcedure } from '../create-context';
import {
  isRoomCodeValid,
  normalizeRoomCode,
  ROOM_CODE_MAX_LENGTH,
  ROOM_CODE_MIN_LENGTH,
} from '../../../utils/arenaInvite';

function getArenaInfrastructureMessage(error: unknown): string {
  if (error instanceof TRPCError) {
    return error.message;
  }

  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return 'Battle service temporarily unavailable.';
}

function rethrowArenaInfrastructureError(error: unknown): never {
  if (error instanceof TRPCError) {
    throw error;
  }

  const message = getArenaInfrastructureMessage(error);
  console.error('[ArenaRoute] Infrastructure error:', error);
  throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message });
}

async function withArenaInfrastructure<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    rethrowArenaInfrastructureError(error);
  }
}

async function requireRoom(code: string) {
  const normalizedCode = normalizeRoomCode(code);

  try {
    const room = await roomRepository.getRoom(normalizedCode);
    if (!room) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Room not found or expired' });
    }

    return room;
  } catch (error) {
    rethrowArenaInfrastructureError(error);
  }
}

export const arenaRouter = createTRPCRouter({
  health: publicProcedure.query(() => {
    return { status: 'ok' as const };
  }),

  initRoom: publicProcedure
    .input(z.object({ name: z.string().min(1).max(20) }))
    .mutation(async ({ input }) => withArenaInfrastructure(async () => {
      console.log('[Arena] initRoom:', input.name);
      const code = await roomRepository.generateUniqueCode();
      const { room, playerId } = engine.createNewRoom(input.name, code);
      const saved = await roomRepository.createRoom(room);
      return { roomCode: saved.code, playerId, room: engine.sanitizeRoom(saved) };
    })),

  joinRoom: publicProcedure
    .input(z.object({
      roomCode: z.string().min(ROOM_CODE_MIN_LENGTH).max(ROOM_CODE_MAX_LENGTH).transform(normalizeRoomCode).refine(isRoomCodeValid, 'Invalid room code'),
      playerName: z.string().min(1).max(20),
    }))
    .mutation(async ({ input }) => withArenaInfrastructure(async () => {
      console.log('[Arena] joinRoom:', input.playerName, '->', input.roomCode);
      const room = await requireRoom(input.roomCode);
      const result = engine.joinRoom(room, input.playerName);
      if (!result) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Room not found, full, or game already started',
        });
      }
      const saved = await roomRepository.saveRoom(result.room);
      return { playerId: result.player.id, room: engine.sanitizeRoom(saved) };
    })),

  leaveRoom: publicProcedure
    .input(z.object({ roomCode: z.string(), playerId: z.string() }))
    .mutation(async ({ input }) => withArenaInfrastructure(async () => {
      console.log('[Arena] leaveRoom:', input.playerId, 'from', input.roomCode);
      const room = await roomRepository.getRoom(input.roomCode);
      if (!room) {
        return { success: true };
      }

      const result = engine.leaveRoom(room, input.playerId);
      if (result === null) {
        await roomRepository.deleteRoom(input.roomCode);
      } else {
        await roomRepository.saveRoom(result);
      }
      return { success: true };
    })),

  removePlayer: publicProcedure
    .input(z.object({
      roomCode: z.string(),
      playerId: z.string(),
      targetPlayerId: z.string(),
    }))
    .mutation(async ({ input }) => withArenaInfrastructure(async () => {
      const room = await requireRoom(input.roomCode);
      const result = engine.removePlayer(room, input.targetPlayerId, input.playerId);
      if (!result) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Cannot remove player' });
      }
      const saved = await roomRepository.saveRoom(result);
      return { room: engine.sanitizeRoom(saved) };
    })),

  selectDeck: publicProcedure
    .input(z.object({
      roomCode: z.string(),
      playerId: z.string(),
      deckId: z.string(),
      deckName: z.string(),
    }))
    .mutation(async ({ input }) => withArenaInfrastructure(async () => {
      const room = await requireRoom(input.roomCode);
      const result = engine.selectDeck(room, input.playerId, input.deckId, input.deckName);
      if (!result) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Only host can select deck' });
      }
      const saved = await roomRepository.saveRoom(result);
      return { room: engine.sanitizeRoom(saved) };
    })),

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
    .mutation(async ({ input }) => withArenaInfrastructure(async () => {
      const room = await requireRoom(input.roomCode);
      const result = engine.updateSettings(room, input.playerId, input.settings);
      if (!result) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Only host can update settings' });
      }
      const saved = await roomRepository.saveRoom(result);
      return { room: engine.sanitizeRoom(saved) };
    })),

  startGame: publicProcedure
    .input(z.object({
      roomCode: z.string(),
      playerId: z.string(),
      questions: z.array(z.object({
        cardId: z.string(),
        question: z.string(),
        correctAnswer: z.string(),
        options: z.array(z.string()),
      })),
    }))
    .mutation(async ({ input }) => withArenaInfrastructure(async () => {
      console.log('[Arena] startGame in room', input.roomCode, 'with', input.questions.length, 'questions');
      const room = await requireRoom(input.roomCode);
      const result = engine.startGame(room, input.playerId, input.questions);
      if (!result) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Cannot start game. Need 2+ players and a selected deck.',
        });
      }
      const saved = await roomRepository.saveRoom(result);
      return { room: engine.sanitizeRoom(saved) };
    })),

  submitAnswer: publicProcedure
    .input(z.object({
      roomCode: z.string(),
      playerId: z.string(),
      questionIndex: z.number(),
      selectedOption: z.string(),
    }))
    .mutation(async ({ input }) => withArenaInfrastructure(async () => {
      const room = await requireRoom(input.roomCode);
      engine.tick(room);
      const result = engine.submitAnswer(room, input.playerId, input.questionIndex, input.selectedOption);
      if (!result) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Cannot submit answer (already answered, wrong phase, or invalid question)',
        });
      }
      engine.tick(result.room);
      const saved = await roomRepository.saveRoom(result.room);
      return { isCorrect: result.isCorrect, room: engine.sanitizeRoom(saved) };
    })),

  nextQuestion: publicProcedure
    .input(z.object({ roomCode: z.string(), playerId: z.string() }))
    .mutation(async ({ input }) => withArenaInfrastructure(async () => {
      const room = await requireRoom(input.roomCode);
      engine.tick(room);
      const result = engine.advanceQuestion(room, input.playerId);
      if (!result) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Cannot advance question' });
      }
      const saved = await roomRepository.saveRoom(result);
      return { room: engine.sanitizeRoom(saved) };
    })),

  resetRoom: publicProcedure
    .input(z.object({ roomCode: z.string(), playerId: z.string() }))
    .mutation(async ({ input }) => withArenaInfrastructure(async () => {
      console.log('[Arena] resetRoom:', input.roomCode);
      const room = await requireRoom(input.roomCode);
      const result = engine.resetRoom(room, input.playerId);
      if (!result) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Cannot reset room' });
      }
      const saved = await roomRepository.saveRoom(result);
      return { room: engine.sanitizeRoom(saved) };
    })),

  getRoomState: publicProcedure
    .input(z.object({ roomCode: z.string(), playerId: z.string() }))
    .query(async ({ input }) => withArenaInfrastructure(async () => {
      const room = await requireRoom(input.roomCode);
      return { room: engine.sanitizeRoom(room) };
    })),

  heartbeat: publicProcedure
    .input(z.object({ roomCode: z.string(), playerId: z.string() }))
    .mutation(async ({ input }) => withArenaInfrastructure(async () => {
      await roomRepository.updatePlayerHeartbeat(input.roomCode, input.playerId);
      return { success: true };
    })),
});
