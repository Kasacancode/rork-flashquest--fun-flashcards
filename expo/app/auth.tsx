import * as AppleAuthentication from 'expo-apple-authentication';
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

type AuthMode = 'options' | 'email-signin' | 'email-signup';

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
  } = useAuth();
  const [mode, setMode] = useState<AuthMode>('options');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [displayName, setDisplayName] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  useEffect(() => {
    if (isSignedIn && !isLoading) {
      router.replace('/settings');
    }
  }, [isLoading, isSignedIn, router]);

  const handleGoBack = useCallback(() => {
    router.replace('/settings');
  }, [router]);

  const handleApple = useCallback(async () => {
    await signInWithApple();
  }, [signInWithApple]);

  const handleGoogle = useCallback(async () => {
    await signInWithGoogle();
  }, [signInWithGoogle]);

  const handleEmailSignIn = useCallback(async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Missing Fields', 'Please enter your email and password.');
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
    if (!email.trim() || !password.trim()) {
      Alert.alert('Missing Fields', 'Please enter your email and password.');
      return;
    }

    if (password.trim().length < 6) {
      Alert.alert('Weak Password', 'Password must be at least 6 characters.');
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
  }, [displayName, email, password, signUpWithEmail]);

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
                Save your account now. Cloud sync arrives in the next phase.
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
                    <Text style={[styles.socialButtonText, { color: formTextColor }]}>Continue with Google</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.socialButton, { backgroundColor: cardBg, borderColor: cardBorder }]}
                    onPress={() => setMode('email-signin')}
                    activeOpacity={0.85}
                    accessibilityLabel="Sign in with email"
                    testID="auth-email-option-button"
                  >
                    <Mail color={formMutedTextColor} size={20} strokeWidth={2.2} />
                    <Text style={[styles.socialButtonText, { color: formTextColor }]}>Continue with Email</Text>
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
                    style={[styles.input, { backgroundColor: inputBg, borderColor: inputBorder, color: formTextColor }]}
                    placeholder="Email"
                    placeholderTextColor={formMutedTextColor}
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    autoComplete="email"
                    keyboardType="email-address"
                    testID="auth-email-input"
                  />

                  <TextInput
                    style={[styles.input, { backgroundColor: inputBg, borderColor: inputBorder, color: formTextColor }]}
                    placeholder="Password"
                    placeholderTextColor={formMutedTextColor}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                    autoCapitalize="none"
                    autoComplete={mode === 'email-signup' ? 'new-password' : 'current-password'}
                    testID="auth-password-input"
                  />

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
});
