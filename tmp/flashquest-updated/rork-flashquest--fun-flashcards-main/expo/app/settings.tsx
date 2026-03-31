import AsyncStorage from '@react-native-async-storage/async-storage';
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
import React, { useCallback, useEffect, useMemo, useState } from 'react';
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

export default function SettingsScreen() {
  const router = useRouter();
  const { theme, isDark, toggleTheme } = useTheme();
  const { analyticsEnabled, setAnalyticsConsent } = usePrivacy();
  const { decks, stats } = useFlashQuest();

  const [hapticsEnabled, setHapticsEnabled] = useState(true);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [notificationPermission, setNotificationPermission] = useState<string | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(HAPTICS_KEY).then((val) => {
      if (val !== null) setHapticsEnabled(val !== 'false');
    });
    AsyncStorage.getItem(NOTIFICATIONS_KEY).then((val) => {
      if (val !== null) setNotificationsEnabled(val !== 'false');
    });
    if (Platform.OS !== 'web') {
      Notifications.getPermissionsAsync().then(({ status }) => {
        setNotificationPermission(status);
      });
    }
  }, []);

  const handleToggleHaptics = useCallback((value: boolean) => {
    setHapticsEnabled(value);
    AsyncStorage.setItem(HAPTICS_KEY, String(value));
  }, []);

  const handleToggleNotifications = useCallback((value: boolean) => {
    setNotificationsEnabled(value);
    AsyncStorage.setItem(NOTIFICATIONS_KEY, String(value));
  }, []);

  const handleToggleAnalytics = useCallback((value: boolean) => {
    setAnalyticsConsent(value ? 'granted' : 'declined');
  }, [setAnalyticsConsent]);

  const handleClearAllData = useCallback(() => {
    Alert.alert(
      'Clear All Data',
      'This will permanently delete all your decks, progress, stats, and settings. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Everything',
          style: 'destructive',
          onPress: async () => {
            try {
              await AsyncStorage.clear();
              Alert.alert('Done', 'All data has been cleared. Please restart the app.');
            } catch {
              Alert.alert('Error', 'Failed to clear data. Please try again.');
            }
          },
        },
      ],
    );
  }, []);

  const customDeckCount = useMemo(() => decks.filter((d) => d.isCustom).length, [decks]);
  const totalCards = useMemo(() => decks.reduce((sum, d) => sum + d.flashcards.length, 0), [decks]);

  const backgroundGradient = useMemo(
    () =>
      isDark
        ? (['#08111f', '#0c1730', '#09111d'] as const)
        : (['#E0E7FF', '#EDE9FE', '#E0E7FF'] as const),
    [isDark],
  );

  const surfaceBg = isDark ? 'rgba(30, 41, 59, 0.7)' : 'rgba(255, 255, 255, 0.85)';
  const sectionLabelColor = isDark ? theme.textTertiary : theme.textSecondary;

  return (
    <LinearGradient colors={backgroundGradient} style={styles.root}>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <ArrowLeft color={theme.text} size={22} strokeWidth={2.2} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Settings</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Appearance */}
          <Text style={[styles.sectionLabel, { color: sectionLabelColor }]}>Appearance</Text>
          <View style={[styles.card, { backgroundColor: surfaceBg }]}>
            <SettingsRow
              icon={isDark ? <Moon color={theme.primary} size={20} /> : <Sun color={theme.primary} size={20} />}
              label="Dark Mode"
              subtitle={isDark ? 'Dark theme active' : 'Light theme active'}
              theme={theme}
              right={
                <Switch
                  value={isDark}
                  onValueChange={toggleTheme}
                  trackColor={{ false: theme.border, true: theme.primary }}
                  thumbColor="#fff"
                />
              }
            />
          </View>

          {/* Notifications & Haptics */}
          <Text style={[styles.sectionLabel, { color: sectionLabelColor }]}>Feedback</Text>
          <View style={[styles.card, { backgroundColor: surfaceBg }]}>
            <SettingsRow
              icon={notificationsEnabled ? <Bell color={theme.primary} size={20} /> : <BellOff color={theme.textTertiary} size={20} />}
              label="Streak Reminders"
              subtitle={
                notificationPermission === 'denied'
                  ? 'Blocked in system settings'
                  : notificationsEnabled
                    ? 'Daily reminders at 6 PM'
                    : 'Disabled'
              }
              theme={theme}
              right={
                <Switch
                  value={notificationsEnabled && notificationPermission !== 'denied'}
                  onValueChange={handleToggleNotifications}
                  disabled={notificationPermission === 'denied'}
                  trackColor={{ false: theme.border, true: theme.primary }}
                  thumbColor="#fff"
                />
              }
            />
            <Divider color={theme.border} />
            <SettingsRow
              icon={<Vibrate color={theme.primary} size={20} />}
              label="Haptic Feedback"
              subtitle={hapticsEnabled ? 'Vibration on interactions' : 'Disabled'}
              theme={theme}
              right={
                <Switch
                  value={hapticsEnabled}
                  onValueChange={handleToggleHaptics}
                  trackColor={{ false: theme.border, true: theme.primary }}
                  thumbColor="#fff"
                />
              }
            />
          </View>

          {/* Privacy */}
          <Text style={[styles.sectionLabel, { color: sectionLabelColor }]}>Privacy</Text>
          <View style={[styles.card, { backgroundColor: surfaceBg }]}>
            <SettingsRow
              icon={<SmartphoneNfc color={theme.primary} size={20} />}
              label="Usage Analytics"
              subtitle={analyticsEnabled ? 'Sending anonymous usage data' : 'No data is sent'}
              theme={theme}
              right={
                <Switch
                  value={analyticsEnabled}
                  onValueChange={handleToggleAnalytics}
                  trackColor={{ false: theme.border, true: theme.primary }}
                  thumbColor="#fff"
                />
              }
            />
            <Divider color={theme.border} />
            <SettingsRow
              icon={<ShieldCheck color={theme.primary} size={20} />}
              label="Privacy & Data"
              theme={theme}
              onPress={() => router.push(DATA_PRIVACY_ROUTE)}
              right={<ChevronRight color={theme.textTertiary} size={18} />}
            />
          </View>

          {/* Support */}
          <Text style={[styles.sectionLabel, { color: sectionLabelColor }]}>Support</Text>
          <View style={[styles.card, { backgroundColor: surfaceBg }]}>
            <SettingsRow
              icon={<HelpCircle color={theme.primary} size={20} />}
              label="FAQ"
              theme={theme}
              onPress={() => router.push(FAQ_ROUTE)}
              right={<ChevronRight color={theme.textTertiary} size={18} />}
            />
          </View>

          {/* Data Storage */}
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

          {/* Danger Zone */}
          <Text style={[styles.sectionLabel, { color: theme.error }]}>Danger Zone</Text>
          <View style={[styles.card, { backgroundColor: surfaceBg }]}>
            <SettingsRow
              icon={<Trash2 color={theme.error} size={20} />}
              label="Clear All Data"
              labelColor={theme.error}
              subtitle="Permanently delete everything"
              theme={theme}
              onPress={handleClearAllData}
              right={<ChevronRight color={theme.error} size={18} />}
            />
          </View>

          {/* About */}
          <View style={styles.aboutSection}>
            <Info color={theme.textTertiary} size={16} />
            <Text style={[styles.aboutText, { color: theme.textTertiary }]}>
              FlashQuest v1.0.0
            </Text>
          </View>
          <Text style={[styles.aboutCredit, { color: theme.textTertiary }]}>
            Built by Caleb Mukasa
          </Text>

          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

function Divider({ color }: { color: string }) {
  return <View style={[styles.divider, { backgroundColor: color }]} />;
}

interface SettingsRowProps {
  icon: React.ReactNode;
  label: string;
  labelColor?: string;
  subtitle?: string;
  theme: { text: string; textSecondary: string };
  right?: React.ReactNode;
  onPress?: () => void;
}

function SettingsRow({ icon, label, labelColor, subtitle, theme, right, onPress }: SettingsRowProps) {
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
    return <TouchableOpacity onPress={onPress} activeOpacity={0.6}>{content}</TouchableOpacity>;
  }

  return content;
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
  backBtn: {
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
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  headerSpacer: { width: 40 },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 4,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
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
    fontWeight: '600',
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
    fontWeight: '500',
  },
  dataValue: {
    fontSize: 14,
    fontWeight: '700',
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
    fontWeight: '500',
  },
  aboutCredit: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
  },
});
