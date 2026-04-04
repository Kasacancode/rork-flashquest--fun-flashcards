import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { LinearGradient } from 'expo-linear-gradient';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Bell,
  BellOff,
  BookOpen,
  ChevronRight,
  Download,
  HelpCircle,
  Info,
  LogIn,
  LogOut,
  ShieldCheck,
  SmartphoneNfc,
  Target,
  Trash2,
  Upload,
  User,
  Vibrate,
  Volume2,
  VolumeX,
  Cloud,
} from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import ResponsiveContainer from '@/components/ResponsiveContainer';
import { useAuth } from '@/context/AuthContext';
import { useFlashQuest } from '@/context/FlashQuestContext';
import { usePrivacy } from '@/context/PrivacyContext';
import { useTheme } from '@/context/ThemeContext';
import { getDailyGoalTarget, setDailyGoalTarget, DAILY_GOAL_OPTIONS } from '@/utils/dailyGoal';
import { setHapticsEnabled as syncHapticsPreference } from '@/utils/haptics';
import { logger } from '@/utils/logger';
import { exportBackup, importBackup } from '@/utils/dataBackup';
import { clearScheduledStreakReminders, NOTIFICATIONS_ENABLED_KEY } from '@/utils/notifications';
import { ACCOUNT_ROUTE, DATA_PRIVACY_ROUTE, FAQ_ROUTE } from '@/utils/routes';
import { getSoundsEnabled, setSoundsEnabled as syncSoundsEnabled, SOUNDS_ENABLED_KEY } from '@/utils/sounds';
import { getUserInterests } from '@/utils/userInterests';

const HAPTICS_KEY = 'flashquest_haptics_enabled';

type NotificationPermission = 'granted' | 'denied' | 'undetermined' | null;

interface SettingsRowProps {
  icon: ReactNode;
  label: string;
  labelColor?: string;
  subtitle?: string;
  right?: ReactNode;
  onPress?: () => void;
  testID?: string;
  theme: {
    text: string;
    textSecondary: string;
  };
}

function Divider({ color }: { color: string }) {
  return <View style={[styles.divider, { backgroundColor: color }]} />;
}

