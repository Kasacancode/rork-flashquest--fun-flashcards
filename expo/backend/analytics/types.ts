import type { GameMode } from '../../types/game';

export const ANALYTICS_EVENT_NAMES = [
  'battle_created',
  'battle_joined',
  'battle_started',
  'battle_finished',
  'rematch_started',
  'deck_played',
  'app_opened',
  'session_completed',
  'deck_created',
  'ai_scan_started',
  'ai_scan_completed',
  'ai_scan_failed',
  'ai_text_started',
  'ai_text_completed',
  'ai_text_failed',
  'quest_completed',
  'study_completed',
  'practice_completed',
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

export interface AnalyticsArenaMetrics {
  battleStartRate: number;
  battleCompletionRate: number;
  rematchRate: number;
}

export interface AnalyticsEngagementMetrics {
  dailySessions: number;
  questCompletions: number;
  studyCompletions: number;
  practiceCompletions: number;
  decksCreated: number;
}

export interface AnalyticsAIMetrics {
  scanAttempts: number;
  scanSuccesses: number;
  scanFailures: number;
  scanSuccessRate: number;
  textAttempts: number;
  textSuccesses: number;
  textFailures: number;
  textSuccessRate: number;
}

export interface AnalyticsSummary {
  day: string;
  counts: AnalyticsSummaryCounts;
  metrics: AnalyticsArenaMetrics;
  engagement: AnalyticsEngagementMetrics;
  aiMetrics: AnalyticsAIMetrics;
  deckCounts: Record<string, number>;
}

export function createEmptyAnalyticsSummaryCounts(): AnalyticsSummaryCounts {
  return ANALYTICS_EVENT_NAMES.reduce((accumulator, eventName) => {
    accumulator[eventName] = 0;
    return accumulator;
  }, {} as AnalyticsSummaryCounts);
}

export function createEmptyAnalyticsArenaMetrics(): AnalyticsArenaMetrics {
  return {
    battleStartRate: 0,
    battleCompletionRate: 0,
    rematchRate: 0,
  };
}

export function createEmptyAnalyticsEngagementMetrics(): AnalyticsEngagementMetrics {
  return {
    dailySessions: 0,
    questCompletions: 0,
    studyCompletions: 0,
    practiceCompletions: 0,
    decksCreated: 0,
  };
}

export function createEmptyAnalyticsAIMetrics(): AnalyticsAIMetrics {
  return {
    scanAttempts: 0,
    scanSuccesses: 0,
    scanFailures: 0,
    scanSuccessRate: 0,
    textAttempts: 0,
    textSuccesses: 0,
    textFailures: 0,
    textSuccessRate: 0,
  };
}

export function getAnalyticsDay(timestamp: number): string {
  return new Date(timestamp).toISOString().slice(0, 10);
}

export function isValidAnalyticsDay(day: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(day);
}
