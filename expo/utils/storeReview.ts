import AsyncStorage from '@react-native-async-storage/async-storage';
import * as StoreReview from 'expo-store-review';
import { Platform } from 'react-native';

import { logger } from '@/utils/logger';

const LAST_REVIEW_PROMPT_KEY = 'flashquest_last_review_prompt';
const MIN_SESSIONS_BEFORE_PROMPT = 5;
const MIN_STREAK_BEFORE_PROMPT = 2;
const COOLDOWN_DAYS = 60;
const COOLDOWN_MS = COOLDOWN_DAYS * 24 * 60 * 60 * 1000;

export async function maybePromptReview(stats: {
  totalStudySessions: number;
  totalQuestSessions: number;
  currentStreak: number;
}): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      logger.debug('[StoreReview] Skipping review prompt on web');
      return;
    }

    const isAvailable = await StoreReview.isAvailableAsync();
    if (!isAvailable) {
      logger.debug('[StoreReview] Store review is not available on this device');
      return;
    }

    const totalSessions = stats.totalStudySessions + stats.totalQuestSessions;
    if (totalSessions < MIN_SESSIONS_BEFORE_PROMPT) {
      logger.debug('[StoreReview] Skipping review prompt, not enough sessions yet:', totalSessions);
      return;
    }

    if (stats.currentStreak < MIN_STREAK_BEFORE_PROMPT) {
      logger.debug('[StoreReview] Skipping review prompt, streak too low:', stats.currentStreak);
      return;
    }

    const lastPrompt = await AsyncStorage.getItem(LAST_REVIEW_PROMPT_KEY);
    const lastPromptTimestamp = lastPrompt ? Number(lastPrompt) : null;

    if (lastPromptTimestamp && Date.now() - lastPromptTimestamp < COOLDOWN_MS) {
      logger.debug('[StoreReview] Skipping review prompt, cooldown still active');
      return;
    }

    logger.debug('[StoreReview] Prompting in-app review');
    await StoreReview.requestReview();
    await AsyncStorage.setItem(LAST_REVIEW_PROMPT_KEY, Date.now().toString());
  } catch (error) {
    logger.debug('[StoreReview] Review prompt skipped after error', error);
  }
}
