export const PLAYER_NAME_MAX_LENGTH = 20;

export function sanitizePlayerName(value: string): string {
  return value.trim().slice(0, PLAYER_NAME_MAX_LENGTH);
}

export function getPlayerNameValidationError(value: string): string | null {
  if (!sanitizePlayerName(value)) {
    return 'Enter a player name.';
  }

  return null;
}
