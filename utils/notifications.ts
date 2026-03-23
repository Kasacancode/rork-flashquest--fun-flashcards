import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const NOTIFICATION_PERMISSION_KEY = 'flashquest_notification_permission_asked';
const STREAK_NOTIFICATION_ID = 'flashquest_streak_reminder';
const STREAK_NOTIFICATION_CHANNEL_ID = 'flashquest-streak-reminders';

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
      shouldShowList: false,
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

function getTomorrowReminderDate(): Date {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(18, 0, 0, 0);
  return tomorrow;
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

export async function scheduleStreakReminder(): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      return;
    }

    const { status } = await Notifications.getPermissionsAsync();

    if (status !== 'granted') {
      return;
    }

    await ensureAndroidChannel();
    await Notifications.cancelScheduledNotificationAsync(STREAK_NOTIFICATION_ID).catch(() => {});

    const message = getRandomReminderMessage();

    await Notifications.scheduleNotificationAsync({
      identifier: STREAK_NOTIFICATION_ID,
      content: {
        title: message.title,
        body: message.body,
        sound: 'default',
        ...(Platform.OS === 'android' ? { channelId: STREAK_NOTIFICATION_CHANNEL_ID } : {}),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: getTomorrowReminderDate(),
      },
    });
  } catch (error) {
    console.warn('[Notifications] Failed to schedule streak reminder:', error);
  }
}
