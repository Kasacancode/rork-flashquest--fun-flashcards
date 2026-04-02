import { describe, it, expect } from 'bun:test';

import {
  createDefaultCardStats,
  getLiveCardStats,
  updateCardMemory,
  inferRecallQuality,
  isCardDueForReview,
  deriveCardStatus,
  getWeaknessScore,
  computeDeckMastery,
  computeRetrievability,
  migrateCardStats,
} from '../mastery';
import type { CardStats } from '@/types/performance';

const DAY_MS = 86400000;

function buildCardStats(overrides: Partial<CardStats>): CardStats {
  return { ...createDefaultCardStats(), ...overrides };
}

describe('createDefaultCardStats', () => {
  it('returns zero attempts', () => {
    expect(createDefaultCardStats().attempts).toBe(0);
  });

  it('returns zero correct and incorrect', () => {
    const stats = createDefaultCardStats();
    expect(stats.correct).toBe(0);
    expect(stats.incorrect).toBe(0);
  });

  it('returns initial stability', () => {
    expect(createDefaultCardStats().stability).toBeGreaterThan(0);
  });

  it('returns null nextReviewAt', () => {
    expect(createDefaultCardStats().nextReviewAt).toBeNull();
  });
});

describe('inferRecallQuality', () => {
  it('returns 1 for incorrect answer', () => {
    expect(inferRecallQuality({ isCorrect: false })).toBe(1);
  });

  it('returns manual quality when provided', () => {
    expect(inferRecallQuality({ isCorrect: true, manualQuality: 4 })).toBe(4);
    expect(inferRecallQuality({ isCorrect: true, manualQuality: 2 })).toBe(2);
  });

  it('returns 4 for fast correct answer with no help', () => {
    expect(inferRecallQuality({ isCorrect: true, timeToAnswerMs: 2000 })).toBe(4);
  });

  it('returns 3 for moderate speed correct answer', () => {
    expect(inferRecallQuality({ isCorrect: true, timeToAnswerMs: 6000 })).toBe(3);
  });

  it('returns 2 for slow correct answer', () => {
    expect(inferRecallQuality({ isCorrect: true, timeToAnswerMs: 15000 })).toBe(2);
  });

  it('returns 2 when hints were used', () => {
    expect(inferRecallQuality({ isCorrect: true, hintsUsed: 1 })).toBe(2);
  });

  it('returns 2 when second chance was used', () => {
    expect(inferRecallQuality({ isCorrect: true, usedSecondChance: true })).toBe(2);
  });

  it('returns 2 when explanation was opened', () => {
    expect(inferRecallQuality({ isCorrect: true, explanationOpened: true })).toBe(2);
  });
});

describe('updateCardMemory', () => {
  const now = 1700000000000;

  it('increases stability on correct answer', () => {
    const stats = buildCardStats({ attempts: 3, correct: 2, stability: 2, lastAttemptAt: now - DAY_MS });
    const updated = updateCardMemory(stats, { quality: 3, now });
    expect(updated.stability).toBeGreaterThan(2);
  });

  it('decreases stability on forgot', () => {
    const stats = buildCardStats({ attempts: 5, correct: 4, stability: 10, streakCorrect: 5, lastAttemptAt: now - DAY_MS });
    const updated = updateCardMemory(stats, { quality: 1, now });
    expect(updated.stability).toBeLessThan(10);
  });

  it('sets higher initial stability for easy first answer', () => {
    const updated = updateCardMemory(undefined, { quality: 4, now });
    const updatedHard = updateCardMemory(undefined, { quality: 2, now });
    expect(updated.stability).toBeGreaterThan(updatedHard.stability);
  });

  it('increments correct count on correct answer', () => {
    const stats = buildCardStats({ attempts: 1, correct: 1 });
    const updated = updateCardMemory(stats, { quality: 3, now });
    expect(updated.correct).toBe(2);
  });

  it('increments incorrect count on forgot', () => {
    const stats = buildCardStats({ attempts: 1, incorrect: 0 });
    const updated = updateCardMemory(stats, { quality: 1, now });
    expect(updated.incorrect).toBe(1);
  });

  it('resets consecutive correct on forgot', () => {
    const stats = buildCardStats({ consecutiveCorrect: 5 });
    const updated = updateCardMemory(stats, { quality: 1, now });
    expect(updated.consecutiveCorrect).toBe(0);
  });

  it('increments consecutive correct on correct answer', () => {
    const stats = buildCardStats({ consecutiveCorrect: 3 });
    const updated = updateCardMemory(stats, { quality: 3, now });
    expect(updated.consecutiveCorrect).toBe(4);
  });

  it('sets nextReviewAt in the future', () => {
    const updated = updateCardMemory(undefined, { quality: 3, now });
    expect(updated.nextReviewAt).toBeGreaterThan(now);
  });

  it('counts lapses when a stable card is forgotten', () => {
    const stats = buildCardStats({ attempts: 10, correct: 9, stability: 15, streakCorrect: 8 });
    const updated = updateCardMemory(stats, { quality: 1, now });
    expect(updated.lapses).toBeGreaterThan(0);
  });
});

