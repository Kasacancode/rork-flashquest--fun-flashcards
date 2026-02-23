import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { roomStore } from "../../store/rooms";
import { createTRPCRouter, publicProcedure } from "../create-context";

export const arenaRouter = createTRPCRouter({
  health: publicProcedure.query(() => {
    return { status: "ok", rooms: roomStore.getRoomCount(), timestamp: Date.now() };
  }),

  initRoom: publicProcedure
    .input(z.object({ name: z.string().min(1).max(20) }))
    .mutation(({ input }) => {
      console.log("[Arena] initRoom:", input.name);
      const { room, playerId } = roomStore.initRoom(input.name);
      return { roomCode: room.code, playerId, room: roomStore.sanitize(room) };
    }),

  joinRoom: publicProcedure
    .input(z.object({
      roomCode: z.string().length(6),
      playerName: z.string().min(1).max(20),
    }))
    .mutation(({ input }) => {
      console.log("[Arena] joinRoom:", input.playerName, "->", input.roomCode);
      const result = roomStore.joinRoom(input.roomCode, input.playerName);
      if (!result) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Room not found, full, or already finished",
        });
      }
      return { playerId: result.player.id, role: result.player.role, room: roomStore.sanitize(result.room) };
    }),

  leaveRoom: publicProcedure
    .input(z.object({ roomCode: z.string(), playerId: z.string() }))
    .mutation(({ input }) => {
      console.log("[Arena] leaveRoom:", input.playerId, "from", input.roomCode);
      roomStore.leaveRoom(input.roomCode, input.playerId);
      return { success: true };
    }),

  removePlayer: publicProcedure
    .input(z.object({
      roomCode: z.string(),
      playerId: z.string(),
      targetPlayerId: z.string(),
    }))
    .mutation(({ input }) => {
      const room = roomStore.removePlayer(input.roomCode, input.targetPlayerId, input.playerId);
      if (!room) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Cannot remove player" });
      }
      return { room: roomStore.sanitize(room) };
    }),

  selectDeck: publicProcedure
    .input(z.object({
      roomCode: z.string(),
      playerId: z.string(),
      deckId: z.string(),
      deckName: z.string(),
    }))
    .mutation(({ input }) => {
      const room = roomStore.selectDeck(input.roomCode, input.playerId, input.deckId, input.deckName);
      if (!room) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only host can select deck" });
      }
      return { room: roomStore.sanitize(room) };
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
      const room = roomStore.updateSettings(input.roomCode, input.playerId, input.settings);
      if (!room) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only host can update settings" });
      }
      return { room: roomStore.sanitize(room) };
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
      const room = roomStore.startGame(input.roomCode, input.playerId, input.questions);
      if (!room) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot start game. Need 2+ players and a selected deck.",
        });
      }
      return { room: roomStore.sanitize(room) };
    }),

  submitAnswer: publicProcedure
    .input(z.object({
      roomCode: z.string(),
      playerId: z.string(),
      questionIndex: z.number(),
      selectedOption: z.string(),
    }))
    .mutation(({ input }) => {
      const result = roomStore.submitAnswer(
        input.roomCode,
        input.playerId,
        input.questionIndex,
        input.selectedOption,
      );
      if (!result) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot submit answer (already answered, wrong phase, or invalid question)",
        });
      }
      return { isCorrect: result.isCorrect, room: roomStore.sanitize(result.room) };
    }),

  nextQuestion: publicProcedure
    .input(z.object({ roomCode: z.string(), playerId: z.string() }))
    .mutation(({ input }) => {
      const room = roomStore.advanceQuestion(input.roomCode, input.playerId);
      if (!room) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot advance question" });
      }
      return { room: roomStore.sanitize(room) };
    }),

  resetRoom: publicProcedure
    .input(z.object({ roomCode: z.string(), playerId: z.string() }))
    .mutation(({ input }) => {
      console.log("[Arena] resetRoom:", input.roomCode);
      const room = roomStore.resetRoom(input.roomCode, input.playerId);
      if (!room) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot reset room" });
      }
      return { room: roomStore.sanitize(room) };
    }),

  getRoomState: publicProcedure
    .input(z.object({ roomCode: z.string(), playerId: z.string() }))
    .query(({ input }) => {
      roomStore.heartbeat(input.roomCode, input.playerId);
      roomStore.tick(input.roomCode);

      const room = roomStore.getRoom(input.roomCode);
      if (!room) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Room not found or expired" });
      }
      return { room: roomStore.sanitize(room) };
    }),

  heartbeat: publicProcedure
    .input(z.object({ roomCode: z.string(), playerId: z.string() }))
    .mutation(({ input }) => {
      roomStore.heartbeat(input.roomCode, input.playerId);
      return { success: true };
    }),

  reconnectRoom: publicProcedure
    .input(z.object({ roomCode: z.string(), playerId: z.string() }))
    .mutation(({ input }) => {
      console.log("[Arena] reconnectRoom:", input.playerId, "->", input.roomCode);
      const result = roomStore.reconnectPlayer(input.roomCode, input.playerId);
      if (!result) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Room not found or player not in room",
        });
      }
      return { room: roomStore.sanitize(result.room) };
    }),
});
