import { describe, it, expect } from 'bun:test';

import {
  createNewRoom,
  joinRoom,
  leaveRoom,
  updateSettings,
  sanitizeRoom,
} from '../engine';
import { MAX_PLAYERS, DEFAULT_ARENA_SETTINGS } from '../types';

describe('createNewRoom', () => {
  it('creates a room with the given code', () => {
    const { room } = createNewRoom('Alice', 'ABCD');
    expect(room.code).toBe('ABCD');
  });

  it('sets the creator as host', () => {
    const { room, playerId } = createNewRoom('Alice', 'ABCD');
    expect(room.hostId).toBe(playerId);
    expect(room.players[0]!.isHost).toBe(true);
  });

  it('starts with one player', () => {
    const { room } = createNewRoom('Alice', 'ABCD');
    expect(room.players).toHaveLength(1);
  });

  it('sets the player name', () => {
    const { room } = createNewRoom('Alice', 'ABCD');
    expect(room.players[0]!.name).toBe('Alice');
  });

  it('starts in lobby state with no game', () => {
    const { room } = createNewRoom('Alice', 'ABCD');
    expect(room.game).toBeNull();
  });

  it('uses default settings', () => {
    const { room } = createNewRoom('Alice', 'ABCD');
    expect(room.settings.rounds).toBe(DEFAULT_ARENA_SETTINGS.rounds);
  });

  it('returns a unique player ID', () => {
    const { playerId: firstId } = createNewRoom('Alice', 'ABCD');
    const { playerId: secondId } = createNewRoom('Bob', 'EFGH');
    expect(firstId).not.toBe(secondId);
  });
});

describe('joinRoom', () => {
  it('adds a second player', () => {
    const { room } = createNewRoom('Alice', 'ABCD');
    const result = joinRoom(room, 'Bob');
    expect(result).not.toBeNull();
    expect(result!.room.players).toHaveLength(2);
  });

  it('marks the joiner as non-host', () => {
    const { room } = createNewRoom('Alice', 'ABCD');
    const result = joinRoom(room, 'Bob');
    const bob = result!.room.players.find((player) => player.name === 'Bob');
    expect(bob!.isHost).toBe(false);
  });

  it('returns a unique player ID for the joiner', () => {
    const { room, playerId: aliceId } = createNewRoom('Alice', 'ABCD');
    const result = joinRoom(room, 'Bob');
    expect(result!.player.id).not.toBe(aliceId);
  });

  it('rejects when room is full', () => {
    let { room } = createNewRoom('Host', 'FULL');
    for (let i = 1; i < MAX_PLAYERS; i += 1) {
      const result = joinRoom(room, `Player${i}`);
      if (result) {
        room = result.room;
      }
    }
    expect(room.players).toHaveLength(MAX_PLAYERS);
    const overflow = joinRoom(room, 'ExtraPlayer');
    expect(overflow).toBeNull();
  });
});

describe('leaveRoom', () => {
  it('removes the specified non-host player', () => {
    const { room } = createNewRoom('Alice', 'ABCD');
    const joinResult = joinRoom(room, 'Bob');
    const updated = leaveRoom(joinResult!.room, joinResult!.player.id);
    expect(updated).not.toBeNull();
    expect(updated!.players).toHaveLength(1);
  });

  it('returns null when the host leaves', () => {
    const { room, playerId } = createNewRoom('Alice', 'ABCD');
    const result = leaveRoom(room, playerId);
    expect(result).toBeNull();
  });
});

describe('updateSettings', () => {
  it('updates round count', () => {
    const { room, playerId } = createNewRoom('Alice', 'ABCD');
    const updated = updateSettings(room, playerId, { rounds: 10 });
    expect(updated).not.toBeNull();
    expect(updated!.settings.rounds).toBe(10);
  });

  it('rejects settings update from non-host', () => {
    const { room } = createNewRoom('Alice', 'ABCD');
    const joinResult = joinRoom(room, 'Bob');
    const updated = updateSettings(joinResult!.room, joinResult!.player.id, { rounds: 10 });
    expect(updated).toBeNull();
  });
});

describe('sanitizeRoom', () => {
  it('returns a sanitized view with the room code', () => {
    const { room } = createNewRoom('Alice', 'ABCD');
    const sanitized = sanitizeRoom(room);
    expect(sanitized.code).toBe('ABCD');
  });

  it('includes player info', () => {
    const { room } = createNewRoom('Alice', 'ABCD');
    const sanitized = sanitizeRoom(room);
    expect(sanitized.players).toHaveLength(1);
    expect(sanitized.players[0]!.name).toBe('Alice');
  });

  it('includes settings', () => {
    const { room } = createNewRoom('Alice', 'ABCD');
    const sanitized = sanitizeRoom(room);
    expect(sanitized.settings).toBeDefined();
  });
});