describe('getLiveCardStats', () => {
  const now = 1700000000000;

  it('hydrates retrievability and status from stored stats', () => {
    const stats = buildCardStats({
      attempts: 4,
      correct: 3,
      stability: 5,
      lastAttemptAt: now - DAY_MS,
      nextReviewAt: now + DAY_MS,
    });
    const live = getLiveCardStats(stats, now);
    expect(live.status).toBeDefined();
    expect(live.retrievability).toBeGreaterThan(0);
  });
});

describe('deriveCardStatus', () => {
  const now = 1700000000000;

  it('returns new for undefined stats', () => {
    expect(deriveCardStatus(undefined, now)).toBe('new');
  });

  it('returns new for zero-attempt stats', () => {
    expect(deriveCardStatus(createDefaultCardStats(), now)).toBe('new');
  });

  it('returns mastered for high stability', () => {
    const stats = buildCardStats({
      attempts: 20,
      correct: 18,
      stability: 30,
      streakCorrect: 10,
      retrievability: 0.9,
      lastReviewedAt: now - DAY_MS,
      lastAttemptAt: now - DAY_MS,
      nextReviewAt: now + (DAY_MS * 20),
    });
    expect(deriveCardStatus(stats, now)).toBe('mastered');
  });

  it('returns learning for low stability', () => {
    const stats = buildCardStats({
      attempts: 2,
      correct: 1,
      stability: 1,
      streakCorrect: 1,
      lastAttemptAt: now - DAY_MS,
      nextReviewAt: now + DAY_MS,
    });
    expect(deriveCardStatus(stats, now)).toBe('learning');
  });
});

describe('isCardDueForReview', () => {
  const now = 1700000000000;

  it('returns false for new cards', () => {
    expect(isCardDueForReview(undefined, now)).toBe(false);
  });

  it('returns true when past review date', () => {
    const stats = buildCardStats({
      attempts: 3,
      nextReviewAt: now - DAY_MS,
      lastAttemptAt: now - (DAY_MS * 2),
    });
    expect(isCardDueForReview(stats, now)).toBe(true);
  });

  it('returns false when review date is in the future', () => {
    const stats = buildCardStats({
      attempts: 3,
      nextReviewAt: now + (DAY_MS * 5),
      lastAttemptAt: now - DAY_MS,
    });
    expect(isCardDueForReview(stats, now)).toBe(false);
  });
});

describe('computeRetrievability', () => {
  const now = 1700000000000;

  it('returns 0 for new cards', () => {
    expect(computeRetrievability(undefined, now)).toBe(0);
  });

  it('decreases over time', () => {
    const stats = buildCardStats({
      attempts: 3,
      stability: 5,
      lastAttemptAt: now - (DAY_MS * 10),
      nextReviewAt: now - (DAY_MS * 5),
    });
    expect(computeRetrievability(stats, now)).toBeLessThan(1);
  });
});

describe('computeDeckMastery', () => {
  it('counts all cards as new when no stats exist', () => {
    const cards = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    const result = computeDeckMastery(cards, {});
    expect(result.newCards).toBe(3);
    expect(result.total).toBe(3);
    expect(result.mastered).toBe(0);
  });

  it('returns correct total', () => {
    const cards = [{ id: 'a' }, { id: 'b' }];
    const result = computeDeckMastery(cards, {});
    expect(result.total).toBe(2);
  });
});

describe('getWeaknessScore', () => {
  const now = 1700000000000;

  it('returns the baseline score for new cards', () => {
    expect(getWeaknessScore(undefined, now)).toBe(1.2);
  });

  it('returns higher score for cards with more errors', () => {
    const weak = buildCardStats({ attempts: 10, incorrect: 8, consecutiveIncorrect: 3 });
    const strong = buildCardStats({ attempts: 10, incorrect: 1, consecutiveCorrect: 5 });
    expect(getWeaknessScore(weak, now)).toBeGreaterThan(getWeaknessScore(strong, now));
  });
});

