import type { Deck, Flashcard } from '@/types/flashcard';
import { createNormalizedFlashcard, normalizeDeck } from '@/utils/flashcardContent';
import { isRecord, safeParseJsonOrNull } from '@/utils/safeJson';

interface ImportedFlashcard {
  question?: unknown;
  answer?: unknown;
}

interface ImportedDeckPayload {
  _type?: unknown;
  name?: unknown;
  description?: unknown;
  color?: unknown;
  category?: unknown;
  flashcards?: ImportedFlashcard[];
}

export interface ImportedDeckResult {
  deck: Deck;
  cardCount: number;
}

function normalizeImportedDeckPayload(value: unknown): ImportedDeckPayload | null {
  if (!isRecord(value)) {
    return null;
  }

  return value as ImportedDeckPayload;
}

function getStringValue(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

export function importDeckFromClipboardText(text: string): ImportedDeckResult | null {
  if (!text.trim() || text.length > 500000) {
    return null;
  }

  const data = safeParseJsonOrNull<ImportedDeckPayload>({
    raw: text,
    label: 'deck import payload',
    normalize: normalizeImportedDeckPayload,
  });

  if (!data || data._type !== 'flashquest_deck' || typeof data.name !== 'string' || !Array.isArray(data.flashcards) || data.flashcards.length === 0) {
    return null;
  }

  const newDeckId = `deck_${Date.now()}`;
  const createdAt = Date.now();
  const flashcards: Flashcard[] = data.flashcards
    .map((card, index) => createNormalizedFlashcard({
      id: `import_${newDeckId}_${index}`,
      question: getStringValue(card.question, '').slice(0, 500),
      answer: getStringValue(card.answer, '').slice(0, 200),
      deckId: newDeckId,
      difficulty: 'medium' as const,
      createdAt,
      imageUrl: undefined,
    }))
    .filter((card) => card.question.trim().length > 0 && card.answer.trim().length > 0);

  if (flashcards.length === 0) {
    return null;
  }

  const deck = normalizeDeck({
    id: newDeckId,
    name: data.name.slice(0, 100),
    description: getStringValue(data.description, 'Imported deck').slice(0, 200),
    color: typeof data.color === 'string' ? data.color : '#667EEA',
    icon: 'download',
    category: getStringValue(data.category, 'Imported').slice(0, 30),
    flashcards,
    isCustom: true,
    createdAt,
  } satisfies Deck, {
    source: 'import',
    trackDiagnostics: true,
  });

  return {
    deck,
    cardCount: deck.flashcards.length,
  };
}
