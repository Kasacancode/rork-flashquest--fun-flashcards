"use strict";
// --- Redis-backed Arena Room Repository ---
//
// Key structure:
//   flashquest:arena:room:{code}  — JSON-serialized Room, with TTL
//   flashquest:arena:codes        — Redis SET of active room codes (for count + unique code gen)
//
// All methods are async. Upstash Redis (HTTP-based) is used as the sole source of truth.
// No in-memory Map fallback exists.
Object.defineProperty(exports, "__esModule", { value: true });
exports.roomRepository = void 0;
const redis_1 = require("@upstash/redis");
const arenaInvite_1 = require("../../utils/arenaInvite");
const types_1 = require("./types");
const ROOM_TTL_SECONDS = Math.ceil(types_1.ROOM_TTL_MS / 1000);
const KEY_PREFIX = 'flashquest:arena:room:';
const CODES_SET = 'flashquest:arena:codes';
function roomKey(code) {
    return `${KEY_PREFIX}${(0, arenaInvite_1.normalizeRoomCode)(code)}`;
}
let redisInstance = null;
function getRedis() {
    if (redisInstance)
        return redisInstance;
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!url || !token) {
        throw new Error('[Repo] Missing UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN env vars');
    }
    redisInstance = new redis_1.Redis({ url, token });
    console.log('[Repo] Upstash Redis client initialized');
    return redisInstance;
}
function serialize(room) {
    try {
        return JSON.stringify(room);
    }
    catch (err) {
        console.error('[Repo] Failed to serialize room:', err);
        throw new Error('Room serialization failed');
    }
}
function deserialize(data) {
    try {
        const raw = typeof data === 'string' ? JSON.parse(data) : data;
        if (!raw || typeof raw !== 'object')
            return null;
        const room = raw;
        if (typeof room.code !== 'string' || typeof room.version !== 'number') {
            console.error('[Repo] Deserialized room has invalid shape');
            return null;
        }
        return room;
    }
    catch (err) {
        console.error('[Repo] Failed to deserialize room:', err);
        return null;
    }
}
function stampVersion(room) {
    room.version += 1;
    room.updatedAt = Date.now();
    return room;
}
class RoomRepository {
    async getRoom(code) {
        try {
            const redis = getRedis();
            const data = await redis.get(roomKey(code));
            if (!data)
                return null;
            return deserialize(data);
        }
        catch (err) {
            console.error(`[Repo] Error reading room ${code}:`, err);
            return null;
        }
    }
    async saveRoom(room) {
        try {
            const redis = getRedis();
            room.code = (0, arenaInvite_1.normalizeRoomCode)(room.code);
            stampVersion(room);
            room.lastActivity = Date.now();
            await redis.set(roomKey(room.code), serialize(room), { ex: ROOM_TTL_SECONDS });
            return room;
        }
        catch (err) {
            console.error(`[Repo] Error saving room ${room.code}:`, err);
            throw new Error(`Failed to save room ${room.code}`);
        }
    }
    async createRoom(room) {
        try {
            const redis = getRedis();
            room.code = (0, arenaInvite_1.normalizeRoomCode)(room.code);
            room.version = 1;
            room.updatedAt = Date.now();
            room.lastActivity = Date.now();
            const pipeline = redis.pipeline();
            pipeline.set(roomKey(room.code), serialize(room), { ex: ROOM_TTL_SECONDS });
            pipeline.sadd(CODES_SET, room.code);
            await pipeline.exec();
            console.log(`[Repo] Created room ${room.code}`);
            return room;
        }
        catch (err) {
            console.error(`[Repo] Error creating room ${room.code}:`, err);
            throw new Error(`Failed to create room ${room.code}`);
        }
    }
    async deleteRoom(code) {
        try {
            const redis = getRedis();
            const pipeline = redis.pipeline();
            pipeline.del(roomKey(code));
            pipeline.srem(CODES_SET, code);
            await pipeline.exec();
            console.log(`[Repo] Deleted room ${code}`);
        }
        catch (err) {
            console.error(`[Repo] Error deleting room ${code}:`, err);
        }
    }
    async refreshTTL(code) {
        try {
            const redis = getRedis();
            await redis.expire(roomKey(code), ROOM_TTL_SECONDS);
        }
        catch (err) {
            console.error(`[Repo] Error refreshing TTL for room ${code}:`, err);
        }
    }
    async updatePlayerHeartbeat(code, playerId) {
        try {
            const room = await this.getRoom(code);
            if (!room)
                return null;
            const player = room.players.find((p) => p.id === playerId);
            if (player) {
                player.lastSeen = Date.now();
            }
            room.lastActivity = Date.now();
            const redis = getRedis();
            await redis.set(roomKey(code), serialize(room), { ex: ROOM_TTL_SECONDS });
            return room;
        }
        catch (err) {
            console.error(`[Repo] Error updating heartbeat for ${playerId} in room ${code}:`, err);
            return null;
        }
    }
    async getRoomCount() {
        try {
            const redis = getRedis();
            const codes = await redis.smembers(CODES_SET);
            if (!codes || codes.length === 0)
                return 0;
            const pipeline = redis.pipeline();
            for (const code of codes) {
                pipeline.exists(roomKey(code));
            }
            const results = await pipeline.exec();
            let stale = 0;
            for (let i = 0; i < codes.length; i++) {
                if (results[i] === 0) {
                    stale++;
                    await redis.srem(CODES_SET, codes[i]);
                }
            }
            if (stale > 0) {
                console.log(`[Repo] Cleaned ${stale} stale codes from index set`);
            }
            return codes.length - stale;
        }
        catch (err) {
            console.error('[Repo] Error getting room count:', err);
            return 0;
        }
    }
    async generateUniqueCode() {
        const redis = getRedis();
        const maxAttempts = 100;
        for (let i = 0; i < maxAttempts; i++) {
            const code = (0, arenaInvite_1.generateBattleRoomCode)();
            const exists = await redis.exists(roomKey(code));
            if (!exists)
                return code;
        }
        console.error('[Repo] Failed to generate unique code after max attempts');
        throw new Error('Could not generate unique room code');
    }
}
exports.roomRepository = new RoomRepository();
