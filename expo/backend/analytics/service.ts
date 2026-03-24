import { analyticsRepository } from './repository';
import type {
  AnalyticsAIMetrics,
  AnalyticsArenaMetrics,
  AnalyticsEngagementMetrics,
  AnalyticsEvent,
  AnalyticsEventInput,
  AnalyticsSummary,
  AnalyticsSummaryCounts,
} from './types';
import {
  createEmptyAnalyticsAIMetrics,
  createEmptyAnalyticsArenaMetrics,
  createEmptyAnalyticsEngagementMetrics,
  createEmptyAnalyticsSummaryCounts,
  getAnalyticsDay,
  isValidAnalyticsDay,
} from './types';

function normalizeOptionalString(value: string | undefined): string | undefined {
  const normalizedValue = value?.trim();
  return normalizedValue ? normalizedValue : undefined;
}

function roundMetric(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  const clampedValue = Math.min(1, Math.max(0, value));
  return Math.round(clampedValue * 1000) / 1000;
}

function safeRate(numerator: number, denominator: number): number {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) {
    return 0;
  }

  return roundMetric(numerator / denominator);
}

export function computeArenaMetrics(
  counts: Pick<Partial<AnalyticsSummaryCounts>, 'battle_created' | 'battle_started' | 'battle_finished' | 'rematch_started'> | undefined,
): AnalyticsArenaMetrics {
  const battleCreatedCount = counts?.battle_created ?? 0;
  const battleStartedCount = counts?.battle_started ?? 0;
  const battleFinishedCount = counts?.battle_finished ?? 0;
  const rematchStartedCount = counts?.rematch_started ?? 0;

  return {
    battleStartRate: safeRate(battleStartedCount, battleCreatedCount),
    battleCompletionRate: safeRate(battleFinishedCount, battleStartedCount),
    rematchRate: safeRate(rematchStartedCount, battleFinishedCount),
  };
}

export function computeEngagementMetrics(counts: Partial<AnalyticsSummaryCounts>): AnalyticsEngagementMetrics {
  return {
    dailySessions: counts.app_opened ?? 0,
    questCompletions: counts.quest_completed ?? 0,
    studyCompletions: counts.study_completed ?? 0,
    practiceCompletions: counts.practice_completed ?? 0,
    decksCreated: counts.deck_created ?? 0,
  };
}

export function computeAIMetrics(counts: Partial<AnalyticsSummaryCounts>): AnalyticsAIMetrics {
  const scanAttempts = counts.ai_scan_started ?? 0;
  const scanSuccesses = counts.ai_scan_completed ?? 0;
  const scanFailures = counts.ai_scan_failed ?? 0;
  const textAttempts = counts.ai_text_started ?? 0;
  const textSuccesses = counts.ai_text_completed ?? 0;
  const textFailures = counts.ai_text_failed ?? 0;

  return {
    scanAttempts,
    scanSuccesses,
    scanFailures,
    scanSuccessRate: safeRate(scanSuccesses, scanAttempts),
    textAttempts,
    textSuccesses,
    textFailures,
    textSuccessRate: safeRate(textSuccesses, textAttempts),
  };
}

function normalizeEvent(event: AnalyticsEventInput): AnalyticsEvent {
  const timestamp = typeof event.timestamp === 'number' && Number.isFinite(event.timestamp)
    ? event.timestamp
    : Date.now();

  const properties = event.properties && Object.keys(event.properties).length > 0
    ? event.properties
    : undefined;

  return {
    event: event.event,
    timestamp,
    sessionId: normalizeOptionalString(event.sessionId),
    userId: normalizeOptionalString(event.userId),
    roomCode: normalizeOptionalString(event.roomCode),
    deckId: normalizeOptionalString(event.deckId),
    properties,
  };
}

class AnalyticsService {
  async trackEvent(event: AnalyticsEventInput): Promise<AnalyticsEvent> {
    const normalizedEvent = normalizeEvent(event);
    await analyticsRepository.trackEvent(normalizedEvent);
    return normalizedEvent;
  }

  async trackEvents(events: AnalyticsEventInput[]): Promise<AnalyticsEvent[]> {
    const normalizedEvents = events.map(normalizeEvent);

    if (normalizedEvents.length === 0) {
      return normalizedEvents;
    }

    await analyticsRepository.trackEvents(normalizedEvents);
    return normalizedEvents;
  }

  async getSummary(day?: string): Promise<AnalyticsSummary> {
    const resolvedDay = day && isValidAnalyticsDay(day)
      ? day
      : getAnalyticsDay(Date.now());

    const [counts, deckCounts] = await Promise.all([
      analyticsRepository.getDailyCounts(resolvedDay),
      analyticsRepository.getDailyDeckCounts(resolvedDay),
    ]);

    return {
      day: resolvedDay,
      counts,
      metrics: computeArenaMetrics(counts),
      engagement: computeEngagementMetrics(counts),
      aiMetrics: computeAIMetrics(counts),
      deckCounts,
    };
  }

  getEmptySummary(day?: string): AnalyticsSummary {
    const resolvedDay = day && isValidAnalyticsDay(day)
      ? day
      : getAnalyticsDay(Date.now());

    return {
      day: resolvedDay,
      counts: createEmptyAnalyticsSummaryCounts(),
      metrics: createEmptyAnalyticsArenaMetrics(),
      engagement: createEmptyAnalyticsEngagementMetrics(),
      aiMetrics: createEmptyAnalyticsAIMetrics(),
      deckCounts: {},
    };
  }
}

export const analyticsService = new AnalyticsService();
