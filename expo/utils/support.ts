import { Alert, Linking } from 'react-native';

import { PRIVACY_LINKS } from '@/constants/privacy';
import { logger } from '@/utils/logger';

function normalizeUrl(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function getSupportHref(): string | null {
  const supportUrl = normalizeUrl(PRIVACY_LINKS.supportUrl);
  if (supportUrl) {
    return supportUrl;
  }

  const supportEmail = normalizeUrl(PRIVACY_LINKS.supportEmail);
  if (supportEmail) {
    return `mailto:${supportEmail}`;
  }

  return null;
}

export async function openExternalHref(url: string, fallbackTitle: string = 'Unable to open link'): Promise<boolean> {
  try {
    const supported = await Linking.canOpenURL(url);
    if (!supported) {
      Alert.alert(fallbackTitle, 'Please try again later.');
      return false;
    }

    await Linking.openURL(url);
    return true;
  } catch (error) {
    logger.warn('[Support] Failed to open external link:', error);
    Alert.alert(fallbackTitle, 'Please try again later.');
    return false;
  }
}

export async function openSupportContact(): Promise<void> {
  const href = getSupportHref();

  if (!href) {
    Alert.alert('Support unavailable', 'Add a support email or URL in constants/privacy.ts before release.');
    return;
  }

  await openExternalHref(href, 'Unable to open support');
}
