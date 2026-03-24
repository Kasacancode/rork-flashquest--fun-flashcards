import { Redis } from '@upstash/redis';

import type { Room } from '../arena/types';
import { createRedisConfigError } from '../errors';
import { GAME_MODE } from '../../types/game';
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
    throw createRedisConfigError('[AnalyticsRepo] Missing UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN');
  }

  redisInstance = new Redis({ url, token });
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

function battleFinishedLoggedKey(roomCode: string, battleStartedAt: number): string {
  return `${KEY_PREFIX}:battle-finished:${roomCode}:${battleStartedAt}`;
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

function isFinishedRoom(room: Pick<Room, 'status' | 'game'>): room is Pick<Room, 'status' | 'game'> & { game: NonNullable<Room['game']> } {
  return room.status === 'finished' && room.game != null && room.game.finishedAt != null;
}

function getQuestionsAnswered(room: Pick<Room, 'game'>): number {
  if (!room.game) {
    return 0;
  }

  return Object.values(room.game.answers).reduce((total, playerAnswers) => total + Object.keys(playerAnswers).length, 0);
}

function getWinnerPlayerId(room: Pick<Room, 'players' | 'game'>): string | null {
  if (!room.game) {
    return null;
  }

  const winner = [...room.players].sort((playerA, playerB) => {
    const playerAScore = room.game?.scores[playerA.id]?.points ?? 0;
    const playerBScore = room.game?.scores[playerB.id]?.points ?? 0;
    if (playerBScore !== playerAScore) {
      return playerBScore - playerAScore;
    }

    const playerACorrect = room.game?.scores[playerA.id]?.correct ?? 0;
    const playerBCorrect = room.game?.scores[playerB.id]?.correct ?? 0;
    return playerBCorrect - playerACorrect;
  })[0];

  return winner?.id ?? null;
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

  async trackBattleFinishedOnce(room: Pick<Room, 'code' | 'players' | 'deckId' | 'deckName' | 'game' | 'status'>): Promise<boolean> {
    if (!isFinishedRoom(room) || room.game.finishedAt == null) {
      return false;
    }

    const finishedGame = room.game;
    const finishedAt = finishedGame.finishedAt ?? finishedGame.startedAt;
    const redis = getRedis();
    const dedupeKey = battleFinishedLoggedKey(room.code, finishedGame.startedAt);
    const dedupeResult = await redis.set(dedupeKey, String(finishedAt), {
      ex: COUNTER_RETENTION_SECONDS,
      nx: true,
    });

    if (dedupeResult !== 'OK') {
      return false;
    }

    try {
      const battleDurationMs = Math.max(0, finishedAt - finishedGame.startedAt);
      const winnerPlayerId = getWinnerPlayerId(room);

      await this.trackEvent({
        event: 'battle_finished',
        timestamp: finishedAt,
        roomCode: room.code,
        deckId: room.deckId ?? undefined,
        properties: {
          players_per_battle: room.players.length,
          battle_duration_ms: battleDurationMs,
          questions_answered: getQuestionsAnswered(room),
          winner_player_id: winnerPlayerId,
          mode: GAME_MODE.ARENA,
          deck_name: room.deckName ?? null,
        },
      });

      return true;
    } catch (error) {
      await redis.del(dedupeKey);
      console.error(`[AnalyticsRepo] Failed to track battle_finished for room ${room.code}:`, error);
      throw error;
    }
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
