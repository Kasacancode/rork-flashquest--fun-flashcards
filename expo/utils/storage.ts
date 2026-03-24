import AsyncStorage from '@react-native-async-storage/async-storage';

import { logger } from '@/utils/logger';
import { safeParseJsonOrNull } from '@/utils/safeJson';

interface ReadStorageSnapshotOptions<T> {
  primaryKey: string;
  backupKey?: string;
  label: string;
  fallback: T;
  normalize?: (value: unknown) => T | null;
}

interface PersistStorageSnapshotOptions<T> {
  primaryKey: string;
  backupKey?: string;
  value: T;
  label: string;
}

export async function persistStorageSnapshot<T>(options: PersistStorageSnapshotOptions<T>): Promise<T> {
  const { primaryKey, backupKey, value, label } = options;
  const serialized = JSON.stringify(value);

  if (backupKey) {
    await Promise.all([
      AsyncStorage.setItem(primaryKey, serialized),
      AsyncStorage.setItem(backupKey, serialized),
    ]);
  } else {
    await AsyncStorage.setItem(primaryKey, serialized);
  }

  logger.log('[storage] Persisted snapshot for', label);
  return value;
}

export async function readStorageSnapshot<T>(options: ReadStorageSnapshotOptions<T>): Promise<T> {
  const { primaryKey, backupKey, label, fallback, normalize } = options;
  const primaryRaw = await AsyncStorage.getItem(primaryKey);

  const parse = (raw: string | null | undefined): T | null => {
    return safeParseJsonOrNull<T>({
      raw,
      label,
      normalize,
    });
  };

  const primaryValue = parse(primaryRaw);
  if (primaryValue !== null) {
    if (backupKey) {
      const backupRaw = await AsyncStorage.getItem(backupKey);
      if (backupRaw !== primaryRaw) {
        await persistStorageSnapshot({ primaryKey, backupKey, value: primaryValue, label: `${label} mirror sync` });
      }
    }

    return primaryValue;
  }

  if (primaryRaw != null) {
    logger.warn('[storage] Invalid primary snapshot for', label);
  }

  if (backupKey) {
    const backupRaw = await AsyncStorage.getItem(backupKey);
    const backupValue = parse(backupRaw);

    if (backupValue !== null) {
      logger.warn('[storage] Recovered snapshot from backup for', label);
      await persistStorageSnapshot({ primaryKey, backupKey, value: backupValue, label: `${label} recovery` });
      return backupValue;
    }

    if (backupRaw != null) {
      logger.warn('[storage] Invalid backup snapshot for', label);
    }
  }

  return fallback;
}

export async function readStringFlag(key: string): Promise<boolean> {
  const stored = await AsyncStorage.getItem(key);
  return stored === 'true';
}
