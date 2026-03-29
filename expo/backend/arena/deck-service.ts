import {
  ARENA_BACKEND_ERROR_CODES,
  ARENA_OPTION_COUNT,
  MAX_ARENA_DECK_UPLOAD_CARDS,
  MIN_ARENA_READY_CARDS,
  type ArenaDeckPreparationDiagnostics,
  type ArenaDeckPreparationResult,
  type ArenaDeckSourceCard,
  type ArenaPreparedDeck,
  type ArenaQuestionGenerationDiagnostics,
  type ArenaQuestionGenerationResult,
  type ArenaReadyCard,
  type RoomQuestion,
} from './types';
import { createArenaError, createArenaGameGenerationFailedError } from './errors';
import type { Flashcard } from '@/types/flashcard';
import {
  buildDeckNormalizationSummary,
  createFlashcardOption,
  createNormalizedFlashcard,
  getFlashcardContent,
  resolveOptionDisplayCollisions,
} from '@/utils/flashcardContent';
import { recordDeckNormalizationSummary } from '@/utils/flashcardDiagnostics';

interface ArenaDeckRejectionCounts {
  emptyQuestion: number;
  emptyAnswer: number;
  questionTooLong: number;
  answerTooLong: number;
  malformedQuestion: number;
  malformedAnswer: number;
  duplicatePair: number;
}

const EMPTY_REJECTION_COUNTS: ArenaDeckRejectionCounts = {
  emptyQuestion: 0,
  emptyAnswer: 0,
  questionTooLong: 0,
  answerTooLong: 0,
  malformedQuestion: 0,
  malformedAnswer: 0,
  duplicatePair: 0,
};

function getTextEncoderSize(value: unknown): number {
  return new TextEncoder().encode(JSON.stringify(value)).length;
}

function hasMeaningfulCharacters(value: string): boolean {
  return (value.match(/[a-z0-9]/gi)?.length ?? 0) >= 2;
}

function hasTooManyRepeatingCharacters(value: string): boolean {
  const compact = value.toLowerCase().replace(/\s+/g, '');
  if (compact.length < 18) {
    return false;
  }

  const uniqueCharacters = new Set(compact.split(''));
  return uniqueCharacters.size <= 2;
}

