import { Redis } from '@upstash/redis';

import type { AnalyticsEvent, AnalyticsSummaryCounts } from './types';
import { ANALYTICS_EVENT_NAMES, createEmptyAnalyticsSummaryCounts, getAnalyticsDay } from './types';

const RAW_RETENTION_SECONDS = 30 * 24 * 60 * 60;
const COUNTER_RETENTION_SECONDS = 400 * 24 * 60 * 60;
const KEY_PREFIX = 'flashquest:analytics';

let redisInstance: Redis | null = null;

function getRedis(): Redis {
  if (redisInstance) {
    return redisInstance;
  }

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    throw new Error('[AnalyticsRepo] Missing UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN env vars');
  }

  redisInstance = new Redis({ url, token });
  console.log('[AnalyticsRepo] Upstash Redis client initialized');
  return redisInstance;
}

function rawEventsKey(day: string): string {
  return `${KEY_PREFIX}:raw:${day}`;
}

function dailyCountsKey(day: string): string {
  return `${KEY_PREFIX}:daily:counts:${day}`;
}

function dailyDeckCountsKey(day: string): string {
  return `${KEY_PREFIX}:daily:deck:${day}`;
}

function parseNumericRecord(record: Record<string, unknown> | null | undefined): Record<string, number> {
  if (!record) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(record)
      .map(([key, value]) => {
        const numericValue = typeof value === 'number' ? value : Number(value);
        return [key, numericValue] as const;
      })
      .filter((entry) => Number.isFinite(entry[1]))
  );
}

function createCountsRecord(record: Record<string, number>): AnalyticsSummaryCounts {
  const counts = createEmptyAnalyticsSummaryCounts();

  for (const eventName of ANALYTICS_EVENT_NAMES) {
    counts[eventName] = record[eventName] ?? 0;
  }

  return counts;
}

class AnalyticsRepository {
  async trackEvent(event: AnalyticsEvent): Promise<void> {
    await this.trackEvents([event]);
  }

  async trackEvents(events: AnalyticsEvent[]): Promise<void> {
    if (events.length === 0) {
      return;
    }

    const redis = getRedis();
    const pipeline = redis.pipeline();
    const rawDays = new Set<string>();
    const countDays = new Set<string>();
    const deckDays = new Set<string>();

    for (const event of events) {
      const day = getAnalyticsDay(event.timestamp);
      rawDays.add(day);
      countDays.add(day);

      pipeline.rpush(rawEventsKey(day), JSON.stringify(event));
      pipeline.hincrby(dailyCountsKey(day), event.event, 1);

      if (event.event === 'deck_played' && event.deckId) {
        deckDays.add(day);
        pipeline.hincrby(dailyDeckCountsKey(day), event.deckId, 1);
      }
    }

    for (const day of rawDays) {
      pipeline.expire(rawEventsKey(day), RAW_RETENTION_SECONDS);
    }

    for (const day of countDays) {
      pipeline.expire(dailyCountsKey(day), COUNTER_RETENTION_SECONDS);
    }

    for (const day of deckDays) {
      pipeline.expire(dailyDeckCountsKey(day), COUNTER_RETENTION_SECONDS);
    }

    await pipeline.exec();
  }

  async getDailyCounts(day: string): Promise<AnalyticsSummaryCounts> {
    const redis = getRedis();
    const rawCounts = await redis.hgetall(dailyCountsKey(day));
    return createCountsRecord(parseNumericRecord(rawCounts as Record<string, unknown> | null));
  }

  async getDailyDeckCounts(day: string): Promise<Record<string, number>> {
    const redis = getRedis();
    const rawDeckCounts = await redis.hgetall(dailyDeckCountsKey(day));
    return parseNumericRecord(rawDeckCounts as Record<string, unknown> | null);
  }
}

export const analyticsRepository = new AnalyticsRepository();
