import * as ExpoLinking from 'expo-linking';
import { Platform } from 'react-native';

export const ROOM_CODE_MIN_LENGTH = 4;
export const ROOM_CODE_MAX_LENGTH = 4;

const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function normalizeUrlOrigin(value: string): string {
  return value.replace(/\/+$/, '');
}

function getWebOrigin(): string | null {
  if (Platform.OS !== 'web') {
    return null;
  }

  if (typeof window === 'undefined' || !window.location?.origin) {
    return null;
  }

  return normalizeUrlOrigin(window.location.origin);
}

export function normalizeRoomCode(value: string): string {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, ROOM_CODE_MAX_LENGTH);
}

export function isRoomCodeValid(value: string): boolean {
  const normalizedCode = normalizeRoomCode(value);
  return normalizedCode.length >= ROOM_CODE_MIN_LENGTH && normalizedCode.length <= ROOM_CODE_MAX_LENGTH;
}

export function buildBattleInviteUrl(roomCode: string): string {
  const normalizedCode = normalizeRoomCode(roomCode);
  const joinPath = `/join/${normalizedCode}`;
  const webOrigin = getWebOrigin();

  if (webOrigin) {
    return `${webOrigin}${joinPath}`;
  }

  try {
    return ExpoLinking.createURL(joinPath);
  } catch (error) {
    console.warn('[ArenaInvite] Failed to create runtime invite URL:', error);
    return joinPath;
  }
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
