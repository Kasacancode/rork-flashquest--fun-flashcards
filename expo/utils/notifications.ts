import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { logger } from '@/utils/logger';
import { normalizeStringArray, safeParseJsonOrNull } from '@/utils/safeJson';

const NOTIFICATION_PERMISSION_KEY = 'flashquest_notification_permission_asked';
export const NOTIFICATIONS_ENABLED_KEY = 'flashquest_notifications_enabled';
const STREAK_NOTIFICATION_CHANNEL_ID = 'flashquest-streak-reminders';
const SOCIAL_NOTIFICATION_CHANNEL_ID = 'flashquest-social';
const STREAK_NOTIFICATION_IDS_KEY = 'flashquest_streak_reminder_ids';

type ReminderMessage = {
  title: string;
  body: string;
};

export interface StudyReminderContext {
  dueCardCount: number;
  deckCount: number;
  currentStreak: number;
}

if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: false,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: true,
    }),
  });
}

async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') {
    return;
  }

  await Notifications.setNotificationChannelAsync(STREAK_NOTIFICATION_CHANNEL_ID, {
    name: 'Study Reminders',
    importance: Notifications.AndroidImportance.DEFAULT,
    sound: 'default',
  });
}

export async function ensureSocialChannel(): Promise<void> {
  if (Platform.OS !== 'android') {
    return;
  }

  await Notifications.setNotificationChannelAsync(SOCIAL_NOTIFICATION_CHANNEL_ID, {
    name: 'Social',
    description: 'Friend requests, challenges, and social updates',
    importance: Notifications.AndroidImportance.HIGH,
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
  }

  await AsyncStorage.removeItem(STREAK_NOTIFICATION_IDS_KEY).catch(() => {});
}

function pick<T>(options: T[]): T {
  return options[Math.floor(Math.random() * options.length)] ?? options[0]!;
}

function buildDay1Message(context: StudyReminderContext): ReminderMessage {
  const { dueCardCount, deckCount, currentStreak } = context;
  const c = dueCardCount;
  const d = deckCount;
  const s = currentStreak;
  const cards = c === 1 ? 'card' : 'cards';
  const decks = d === 1 ? 'deck' : 'decks';
  const days = s === 1 ? 'day' : 'days';

  if (c > 0 && s > 30) {
    return pick([
      { title: `${s} days?? don't stop now`, body: `${c} ${cards} due. you're actually on a roll` },
      { title: `${s}-day streak is elite`, body: `${c} ${cards} across ${d} ${decks}. keep the legend going` },
    ]);
  }

  if (c > 40) {
    return pick([
      { title: `ok ${c} cards is a lot`, body: `start with 10. seriously, that's all you need` },
      { title: `${c} cards piled up`, body: `don't panic. a quick session chips away at it` },
    ]);
  }

  if (c > 0 && s > 2) {
    return pick([
      { title: `${c} ${cards} due, ${s}-day streak`, body: 'knock em out before your streak fumbles' },
      { title: 'streak check', body: `${s} ${days} strong, ${c} ${cards} waiting. don't break the chain` },
      { title: 'your cards are giving you the look', body: `${c} review${c === 1 ? '' : 's'} across ${d} ${decks}. quick sesh?` },
    ]);
  }

  if (c > 0) {
    return pick([
      { title: `${c} ${cards} just sitting there`, body: '5 minutes now saves 20 minutes later. science.' },
      { title: 'your flashcards called', body: `${c} review${c === 1 ? '' : 's'} across ${d} ${decks}. they miss you` },
      { title: 'quick review sesh?', body: `${c} ${cards} ready to go. in and out, easy` },
    ]);
  }

  if (s > 30) {
    return pick([
      { title: `${s} days and counting`, body: 'at this point you\'re just showing off. keep going' },
      { title: 'streak royalty', body: `${s} ${days}. a quick session keeps the crown on` },
    ]);
  }

  if (s > 0) {
    return pick([
      { title: `your ${s}-day streak tho`, body: 'a quick session keeps the momentum going' },
      { title: `don't fumble the streak`, body: `${s} ${days} is too clean to lose. quick study?` },
    ]);
  }

  return pick([
    { title: 'hey, study buddy here', body: 'your decks are ready. even 5 minutes counts' },
    { title: 'brain gains await', body: 'a quick flashcard session goes a long way' },
  ]);
}

function buildDay2Message(context: StudyReminderContext): ReminderMessage {
  const { dueCardCount, currentStreak } = context;
  const c = dueCardCount;
  const s = currentStreak;
  const cards = c === 1 ? 'card' : 'cards';
  const days = s === 1 ? 'day' : 'days';

  if (c > 40) {
    return pick([
      { title: 'real talk', body: `${c} cards is a lot. but even 10 makes a dent` },
      { title: 'start small, finish big', body: `you've got ${c} due. knock out a quick 10 and call it a win` },
    ]);
  }

  if (c > 0) {
    return pick([
      { title: `so... those ${c} ${cards}`, body: 'still waiting. they\'re getting harder by the hour' },
      { title: 'not to be dramatic but', body: `${c} review${c === 1 ? '' : 's'} piling up. a quick sesh fixes everything` },
      { title: `${c} ${cards}, still here`, body: 'the sooner you review, the easier they are' },
    ]);
  }

  if (s > 2) {
    return pick([
      { title: 'your streak is sweating rn', body: `${s} ${days} on the line. one session. that's it` },
      { title: `${s}-day streak, going once...`, body: 'study a few cards before it resets' },
    ]);
  }

  return pick([
    { title: 'your brain called, left a voicemail', body: 'something about flashcards and long-term memory' },
    { title: 'just checking in', body: 'your decks are patient. but your memory isn\'t' },
  ]);
}

function buildDay3Message(context: StudyReminderContext): ReminderMessage {
  const { dueCardCount, currentStreak } = context;
  const c = dueCardCount;
  const s = currentStreak;
  const cards = c === 1 ? 'card' : 'cards';

  if (c > 5) {
    return pick([
      { title: 'ok last nudge, promise', body: `${c} ${cards} need love. come back whenever` },
      { title: 'reviews are stacking up fr', body: 'the longer you wait, the more relearning. no pressure tho' },
    ]);
  }

  if (s > 0) {
    return { title: 'we both know you don\'t wanna restart', body: `one quick session saves your ${s}-day streak` };
  }

  return pick([
    { title: 'your decks will be here', body: 'no rush. pick up where you left off anytime' },
    { title: 'no pressure, just vibes', body: 'whenever you\'re ready, your cards are too' },
  ]);
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

export async function scheduleStudyReminders(
  context: StudyReminderContext,
  options?: { requestPermissionIfNeeded?: boolean },
): Promise<void> {
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

    const messages: ReminderMessage[] = [
      buildDay1Message(context),
      buildDay2Message(context),
      buildDay3Message(context),
    ];

    const scheduledIdentifiers: string[] = [];

    for (let dayOffset = 1; dayOffset <= 3; dayOffset += 1) {
      const date = new Date();
      date.setDate(date.getDate() + dayOffset);
      date.setHours(18, 0, 0, 0);

      const message = messages[dayOffset - 1]!;

      const identifier = await Notifications.scheduleNotificationAsync({
        content: {
          title: message.title,
          body: message.body,
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
    logger.warn('[Notifications] Failed to schedule study reminders:', error);
  }
}

export const scheduleSmartReminder = scheduleStudyReminders;
export const scheduleStreakReminder = (options?: { requestPermissionIfNeeded?: boolean }) =>
  scheduleStudyReminders({ dueCardCount: 0, deckCount: 0, currentStreak: 0 }, options);

export async function updateAppBadgeCount(dueCardCount: number): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      return;
    }

    const notificationsEnabled = await AsyncStorage.getItem(NOTIFICATIONS_ENABLED_KEY);
    if (notificationsEnabled === 'false') {
      await Notifications.setBadgeCountAsync(0);
      return;
    }

    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') {
      return;
    }

    await Notifications.setBadgeCountAsync(Math.max(0, dueCardCount));
  } catch (error) {
    logger.warn('[Notifications] Failed to update badge count:', error);
  }
}

export async function clearAppBadge(): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      return;
    }

    await Notifications.setBadgeCountAsync(0);
  } catch (error) {
    logger.warn('[Notifications] Failed to clear badge:', error);
  }
}