describe('edge cases: NaN and Infinity inputs', () => {
  const now = 1700000000000;

  it('handles NaN stability gracefully', () => {
    const stats = buildCardStats({ stability: Number.NaN });
    const updated = updateCardMemory(stats, { quality: 3, now });
    expect(Number.isFinite(updated.stability)).toBe(true);
    expect(updated.stability).toBeGreaterThan(0);
  });

  it('handles Infinity stability gracefully', () => {
    const stats = buildCardStats({ stability: Number.POSITIVE_INFINITY });
    const updated = updateCardMemory(stats, { quality: 3, now });
    expect(Number.isFinite(updated.stability)).toBe(true);
  });

  it('handles negative stability gracefully', () => {
    const stats = buildCardStats({ stability: -10 });
    const updated = updateCardMemory(stats, { quality: 3, now });
    expect(updated.stability).toBeGreaterThan(0);
  });

  it('handles NaN difficulty gracefully', () => {
    const stats = buildCardStats({ difficulty: Number.NaN, attempts: 5 });
    const updated = updateCardMemory(stats, { quality: 3, now });
    expect(Number.isFinite(updated.difficulty)).toBe(true);
  });

  it('handles NaN correct count', () => {
    const stats = buildCardStats({ correct: Number.NaN as unknown as number, attempts: 5 });
    const live = getLiveCardStats(stats, now);
    expect(Number.isFinite(live.correct)).toBe(true);
  });

  it('handles NaN lastAttemptAt', () => {
    const stats = buildCardStats({ lastAttemptAt: Number.NaN as unknown as number });
    const live = getLiveCardStats(stats, now);
    expect(Number.isFinite(live.lastAttemptAt)).toBe(true);
  });

  it('handles undefined stats in all public functions', () => {
    expect(getLiveCardStats(undefined, now)).toBeDefined();
    expect(deriveCardStatus(undefined, now)).toBe('new');
    expect(isCardDueForReview(undefined, now)).toBe(false);
    expect(computeRetrievability(undefined, now)).toBeDefined();
    expect(getWeaknessScore(undefined, now)).toBeDefined();
  });
});

describe('stability bounds', () => {
  const now = 1700000000000;

  it('never drops below minimum after forgot', () => {
    let stats = buildCardStats({ attempts: 1, correct: 1, stability: 0.5 });
    for (let i = 0; i < 20; i += 1) {
      stats = updateCardMemory(stats, { quality: 1, now: now + (i * 1000) });
    }
    expect(stats.stability).toBeGreaterThan(0);
  });

  it('never exceeds maximum after many correct answers', () => {
    let stats: CardStats | undefined;
    for (let i = 0; i < 100; i += 1) {
      stats = updateCardMemory(stats, { quality: 4, now: now + (i * DAY_MS) });
    }
    expect(stats!.stability).toBeLessThanOrEqual(365);
  });

  it('grows stability over repeated correct answers', () => {
    const first = updateCardMemory(undefined, { quality: 3, now });
    const second = updateCardMemory(first, { quality: 3, now: now + DAY_MS });
    const third = updateCardMemory(second, { quality: 3, now: now + (DAY_MS * 3) });
    expect(third.stability).toBeGreaterThan(second.stability);
    expect(second.stability).toBeGreaterThan(first.stability);
  });
});

describe('difficulty bounds', () => {
  const now = 1700000000000;

  it('never drops below 1', () => {
    let stats: CardStats | undefined;
    for (let i = 0; i < 50; i += 1) {
      stats = updateCardMemory(stats, { quality: 4, now: now + (i * DAY_MS) });
    }
    expect(stats!.difficulty).toBeGreaterThanOrEqual(1);
  });

  it('never exceeds 5', () => {
    let stats: CardStats | undefined;
    for (let i = 0; i < 50; i += 1) {
      stats = updateCardMemory(stats, { quality: 1, now: now + (i * 1000) });
    }
    expect(stats!.difficulty).toBeLessThanOrEqual(5);
  });

  it('increases difficulty on repeated forgot', () => {
    const first = updateCardMemory(undefined, { quality: 1, now });
    const second = updateCardMemory(first, { quality: 1, now: now + 1000 });
    expect(second.difficulty).toBeGreaterThanOrEqual(first.difficulty);
  });

  it('decreases difficulty on easy answers', () => {
    const first = updateCardMemory(undefined, { quality: 1, now });
    const second = updateCardMemory(first, { quality: 4, now: now + DAY_MS });
    expect(second.difficulty).toBeLessThan(first.difficulty);
  });
});

