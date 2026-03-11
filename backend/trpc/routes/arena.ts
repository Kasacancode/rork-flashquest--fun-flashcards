// --- Arena TRPC Router ---
// Thin orchestration layer: parse input → load from repo → delegate to engine → save → respond.
// All game logic lives in engine.ts, all persistence in repository.ts.

import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { roomRepository } from "../../arena/repository";
import * as engine from "../../arena/engine";
import { createTRPCRouter, publicProcedure } from "../create-context";

function requireRoom(code: string) {
  const room = roomRepository.getRoom(code);
  if (!room) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Room not found or expired" });
  }
  return room;
}

export const arenaRouter = createTRPCRouter({
  health: publicProcedure.query(() => {
    return { status: "ok", rooms: roomRepository.getRoomCount(), timestamp: Date.now() };
  }),

  initRoom: publicProcedure
    .input(z.object({ name: z.string().min(1).max(20) }))
    .mutation(({ input }) => {
      console.log("[Arena] initRoom:", input.name);
      const code = roomRepository.generateUniqueCode();
      const { room, playerId } = engine.createNewRoom(input.name, code);
      const saved = roomRepository.createRoom(room);
      return { roomCode: saved.code, playerId, room: engine.sanitizeRoom(saved) };
    }),

  joinRoom: publicProcedure
    .input(z.object({
      roomCode: z.string().length(6),
      playerName: z.string().min(1).max(20),
    }))
    .mutation(({ input }) => {
      console.log("[Arena] joinRoom:", input.playerName, "->", input.roomCode);
      const room = requireRoom(input.roomCode);
      const result = engine.joinRoom(room, input.playerName);
      if (!result) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Room not found, full, or game already started",
        });
      }
      const saved = roomRepository.saveRoom(result.room);
      return { playerId: result.player.id, room: engine.sanitizeRoom(saved) };
    }),

  leaveRoom: publicProcedure
    .input(z.object({ roomCode: z.string(), playerId: z.string() }))
    .mutation(({ input }) => {
      console.log("[Arena] leaveRoom:", input.playerId, "from", input.roomCode);
      const room = roomRepository.getRoom(input.roomCode);
      if (!room) return { success: true };

      const result = engine.leaveRoom(room, input.playerId);
      if (result === null) {
        roomRepository.deleteRoom(input.roomCode);
      } else {
        roomRepository.saveRoom(result);
      }
      return { success: true };
    }),

  removePlayer: publicProcedure
    .input(z.object({
      roomCode: z.string(),
      playerId: z.string(),
      targetPlayerId: z.string(),
    }))
    .mutation(({ input }) => {
      const room = requireRoom(input.roomCode);
      const result = engine.removePlayer(room, input.targetPlayerId, input.playerId);
      if (!result) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Cannot remove player" });
      }
      const saved = roomRepository.saveRoom(result);
      return { room: engine.sanitizeRoom(saved) };
    }),

  selectDeck: publicProcedure
    .input(z.object({
      roomCode: z.string(),
      playerId: z.string(),
      deckId: z.string(),
      deckName: z.string(),
    }))
    .mutation(({ input }) => {
      const room = requireRoom(input.roomCode);
      const result = engine.selectDeck(room, input.playerId, input.deckId, input.deckName);
      if (!result) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only host can select deck" });
      }
      const saved = roomRepository.saveRoom(result);
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
    .mutation(({ input }) => {
      const room = requireRoom(input.roomCode);
      const result = engine.updateSettings(room, input.playerId, input.settings);
      if (!result) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only host can update settings" });
      }
      const saved = roomRepository.saveRoom(result);
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
    .mutation(({ input }) => {
      console.log("[Arena] startGame in room", input.roomCode, "with", input.questions.length, "questions");
      const room = requireRoom(input.roomCode);
      const result = engine.startGame(room, input.playerId, input.questions);
      if (!result) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot start game. Need 2+ players and a selected deck.",
        });
      }
      const saved = roomRepository.saveRoom(result);
      return { room: engine.sanitizeRoom(saved) };
    }),

  submitAnswer: publicProcedure
    .input(z.object({
      roomCode: z.string(),
      playerId: z.string(),
      questionIndex: z.number(),
      selectedOption: z.string(),
    }))
    .mutation(({ input }) => {
      const room = requireRoom(input.roomCode);
      const result = engine.submitAnswer(room, input.playerId, input.questionIndex, input.selectedOption);
      if (!result) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot submit answer (already answered, wrong phase, or invalid question)",
        });
      }
      engine.tick(result.room);
      const saved = roomRepository.saveRoom(result.room);
      return { isCorrect: result.isCorrect, room: engine.sanitizeRoom(saved) };
    }),

  nextQuestion: publicProcedure
    .input(z.object({ roomCode: z.string(), playerId: z.string() }))
    .mutation(({ input }) => {
      const room = requireRoom(input.roomCode);
      const result = engine.advanceQuestion(room, input.playerId);
      if (!result) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot advance question" });
      }
      const saved = roomRepository.saveRoom(result);
      return { room: engine.sanitizeRoom(saved) };
    }),

  resetRoom: publicProcedure
    .input(z.object({ roomCode: z.string(), playerId: z.string() }))
    .mutation(({ input }) => {
      console.log("[Arena] resetRoom:", input.roomCode);
      const room = requireRoom(input.roomCode);
      const result = engine.resetRoom(room, input.playerId);
      if (!result) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot reset room" });
      }
      const saved = roomRepository.saveRoom(result);
      return { room: engine.sanitizeRoom(saved) };
    }),

  // getRoomState is read-only. It does NOT call heartbeat or tick.
  // Phase transitions are driven by heartbeat (below) and mutations.
  getRoomState: publicProcedure
    .input(z.object({ roomCode: z.string(), playerId: z.string() }))
    .query(({ input }) => {
      const room = requireRoom(input.roomCode);
      return { room: engine.sanitizeRoom(room) };
    }),

  // Heartbeat: updates player lastSeen, refreshes TTL, and runs tick
  // to advance game phases. Clients should call this every few seconds.
  heartbeat: publicProcedure
    .input(z.object({ roomCode: z.string(), playerId: z.string() }))
    .mutation(({ input }) => {
      const room = roomRepository.updatePlayerHeartbeat(input.roomCode, input.playerId);
      if (!room) return { success: true };

      const changed = engine.tick(room);
      if (changed) {
        roomRepository.saveRoom(room);
      }
      return { success: true };
    }),
});
