import type { Flashcard } from '@/types/flashcard';
import type { CardMemoryStatus, CardStats } from '@/types/performance';
import { getWeaknessScore, getLiveCardStats, isCardDueForReview, isWeakCard } from '@/utils/mastery';

type StudyCardPriority = 'lapsed' | 'due' | 'new' | 'weak' | 'remaining';

export type StudyMode = 'all' | 'due' | 'quick-5' | 'quick-10' | 'quick-15' | 'weak';

export interface StudyOrderSummary {
  lapsedCount: number;
  dueCount: number;
  newCount: number;
  weakCount: number;
}

export interface DeckStudySummary {
  dueCount: number;
  newCount: number;
  lapsedCount: number;
  status: CardMemoryStatus | 'mixed';
}

export function buildStudyOrder(
  flashcards: Flashcard[],
  cardStatsById: Record<string, CardStats>,
): { ordered: Flashcard[]; summary: StudyOrderSummary } {
  const now = Date.now();

  const buckets: Record<StudyCardPriority, { card: Flashcard; sortKey: number }[]> = {
    lapsed: [],
    due: [],
    new: [],
    weak: [],
    remaining: [],
  };

  for (const card of flashcards) {
    const stats = cardStatsById[card.id];
    const live = getLiveCardStats(stats, now);

    if (live.attempts === 0) {
      buckets.new.push({ card, sortKey: 0 });
      continue;
    }

    if (live.status === 'lapsed') {
      buckets.lapsed.push({ card, sortKey: -live.lapses });
      continue;
    }

    if (isCardDueForReview(stats, now)) {
      const overdue = live.nextReviewAt ? now - live.nextReviewAt : 0;
      buckets.due.push({ card, sortKey: -overdue });
      continue;
    }

    if (isWeakCard(stats, now)) {
      buckets.weak.push({ card, sortKey: -getWeaknessScore(stats, now) });
      continue;
    }

    buckets.remaining.push({ card, sortKey: live.retrievability });
  }

  for (const bucket of Object.values(buckets)) {
    bucket.sort((a, b) => a.sortKey - b.sortKey);
  }

  const ordered = [
    ...buckets.lapsed,
    ...buckets.due,
    ...buckets.new,
    ...buckets.weak,
    ...buckets.remaining,
  ].map((entry) => entry.card);

  const summary: StudyOrderSummary = {
    lapsedCount: buckets.lapsed.length,
    dueCount: buckets.due.length,
    newCount: buckets.new.length,
    weakCount: buckets.weak.length,
  };

  return { ordered, summary };
}

export function getDeckStudySummary(
  flashcards: Flashcard[],
  cardStatsById: Record<string, CardStats>,
): DeckStudySummary {
  const now = Date.now();
  let dueCount = 0;
  let newCount = 0;
  let lapsedCount = 0;

  for (const card of flashcards) {
    const stats = cardStatsById[card.id];
    const live = getLiveCardStats(stats, now);

    if (live.attempts === 0) {
      newCount++;
    } else if (live.status === 'lapsed') {
      lapsedCount++;
    } else if (isCardDueForReview(stats, now)) {
      dueCount++;
    }
  }

  const status = lapsedCount > 0 ? 'lapsed'
    : dueCount > 0 ? 'mixed'
    : newCount === flashcards.length ? 'new'
    : 'mixed';

  return { dueCount, newCount, lapsedCount, status };
}

export function getFlashcardsForStudyMode(
  orderedFlashcards: Flashcard[],
  studyMode: StudyMode | null,
  cardStatsById: Record<string, CardStats>,
): Flashcard[] {
  if (!studyMode) {
    return [] as Flashcard[];
  }

  switch (studyMode) {
    case 'all':
      return orderedFlashcards;
    case 'due': {
      const now = Date.now();
      return orderedFlashcards.filter((card) => {
        const stats = cardStatsById[card.id];
        const live = getLiveCardStats(stats, now);
        return live.status === 'lapsed' || isCardDueForReview(stats, now);
      });
    }
    case 'quick-5':
      return orderedFlashcards.slice(0, 5);
    case 'quick-10':
      return orderedFlashcards.slice(0, 10);
    case 'quick-15':
      return orderedFlashcards.slice(0, 15);
    case 'weak': {
      const now = Date.now();
      return orderedFlashcards.filter((card) => {
        const stats = cardStatsById[card.id];
        const live = getLiveCardStats(stats, now);
        if (live.attempts === 0 || live.status === 'lapsed' || isCardDueForReview(stats, now)) {
          return false;
        }
        return isWeakCard(stats, now);
      });
    }
    default:
      return orderedFlashcards;
  }
}
