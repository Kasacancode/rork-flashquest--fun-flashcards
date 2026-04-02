import AsyncStorage from '@react-native-async-storage/async-storage';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { EXPORT_KEYS, EXPORT_KEY_SET } from '@/utils/exportKeys';
import { logger } from '@/utils/logger';

const BACKUP_TYPE = 'flashquest_backup';
const BACKUP_VERSION = 1;

export { EXPORT_KEYS };

interface BackupEnvelope {
  _type: string;
  _version: number;
  _exportedAt: string;
  _appVersion: string;
  data: Record<string, string>;
}

function isValidBackup(parsed: unknown): parsed is BackupEnvelope {
  if (typeof parsed !== 'object' || parsed === null) {
    return false;
  }

  const obj = parsed as Record<string, unknown>;

  return (
    obj._type === BACKUP_TYPE
    && typeof obj._version === 'number'
    && typeof obj._exportedAt === 'string'
    && typeof obj._appVersion === 'string'
    && typeof obj.data === 'object'
    && obj.data !== null
  );
}

export async function exportBackup(appVersion: string): Promise<{ success: boolean; error?: string }> {
  try {
    const data: Record<string, string> = {};

    for (const key of EXPORT_KEYS) {
      const value = await AsyncStorage.getItem(key);
      if (value !== null) {
        data[key] = value;
      }
    }

    const envelope: BackupEnvelope = {
      _type: BACKUP_TYPE,
      _version: BACKUP_VERSION,
      _exportedAt: new Date().toISOString(),
      _appVersion: appVersion,
      data,
    };

    const json = JSON.stringify(envelope, null, 2);
    const timestamp = new Date().toISOString().slice(0, 10);
    const filename = `flashquest-backup-${timestamp}.json`;
    const file = new File(Paths.cache, filename);

    file.create({ overwrite: true });
    file.write(json);

    const isSharingAvailable = await Sharing.isAvailableAsync();
    if (!isSharingAvailable) {
      return { success: false, error: 'Sharing is not available on this device.' };
    }

    await Sharing.shareAsync(file.uri, {
      mimeType: 'application/json',
      dialogTitle: 'Save FlashQuest Backup',
      UTI: 'public.json',
    });

    logger.log('[Backup] Exported backup file:', file.uri);
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('[Backup] Export failed:', error);
    return { success: false, error: message };
  }
}

export async function importBackup(): Promise<{
  success: boolean;
  error?: string;
  exportedAt?: string;
  keysRestored?: number;
}> {
  try {
    const result = await DocumentPicker.getDocumentAsync({
      type: 'application/json',
      copyToCacheDirectory: true,
    });

    if (result.canceled || !result.assets?.[0]) {
      return { success: false, error: 'No file selected.' };
    }

    const asset = result.assets[0];

    if (!asset.uri) {
      return { success: false, error: 'Could not read the selected file.' };
    }

    const file = new File(asset.uri);
    const content = await file.text();

    let parsed: unknown;
    try {
      parsed = JSON.parse(content) as unknown;
    } catch {
      return { success: false, error: 'The file is not valid JSON.' };
    }

    if (!isValidBackup(parsed)) {
      return { success: false, error: 'This file is not a FlashQuest backup.' };
    }

    const pairs: [string, string][] = Object.entries(parsed.data)
      .filter((entry): entry is [string, string] => typeof entry[1] === 'string')
      .filter(([key]) => EXPORT_KEY_SET.has(key));

    if (pairs.length === 0) {
      return { success: false, error: 'The backup file is empty.' };
    }

    const keysInBackup = new Set<string>(pairs.map(([key]) => key));
    const keysToRemove = EXPORT_KEYS.filter((key) => !keysInBackup.has(key));

    if (keysToRemove.length > 0) {
      await AsyncStorage.multiRemove([...keysToRemove]);
    }

    await AsyncStorage.multiSet(pairs);

    logger.log('[Backup] Restored', pairs.length, 'keys from backup dated', parsed._exportedAt);

    return {
      success: true,
      exportedAt: parsed._exportedAt,
      keysRestored: pairs.length,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('[Backup] Import failed:', error);
    return { success: false, error: message };
  }
}
