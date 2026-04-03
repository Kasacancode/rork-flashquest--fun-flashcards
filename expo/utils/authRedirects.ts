import { makeRedirectUri } from 'expo-auth-session';
import Constants from 'expo-constants';
import * as Linking from 'expo-linking';
import { Platform } from 'react-native';

export const AUTH_CALLBACK_PATH = 'auth-callback';
export const LEGACY_AUTH_CALLBACK_PATH = 'auth/callback';
export const AUTH_CALLBACK_PATHS = [AUTH_CALLBACK_PATH, LEGACY_AUTH_CALLBACK_PATH] as const;
export const NATIVE_AUTH_CALLBACK_URL = 'flashquest://auth-callback';
export const LEGACY_NATIVE_AUTH_CALLBACK_URL = 'flashquest://auth/callback';

const LOCALHOST_WEB_ORIGIN = 'http://localhost:3000';
const PRODUCTION_WEB_ORIGIN = 'https://flashquest.net';

function normalizeOrigin(origin: string): string {
  return origin.endsWith('/') ? origin.slice(0, -1) : origin;
}

function getWebOrigin(): string {
  const scopedGlobal = globalThis as typeof globalThis & {
    location?: {
      origin?: string;
    };
  };

  return scopedGlobal.location?.origin ?? LOCALHOST_WEB_ORIGIN;
}

function isHttpUrl(url: string): boolean {
  return url.startsWith('http://') || url.startsWith('https://');
}

function getLinkingAuthRedirectUrl(): string {
  return Linking.createURL(AUTH_CALLBACK_PATH);
}

function pickPreferredNativeRedirectUrl(...candidates: string[]): string {
  const usableCandidate = candidates.find((candidate) => candidate.length > 0 && !isHttpUrl(candidate));
  return usableCandidate ?? NATIVE_AUTH_CALLBACK_URL;
}

export function isExpoGo(): boolean {
  return Constants.appOwnership === 'expo';
}

export function getAuthCallbackUrlForOrigin(origin: string): string {
  return `${normalizeOrigin(origin)}/${AUTH_CALLBACK_PATH}`;
}

export function getLegacyAuthCallbackUrlForOrigin(origin: string): string {
  return `${normalizeOrigin(origin)}/${LEGACY_AUTH_CALLBACK_PATH}`;
}

export function isKnownAuthCallbackUrl(url: string): boolean {
  return AUTH_CALLBACK_PATHS.some((path) => url.includes(path));
}

export function getExpoGoAuthRedirectUrl(): string {
  return pickPreferredNativeRedirectUrl(
    makeRedirectUri({
      path: AUTH_CALLBACK_PATH,
    }),
    getLinkingAuthRedirectUrl(),
  );
}

export function getNativeAppAuthRedirectUrl(): string {
  if (Platform.OS === 'web') {
    return getAuthCallbackUrlForOrigin(getWebOrigin());
  }

  if (isExpoGo()) {
    return getExpoGoAuthRedirectUrl();
  }

  return pickPreferredNativeRedirectUrl(
    makeRedirectUri({
      path: AUTH_CALLBACK_PATH,
      scheme: 'flashquest',
      native: NATIVE_AUTH_CALLBACK_URL,
    }),
    getLinkingAuthRedirectUrl(),
    NATIVE_AUTH_CALLBACK_URL,
  );
}

export function getAuthRedirectUrl(): string {
  if (Platform.OS === 'web') {
    return getAuthCallbackUrlForOrigin(getWebOrigin());
  }

  return getNativeAppAuthRedirectUrl();
}

export function getExpectedSupabaseRedirectUrls(): string[] {
  const currentWebOrigin = getWebOrigin();
  const redirectUrls: string[] = [
    NATIVE_AUTH_CALLBACK_URL,
    LEGACY_NATIVE_AUTH_CALLBACK_URL,
    'flashquest://**',
    'exp://**/--/auth-callback',
    'exps://**/--/auth-callback',
    getAuthCallbackUrlForOrigin(LOCALHOST_WEB_ORIGIN),
    `${getAuthCallbackUrlForOrigin(LOCALHOST_WEB_ORIGIN)}**`,
    getLegacyAuthCallbackUrlForOrigin(LOCALHOST_WEB_ORIGIN),
    getAuthCallbackUrlForOrigin(PRODUCTION_WEB_ORIGIN),
    `${getAuthCallbackUrlForOrigin(PRODUCTION_WEB_ORIGIN)}**`,
    getLegacyAuthCallbackUrlForOrigin(PRODUCTION_WEB_ORIGIN),
    getAuthCallbackUrlForOrigin(currentWebOrigin),
    `${getAuthCallbackUrlForOrigin(currentWebOrigin)}**`,
    getLegacyAuthCallbackUrlForOrigin(currentWebOrigin),
  ];

  if (Platform.OS !== 'web') {
    redirectUrls.push(getNativeAppAuthRedirectUrl());

    if (isExpoGo()) {
      redirectUrls.push(getExpoGoAuthRedirectUrl());
    }
  }

  return Array.from(new Set(redirectUrls));
}
