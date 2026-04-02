// --- Redis-backed Arena Room Repository ---
//
// Key structure:
//   flashquest:arena:room:{code}  - JSON-serialized Room, with TTL
//   flashquest:arena:codes        - Redis SET of active room codes (for count + unique code gen)
//
// All methods are async. Upstash Redis (HTTP-based) is used as the sole source of truth.
// No in-memory Map fallback exists.

import { Redis } from '@upstash/redis';
import { analyticsRepository } from '../analytics/repository';
import { createRedisConfigError, isRedisConfigError } from '../errors';
import type { ArenaPreparedDeck, Room } from './types';
import { ROOM_TTL_MS } from './types';

const ROOM_TTL_SECONDS = Math.ceil(ROOM_TTL_MS / 1000);
const KEY_PREFIX = 'flashquest:arena:room:';
const PRESENCE_KEY_PREFIX = 'flashquest:arena:presence:';
const ROOM_DECK_KEY_PREFIX = 'flashquest:arena:deck:';
const ROOM_LOCK_KEY_PREFIX = 'flashquest:arena:lock:';
const CODES_SET = 'flashquest:arena:codes';
const ROOM_CODE_CHARACTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const ROOM_CODE_LENGTH = 4;
const ROOM_LOCK_TTL_MS = 4000;
const ROOM_LOCK_RETRY_DELAY_MS = 60;
const ROOM_LOCK_RETRY_ATTEMPTS = 50;

function roomKey(code: string): string {
  return `${KEY_PREFIX}${code}`;
}

function presenceKey(code: string): string {
  return `${PRESENCE_KEY_PREFIX}${code}`;
}

function deckKey(code: string): string {
  return `${ROOM_DECK_KEY_PREFIX}${code}`;
}

function roomLockKey(code: string): string {
  return `${ROOM_LOCK_KEY_PREFIX}${code}`;
}

let redisInstance: Redis | null = null;

function getRedis(): Redis {
  if (redisInstance) return redisInstance;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    throw createRedisConfigError('[ArenaRepo] Missing UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN');
  }

  redisInstance = new Redis({ url, token });
  return redisInstance;
}

function rethrowRedisConfigError(error: unknown): void {
  if (isRedisConfigError(error)) {
    throw error;
  }
}

function serialize(room: Room): string {
  try {
    return JSON.stringify(room);
  } catch (err) {
    console.error('[Repo] Failed to serialize room:', err);
    throw new Error('Room serialization failed');
  }
}

function deserialize(data: unknown): Room | null {
  try {
    const raw = typeof data === 'string' ? JSON.parse(data) : data;
    if (!raw || typeof raw !== 'object') return null;
    const room = raw as Room;
    if (typeof room.code !== 'string' || typeof room.version !== 'number') {
      console.error('[Repo] Deserialized room has invalid shape');
      return null;
    }
    return room;
  } catch (err) {
    console.error('[Repo] Failed to deserialize room:', err);
    return null;
  }
}

function serializePreparedDeck(preparedDeck: ArenaPreparedDeck): string {
  try {
    return JSON.stringify(preparedDeck);
  } catch (err) {
    console.error('[Repo] Failed to serialize prepared deck:', err);
    throw new Error('Prepared deck serialization failed');
  }
}

function deserializePreparedDeck(data: unknown): ArenaPreparedDeck | null {
  try {
    const raw = typeof data === 'string' ? JSON.parse(data) : data;
    if (!raw || typeof raw !== 'object') return null;
    const preparedDeck = raw as ArenaPreparedDeck;
    if (typeof preparedDeck.deckId !== 'string' || !Array.isArray(preparedDeck.cards)) {
      console.error('[Repo] Deserialized prepared deck has invalid shape');
      return null;
    }
    return preparedDeck;
  } catch (err) {
    console.error('[Repo] Failed to deserialize prepared deck:', err);
    return null;
  }
}

function stampVersion(room: Room): Room {
  room.version += 1;
  room.updatedAt = Date.now();
  return room;
}

