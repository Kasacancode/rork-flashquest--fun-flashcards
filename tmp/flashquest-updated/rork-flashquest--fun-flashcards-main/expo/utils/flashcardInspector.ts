import type { Flashcard, FlashcardDebugSnapshot, FlashcardOption } from '@/types/flashcard';
import { getFlashcardContent } from '@/utils/flashcardContent';

export function buildFlashcardDebugSnapshot(params: {
  card: Flashcard;
  deckCards?: Flashcard[];
  options?: FlashcardOption[];
}): FlashcardDebugSnapshot {
  const { card, deckCards = [], options = [] } = params;
  const content = getFlashcardContent(card);
  const duplicateCardIds = deckCards
    .filter((candidate) => candidate.id !== card.id)
    .filter((candidate) => {
      const candidateContent = getFlashcardContent(candidate);
      return candidateContent.canonicalQuestion === content.canonicalQuestion
        && candidateContent.normalizedAnswer === content.normalizedAnswer;
    })
    .map((candidate) => candidate.id);

  return {
    cardId: card.id,
    deckId: card.deckId,
    version: content.version,
    raw: {
      question: content.normalization.rawQuestion,
      answer: content.normalization.rawAnswer,
      explanation: content.normalization.rawExplanation,
    },
    canonical: {
      question: content.canonicalQuestion,
      answer: content.canonicalAnswer,
      normalizedAnswer: content.normalizedAnswer,
      explanation: content.explanation,
      answerType: content.answerType,
      fitScore: content.normalization.fitScore,
      qualityFlags: content.qualityFlags,
      reasonCodes: content.normalization.reasonCodes,
    },
    projections: content.projections,
    quality: content.quality,
    options: options.map((option) => ({
      id: option.id,
      displayText: option.displayText,
      canonicalValue: option.canonicalValue,
      normalizedValue: option.normalizedValue,
      answerType: option.answerType,
      sourceCardId: option.sourceCardId,
    })),
    meta: {
      wasLegacyMigrated: content.normalization.wasLegacyMigrated,
      wasCompressed: content.normalization.wasCompressed,
      explanationExtracted: content.normalization.explanationExtracted,
      unchanged: content.normalization.unchanged,
      preservation: (
        content.quality.studyQuestion === 'reject'
        || content.quality.studyAnswer === 'reject'
        || content.quality.gameplayQuestion === 'reject'
        || content.quality.tileAnswer === 'reject'
        || content.quality.battleQuestion === 'reject'
        || content.quality.battleAnswer === 'reject'
      )
        ? 'rejected'
        : 'preserved',
      duplicateCountInDeck: duplicateCardIds.length,
      duplicateCardIds,
    },
  } satisfies FlashcardDebugSnapshot;
}

export function serializeFlashcardDebugSnapshot(snapshot: FlashcardDebugSnapshot): string {
  return JSON.stringify(snapshot, null, 2);
}
