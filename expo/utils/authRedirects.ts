import { makeRedirectUri } from 'expo-auth-session';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

export const AUTH_CALLBACK_PATH = 'auth-callback';
export const NATIVE_AUTH_CALLBACK_URL = 'flashquest://auth-callback';

function getWebOrigin(): string {
  const scopedGlobal = globalThis as typeof globalThis & {
    location?: {
      origin?: string;
    };
  };

  return scopedGlobal.location?.origin ?? 'http://localhost:3000';
}

export function isExpoGo(): boolean {
  return Constants.appOwnership === 'expo';
}

export function getAuthRedirectUrl(): string {
  if (Platform.OS === 'web') {
    return `${getWebOrigin()}/${AUTH_CALLBACK_PATH}`;
  }

  if (isExpoGo()) {
    return makeRedirectUri({ path: AUTH_CALLBACK_PATH });
  }

  return makeRedirectUri({
    native: NATIVE_AUTH_CALLBACK_URL,
    scheme: 'flashquest',
    path: AUTH_CALLBACK_PATH,
  });
}

export function getExpectedSupabaseRedirectUrls(): string[] {
  const redirectUrls: string[] = [
    NATIVE_AUTH_CALLBACK_URL,
    'http://localhost:3000/auth-callback',
  ];

  if (Platform.OS !== 'web' && isExpoGo()) {
    redirectUrls.push(makeRedirectUri({ path: AUTH_CALLBACK_PATH }));
  }

  return redirectUrls;
}
