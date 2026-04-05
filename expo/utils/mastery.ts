import type {
  CardMemoryStatus,
  CardStats,
  DeckStats,
  QuestPerformance,
  RecallQuality,
} from '@/types/performance';

export type MasteryStatus = CardMemoryStatus;

export interface MasteryBreakdown {
  mastered: number;
  reviewing: number;
  learning: number;
  lapsed: number;
  newCards: number;
  total: number;
}

interface InferRecallQualityParams {
  isCorrect: boolean;
  manualQuality?: RecallQuality | null;
  timeToAnswerMs?: number;
  hintsUsed?: number;
  usedSecondChance?: boolean;
  explanationOpened?: boolean;
}

interface UpdateCardMemoryParams {
  quality: RecallQuality;
  now?: number;
}

const DAY_IN_MS = 86400000;
const MIN_STABILITY_DAYS = 0.35;
const MAX_STABILITY_DAYS = 365;
const MIN_DIFFICULTY = 1;
const MAX_DIFFICULTY = 5;
const LEARNING_STABILITY_THRESHOLD = 3;
const MASTERED_STABILITY_THRESHOLD = 21;
const RECENT_WEAK_CARD_RECOVERY_WINDOW_MS = 1000 * 60 * 45;
const RECENT_WEAK_CARD_RECOVERY_THRESHOLD = 7.1;
export const WEAK_CARD_THRESHOLD = 6;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function toFiniteNumber(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || Number.isNaN(value) || !Number.isFinite(value)) {
    return fallback;
  }

  return value;
}

function toNullableTimestamp(value: unknown): number | null {
  const nextValue = toFiniteNumber(value, 0);
  return nextValue > 0 ? nextValue : null;
}

function normalizeDeckStats(stats: DeckStats | undefined): DeckStats | undefined {
  if (!stats) {
    return undefined;
  }

  return {
    attempts: Math.max(0, Math.round(toFiniteNumber(stats.attempts, 0))),
    correct: Math.max(0, Math.round(toFiniteNumber(stats.correct, 0))),
    incorrect: Math.max(0, Math.round(toFiniteNumber(stats.incorrect, 0))),
    lastAttemptAt: Math.max(0, Math.round(toFiniteNumber(stats.lastAttemptAt, 0))),
  };
}

export function createDefaultCardStats(): CardStats {
  return {
    attempts: 0,
    correct: 0,
    incorrect: 0,
    consecutiveCorrect: 0,
    consecutiveIncorrect: 0,
    streakCorrect: 0,
    stability: MIN_STABILITY_DAYS,
    difficulty: 3,
    retrievability: 0,
    lastReviewedAt: null,
    lastAttemptAt: 0,
    nextReviewAt: null,
    lapses: 0,
    status: 'new',
  };
}

function deriveLegacyStability(raw: Partial<CardStats>): number {
  const nextReviewAt = toNullableTimestamp(raw.nextReviewAt);
  const lastAttemptAt = Math.max(0, Math.round(toFiniteNumber(raw.lastAttemptAt, 0)));

  if (nextReviewAt && lastAttemptAt > 0 && nextReviewAt > lastAttemptAt) {
    return clamp((nextReviewAt - lastAttemptAt) / DAY_IN_MS, MIN_STABILITY_DAYS, MAX_STABILITY_DAYS);
  }

  const streakCorrect = Math.max(0, Math.round(toFiniteNumber(raw.streakCorrect, 0)));

  if (streakCorrect <= 0) {
    return 0.75;
  }

  if (streakCorrect === 1) {
    return 1.4;
  }

  if (streakCorrect === 2) {
    return 2.8;
  }

  if (streakCorrect === 3) {
    return 6.5;
  }

  if (streakCorrect === 4) {
    return 13;
  }

  return clamp(21 + ((streakCorrect - 5) * 4), MIN_STABILITY_DAYS, MAX_STABILITY_DAYS);
}

function deriveDifficulty(raw: Partial<CardStats>, attempts: number, correct: number, incorrect: number): number {
  const providedDifficulty = toFiniteNumber(raw.difficulty, Number.NaN);

  if (!Number.isNaN(providedDifficulty)) {
    return clamp(providedDifficulty, MIN_DIFFICULTY, MAX_DIFFICULTY);
  }

  if (attempts === 0) {
    return 3;
  }

  const accuracy = correct / Math.max(attempts, 1);
  const difficulty = 3.2 + (incorrect * 0.14) - (accuracy * 1.15);
  return clamp(difficulty, MIN_DIFFICULTY, MAX_DIFFICULTY);
}

