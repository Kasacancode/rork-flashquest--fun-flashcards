import { makeRedirectUri } from 'expo-auth-session';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

export const AUTH_CALLBACK_PATH = 'auth-callback';
export const LEGACY_AUTH_CALLBACK_PATH = 'auth/callback';
export const AUTH_CALLBACK_PATHS = [AUTH_CALLBACK_PATH, LEGACY_AUTH_CALLBACK_PATH] as const;
export const NATIVE_AUTH_CALLBACK_URL = 'flashquest://auth-callback';
export const LEGACY_NATIVE_AUTH_CALLBACK_URL = 'flashquest://auth/callback';

const LOCALHOST_WEB_ORIGIN = 'http://localhost:3000';
const PRODUCTION_WEB_ORIGIN = 'https://flashquest.net';

function getWebOrigin(): string {
  const scopedGlobal = globalThis as typeof globalThis & {
    location?: {
      origin?: string;
    };
  };

  return scopedGlobal.location?.origin ?? LOCALHOST_WEB_ORIGIN;
}

export function isExpoGo(): boolean {
  return Constants.appOwnership === 'expo';
}

export function getAuthCallbackUrlForOrigin(origin: string): string {
  return `${origin}/${AUTH_CALLBACK_PATH}`;
}

export function getLegacyAuthCallbackUrlForOrigin(origin: string): string {
  return `${origin}/${LEGACY_AUTH_CALLBACK_PATH}`;
}

export function isKnownAuthCallbackUrl(url: string): boolean {
  return AUTH_CALLBACK_PATHS.some((path) => url.includes(path));
}

export function getAuthRedirectUrl(): string {
  if (Platform.OS === 'web') {
    return getAuthCallbackUrlForOrigin(getWebOrigin());
  }

  if (isExpoGo()) {
    return makeRedirectUri({ path: AUTH_CALLBACK_PATH });
  }

  return NATIVE_AUTH_CALLBACK_URL;
}

export function getExpectedSupabaseRedirectUrls(): string[] {
  const currentWebOrigin = getWebOrigin();
  const redirectUrls: string[] = [
    NATIVE_AUTH_CALLBACK_URL,
    LEGACY_NATIVE_AUTH_CALLBACK_URL,
    getAuthCallbackUrlForOrigin(LOCALHOST_WEB_ORIGIN),
    getLegacyAuthCallbackUrlForOrigin(LOCALHOST_WEB_ORIGIN),
    getAuthCallbackUrlForOrigin(PRODUCTION_WEB_ORIGIN),
    getLegacyAuthCallbackUrlForOrigin(PRODUCTION_WEB_ORIGIN),
    getAuthCallbackUrlForOrigin(currentWebOrigin),
    getLegacyAuthCallbackUrlForOrigin(currentWebOrigin),
    'exp://**/--/auth-callback',
  ];

  if (Platform.OS !== 'web' && isExpoGo()) {
    redirectUrls.push(makeRedirectUri({ path: AUTH_CALLBACK_PATH }));
  }

  return Array.from(new Set(redirectUrls));
}
