import { containsOffensiveLanguage } from '@/utils/contentSafety';

export const PROFILE_NAME_MAX_LENGTH = 32;

export function sanitizeProfileName(value: string): string {
  return value.trim().replace(/\s+/g, ' ').slice(0, PROFILE_NAME_MAX_LENGTH);
}

export function validateProfileName(value: string): string | null {
  const sanitized = sanitizeProfileName(value);

  if (!sanitized) {
    return 'Enter a profile name.';
  }

  if (sanitized.length > PROFILE_NAME_MAX_LENGTH) {
    return `Profile name must be ${PROFILE_NAME_MAX_LENGTH} characters or fewer.`;
  }

  if (containsOffensiveLanguage(sanitized)) {
    return 'Choose a respectful profile name.';
  }

  return null;
}
