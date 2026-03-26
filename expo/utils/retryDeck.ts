import type { Deck, Flashcard } from '@/types/flashcard';
import { generateUUID } from '@/utils/uuid';

export function createRetryDeck(params: {
  sourceDeckName: string;
  sourceDeckDescription?: string;
  cards: Array<Pick<Flashcard, 'question' | 'answer' | 'hint1' | 'hint2' | 'explanation'>>;
  category?: string;
}): Deck {
  const timestamp = Date.now();
  const deckId = `retry_${timestamp}`;
  const sourceName = params.sourceDeckName.trim() || 'Study Deck';
  const name = `${sourceName} · Retry Missed`;

  const flashcards: Flashcard[] = params.cards.map((card) => ({
    id: generateUUID(),
    deckId,
    question: card.question.trim(),
    answer: card.answer.trim(),
    hint1: card.hint1,
    hint2: card.hint2,
    explanation: card.explanation,
    difficulty: 'medium',
    createdAt: timestamp,
  }));

  return {
    id: deckId,
    name,
    description: params.sourceDeckDescription?.trim() || 'A focused retry deck made from cards you missed.',
    color: '#F97316',
    icon: 'target',
    category: params.category?.trim() || 'Retry Missed',
    flashcards,
    isCustom: true,
    createdAt: timestamp,
  };
}
