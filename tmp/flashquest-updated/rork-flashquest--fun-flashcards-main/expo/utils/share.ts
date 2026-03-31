import * as Clipboard from 'expo-clipboard';
import { Alert, Share } from 'react-native';

import { logger } from '@/utils/logger';

interface WebNavigatorLike {
  share?: (data: { title?: string; text?: string }) => Promise<void>;
  clipboard?: {
    writeText?: (value: string) => Promise<void>;
  };
}

interface WebWindowLike {
  prompt?: (message?: string, defaultValue?: string) => string | null;
}

interface ShareTextWithFallbackOptions {
  message: string;
  title?: string;
  fallbackTitle: string;
  fallbackMessage: string;
  copiedTitle: string;
  copiedMessage: string;
}

export type ShareResult = 'shared' | 'copied' | 'cancelled' | 'failed';

function getWebNavigator(): WebNavigatorLike | undefined {
  return (globalThis as { navigator?: WebNavigatorLike }).navigator;
}

function getWebWindow(): WebWindowLike | undefined {
  return (globalThis as { window?: WebWindowLike }).window;
}

function isShareCancellation(error: unknown): boolean {
  const shareError = error as { name?: unknown; message?: unknown } | null;
  const errorName = typeof shareError?.name === 'string' ? shareError.name : '';
  const errorMessage = typeof shareError?.message === 'string' ? shareError.message.toLowerCase() : '';

  return errorName === 'AbortError' || errorMessage.includes('abort');
}

async function copyShareMessage(message: string): Promise<boolean> {
  const webNavigator = getWebNavigator();

  if (typeof webNavigator?.clipboard?.writeText === 'function') {
    try {
      await webNavigator.clipboard.writeText(message);
      logger.log('[Share] Copied share message with navigator.clipboard.writeText');
      return true;
    } catch (error) {
      logger.log('[Share] navigator.clipboard.writeText failed', error);
    }
  }

  try {
    await Clipboard.setStringAsync(message);
    logger.log('[Share] Copied share message with Clipboard.setStringAsync');
    return true;
  } catch (error) {
    logger.log('[Share] Clipboard.setStringAsync failed', error);
  }

  const webWindow = getWebWindow();
  if (typeof webWindow?.prompt === 'function') {
    webWindow.prompt('Copy and share this message:', message);
    logger.log('[Share] Displayed prompt fallback for share message');
    return true;
  }

  return false;
}

export async function shareTextWithFallback({
  message,
  title,
  fallbackTitle,
  fallbackMessage,
  copiedTitle,
  copiedMessage,
}: ShareTextWithFallbackOptions): Promise<ShareResult> {
  try {
    await Share.share({
      message,
      title,
    });
    logger.log('[Share] Shared message with Share.share');
    return 'shared';
  } catch (error) {
    if (isShareCancellation(error)) {
      logger.log('[Share] Share cancelled', error);
      return 'cancelled';
    }

    logger.log('[Share] Share.share failed', error);
  }

  const webNavigator = getWebNavigator();
  if (typeof webNavigator?.share === 'function') {
    try {
      await webNavigator.share({
        title,
        text: message,
      });
      logger.log('[Share] Shared message with navigator.share');
      return 'shared';
    } catch (error) {
      if (isShareCancellation(error)) {
        logger.log('[Share] navigator.share cancelled', error);
        return 'cancelled';
      }

      logger.log('[Share] navigator.share failed', error);
    }
  }

  const copied = await copyShareMessage(message);
  if (copied) {
    Alert.alert(copiedTitle, copiedMessage);
    return 'copied';
  }

  Alert.alert(fallbackTitle, fallbackMessage);
  return 'failed';
}
