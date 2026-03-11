"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FLASHQUEST_BATTLE_JOIN_BASE_URL = exports.ROOM_CODE_MAX_LENGTH = exports.ROOM_CODE_MIN_LENGTH = void 0;
exports.normalizeRoomCode = normalizeRoomCode;
exports.isRoomCodeValid = isRoomCodeValid;
exports.buildBattleInviteUrl = buildBattleInviteUrl;
exports.buildBattleShareMessage = buildBattleShareMessage;
exports.generateBattleRoomCode = generateBattleRoomCode;
exports.ROOM_CODE_MIN_LENGTH = 4;
exports.ROOM_CODE_MAX_LENGTH = 6;
exports.FLASHQUEST_BATTLE_JOIN_BASE_URL = 'https://flashquest.app/join';
const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function normalizeRoomCode(value) {
    return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, exports.ROOM_CODE_MAX_LENGTH);
}
function isRoomCodeValid(value) {
    const normalizedCode = normalizeRoomCode(value);
    return normalizedCode.length >= exports.ROOM_CODE_MIN_LENGTH && normalizedCode.length <= exports.ROOM_CODE_MAX_LENGTH;
}
function buildBattleInviteUrl(roomCode) {
    const normalizedCode = normalizeRoomCode(roomCode);
    return `${exports.FLASHQUEST_BATTLE_JOIN_BASE_URL}/${normalizedCode}`;
}
function buildBattleShareMessage(roomCode) {
    const normalizedCode = normalizeRoomCode(roomCode);
    return `Join my FlashQuest battle!\n\nRoom code: ${normalizedCode}\n${buildBattleInviteUrl(normalizedCode)}`;
}
function generateBattleRoomCode(length = exports.ROOM_CODE_MIN_LENGTH) {
    let code = '';
    for (let index = 0; index < length; index += 1) {
        const randomIndex = Math.floor(Math.random() * ROOM_CODE_ALPHABET.length);
        code += ROOM_CODE_ALPHABET[randomIndex] ?? 'A';
    }
    return code;
}