function createSeed(input: string): number {
  let hash = 2166136261;

  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function createDeterministicRandom(seedInput: string): () => number {
  let seed = createSeed(seedInput) || 1;

  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

function shuffleWithRandom<T>(items: T[], random: () => number): T[] {
  const nextItems = [...items];

  for (let index = nextItems.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(random() * (index + 1));
    const current = nextItems[index];
    nextItems[index] = nextItems[randomIndex] as T;
    nextItems[randomIndex] = current as T;
  }

  return nextItems;
}

function getUsableArenaCards(cards: ArenaReadyCard[]): ArenaReadyCard[] {
  return cards.filter((card) => {
    const distinctDistractors = new Set(
      cards
        .filter((candidate) => candidate.id !== card.id && candidate.normalizedAnswer !== card.normalizedAnswer)
        .map((candidate) => candidate.normalizedAnswer),
    );

    return distinctDistractors.size >= (ARENA_OPTION_COUNT - 1);
  });
}

function throwDeckPreparationError(options: {
  deckId: string;
  originalCardCount: number;
  validCardCount: number;
  usableCardCount: number;
  distinctAnswerCount: number;
  rejectionCounts: ArenaDeckRejectionCounts;
}): never {
  const meta = {
    deckId: options.deckId,
    originalCardCount: options.originalCardCount,
    validCardCount: options.validCardCount,
    usableCardCount: options.usableCardCount,
    distinctAnswerCount: options.distinctAnswerCount,
    rejectionCounts: options.rejectionCounts,
  };

  if (options.originalCardCount > MAX_ARENA_DECK_UPLOAD_CARDS) {
    throw createArenaError({
      code: ARENA_BACKEND_ERROR_CODES.DECK_UPLOAD_TOO_LARGE,
      userMessage: 'This deck is too large to prepare for battle right now.',
      developerMessage: `Deck ${options.deckId} exceeded the maximum upload size of ${MAX_ARENA_DECK_UPLOAD_CARDS} cards.`,
      trpcCode: 'BAD_REQUEST',
      meta,
    });
  }

  if ((options.rejectionCounts.questionTooLong + options.rejectionCounts.answerTooLong) > 0 && options.validCardCount < MIN_ARENA_READY_CARDS) {
    throw createArenaError({
      code: ARENA_BACKEND_ERROR_CODES.DECK_CONTENT_TOO_LONG,
      userMessage: 'This deck has cards that are still too long or dense for live battle. Shorten the longest cards and try again.',
      developerMessage: `Deck ${options.deckId} did not have enough battle-safe cards after projection validation.`,
      trpcCode: 'BAD_REQUEST',
      meta,
    });
  }

  if ((options.rejectionCounts.emptyQuestion + options.rejectionCounts.emptyAnswer + options.rejectionCounts.malformedQuestion + options.rejectionCounts.malformedAnswer) > 0 && options.validCardCount < MIN_ARENA_READY_CARDS) {
    throw createArenaError({
      code: ARENA_BACKEND_ERROR_CODES.DECK_MALFORMED,
      userMessage: 'This deck has empty or malformed cards that arena cannot use yet. Clean them up and try again.',
      developerMessage: `Deck ${options.deckId} did not have enough usable cards after malformed content filtering.`,
      trpcCode: 'BAD_REQUEST',
      meta,
    });
  }

  if (options.distinctAnswerCount < ARENA_OPTION_COUNT || options.usableCardCount < MIN_ARENA_READY_CARDS) {
    throw createArenaError({
      code: ARENA_BACKEND_ERROR_CODES.NOT_ENOUGH_DISTINCT_ANSWERS,
      userMessage: 'This deck does not have enough distinct answers to build battle multiple-choice rounds.',
      developerMessage: `Deck ${options.deckId} did not have enough distinct answers for arena option generation.`,
      trpcCode: 'BAD_REQUEST',
      meta,
    });
  }

  throw createArenaError({
    code: ARENA_BACKEND_ERROR_CODES.DECK_TOO_FEW_VALID_CARDS,
    userMessage: 'This deck needs at least 4 clean cards before it can be used in battle.',
    developerMessage: `Deck ${options.deckId} had too few valid cards for arena.`,
    trpcCode: 'BAD_REQUEST',
    meta,
  });
}

export function prepareArenaDeck(input: {
  deckId: string;
  deckName: string;
  sourceCards: ArenaDeckSourceCard[];
}): ArenaDeckPreparationResult {
  if (input.sourceCards.length > MAX_ARENA_DECK_UPLOAD_CARDS) {
    throwDeckPreparationError({
      deckId: input.deckId,
      originalCardCount: input.sourceCards.length,
      validCardCount: 0,
      usableCardCount: 0,
      distinctAnswerCount: 0,
      rejectionCounts: { ...EMPTY_REJECTION_COUNTS },
    });
  }

  const rejectionCounts: ArenaDeckRejectionCounts = { ...EMPTY_REJECTION_COUNTS };
  const seenPairs = new Set<string>();
  const readyCards: ArenaReadyCard[] = [];
  const acceptedCards: Flashcard[] = [];

  for (const sourceCard of input.sourceCards) {
    const normalizedCard = createNormalizedFlashcard({
      id: sourceCard.id,
      question: sourceCard.question,
      answer: sourceCard.answer,
      deckId: input.deckId,
      difficulty: 'medium',
      createdAt: Date.now(),
      imageUrl: undefined,
    });
    const content = getFlashcardContent(normalizedCard);

    if (!content.canonicalQuestion) {
      rejectionCounts.emptyQuestion += 1;
      continue;
    }

    if (!content.canonicalAnswer) {
      rejectionCounts.emptyAnswer += 1;
      continue;
    }

    if (!hasMeaningfulCharacters(content.canonicalQuestion) || hasTooManyRepeatingCharacters(content.canonicalQuestion)) {
      rejectionCounts.malformedQuestion += 1;
      continue;
    }

    if (!content.normalizedAnswer || !hasMeaningfulCharacters(content.canonicalAnswer) || hasTooManyRepeatingCharacters(content.canonicalAnswer)) {
      rejectionCounts.malformedAnswer += 1;
      continue;
    }

    if (content.quality.battleQuestion === 'reject') {
      rejectionCounts.questionTooLong += 1;
      continue;
    }

    if (content.quality.battleAnswer === 'reject') {
      rejectionCounts.answerTooLong += 1;
      continue;
    }

    if (content.qualityFlags.includes('question_answer_too_similar')) {
      rejectionCounts.malformedAnswer += 1;
      continue;
    }

    const duplicateKey = `${content.canonicalQuestion.toLowerCase()}::${content.normalizedAnswer}`;
    if (seenPairs.has(duplicateKey)) {
      rejectionCounts.duplicatePair += 1;
      continue;
    }

    seenPairs.add(duplicateKey);
    acceptedCards.push(normalizedCard);
    readyCards.push({
      id: sourceCard.id,
      canonicalQuestion: content.canonicalQuestion,
      canonicalAnswer: content.canonicalAnswer,
      battleQuestion: content.projections.battleQuestion,
      battleAnswer: content.projections.battleAnswer,
      normalizedAnswer: content.normalizedAnswer,
      answerType: content.answerType,
    });
  }

  const distinctAnswerCount = new Set(readyCards.map((card) => card.normalizedAnswer)).size;
  const usableCards = getUsableArenaCards(readyCards);
  const diagnostics: ArenaDeckPreparationDiagnostics = {
    deckId: input.deckId,
    originalCardCount: input.sourceCards.length,
    validCardCount: readyCards.length,
    usableCardCount: usableCards.length,
    distinctAnswerCount,
    approxSerializedBytes: getTextEncoderSize(usableCards),
  };

  recordDeckNormalizationSummary(buildDeckNormalizationSummary({
    deckId: input.deckId,
    flashcards: acceptedCards,
    source: 'arena_prepare',
    originalCardCount: input.sourceCards.length,
    rejectedCount: input.sourceCards.length - acceptedCards.length,
    duplicatePairsRemoved: rejectionCounts.duplicatePair,
    extraReasonCodeCounts: {
      rejected_duplicate: rejectionCounts.duplicatePair,
      rejected_low_fit: rejectionCounts.questionTooLong + rejectionCounts.answerTooLong,
      rejected_display_hostile: rejectionCounts.malformedQuestion + rejectionCounts.malformedAnswer,
    },
  }));

  if (readyCards.length < MIN_ARENA_READY_CARDS || usableCards.length < MIN_ARENA_READY_CARDS || distinctAnswerCount < ARENA_OPTION_COUNT) {
    throwDeckPreparationError({
      deckId: input.deckId,
      originalCardCount: input.sourceCards.length,
      validCardCount: readyCards.length,
      usableCardCount: usableCards.length,
      distinctAnswerCount,
      rejectionCounts,
    });
  }

  const preparedDeck: ArenaPreparedDeck = {
    deckId: input.deckId,
    deckName: input.deckName,
    cards: usableCards,
    syncedAt: Date.now(),
    diagnostics,
  };

  return {
    preparedDeck,
    diagnostics,
  };
}

export function generateArenaQuestions(input: {
  roomCode: string;
  playerId: string;
  preparedDeck: ArenaPreparedDeck;
  requestedRounds: number;
}): ArenaQuestionGenerationResult {
  const availableCards = input.preparedDeck.cards;
  if (availableCards.length < MIN_ARENA_READY_CARDS) {
    throw createArenaGameGenerationFailedError({
      deckId: input.preparedDeck.deckId,
      availableCardCount: availableCards.length,
      diagnostics: input.preparedDeck.diagnostics,
    });
  }

  const roundCount = Math.max(1, Math.min(input.requestedRounds, availableCards.length));
  const deckRandom = createDeterministicRandom(`${input.roomCode}:${input.playerId}:${input.preparedDeck.deckId}:${input.preparedDeck.syncedAt}`);
  const selectedCards = shuffleWithRandom(availableCards, deckRandom).slice(0, roundCount);

  const questions: RoomQuestion[] = selectedCards.map((card, cardIndex) => {
    const distractorRandom = createDeterministicRandom(`${input.roomCode}:${input.preparedDeck.deckId}:${card.id}:${cardIndex}`);
    const distractorPool = shuffleWithRandom(
      availableCards.filter((candidate) => candidate.id !== card.id && candidate.normalizedAnswer !== card.normalizedAnswer),
      distractorRandom,
    );
    const sameTypePool = distractorPool.filter((candidate) => candidate.answerType === card.answerType);
    const candidatePool = sameTypePool.length >= (ARENA_OPTION_COUNT - 1) ? sameTypePool : distractorPool;

    const uniqueDistractors: ArenaReadyCard[] = [];
    const usedAnswers = new Set<string>([card.normalizedAnswer]);

    for (const distractor of candidatePool) {
      if (usedAnswers.has(distractor.normalizedAnswer)) {
        continue;
      }

      uniqueDistractors.push(distractor);
      usedAnswers.add(distractor.normalizedAnswer);

      if (uniqueDistractors.length >= (ARENA_OPTION_COUNT - 1)) {
        break;
      }
    }

    if (uniqueDistractors.length < (ARENA_OPTION_COUNT - 1)) {
      throw createArenaError({
        code: ARENA_BACKEND_ERROR_CODES.NOT_ENOUGH_DISTINCT_ANSWERS,
        userMessage: 'This deck does not have enough distinct answers to build battle multiple-choice rounds.',
        developerMessage: `Arena generation could not find enough distractors for card ${card.id} in deck ${input.preparedDeck.deckId}.`,
        trpcCode: 'BAD_REQUEST',
        meta: {
          deckId: input.preparedDeck.deckId,
          cardId: card.id,
          requestedRounds: input.requestedRounds,
          diagnostics: input.preparedDeck.diagnostics,
        },
      });
    }

    const optionResult = resolveOptionDisplayCollisions({
      options: shuffleWithRandom([
        createFlashcardOption({
          value: card.canonicalAnswer,
          canonicalValue: card.canonicalAnswer,
          question: card.canonicalQuestion,
          answerType: card.answerType,
          sourceCardId: card.id,
          surface: 'battle',
        }),
        ...uniqueDistractors.map((distractor) => createFlashcardOption({
          value: distractor.canonicalAnswer,
          canonicalValue: distractor.canonicalAnswer,
          question: card.canonicalQuestion,
          answerType: distractor.answerType,
          sourceCardId: distractor.id,
          surface: 'battle',
        })),
      ], distractorRandom),
      surface: 'battle',
      source: 'arena_prepare',
      deckId: input.preparedDeck.deckId,
      cardId: card.id,
    });

    return {
      cardId: card.id,
      question: card.battleQuestion,
      correctAnswer: card.canonicalAnswer,
      correctAnswerDisplay: card.battleAnswer,
      normalizedCorrectAnswer: card.normalizedAnswer,
      answerType: card.answerType,
      options: optionResult.options,
    } satisfies RoomQuestion;
  });

  const diagnostics: ArenaQuestionGenerationDiagnostics = {
    deckId: input.preparedDeck.deckId,
    originalCardCount: input.preparedDeck.diagnostics.originalCardCount,
    validCardCount: input.preparedDeck.diagnostics.usableCardCount,
    selectedRoundCount: questions.length,
    distinctAnswerCount: input.preparedDeck.diagnostics.distinctAnswerCount,
    approxSerializedRoomBytes: getTextEncoderSize(questions),
  };

  return {
    questions,
    diagnostics,
  };
}