function SettingsRow({
  icon,
  label,
  labelColor,
  subtitle,
  right,
  onPress,
  testID,
  theme,
}: SettingsRowProps) {
  const content = (
    <View style={styles.row}>
      <View style={styles.rowIcon}>{icon}</View>
      <View style={styles.rowText}>
        <Text style={[styles.rowLabel, { color: labelColor ?? theme.text }]}>{label}</Text>
        {subtitle ? (
          <Text style={[styles.rowSubtitle, { color: theme.textSecondary }]} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right ? <View style={styles.rowRight}>{right}</View> : null}
    </View>
  );

  const accessibilityLabel = subtitle ? `${label}. ${subtitle}` : label;

  if (onPress) {
    return (
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.7}
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
      >
        {content}
      </TouchableOpacity>
    );
  }

  return (
    <View testID={testID} accessible={true} accessibilityRole="text" accessibilityLabel={accessibilityLabel}>
      {content}
    </View>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { theme, isDark } = useTheme();
  const { analyticsEnabled, setAnalyticsConsent } = usePrivacy();
  const { isSignedIn, displayName, username, user, signOut } = useAuth();
  const { decks, stats } = useFlashQuest();
  const [hapticsEnabled, setHapticsEnabled] = useState<boolean>(true);
  const [notificationsEnabled, setNotificationsEnabled] = useState<boolean>(true);
  const [soundEnabled, setSoundEnabledState] = useState<boolean>(getSoundsEnabled());
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(null);
  const [userInterests, setUserInterestsState] = useState<string[]>([]);
  const [dailyGoal, setDailyGoal] = useState<number>(15);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [isImporting, setIsImporting] = useState<boolean>(false);

  useEffect(() => {
    getUserInterests().then(setUserInterestsState).catch(() => {});
    getDailyGoalTarget().then(setDailyGoal).catch(() => {});
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadSettings = async () => {
      try {
        const [storedHaptics, storedNotifications, storedSounds] = await Promise.all([
          AsyncStorage.getItem(HAPTICS_KEY),
          AsyncStorage.getItem(NOTIFICATIONS_ENABLED_KEY),
          AsyncStorage.getItem(SOUNDS_ENABLED_KEY),
        ]);

        if (!isMounted) {
          return;
        }

        if (storedHaptics !== null) {
          setHapticsEnabled(storedHaptics !== 'false');
        }

        if (storedNotifications !== null) {
          setNotificationsEnabled(storedNotifications !== 'false');
        }

        const nextSoundEnabled = storedSounds !== 'false';
        setSoundEnabledState(nextSoundEnabled);
        syncSoundsEnabled(nextSoundEnabled);
      } catch (error) {
        logger.warn('[Settings] Failed to load stored settings:', error);
      }

      if (Platform.OS !== 'web') {
        try {
          const permissions = await Notifications.getPermissionsAsync();
          if (isMounted) {
            setNotificationPermission(permissions.status);
          }
        } catch (error) {
          logger.warn('[Settings] Failed to check notification permission:', error);
          if (isMounted) {
            setNotificationPermission('undetermined');
          }
        }
      }
    };

    void loadSettings();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleToggleHaptics = useCallback((value: boolean) => {
    syncHapticsPreference(value);
    setHapticsEnabled(value);
    void AsyncStorage.setItem(HAPTICS_KEY, String(value));
  }, []);

  const handleToggleNotifications = useCallback((value: boolean) => {
    setNotificationsEnabled(value);
    void AsyncStorage.setItem(NOTIFICATIONS_ENABLED_KEY, String(value));

    if (!value) {
      void clearScheduledStreakReminders();
    }
  }, []);

  const handleToggleSounds = useCallback((value: boolean) => {
    setSoundEnabledState(value);
    syncSoundsEnabled(value);
    void AsyncStorage.setItem(SOUNDS_ENABLED_KEY, String(value));
  }, []);

  const handleToggleAnalytics = useCallback((value: boolean) => {
    setAnalyticsConsent(value ? 'granted' : 'declined');
  }, [setAnalyticsConsent]);

  const handleSignOut = useCallback(() => {
    Alert.alert(
      'Sign Out',
      'Your data will stay on this device but will no longer sync to the cloud.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            await signOut();
          },
        },
      ],
    );
  }, [signOut]);

  const appVersion = Constants.expoConfig?.version ?? '1.0.0';
  const accountSubtitle = username
    ? `${`@${username}`}${user?.email ? ` • ${user.email}` : ''}`
    : user?.email ?? 'Signed in';

  const handleChangeDailyGoal = useCallback(() => {
    Alert.alert(
      'Daily Study Goal',
      'How many cards do you want to study each day?',
      DAILY_GOAL_OPTIONS.map((option) => ({
        text: `${option} cards${option === dailyGoal ? ' (current)' : ''}`,
        onPress: () => {
          setDailyGoal(option);
          void setDailyGoalTarget(option);
        },
      })),
    );
  }, [dailyGoal]);

  const handleExportData = useCallback(async () => {
    if (isExporting) {
      return;
    }

    setIsExporting(true);

    try {
      const result = await exportBackup(appVersion);
      if (!result.success && result.error) {
        Alert.alert('Export Failed', result.error);
      }
    } catch (error) {
      logger.error('[Settings] Export failed unexpectedly:', error);
      Alert.alert('Export Failed', 'Could not create the backup file. Please try again.');
    } finally {
      setIsExporting(false);
    }
  }, [appVersion, isExporting]);

  const handleImportData = useCallback(() => {
    Alert.alert(
      'Restore from Backup',
      'This will replace ALL your current data (decks, stats, and progress) with the data from the backup file. This cannot be undone.\n\nAre you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Choose Backup File',
          onPress: async () => {
            if (isImporting) {
              return;
            }

            setIsImporting(true);

            try {
              const result = await importBackup();

              if (result.success) {
                await Promise.all([
                  queryClient.invalidateQueries({ queryKey: ['decks'] }),
                  queryClient.invalidateQueries({ queryKey: ['progress'] }),
                  queryClient.invalidateQueries({ queryKey: ['stats'] }),
                  queryClient.invalidateQueries({ queryKey: ['deck-categories'] }),
                  queryClient.invalidateQueries({ queryKey: ['hidden-deck-ids'] }),
                  queryClient.invalidateQueries({ queryKey: ['performance'] }),
                  queryClient.invalidateQueries({ queryKey: ['avatar-identity'] }),
                  queryClient.invalidateQueries({ queryKey: ['arena-player-name'] }),
                ]);

                Alert.alert(
                  'Restore Complete',
                  `Successfully restored ${result.keysRestored} data entries from backup.\n\nThe app will now reload.`,
                  [
                    {
                      text: 'OK',
                      onPress: () => router.replace('/'),
                    },
                  ],
                );
              } else if (result.error && result.error !== 'No file selected.') {
                Alert.alert('Restore Failed', result.error);
              }
            } catch (error) {
              logger.error('[Settings] Import failed unexpectedly:', error);
              Alert.alert('Restore Failed', 'Could not read the backup file. Please try again.');
            } finally {
              setIsImporting(false);
            }
          },
        },
      ],
    );
  }, [isImporting, queryClient, router]);

  const handleClearAllData = useCallback(() => {
    Alert.alert(
      'Clear All Data',
      'This will permanently delete your decks, progress, stats, and local settings. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Everything',
          style: 'destructive',
          onPress: async () => {
            try {
              await AsyncStorage.clear();
              queryClient.clear();
              router.replace('/onboarding');
            } catch (error) {
              logger.error('[Settings] Failed to clear all data:', error);
              Alert.alert('Clear Failed', 'FlashQuest could not clear local data. Please try again.');
            }
          },
        },
      ],
    );
  }, [queryClient, router]);

  const customDeckCount = useMemo<number>(() => decks.filter((deck) => deck.isCustom).length, [decks]);
  const totalCards = useMemo<number>(() => decks.reduce((sum, deck) => sum + deck.flashcards.length, 0), [decks]);
  const backgroundGradient: [string, string, string] = isDark
    ? ['#08111f', '#0c1730', '#09111d']
    : ['#E0E7FF', '#EDE9FE', '#E0E7FF'];
  const surfaceBg = isDark ? 'rgba(30, 41, 59, 0.72)' : 'rgba(255, 255, 255, 0.88)';
  const sectionLabelColor = isDark ? theme.textTertiary : theme.textSecondary;
  const notificationSubtitle = notificationPermission === 'denied'
    ? 'Blocked in system settings'
    : notificationsEnabled
      ? 'Daily streak reminders are enabled'
      : 'Disabled';

  return (
    <LinearGradient colors={backgroundGradient} style={styles.root}>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
            testID="settings-back-button"
            accessibilityLabel="Go back"
            accessibilityRole="button"
          >
            <ArrowLeft color={theme.text} size={22} strokeWidth={2.2} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.text }]} accessibilityRole="header">Settings</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} testID="settings-screen">
          <ResponsiveContainer>
            <Text style={[styles.sectionLabel, { color: sectionLabelColor }]} accessibilityRole="header">Account</Text>
            <View style={[styles.card, { backgroundColor: surfaceBg }]}> 
              {isSignedIn ? (
                <>
                  <SettingsRow
                    icon={<User color={theme.primary} size={20} strokeWidth={2.2} />}
                    label={displayName || username || 'Account'}
                    subtitle={accountSubtitle}
                    onPress={() => router.push(ACCOUNT_ROUTE)}
                    right={<ChevronRight color={theme.textTertiary} size={18} />}
                    theme={theme}
                    testID="settings-account-row"
                  />
                  <Divider color={theme.border} />
                  <SettingsRow
                    icon={<Cloud color="#10B981" size={20} strokeWidth={2.2} />}
                    label="Cloud sync"
                    subtitle="Your data syncs automatically"
                    theme={theme}
                    testID="settings-sync-row"
                  />
                  <Divider color={theme.border} />
                  <SettingsRow
                    icon={<LogOut color={theme.error} size={20} strokeWidth={2.2} />}
                    label="Sign out"
                    labelColor={theme.error}
                    onPress={handleSignOut}
                    right={<ChevronRight color={theme.error} size={18} />}
                    theme={theme}
                    testID="settings-signout-row"
                  />
                </>
              ) : (
                <SettingsRow
                  icon={<LogIn color={theme.primary} size={20} strokeWidth={2.2} />}
                  label="Sign in"
                  subtitle="Sync your data across devices"
                  onPress={() => router.push('/auth')}
                  right={<ChevronRight color={theme.textTertiary} size={18} />}
                  theme={theme}
                  testID="settings-signin-row"
                />
              )}
            </View>

            <Text style={[styles.sectionLabel, { color: sectionLabelColor }]} accessibilityRole="header">Study Goals</Text>
          <View style={[styles.card, { backgroundColor: surfaceBg }]}> 
            <SettingsRow
              icon={<Target color={theme.textSecondary} size={20} strokeWidth={2.2} />}
              label="Daily study goal"
              subtitle={`${dailyGoal} cards per day`}
              right={<ChevronRight color={theme.textTertiary} size={18} />}
              onPress={handleChangeDailyGoal}
              theme={theme}
              testID="settings-daily-goal-row"
            />
          </View>

          <Text style={[styles.sectionLabel, { color: sectionLabelColor }]} accessibilityRole="header">Feedback</Text>
          <View style={[styles.card, { backgroundColor: surfaceBg }]}> 
            <SettingsRow
              icon={notificationsEnabled ? <Bell color={theme.primary} size={20} /> : <BellOff color={theme.textTertiary} size={20} />}
              label="Streak Reminders"
              subtitle={notificationSubtitle}
              right={
                <Switch
                  value={notificationsEnabled && notificationPermission !== 'denied'}
                  onValueChange={handleToggleNotifications}
                  disabled={notificationPermission === 'denied'}
                  trackColor={{ false: theme.border, true: theme.primary }}
                  thumbColor="#fff"
                  accessibilityLabel="Notifications"
                  accessibilityRole="switch"
                  testID="settings-notifications-switch"
                />
              }
              testID="settings-notifications-row"
              theme={theme}
            />
            <Divider color={theme.border} />
            <SettingsRow
              icon={<Vibrate color={theme.primary} size={20} />}
              label="Haptic Feedback"
              subtitle={hapticsEnabled ? 'Tap feedback is enabled' : 'Disabled'}
              right={
                <Switch
                  value={hapticsEnabled}
                  onValueChange={handleToggleHaptics}
                  trackColor={{ false: theme.border, true: theme.primary }}
                  thumbColor="#fff"
                  accessibilityLabel="Haptic feedback"
                  accessibilityRole="switch"
                  testID="settings-haptics-switch"
                />
              }
              testID="settings-haptics-row"
              theme={theme}
            />
            <Divider color={theme.border} />
            <SettingsRow
              icon={soundEnabled ? <Volume2 color={theme.primary} size={20} strokeWidth={2.2} /> : <VolumeX color={theme.textTertiary} size={20} strokeWidth={2.2} />}
              label="Sound effects"
              subtitle={soundEnabled ? 'Sound effects are enabled' : 'Disabled'}
              right={
                <Switch
                  value={soundEnabled}
                  onValueChange={handleToggleSounds}
                  trackColor={{ false: theme.border, true: theme.primary }}
                  thumbColor="#fff"
                  accessibilityLabel="Sound effects"
                  accessibilityRole="switch"
                  testID="settings-sounds-switch"
                />
              }
              testID="settings-sounds-row"
              theme={theme}
            />
          </View>

          <Text style={[styles.sectionLabel, { color: sectionLabelColor }]} accessibilityRole="header">Privacy</Text>
          <View style={[styles.card, { backgroundColor: surfaceBg }]}> 
            <SettingsRow
              icon={<SmartphoneNfc color={theme.primary} size={20} />}
              label="Usage Analytics"
              subtitle={analyticsEnabled ? 'Anonymous usage analytics are enabled' : 'No analytics data is sent'}
              right={
                <Switch
                  value={analyticsEnabled}
                  onValueChange={handleToggleAnalytics}
                  trackColor={{ false: theme.border, true: theme.primary }}
                  thumbColor="#fff"
                  accessibilityLabel="Usage analytics"
                  accessibilityRole="switch"
                  testID="settings-analytics-switch"
                />
              }
              testID="settings-analytics-row"
              theme={theme}
            />
            <Divider color={theme.border} />
            <SettingsRow
              icon={<ShieldCheck color={theme.primary} size={20} />}
              label="Privacy & Data"
              subtitle="Manage consent and review data policies"
              onPress={() => router.push(DATA_PRIVACY_ROUTE)}
              right={<ChevronRight color={theme.textTertiary} size={18} />}
              testID="settings-privacy-link"
              theme={theme}
            />
            <Divider color={theme.border} />
            <SettingsRow
              icon={<BookOpen color={theme.textSecondary} size={20} strokeWidth={2.2} />}
              label="Your interests"
              subtitle={userInterests.length > 0 ? userInterests.join(', ') : 'None set'}
              right={<ChevronRight color={theme.textTertiary} size={18} />}
              onPress={() => {
                Alert.alert(
                  'Edit Interests',
                  'You can update your study interests during onboarding. This feature will be editable here in a future update.',
                );
              }}
              theme={theme}
              testID="settings-interests-row"
            />
          </View>

          <Text style={[styles.sectionLabel, { color: sectionLabelColor }]} accessibilityRole="header">Support</Text>
          <View style={[styles.card, { backgroundColor: surfaceBg }]}> 
            <SettingsRow
              icon={<HelpCircle color={theme.primary} size={20} />}
              label="FAQ"
              subtitle="Guides, answers, and support help"
              onPress={() => router.push(FAQ_ROUTE)}
              right={<ChevronRight color={theme.textTertiary} size={18} />}
              testID="settings-faq-link"
              theme={theme}
            />
          </View>

          <Text style={[styles.sectionLabel, { color: sectionLabelColor }]} accessibilityRole="header">Data</Text>
          <View style={[styles.card, { backgroundColor: surfaceBg }]}> 
            <View style={styles.dataRow}>
              <Text style={[styles.dataLabel, { color: theme.textSecondary }]}>Custom Decks</Text>
              <Text style={[styles.dataValue, { color: theme.text }]}>{customDeckCount}</Text>
            </View>
            <Divider color={theme.border} />
            <View style={styles.dataRow}>
              <Text style={[styles.dataLabel, { color: theme.textSecondary }]}>Total Flashcards</Text>
              <Text style={[styles.dataValue, { color: theme.text }]}>{totalCards}</Text>
            </View>
            <Divider color={theme.border} />
            <View style={styles.dataRow}>
              <Text style={[styles.dataLabel, { color: theme.textSecondary }]}>Study Sessions</Text>
              <Text style={[styles.dataValue, { color: theme.text }]}>{stats.totalStudySessions}</Text>
            </View>
            <Divider color={theme.border} />
            <View style={styles.dataRow}>
              <Text style={[styles.dataLabel, { color: theme.textSecondary }]}>Total Score</Text>
              <Text style={[styles.dataValue, { color: theme.text }]}>{stats.totalScore.toLocaleString()}</Text>
            </View>
          </View>

          <Text style={[styles.sectionLabel, { color: sectionLabelColor }]} accessibilityRole="header">Backup</Text>
          <View style={[styles.card, { backgroundColor: surfaceBg }]}> 
            <SettingsRow
              icon={<Download color={theme.primary} size={20} strokeWidth={2.2} />}
              label="Export My Data"
              subtitle={isExporting ? 'Creating backup...' : 'Save decks, stats, and progress as a file'}
              onPress={handleExportData}
              right={<ChevronRight color={theme.textTertiary} size={18} />}
              theme={theme}
              testID="settings-export-data"
            />
            <Divider color={theme.border} />
            <SettingsRow
              icon={<Upload color={theme.primary} size={20} strokeWidth={2.2} />}
              label="Restore from Backup"
              subtitle={isImporting ? 'Restoring...' : 'Load a previously exported backup file'}
              onPress={handleImportData}
              right={<ChevronRight color={theme.textTertiary} size={18} />}
              theme={theme}
              testID="settings-import-data"
            />
          </View>

          <Text style={[styles.sectionLabel, { color: theme.error }]} accessibilityRole="header">Danger Zone</Text>
          <View style={[styles.card, { backgroundColor: surfaceBg }]}> 
            <SettingsRow
              icon={<Trash2 color={theme.error} size={20} />}
              label="Clear All Data"
              labelColor={theme.error}
              subtitle="Delete all decks, progress, and local settings"
              onPress={handleClearAllData}
              right={<ChevronRight color={theme.error} size={18} />}
              testID="settings-clear-data-button"
              theme={theme}
            />
          </View>

          <View style={styles.aboutSection} accessible={true} accessibilityLabel={`FlashQuest version ${appVersion}`}>
            <Info color={theme.textTertiary} size={16} />
            <Text style={[styles.aboutText, { color: theme.textTertiary }]}>FlashQuest v{appVersion}</Text>
          </View>
          <Text style={[styles.aboutCredit, { color: theme.textTertiary }]}>Built by Caleb Mukasa</Text>
            <View style={styles.bottomSpacer} />
          </ResponsiveContainer>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '700' as const,
    letterSpacing: 0.2,
  },
  headerSpacer: { width: 40 },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 4,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 24,
    marginBottom: 8,
    marginLeft: 4,
  },
  card: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  rowIcon: {
    width: 32,
    alignItems: 'center',
  },
  rowText: {
    flex: 1,
    marginLeft: 12,
  },
  rowLabel: {
    fontSize: 15,
    fontWeight: '600' as const,
  },
  rowSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  rowRight: {
    marginLeft: 12,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 60,
  },
  dataRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  dataLabel: {
    fontSize: 14,
    fontWeight: '500' as const,
  },
  dataValue: {
    fontSize: 14,
    fontWeight: '700' as const,
  },
  aboutSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 32,
    gap: 6,
  },
  aboutText: {
    fontSize: 13,
    fontWeight: '500' as const,
  },
  aboutCredit: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
  },
  bottomSpacer: {
    height: 40,
  },
});
