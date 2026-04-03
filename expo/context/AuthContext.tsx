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
  isEmbeddedWebAuthSession,
  isExpoGo,
  isKnownAuthCallbackUrl,
} from '@/utils/authRedirects';
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
  refreshUsername: () => Promise<string | null>;
  signInWithApple: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<AuthResult>;
  signUpWithEmail: (email: string, password: string, displayName: string) => Promise<AuthResult>;
  signOut: () => Promise<void>;
}

type OAuthProvider = 'apple' | 'google';
type SupportedOtpType = 'signup' | 'magiclink' | 'recovery' | 'invite' | 'email_change' | 'email';

const SUPPORTED_OTP_TYPES: SupportedOtpType[] = ['signup', 'magiclink', 'recovery', 'invite', 'email_change', 'email'];

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

function isAuthCallbackUrl(url: string): boolean {
  return isKnownAuthCallbackUrl(url)
    || url.includes('access_token=')
    || url.includes('refresh_token=')
    || url.includes('code=')
    || url.includes('token_hash=');
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

  const signInWithOAuthProvider = useCallback(async (provider: OAuthProvider): Promise<void> => {
    const redirectTo = getAuthRedirectUrl();
    const shouldUsePopupFlow = Platform.OS !== 'web' || isEmbeddedWebAuthSession();

    try {
      logger.log('[Auth] Starting OAuth sign in', {
        provider,
        platform: Platform.OS,
        appOwnership: Constants.appOwnership ?? 'unknown',
        redirectTo,
        shouldUsePopupFlow,
        expectedSupabaseRedirects: getExpectedSupabaseRedirectUrls(),
      });

      if (Platform.OS === 'web' && !shouldUsePopupFlow) {
        const { error } = await supabase.auth.signInWithOAuth({
          provider,
          options: {
            redirectTo,
          },
        });

        if (error) {
          logger.warn('[Auth] OAuth redirect failed:', error.message);
          Alert.alert('Sign In Failed', error.message);
        }

        return;
      }

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo,
          skipBrowserRedirect: true,
        },
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

      if (result.type === 'cancel' || result.type === 'dismiss') {
        return;
      }

      if (result.type !== 'success' || !result.url) {
        Alert.alert('Sign In Failed', 'Sign-in was interrupted. Please try again.');
        return;
      }

      const callbackResult = await completeAuthSessionFromUrl(result.url);
      if (callbackResult.error) {
        Alert.alert('Sign In Failed', callbackResult.error);
      }
    } catch (error: unknown) {
      logger.warn('[Auth] OAuth sign-in error:', error);
      Alert.alert('Sign In Failed', 'Could not complete sign-in. Please try again.');
    }
  }, [completeAuthSessionFromUrl]);

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
    if (Platform.OS === 'web') {
      const currentUrl = typeof window !== 'undefined' ? window.location.href : '';

      if (!currentUrl || !isAuthCallbackUrl(currentUrl)) {
        return undefined;
      }

      logger.log('[Auth] Handling web auth callback URL');
      void completeAuthSessionFromUrl(currentUrl).then((result) => {
        if (result.error) {
          Alert.alert('Sign In Failed', result.error);
        }
      });

      return undefined;
    }

    let isMounted = true;

    Linking.getInitialURL()
      .then((initialUrl) => {
        if (!isMounted || !initialUrl || !isAuthCallbackUrl(initialUrl)) {
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
  }, [completeAuthSessionFromUrl]);

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

      if (isExpoGo()) {
        logger.log('[Auth] Apple native sign in unavailable in Expo Go, using OAuth fallback');
        await signInWithOAuthProvider('apple');
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
  const displayName = username
    ?? user?.user_metadata?.full_name
    ?? user?.user_metadata?.name
    ?? user?.email?.split('@')[0]
    ?? '';

  return useMemo<AuthContextValue>(() => ({
    session,
    user,
    isLoading,
    isSignedIn: Boolean(session),
    username,
    displayName,
    refreshUsername,
    signInWithApple,
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    signOut,
  }), [displayName, isLoading, refreshUsername, session, signInWithApple, signInWithEmail, signInWithGoogle, signOut, signUpWithEmail, user, username]);
});
