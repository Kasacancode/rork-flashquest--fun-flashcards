import type { Deck, Flashcard } from '@/types/flashcard';
import type { QuestPerformance } from '@/types/performance';
import { getLiveCardStats, isCardDueForReview } from '@/utils/mastery';

export const CROSS_DECK_REVIEW_DECK_ID = '__cross_deck_review__';

export interface CrossDeckReviewDeck extends Deck {
  id: typeof CROSS_DECK_REVIEW_DECK_ID;
}

export function buildCrossDeckReviewDeck(
  decks: Deck[],
  cardStatsById: QuestPerformance['cardStatsById'],
): CrossDeckReviewDeck | null {
  const now = Date.now();
  const dueCards: Flashcard[] = [];

  for (const deck of decks) {
    for (const card of deck.flashcards) {
      const stats = cardStatsById[card.id];
      if (!stats || stats.attempts === 0) {
        continue;
      }

      const live = getLiveCardStats(stats, now);
      if (live.status === 'lapsed' || isCardDueForReview(stats, now)) {
        dueCards.push(card);
      }
    }
  }

  if (dueCards.length === 0) {
    return null;
  }

  return {
    id: CROSS_DECK_REVIEW_DECK_ID,
    name: 'Review All Due Cards',
    description: `${dueCards.length} cards across multiple decks`,
    color: '#6366F1',
    icon: 'rotate-ccw',
    category: 'Review',
    flashcards: dueCards,
    createdAt: now,
    isCustom: false,
  };
}
