export const ROOM_CODE_MIN_LENGTH = 4;
export const ROOM_CODE_MAX_LENGTH = 6;
export const FLASHQUEST_BATTLE_JOIN_BASE_URL = 'https://flashquest.app/join';

const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function normalizeRoomCode(value: string): string {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, ROOM_CODE_MAX_LENGTH);
}

export function isRoomCodeValid(value: string): boolean {
  const normalizedCode = normalizeRoomCode(value);
  return normalizedCode.length >= ROOM_CODE_MIN_LENGTH && normalizedCode.length <= ROOM_CODE_MAX_LENGTH;
}

export function buildBattleInviteUrl(roomCode: string): string {
  const normalizedCode = normalizeRoomCode(roomCode);
  return `${FLASHQUEST_BATTLE_JOIN_BASE_URL}/${normalizedCode}`;
}

export function buildBattleShareMessage(roomCode: string): string {
  const normalizedCode = normalizeRoomCode(roomCode);
  return `Join my FlashQuest battle!\n\nRoom code: ${normalizedCode}\n${buildBattleInviteUrl(normalizedCode)}`;
}

export function generateBattleRoomCode(length: number = ROOM_CODE_MIN_LENGTH): string {
  let code = '';

  for (let index = 0; index < length; index += 1) {
    const randomIndex = Math.floor(Math.random() * ROOM_CODE_ALPHABET.length);
    code += ROOM_CODE_ALPHABET[randomIndex] ?? 'A';
  }

  return code;
}
