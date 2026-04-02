import AsyncStorage from '@react-native-async-storage/async-storage';

import { logger } from '@/utils/logger';

const USER_INTERESTS_KEY = 'flashquest_user_interests';

export async function getUserInterests(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(USER_INTERESTS_KEY);
    if (!raw) {
      return [];
    }

    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((item: unknown): item is string => typeof item === 'string')
      : [];
  } catch (error) {
    logger.warn('[UserInterests] Failed to read interests:', error);
    return [];
  }
}

export async function setUserInterests(interests: string[]): Promise<void> {
  try {
    await AsyncStorage.setItem(USER_INTERESTS_KEY, JSON.stringify(interests));
  } catch (error) {
    logger.warn('[UserInterests] Failed to save interests:', error);
  }
}

export function pickDefaultCategory(interests: string[], fallback: string): string {
  return interests.length > 0 ? interests[0] ?? fallback : fallback;
}
