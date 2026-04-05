import * as AppleAuthentication from 'expo-apple-authentication';
import Constants from 'expo-constants';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { ArrowLeft, Mail } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
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
import { uploadToCloud } from '@/utils/cloudSync';
import { getAuthRedirectUrl } from '@/utils/authRedirects';
import { CHOOSE_USERNAME_ROUTE, SETTINGS_ROUTE } from '@/utils/routes';
import { fetchUsername } from '@/utils/usernameService';

type AuthMode = 'options' | 'email-signin' | 'email-signup';

type PasswordRule = {
  label: string;
  test: (value: string) => boolean;
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_RULES: PasswordRule[] = [
  { label: 'At least 8 characters', test: (value: string) => value.length >= 8 },
  { label: 'One uppercase letter', test: (value: string) => /[A-Z]/.test(value) },
  { label: 'One lowercase letter', test: (value: string) => /[a-z]/.test(value) },
  { label: 'One number', test: (value: string) => /[0-9]/.test(value) },
  { label: 'One special character', test: (value: string) => /[^A-Za-z0-9]/.test(value) },
];

export default function AuthScreen() {
  const router = useRouter();
  const { isDark } = useTheme();
  const {
    signInWithApple,
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    isSignedIn,
    isLoading,
    user,
  } = useAuth();
  const [mode, setMode] = useState<AuthMode>('options');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [displayName, setDisplayName] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [emailError, setEmailError] = useState<string>('');
  const [passwordErrors, setPasswordErrors] = useState<string[]>([]);
  const [confirmError, setConfirmError] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  useEffect(() => {
    if (!isSignedIn || !user || isLoading) {
      return;
    }

    void uploadToCloud(user.id);
    void fetchUsername(user.id)
      .then((existingUsername) => {
        if (existingUsername) {
          router.replace(SETTINGS_ROUTE);
          return;
        }

        router.replace(CHOOSE_USERNAME_ROUTE);
      })
      .catch(() => {
        router.replace(SETTINGS_ROUTE);
      });
  }, [isLoading, isSignedIn, router, user]);

  useEffect(() => {
    setEmailError('');
    setPasswordErrors([]);
    setConfirmError('');
    setConfirmPassword('');
  }, [mode]);

  const handleGoBack = useCallback(() => {
    router.replace(SETTINGS_ROUTE);
  }, [router]);

  const validateEmail = useCallback((value: string): boolean => {
    const trimmed = value.trim();

    if (trimmed.length === 0) {
      setEmailError('');
      return false;
    }

    if (!EMAIL_REGEX.test(trimmed)) {
      setEmailError('Enter a valid email address');
      return false;
    }

    setEmailError('');
    return true;
  }, []);

  const getPasswordIssues = useCallback((value: string): string[] => {
    return PASSWORD_RULES.filter((rule) => !rule.test(value)).map((rule) => rule.label);
  }, []);

  const validatePassword = useCallback((value: string): boolean => {
    if (value.length === 0) {
      setPasswordErrors([]);
      return false;
    }

    const issues = getPasswordIssues(value);
    setPasswordErrors(issues);
    return issues.length === 0;
  }, [getPasswordIssues]);

  const validateConfirmPassword = useCallback((value: string, original: string): boolean => {
    if (value.length === 0) {
      setConfirmError('');
      return false;
    }

    if (value !== original) {
      setConfirmError('Passwords do not match');
      return false;
    }

    setConfirmError('');
    return true;
  }, []);

  const handleEmailChange = useCallback((value: string) => {
    setEmail(value);

    if (value.trim().length > 3) {
      validateEmail(value);
      return;
    }

    setEmailError('');
  }, [validateEmail]);

  const handlePasswordChange = useCallback((value: string) => {
    setPassword(value);

    if (mode === 'email-signup') {
      if (value.length > 0) {
        validatePassword(value);
      } else {
        setPasswordErrors([]);
      }
    }

    if (confirmPassword.length > 0) {
      validateConfirmPassword(confirmPassword, value);
    }
  }, [confirmPassword, mode, validateConfirmPassword, validatePassword]);

  const handleConfirmPasswordChange = useCallback((value: string) => {
    setConfirmPassword(value);

    if (value.length > 0) {
      validateConfirmPassword(value, password);
      return;
    }

    setConfirmError('');
  }, [password, validateConfirmPassword]);

  const handleApple = useCallback(async () => {
    await signInWithApple();
  }, [signInWithApple]);

  const handleGoogle = useCallback(async () => {
    await signInWithGoogle();
  }, [signInWithGoogle]);

  const handleEmailSignIn = useCallback(async () => {
    if (!email.trim()) {
      setEmailError('Email is required');
      return;
    }

    if (!EMAIL_REGEX.test(email.trim())) {
      setEmailError('Enter a valid email address');
      return;
    }

    setEmailError('');

    if (!password.trim()) {
      Alert.alert('Missing Password', 'Please enter your password.');
      return;
    }

    setIsSubmitting(true);
    const result = await signInWithEmail(email.trim(), password.trim());
    setIsSubmitting(false);

    if (result.error) {
      Alert.alert('Sign In Failed', result.error);
    }
  }, [email, password, signInWithEmail]);

  const handleEmailSignUp = useCallback(async () => {
    const isEmailValid = validateEmail(email);
    const isPasswordValid = validatePassword(password);
    const isConfirmValid = validateConfirmPassword(confirmPassword, password);

    if (!email.trim()) {
      setEmailError('Email is required');
      return;
    }

    if (!password.trim()) {
      setPasswordErrors(['Password is required']);
      return;
    }

    if (!confirmPassword.trim()) {
      setConfirmError('Please confirm your password');
      return;
    }

    if (!isEmailValid || !isPasswordValid || !isConfirmValid) {
      return;
    }

    setIsSubmitting(true);
    const result = await signUpWithEmail(email.trim(), password.trim(), displayName.trim());
    setIsSubmitting(false);

    if (result.error) {
      Alert.alert('Sign Up Failed', result.error);
      return;
    }

    Alert.alert(
      'Check Your Email',
      'We sent you a confirmation link. Tap it to activate your account, then sign in.',
    );
    setMode('email-signin');
    setConfirmPassword('');
    setPasswordErrors([]);
    setConfirmError('');
    setEmailError('');
  }, [confirmPassword, displayName, email, password, signUpWithEmail, validateConfirmPassword, validateEmail, validatePassword]);

  const backgroundGradient = useMemo<readonly [string, string, string]>(() => (
    isDark
      ? ['#08111f', '#1c1633', '#0b1322']
      : ['#667eea', '#764ba2', '#f093fb']
  ), [isDark]);
  const cardBg = isDark ? 'rgba(15, 23, 42, 0.82)' : 'rgba(255, 255, 255, 0.92)';
  const cardBorder = isDark ? 'rgba(148, 163, 184, 0.18)' : 'rgba(255, 255, 255, 0.55)';
  const inputBg = isDark ? 'rgba(15, 23, 42, 0.65)' : 'rgba(248, 250, 252, 0.95)';
  const inputBorder = isDark ? 'rgba(148, 163, 184, 0.18)' : 'rgba(148, 163, 184, 0.2)';
  const formTextColor = isDark ? '#F8FAFC' : '#1E293B';
  const formMutedTextColor = isDark ? 'rgba(255,255,255,0.58)' : '#64748B';
  const guestNoteColor = isDark ? 'rgba(226,232,240,0.58)' : 'rgba(255,255,255,0.82)';
  const switchModeColor = isDark ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.92)';
  const authDebugCardBackground = isDark ? 'rgba(15, 23, 42, 0.72)' : 'rgba(255, 255, 255, 0.18)';
  const authDebugCardBorder = isDark ? 'rgba(148, 163, 184, 0.18)' : 'rgba(255, 255, 255, 0.22)';
  const authDebugTitleColor = '#FFFFFF';
  const authDebugBodyColor = isDark ? 'rgba(226,232,240,0.84)' : 'rgba(255,255,255,0.92)';
  const authDebugUrlColor = isDark ? '#C4B5FD' : '#E9D5FF';
  const shouldShowAuthDebugCard = Platform.OS === 'web' || Constants.appOwnership === 'expo';
  const authRedirectUrl = getAuthRedirectUrl();
  const passwordBorderColor = mode === 'email-signup' && passwordErrors.length > 0 ? '#EF4444' : inputBorder;

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
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            testID="auth-screen"
          >
            <ResponsiveContainer maxWidth={560}>
              <TouchableOpacity
                style={styles.backButton}
                onPress={handleGoBack}
                accessibilityLabel="Go back"
                accessibilityRole="button"
                testID="auth-back-button"
              >
                <ArrowLeft color="#FFFFFF" size={22} strokeWidth={2.2} />
              </TouchableOpacity>

              <Text style={styles.title}>
                {mode === 'email-signup' ? 'Create Account' : 'Sign In'}
              </Text>
              <Text style={styles.subtitle}>
                Sync your decks, stats, and progress across devices
              </Text>

              {mode === 'options' ? (
                <View style={styles.optionsContainer}>
                  {Platform.OS === 'ios' ? (
                    <AppleAuthentication.AppleAuthenticationButton
                      buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
                      buttonStyle={isDark
                        ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
                        : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
                      }
                      cornerRadius={16}
                      style={styles.appleButton}
                      onPress={handleApple}
                    />
                  ) : null}

                  <TouchableOpacity
                    style={[styles.socialButton, { backgroundColor: cardBg, borderColor: cardBorder }]}
                    onPress={handleGoogle}
                    activeOpacity={0.85}
                    accessibilityLabel="Sign in with Google"
                    testID="auth-google-button"
                  >
                    <Text style={styles.googleIcon}>G</Text>
                    <Text style={[styles.socialButtonText, { color: formTextColor }]}>Sign in with Google</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.socialButton, { backgroundColor: cardBg, borderColor: cardBorder }]}
                    onPress={() => setMode('email-signin')}
                    activeOpacity={0.85}
                    accessibilityLabel="Sign in with email"
                    testID="auth-email-option-button"
                  >
                    <Mail color={formMutedTextColor} size={20} strokeWidth={2.2} />
                    <Text style={[styles.socialButtonText, { color: formTextColor }]}>Sign in with Email</Text>
                  </TouchableOpacity>

                  <View style={styles.dividerRow}>
                    <View style={[styles.dividerLine, { backgroundColor: 'rgba(255,255,255,0.15)' }]} />
                    <Text style={styles.dividerText}>or</Text>
                    <View style={[styles.dividerLine, { backgroundColor: 'rgba(255,255,255,0.15)' }]} />
                  </View>

                  <TouchableOpacity
                    style={[styles.signUpButton, { borderColor: 'rgba(255,255,255,0.25)' }]}
                    onPress={() => setMode('email-signup')}
                    activeOpacity={0.85}
                    accessibilityLabel="Create a new account"
                    testID="auth-signup-option-button"
                  >
                    <Text style={styles.signUpButtonText}>New here? Create an account</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={[styles.emailForm, { backgroundColor: cardBg, borderColor: cardBorder }]}>
                  {mode === 'email-signup' ? (
                    <TextInput
                      style={[styles.input, { backgroundColor: inputBg, borderColor: inputBorder, color: formTextColor }]}
                      placeholder="Display name"
                      placeholderTextColor={formMutedTextColor}
                      value={displayName}
                      onChangeText={setDisplayName}
                      autoCapitalize="words"
                      autoComplete="name"
                      testID="auth-display-name-input"
                    />
                  ) : null}

                  <TextInput
                    style={[styles.input, { backgroundColor: inputBg, borderColor: emailError ? '#EF4444' : inputBorder, color: formTextColor }]}
                    placeholder="Email"
                    placeholderTextColor={formMutedTextColor}
                    value={email}
                    onChangeText={handleEmailChange}
                    autoCapitalize="none"
                    autoComplete="email"
                    keyboardType="email-address"
                    testID="auth-email-input"
                  />
                  {emailError ? (
                    <Text style={[styles.fieldError, { color: '#EF4444' }]}>{emailError}</Text>
                  ) : null}

                  <TextInput
                    style={[styles.input, { backgroundColor: inputBg, borderColor: passwordBorderColor, color: formTextColor }]}
                    placeholder="Password"
                    placeholderTextColor={formMutedTextColor}
                    value={password}
                    onChangeText={handlePasswordChange}
                    secureTextEntry
                    autoCapitalize="none"
                    autoComplete={mode === 'email-signup' ? 'new-password' : 'current-password'}
                    testID="auth-password-input"
                  />
                  {password.length === 0 && passwordErrors.length > 0 ? (
                    <Text style={[styles.fieldError, { color: '#EF4444' }]}>{passwordErrors[0]}</Text>
                  ) : null}

                  {mode === 'email-signup' && password.length > 0 ? (
                    <View style={styles.passwordRequirements}>
                      {PASSWORD_RULES.map((rule) => {
                        const met = rule.test(password);

                        return (
                          <View key={rule.label} style={styles.requirementRow}>
                            <Text style={[styles.requirementIndicator, { color: met ? '#10B981' : '#94A3B8' }]}>
                              {met ? '\u2713' : '\u2022'}
                            </Text>
                            <Text style={[styles.requirementText, { color: met ? '#10B981' : '#94A3B8' }]}>
                              {rule.label}
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                  ) : null}

                  {mode === 'email-signup' ? (
                    <>
                      <TextInput
                        style={[styles.input, { backgroundColor: inputBg, borderColor: confirmError ? '#EF4444' : inputBorder, color: formTextColor }]}
                        placeholder="Confirm password"
                        placeholderTextColor={formMutedTextColor}
                        value={confirmPassword}
                        onChangeText={handleConfirmPasswordChange}
                        secureTextEntry
                        autoCapitalize="none"
                        autoComplete="new-password"
                        testID="auth-confirm-password-input"
                      />
                      {confirmError ? (
                        <Text style={[styles.fieldError, { color: '#EF4444' }]}>{confirmError}</Text>
                      ) : null}
                    </>
                  ) : null}

                  <TouchableOpacity
                    style={[styles.submitButton, { opacity: isSubmitting ? 0.6 : 1 }]}
                    onPress={mode === 'email-signup' ? handleEmailSignUp : handleEmailSignIn}
                    disabled={isSubmitting}
                    activeOpacity={0.85}
                    testID="auth-submit-button"
                  >
                    <Text style={styles.submitButtonText}>
                      {isSubmitting ? 'Please wait...' : mode === 'email-signup' ? 'Create Account' : 'Sign In'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => setMode(mode === 'email-signup' ? 'email-signin' : 'email-signup')}
                    style={styles.switchModeButton}
                    accessibilityRole="button"
                    testID="auth-switch-mode-button"
                  >
                    <Text style={[styles.switchModeText, { color: switchModeColor }]}> 
                      {mode === 'email-signup' ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => setMode('options')}
                    style={styles.switchModeButton}
                    accessibilityRole="button"
                    testID="auth-back-to-options-button"
                  >
                    <Text style={[styles.switchModeText, { color: switchModeColor }]}>Back to all sign-in options</Text>
                  </TouchableOpacity>
                </View>
              )}

              <Text style={[styles.guestNote, { color: guestNoteColor }]}>You can keep using FlashQuest without an account. Your current local data stays on this device.</Text>

              {shouldShowAuthDebugCard ? (
                <View
                  style={[
                    styles.authDebugCard,
                    {
                      backgroundColor: authDebugCardBackground,
                      borderColor: authDebugCardBorder,
                    },
                  ]}
                  testID="auth-debug-card"
                >
                  <Text style={[styles.authDebugTitle, { color: authDebugTitleColor }]}>Preview auth redirect</Text>
                  <Text style={[styles.authDebugBody, { color: authDebugBodyColor }]}>Preview now opens Google in a separate window. If sign-in still fails, add this exact URL to Supabase Redirect URLs and make sure your Gmail is in Google test users.</Text>
                  <Text
                    selectable
                    style={[styles.authDebugUrl, { color: authDebugUrlColor }]}
                    testID="auth-debug-redirect-url"
                  >
                    {authRedirectUrl}
                  </Text>
                </View>
              ) : null}
            </ResponsiveContainer>
          </ScrollView>
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
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 40,
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
    marginBottom: 24,
    alignSelf: 'flex-start',
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.76)',
    marginBottom: 32,
    lineHeight: 22,
  },
  optionsContainer: {
    gap: 12,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
    marginBottom: 4,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
  },
  dividerText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 13,
    fontWeight: '600',
  },
  signUpButton: {
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  signUpButtonText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 15,
    fontWeight: '700',
  },
  appleButton: {
    height: 52,
    width: '100%',
  },
  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    height: 56,
    borderRadius: 16,
    borderWidth: 1,
  },
  googleIcon: {
    fontSize: 20,
    fontWeight: '700',
    color: '#4285F4',
  },
  socialButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
  emailForm: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    gap: 12,
  },
  input: {
    minHeight: 50,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    fontSize: 16,
    fontWeight: '500',
  },
  fieldError: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: -6,
    marginLeft: 4,
  },
  passwordRequirements: {
    gap: 4,
    marginTop: -4,
    marginBottom: 4,
    paddingHorizontal: 4,
  },
  requirementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  requirementIndicator: {
    fontSize: 12,
    fontWeight: '700',
  },
  requirementText: {
    fontSize: 12,
    fontWeight: '600',
  },
  submitButton: {
    backgroundColor: '#6366F1',
    minHeight: 50,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  switchModeButton: {
    alignItems: 'center',
    paddingVertical: 6,
  },
  switchModeText: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  guestNote: {
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 24,
    lineHeight: 19,
  },
  authDebugCard: {
    marginTop: 18,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 8,
  },
  authDebugTitle: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.2,
    textTransform: 'uppercase',
  },
  authDebugBody: {
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
  },
  authDebugUrl: {
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18,
  },
});
