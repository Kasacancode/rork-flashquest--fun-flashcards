import AsyncStorage from '@react-native-async-storage/async-storage';

import { logger } from '@/utils/logger';

const WIDGET_DATA_KEY = 'flashquest_widget_data';

export interface WidgetData {
  currentStreak: number;
  longestStreak: number;
  totalCardsStudied: number;
  totalScore: number;
  level: number;
  dueCardCount: number;
  lastStudiedDate: string;
  updatedAt: string;
}

export async function updateWidgetData(data: WidgetData): Promise<void> {
  try {
    await AsyncStorage.setItem(WIDGET_DATA_KEY, JSON.stringify(data));
    logger.debug('[Widget] Updated widget data');
  } catch (error) {
    logger.debug('[Widget] Failed to update widget data:', error);
  }
}

export async function getWidgetData(): Promise<WidgetData | null> {
  try {
    const raw = await AsyncStorage.getItem(WIDGET_DATA_KEY);
    if (!raw) {
      return null;
    }

    return JSON.parse(raw) as WidgetData;
  } catch {
    return null;
  }
}
