import type { Room, RoomPlayer } from './types';
import { ROOM_TTL_MS } from './types';

interface StoredEntry {
  data: string;
  expiresAt: number;
}

function serialize(room: Room): string {
  try {
    return JSON.stringify(room);
  } catch (err) {
    console.error('[Repo] Failed to serialize room:', err);
    throw new Error('Room serialization failed');
  }
}

function deserialize(data: string): Room | null {
  try {
    const parsed = JSON.parse(data) as Room;
    if (!parsed || typeof parsed.code !== 'string' || typeof parsed.version !== 'number') {
      console.error('[Repo] Deserialized room has invalid shape');
      return null;
    }
    return parsed;
  } catch (err) {
    console.error('[Repo] Failed to deserialize room:', err);
    return null;
  }
}

function stampVersion(room: Room): Room {
  room.version += 1;
  room.updatedAt = Date.now();
  return room;
}

function isExpired(entry: StoredEntry): boolean {
  return Date.now() > entry.expiresAt;
}

class RoomRepository {
  private store = new Map<string, StoredEntry>();
  private lastCleanup = Date.now();
  private cleanupIntervalMs = 60_000;

  getRoom(code: string): Room | null {
    this.maybeCleanup();
    try {
      const entry = this.store.get(code);
      if (!entry) return null;
      if (isExpired(entry)) {
        console.log(`[Repo] Room ${code} expired via TTL`);
        this.store.delete(code);
        return null;
      }
      return deserialize(entry.data);
    } catch (err) {
      console.error(`[Repo] Error reading room ${code}:`, err);
      return null;
    }
  }

  saveRoom(room: Room): Room {
    try {
      stampVersion(room);
      room.lastActivity = Date.now();
      this.store.set(room.code, {
        data: serialize(room),
        expiresAt: Date.now() + ROOM_TTL_MS,
      });
      return room;
    } catch (err) {
      console.error(`[Repo] Error saving room ${room.code}:`, err);
      throw new Error(`Failed to save room ${room.code}`);
    }
  }

  createRoom(room: Room): Room {
    try {
      room.version = 1;
      room.updatedAt = Date.now();
      room.lastActivity = Date.now();
      this.store.set(room.code, {
        data: serialize(room),
        expiresAt: Date.now() + ROOM_TTL_MS,
      });
      console.log(`[Repo] Created room ${room.code}`);
      return room;
    } catch (err) {
      console.error(`[Repo] Error creating room ${room.code}:`, err);
      throw new Error(`Failed to create room ${room.code}`);
    }
  }

  deleteRoom(code: string): void {
    try {
      this.store.delete(code);
      console.log(`[Repo] Deleted room ${code}`);
    } catch (err) {
      console.error(`[Repo] Error deleting room ${code}:`, err);
    }
  }

  refreshTTL(code: string): void {
    try {
      const entry = this.store.get(code);
      if (entry && !isExpired(entry)) {
        entry.expiresAt = Date.now() + ROOM_TTL_MS;
      }
    } catch (err) {
      console.error(`[Repo] Error refreshing TTL for room ${code}:`, err);
    }
  }

  updatePlayerHeartbeat(code: string, playerId: string): Room | null {
    try {
      const entry = this.store.get(code);
      if (!entry || isExpired(entry)) return null;

      const room = deserialize(entry.data);
      if (!room) return null;

      const player = room.players.find((p: RoomPlayer) => p.id === playerId);
      if (player) {
        player.lastSeen = Date.now();
      }

      room.lastActivity = Date.now();

      entry.data = serialize(room);
      entry.expiresAt = Date.now() + ROOM_TTL_MS;

      return room;
    } catch (err) {
      console.error(`[Repo] Error updating heartbeat for ${playerId} in room ${code}:`, err);
      return null;
    }
  }

  getRoomCount(): number {
    this.maybeCleanup();
    return this.store.size;
  }

  generateUniqueCode(): string {
    const maxAttempts = 100;
    for (let i = 0; i < maxAttempts; i++) {
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      if (!this.store.has(code)) return code;
    }
    console.error('[Repo] Failed to generate unique code after max attempts');
    throw new Error('Could not generate unique room code');
  }

  private maybeCleanup(): void {
    const now = Date.now();
    if (now - this.lastCleanup < this.cleanupIntervalMs) return;
    this.lastCleanup = now;

    let cleaned = 0;
    for (const [code, entry] of this.store.entries()) {
      if (isExpired(entry)) {
        this.store.delete(code);
        cleaned++;
      }
    }
    if (cleaned > 0) {
      console.log(`[Repo] Cleaned ${cleaned} expired rooms`);
    }
  }
}

export const roomRepository = new RoomRepository();
