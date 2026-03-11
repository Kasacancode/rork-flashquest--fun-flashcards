import { Redis } from '@upstash/redis';

import { generateBattleRoomCode, normalizeRoomCode } from '../../utils/arenaInvite';
import type { Room, RoomPlayer } from './types';
import { ROOM_TTL_MS } from './types';

const ROOM_TTL_SECONDS = Math.ceil(ROOM_TTL_MS / 1000);
const KEY_PREFIX = 'flashquest:arena:room:';
const CODES_SET = 'flashquest:arena:codes';
const REDIS_ENV_ERROR_MESSAGE = 'Arena backend misconfigured: Redis environment variables missing.';

function roomKey(code: string): string {
  return `${KEY_PREFIX}${normalizeRoomCode(code)}`;
}

let redisInstance: Redis | null = null;

function getRepositoryErrorMessage(error: unknown, fallbackMessage: string): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return fallbackMessage;
}

function getRedis(): Redis {
  if (redisInstance) {
    return redisInstance;
  }

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    console.error('[Repo] Arena backend misconfigured: Redis environment variables missing.', {
      hasRedisUrl: Boolean(url),
      hasRedisToken: Boolean(token),
      nodeEnv: process.env.NODE_ENV ?? 'unknown',
    });
    throw new Error(REDIS_ENV_ERROR_MESSAGE);
  }

  redisInstance = new Redis({ url, token });
  console.log('[Repo] Upstash Redis client initialized');
  return redisInstance;
}

function serialize(room: Room): string {
  try {
    return JSON.stringify(room);
  } catch (error) {
    console.error('[Repo] Failed to serialize room:', error);
    throw new Error('Room serialization failed');
  }
}

function deserialize(data: unknown): Room | null {
  try {
    const raw = typeof data === 'string' ? JSON.parse(data) : data;
    if (!raw || typeof raw !== 'object') {
      return null;
    }

    const room = raw as Room;
    if (typeof room.code !== 'string' || typeof room.version !== 'number') {
      console.error('[Repo] Deserialized room has invalid shape');
      return null;
    }

    return room;
  } catch (error) {
    console.error('[Repo] Failed to deserialize room:', error);
    return null;
  }
}

function stampVersion(room: Room): Room {
  room.version += 1;
  room.updatedAt = Date.now();
  return room;
}

class RoomRepository {
  async getRoom(code: string): Promise<Room | null> {
    const normalizedCode = normalizeRoomCode(code);

    try {
      const redis = getRedis();
      const data = await redis.get(roomKey(normalizedCode));
      if (!data) {
        return null;
      }

      return deserialize(data);
    } catch (error) {
      console.error(`[Repo] Error reading room ${normalizedCode}:`, error);
      throw new Error(getRepositoryErrorMessage(error, `Failed to load room ${normalizedCode}`));
    }
  }

  async saveRoom(room: Room): Promise<Room> {
    room.code = normalizeRoomCode(room.code);

    try {
      const redis = getRedis();
      stampVersion(room);
      room.lastActivity = Date.now();
      await redis.set(roomKey(room.code), serialize(room), { ex: ROOM_TTL_SECONDS });
      return room;
    } catch (error) {
      console.error(`[Repo] Error saving room ${room.code}:`, error);
      throw new Error(getRepositoryErrorMessage(error, `Failed to save room ${room.code}`));
    }
  }

  async createRoom(room: Room): Promise<Room> {
    room.code = normalizeRoomCode(room.code);

    try {
      const redis = getRedis();
      room.version = 1;
      room.updatedAt = Date.now();
      room.lastActivity = Date.now();

      const pipeline = redis.pipeline();
      pipeline.set(roomKey(room.code), serialize(room), { ex: ROOM_TTL_SECONDS });
      pipeline.sadd(CODES_SET, room.code);
      await pipeline.exec();

      console.log(`[Repo] Created room ${room.code}`);
      return room;
    } catch (error) {
      console.error(`[Repo] Error creating room ${room.code}:`, error);
      throw new Error(getRepositoryErrorMessage(error, `Failed to create room ${room.code}`));
    }
  }

  async deleteRoom(code: string): Promise<void> {
    const normalizedCode = normalizeRoomCode(code);

    try {
      const redis = getRedis();
      const pipeline = redis.pipeline();
      pipeline.del(roomKey(normalizedCode));
      pipeline.srem(CODES_SET, normalizedCode);
      await pipeline.exec();
      console.log(`[Repo] Deleted room ${normalizedCode}`);
    } catch (error) {
      console.error(`[Repo] Error deleting room ${normalizedCode}:`, error);
      throw new Error(getRepositoryErrorMessage(error, `Failed to delete room ${normalizedCode}`));
    }
  }

  async refreshTTL(code: string): Promise<void> {
    const normalizedCode = normalizeRoomCode(code);

    try {
      const redis = getRedis();
      await redis.expire(roomKey(normalizedCode), ROOM_TTL_SECONDS);
    } catch (error) {
      console.error(`[Repo] Error refreshing TTL for room ${normalizedCode}:`, error);
      throw new Error(getRepositoryErrorMessage(error, `Failed to refresh room ${normalizedCode}`));
    }
  }

  async updatePlayerHeartbeat(code: string, playerId: string): Promise<Room | null> {
    const normalizedCode = normalizeRoomCode(code);

    try {
      const room = await this.getRoom(normalizedCode);
      if (!room) {
        return null;
      }

      const player = room.players.find((item: RoomPlayer) => item.id === playerId);
      if (player) {
        player.lastSeen = Date.now();
      }

      room.lastActivity = Date.now();

      const redis = getRedis();
      await redis.set(roomKey(normalizedCode), serialize(room), { ex: ROOM_TTL_SECONDS });

      return room;
    } catch (error) {
      console.error(`[Repo] Error updating heartbeat for ${playerId} in room ${normalizedCode}:`, error);
      throw new Error(getRepositoryErrorMessage(error, `Failed to update heartbeat for room ${normalizedCode}`));
    }
  }

  async getRoomCount(): Promise<number> {
    try {
      const redis = getRedis();
      const codes = await redis.smembers(CODES_SET) as string[];
      if (!codes || codes.length === 0) {
        return 0;
      }

      const pipeline = redis.pipeline();
      for (const code of codes) {
        pipeline.exists(roomKey(code));
      }
      const results = await pipeline.exec();

      let stale = 0;
      for (let index = 0; index < codes.length; index += 1) {
        if (results[index] === 0) {
          stale += 1;
          await redis.srem(CODES_SET, codes[index] ?? '');
        }
      }

      if (stale > 0) {
        console.log(`[Repo] Cleaned ${stale} stale codes from index set`);
      }

      return codes.length - stale;
    } catch (error) {
      console.error('[Repo] Error getting room count:', error);
      throw new Error(getRepositoryErrorMessage(error, 'Failed to count rooms'));
    }
  }

  async generateUniqueCode(): Promise<string> {
    const redis = getRedis();
    const maxAttempts = 100;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const code = generateBattleRoomCode();
      const exists = await redis.exists(roomKey(code));
      if (!exists) {
        return code;
      }
    }

    console.error('[Repo] Failed to generate unique code after max attempts');
    throw new Error('Could not generate unique room code');
  }
}

export const roomRepository = new RoomRepository();
