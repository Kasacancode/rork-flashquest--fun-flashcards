import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { LinearGradient } from 'expo-linear-gradient';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import {
  ArrowLeft,
  Bell,
  BellOff,
  ChevronRight,
  HelpCircle,
  Info,
  Moon,
  ShieldCheck,
  SmartphoneNfc,
  Sun,
  Trash2,
  Vibrate,
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

import { useFlashQuest } from '@/context/FlashQuestContext';
import { usePrivacy } from '@/context/PrivacyContext';
import { useTheme } from '@/context/ThemeContext';
import { DATA_PRIVACY_ROUTE, FAQ_ROUTE } from '@/utils/routes';

const HAPTICS_KEY = 'flashquest_haptics_enabled';
const NOTIFICATIONS_KEY = 'flashquest_notifications_enabled';

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

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7} testID={testID}>
        {content}
      </TouchableOpacity>
    );
  }

  return <View testID={testID}>{content}</View>;
}

export default function SettingsScreen() {
  const router = useRouter();
  const { theme, isDark, toggleTheme } = useTheme();
  const { analyticsEnabled, setAnalyticsConsent } = usePrivacy();
  const { decks, stats } = useFlashQuest();
  const [hapticsEnabled, setHapticsEnabled] = useState<boolean>(true);
  const [notificationsEnabled, setNotificationsEnabled] = useState<boolean>(true);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(null);

  useEffect(() => {
    let isMounted = true;

    const loadSettings = async () => {
      try {
        const [storedHaptics, storedNotifications] = await Promise.all([
          AsyncStorage.getItem(HAPTICS_KEY),
          AsyncStorage.getItem(NOTIFICATIONS_KEY),
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
      } catch {
      }

      if (Platform.OS !== 'web') {
        try {
          const permissions = await Notifications.getPermissionsAsync();
          if (isMounted) {
            setNotificationPermission(permissions.status);
          }
        } catch {
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
    setHapticsEnabled(value);
    void AsyncStorage.setItem(HAPTICS_KEY, String(value));
  }, []);

  const handleToggleNotifications = useCallback((value: boolean) => {
    setNotificationsEnabled(value);
    void AsyncStorage.setItem(NOTIFICATIONS_KEY, String(value));
  }, []);

  const handleToggleAnalytics = useCallback((value: boolean) => {
    setAnalyticsConsent(value ? 'granted' : 'declined');
  }, [setAnalyticsConsent]);

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
              Alert.alert('All Data Cleared', 'FlashQuest cleared all local data. Restart the app to begin fresh.');
            } catch {
              Alert.alert('Clear Failed', 'FlashQuest could not clear local data. Please try again.');
            }
          },
        },
      ],
    );
  }, []);

  const customDeckCount = useMemo<number>(() => decks.filter((deck) => deck.isCustom).length, [decks]);
  const totalCards = useMemo<number>(() => decks.reduce((sum, deck) => sum + deck.flashcards.length, 0), [decks]);
  const backgroundGradient: [string, string, string] = isDark
    ? ['#08111f', '#0c1730', '#09111d']
    : ['#E0E7FF', '#EDE9FE', '#E0E7FF'];
  const surfaceBg = isDark ? 'rgba(30, 41, 59, 0.72)' : 'rgba(255, 255, 255, 0.88)';
  const sectionLabelColor = isDark ? theme.textTertiary : theme.textSecondary;
  const appVersion = Constants.expoConfig?.version ?? '1.0.0';
  const notificationSubtitle = notificationPermission === 'denied'
    ? 'Blocked in system settings'
    : notificationsEnabled
      ? 'Daily streak reminders are enabled'
      : 'Disabled';

  return (
    <LinearGradient colors={backgroundGradient} style={styles.root}>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton} testID="settings-back-button">
            <ArrowLeft color={theme.text} size={22} strokeWidth={2.2} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Settings</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} testID="settings-screen">
          <Text style={[styles.sectionLabel, { color: sectionLabelColor }]}>Appearance</Text>
          <View style={[styles.card, { backgroundColor: surfaceBg }]}> 
            <SettingsRow
              icon={isDark ? <Moon color={theme.primary} size={20} /> : <Sun color={theme.primary} size={20} />}
              label="Dark Mode"
              subtitle={isDark ? 'Dark theme active' : 'Light theme active'}
              right={
                <Switch
                  value={isDark}
                  onValueChange={toggleTheme}
                  trackColor={{ false: theme.border, true: theme.primary }}
                  thumbColor="#fff"
                  testID="settings-dark-mode-switch"
                />
              }
              testID="settings-dark-mode-row"
              theme={theme}
            />
          </View>

          <Text style={[styles.sectionLabel, { color: sectionLabelColor }]}>Feedback</Text>
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
                  testID="settings-haptics-switch"
                />
              }
              testID="settings-haptics-row"
              theme={theme}
            />
          </View>

          <Text style={[styles.sectionLabel, { color: sectionLabelColor }]}>Privacy</Text>
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
          </View>

          <Text style={[styles.sectionLabel, { color: sectionLabelColor }]}>Support</Text>
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

          <Text style={[styles.sectionLabel, { color: sectionLabelColor }]}>Data</Text>
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

          <Text style={[styles.sectionLabel, { color: theme.error }]}>Danger Zone</Text>
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

          <View style={styles.aboutSection}>
            <Info color={theme.textTertiary} size={16} />
            <Text style={[styles.aboutText, { color: theme.textTertiary }]}>FlashQuest v{appVersion}</Text>
          </View>
          <Text style={[styles.aboutCredit, { color: theme.textTertiary }]}>Built by Caleb Mukasa</Text>
          <View style={styles.bottomSpacer} />
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
