import createContextHook from '@nkzw/create-context-hook';
import * as AppleAuthentication from 'expo-apple-authentication';
import Constants from 'expo-constants';
import * as Crypto from 'expo-crypto';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { AppState, Alert, Platform } from 'react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { supabase } from '@/lib/supabase';
import { logger } from '@/utils/logger';
import {
  getAuthRedirectUrl,
  getExpectedSupabaseRedirectUrls,
  isExpoGo,
  isKnownAuthCallbackUrl,
} from '@/utils/authRedirects';
import { sanitizeProfileName, validateProfileName } from '@/utils/profileName';
import { getProfileDisplayName, getPublicProfileName } from '@/utils/userIdentity';
import { fetchUsername } from '@/utils/usernameService';

import type { AuthError, Session, User } from '@supabase/supabase-js';

WebBrowser.maybeCompleteAuthSession();

interface AuthResult {
  error?: string;
}

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  isSignedIn: boolean;
  username: string | null;
  displayName: string;
  publicDisplayName: string;
  refreshUsername: () => Promise<string | null>;
  updateDisplayName: (displayName: string) => Promise<AuthResult>;
  signInWithApple: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<AuthResult>;
  signUpWithEmail: (email: string, password: string, displayName: string) => Promise<AuthResult>;
  signOut: () => Promise<void>;
}

type OAuthProvider = 'apple' | 'google';
type SupportedOtpType = 'signup' | 'magiclink' | 'recovery' | 'invite' | 'email_change' | 'email';

const SUPPORTED_OTP_TYPES: SupportedOtpType[] = ['signup', 'magiclink', 'recovery', 'invite', 'email_change', 'email'];
const WEB_POPUP_AUTH_MESSAGE_TYPE = 'flashquest:oauth-popup-complete' as const;

function getCallbackParams(url: string): URLSearchParams {
  const parsedUrl = new URL(url);
  const queryParams = new URLSearchParams(parsedUrl.search.startsWith('?') ? parsedUrl.search.slice(1) : parsedUrl.search);
  const hashParams = new URLSearchParams(parsedUrl.hash.startsWith('#') ? parsedUrl.hash.slice(1) : parsedUrl.hash);
  const combined = new URLSearchParams();

  queryParams.forEach((value, key) => {
    combined.set(key, value);
  });

  hashParams.forEach((value, key) => {
    combined.set(key, value);
  });

  return combined;
}

function getReadableAuthError(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string') {
    return error.message;
  }

  return 'An unexpected error occurred.';
}

function isSupportedOtpType(value: string | null): value is SupportedOtpType {
  return value !== null && SUPPORTED_OTP_TYPES.includes(value as SupportedOtpType);
}

function isExploreDeepLink(url: string): boolean {
  if (!url.includes('explore')) {
    return false;
  }

  try {
    const parsedUrl = new URL(url);
    return parsedUrl.pathname === 'explore' || parsedUrl.pathname === '/explore';
  } catch {
    return url.includes('flashquest://explore');
  }
}

