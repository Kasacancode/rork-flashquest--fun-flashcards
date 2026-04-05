import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';
import { logger } from '@/utils/logger';

export async function registerPushToken(userId: string): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      return;
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    if (existingStatus !== 'granted') {
      return;
    }

    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    if (!projectId) {
      logger.warn('[Push] No EAS project ID found, skipping push token registration');
      return;
    }

    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    const token = tokenData.data;

    if (!token) {
      logger.warn('[Push] Failed to get Expo push token');
      return;
    }

    const { error } = await supabase
      .from('push_tokens')
      .upsert(
        {
          user_id: userId,
          token,
          platform: Platform.OS,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,token' },
      );

    if (error) {
      logger.warn('[Push] Failed to save push token:', error.message);
      return;
    }

    logger.log('[Push] Push token registered successfully');
  } catch (error) {
    logger.warn('[Push] Token registration error:', error);
  }
}

export async function unregisterPushToken(userId: string): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      return;
    }

    const { error } = await supabase
      .from('push_tokens')
      .delete()
      .eq('user_id', userId);

    if (error) {
      logger.warn('[Push] Failed to remove push tokens:', error.message);
    }
  } catch (error) {
    logger.warn('[Push] Token removal error:', error);
  }
}
