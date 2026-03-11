"use strict";
// --- Arena TRPC Router ---
// Thin orchestration layer: parse input → load from repo → delegate to engine → save → respond.
// All game logic lives in engine.ts, all persistence in repository.ts.
// Repository is now fully async (Redis-backed).
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.arenaRouter = void 0;
const server_1 = require("@trpc/server");
const zod_1 = require("zod");
const repository_1 = require("../../arena/repository");
const engine = __importStar(require("../../arena/engine"));
const create_context_1 = require("../create-context");
const arenaInvite_1 = require("../../../utils/arenaInvite");
async function requireRoom(code) {
    const normalizedCode = (0, arenaInvite_1.normalizeRoomCode)(code);
    const room = await repository_1.roomRepository.getRoom(normalizedCode);
    if (!room) {
        throw new server_1.TRPCError({ code: "NOT_FOUND", message: "Room not found or expired" });
    }
    return room;
}
exports.arenaRouter = (0, create_context_1.createTRPCRouter)({
    health: create_context_1.publicProcedure.query(async () => {
        const rooms = await repository_1.roomRepository.getRoomCount();
        return { status: "ok", rooms, timestamp: Date.now() };
    }),
    initRoom: create_context_1.publicProcedure
        .input(zod_1.z.object({ name: zod_1.z.string().min(1).max(20) }))
        .mutation(async ({ input }) => {
        console.log("[Arena] initRoom:", input.name);
        const code = await repository_1.roomRepository.generateUniqueCode();
        const { room, playerId } = engine.createNewRoom(input.name, code);
        const saved = await repository_1.roomRepository.createRoom(room);
        return { roomCode: saved.code, playerId, room: engine.sanitizeRoom(saved) };
    }),
    joinRoom: create_context_1.publicProcedure
        .input(zod_1.z.object({
        roomCode: zod_1.z.string().min(arenaInvite_1.ROOM_CODE_MIN_LENGTH).max(arenaInvite_1.ROOM_CODE_MAX_LENGTH).transform(arenaInvite_1.normalizeRoomCode).refine(arenaInvite_1.isRoomCodeValid, 'Invalid room code'),
        playerName: zod_1.z.string().min(1).max(20),
    }))
        .mutation(async ({ input }) => {
        console.log("[Arena] joinRoom:", input.playerName, "->", input.roomCode);
        const room = await requireRoom(input.roomCode);
        const result = engine.joinRoom(room, input.playerName);
        if (!result) {
            throw new server_1.TRPCError({
                code: "NOT_FOUND",
                message: "Room not found, full, or game already started",
            });
        }
        const saved = await repository_1.roomRepository.saveRoom(result.room);
        return { playerId: result.player.id, room: engine.sanitizeRoom(saved) };
    }),
    leaveRoom: create_context_1.publicProcedure
        .input(zod_1.z.object({ roomCode: zod_1.z.string(), playerId: zod_1.z.string() }))
        .mutation(async ({ input }) => {
        console.log("[Arena] leaveRoom:", input.playerId, "from", input.roomCode);
        const room = await repository_1.roomRepository.getRoom(input.roomCode);
        if (!room)
            return { success: true };
        const result = engine.leaveRoom(room, input.playerId);
        if (result === null) {
            await repository_1.roomRepository.deleteRoom(input.roomCode);
        }
        else {
            await repository_1.roomRepository.saveRoom(result);
        }
        return { success: true };
    }),
    removePlayer: create_context_1.publicProcedure
        .input(zod_1.z.object({
        roomCode: zod_1.z.string(),
        playerId: zod_1.z.string(),
        targetPlayerId: zod_1.z.string(),
    }))
        .mutation(async ({ input }) => {
        const room = await requireRoom(input.roomCode);
        const result = engine.removePlayer(room, input.targetPlayerId, input.playerId);
        if (!result) {
            throw new server_1.TRPCError({ code: "FORBIDDEN", message: "Cannot remove player" });
        }
        const saved = await repository_1.roomRepository.saveRoom(result);
        return { room: engine.sanitizeRoom(saved) };
    }),
    selectDeck: create_context_1.publicProcedure
        .input(zod_1.z.object({
        roomCode: zod_1.z.string(),
        playerId: zod_1.z.string(),
        deckId: zod_1.z.string(),
        deckName: zod_1.z.string(),
    }))
        .mutation(async ({ input }) => {
        const room = await requireRoom(input.roomCode);
        const result = engine.selectDeck(room, input.playerId, input.deckId, input.deckName);
        if (!result) {
            throw new server_1.TRPCError({ code: "FORBIDDEN", message: "Only host can select deck" });
        }
        const saved = await repository_1.roomRepository.saveRoom(result);
        return { room: engine.sanitizeRoom(saved) };
    }),
    updateSettings: create_context_1.publicProcedure
        .input(zod_1.z.object({
        roomCode: zod_1.z.string(),
        playerId: zod_1.z.string(),
        settings: zod_1.z.object({
            rounds: zod_1.z.number().optional(),
            timerSeconds: zod_1.z.number().optional(),
            showExplanationsAtEnd: zod_1.z.boolean().optional(),
        }),
    }))
        .mutation(async ({ input }) => {
        const room = await requireRoom(input.roomCode);
        const result = engine.updateSettings(room, input.playerId, input.settings);
        if (!result) {
            throw new server_1.TRPCError({ code: "FORBIDDEN", message: "Only host can update settings" });
        }
        const saved = await repository_1.roomRepository.saveRoom(result);
        return { room: engine.sanitizeRoom(saved) };
    }),
    startGame: create_context_1.publicProcedure
        .input(zod_1.z.object({
        roomCode: zod_1.z.string(),
        playerId: zod_1.z.string(),
        questions: zod_1.z.array(zod_1.z.object({
            cardId: zod_1.z.string(),
            question: zod_1.z.string(),
            correctAnswer: zod_1.z.string(),
            options: zod_1.z.array(zod_1.z.string()),
        })),
    }))
        .mutation(async ({ input }) => {
        console.log("[Arena] startGame in room", input.roomCode, "with", input.questions.length, "questions");
        const room = await requireRoom(input.roomCode);
        const result = engine.startGame(room, input.playerId, input.questions);
        if (!result) {
            throw new server_1.TRPCError({
                code: "BAD_REQUEST",
                message: "Cannot start game. Need 2+ players and a selected deck.",
            });
        }
        const saved = await repository_1.roomRepository.saveRoom(result);
        return { room: engine.sanitizeRoom(saved) };
    }),
    submitAnswer: create_context_1.publicProcedure
        .input(zod_1.z.object({
        roomCode: zod_1.z.string(),
        playerId: zod_1.z.string(),
        questionIndex: zod_1.z.number(),
        selectedOption: zod_1.z.string(),
    }))
        .mutation(async ({ input }) => {
        const room = await requireRoom(input.roomCode);
        engine.tick(room);
        const result = engine.submitAnswer(room, input.playerId, input.questionIndex, input.selectedOption);
        if (!result) {
            throw new server_1.TRPCError({
                code: "BAD_REQUEST",
                message: "Cannot submit answer (already answered, wrong phase, or invalid question)",
            });
        }
        engine.tick(result.room);
        const saved = await repository_1.roomRepository.saveRoom(result.room);
        return { isCorrect: result.isCorrect, room: engine.sanitizeRoom(saved) };
    }),
    nextQuestion: create_context_1.publicProcedure
        .input(zod_1.z.object({ roomCode: zod_1.z.string(), playerId: zod_1.z.string() }))
        .mutation(async ({ input }) => {
        const room = await requireRoom(input.roomCode);
        engine.tick(room);
        const result = engine.advanceQuestion(room, input.playerId);
        if (!result) {
            throw new server_1.TRPCError({ code: "BAD_REQUEST", message: "Cannot advance question" });
        }
        const saved = await repository_1.roomRepository.saveRoom(result);
        return { room: engine.sanitizeRoom(saved) };
    }),
    resetRoom: create_context_1.publicProcedure
        .input(zod_1.z.object({ roomCode: zod_1.z.string(), playerId: zod_1.z.string() }))
        .mutation(async ({ input }) => {
        console.log("[Arena] resetRoom:", input.roomCode);
        const room = await requireRoom(input.roomCode);
        const result = engine.resetRoom(room, input.playerId);
        if (!result) {
            throw new server_1.TRPCError({ code: "BAD_REQUEST", message: "Cannot reset room" });
        }
        const saved = await repository_1.roomRepository.saveRoom(result);
        return { room: engine.sanitizeRoom(saved) };
    }),
    getRoomState: create_context_1.publicProcedure
        .input(zod_1.z.object({ roomCode: zod_1.z.string(), playerId: zod_1.z.string() }))
        .query(async ({ input }) => {
        const room = await requireRoom(input.roomCode);
        return { room: engine.sanitizeRoom(room) };
    }),
    heartbeat: create_context_1.publicProcedure
        .input(zod_1.z.object({ roomCode: zod_1.z.string(), playerId: zod_1.z.string() }))
        .mutation(async ({ input }) => {
        await repository_1.roomRepository.updatePlayerHeartbeat(input.roomCode, input.playerId);
        return { success: true };
    }),
});
