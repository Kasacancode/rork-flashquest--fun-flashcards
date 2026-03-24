import type { Deck, Flashcard } from '@/types/flashcard';
import type { CardStats } from '@/types/performance';
import { computeDeckMastery, type MasteryBreakdown } from '@/utils/mastery';

export interface DeckListSummary {
  deck: Deck;
  mastery: MasteryBreakdown;
  dueCount: number;
  isFullyMastered: boolean;
  masteredPercent: number;
  reviewingPercent: number;
  learningPercent: number;
  lapsedPercent: number;
}

export interface DeckProgressSummary {
  id: string;
  name: string;
  color: string;
  mastered: number;
  total: number;
  pct: number;
}

export interface DeckMasteryOverview {
  mastered: number;
  reviewing: number;
  learning: number;
  lapsed: number;
  newCards: number;
  totalCards: number;
}

export function getAllDeckCards(decks: Deck[]): Flashcard[] {
  return decks.flatMap((deck) => deck.flashcards);
}

export function getTotalCardsOwned(decks: Deck[]): number {
  return getAllDeckCards(decks).length;
}

export function getDeckMasteryOverview(decks: Deck[], cardStatsById: Record<string, CardStats>): DeckMasteryOverview {
  return decks.reduce<DeckMasteryOverview>((accumulator, deck) => {
    const mastery = computeDeckMastery(deck.flashcards, cardStatsById);
    accumulator.totalCards += mastery.total;
    accumulator.mastered += mastery.mastered;
    accumulator.reviewing += mastery.reviewing;
    accumulator.learning += mastery.learning;
    accumulator.lapsed += mastery.lapsed;
    accumulator.newCards += mastery.newCards;
    return accumulator;
  }, {
    totalCards: 0,
    mastered: 0,
    reviewing: 0,
    learning: 0,
    lapsed: 0,
    newCards: 0,
  });
}

export function getDeckProgressSummaries(decks: Deck[], cardStatsById: Record<string, CardStats>): DeckProgressSummary[] {
  return decks.map((deck) => {
    const mastery = computeDeckMastery(deck.flashcards, cardStatsById);

    return {
      id: deck.id,
      name: deck.name,
      color: deck.color,
      mastered: mastery.mastered,
      total: mastery.total,
      pct: mastery.total > 0 ? Math.round((mastery.mastered / mastery.total) * 100) : 0,
    } satisfies DeckProgressSummary;
  });
}

export function getDeckListSummaries(
  decks: Deck[],
  cardStatsById: Record<string, CardStats>,
  getCardsDueForReview: (deckId: string, cards: Flashcard[]) => string[],
): DeckListSummary[] {
  return decks.map((deck) => {
    const mastery = computeDeckMastery(deck.flashcards, cardStatsById);
    const total = Math.max(mastery.total, 1);
    const dueCount = getCardsDueForReview(deck.id, deck.flashcards).length;
    const isFullyMastered = mastery.total > 0 && mastery.mastered === mastery.total;

    return {
      deck,
      mastery,
      dueCount,
      isFullyMastered,
      masteredPercent: (mastery.mastered / total) * 100,
      reviewingPercent: (mastery.reviewing / total) * 100,
      learningPercent: (mastery.learning / total) * 100,
      lapsedPercent: (mastery.lapsed / total) * 100,
    } satisfies DeckListSummary;
  });
}
