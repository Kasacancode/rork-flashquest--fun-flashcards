import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { logger } from '@/utils/logger';
import { normalizeStringArray, safeParseJsonOrNull } from '@/utils/safeJson';

const NOTIFICATION_PERMISSION_KEY = 'flashquest_notification_permission_asked';
export const NOTIFICATIONS_ENABLED_KEY = 'flashquest_notifications_enabled';
const STREAK_NOTIFICATION_ID = 'flashquest_streak_reminder';
const STREAK_NOTIFICATION_CHANNEL_ID = 'flashquest-streak-reminders';
const STREAK_NOTIFICATION_IDS_KEY = 'flashquest_streak_reminder_ids';

type ReminderMessage = {
  title: string;
  body: string;
};

const REMINDER_MESSAGES: readonly ReminderMessage[] = [
  {
    title: "Don't break your streak! 🔥",
    body: 'A quick study session keeps your streak alive.',
  },
  {
    title: 'Your flashcards miss you 📚',
    body: 'Open FlashQuest to keep your streak going.',
  },
  {
    title: 'Streak check! 🎯',
    body: 'Study a few cards today to stay on track.',
  },
] as const;

if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: false,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') {
    return;
  }

  await Notifications.setNotificationChannelAsync(STREAK_NOTIFICATION_CHANNEL_ID, {
    name: 'Streak Reminders',
    importance: Notifications.AndroidImportance.DEFAULT,
    sound: 'default',
  });
}

export async function clearScheduledStreakReminders(): Promise<void> {
  const storedIdentifiers = await AsyncStorage.getItem(STREAK_NOTIFICATION_IDS_KEY);
  if (!storedIdentifiers) {
    return;
  }

  const identifiers = safeParseJsonOrNull<string[]>({
    raw: storedIdentifiers,
    label: 'stored streak reminder identifiers',
    normalize: normalizeStringArray,
  });

  if (identifiers) {
    await Promise.all(
      identifiers.map((identifier) =>
        Notifications.cancelScheduledNotificationAsync(identifier).catch(() => {})
      ),
    );
  } else {
    logger.warn('[Notifications] Failed to parse stored streak reminders.');
  }

  await AsyncStorage.removeItem(STREAK_NOTIFICATION_IDS_KEY).catch(() => {});
}

function getRandomReminderMessage(): ReminderMessage {
  const randomIndex = Math.floor(Math.random() * REMINDER_MESSAGES.length);
  return REMINDER_MESSAGES[randomIndex] ?? REMINDER_MESSAGES[0]!;
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'web') {
    return false;
  }

  const alreadyAsked = await AsyncStorage.getItem(NOTIFICATION_PERMISSION_KEY);
  const { status: existingStatus } = await Notifications.getPermissionsAsync();

  if (existingStatus === 'granted') {
    await ensureAndroidChannel();
    return true;
  }

  if (alreadyAsked === 'true') {
    return false;
  }

  const { status } = await Notifications.requestPermissionsAsync();
  await AsyncStorage.setItem(NOTIFICATION_PERMISSION_KEY, 'true');

  if (status === 'granted') {
    await ensureAndroidChannel();
    return true;
  }

  return false;
}

export async function scheduleStreakReminder(options?: { requestPermissionIfNeeded?: boolean }): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      return;
    }

    const notificationsEnabled = await AsyncStorage.getItem(NOTIFICATIONS_ENABLED_KEY);
    if (notificationsEnabled === 'false') {
      await clearScheduledStreakReminders();
      return;
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    const grantedAfterPrompt = existingStatus !== 'granted' && options?.requestPermissionIfNeeded
      ? await requestNotificationPermission()
      : false;
    const hasPermission = existingStatus === 'granted' || grantedAfterPrompt;

    if (!hasPermission) {
      return;
    }

    await ensureAndroidChannel();
    await clearScheduledStreakReminders();
    await Notifications.cancelScheduledNotificationAsync(STREAK_NOTIFICATION_ID).catch(() => {});
    await Notifications.cancelScheduledNotificationAsync(`${STREAK_NOTIFICATION_ID}_day2`).catch(() => {});
    await Notifications.cancelScheduledNotificationAsync(`${STREAK_NOTIFICATION_ID}_day3`).catch(() => {});

    const messages = [
      getRandomReminderMessage(),
      getRandomReminderMessage(),
      getRandomReminderMessage(),
    ];
    const scheduledIdentifiers: string[] = [];

    for (let dayOffset = 1; dayOffset <= 3; dayOffset++) {
      const date = new Date();
      date.setDate(date.getDate() + dayOffset);
      date.setHours(18, 0, 0, 0);

      const identifier = await Notifications.scheduleNotificationAsync({
        content: {
          title: messages[dayOffset - 1]?.title ?? REMINDER_MESSAGES[0]?.title ?? 'Study reminder',
          body: messages[dayOffset - 1]?.body ?? REMINDER_MESSAGES[0]?.body ?? 'Open FlashQuest to keep your streak going.',
          sound: 'default',
          ...(Platform.OS === 'android' ? { channelId: STREAK_NOTIFICATION_CHANNEL_ID } : {}),
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date,
        },
      });

      scheduledIdentifiers.push(identifier);
    }

    await AsyncStorage.setItem(STREAK_NOTIFICATION_IDS_KEY, JSON.stringify(scheduledIdentifiers));
  } catch (error) {
    logger.warn('[Notifications] Failed to schedule streak reminders:', error);
  }
}
