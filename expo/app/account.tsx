import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMutation } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { ArrowLeft, AtSign, Key, LogOut, ShieldAlert, UserRound } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
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
import { supabase } from '@/lib/supabase';
import { logger } from '@/utils/logger';
import { PROFILE_NAME_MAX_LENGTH, sanitizeProfileName, validateProfileName } from '@/utils/profileName';
import { AUTH_ROUTE } from '@/utils/routes';
import {
  USERNAME_AVAILABILITY_FALLBACK_MESSAGE,
  USERNAME_MAX_LENGTH,
  claimUsername,
  getUsernameAvailability,
  normalizeUsernameInput,
  validateUsername,
} from '@/utils/usernameService';

type PasswordRule = {
  label: string;
  test: (value: string) => boolean;
};

type AuthIdentity = {
  provider?: string | null;
};

const PASSWORD_RULES: PasswordRule[] = [
  { label: 'At least 8 characters', test: (value: string) => value.length >= 8 },
  { label: 'One uppercase letter', test: (value: string) => /[A-Z]/.test(value) },
  { label: 'One lowercase letter', test: (value: string) => /[a-z]/.test(value) },
  { label: 'One number', test: (value: string) => /[0-9]/.test(value) },
  { label: 'One special character', test: (value: string) => /[^A-Za-z0-9]/.test(value) },
];