function isAuthCallbackUrl(url: string): boolean {
  return isKnownAuthCallbackUrl(url)
    || url.includes('access_token=')
    || url.includes('refresh_token=')
    || url.includes('code=')
    || url.includes('token_hash=');
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function canUseBrowserWindow(): boolean {
  return Platform.OS === 'web' && typeof window !== 'undefined';
}

function isEmbeddedWebPreview(): boolean {
  if (!canUseBrowserWindow()) {
    return false;
  }

  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

function isPopupAuthWindow(): boolean {
  if (!canUseBrowserWindow()) {
    return false;
  }

  return Boolean(window.opener && window.opener !== window);
}

function notifyOpenerOfAuthCallback(url: string): void {
  if (!canUseBrowserWindow() || !isPopupAuthWindow()) {
    return;
  }

  try {
    window.opener?.postMessage({
      type: WEB_POPUP_AUTH_MESSAGE_TYPE,
      url,
    }, window.location.origin);
  } catch (error) {
    logger.warn('[Auth] Failed to notify opener about popup auth callback:', error);
  }
}

function closeAuthPopupWindow(): void {
  if (!canUseBrowserWindow() || !isPopupAuthWindow()) {
    return;
  }

  window.setTimeout(() => {
    window.close();
  }, 60);
}

interface OAuthSignInOptions {
  redirectTo: string;
  skipBrowserRedirect?: boolean;
  scopes?: string;
  queryParams?: Record<string, string>;
}

function getOAuthSignInOptions(
  provider: OAuthProvider,
  redirectTo: string,
  skipBrowserRedirect?: boolean,
): OAuthSignInOptions {
  const options: OAuthSignInOptions = {
    redirectTo,
  };

  if (skipBrowserRedirect) {
    options.skipBrowserRedirect = true;
  }

  if (provider === 'google') {
    options.scopes = 'openid email profile https://www.googleapis.com/auth/userinfo.email';
    options.queryParams = {
      prompt: 'select_account',
    };
  }

  return options;
}

function clearWebAuthCallbackState(): void {
  const scopedGlobal = globalThis as typeof globalThis & {
    history?: {
      replaceState?: (data: unknown, unused: string, url?: string | URL | null) => void;
    };
    location?: {
      pathname?: string;
    };
  };

  const pathname = scopedGlobal.location?.pathname;

  if (!pathname) {
    return;
  }

  scopedGlobal.history?.replaceState?.({}, '', pathname);
}

export const [AuthProvider, useAuth] = createContextHook<AuthContextValue>(() => {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [username, setUsername] = useState<string | null>(null);

  const completeAuthSessionFromUrl = useCallback(async (url: string): Promise<AuthResult> => {
    try {
      const params = getCallbackParams(url);
      const errorDescription = params.get('error_description') ?? params.get('error');
      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token');
      const code = params.get('code');
      const tokenHash = params.get('token_hash');
      const otpType = params.get('type');

      logger.log('[Auth] Processing callback', {
        hasAccessToken: Boolean(accessToken),
        hasRefreshToken: Boolean(refreshToken),
        hasCode: Boolean(code),
        hasTokenHash: Boolean(tokenHash),
        otpType: otpType ?? null,
      });

      if (errorDescription) {
        logger.warn('[Auth] Callback returned error:', errorDescription);
        return { error: errorDescription };
      }

      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (error) {
          logger.warn('[Auth] Failed to store callback session:', error.message);
          return { error: error.message };
        }

        logger.log('[Auth] Session stored from callback tokens');
        return {};
      }

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          logger.warn('[Auth] Failed to exchange callback code:', error.message);
          return { error: error.message };
        }

        logger.log('[Auth] Session exchanged from callback code');
        return {};
      }

      if (tokenHash && isSupportedOtpType(otpType)) {
        const { error } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: otpType,
        });

        if (error) {
          logger.warn('[Auth] Failed to verify callback token hash:', error.message);
          return { error: error.message };
        }

        logger.log('[Auth] Session verified from callback token hash');
        return {};
      }

      logger.warn('[Auth] Callback missing usable auth payload');
      return { error: 'Authentication callback did not include a valid session.' };
    } catch (error: unknown) {
      logger.warn('[Auth] Failed to process auth callback:', error);
      return { error: getReadableAuthError(error) };
    }
  }, []);

  const waitForSessionAfterBrowserReturn = useCallback(async (): Promise<boolean> => {
    for (let attempt = 0; attempt < 15; attempt += 1) {
      const { data, error } = await supabase.auth.getSession();

      if (error) {
        logger.warn('[Auth] Failed to read session while waiting for browser return:', error.message);
        return false;
      }

      if (data.session) {
        logger.log('[Auth] Session became available after browser return');
        return true;
      }

      await delay(200);
    }

    logger.log('[Auth] No session became available after browser return');
    return false;
  }, []);

  const signInWithOAuthProvider = useCallback(async (provider: OAuthProvider): Promise<void> => {
    const redirectTo = getAuthRedirectUrl();
    const isEmbeddedPreview = isEmbeddedWebPreview();
    const shouldUseWebRedirectFlow = Platform.OS === 'web' && !isEmbeddedPreview;
    const expectedSupabaseRedirects = getExpectedSupabaseRedirectUrls();

    try {
      logger.log('[Auth] Starting OAuth sign in', {
        provider,
        platform: Platform.OS,
        appOwnership: Constants.appOwnership ?? 'unknown',
        redirectTo,
        isExpoGo: isExpoGo(),
        shouldUseWebRedirectFlow,
        isEmbeddedPreview,
        expectedSupabaseRedirects,
      });
      logger.log('[Auth] Supabase redirect allowlist copy/paste', expectedSupabaseRedirects.join('\n'));

      if (shouldUseWebRedirectFlow) {
        const { error } = await supabase.auth.signInWithOAuth({
          provider,
          options: getOAuthSignInOptions(provider, redirectTo),
        });

        if (error) {
          logger.warn('[Auth] OAuth redirect failed:', error.message);
          Alert.alert('Sign In Failed', error.message);
        }

        return;
      }

      if (Platform.OS === 'web' && isEmbeddedPreview) {
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider,
          options: getOAuthSignInOptions(provider, redirectTo, true),
        });

        if (error) {
          logger.warn('[Auth] OAuth popup setup failed:', error.message);
          Alert.alert('Sign In Failed', error.message);
          return;
        }

        if (!data?.url) {
          logger.warn('[Auth] OAuth popup setup returned no URL');
          Alert.alert('Sign In Failed', 'Sign-in could not be started.');
          return;
        }

        const popup = window.open(data.url, 'flashquest-oauth', 'popup=yes,width=520,height=720');

        if (!popup) {
          logger.warn('[Auth] OAuth popup was blocked, falling back to browser redirect');
          window.location.assign(data.url);
          return;
        }

        popup.focus();
        return;
      }

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: getOAuthSignInOptions(provider, redirectTo, true),
      });

      if (error) {
        logger.warn('[Auth] OAuth setup failed:', error.message);
        Alert.alert('Sign In Failed', error.message);
        return;
      }

      if (!data?.url) {
        logger.warn('[Auth] OAuth setup returned no URL');
        Alert.alert('Sign In Failed', 'Sign-in could not be started.');
        return;
      }

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      logger.log('[Auth] OAuth browser session finished', {
        provider,
        type: result.type,
        hasUrl: 'url' in result && Boolean(result.url),
      });

      if (result.type === 'success' && result.url) {
        const callbackResult = await completeAuthSessionFromUrl(result.url);
        if (callbackResult.error) {
          Alert.alert('Sign In Failed', callbackResult.error);
        }
        return;
      }

      const hasRecoveredSession = await waitForSessionAfterBrowserReturn();
      if (hasRecoveredSession) {
        return;
      }

      if (result.type === 'cancel' || result.type === 'dismiss') {
        return;
      }

      Alert.alert('Sign In Failed', 'Sign-in was interrupted. Please try again.');
    } catch (error: unknown) {
      logger.warn('[Auth] OAuth sign-in error:', error);
      Alert.alert('Sign In Failed', 'Could not complete sign-in. Please try again.');
    }
  }, [completeAuthSessionFromUrl, waitForSessionAfterBrowserReturn]);

  useEffect(() => {
    let isMounted = true;

    logger.log('[Auth] Loading initial session');

    supabase.auth.getSession()
      .then(({ data }) => {
        if (!isMounted) {
          return;
        }

        logger.log('[Auth] Initial session loaded', { isSignedIn: Boolean(data.session) });
        setSession(data.session ?? null);
        setIsLoading(false);
      })
      .catch((error: AuthError | Error) => {
        logger.warn('[Auth] Failed to load initial session:', error);
        if (isMounted) {
          setIsLoading(false);
        }
      });

    const { data: authListener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      logger.log('[Auth] State changed', { event, isSignedIn: Boolean(nextSession) });
      setSession(nextSession ?? null);
      setIsLoading(false);
    });

    const appStateSubscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        logger.log('[Auth] App active, starting auth token refresh');
        void supabase.auth.startAutoRefresh();
      } else {
        logger.log('[Auth] App inactive/background, stopping auth token refresh');
        void supabase.auth.stopAutoRefresh();
      }
    });

    void supabase.auth.startAutoRefresh();

    return () => {
      isMounted = false;
      authListener.subscription.unsubscribe();
      appStateSubscription.remove();
      void supabase.auth.stopAutoRefresh();
    };
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web' && isEmbeddedWebPreview()) {
      const handleMessage = (event: MessageEvent) => {
        if (event.origin !== window.location.origin) {
          return;
        }

        const eventData = typeof event.data === 'object' && event.data !== null
          ? event.data as { type?: string; url?: string }
          : null;

        if (!eventData || eventData.type !== WEB_POPUP_AUTH_MESSAGE_TYPE) {
          return;
        }

        logger.log('[Auth] Received popup auth completion message');
        void waitForSessionAfterBrowserReturn()
          .then(async (hasRecoveredSession) => {
            if (hasRecoveredSession) {
              return;
            }

            if (typeof eventData.url !== 'string' || !isAuthCallbackUrl(eventData.url)) {
              Alert.alert('Sign In Failed', 'Sign-in did not return a valid callback URL.');
              return;
            }

            const result = await completeAuthSessionFromUrl(eventData.url);

            if (!result.error) {
              return;
            }

            const hasRecoveredAfterRetry = await waitForSessionAfterBrowserReturn();
            if (!hasRecoveredAfterRetry) {
              Alert.alert('Sign In Failed', result.error);
            }
          })
          .catch((error: unknown) => {
            logger.warn('[Auth] Failed to resolve popup auth message:', error);
          });
      };

      window.addEventListener('message', handleMessage);

      return () => {
        window.removeEventListener('message', handleMessage);
      };
    }

    return undefined;
  }, [completeAuthSessionFromUrl, waitForSessionAfterBrowserReturn]);

  useEffect(() => {
    if (Platform.OS === 'web') {
      const currentUrl = typeof window !== 'undefined' ? window.location.href : '';

      if (!currentUrl || !isAuthCallbackUrl(currentUrl)) {
        return undefined;
      }

      if (isPopupAuthWindow()) {
        logger.log('[Auth] Detected popup auth callback, notifying opener');
        notifyOpenerOfAuthCallback(currentUrl);
        clearWebAuthCallbackState();
        closeAuthPopupWindow();
        return undefined;
      }

      let isMounted = true;

      logger.log('[Auth] Detected web auth callback URL');
      void waitForSessionAfterBrowserReturn()
        .then(async (hasRecoveredSession) => {
          if (!isMounted) {
            return;
          }

          if (hasRecoveredSession) {
            clearWebAuthCallbackState();
            return;
          }

          logger.log('[Auth] Web callback was not auto-detected, attempting manual recovery');
          const result = await completeAuthSessionFromUrl(currentUrl);

          if (!isMounted) {
            return;
          }

          if (result.error) {
            Alert.alert('Sign In Failed', result.error);
            return;
          }

          clearWebAuthCallbackState();
        })
        .catch((error: unknown) => {
          logger.warn('[Auth] Failed while resolving web auth callback:', error);
        });

      return () => {
        isMounted = false;
      };
    }

    let isMounted = true;

    Linking.getInitialURL()
      .then((initialUrl) => {
        if (!isMounted || !initialUrl) {
          return;
        }

        if (isExploreDeepLink(initialUrl)) {
          logger.log('[Auth] Skipping initial explore deep link in auth handler');
          return;
        }

        if (!isAuthCallbackUrl(initialUrl)) {
          return;
        }

        logger.log('[Auth] Handling initial auth URL');
        void completeAuthSessionFromUrl(initialUrl).then((result) => {
          if (result.error) {
            Alert.alert('Sign In Failed', result.error);
          }
        });
      })
      .catch((error: unknown) => {
        logger.warn('[Auth] Failed to read initial URL:', error);
      });

    const subscription = Linking.addEventListener('url', ({ url }) => {
      if (isExploreDeepLink(url)) {
        logger.log('[Auth] Skipping runtime explore deep link in auth handler');
        return;
      }

      if (!isAuthCallbackUrl(url)) {
        return;
      }

      logger.log('[Auth] Handling runtime auth URL');
      void completeAuthSessionFromUrl(url).then((result) => {
        if (result.error) {
          Alert.alert('Sign In Failed', result.error);
        }
      });
    });

    return () => {
      isMounted = false;
      subscription.remove();
    };
  }, [completeAuthSessionFromUrl, waitForSessionAfterBrowserReturn]);

  const refreshUsername = useCallback(async (): Promise<string | null> => {
    if (!session?.user?.id) {
      setUsername(null);
      return null;
    }

    const nextUsername = await fetchUsername(session.user.id);
    setUsername(nextUsername);
    return nextUsername;
  }, [session?.user?.id]);

  useEffect(() => {
    void refreshUsername().catch((error: unknown) => {
      logger.warn('[Auth] Failed to refresh username:', error);
      setUsername(null);
    });
  }, [refreshUsername]);

  const signInWithApple = useCallback(async (): Promise<void> => {
    try {
      if (Platform.OS !== 'ios') {
        Alert.alert('Unavailable', 'Apple Sign In is only available on iOS devices.');
        return;
      }

      const appleSignInAvailable = await AppleAuthentication.isAvailableAsync();

      if (!appleSignInAvailable) {
        Alert.alert('Unavailable', 'Apple Sign In is not available on this device.');
        return;
      }

      const rawNonce = Crypto.randomUUID();
      const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);

      logger.log('[Auth] Starting Apple sign in');

      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce: hashedNonce,
      });

      if (!credential.identityToken) {
        Alert.alert('Sign In Failed', 'No identity token was received from Apple.');
        return;
      }

      const { error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken,
        nonce: rawNonce,
      });

      if (!error) {
        return;
      }

      logger.warn('[Auth] Apple native sign-in failed:', error.message);

      if (error.message.toLowerCase().includes('audience')) {
        logger.log('[Auth] Falling back to Apple OAuth flow');
        await signInWithOAuthProvider('apple');
        return;
      }

      Alert.alert('Sign In Failed', error.message);
    } catch (error: unknown) {
      const code = typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string'
        ? error.code
        : '';

      if (code === 'ERR_REQUEST_CANCELED') {
        logger.log('[Auth] Apple sign-in cancelled');
        return;
      }

      logger.warn('[Auth] Apple sign-in error:', error);
      Alert.alert('Sign In Failed', 'Could not sign in with Apple. Please try again.');
    }
  }, [signInWithOAuthProvider]);

  const signInWithGoogle = useCallback(async (): Promise<void> => {
    await signInWithOAuthProvider('google');
  }, [signInWithOAuthProvider]);

  const signInWithEmail = useCallback(async (email: string, password: string): Promise<AuthResult> => {
    try {
      logger.log('[Auth] Signing in with email', { email });
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      return error ? { error: error.message } : {};
    } catch (error: unknown) {
      logger.warn('[Auth] Email sign-in error:', error);
      return { error: getReadableAuthError(error) };
    }
  }, []);

  const signUpWithEmail = useCallback(async (email: string, password: string, displayName: string): Promise<AuthResult> => {
    try {
      const redirectTo = getAuthRedirectUrl();
      logger.log('[Auth] Signing up with email', {
        email,
        platform: Platform.OS,
        appOwnership: Constants.appOwnership ?? 'unknown',
        redirectTo,
        expectedSupabaseRedirects: getExpectedSupabaseRedirectUrls(),
      });

      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: displayName,
          },
          emailRedirectTo: redirectTo,
        },
      });

      return error ? { error: error.message } : {};
    } catch (error: unknown) {
      logger.warn('[Auth] Email sign-up error:', error);
      return { error: getReadableAuthError(error) };
    }
  }, []);

  const updateDisplayName = useCallback(async (nextDisplayName: string): Promise<AuthResult> => {
    if (!session?.user) {
      return { error: 'You need to be signed in to update your profile.' };
    }

    const validationError = validateProfileName(nextDisplayName);
    if (validationError) {
      return { error: validationError };
    }

    const sanitizedDisplayName = sanitizeProfileName(nextDisplayName);

    try {
      logger.log('[Auth] Updating display name', {
        userId: session.user.id,
        displayName: sanitizedDisplayName,
      });

      const { data, error } = await supabase.auth.updateUser({
        data: {
          ...(session.user.user_metadata ?? {}),
          full_name: sanitizedDisplayName,
          name: sanitizedDisplayName,
        },
      });

      if (error) {
        logger.warn('[Auth] Display name update failed:', error.message);
        return { error: error.message };
      }

      if (data.user) {
        setSession((currentSession) => {
          if (!currentSession) {
            return currentSession;
          }

          return {
            ...currentSession,
            user: data.user,
          };
        });
      }

      return {};
    } catch (error: unknown) {
      logger.warn('[Auth] Display name update error:', error);
      return { error: getReadableAuthError(error) };
    }
  }, [session?.user]);

  const signOut = useCallback(async (): Promise<void> => {
    try {
      logger.log('[Auth] Signing out');
      const { error } = await supabase.auth.signOut();
      if (error) {
        logger.warn('[Auth] Sign-out failed:', error.message);
        Alert.alert('Sign Out Failed', error.message);
      }
    } catch (error: unknown) {
      logger.warn('[Auth] Sign-out error:', error);
      Alert.alert('Sign Out Failed', 'Could not sign out right now. Please try again.');
    }
  }, []);

  const user = session?.user ?? null;
  const displayName = getProfileDisplayName({
    username,
    user,
    fallback: '',
  });
  const publicDisplayName = getPublicProfileName({
    username,
    user,
    fallback: displayName,
  });

  return useMemo<AuthContextValue>(() => ({
    session,
    user,
    isLoading,
    isSignedIn: Boolean(session),
    username,
    displayName,
    publicDisplayName,
    refreshUsername,
    updateDisplayName,
    signInWithApple,
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    signOut,
  }), [displayName, isLoading, publicDisplayName, refreshUsername, session, signInWithApple, signInWithEmail, signInWithGoogle, signOut, signUpWithEmail, updateDisplayName, user, username]);
});
