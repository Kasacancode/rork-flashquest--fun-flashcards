import { containsOffensiveLanguage } from '@/utils/contentSafety';

export const PLAYER_NAME_MAX_LENGTH = 20;

export function sanitizePlayerName(value: string): string {
  return value.trim().replace(/\s+/g, ' ').slice(0, PLAYER_NAME_MAX_LENGTH);
}

export function getPlayerNameValidationError(value: string): string | null {
  const sanitized = sanitizePlayerName(value);

  if (!sanitized) {
    return 'Enter a player name.';
  }

  if (containsOffensiveLanguage(sanitized)) {
    return 'Choose a respectful player name.';
  }

  return null;
}
