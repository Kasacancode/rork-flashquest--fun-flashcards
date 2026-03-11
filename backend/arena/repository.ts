// --- Arena Room Repository ---
// Persistence layer for room state. Currently backed by an in-memory Map with TTL.
// Designed so swapping to Redis requires only changing this file.
// Each room is stored with an expiration timestamp (mirrors Redis TTL).
// Version is incremented on every save for optimistic concurrency.

import type { Room, RoomPlayer } from './types';
import { ROOM_TTL_MS } from './types';

interface StoredEntry {
  room: Room;
  expiresAt: number;
}

class RoomRepository {
  private store = new Map<string, StoredEntry>();
  private lastCleanup = Date.now();
  private cleanupIntervalMs = 60_000;

  getRoom(code: string): Room | null {
    this.maybeCleanup();
    const entry = this.store.get(code);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      console.log(`[Repo] Room ${code} expired via TTL`);
      this.store.delete(code);
      return null;
    }
    return entry.room;
  }

  saveRoom(room: Room): Room {
    room.version += 1;
    room.updatedAt = Date.now();
    room.lastActivity = Date.now();
    this.store.set(room.code, {
      room,
      expiresAt: Date.now() + ROOM_TTL_MS,
    });
    return room;
  }

  createRoom(room: Room): Room {
    room.version = 1;
    room.updatedAt = Date.now();
    this.store.set(room.code, {
      room,
      expiresAt: Date.now() + ROOM_TTL_MS,
    });
    console.log(`[Repo] Created room ${room.code}`);
    return room;
  }

  deleteRoom(code: string): void {
    this.store.delete(code);
    console.log(`[Repo] Deleted room ${code}`);
  }

  refreshTTL(code: string): void {
    const entry = this.store.get(code);
    if (entry) {
      entry.expiresAt = Date.now() + ROOM_TTL_MS;
    }
  }

  updatePlayerHeartbeat(code: string, playerId: string): Room | null {
    const entry = this.store.get(code);
    if (!entry || Date.now() > entry.expiresAt) return null;

    const player = entry.room.players.find((p: RoomPlayer) => p.id === playerId);
    if (player) {
      player.lastSeen = Date.now();
    }
    entry.room.lastActivity = Date.now();
    entry.expiresAt = Date.now() + ROOM_TTL_MS;
    return entry.room;
  }

  getRoomCount(): number {
    this.maybeCleanup();
    return this.store.size;
  }

  generateUniqueCode(): string {
    let code: string;
    do {
      code = Math.floor(100000 + Math.random() * 900000).toString();
    } while (this.store.has(code));
    return code;
  }

  private maybeCleanup(): void {
    const now = Date.now();
    if (now - this.lastCleanup < this.cleanupIntervalMs) return;
    this.lastCleanup = now;

    let cleaned = 0;
    for (const [code, entry] of this.store.entries()) {
      if (now > entry.expiresAt) {
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