export default function AccountScreen() {
  const router = useRouter();
  const { isDark, theme } = useTheme();
  const {
    displayName,
    isLoading,
    isSignedIn,
    publicDisplayName,
    refreshUsername,
    signOut,
    updateDisplayName,
    user,
    username,
  } = useAuth();

  const [profileName, setProfileName] = useState<string>(displayName);
  const [usernameInput, setUsernameInput] = useState<string>(username ?? '');
  const [profileNameError, setProfileNameError] = useState<string | null>(null);
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [usernameHelper, setUsernameHelper] = useState<string | null>(null);
  const [isUsernameAvailable, setIsUsernameAvailable] = useState<boolean | null>(null);
  const [isCheckingUsername, setIsCheckingUsername] = useState<boolean>(false);
  const [showChangePassword, setShowChangePassword] = useState<boolean>(false);
  const [currentPassword, setCurrentPassword] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmNewPassword, setConfirmNewPassword] = useState<string>('');
  const [passwordChangeError, setPasswordChangeError] = useState<string>('');
  const [passwordChangeSuccess, setPasswordChangeSuccess] = useState<boolean>(false);
  const [isChangingPassword, setIsChangingPassword] = useState<boolean>(false);
  const [newPasswordIssues, setNewPasswordIssues] = useState<string[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef<number>(0);
  const passwordSuccessTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isLoading && !isSignedIn) {
      router.replace(AUTH_ROUTE);
    }
  }, [isLoading, isSignedIn, router]);

  useEffect(() => {
    setProfileName(displayName);
  }, [displayName]);

  useEffect(() => {
    setUsernameInput(username ?? '');
  }, [username]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      if (passwordSuccessTimeoutRef.current) {
        clearTimeout(passwordSuccessTimeoutRef.current);
      }
    };
  }, []);

  const currentSanitizedProfileName = useMemo<string>(() => sanitizeProfileName(displayName), [displayName]);
  const nextSanitizedProfileName = useMemo<string>(() => sanitizeProfileName(profileName), [profileName]);
  const currentSanitizedUsername = useMemo<string>(() => (username ?? '').trim(), [username]);
  const nextSanitizedUsername = useMemo<string>(() => usernameInput.trim(), [usernameInput]);
  const isDirty = nextSanitizedProfileName !== currentSanitizedProfileName || nextSanitizedUsername !== currentSanitizedUsername;

  const identityPreviewName = useMemo<string>(() => {
    return nextSanitizedProfileName || displayName || publicDisplayName || 'Player';
  }, [displayName, nextSanitizedProfileName, publicDisplayName]);

  const identityPreviewUsername = useMemo<string | null>(() => {
    return nextSanitizedUsername ? `@${nextSanitizedUsername}` : null;
  }, [nextSanitizedUsername]);

  const isEmailUser = useMemo<boolean>(() => {
    if (!user) {
      return false;
    }

    const userWithIdentities = user as typeof user & { identities?: AuthIdentity[] };
    const metadata = user.user_metadata as { identities?: AuthIdentity[] } | undefined;
    const identities = userWithIdentities.identities ?? metadata?.identities ?? [];

    if (Array.isArray(identities) && identities.length > 0) {
      return identities.some((identity) => identity.provider === 'email');
    }

    const providers = user.app_metadata?.providers;
    if (Array.isArray(providers) && providers.includes('email')) {
      return true;
    }

    return user.email != null && user.app_metadata?.provider === 'email';
  }, [user]);

  const backgroundGradient = useMemo<readonly [string, string, string]>(() => (
    isDark
      ? ['#06101d', '#0f1d3a', '#08111f']
      : ['#F4F7FF', '#EEF2FF', '#F9FAFB']
  ), [isDark]);
  const surfaceBackground = isDark ? 'rgba(15, 23, 42, 0.82)' : 'rgba(255, 255, 255, 0.92)';
  const surfaceBorder = isDark ? 'rgba(148, 163, 184, 0.18)' : 'rgba(148, 163, 184, 0.16)';
  const inputBackground = isDark ? 'rgba(2, 6, 23, 0.52)' : 'rgba(248, 250, 252, 0.94)';
  const inputBorder = isDark ? 'rgba(148, 163, 184, 0.18)' : 'rgba(148, 163, 184, 0.2)';
  const mutedText = isDark ? '#94A3B8' : '#64748B';

  const handleProfileNameChange = useCallback((value: string) => {
    setProfileName(value);
    if (profileNameError) {
      setProfileNameError(null);
    }
  }, [profileNameError]);

  const handleUsernameChange = useCallback((value: string) => {
    const cleaned = normalizeUsernameInput(value);
    setUsernameInput(cleaned);
    setUsernameError(null);
    setUsernameHelper(null);
    setIsUsernameAvailable(null);
    setIsCheckingUsername(false);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (!cleaned) {
      return;
    }

    const validationError = validateUsername(cleaned);
    if (validationError) {
      setUsernameError(validationError);
      return;
    }

    setIsCheckingUsername(true);
    const nextRequestId = requestIdRef.current + 1;
    requestIdRef.current = nextRequestId;

    debounceRef.current = setTimeout(() => {
      void getUsernameAvailability(cleaned, {
        excludeUserId: user?.id ?? null,
      })
        .then((availabilityResult) => {
          if (requestIdRef.current !== nextRequestId) {
            return;
          }

          setIsCheckingUsername(false);

          if (availabilityResult.status === 'available') {
            setIsUsernameAvailable(true);
            setUsernameHelper(cleaned === currentSanitizedUsername ? 'This is your current username.' : 'Username is available.');
            return;
          }

          if (availabilityResult.status === 'taken') {
            setIsUsernameAvailable(false);
            setUsernameError('This username is already taken.');
            return;
          }

          setIsUsernameAvailable(null);
          setUsernameHelper(availabilityResult.error ?? USERNAME_AVAILABILITY_FALLBACK_MESSAGE);
        })
        .catch((error: unknown) => {
          if (requestIdRef.current !== nextRequestId) {
            return;
          }

          logger.warn('[Account] Username availability check failed:', error);
          setIsCheckingUsername(false);
          setIsUsernameAvailable(null);
          setUsernameHelper(USERNAME_AVAILABILITY_FALLBACK_MESSAGE);
        });
    }, 450);
  }, [currentSanitizedUsername, user?.id]);

  const saveMutation = useMutation({
    mutationFn: async (): Promise<void> => {
      if (!user?.id) {
        throw new Error('You need to be signed in to update your account.');
      }

      const nameResult = await updateDisplayName(nextSanitizedProfileName);
      if (nameResult.error) {
        throw new Error(nameResult.error);
      }

      const usernameResult = await claimUsername(user.id, nextSanitizedUsername, {
        excludeUserId: user.id,
        currentUsername: username,
        displayName: nextSanitizedProfileName,
        allowCurrentUsername: true,
      });

      if (!usernameResult.success) {
        throw new Error(usernameResult.error ?? 'Could not save username.');
      }

      await refreshUsername();

      const publisherName = nextSanitizedUsername || nextSanitizedProfileName || user.email?.split('@')[0] || 'Anonymous';
      void supabase
        .from('public_decks')
        .update({ publisher_name: publisherName, updated_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .then(({ error }) => {
          if (error) {
            logger.warn('[Account] Failed to update publisher names:', error.message);
          }
        });
    },
    onSuccess: () => {
      Alert.alert('Saved', 'Your profile name and username are updated.');
    },
    onError: (error: unknown) => {
      const errorMessage = error instanceof Error ? error.message : 'Could not save your account changes.';
      logger.warn('[Account] Failed to save account changes:', error);
      Alert.alert('Save Failed', errorMessage);
    },
  });

  const handleSave = useCallback(() => {
    const nextProfileNameError = validateProfileName(profileName);
    const nextUsernameError = validateUsername(usernameInput);

    setProfileNameError(nextProfileNameError);
    setUsernameError(nextUsernameError);

    if (nextProfileNameError || nextUsernameError || !isDirty) {
      return;
    }

    saveMutation.mutate();
  }, [isDirty, profileName, saveMutation, usernameInput]);

  const handleSignOut = useCallback(() => {
    Alert.alert(
      'Sign Out',
      'Your local study data stays on this device, but cloud sync will stop until you sign back in.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            await signOut();
            router.replace('/');
          },
        },
      ],
    );
  }, [router, signOut]);

  const handleDeleteAccount = useCallback(() => {
    Alert.alert(
      'Delete Account',
      'This will permanently delete your account and remove all associated data:\n\n' +
      '\u2022 Your profile and username\n' +
      '\u2022 All cloud-synced study data\n' +
      '\u2022 Published decks and votes\n' +
      '\u2022 Leaderboard entries\n\n' +
      'Your local data on this device will also be cleared. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete My Account',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Are you sure?',
              'This is permanent and cannot be reversed.',
              [
                { text: 'Go Back', style: 'cancel' },
                {
                  text: 'Yes, Delete Everything',
                  style: 'destructive',
                  onPress: async () => {
                    try {
                      const { error } = await supabase.rpc('delete_own_account');

                      if (error) {
                        logger.warn('[Account] Delete failed:', error.message);
                        Alert.alert('Deletion Failed', 'Could not delete your account. Please try again later.');
                        return;
                      }

                      await AsyncStorage.clear();
                      await signOut();
                      router.replace('/');
                    } catch (err) {
                      logger.warn('[Account] Delete error:', err);
                      Alert.alert('Deletion Failed', 'Something went wrong. Please try again later.');
                    }
                  },
                },
              ],
            );
          },
        },
      ],
    );
  }, [router, signOut]);

  const handleChangePassword = useCallback(async () => {
    logger.log('[Account] Starting password change');
    setPasswordChangeError('');
    setPasswordChangeSuccess(false);

    if (!currentPassword.trim()) {
      setPasswordChangeError('Enter your current password.');
      return;
    }

    const issues = PASSWORD_RULES.filter((rule) => !rule.test(newPassword)).map((rule) => rule.label);
    setNewPasswordIssues(issues);

    if (issues.length > 0) {
      setPasswordChangeError('New password does not meet requirements.');
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setPasswordChangeError('New passwords do not match.');
      return;
    }

    if (currentPassword === newPassword) {
      setPasswordChangeError('New password must be different from current password.');
      return;
    }

    setIsChangingPassword(true);

    try {
      const passwordPayload = {
        password: newPassword,
        current_password: currentPassword,
      } as Parameters<typeof supabase.auth.updateUser>[0];
      const { error } = await supabase.auth.updateUser(passwordPayload);

      if (error) {
        logger.warn('[Account] Password change failed:', error.message);

        if (error.message.toLowerCase().includes('nonce')) {
          setPasswordChangeError('Please sign in again before changing your password.');
        } else if (
          error.message.toLowerCase().includes('current password') ||
          error.message.toLowerCase().includes('invalid login credentials') ||
          error.message.toLowerCase().includes('password')
        ) {
          setPasswordChangeError('Current password is incorrect.');
        } else {
          setPasswordChangeError(error.message);
        }

        setIsChangingPassword(false);
        return;
      }

      logger.log('[Account] Password updated successfully');
      setPasswordChangeSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      setNewPasswordIssues([]);

      if (passwordSuccessTimeoutRef.current) {
        clearTimeout(passwordSuccessTimeoutRef.current);
      }

      passwordSuccessTimeoutRef.current = setTimeout(() => {
        setShowChangePassword(false);
        setPasswordChangeSuccess(false);
        passwordSuccessTimeoutRef.current = null;
      }, 2000);
    } catch (err) {
      logger.warn('[Account] Password change unexpected error:', err);
      setPasswordChangeError('Something went wrong. Please try again.');
    }

    setIsChangingPassword(false);
  }, [confirmNewPassword, currentPassword, newPassword]);

  if (isLoading || !isSignedIn || !user) {
    return (
      <View style={styles.loadingRoot}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={backgroundGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.header}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={[styles.headerButton, { backgroundColor: surfaceBackground, borderColor: surfaceBorder }]}
              activeOpacity={0.84}
              testID="account-back-button"
            >
              <ArrowLeft color={theme.text} size={20} strokeWidth={2.4} />
            </TouchableOpacity>
            <Text style={[styles.headerTitle, { color: theme.text }]}>Profile & Account</Text>
            <View style={styles.headerSpacer} />
          </View>

          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            testID="account-screen"
          >
            <ResponsiveContainer maxWidth={560}>
              <View style={[styles.heroCard, { backgroundColor: surfaceBackground, borderColor: surfaceBorder }]}> 
                <View style={[styles.heroIcon, { backgroundColor: isDark ? 'rgba(129,140,248,0.16)' : 'rgba(99,102,241,0.1)' }]}>
                  <UserRound color={theme.primary} size={26} strokeWidth={2.4} />
                </View>
                {identityPreviewUsername ? (
                  <Text style={[styles.heroEyebrow, { color: theme.primary }]} numberOfLines={1}>{identityPreviewUsername}</Text>
                ) : null}
                <Text style={[styles.heroTitle, { color: theme.text }]} numberOfLines={1}>{identityPreviewName}</Text>
                <Text style={[styles.heroSubtitle, { color: mutedText }]}>Use a friendly profile name and a unique username. Profile name is personal. Username is your public handle.</Text>
              </View>

              <View style={[styles.sectionCard, { backgroundColor: surfaceBackground, borderColor: surfaceBorder }]}> 
                <Text style={[styles.sectionTitle, { color: theme.text }]}>Identity</Text>

                <Text style={[styles.fieldLabel, { color: mutedText }]}>Profile name</Text>
                <View style={[styles.inputWrap, { backgroundColor: inputBackground, borderColor: profileNameError ? theme.error : inputBorder }]}> 
                  <TextInput
                    style={[styles.input, { color: theme.text }]}
                    value={profileName}
                    onChangeText={handleProfileNameChange}
                    placeholder="Your name"
                    placeholderTextColor={mutedText}
                    autoCapitalize="words"
                    autoCorrect={false}
                    maxLength={PROFILE_NAME_MAX_LENGTH}
                    testID="account-profile-name-input"
                  />
                </View>
                <Text style={[styles.fieldHelper, { color: profileNameError ? theme.error : mutedText }]}>
                  {profileNameError ?? 'Shown on your profile. You can change it anytime.'}
                </Text>

                <Text style={[styles.fieldLabel, { color: mutedText }]}>Username</Text>
                <View style={[styles.inputWrap, { backgroundColor: inputBackground, borderColor: usernameError ? theme.error : inputBorder }]}> 
                  <Text style={[styles.usernamePrefix, { color: mutedText }]}>@</Text>
                  <TextInput
                    style={[styles.input, { color: theme.text }]}
                    value={usernameInput}
                    onChangeText={handleUsernameChange}
                    placeholder="username"
                    placeholderTextColor={mutedText}
                    autoCapitalize="none"
                    autoCorrect={false}
                    maxLength={USERNAME_MAX_LENGTH}
                    testID="account-username-input"
                  />
                  {isCheckingUsername ? (
                    <ActivityIndicator size="small" color={theme.primary} />
                  ) : null}
                </View>
                <Text style={[styles.fieldHelper, { color: usernameError ? theme.error : isUsernameAvailable ? theme.success : mutedText }]}> 
                  {usernameError ?? usernameHelper ?? 'Unique public handle for leaderboard, arena, and published decks.'}
                </Text>

                <TouchableOpacity
                  style={[
                    styles.saveButton,
                    {
                      backgroundColor: isDirty && !saveMutation.isPending ? theme.primary : theme.border,
                    },
                  ]}
                  onPress={handleSave}
                  disabled={!isDirty || saveMutation.isPending}
                  activeOpacity={0.88}
                  testID="account-save-button"
                >
                  {saveMutation.isPending ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.saveButtonText}>Save changes</Text>
                  )}
                </TouchableOpacity>
              </View>

              {isEmailUser ? (
                <View style={[styles.sectionCard, { backgroundColor: surfaceBackground, borderColor: surfaceBorder }]}> 
                  <Text style={[styles.sectionTitle, { color: theme.text }]}>Password</Text>

                  {!showChangePassword ? (
                    <TouchableOpacity
                      style={styles.actionRow}
                      onPress={() => {
                        if (passwordSuccessTimeoutRef.current) {
                          clearTimeout(passwordSuccessTimeoutRef.current);
                          passwordSuccessTimeoutRef.current = null;
                        }

                        setShowChangePassword(true);
                        setPasswordChangeError('');
                        setPasswordChangeSuccess(false);
                      }}
                      activeOpacity={0.84}
                      testID="account-change-password-button"
                    >
                      <View style={[styles.actionIcon, { backgroundColor: isDark ? 'rgba(99,102,241,0.16)' : 'rgba(99,102,241,0.08)' }]}> 
                        <Key color={theme.primary} size={18} strokeWidth={2.4} />
                      </View>
                      <View style={styles.actionTextWrap}>
                        <Text style={[styles.actionTitle, { color: theme.text }]}>Change password</Text>
                        <Text style={[styles.actionSubtitle, { color: mutedText }]}>Update your account password.</Text>
                      </View>
                    </TouchableOpacity>
                  ) : (
                    <View style={styles.passwordForm}>
                      <TextInput
                        style={[styles.input, styles.standaloneInput, { color: theme.text, backgroundColor: inputBackground, borderColor: inputBorder }]}
                        placeholder="Current password"
                        placeholderTextColor={mutedText}
                        value={currentPassword}
                        onChangeText={(value) => {
                          setCurrentPassword(value);
                          setPasswordChangeError('');
                          setPasswordChangeSuccess(false);
                        }}
                        secureTextEntry
                        autoCapitalize="none"
                        autoComplete="current-password"
                        testID="account-current-password-input"
                      />

                      <TextInput
                        style={[styles.input, styles.standaloneInput, { color: theme.text, backgroundColor: inputBackground, borderColor: inputBorder }]}
                        placeholder="New password"
                        placeholderTextColor={mutedText}
                        value={newPassword}
                        onChangeText={(value) => {
                          setNewPassword(value);
                          setPasswordChangeError('');
                          setPasswordChangeSuccess(false);
                          setNewPasswordIssues(PASSWORD_RULES.filter((rule) => !rule.test(value)).map((rule) => rule.label));
                        }}
                        secureTextEntry
                        autoCapitalize="none"
                        autoComplete="new-password"
                        testID="account-new-password-input"
                      />

                      {newPassword.length > 0 ? (
                        <View style={styles.passwordRequirements}>
                          {PASSWORD_RULES.map((rule) => {
                            const met = rule.test(newPassword);

                            return (
                              <View key={rule.label} style={styles.passwordRequirementRow}>
                                <Text style={[styles.passwordRequirementIndicator, { color: met ? '#10B981' : '#94A3B8' }]}>
                                  {met ? '\u2713' : '\u2022'}
                                </Text>
                                <Text style={[styles.passwordRequirementText, { color: met ? '#10B981' : '#94A3B8' }]}>
                                  {rule.label}
                                </Text>
                              </View>
                            );
                          })}
                        </View>
                      ) : null}

                      <TextInput
                        style={[styles.input, styles.standaloneInput, { color: theme.text, backgroundColor: inputBackground, borderColor: inputBorder }]}
                        placeholder="Confirm new password"
                        placeholderTextColor={mutedText}
                        value={confirmNewPassword}
                        onChangeText={(value) => {
                          setConfirmNewPassword(value);
                          setPasswordChangeError('');
                          setPasswordChangeSuccess(false);
                        }}
                        secureTextEntry
                        autoCapitalize="none"
                        autoComplete="new-password"
                        testID="account-confirm-new-password-input"
                      />

                      {passwordChangeError ? (
                        <Text style={styles.passwordErrorText}>{passwordChangeError}</Text>
                      ) : null}

                      {passwordChangeSuccess ? (
                        <Text style={styles.passwordSuccessText}>Password updated!</Text>
                      ) : null}

                      <View style={styles.passwordActionRow}>
                        <TouchableOpacity
                          style={[
                            styles.saveButton,
                            styles.passwordActionButton,
                            {
                              backgroundColor: newPasswordIssues.length === 0 && newPassword.length > 0 && !isChangingPassword ? theme.primary : theme.border,
                            },
                          ]}
                          onPress={handleChangePassword}
                          disabled={isChangingPassword || newPasswordIssues.length > 0 || newPassword.length === 0}
                          activeOpacity={0.88}
                          testID="account-save-password-button"
                        >
                          {isChangingPassword ? (
                            <ActivityIndicator size="small" color="#FFFFFF" />
                          ) : (
                            <Text style={styles.saveButtonText}>Update Password</Text>
                          )}
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[styles.saveButton, styles.passwordCancelButton, { backgroundColor: theme.border }]}
                          onPress={() => {
                            if (passwordSuccessTimeoutRef.current) {
                              clearTimeout(passwordSuccessTimeoutRef.current);
                              passwordSuccessTimeoutRef.current = null;
                            }

                            setShowChangePassword(false);
                            setCurrentPassword('');
                            setNewPassword('');
                            setConfirmNewPassword('');
                            setPasswordChangeError('');
                            setPasswordChangeSuccess(false);
                            setNewPasswordIssues([]);
                          }}
                          activeOpacity={0.88}
                          testID="account-cancel-password-button"
                        >
                          <Text style={[styles.saveButtonText, { color: theme.text }]}>Cancel</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </View>
              ) : null}

              <View style={[styles.sectionCard, { backgroundColor: surfaceBackground, borderColor: surfaceBorder }]}> 
                <Text style={[styles.sectionTitle, { color: theme.text }]}>Account actions</Text>

                <TouchableOpacity
                  style={styles.actionRow}
                  onPress={handleSignOut}
                  activeOpacity={0.84}
                  testID="account-signout-button"
                >
                  <View style={[styles.actionIcon, { backgroundColor: isDark ? 'rgba(248,113,113,0.16)' : 'rgba(239,68,68,0.08)' }]}> 
                    <LogOut color={theme.error} size={18} strokeWidth={2.4} />
                  </View>
                  <View style={styles.actionTextWrap}>
                    <Text style={[styles.actionTitle, { color: theme.text }]}>Log out</Text>
                    <Text style={[styles.actionSubtitle, { color: mutedText }]}>Stop syncing this device until you sign in again.</Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.actionRow}
                  onPress={handleDeleteAccount}
                  activeOpacity={0.84}
                  testID="account-delete-account-button"
                >
                  <View style={[styles.actionIcon, { backgroundColor: isDark ? 'rgba(251,191,36,0.16)' : 'rgba(245,158,11,0.1)' }]}> 
                    <ShieldAlert color={theme.warning} size={18} strokeWidth={2.4} />
                  </View>
                  <View style={styles.actionTextWrap}>
                    <Text style={[styles.actionTitle, { color: theme.text }]}>Delete account</Text>
                    <Text style={[styles.actionSubtitle, { color: mutedText }]}>Permanently delete your account and all associated data.</Text>
                  </View>
                </TouchableOpacity>
              </View>

              <View style={[styles.rulesCard, { backgroundColor: surfaceBackground, borderColor: surfaceBorder }]}> 
                <View style={styles.ruleRow}>
                  <AtSign color={theme.primary} size={16} strokeWidth={2.4} />
                  <Text style={[styles.ruleText, { color: mutedText }]}>Keep both: profile name for personality, username for unique identity across social and competitive surfaces.</Text>
                </View>
                <View style={styles.ruleRow}>
                  <AtSign color={theme.primary} size={16} strokeWidth={2.4} />
                  <Text style={[styles.ruleText, { color: mutedText }]}>Usernames use 3-20 characters with letters, numbers, and underscores only.</Text>
                </View>
                <View style={styles.ruleRow}>
                  <AtSign color={theme.primary} size={16} strokeWidth={2.4} />
                  <Text style={[styles.ruleText, { color: mutedText }]}>Profile names can be changed anytime and are better for the main profile header.</Text>
                </View>
              </View>
            </ResponsiveContainer>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  loadingRoot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  safeArea: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 12,
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '800' as const,
    letterSpacing: -0.2,
  },
  headerSpacer: {
    width: 44,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    gap: 16,
  },
  heroCard: {
    borderRadius: 28,
    borderWidth: 1,
    paddingHorizontal: 22,
    paddingVertical: 24,
    alignItems: 'center',
  },
  heroIcon: {
    width: 64,
    height: 64,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  heroEyebrow: {
    fontSize: 13,
    fontWeight: '700' as const,
    marginBottom: 6,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '800' as const,
    letterSpacing: -0.6,
  },
  heroSubtitle: {
    marginTop: 10,
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500' as const,
  },
  sectionCard: {
    borderRadius: 24,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 18,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '800' as const,
    marginBottom: 14,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700' as const,
    marginBottom: 8,
  },
  inputWrap: {
    minHeight: 54,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  usernamePrefix: {
    fontSize: 18,
    fontWeight: '700' as const,
    marginRight: 4,
  },
  input: {
    flex: 1,
    minHeight: 52,
    fontSize: 16,
    fontWeight: '600' as const,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
  },
  standaloneInput: {
    flex: 0,
    width: '100%',
  },
  fieldHelper: {
    fontSize: 12,
    lineHeight: 18,
    marginTop: 8,
    marginBottom: 14,
    fontWeight: '500' as const,
  },
  passwordForm: {
    gap: 12,
  },
  passwordRequirements: {
    gap: 3,
    paddingHorizontal: 4,
  },
  passwordRequirementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  passwordRequirementIndicator: {
    fontSize: 12,
    fontWeight: '700' as const,
  },
  passwordRequirementText: {
    fontSize: 12,
    fontWeight: '600' as const,
  },
  passwordErrorText: {
    color: '#EF4444',
    fontSize: 13,
    fontWeight: '600' as const,
    paddingHorizontal: 4,
  },
  passwordSuccessText: {
    color: '#10B981',
    fontSize: 13,
    fontWeight: '700' as const,
    paddingHorizontal: 4,
  },
  passwordActionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  passwordActionButton: {
    flex: 1,
  },
  passwordCancelButton: {
    paddingHorizontal: 20,
  },
  saveButton: {
    minHeight: 54,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800' as const,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  actionTextWrap: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 15,
    fontWeight: '700' as const,
  },
  actionSubtitle: {
    marginTop: 3,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '500' as const,
  },
  rulesCard: {
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
  },
  ruleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  ruleText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '500' as const,
  },
});
