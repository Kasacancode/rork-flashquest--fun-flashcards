import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { AtSign, Check, X } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import ResponsiveContainer from '@/components/ResponsiveContainer';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { AUTH_ROUTE, HOME_ROUTE } from '@/utils/routes';
import {
  USERNAME_AVAILABILITY_FALLBACK_MESSAGE,
  USERNAME_MAX_LENGTH,
  claimUsername,
  getUsernameAvailability,
  normalizeUsernameInput,
  validateUsername,
} from '@/utils/usernameService';

export default function ChooseUsernameScreen() {
  const router = useRouter();
  const { isDark, theme } = useTheme();
  const { user, username: existingUsername, refreshUsername } = useAuth();
  const [username, setUsername] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [helperMessage, setHelperMessage] = useState<string | null>(null);
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [isChecking, setIsChecking] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef<number>(0);

  useEffect(() => {
    if (!user?.id) {
      router.replace(AUTH_ROUTE);
      return;
    }

    if (existingUsername) {
      router.replace(HOME_ROUTE);
    }
  }, [existingUsername, router, user?.id]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  const handleChangeUsername = useCallback((value: string) => {
    const cleaned = normalizeUsernameInput(value);
    setUsername(cleaned);
    setError(null);
    setHelperMessage(null);
    setIsAvailable(null);
    setIsChecking(false);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (!cleaned) {
      return;
    }

    const validationError = validateUsername(cleaned);
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsChecking(true);
    const nextRequestId = requestIdRef.current + 1;
    requestIdRef.current = nextRequestId;

    debounceRef.current = setTimeout(() => {
      void getUsernameAvailability(cleaned)
        .then((availabilityResult) => {
          if (requestIdRef.current !== nextRequestId) {
            return;
          }

          setIsChecking(false);

          if (availabilityResult.status === 'available') {
            setIsAvailable(true);
            return;
          }

          if (availabilityResult.status === 'taken') {
            setIsAvailable(false);
            setError('This username is already taken.');
            return;
          }

          setIsAvailable(null);
          setHelperMessage(availabilityResult.error ?? USERNAME_AVAILABILITY_FALLBACK_MESSAGE);
        })
        .catch((availabilityError: unknown) => {
          if (requestIdRef.current !== nextRequestId) {
            return;
          }

          console.warn('[ChooseUsername] Username availability check failed', availabilityError);
          setIsChecking(false);
          setIsAvailable(null);
          setHelperMessage(USERNAME_AVAILABILITY_FALLBACK_MESSAGE);
        });
    }, 500);
  }, []);

  const handleClaim = useCallback(async () => {
    if (!user?.id || isSaving) {
      return;
    }

    const validationError = validateUsername(username);
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSaving(true);
    setHelperMessage(null);
    const result = await claimUsername(user.id, username);

    if (!result.success) {
      setIsSaving(false);
      if ((result.error ?? '').toLowerCase().includes('taken')) {
        setIsAvailable(false);
      }
      setError(result.error ?? 'Could not save username.');
      return;
    }

    await refreshUsername();
    setIsSaving(false);
    router.replace(HOME_ROUTE);
  }, [isSaving, refreshUsername, router, user?.id, username]);

  const canSubmit = username.length >= 3 && !error && !isChecking && !isSaving;
  const backgroundGradient = useMemo<readonly [string, string, string]>(() => (
    isDark
      ? ['#08111f', '#1c1633', '#0b1322']
      : ['#667eea', '#764ba2', '#f093fb']
  ), [isDark]);
  const cardBg = isDark ? 'rgba(15, 23, 42, 0.82)' : 'rgba(255, 255, 255, 0.92)';
  const cardBorder = isDark ? 'rgba(148, 163, 184, 0.18)' : 'rgba(255, 255, 255, 0.55)';
  const inputBg = isDark ? 'rgba(15, 23, 42, 0.65)' : 'rgba(248, 250, 252, 0.95)';
  const defaultInputBorder = isDark ? 'rgba(148, 163, 184, 0.18)' : 'rgba(148, 163, 184, 0.2)';
  const statusBorder = error ? '#EF4444' : isAvailable ? '#10B981' : defaultInputBorder;
  const textColor = isDark ? '#F8FAFC' : '#1E293B';
  const hintColor = isDark ? '#94A3B8' : '#64748B';

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={backgroundGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ResponsiveContainer maxWidth={520} style={styles.content}>
            <View style={styles.iconRow}>
              <View style={styles.iconCircle}>
                <AtSign color="#6366F1" size={28} strokeWidth={2.5} />
              </View>
            </View>

            <Text style={styles.title}>Choose your username</Text>
            <Text style={styles.subtitle}>
              This is your public handle for the leaderboard, arena battles, and published decks. Your profile name stays separate.
            </Text>

            <View style={[styles.inputCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
              <View style={[styles.inputRow, { backgroundColor: inputBg, borderColor: statusBorder }]}>
                <Text style={[styles.atSymbol, { color: hintColor }]}>@</Text>
                <TextInput
                  style={[styles.input, { color: textColor }]}
                  value={username}
                  onChangeText={handleChangeUsername}
                  placeholder="username"
                  placeholderTextColor={isDark ? '#475569' : '#CBD5E1'}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoFocus={true}
                  maxLength={USERNAME_MAX_LENGTH}
                  testID="choose-username-input"
                />
                <View style={styles.inputStatus}>
                  {isChecking ? (
                    <ActivityIndicator size="small" color={theme.primary} />
                  ) : isAvailable === true && !error ? (
                    <Check color="#10B981" size={18} strokeWidth={2.5} />
                  ) : error ? (
                    <X color="#EF4444" size={18} strokeWidth={2.5} />
                  ) : null}
                </View>
              </View>

              {error ? (
                <Text style={styles.errorText}>{error}</Text>
              ) : isAvailable === true ? (
                <Text style={styles.availableText}>Username is available!</Text>
              ) : helperMessage ? (
                <Text style={[styles.hintText, { color: hintColor }]}>{helperMessage}</Text>
              ) : (
                <Text style={[styles.hintText, { color: hintColor }]}>Letters, numbers, and underscores. 3-20 characters.</Text>
              )}
            </View>

            <TouchableOpacity
              style={[styles.claimButton, { opacity: canSubmit ? 1 : 0.4 }]}
              onPress={handleClaim}
              disabled={!canSubmit}
              activeOpacity={0.85}
              testID="choose-username-submit"
            >
              {isSaving ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.claimButtonText}>Claim @{username || '...'}</Text>
              )}
            </TouchableOpacity>
          </ResponsiveContainer>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  iconRow: {
    alignItems: 'center',
    marginBottom: 20,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: 'rgba(99,102,241,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.68)',
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 28,
  },
  inputCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    marginBottom: 20,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
    borderRadius: 14,
    borderWidth: 1.5,
    paddingHorizontal: 14,
  },
  atSymbol: {
    fontSize: 18,
    fontWeight: '700',
    marginRight: 4,
  },
  input: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
  },
  inputStatus: {
    width: 24,
    alignItems: 'center',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 8,
    marginLeft: 4,
  },
  availableText: {
    color: '#10B981',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 8,
    marginLeft: 4,
  },
  hintText: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: 8,
    marginLeft: 4,
  },
  claimButton: {
    backgroundColor: '#6366F1',
    minHeight: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  claimButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
  },
});
