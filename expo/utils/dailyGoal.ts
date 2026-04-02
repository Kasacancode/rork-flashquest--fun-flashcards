import AsyncStorage from '@react-native-async-storage/async-storage';

import { logger } from '@/utils/logger';

const GOAL_TARGET_KEY = 'flashquest_daily_goal_target';
const GOAL_PROGRESS_KEY = 'flashquest_daily_goal_progress';

const DEFAULT_DAILY_GOAL = 15;
const MIN_DAILY_GOAL = 5;
const MAX_DAILY_GOAL = 100;

export const DAILY_GOAL_OPTIONS = [5, 10, 15, 20, 30, 50, 100] as const;

interface DailyProgress {
  date: string;
  count: number;
}

function getTodayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function getDailyGoalTarget(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(GOAL_TARGET_KEY);
    if (!raw) {
      return DEFAULT_DAILY_GOAL;
    }

    const parsed = parseInt(raw, 10);
    return Number.isFinite(parsed) && parsed >= MIN_DAILY_GOAL && parsed <= MAX_DAILY_GOAL
      ? parsed
      : DEFAULT_DAILY_GOAL;
  } catch (error) {
    logger.warn('[DailyGoal] Failed to read target:', error);
    return DEFAULT_DAILY_GOAL;
  }
}

export async function setDailyGoalTarget(target: number): Promise<void> {
  try {
    const clamped = Math.max(MIN_DAILY_GOAL, Math.min(MAX_DAILY_GOAL, target));
    await AsyncStorage.setItem(GOAL_TARGET_KEY, String(clamped));
  } catch (error) {
    logger.warn('[DailyGoal] Failed to save target:', error);
  }
}

export async function getDailyProgress(): Promise<DailyProgress> {
  try {
    const raw = await AsyncStorage.getItem(GOAL_PROGRESS_KEY);
    if (!raw) {
      return { date: getTodayKey(), count: 0 };
    }

    const parsed = JSON.parse(raw) as unknown;
    if (
      typeof parsed === 'object'
      && parsed !== null
      && 'date' in parsed
      && typeof parsed.date === 'string'
      && 'count' in parsed
      && typeof parsed.count === 'number'
    ) {
      const progress: DailyProgress = {
        date: parsed.date,
        count: parsed.count,
      };
      if (progress.date !== getTodayKey()) {
        return { date: getTodayKey(), count: 0 };
      }

      return progress;
    }

    return { date: getTodayKey(), count: 0 };
  } catch (error) {
    logger.warn('[DailyGoal] Failed to read progress:', error);
    return { date: getTodayKey(), count: 0 };
  }
}

export async function incrementDailyProgress(cardsStudied: number): Promise<DailyProgress> {
  try {
    const current = await getDailyProgress();
    const updated: DailyProgress = {
      date: getTodayKey(),
      count: current.date === getTodayKey() ? current.count + cardsStudied : cardsStudied,
    };

    await AsyncStorage.setItem(GOAL_PROGRESS_KEY, JSON.stringify(updated));
    return updated;
  } catch (error) {
    logger.warn('[DailyGoal] Failed to increment progress:', error);
    return { date: getTodayKey(), count: 0 };
  }
}
