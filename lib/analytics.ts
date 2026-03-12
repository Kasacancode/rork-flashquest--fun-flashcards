import AsyncStorage from '@react-native-async-storage/async-storage';

import type { AnalyticsEventInput } from '@/backend/analytics/types';
import { trpcClient } from '@/lib/trpc';
import { generateUUID } from '@/utils/uuid';

const ANALYTICS_SESSION_KEY = 'flashquest_analytics_session_id';
const ANALYTICS_FLUSH_DELAY_MS = 1200;
const ANALYTICS_BATCH_SIZE = 20;

let cachedSessionId: string | null = null;
let sessionIdPromise: Promise<string> | null = null;
let queuedEvents: AnalyticsEventInput[] = [];
let flushTimeout: ReturnType<typeof setTimeout> | null = null;
let isFlushing = false;

function logAnalyticsDebug(...args: unknown[]): void {
  if (__DEV__) {
    console.log('[Analytics]', ...args);
  }
}

export async function createSessionIdIfNeeded(): Promise<string> {
  if (cachedSessionId) {
    return cachedSessionId;
  }

  if (sessionIdPromise) {
    return sessionIdPromise;
  }

  sessionIdPromise = (async () => {
    const storedSessionId = await AsyncStorage.getItem(ANALYTICS_SESSION_KEY);

    if (storedSessionId) {
      cachedSessionId = storedSessionId;
      return storedSessionId;
    }

    const newSessionId = generateUUID();
    cachedSessionId = newSessionId;
    await AsyncStorage.setItem(ANALYTICS_SESSION_KEY, newSessionId);
    return newSessionId;
  })();

  try {
    return await sessionIdPromise;
  } finally {
    sessionIdPromise = null;
  }
}

function clearScheduledFlush(): void {
  if (flushTimeout) {
    clearTimeout(flushTimeout);
    flushTimeout = null;
  }
}

function scheduleFlush(immediate = false): void {
  clearScheduledFlush();

  if (immediate) {
    void flushQueuedEvents();
    return;
  }

  flushTimeout = setTimeout(() => {
    flushTimeout = null;
    void flushQueuedEvents();
  }, ANALYTICS_FLUSH_DELAY_MS);
}

async function flushQueuedEvents(): Promise<void> {
  if (isFlushing || queuedEvents.length === 0) {
    return;
  }

  isFlushing = true;
  clearScheduledFlush();

  const batch = queuedEvents.slice(0, ANALYTICS_BATCH_SIZE);
  queuedEvents = queuedEvents.slice(batch.length);

  try {
    if (batch.length === 1) {
      const response = await trpcClient.analytics.track.mutate(batch[0]!);
      logAnalyticsDebug('track success', response);
    } else {
      const response = await trpcClient.analytics.batchTrack.mutate(batch);
      logAnalyticsDebug('batchTrack success', response);
    }
  } catch (error) {
    logAnalyticsDebug('submission failed', error);
  } finally {
    isFlushing = false;
    if (queuedEvents.length > 0) {
      scheduleFlush(queuedEvents.length >= ANALYTICS_BATCH_SIZE);
    }
  }
}

async function enqueueEvents(events: AnalyticsEventInput[]): Promise<void> {
  if (events.length === 0) {
    return;
  }

  try {
    const sessionId = await createSessionIdIfNeeded();
    const preparedEvents = events.map((event) => ({
      ...event,
      sessionId: event.sessionId ?? sessionId,
      timestamp: event.timestamp ?? Date.now(),
    } satisfies AnalyticsEventInput));

    queuedEvents = [...queuedEvents, ...preparedEvents];
    scheduleFlush(queuedEvents.length >= ANALYTICS_BATCH_SIZE);
  } catch (error) {
    logAnalyticsDebug('queueing failed', error);
  }
}

export function trackEvent(event: AnalyticsEventInput): void {
  void enqueueEvents([event]);
}

export function trackEvents(events: AnalyticsEventInput[]): void {
  void enqueueEvents(events);
}

export function flushAnalytics(): void {
  scheduleFlush(true);
}
