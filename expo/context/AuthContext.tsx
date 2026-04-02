import createContextHook from '@nkzw/create-context-hook';
import * as AppleAuthentication from 'expo-apple-authentication';
import { makeRedirectUri } from 'expo-auth-session';
import * as Crypto from 'expo-crypto';
import * as WebBrowser from 'expo-web-browser';
import { AppState, Alert, Platform } from 'react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { supabase } from '@/lib/supabase';
import { logger } from '@/utils/logger';
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

function getAuthRedirectUrl(): string {
  if (Platform.OS === 'web') {
    return makeRedirectUri({ path: 'auth/callback' });
  }

  return 'flashquest://auth/callback';
}

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

export const [AuthProvider, useAuth] = createContextHook<AuthContextValue>(() => {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [username, setUsername] = useState<string | null>(null);

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

      if (error) {
        logger.warn('[Auth] Apple sign-in failed:', error.message);
        Alert.alert('Sign In Failed', error.message);
      }
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
  }, []);

  const signInWithGoogle = useCallback(async (): Promise<void> => {
    try {
      const redirectTo = getAuthRedirectUrl();
      logger.log('[Auth] Starting Google sign in', { redirectTo });

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          skipBrowserRedirect: true,
        },
      });

      if (error) {
        logger.warn('[Auth] Google sign-in setup failed:', error.message);
        Alert.alert('Sign In Failed', error.message);
        return;
      }

      if (!data?.url) {
        Alert.alert('Sign In Failed', 'Google sign-in could not be started.');
        return;
      }

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      logger.log('[Auth] Google auth session result', { type: result.type });

      if (result.type === 'cancel' || result.type === 'dismiss') {
        return;
      }

      if (result.type !== 'success' || !result.url) {
        Alert.alert('Sign In Failed', 'Google sign-in was interrupted. Please try again.');
        return;
      }

      const params = getCallbackParams(result.url);
      const errorDescription = params.get('error_description') ?? params.get('error');
      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token');
      const code = params.get('code');

      if (errorDescription) {
        logger.warn('[Auth] Google callback returned error:', errorDescription);
        Alert.alert('Sign In Failed', errorDescription);
        return;
      }

      if (accessToken && refreshToken) {
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (sessionError) {
          logger.warn('[Auth] Failed to store Google session:', sessionError.message);
          Alert.alert('Sign In Failed', sessionError.message);
        }
        return;
      }

      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) {
          logger.warn('[Auth] Failed to exchange Google auth code:', exchangeError.message);
          Alert.alert('Sign In Failed', exchangeError.message);
        }
        return;
      }

      Alert.alert('Sign In Failed', 'Google sign-in did not return a valid session.');
    } catch (error: unknown) {
      logger.warn('[Auth] Google sign-in error:', error);
      Alert.alert('Sign In Failed', 'Could not sign in with Google. Please try again.');
    }
  }, []);

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
      logger.log('[Auth] Signing up with email', { email, redirectTo });

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