function computeRetrievabilityFromValues(lastReviewedAt: number | null, stability: number, now: number): number {
  if (!lastReviewedAt) {
    return 0;
  }

  const safeStability = Math.max(stability, MIN_STABILITY_DAYS);
  const daysSinceReview = Math.max(0, (now - lastReviewedAt) / DAY_IN_MS);
  const retrievability = Math.exp(-daysSinceReview / safeStability);
  return clamp(retrievability, 0, 1);
}

function normalizeCardStats(raw: Partial<CardStats> | undefined, now: number): CardStats {
  if (!raw) {
    return createDefaultCardStats();
  }

  const rawCorrect = Math.max(0, Math.round(toFiniteNumber(raw.correct, 0)));
  const rawIncorrect = Math.max(0, Math.round(toFiniteNumber(raw.incorrect, 0)));
  const streakCorrect = Math.max(0, Math.round(toFiniteNumber(raw.streakCorrect, 0)));
  const rawConsecutiveCorrect = Math.max(0, Math.round(toFiniteNumber(raw.consecutiveCorrect, streakCorrect)));
  const rawConsecutiveIncorrect = Math.max(0, Math.round(toFiniteNumber(
    raw.consecutiveIncorrect,
    rawIncorrect > 0 && rawConsecutiveCorrect === 0 ? 1 : 0,
  )));
  const lastAttemptAt = Math.max(0, Math.round(toFiniteNumber(raw.lastAttemptAt, 0)));
  const lastReviewedAt = toNullableTimestamp(raw.lastReviewedAt) ?? (lastAttemptAt > 0 ? lastAttemptAt : null);
  const stability = clamp(toFiniteNumber(raw.stability, deriveLegacyStability(raw)), MIN_STABILITY_DAYS, MAX_STABILITY_DAYS);

  const attempts = Math.max(
    0,
    Math.round(toFiniteNumber(raw.attempts, 0)),
    rawCorrect + rawIncorrect,
    rawConsecutiveCorrect + rawConsecutiveIncorrect,
    streakCorrect,
    lastAttemptAt > 0 ? 1 : 0,
    lastReviewedAt ? 1 : 0,
  );
  const correct = Math.min(attempts, Math.max(rawCorrect, rawConsecutiveCorrect));
  const incorrect = Math.min(Math.max(0, attempts - correct), Math.max(rawIncorrect, rawConsecutiveIncorrect));
  const consecutiveCorrect = attempts === 0 ? 0 : Math.min(Math.max(rawConsecutiveCorrect, streakCorrect), correct);
  const consecutiveIncorrect = attempts === 0 ? 0 : Math.min(rawConsecutiveIncorrect, incorrect);
  const nextReviewAt = toNullableTimestamp(raw.nextReviewAt) ?? (
    lastReviewedAt
      ? Math.round(lastReviewedAt + (stability * DAY_IN_MS))
      : null
  );
  const difficulty = deriveDifficulty(raw, attempts, correct, incorrect);
  const retrievability = attempts === 0
    ? 0
    : clamp(
        toFiniteNumber(raw.retrievability, computeRetrievabilityFromValues(lastReviewedAt, stability, now)),
        0,
        1,
      );
  const lapses = Math.max(0, Math.round(toFiniteNumber(raw.lapses, 0)));

  return {
    attempts,
    correct,
    incorrect,
    consecutiveCorrect,
    consecutiveIncorrect,
    streakCorrect: consecutiveCorrect,
    stability,
    difficulty,
    retrievability,
    lastReviewedAt,
    lastAttemptAt,
    nextReviewAt,
    lapses,
    status: 'new',
  };
}