function generateRoomCode(): string {
  let code = '';

  for (let index = 0; index < ROOM_CODE_LENGTH; index += 1) {
    const randomIndex = Math.floor(Math.random() * ROOM_CODE_CHARACTERS.length);
    code += ROOM_CODE_CHARACTERS[randomIndex] ?? 'A';
  }

  return code;
}

function isRedisWriteSuccess(result: unknown): boolean {
  return result === 'OK' || result === true;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function isFinishedRoom(room: Room): boolean {
  return room.status === 'finished' && room.game?.phase === 'finished' && room.game.finishedAt != null;
}

class RoomRepository {
  async withRoomLock<T>(code: string, task: () => Promise<T>): Promise<T> {
    const redis = getRedis();
    const lockKey = roomLockKey(code);
    const token = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
    let acquired = false;

    for (let attempt = 0; attempt < ROOM_LOCK_RETRY_ATTEMPTS; attempt += 1) {
      const result = await redis.set(lockKey, token, { nx: true, px: ROOM_LOCK_TTL_MS });
      if (isRedisWriteSuccess(result)) {
        acquired = true;
        break;
      }

      await sleep(ROOM_LOCK_RETRY_DELAY_MS);
    }

    if (!acquired) {
      throw new Error(`Could not acquire room lock for ${code}`);
    }

    try {
      return await task();
    } finally {
      try {
        const currentToken = await redis.get<string>(lockKey);
        if (currentToken === token) {
          await redis.del(lockKey);
        }
      } catch (err) {
        rethrowRedisConfigError(err);
        console.error(`[Repo] Error releasing room lock for ${code}:`, err);
      }
    }
  }

  async getRoom(code: string): Promise<Room | null> {
    try {
      const redis = getRedis();
      const data = await redis.get(roomKey(code));
      if (!data) return null;
      return deserialize(data);
    } catch (err) {
      rethrowRedisConfigError(err);
      console.error(`[Repo] Error reading room ${code}:`, err);
      return null;
    }
  }

  async saveRoom(room: Room): Promise<Room> {
    try {
      const redis = getRedis();
      stampVersion(room);
      room.lastActivity = Date.now();
      await redis.set(roomKey(room.code), serialize(room), { ex: ROOM_TTL_SECONDS });

      if (isFinishedRoom(room)) {
        try {
          await analyticsRepository.trackBattleFinishedOnce(room);
        } catch (analyticsError) {
          console.error(`[Repo] Failed to record battle_finished analytics for room ${room.code}:`, analyticsError);
        }
      }

      return room;
    } catch (err) {
      rethrowRedisConfigError(err);
      console.error(`[Repo] Error saving room ${room.code}:`, err);
      throw new Error(`Failed to save room ${room.code}`);
    }
  }

  async createRoom(room: Room): Promise<Room> {
    try {
      const redis = getRedis();
      room.version = 1;
      room.updatedAt = Date.now();
      room.lastActivity = Date.now();

      const pipeline = redis.pipeline();
      pipeline.set(roomKey(room.code), serialize(room), { ex: ROOM_TTL_SECONDS });
      pipeline.sadd(CODES_SET, room.code);
      await pipeline.exec();

      await redis.hset(presenceKey(room.code), {
        [room.hostId]: room.players[0]?.lastSeen ?? Date.now(),
      });
      await redis.expire(presenceKey(room.code), ROOM_TTL_SECONDS);

      return room;
    } catch (err) {
      rethrowRedisConfigError(err);
      console.error(`[Repo] Error creating room ${room.code}:`, err);
      throw new Error(`Failed to create room ${room.code}`);
    }
  }

  async savePreparedDeck(code: string, preparedDeck: ArenaPreparedDeck): Promise<ArenaPreparedDeck> {
    try {
      const redis = getRedis();
      await redis.set(deckKey(code), serializePreparedDeck(preparedDeck), { ex: ROOM_TTL_SECONDS });
      return preparedDeck;
    } catch (err) {
      rethrowRedisConfigError(err);
      console.error(`[Repo] Error saving prepared deck for room ${code}:`, err);
      throw new Error(`Failed to save prepared deck for room ${code}`);
    }
  }

  async getPreparedDeck(code: string): Promise<ArenaPreparedDeck | null> {
    try {
      const redis = getRedis();
      const data = await redis.get(deckKey(code));
      if (!data) return null;
      return deserializePreparedDeck(data);
    } catch (err) {
      rethrowRedisConfigError(err);
      console.error(`[Repo] Error reading prepared deck for room ${code}:`, err);
      return null;
    }
  }

  async deletePreparedDeck(code: string): Promise<void> {
    try {
      const redis = getRedis();
      await redis.del(deckKey(code));
    } catch (err) {
      rethrowRedisConfigError(err);
      console.error(`[Repo] Error deleting prepared deck for room ${code}:`, err);
    }
  }

  async deleteRoom(code: string): Promise<void> {
    try {
      const redis = getRedis();
      const pipeline = redis.pipeline();
      pipeline.del(roomKey(code));
      pipeline.del(presenceKey(code));
      pipeline.del(deckKey(code));
      pipeline.srem(CODES_SET, code);
      await pipeline.exec();
    } catch (err) {
      rethrowRedisConfigError(err);
      console.error(`[Repo] Error deleting room ${code}:`, err);
    }
  }

  async refreshTTL(code: string): Promise<void> {
    try {
      const redis = getRedis();
      await redis.expire(roomKey(code), ROOM_TTL_SECONDS);
      await redis.expire(presenceKey(code), ROOM_TTL_SECONDS);
      await redis.expire(deckKey(code), ROOM_TTL_SECONDS);
    } catch (err) {
      rethrowRedisConfigError(err);
      console.error(`[Repo] Error refreshing TTL for room ${code}:`, err);
    }
  }

  async updatePlayerHeartbeat(code: string, playerId: string): Promise<void> {
    try {
      const redis = getRedis();
      const exists = await redis.exists(roomKey(code));
      if (!exists) return;

      await redis.hset(presenceKey(code), { [playerId]: Date.now() });
      await redis.expire(roomKey(code), ROOM_TTL_SECONDS);
      await redis.expire(presenceKey(code), ROOM_TTL_SECONDS);
      await redis.expire(deckKey(code), ROOM_TTL_SECONDS);
    } catch (err) {
      rethrowRedisConfigError(err);
      console.error(`[Repo] Error updating heartbeat for ${playerId} in room ${code}:`, err);
    }
  }

  async getPlayerHeartbeats(code: string): Promise<Record<string, number>> {
    try {
      const redis = getRedis();
      const data = await redis.hgetall(presenceKey(code));
      if (!data || typeof data !== 'object') {
        return {};
      }

      return Object.fromEntries(
        Object.entries(data as Record<string, unknown>)
          .map(([id, value]) => {
            const parsed = typeof value === 'number' ? value : Number(value);
            return [id, parsed] as const;
          })
          .filter((entry) => Number.isFinite(entry[1]))
      );
    } catch (err) {
      rethrowRedisConfigError(err);
      console.error(`[Repo] Error getting heartbeats for room ${code}:`, err);
      return {};
    }
  }

  async getRoomCount(): Promise<number> {
    try {
      const redis = getRedis();
      const codes = await redis.smembers(CODES_SET) as string[];
      if (!codes || codes.length === 0) return 0;

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
      return codes.length - stale;
    } catch (err) {
      rethrowRedisConfigError(err);
      console.error('[Repo] Error getting room count:', err);
      return 0;
    }
  }

  async generateUniqueCode(): Promise<string> {
    const redis = getRedis();
    const maxAttempts = 100;

    for (let i = 0; i < maxAttempts; i++) {
      const code = generateRoomCode();
      const exists = await redis.exists(roomKey(code));
      if (!exists) return code;
    }

    console.error('[Repo] Failed to generate unique code after max attempts');
    throw new Error('Could not generate unique room code');
  }
}

export const roomRepository = new RoomRepository();
