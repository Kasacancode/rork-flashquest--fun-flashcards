import type { CardStats } from '@/types/performance';

export type MasteryStatus = 'new' | 'learning' | 'reviewing' | 'mastered';

export const MASTERY_THRESHOLDS = {
  mastered: 5,
  reviewing: 3,
} as const;

export function getCardMastery(stats: CardStats | undefined): MasteryStatus {
  if (!stats || stats.attempts === 0) {
    return 'new';
  }

  if (stats.streakCorrect >= MASTERY_THRESHOLDS.mastered) {
    return 'mastered';
  }

  if (stats.streakCorrect >= MASTERY_THRESHOLDS.reviewing) {
    return 'reviewing';
  }

  return 'learning';
}

export interface MasteryBreakdown {
  mastered: number;
  reviewing: number;
  learning: number;
  newCards: number;
  total: number;
}

export function computeDeckMastery(
  flashcards: { id: string }[],
  cardStatsById: Record<string, CardStats | undefined>,
): MasteryBreakdown {
  let mastered = 0;
  let reviewing = 0;
  let learning = 0;
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
      case 'new':
        newCards += 1;
        break;
    }
  }

  return { mastered, reviewing, learning, newCards, total: flashcards.length };
}