function deriveCardStatusFromNormalized(card: CardStats, now: number): CardMemoryStatus {
  if (card.attempts === 0) {
    return 'new';
  }

  const retrievability = clamp(
    toFiniteNumber(card.retrievability, computeRetrievabilityFromValues(card.lastReviewedAt, card.stability, now)),
    0,
    1,
  );
  const recoveredFromLapse = card.lapses > 0 && card.consecutiveCorrect >= 2 && card.stability >= LEARNING_STABILITY_THRESHOLD;
  const unresolvedLapse = card.lapses > 0 && !recoveredFromLapse && (
    card.consecutiveIncorrect > 0 ||
    retrievability < 0.55 ||
    card.stability < LEARNING_STABILITY_THRESHOLD
  );

  if (unresolvedLapse) {
    return 'lapsed';
  }

  if (card.stability >= MASTERED_STABILITY_THRESHOLD && retrievability >= 0.45 && card.consecutiveIncorrect === 0) {
    return 'mastered';
  }

  if (card.stability >= LEARNING_STABILITY_THRESHOLD) {
    return 'reviewing';
  }

  return 'learning';
}

export function getLiveCardStats(stats: CardStats | undefined, now: number = Date.now()): CardStats {
  const migrated = migrateCardStats(stats, now);
  const retrievability = migrated.attempts === 0
    ? 0
    : computeRetrievabilityFromValues(migrated.lastReviewedAt, migrated.stability, now);

  const liveStats: CardStats = {
    ...migrated,
    retrievability,
  };

  return {
    ...liveStats,
    status: deriveCardStatusFromNormalized(liveStats, now),
  };
}

export function computeRetrievability(stats: CardStats | undefined, now: number = Date.now()): number {
  return getLiveCardStats(stats, now).retrievability;
}

export function deriveCardStatus(stats: CardStats | undefined, now: number = Date.now()): CardMemoryStatus {
  const normalized = normalizeCardStats(stats, now);
  return deriveCardStatusFromNormalized(normalized, now);
}

export function getCardMastery(stats: CardStats | undefined, now: number = Date.now()): MasteryStatus {
  return deriveCardStatus(stats, now);
}

export function isCardDue(stats: CardStats | undefined, now: number = Date.now()): boolean {
  const card = getLiveCardStats(stats, now);

  if (card.attempts === 0) {
    return true;
  }

  if (!card.nextReviewAt) {
    return true;
  }

  return now >= card.nextReviewAt;
}

export function isCardDueForReview(stats: CardStats | undefined, now: number = Date.now()): boolean {
  const card = getLiveCardStats(stats, now);

  if (card.attempts === 0) {
    return false;
  }

  if (!card.nextReviewAt) {
    return false;
  }

  return now >= card.nextReviewAt;
}

export function isWeakCard(stats: CardStats | undefined, now: number = Date.now()): boolean {
  const card = getLiveCardStats(stats, now);

  if (card.attempts === 0) {
    return false;
  }

  if (card.status === 'lapsed') {
    return true;
  }

  if (card.nextReviewAt && now >= card.nextReviewAt) {
    return true;
  }

  const weaknessScore = getWeaknessScore(card, now);
  const recentlyRecovered = card.lastReviewedAt !== null
    && (now - card.lastReviewedAt) <= RECENT_WEAK_CARD_RECOVERY_WINDOW_MS
    && card.consecutiveCorrect >= 1
    && card.consecutiveIncorrect === 0
    && (card.incorrect > 0 || card.lapses > 0);

  if (recentlyRecovered) {
    return weaknessScore >= RECENT_WEAK_CARD_RECOVERY_THRESHOLD;
  }

  return weaknessScore >= WEAK_CARD_THRESHOLD;
}

export function getWeaknessScore(stats: CardStats | undefined, now: number = Date.now()): number {
  const card = getLiveCardStats(stats, now);

  if (card.attempts === 0) {
    return 1.2;
  }

  const incorrectRate = card.incorrect / Math.max(card.attempts, 1);
  const duePressure = card.nextReviewAt && now > card.nextReviewAt
    ? clamp((now - card.nextReviewAt) / DAY_IN_MS, 0, 7) * 0.4
    : 0;
  const statusBoost = card.status === 'lapsed'
    ? 4
    : card.status === 'learning'
      ? 1.6
      : card.status === 'reviewing'
        ? 0.8
        : 0;

  return (
    (card.lapses * 3.2) +
    (card.consecutiveIncorrect * 2.1) +
    (card.difficulty * 1.35) +
    ((1 - card.retrievability) * 4.4) +
    (incorrectRate * 2.2) +
    duePressure +
    statusBoost
  );
}

