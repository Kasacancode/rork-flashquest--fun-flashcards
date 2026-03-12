import type { GameMode } from '../../types/game';

export const ANALYTICS_EVENT_NAMES = [
  'battle_created',
  'battle_joined',
  'battle_started',
  'battle_finished',
  'rematch_started',
  'deck_played',
] as const;

export type AnalyticsEventName = (typeof ANALYTICS_EVENT_NAMES)[number];
export type AnalyticsMode = GameMode;
export type AnalyticsPropertyValue = string | number | boolean | null;
export type AnalyticsProperties = Record<string, AnalyticsPropertyValue>;

export interface AnalyticsEvent {
  event: AnalyticsEventName;
  timestamp: number;
  sessionId?: string;
  userId?: string;
  roomCode?: string;
  deckId?: string;
  properties?: AnalyticsProperties;
}

export type AnalyticsEventInput = Omit<AnalyticsEvent, 'timestamp'> & {
  timestamp?: number;
};

export type AnalyticsSummaryCounts = Record<AnalyticsEventName, number>;

export interface AnalyticsSummary {
  day: string;
  counts: AnalyticsSummaryCounts;
  deckCounts: Record<string, number>;
}

export function createEmptyAnalyticsSummaryCounts(): AnalyticsSummaryCounts {
  return ANALYTICS_EVENT_NAMES.reduce((accumulator, eventName) => {
    accumulator[eventName] = 0;
    return accumulator;
  }, {} as AnalyticsSummaryCounts);
}

export function getAnalyticsDay(timestamp: number): string {
  return new Date(timestamp).toISOString().slice(0, 10);
}

export function isValidAnalyticsDay(day: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(day);
}
