import { Alert, Linking } from 'react-native';

import { PRIVACY_LINKS } from '@/constants/privacy';
import { logger } from '@/utils/logger';

function normalizeUrl(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function getEmailHref(email: string): string | null {
  const normalizedEmail = normalizeUrl(email);
  return normalizedEmail ? `mailto:${normalizedEmail}` : null;
}

export function getSupportPageHref(): string | null {
  return normalizeUrl(PRIVACY_LINKS.supportUrl);
}

export function getPrivacyPolicyHref(): string | null {
  return normalizeUrl(PRIVACY_LINKS.privacyPolicyUrl);
}

export function getTermsHref(): string | null {
  return normalizeUrl(PRIVACY_LINKS.termsUrl);
}

export function getSupportHref(): string | null {
  return getSupportPageHref() ?? getEmailHref(PRIVACY_LINKS.supportEmail);
}

export function getPrivacyHref(): string | null {
  return getEmailHref(PRIVACY_LINKS.privacyEmail);
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

export async function openSupportPage(): Promise<void> {
  const href = getSupportPageHref();

  if (!href) {
    Alert.alert('Support unavailable', 'Support is temporarily unavailable. Please try again later.');
    return;
  }

  await openExternalHref(href, 'Unable to open support');
}

export async function openPrivacyPolicy(): Promise<void> {
  const href = getPrivacyPolicyHref();

  if (!href) {
    Alert.alert('Privacy Policy unavailable', 'Privacy Policy is temporarily unavailable. Please try again later.');
    return;
  }

  await openExternalHref(href, 'Unable to open Privacy Policy');
}

export async function openTermsOfService(): Promise<void> {
  const href = getTermsHref();

  if (!href) {
    Alert.alert('Terms of Service unavailable', 'Terms of Service are temporarily unavailable. Please try again later.');
    return;
  }

  await openExternalHref(href, 'Unable to open Terms of Service');
}

export async function openSupportContact(): Promise<void> {
  const href = getSupportHref();

  if (!href) {
    Alert.alert('Support unavailable', 'Support contact is temporarily unavailable. Please try again later.');
    return;
  }

  await openExternalHref(href, 'Unable to open support');
}

export async function openPrivacyContact(): Promise<void> {
  const href = getPrivacyHref();

  if (!href) {
    Alert.alert('Privacy contact unavailable', 'Privacy contact is temporarily unavailable. Please try again later.');
    return;
  }

  await openExternalHref(href, 'Unable to open privacy contact');
}