function computeNextIntervalDays(card: CardStats, quality: RecallQuality): number {
  const difficultyPressure = 1 - ((card.difficulty - MIN_DIFFICULTY) / (MAX_DIFFICULTY - MIN_DIFFICULTY)) * 0.18;

  if (quality === 1) {
    const resetInterval = card.stability >= LEARNING_STABILITY_THRESHOLD ? 0.35 : 0.2;
    return clamp(resetInterval, 0.15, 2);
  }

  if (quality === 2) {
    return clamp(card.stability * 0.55 * difficultyPressure, 0.5, 21);
  }

  if (quality === 3) {
    return clamp(card.stability * 0.95 * difficultyPressure, 1, 60);
  }

  return clamp(card.stability * 1.28 * difficultyPressure, 1.5, 120);
}

export function inferRecallQuality(params: InferRecallQualityParams): RecallQuality {
  if (params.manualQuality && params.manualQuality >= 1 && params.manualQuality <= 4) {
    return params.manualQuality;
  }

  if (!params.isCorrect) {
    return 1;
  }

  const timeToAnswerMs = Math.max(0, Math.round(toFiniteNumber(params.timeToAnswerMs, 0)));
  const hintsUsed = Math.max(0, Math.round(toFiniteNumber(params.hintsUsed, 0)));
  const usedSecondChance = Boolean(params.usedSecondChance);
  const explanationOpened = Boolean(params.explanationOpened);

  if (!usedSecondChance && hintsUsed === 0 && !explanationOpened && timeToAnswerMs > 0 && timeToAnswerMs <= 4000) {
    return 4;
  }

  if (usedSecondChance || hintsUsed > 0 || explanationOpened || timeToAnswerMs >= 12000) {
    return 2;
  }

  return 3;
}

export function updateCardMemory(
  existing: CardStats | undefined,
  params: UpdateCardMemoryParams,
): CardStats {
  const now = params.now ?? Date.now();
  const current = getLiveCardStats(existing, now);
  const quality = params.quality;
  const wasStable = current.attempts > 0 && current.stability >= LEARNING_STABILITY_THRESHOLD;
  const shouldCountLapse = quality === 1 && wasStable && current.consecutiveIncorrect === 0;

  let nextStability = current.stability;
  let nextDifficulty = current.difficulty;
  let nextCorrect = current.correct;
  let nextIncorrect = current.incorrect;
  let nextConsecutiveCorrect = current.consecutiveCorrect;
  let nextConsecutiveIncorrect = current.consecutiveIncorrect;
  let nextLapses = current.lapses;

  if (quality === 1) {
    nextIncorrect += 1;
    nextConsecutiveIncorrect += 1;
    nextConsecutiveCorrect = 0;
    nextStability = clamp(current.stability * (wasStable ? 0.45 : 0.6), MIN_STABILITY_DAYS, MAX_STABILITY_DAYS);
    nextDifficulty = clamp(current.difficulty + (wasStable ? 0.45 : 0.28), MIN_DIFFICULTY, MAX_DIFFICULTY);
    if (shouldCountLapse) {
      nextLapses += 1;
    }
  } else {
    const retrievabilityBoost = Math.max(0.85, current.retrievability + 0.2);
    const easeBonus = (MAX_DIFFICULTY - current.difficulty) * 0.05;
    const growthFactor = quality === 4 ? 1.62 : quality === 3 ? 1.36 : 1.14;

    nextCorrect += 1;
    nextConsecutiveCorrect += 1;
    nextConsecutiveIncorrect = 0;

    if (current.attempts === 0) {
      nextStability = quality === 4 ? 1.85 : quality === 3 ? 1.25 : 0.9;
    } else {
      const growth = growthFactor + easeBonus;
      nextStability = clamp(
        Math.max(current.stability + 0.18, current.stability * growth * retrievabilityBoost),
        MIN_STABILITY_DAYS,
        MAX_STABILITY_DAYS,
      );
    }

    nextDifficulty = clamp(
      current.difficulty + (quality === 4 ? -0.24 : quality === 3 ? -0.08 : 0.1),
      MIN_DIFFICULTY,
      MAX_DIFFICULTY,
    );
  }

  const nextAttempts = current.attempts + 1;
  const nextReviewAt = now + (computeNextIntervalDays({
    ...current,
    attempts: nextAttempts,
    correct: nextCorrect,
    incorrect: nextIncorrect,
    consecutiveCorrect: nextConsecutiveCorrect,
    consecutiveIncorrect: nextConsecutiveIncorrect,
    streakCorrect: nextConsecutiveCorrect,
    stability: nextStability,
    difficulty: nextDifficulty,
    retrievability: 1,
    lastReviewedAt: now,
    lastAttemptAt: now,
    nextReviewAt: current.nextReviewAt,
    lapses: nextLapses,
    status: current.status,
  }, quality) * DAY_IN_MS);

  const updated: CardStats = {
    attempts: nextAttempts,
    correct: nextCorrect,
    incorrect: nextIncorrect,
    consecutiveCorrect: nextConsecutiveCorrect,
    consecutiveIncorrect: nextConsecutiveIncorrect,
    streakCorrect: nextConsecutiveCorrect,
    stability: nextStability,
    difficulty: nextDifficulty,
    retrievability: 1,
    lastReviewedAt: now,
    lastAttemptAt: now,
    nextReviewAt,
    lapses: nextLapses,
    status: 'learning',
  };

  return {
    ...updated,
    status: deriveCardStatusFromNormalized(updated, now),
  };
}

