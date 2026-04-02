import AsyncStorage from '@react-native-async-storage/async-storage';

import { logger } from '@/utils/logger';

const PREFIX = 'flashquest_first_visit_';

export type FirstVisitScreen = 'quest' | 'practice' | 'arena';

export async function isFirstVisit(screen: FirstVisitScreen): Promise<boolean> {
  try {
    const value = await AsyncStorage.getItem(`${PREFIX}${screen}`);
    return value !== 'seen';
  } catch (error) {
    logger.warn('[FirstVisit] Failed to check:', error);
    return false;
  }
}

export async function markVisited(screen: FirstVisitScreen): Promise<void> {
  try {
    await AsyncStorage.setItem(`${PREFIX}${screen}`, 'seen');
  } catch (error) {
    logger.warn('[FirstVisit] Failed to mark:', error);
  }
}
