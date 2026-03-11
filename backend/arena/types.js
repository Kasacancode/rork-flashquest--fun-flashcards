"use strict";
// --- Arena type definitions ---
// All room, game, and sanitized types live here.
// Shared by repository, engine, and TRPC routes.
Object.defineProperty(exports, "__esModule", { value: true });
exports.NO_TIMER_TIMEOUT_MS = exports.REVEAL_DURATION_MS = exports.DISCONNECT_MS = exports.ROOM_TTL_MS = exports.MAX_PLAYERS = exports.PLAYER_COLORS = exports.PLAYER_IDENTITIES = void 0;
exports.PLAYER_IDENTITIES = [
    { key: 'blue-spade', colorName: 'Blue', suit: '♠', label: 'Blue ♠', color: '#2563EB' },
    { key: 'red-heart', colorName: 'Red', suit: '♥', label: 'Red ♥', color: '#DC2626' },
    { key: 'green-diamond', colorName: 'Green', suit: '♦', label: 'Green ♦', color: '#16A34A' },
    { key: 'purple-club', colorName: 'Purple', suit: '♣', label: 'Purple ♣', color: '#7C3AED' },
    { key: 'gold-spade', colorName: 'Gold', suit: '♠', label: 'Gold ♠', color: '#D97706' },
    { key: 'pink-heart', colorName: 'Pink', suit: '♥', label: 'Pink ♥', color: '#DB2777' },
];
exports.PLAYER_COLORS = exports.PLAYER_IDENTITIES.map((identity) => identity.color);
exports.MAX_PLAYERS = 6;
exports.ROOM_TTL_MS = 60 * 60 * 1000;
exports.DISCONNECT_MS = 60 * 1000;
exports.REVEAL_DURATION_MS = 3500;
exports.NO_TIMER_TIMEOUT_MS = 90 * 1000;