export function migrateCardStats(raw: Partial<CardStats> | undefined, now: number = Date.now()): CardStats {
  const normalized = normalizeCardStats(raw, now);
  const migrated: CardStats = {
    ...normalized,
    retrievability: normalized.attempts === 0
      ? 0
      : computeRetrievabilityFromValues(normalized.lastReviewedAt, normalized.stability, now),
  };

  return {
    ...migrated,
    status: deriveCardStatusFromNormalized(migrated, now),
  };
}

export function migrateQuestPerformance(raw: QuestPerformance | undefined, now: number = Date.now()): {
  performance: QuestPerformance;
  didChange: boolean;
} {
  const basePerformance: QuestPerformance = raw ?? {
    cardStatsById: {},
    deckStatsById: {},
    bestQuestStreak: 0,
    lastQuestSettings: undefined,
  };

  let didChange = !raw;
  const nextCardStatsById: Record<string, CardStats> = {};

  for (const [cardId, stats] of Object.entries(basePerformance.cardStatsById ?? {})) {
    const migrated = migrateCardStats(stats, now);
    nextCardStatsById[cardId] = migrated;

    if (JSON.stringify(migrated) !== JSON.stringify(stats)) {
      didChange = true;
    }
  }

  const nextDeckStatsById: Record<string, DeckStats> = {};

  for (const [deckId, stats] of Object.entries(basePerformance.deckStatsById ?? {})) {
    const normalized = normalizeDeckStats(stats);
    if (!normalized) {
      didChange = true;
      continue;
    }

    nextDeckStatsById[deckId] = normalized;

    if (JSON.stringify(normalized) !== JSON.stringify(stats)) {
      didChange = true;
    }
  }

  return {
    performance: {
      cardStatsById: nextCardStatsById,
      deckStatsById: nextDeckStatsById,
      bestQuestStreak: Math.max(0, Math.round(toFiniteNumber(basePerformance.bestQuestStreak, 0))),
      lastQuestSettings: basePerformance.lastQuestSettings,
    },
    didChange,
  };
}

export function computeDeckMastery(
  flashcards: { id: string }[],
  cardStatsById: Record<string, CardStats | undefined>,
): MasteryBreakdown {
  let mastered = 0;
  let reviewing = 0;
  let learning = 0;
  let lapsed = 0;
  let newCards = 0;

  for (const card of flashcards) {
    const status = getCardMastery(cardStatsById[card.id]);

    switch (status) {
      case 'mastered':
        mastered += 1;
        break;
      case 'reviewing':
        reviewing += 1;
        break;
      case 'learning':
        learning += 1;
        break;
      case 'lapsed':
        lapsed += 1;
        break;
      case 'new':
        newCards += 1;
        break;
    }
  }

  return {
    mastered,
    reviewing,
    learning,
    lapsed,
    newCards,
    total: flashcards.length,
  };
}
