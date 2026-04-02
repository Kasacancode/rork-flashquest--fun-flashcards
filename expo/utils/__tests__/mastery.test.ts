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
