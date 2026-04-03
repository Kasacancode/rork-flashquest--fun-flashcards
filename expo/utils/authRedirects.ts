import { makeRedirectUri } from 'expo-auth-session';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

export const AUTH_CALLBACK_PATH = 'auth-callback';
export const LEGACY_AUTH_CALLBACK_PATH = 'auth/callback';
export const AUTH_CALLBACK_PATHS = [AUTH_CALLBACK_PATH, LEGACY_AUTH_CALLBACK_PATH] as const;
export const NATIVE_AUTH_CALLBACK_URL = 'flashquest://auth-callback';
export const LEGACY_NATIVE_AUTH_CALLBACK_URL = 'flashquest://auth/callback';
export const WEB_AUTH_MESSAGE_TYPE = 'flashquest-auth-callback';
export const NATIVE_AUTH_REDIRECT_QUERY_PARAM = 'native_redirect_url';

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

function tryParseUrl(url: string): URL | null {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

export function isExpoGo(): boolean {
  return Constants.appOwnership === 'expo';
}

export function isEmbeddedWebAuthSession(): boolean {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    return false;
  }

  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
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

export function getNativeAppAuthRedirectUrl(): string {
  if (Platform.OS === 'web') {
    return getAuthCallbackUrlForOrigin(getWebOrigin());
  }

  if (isExpoGo()) {
    return makeRedirectUri({ path: AUTH_CALLBACK_PATH });
  }

  return NATIVE_AUTH_CALLBACK_URL;
}

export function getExpoGoBridgeRedirectUrl(): string {
  const bridgeUrl = new URL(getAuthCallbackUrlForOrigin(PRODUCTION_WEB_ORIGIN));
  bridgeUrl.searchParams.set(NATIVE_AUTH_REDIRECT_QUERY_PARAM, getNativeAppAuthRedirectUrl());
  return bridgeUrl.toString();
}

export function getAuthRedirectUrl(): string {
  if (Platform.OS === 'web') {
    return getAuthCallbackUrlForOrigin(getWebOrigin());
  }

  if (isExpoGo()) {
    return getExpoGoBridgeRedirectUrl();
  }

  return NATIVE_AUTH_CALLBACK_URL;
}

export function buildNativeAppRedirectFromWebCallback(callbackUrl: string): string | null {
  const callback = tryParseUrl(callbackUrl);
  if (!callback) {
    return null;
  }

  const nativeRedirectUrl = callback.searchParams.get(NATIVE_AUTH_REDIRECT_QUERY_PARAM);
  if (!nativeRedirectUrl) {
    return null;
  }

  const nativeRedirect = tryParseUrl(nativeRedirectUrl);
  if (!nativeRedirect) {
    return null;
  }

  callback.searchParams.delete(NATIVE_AUTH_REDIRECT_QUERY_PARAM);

  const mergedQueryParams = new URLSearchParams(
    nativeRedirect.search.startsWith('?') ? nativeRedirect.search.slice(1) : nativeRedirect.search,
  );
  callback.searchParams.forEach((value, key) => {
    mergedQueryParams.set(key, value);
  });

  const mergedHashParams = new URLSearchParams(
    nativeRedirect.hash.startsWith('#') ? nativeRedirect.hash.slice(1) : nativeRedirect.hash,
  );
  const callbackHashParams = new URLSearchParams(
    callback.hash.startsWith('#') ? callback.hash.slice(1) : callback.hash,
  );
  callbackHashParams.forEach((value, key) => {
    mergedHashParams.set(key, value);
  });

  nativeRedirect.search = mergedQueryParams.toString() ? `?${mergedQueryParams.toString()}` : '';
  nativeRedirect.hash = mergedHashParams.toString() ? `#${mergedHashParams.toString()}` : '';

  return nativeRedirect.toString();
}

export function getExpectedSupabaseRedirectUrls(): string[] {
  const currentWebOrigin = getWebOrigin();
  const redirectUrls: string[] = [
    NATIVE_AUTH_CALLBACK_URL,
    LEGACY_NATIVE_AUTH_CALLBACK_URL,
    getAuthCallbackUrlForOrigin(LOCALHOST_WEB_ORIGIN),
    `${getAuthCallbackUrlForOrigin(LOCALHOST_WEB_ORIGIN)}**`,
    getLegacyAuthCallbackUrlForOrigin(LOCALHOST_WEB_ORIGIN),
    getAuthCallbackUrlForOrigin(PRODUCTION_WEB_ORIGIN),
    `${getAuthCallbackUrlForOrigin(PRODUCTION_WEB_ORIGIN)}**`,
    getLegacyAuthCallbackUrlForOrigin(PRODUCTION_WEB_ORIGIN),
    getAuthCallbackUrlForOrigin(currentWebOrigin),
    `${getAuthCallbackUrlForOrigin(currentWebOrigin)}**`,
    getLegacyAuthCallbackUrlForOrigin(currentWebOrigin),
    'exp://**/--/auth-callback',
  ];

  if (Platform.OS !== 'web' && isExpoGo()) {
    redirectUrls.push(getExpoGoBridgeRedirectUrl());
    redirectUrls.push(getNativeAppAuthRedirectUrl());
  }

  return Array.from(new Set(redirectUrls));
}
