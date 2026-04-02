import AsyncStorage from '@react-native-async-storage/async-storage';

import { supabase } from '@/lib/supabase';
import { EXPORT_KEYS, EXPORT_KEY_SET } from '@/utils/exportKeys';
import { logger } from '@/utils/logger';

const LAST_SYNC_KEY = 'flashquest_last_cloud_sync';

interface LeaderboardStats {
  displayName: string;
  avatarKey: string;
  totalScore: number;
  level: number;
  currentStreak: number;
  longestStreak: number;
  totalCardsStudied: number;
}

function parseTimestamp(value: string | null | undefined): number {
  if (!value) {
    return 0;
  }

  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

async function gatherLocalData(): Promise<Record<string, string>> {
  const data: Record<string, string> = {};

  for (const key of EXPORT_KEYS) {
    const value = await AsyncStorage.getItem(key);
    if (value !== null) {
      data[key] = value;
    }
  }

  return data;
}

export async function uploadToCloud(userId: string): Promise<boolean> {
  try {
    const localData = await gatherLocalData();
    const syncedAt = new Date().toISOString();

    const { error } = await supabase
      .from('user_data')
      .upsert({
        user_id: userId,
        data_blob: localData,
        synced_at: syncedAt,
      }, { onConflict: 'user_id' });

    if (error) {
      logger.warn('[CloudSync] Upload failed:', error.message);
      return false;
    }

    await AsyncStorage.setItem(LAST_SYNC_KEY, syncedAt);
    logger.log('[CloudSync] Uploaded user data to cloud');
    return true;
  } catch (error) {
    logger.warn('[CloudSync] Upload error:', error);
    return false;
  }
}

export async function downloadFromCloud(userId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('user_data')
      .select('data_blob, synced_at')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      logger.warn('[CloudSync] Download failed:', error.message);
      return false;
    }

    if (!data?.data_blob || typeof data.data_blob !== 'object' || Array.isArray(data.data_blob)) {
      return false;
    }

    const cloudData = data.data_blob as Record<string, unknown>;
    const pairs: [string, string][] = Object.entries(cloudData)
      .filter((entry): entry is [string, string] => typeof entry[1] === 'string')
      .filter(([key]) => EXPORT_KEY_SET.has(key));

    const keysInCloud = new Set<string>(pairs.map(([key]) => key));
    const keysToRemove = EXPORT_KEYS.filter((key) => !keysInCloud.has(key));

    if (keysToRemove.length > 0) {
      await AsyncStorage.multiRemove([...keysToRemove]);
    }

    if (pairs.length > 0) {
      await AsyncStorage.multiSet(pairs);
    }

    if (typeof data.synced_at === 'string') {
      await AsyncStorage.setItem(LAST_SYNC_KEY, data.synced_at);
    }

    logger.log('[CloudSync] Downloaded user data from cloud', { restoredKeys: pairs.length, removedKeys: keysToRemove.length });
    return true;
  } catch (error) {
    logger.warn('[CloudSync] Download error:', error);
    return false;
  }
}

export async function syncWithCloud(userId: string): Promise<void> {
  try {
    const lastSyncRaw = await AsyncStorage.getItem(LAST_SYNC_KEY);
    const lastSyncLocal = parseTimestamp(lastSyncRaw);

    const { data, error } = await supabase
      .from('user_data')
      .select('synced_at')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      logger.warn('[CloudSync] Sync check failed:', error.message);
      return;
    }

    const cloudSyncTime = parseTimestamp(data?.synced_at ?? null);

    if (cloudSyncTime > lastSyncLocal) {
      await downloadFromCloud(userId);
      return;
    }

    await uploadToCloud(userId);
  } catch (error) {
    logger.warn('[CloudSync] Sync error:', error);
  }
}

export async function updateLeaderboard(userId: string, stats: LeaderboardStats): Promise<void> {
  try {
    const { error } = await supabase
      .from('leaderboard')
      .upsert({
        user_id: userId,
        display_name: stats.displayName,
        avatar_key: stats.avatarKey,
        total_score: stats.totalScore,
        level: stats.level,
        current_streak: stats.currentStreak,
        longest_streak: stats.longestStreak,
        total_cards_studied: stats.totalCardsStudied,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });

    if (error) {
      logger.debug('[CloudSync] Leaderboard update failed:', error.message);
    }
  } catch (error) {
    logger.debug('[CloudSync] Leaderboard update failed:', error);
  }
}
