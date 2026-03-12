import { analyticsRepository } from './repository';
import type { AnalyticsEvent, AnalyticsEventInput, AnalyticsSummary } from './types';
import { createEmptyAnalyticsSummaryCounts, getAnalyticsDay, isValidAnalyticsDay } from './types';

function normalizeOptionalString(value: string | undefined): string | undefined {
  const normalizedValue = value?.trim();
  return normalizedValue ? normalizedValue : undefined;
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
      deckCounts: {},
    };
  }
}

export const analyticsService = new AnalyticsService();
