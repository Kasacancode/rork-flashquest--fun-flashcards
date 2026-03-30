import { beforeEach, describe, expect, it } from 'bun:test';

import { GOLDEN_DUPLICATE_DECK, GOLDEN_UGLY_GENERATED_DECK } from './fixtures/uglyDecks';
import { buildFlashcardDebugSnapshot } from '../flashcardInspector';
import type { Flashcard } from '@/types/flashcard';

import {
  createFlashcardOption,
  createNormalizedFlashcard,
  getFlashcardContent,
  normalizeFlashcard,
  prepareGeneratedFlashcards,
  resolveOptionDisplayCollisions,
} from '../flashcardContent';
import { clearFlashcardDiagnostics, getFlashcardDiagnosticsState } from '../flashcardDiagnostics';

describe('flashcard content golden ugly-deck coverage', () => {
  beforeEach(() => {
    clearFlashcardDiagnostics();
  });

  it('normalizes ugly generated cards into stable canonical and projection outputs', () => {
    const prepared = prepareGeneratedFlashcards(GOLDEN_UGLY_GENERATED_DECK);

    expect(prepared.flashcards).toHaveLength(5);
    expect(prepared.rejectedCount).toBe(1);
    expect(prepared.duplicateCount).toBe(1);

    const firstCard = prepared.flashcards[0]!;
    const firstContent = getFlashcardContent(firstCard);

    expect({
      canonicalQuestion: firstContent.canonicalQuestion,
      canonicalAnswer: firstContent.canonicalAnswer,
      explanation: firstContent.explanation,
      answerType: firstContent.answerType,
      tileAnswer: firstContent.projections.tileAnswer,
      battleAnswer: firstContent.projections.battleAnswer,
      reasonCodes: [...firstContent.normalization.reasonCodes].sort(),
    }).toEqual({
      canonicalQuestion: 'What process lets plants turn light into stored chemical energy?',
      canonicalAnswer: 'Photosynthesis',
      explanation: 'The process by which plants convert light energy into chemical energy.',
      answerType: 'term',
      tileAnswer: 'Photosynthesis',
      battleAnswer: 'Photosynthesis',
      reasonCodes: [
        'extracted_explanation',
        'normalized_question_punctuation',
        'removed_answer_prefix',
        'removed_question_prefix',
        'trimmed_whitespace',
      ],
    });

    expect(getFlashcardContent(prepared.flashcards[1]!).answerType).toBe('numeric');
    expect(getFlashcardContent(prepared.flashcards[2]!).answerType).toBe('formula');
    expect(getFlashcardContent(prepared.flashcards[4]!).answerType).toBe('binary');

    prepared.flashcards.forEach((card) => {
      const content = getFlashcardContent(card);
      expect(content.projections.tileAnswer.length).toBeLessThanOrEqual(34);
      expect(content.projections.battleAnswer.length).toBeLessThanOrEqual(36);
      expect(content.projections.gameplayQuestion.length).toBeLessThanOrEqual(96);
    });

    const summary = getFlashcardDiagnosticsState().recentDecks[0]!;
    expect({
      source: summary.source,
      acceptedCount: summary.acceptedCount,
      rejectedCount: summary.rejectedCount,
      duplicatePairsRemoved: summary.duplicatePairsRemoved,
      answerTypeDistribution: summary.answerTypeDistribution,
      extractedExplanationCount: summary.reasonCodeCounts.extracted_explanation,
    }).toEqual({
      source: 'text_to_deck',
      acceptedCount: 5,
      rejectedCount: 1,
      duplicatePairsRemoved: 1,
      answerTypeDistribution: {
        term: 2,
        numeric: 1,
        formula: 1,
        binary: 1,
      },
      extractedExplanationCount: 1,
    });
  });

  it('detects exact compact option collisions and falls back to clearer labels', () => {
    const options = [
      createFlashcardOption({ value: 'The French Revolution', canonicalValue: 'The French Revolution', surface: 'tile' }),
      createFlashcardOption({ value: 'French Revolution', canonicalValue: 'French Revolution', surface: 'tile' }),
      createFlashcardOption({ value: 'Industrial Revolution', canonicalValue: 'Industrial Revolution', surface: 'tile' }),
    ];

    const result = resolveOptionDisplayCollisions({
      options,
      surface: 'tile',
      source: 'option_generation',
      deckId: 'collision_deck',
      cardId: 'collision_card',
    });

    expect(result.collisions).toHaveLength(1);
    expect(result.fallbackCount).toBe(1);
    expect(result.options.map((option) => option.displayText)).toEqual([
      'The French Revolution',
      'French Revolution',
      'Industrial Revolution',
    ]);

    const collisionLog = getFlashcardDiagnosticsState().recentOptionCollisions[0]!;
    expect({
      cardId: collisionLog.cardId,
      deckId: collisionLog.deckId,
      surface: collisionLog.surface,
      fallbackCount: collisionLog.fallbackCount,
      collisions: collisionLog.collisions.map((collision) => collision.displayText),
    }).toEqual({
      cardId: 'collision_card',
      deckId: 'collision_deck',
      surface: 'tile',
      fallbackCount: 1,
      collisions: ['French Revolution'],
    });
  });

  it('rebuilds missing normalization metadata from legacy persisted cards without crashing', () => {
    const legacyCard: Flashcard = {
      id: 'legacy_partial_card',
      question: 'Q: What is ATP?',
      answer: 'A: Adenosine triphosphate — the main energy currency of the cell.',
      deckId: 'legacy_partial_deck',
      difficulty: 'medium',
      createdAt: 1,
      content: {
        version: 2,
        canonicalQuestion: 'What is ATP?',
        canonicalAnswer: 'Adenosine triphosphate',
        explanation: 'The main energy currency of the cell.',
      } as unknown as Flashcard['content'],
    };

    const rebuiltContent = getFlashcardContent(legacyCard);
    const normalizedCard = normalizeFlashcard(legacyCard);

    expect({
      rawQuestion: rebuiltContent.normalization.rawQuestion,
      rawAnswer: rebuiltContent.normalization.rawAnswer,
      explanation: rebuiltContent.explanation,
      wasLegacyMigrated: normalizedCard.content?.normalization.wasLegacyMigrated,
      canonicalAnswer: normalizedCard.answer,
    }).toEqual({
      rawQuestion: 'Q: What is ATP?',
      rawAnswer: 'A: Adenosine triphosphate — the main energy currency of the cell.',
      explanation: 'The main energy currency of the cell.',
      wasLegacyMigrated: true,
      canonicalAnswer: 'Adenosine triphosphate',
    });
  });

  it('builds a debug snapshot with raw, canonical, projection, and duplicate metadata', () => {
    const normalizedDeck = GOLDEN_DUPLICATE_DECK.map((card) => createNormalizedFlashcard(card));
    const options = [
      createFlashcardOption({ value: 'Adenosine triphosphate', surface: 'tile' }),
      createFlashcardOption({ value: 'Glucose', surface: 'tile' }),
    ];

    const snapshot = buildFlashcardDebugSnapshot({
      card: normalizedDeck[0]!,
      deckCards: normalizedDeck,
      options,
    });

    expect({
      rawQuestion: snapshot.raw.question,
      rawAnswer: snapshot.raw.answer,
      canonicalAnswer: snapshot.canonical.answer,
      explanation: snapshot.canonical.explanation,
      duplicateCount: snapshot.meta.duplicateCountInDeck,
      duplicateCardIds: snapshot.meta.duplicateCardIds,
      optionValues: snapshot.options.map((option) => ({
        displayText: option.displayText,
        canonicalValue: option.canonicalValue,
        normalizedValue: option.normalizedValue,
      })),
    }).toEqual({
      rawQuestion: 'Q: What is ATP?',
      rawAnswer: 'A: Adenosine triphosphate — the main energy currency of the cell.',
      canonicalAnswer: 'Adenosine triphosphate',
      explanation: 'The main energy currency of the cell.',
      duplicateCount: 1,
      duplicateCardIds: ['dup_2'],
      optionValues: [
        {
          displayText: 'Adenosine triphosphate',
          canonicalValue: 'Adenosine triphosphate',
          normalizedValue: 'adenosine triphosphate',
        },
        {
          displayText: 'Glucose',
          canonicalValue: 'Glucose',
          normalizedValue: 'glucose',
        },
      ],
    });
  });
});
