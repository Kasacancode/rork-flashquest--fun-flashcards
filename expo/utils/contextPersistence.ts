import AsyncStorage from '@react-native-async-storage/async-storage';

import { logger } from '@/utils/logger';

export async function persistMirroredStorage<T>(primaryKey: string, backupKey: string, value: T, label: string): Promise<T> {
  const serialized = JSON.stringify(value);
  await Promise.all([
    AsyncStorage.setItem(primaryKey, serialized),
    AsyncStorage.setItem(backupKey, serialized),
  ]);
  logger.debug('[FlashQuest] Persisted mirrored storage for', label);
  return value;
}

export function parseStoredJson(raw: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch (error) {
    logger.warn('[FlashQuest] Failed to parse persisted JSON:', error);
    return null;
  }
}

export async function readMirroredStorage<T>(options: {
  primaryKey: string;
  backupKey: string;
  label: string;
  fallback: T;
  parse: (value: unknown) => T | null;
}): Promise<T> {
  const { primaryKey, backupKey, label, fallback, parse } = options;

  try {
    const primaryRaw = await AsyncStorage.getItem(primaryKey);

    if (primaryRaw != null) {
      const parsedPrimary = parseStoredJson(primaryRaw);
      const normalizedPrimary = parsedPrimary == null ? null : parse(parsedPrimary);

      if (normalizedPrimary != null) {
        try {
          const backupRaw = await AsyncStorage.getItem(backupKey);
          if (backupRaw !== primaryRaw) {
            await persistMirroredStorage(primaryKey, backupKey, normalizedPrimary, `${label} mirror sync`);
          }
        } catch (error) {
          logger.warn('[FlashQuest] Mirror sync failed during read for', label, error);
        }
        return normalizedPrimary;
      }

      logger.warn('[FlashQuest] Primary persisted payload was invalid, trying backup for', label);
    }

    const backupRaw = await AsyncStorage.getItem(backupKey);
    if (backupRaw != null) {
      const parsedBackup = parseStoredJson(backupRaw);
      const normalizedBackup = parsedBackup == null ? null : parse(parsedBackup);

      if (normalizedBackup != null) {
        logger.debug('[FlashQuest] Recovered', label, 'from backup storage');
        try {
          await persistMirroredStorage(primaryKey, backupKey, normalizedBackup, `${label} recovery`);
        } catch (error) {
          logger.warn('[FlashQuest] Mirror recovery persist failed for', label, error);
        }
        return normalizedBackup;
      }

      logger.warn('[FlashQuest] Backup persisted payload was invalid for', label);
    }
  } catch (error) {
    logger.error('[FlashQuest] Failed to read mirrored storage for', label, error);
  }

  logger.debug('[FlashQuest] Falling back to default payload for', label);
  return fallback;
}

export function createPersistenceQueue() {
  let queue = Promise.resolve();

  return async function enqueue<T>(label: string, task: () => Promise<T>): Promise<T> {
    void label;
    const next = queue.then(() => task());
    queue = next.then(() => undefined, () => undefined);
    return next;
  };
}