describe('migrateCardStats', () => {
  const now = 1700000000000;

  it('returns valid stats from undefined', () => {
    const migrated = migrateCardStats(undefined, now);
    expect(migrated.attempts).toBe(0);
    expect(migrated.status).toBe('new');
  });

  it('returns valid stats from empty object', () => {
    const migrated = migrateCardStats({}, now);
    expect(migrated.attempts).toBe(0);
  });

  it('normalizes garbage input into valid stats', () => {
    const garbage = {
      attempts: -5,
      correct: Number.NaN,
      incorrect: Number.POSITIVE_INFINITY,
      stability: -100,
      difficulty: 999,
      lastAttemptAt: Number.NaN,
    } as Partial<CardStats>;

    const migrated = migrateCardStats(garbage, now);
    expect(Number.isFinite(migrated.attempts)).toBe(true);
    expect(migrated.attempts).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(migrated.correct)).toBe(true);
    expect(Number.isFinite(migrated.incorrect)).toBe(true);
    expect(migrated.stability).toBeGreaterThan(0);
    expect(migrated.stability).toBeLessThanOrEqual(365);
    expect(migrated.difficulty).toBeGreaterThanOrEqual(1);
    expect(migrated.difficulty).toBeLessThanOrEqual(5);
  });

  it('preserves valid data during migration', () => {
    const valid = {
      attempts: 10,
      correct: 8,
      incorrect: 2,
      stability: 15,
      difficulty: 2.5,
      consecutiveCorrect: 5,
      consecutiveIncorrect: 0,
      streakCorrect: 5,
      lastAttemptAt: now - DAY_MS,
      nextReviewAt: now + (DAY_MS * 10),
    } as Partial<CardStats>;

    const migrated = migrateCardStats(valid, now);
    expect(migrated.attempts).toBe(10);
    expect(migrated.correct).toBe(8);
    expect(migrated.incorrect).toBe(2);
    expect(migrated.stability).toBeGreaterThan(0);
  });
});

describe('sequential study simulation', () => {
  const now = 1700000000000;
  const day = DAY_MS;

  it('card progresses from new to mastered over repeated correct reviews', () => {
    let stats: CardStats | undefined;
    let reviewTime = now;

    stats = updateCardMemory(stats, { quality: 3, now: reviewTime });
    expect(deriveCardStatus(stats, reviewTime)).not.toBe('mastered');

    for (let index = 0; index < 8; index += 1) {
      reviewTime = stats.nextReviewAt ?? reviewTime + DAY_MS;
      stats = updateCardMemory(stats, { quality: 4, now: reviewTime });
    }

    expect(stats.stability).toBeGreaterThan(21);
    expect(deriveCardStatus(stats, reviewTime)).toBe('mastered');
  });

  it('card lapses and recovers', () => {
    let stats: CardStats | undefined;

    stats = updateCardMemory(stats, { quality: 3, now });
    stats = updateCardMemory(stats, { quality: 4, now: now + day });
    stats = updateCardMemory(stats, { quality: 4, now: now + (day * 3) });
    stats = updateCardMemory(stats, { quality: 4, now: now + (day * 7) });
    const stabilityBefore = stats.stability;

    stats = updateCardMemory(stats, { quality: 1, now: now + (day * 14) });
    expect(stats.stability).toBeLessThan(stabilityBefore);
    expect(stats.lapses).toBeGreaterThan(0);

    stats = updateCardMemory(stats, { quality: 3, now: now + (day * 15) });
    stats = updateCardMemory(stats, { quality: 4, now: now + (day * 17) });
    expect(stats.stability).toBeGreaterThan(0);
    expect(stats.consecutiveCorrect).toBeGreaterThan(0);
  });

  it('retrievability decays below 1 over time without review', () => {
    const stats = updateCardMemory(undefined, { quality: 3, now });
    const currentRetrievability = computeRetrievability(stats, now);
    const laterRetrievability = computeRetrievability(stats, now + (day * 30));
    expect(currentRetrievability).toBeGreaterThan(laterRetrievability);
    expect(laterRetrievability).toBeLessThan(1);
  });
});
