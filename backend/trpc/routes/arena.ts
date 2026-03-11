// --- Arena TRPC Router ---
// Thin orchestration layer: parse input → load from repo → delegate to engine → save → respond.
// All game logic lives in engine.ts, all persistence in repository.ts.
// Repository is now fully async (Redis-backed).

import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { roomRepository } from "../../arena/repository";
import * as engine from "../../arena/engine";
import { createTRPCRouter, publicProcedure } from "../create-context";

async function requireRoom(code: string) {
  const room = await roomRepository.getRoom(code);
  if (!room) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Room not found or expired" });
  }
  return room;
}

export const arenaRouter = createTRPCRouter({
  health: publicProcedure.query(async () => {
    const rooms = await roomRepository.getRoomCount();
    return { status: "ok", rooms, timestamp: Date.now() };
  }),

  initRoom: publicProcedure
    .input(z.object({ name: z.string().min(1).max(20) }))
    .mutation(async ({ input }) => {
      console.log("[Arena] initRoom:", input.name);
      const code = await roomRepository.generateUniqueCode();
      const { room, playerId } = engine.createNewRoom(input.name, code);
      const saved = await roomRepository.createRoom(room);
      return { roomCode: saved.code, playerId, room: engine.sanitizeRoom(saved) };
    }),

  joinRoom: publicProcedure
    .input(z.object({
      roomCode: z.string().length(6),
      playerName: z.string().min(1).max(20),
    }))
    .mutation(async ({ input }) => {
      console.log("[Arena] joinRoom:", input.playerName, "->", input.roomCode);
      const room = await requireRoom(input.roomCode);
      const result = engine.joinRoom(room, input.playerName);
      if (!result) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Room not found, full, or game already started",
        });
      }
      const saved = await roomRepository.saveRoom(result.room);
      return { playerId: result.player.id, room: engine.sanitizeRoom(saved) };
    }),

  leaveRoom: publicProcedure
    .input(z.object({ roomCode: z.string(), playerId: z.string() }))
    .mutation(async ({ input }) => {
      console.log("[Arena] leaveRoom:", input.playerId, "from", input.roomCode);
      const room = await roomRepository.getRoom(input.roomCode);
      if (!room) return { success: true };

      const result = engine.leaveRoom(room, input.playerId);
      if (result === null) {
        await roomRepository.deleteRoom(input.roomCode);
      } else {
        await roomRepository.saveRoom(result);
      }
      return { success: true };
    }),

  removePlayer: publicProcedure
    .input(z.object({
      roomCode: z.string(),
      playerId: z.string(),
      targetPlayerId: z.string(),
    }))
    .mutation(async ({ input }) => {
      const room = await requireRoom(input.roomCode);
      const result = engine.removePlayer(room, input.targetPlayerId, input.playerId);
      if (!result) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Cannot remove player" });
      }
      const saved = await roomRepository.saveRoom(result);
      return { room: engine.sanitizeRoom(saved) };
    }),

  selectDeck: publicProcedure
    .input(z.object({
      roomCode: z.string(),
      playerId: z.string(),
      deckId: z.string(),
      deckName: z.string(),
    }))
    .mutation(async ({ input }) => {
      const room = await requireRoom(input.roomCode);
      const result = engine.selectDeck(room, input.playerId, input.deckId, input.deckName);
      if (!result) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only host can select deck" });
      }
      const saved = await roomRepository.saveRoom(result);
      return { room: engine.sanitizeRoom(saved) };
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
      const room = await requireRoom(input.roomCode);
      const result = engine.updateSettings(room, input.playerId, input.settings);
      if (!result) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only host can update settings" });
      }
      const saved = await roomRepository.saveRoom(result);
      return { room: engine.sanitizeRoom(saved) };
    }),

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
    .mutation(async ({ input }) => {
      console.log("[Arena] startGame in room", input.roomCode, "with", input.questions.length, "questions");
      const room = await requireRoom(input.roomCode);
      const result = engine.startGame(room, input.playerId, input.questions);
      if (!result) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot start game. Need 2+ players and a selected deck.",
        });
      }
      const saved = await roomRepository.saveRoom(result);
      return { room: engine.sanitizeRoom(saved) };
    }),

  submitAnswer: publicProcedure
    .input(z.object({
      roomCode: z.string(),
      playerId: z.string(),
      questionIndex: z.number(),
      selectedOption: z.string(),
    }))
    .mutation(async ({ input }) => {
      const room = await requireRoom(input.roomCode);
      const result = engine.submitAnswer(room, input.playerId, input.questionIndex, input.selectedOption);
      if (!result) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot submit answer (already answered, wrong phase, or invalid question)",
        });
      }
      engine.tick(result.room);
      const saved = await roomRepository.saveRoom(result.room);
      return { isCorrect: result.isCorrect, room: engine.sanitizeRoom(saved) };
    }),

  nextQuestion: publicProcedure
    .input(z.object({ roomCode: z.string(), playerId: z.string() }))
    .mutation(async ({ input }) => {
      const room = await requireRoom(input.roomCode);
      const result = engine.advanceQuestion(room, input.playerId);
      if (!result) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot advance question" });
      }
      const saved = await roomRepository.saveRoom(result);
      return { room: engine.sanitizeRoom(saved) };
    }),

  resetRoom: publicProcedure
    .input(z.object({ roomCode: z.string(), playerId: z.string() }))
    .mutation(async ({ input }) => {
      console.log("[Arena] resetRoom:", input.roomCode);
      const room = await requireRoom(input.roomCode);
      const result = engine.resetRoom(room, input.playerId);
      if (!result) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot reset room" });
      }
      const saved = await roomRepository.saveRoom(result);
      return { room: engine.sanitizeRoom(saved) };
    }),

  getRoomState: publicProcedure
    .input(z.object({ roomCode: z.string(), playerId: z.string() }))
    .query(async ({ input }) => {
      const room = await requireRoom(input.roomCode);
      return { room: engine.sanitizeRoom(room) };
    }),

  heartbeat: publicProcedure
    .input(z.object({ roomCode: z.string(), playerId: z.string() }))
    .mutation(async ({ input }) => {
      const room = await roomRepository.updatePlayerHeartbeat(input.roomCode, input.playerId);
      if (!room) return { success: true };

      const changed = engine.tick(room);
      if (changed) {
        await roomRepository.saveRoom(room);
      }
      return { success: true };
    }),
});
