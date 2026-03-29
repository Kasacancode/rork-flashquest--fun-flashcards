import type {
  Deck,
  Flashcard,
  FlashcardAnswerType,
  FlashcardContentModel,
  FlashcardFitStatus,
  FlashcardOption,
  FlashcardProjectionQuality,
  FlashcardProjectionSet,
} from '@/types/flashcard';
import { logger } from '@/utils/logger';

const CARD_CONTENT_VERSION = 2;
const MARKDOWN_DECORATION_REGEX = /[*_`>#~]+/g;
const BULLET_PREFIX_REGEX = /^\s*(?:[-•–—*]|\d+[.)]|[A-Za-z][.)])\s+/;
const QUESTION_PREFIX_REGEX = /^\s*(?:q(?:uestion)?|prompt|front)\s*[:.-]\s*/i;
const ANSWER_PREFIX_REGEX = /^\s*(?:a(?:nswer)?|back|response|correct answer)\s*[:.-]\s*/i;
const LEADING_FILLER_REGEX = /^\s*(?:the answer is|it is|it's|this is|these are|they are|it refers to|refers to|defined as)\s+/i;
const TRAILING_PUNCTUATION_REGEX = /[\s.;:!?]+$/g;
const LEADING_WRAPPER_REGEX = /^["'“”‘’([{\s]+/g;
const TRAILING_WRAPPER_REGEX = /["'“”‘’)]}\s]+$/g;
const MULTI_SPACE_REGEX = /\s+/g;
const EXPLANATION_SPLIT_REGEXES = [
  /\s+[—-]\s+/,
  /\s*[:;]\s+/,
  /\.\s+/,
  /\s+because\s+/i,
  /\s+which\s+/i,
  /\s+meaning\s+/i,
  /\s+i\.e\.\s+/i,
  /\s+e\.g\.\s+/i,
] as const;

type ProjectionSurface = keyof FlashcardProjectionSet;
type OptionSurface = 'tile' | 'battle' | 'study';

type SurfaceRule = {
  maxChars: number;
  maxWords: number;
  maxLongestToken: number;
  maxPunctuationDensity: number;
  maxParenthesisDensity: number;
  approxCharsPerLine: number;
  maxLines: number;
  rejectMultiplier: number;
};

type TextProfile = {
  charCount: number;
  wordCount: number;
  longestTokenLength: number;
  punctuationDensity: number;
  parenthesisDensity: number;
  symbolDensity: number;
  estimatedLines: number;
};

const SURFACE_RULES: Record<ProjectionSurface, SurfaceRule> = {
  studyQuestion: {
    maxChars: 220,
    maxWords: 34,
    maxLongestToken: 30,
    maxPunctuationDensity: 0.22,
    maxParenthesisDensity: 0.12,
    approxCharsPerLine: 34,
    maxLines: 5,
    rejectMultiplier: 1.9,
  },
  studyAnswer: {
    maxChars: 220,
    maxWords: 34,
    maxLongestToken: 28,
    maxPunctuationDensity: 0.2,
    maxParenthesisDensity: 0.12,
    approxCharsPerLine: 32,
    maxLines: 5,
    rejectMultiplier: 1.9,
  },
  gameplayQuestion: {
    maxChars: 96,
    maxWords: 18,
    maxLongestToken: 19,
    maxPunctuationDensity: 0.16,
    maxParenthesisDensity: 0.08,
    approxCharsPerLine: 22,
    maxLines: 3,
    rejectMultiplier: 1.65,
  },
  tileAnswer: {
    maxChars: 34,
    maxWords: 6,
    maxLongestToken: 17,
    maxPunctuationDensity: 0.14,
    maxParenthesisDensity: 0.06,
    approxCharsPerLine: 16,
    maxLines: 2,
    rejectMultiplier: 1.5,
  },
  battleQuestion: {
    maxChars: 108,
    maxWords: 20,
    maxLongestToken: 20,
    maxPunctuationDensity: 0.16,
    maxParenthesisDensity: 0.08,
    approxCharsPerLine: 24,
    maxLines: 3,
    rejectMultiplier: 1.65,
  },
  battleAnswer: {
    maxChars: 36,
    maxWords: 6,
    maxLongestToken: 18,
    maxPunctuationDensity: 0.14,
    maxParenthesisDensity: 0.06,
    approxCharsPerLine: 16,
    maxLines: 2,
    rejectMultiplier: 1.5,
  },
};

function stripControlCharacters(value: string): string {
  let result = '';

  for (const character of value) {
    const code = character.charCodeAt(0);
    result += (code <= 31 || code === 127) ? ' ' : character;
  }

  return result;
}

function collapseWhitespace(value: string): string {
  return stripControlCharacters(value).replace(MULTI_SPACE_REGEX, ' ').trim();
}

function stripWrappers(value: string): string {
  return value.replace(LEADING_WRAPPER_REGEX, '').replace(TRAILING_WRAPPER_REGEX, '').trim();
}

function stripMarkdownArtifacts(value: string): string {
  return value
    .replace(MARKDOWN_DECORATION_REGEX, ' ')
    .replace(/\[(.*?)\]\((.*?)\)/g, '$1')
    .replace(/\|/g, ' ')
    .replace(/_{2,}/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function stripListPrefix(value: string): string {
  return value.replace(BULLET_PREFIX_REGEX, '').trim();
}

function trimAtWordBoundary(value: string, maxChars: number): string {
  if (value.length <= maxChars) {
    return value;
  }

  const slice = value.slice(0, maxChars + 1);
  const lastSpace = slice.lastIndexOf(' ');
  const cutIndex = lastSpace > Math.floor(maxChars * 0.58) ? lastSpace : maxChars;
  return slice.slice(0, cutIndex).trim();
}

function takeEarlierClause(value: string, tokens: readonly string[], minIndex: number = 16): string {
  for (const token of tokens) {
    const index = value.indexOf(token);
    if (index > minIndex) {
      return value.slice(0, index).trim();
    }
  }

  return value;
}

function normalizeBaseText(value: string): string {
  return collapseWhitespace(stripWrappers(stripListPrefix(stripMarkdownArtifacts(value))));
}

function normalizeQuestionBase(value: string): string {
  return normalizeBaseText(value)
    .replace(QUESTION_PREFIX_REGEX, '')
    .replace(/^according to (?:the notes|the text|the passage)[,:]?\s*/i, '')
    .replace(/^from the notes[,:]?\s*/i, '')
    .replace(/^based on (?:the notes|the text)[,:]?\s*/i, '')
    .replace(/^which one of the following\s+/i, 'Which ')
    .replace(/^which of the following\s+/i, 'Which ')
    .replace(/^select the\s+/i, 'Select the ')
    .replace(/^choose the\s+/i, 'Choose the ')
    .replace(/^identify the\s+/i, 'Identify the ')
    .replace(/\s+(?:choose|select|pick) the correct answer$/i, '')
    .replace(TRAILING_PUNCTUATION_REGEX, '')
    .trim();
}

function normalizeAnswerBase(value: string): string {
  return normalizeBaseText(value)
    .replace(ANSWER_PREFIX_REGEX, '')
    .replace(LEADING_FILLER_REGEX, '')
    .trim();
}

function sentenceCaseFirstLetter(value: string): string {
  if (!value) {
    return value;
  }

  return value[0]!.toUpperCase() + value.slice(1);
}

function ensureQuestionPunctuation(value: string): string {
  if (!value) {
    return value;
  }

  return /[?!]$/.test(value) ? value : `${value}?`;
}

function normalizeComparableAnswerInternal(value: string): string {
  return normalizeBaseText(value)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9+\-/.%\s]/g, ' ')
    .replace(MULTI_SPACE_REGEX, ' ')
    .trim();
}

function getTextProfile(value: string, rule: SurfaceRule): TextProfile {
  const cleaned = collapseWhitespace(value);
  const tokens = cleaned.split(/\s+/).filter(Boolean);
  const punctuationCount = (cleaned.match(/[,:;.!?()[\]{}\\%&+*=<>-]/g)?.length ?? 0);
  const parenthesisCount = (cleaned.match(/[[\](){}]/g)?.length ?? 0);
  const symbolCount = (cleaned.match(/[^A-Za-z0-9\s]/g)?.length ?? 0);

  return {
    charCount: cleaned.length,
    wordCount: tokens.length,
    longestTokenLength: tokens.reduce((longest, token) => Math.max(longest, token.length), 0),
    punctuationDensity: cleaned.length > 0 ? punctuationCount / cleaned.length : 0,
    parenthesisDensity: cleaned.length > 0 ? parenthesisCount / cleaned.length : 0,
    symbolDensity: cleaned.length > 0 ? symbolCount / cleaned.length : 0,
    estimatedLines: cleaned.length > 0 ? Math.ceil(cleaned.length / rule.approxCharsPerLine) : 0,
  };
}

function getFitStatus(value: string, surface: ProjectionSurface): FlashcardFitStatus {
  const rule = SURFACE_RULES[surface];
  const profile = getTextProfile(value, rule);

  const isReject = profile.charCount > Math.round(rule.maxChars * rule.rejectMultiplier)
    || profile.wordCount > Math.round(rule.maxWords * rule.rejectMultiplier)
    || profile.longestTokenLength > Math.round(rule.maxLongestToken * 1.45)
    || profile.punctuationDensity > rule.maxPunctuationDensity * 1.65
    || profile.parenthesisDensity > rule.maxParenthesisDensity * 1.8
    || profile.symbolDensity > 0.42
    || profile.estimatedLines > Math.max(rule.maxLines + 2, Math.round(rule.maxLines * 1.75));

  if (isReject) {
    return 'reject';
  }

  const isCompress = profile.charCount > rule.maxChars
    || profile.wordCount > rule.maxWords
    || profile.longestTokenLength > rule.maxLongestToken
    || profile.punctuationDensity > rule.maxPunctuationDensity
    || profile.parenthesisDensity > rule.maxParenthesisDensity
    || profile.estimatedLines > rule.maxLines;

  return isCompress ? 'compress' : 'safe';
}

function compactNumericAnswer(value: string): string {
  const numericMatch = value.match(/[+-]?\d+(?:[.,/]\d+)*(?:\s?(?:%|°[CF]?|km|m|cm|mm|kg|g|mg|s|ms|Hz|kHz|MHz|GHz|mol|L|mL|J|N|Pa|V|W|A))?/i);
  return numericMatch?.[0]?.trim() ?? value;
}

function compactFormulaAnswer(value: string): string {
  return value
    .replace(/\s*([=+\-*/<>≤≥≈])\s*/g, ' $1 ')
    .replace(/\s+/g, ' ')
    .trim();
}

function compactBinaryAnswer(value: string): string {
  const normalized = value.toLowerCase();
  if (normalized.startsWith('true')) return 'True';
  if (normalized.startsWith('false')) return 'False';
  if (normalized.startsWith('yes')) return 'Yes';
  if (normalized.startsWith('no')) return 'No';
  return sentenceCaseFirstLetter(trimAtWordBoundary(value, 12));
}

function compactPhraseAnswer(value: string): string {
  let concise = value
    .replace(/^an?\s+/i, '')
    .replace(/^the\s+/i, '')
    .replace(/^a\s+/i, '')
    .replace(/^used to\s+/i, '')
    .replace(/^that\s+/i, '')
    .replace(/^which\s+/i, '')
    .replace(/^who\s+/i, '')
    .replace(/^where\s+/i, '')
    .replace(/^when\s+/i, '')
    .replace(/^is\s+/i, '')
    .replace(/^are\s+/i, '')
    .replace(/^was\s+/i, '')
    .replace(/^were\s+/i, '')
    .trim();

  concise = concise
    .replace(/\s+(?:that|which|who|where|when|because)\s+.*$/i, '')
    .replace(/\s+(?:used to|known for|defined by|characterized by)\s+.*$/i, '')
    .trim();

  concise = takeEarlierClause(concise, ['; ', ' — ', ' - ', ': ', ', ', '. '], 10);
  return concise;
}

function compactAnswerForType(value: string, answerType: FlashcardAnswerType, maxChars: number): string {
  let concise = value;

  if (answerType === 'numeric') {
    concise = compactNumericAnswer(value);
  } else if (answerType === 'formula') {
    concise = compactFormulaAnswer(value);
  } else if (answerType === 'binary') {
    concise = compactBinaryAnswer(value);
  } else {
    concise = compactPhraseAnswer(value);
  }

  concise = concise.replace(TRAILING_PUNCTUATION_REGEX, '').trim();

  if (concise.length > maxChars) {
    concise = takeEarlierClause(concise, ['; ', ' — ', ' - ', ': ', ', ', '. '], 10);
  }

  if (concise.length > maxChars) {
    concise = trimAtWordBoundary(concise, maxChars);
  }

  if (!concise) {
    concise = trimAtWordBoundary(value, maxChars);
  }

  return sentenceCaseFirstLetter(concise.trim());
}

function compactQuestionForSurface(question: string, maxChars: number): string {
  let concise = normalizeQuestionBase(question)
    .replace(/^in the context of\s+/i, '')
    .replace(/^for the following scenario[,:]?\s*/i, '')
    .replace(/^from these notes[,:]?\s*/i, '')
    .trim();

  concise = takeEarlierClause(concise, ['. ', '; ', ' — ', ' - ', ': '], 18);
  concise = trimAtWordBoundary(concise, maxChars).replace(TRAILING_PUNCTUATION_REGEX, '').trim();
  return ensureQuestionPunctuation(sentenceCaseFirstLetter(concise));
}

function extractExplanation(answer: string, existingExplanation?: string): { cleanedAnswer: string; explanation?: string } {
  const normalizedExplanation = normalizeBaseText(existingExplanation ?? '');
  if (normalizedExplanation) {
    return {
      cleanedAnswer: answer,
      explanation: normalizedExplanation,
    };
  }

  for (const regex of EXPLANATION_SPLIT_REGEXES) {
    const parts = answer.split(regex);
    if (parts.length < 2) {
      continue;
    }

    const head = normalizeAnswerBase(parts[0] ?? '');
    const tail = normalizeBaseText(parts.slice(1).join(' '));
    if (head.length >= 2 && head.length <= 90 && tail.length >= 18) {
      return {
        cleanedAnswer: head,
        explanation: sentenceCaseFirstLetter(tail),
      };
    }
  }

  return { cleanedAnswer: answer };
}

function buildCanonicalQuestion(value: string): string {
  const normalized = normalizeQuestionBase(value);
  const trimmed = trimAtWordBoundary(normalized, 240).replace(TRAILING_PUNCTUATION_REGEX, '').trim();
  return ensureQuestionPunctuation(sentenceCaseFirstLetter(trimmed));
}

function buildCanonicalAnswer(value: string): string {
  const normalized = normalizeAnswerBase(value);
  const trimmed = trimAtWordBoundary(normalized, 220).replace(TRAILING_PUNCTUATION_REGEX, '').trim();
  return sentenceCaseFirstLetter(trimmed);
}

function inferAnswerTypeInternal(question: string, answer: string): FlashcardAnswerType {
  const normalizedQuestion = normalizeQuestionBase(question).toLowerCase();
  const normalizedAnswer = normalizeAnswerBase(answer);
  const lowerAnswer = normalizedAnswer.toLowerCase();
  const wordCount = normalizedAnswer.split(/\s+/).filter(Boolean).length;

  if (/^(?:yes|no|true|false)$/i.test(lowerAnswer)) {
    return 'binary';
  }

  if (/^[+-]?\d+(?:[.,/]\d+)*(?:\s?(?:%|°[CF]?|km|m|cm|mm|kg|g|mg|s|ms|hz|khz|mhz|ghz|mol|l|ml|j|n|pa|v|w|a))?$/i.test(normalizedAnswer)) {
    return 'numeric';
  }

  if (/[=+\-*/<>≤≥≈]/.test(normalizedAnswer) || /[A-Z][a-z]?\d/.test(normalizedAnswer)) {
    return 'formula';
  }

  if (/\b(vs\.?|compared to|greater than|less than|higher than|lower than|difference between)\b/i.test(normalizedAnswer + ' ' + normalizedQuestion)) {
    return 'comparison';
  }

  if (/\b(process|cycle|sequence|steps|method|procedure|pathway|series)\b/i.test(normalizedAnswer)
    || /^(?:how|why)\b/.test(normalizedQuestion)) {
    return 'process';
  }

  if (wordCount <= 3) {
    return 'term';
  }

  if (wordCount <= 6 && !/[,.!?;]/.test(normalizedAnswer)) {
    return 'concept_label';
  }

  if (/^(?:an?|the)\s+/i.test(normalizedAnswer)
    || /\brefers to\b/i.test(lowerAnswer)
    || /\bdefined as\b/i.test(lowerAnswer)
    || wordCount >= 9) {
    return 'definition';
  }

  return 'phrase';
}

function createProjectionValue(options: {
  original: string;
  compressed: string;
  surface: ProjectionSurface;
  fallbackMaxChars: number;
}): { value: string; status: FlashcardFitStatus } {
  const originalStatus = getFitStatus(options.original, options.surface);
  if (originalStatus === 'safe') {
    return { value: options.original, status: 'safe' };
  }

  let projected = options.compressed.trim() || options.original;
  let projectedStatus = getFitStatus(projected, options.surface);

  if (projectedStatus === 'reject') {
    projected = trimAtWordBoundary(projected, options.fallbackMaxChars);
    projectedStatus = getFitStatus(projected, options.surface);
  }

  return {
    value: projected,
    status: projectedStatus === 'safe' ? 'compress' : projectedStatus,
  };
}

function buildProjectionSet(canonicalQuestion: string, canonicalAnswer: string, answerType: FlashcardAnswerType): {
  projections: FlashcardProjectionSet;
  quality: FlashcardProjectionQuality;
} {
  const studyQuestion = createProjectionValue({
    original: canonicalQuestion,
    compressed: trimAtWordBoundary(canonicalQuestion, SURFACE_RULES.studyQuestion.maxChars),
    surface: 'studyQuestion',
    fallbackMaxChars: SURFACE_RULES.studyQuestion.maxChars,
  });

  const studyAnswer = createProjectionValue({
    original: canonicalAnswer,
    compressed: compactAnswerForType(canonicalAnswer, answerType, SURFACE_RULES.studyAnswer.maxChars),
    surface: 'studyAnswer',
    fallbackMaxChars: SURFACE_RULES.studyAnswer.maxChars,
  });

  const gameplayQuestion = createProjectionValue({
    original: canonicalQuestion,
    compressed: compactQuestionForSurface(canonicalQuestion, SURFACE_RULES.gameplayQuestion.maxChars),
    surface: 'gameplayQuestion',
    fallbackMaxChars: SURFACE_RULES.gameplayQuestion.maxChars,
  });

  const tileAnswer = createProjectionValue({
    original: canonicalAnswer,
    compressed: compactAnswerForType(canonicalAnswer, answerType, SURFACE_RULES.tileAnswer.maxChars),
    surface: 'tileAnswer',
    fallbackMaxChars: SURFACE_RULES.tileAnswer.maxChars,
  });

  const battleQuestion = createProjectionValue({
    original: canonicalQuestion,
    compressed: compactQuestionForSurface(canonicalQuestion, SURFACE_RULES.battleQuestion.maxChars),
    surface: 'battleQuestion',
    fallbackMaxChars: SURFACE_RULES.battleQuestion.maxChars,
  });

  const battleAnswer = createProjectionValue({
    original: canonicalAnswer,
    compressed: compactAnswerForType(canonicalAnswer, answerType, SURFACE_RULES.battleAnswer.maxChars),
    surface: 'battleAnswer',
    fallbackMaxChars: SURFACE_RULES.battleAnswer.maxChars,
  });

  return {
    projections: {
      studyQuestion: studyQuestion.value,
      studyAnswer: studyAnswer.value,
      gameplayQuestion: gameplayQuestion.value,
      tileAnswer: tileAnswer.value,
      battleQuestion: battleQuestion.value,
      battleAnswer: battleAnswer.value,
    },
    quality: {
      studyAnswer: studyAnswer.status,
      gameplayQuestion: gameplayQuestion.status,
      tileAnswer: tileAnswer.status,
      battleQuestion: battleQuestion.status,
      battleAnswer: battleAnswer.status,
    },
  };
}

function buildQualityFlags(params: {
  canonicalQuestion: string;
  canonicalAnswer: string;
  normalizedAnswer: string;
  quality: FlashcardProjectionQuality;
  explanation?: string;
}): string[] {
  const flags = new Set<string>();
  const normalizedQuestion = normalizeComparableAnswerInternal(params.canonicalQuestion);

  if (!params.canonicalQuestion) {
    flags.add('empty_question');
  }

  if (!params.canonicalAnswer) {
    flags.add('empty_answer');
  }

  if (!params.normalizedAnswer) {
    flags.add('empty_normalized_answer');
  }

  if (normalizedQuestion && params.normalizedAnswer && (normalizedQuestion === params.normalizedAnswer || normalizedQuestion.includes(params.normalizedAnswer) || params.normalizedAnswer.includes(normalizedQuestion))) {
    flags.add('question_answer_too_similar');
  }

  if (params.canonicalAnswer.split(/\s+/).filter(Boolean).length >= 14) {
    flags.add('answer_rambling');
  }

  if (/[•*_`#]/.test(params.canonicalQuestion) || /[•*_`#]/.test(params.canonicalAnswer)) {
    flags.add('markdown_artifacts');
  }

  if (params.quality.tileAnswer === 'reject') {
    flags.add('tile_answer_reject');
  }

  if (params.quality.battleAnswer === 'reject') {
    flags.add('battle_answer_reject');
  }

  if (params.quality.gameplayQuestion === 'reject') {
    flags.add('gameplay_question_reject');
  }

  if (params.explanation && params.explanation.length > 220) {
    flags.add('long_explanation');
  }

  return Array.from(flags);
}

function buildContentModel(input: {
  question: string;
  answer: string;
  explanation?: string;
}): FlashcardContentModel {
  const canonicalQuestion = buildCanonicalQuestion(input.question);
  const extracted = extractExplanation(normalizeAnswerBase(input.answer), input.explanation);
  const canonicalAnswer = buildCanonicalAnswer(extracted.cleanedAnswer);
  const explanation = extracted.explanation ? sentenceCaseFirstLetter(trimAtWordBoundary(extracted.explanation, 280)) : undefined;
  const answerType = inferAnswerTypeInternal(canonicalQuestion, canonicalAnswer);
  const normalizedAnswer = normalizeComparableAnswerInternal(canonicalAnswer);
  const { projections, quality } = buildProjectionSet(canonicalQuestion, canonicalAnswer, answerType);
  const qualityFlags = buildQualityFlags({
    canonicalQuestion,
    canonicalAnswer,
    normalizedAnswer,
    quality,
    explanation,
  });

  return {
    version: CARD_CONTENT_VERSION,
    canonicalQuestion,
    canonicalAnswer,
    normalizedAnswer,
    answerType,
    projections,
    quality,
    qualityFlags,
  } satisfies FlashcardContentModel;
}

export function normalizeComparableAnswer(value: string): string {
  return normalizeComparableAnswerInternal(value);
}

export function compareAnswerValues(left: string, right: string): boolean {
  return normalizeComparableAnswerInternal(left) === normalizeComparableAnswerInternal(right);
}

export function inferAnswerType(question: string, answer: string): FlashcardAnswerType {
  return inferAnswerTypeInternal(question, answer);
}

export function getFlashcardContent(card: Flashcard): FlashcardContentModel {
  const nextContent = buildContentModel({
    question: card.content?.canonicalQuestion ?? card.question,
    answer: card.content?.canonicalAnswer ?? card.answer,
    explanation: card.explanation,
  });

  return nextContent;
}

export function normalizeFlashcard(card: Flashcard): Flashcard {
  const content = getFlashcardContent(card);
  return {
    ...card,
    question: content.canonicalQuestion,
    answer: content.canonicalAnswer,
    explanation: card.explanation ? sentenceCaseFirstLetter(trimAtWordBoundary(normalizeBaseText(card.explanation), 280)) : undefined,
    content,
  } satisfies Flashcard;
}

export function mergeFlashcardUpdates(card: Flashcard, updates: Partial<Flashcard>): Flashcard {
  return normalizeFlashcard({
    ...card,
    ...updates,
    content: updates.content ?? card.content,
  });
}

export function normalizeDeck(deck: Deck): Deck {
  return {
    ...deck,
    flashcards: deck.flashcards.map((card) => normalizeFlashcard(card)),
  } satisfies Deck;
}

export function normalizeDeckCollection(decks: Deck[]): { decks: Deck[]; didChange: boolean } {
  let didChange = false;
  const normalizedDecks = decks.map((deck) => {
    const normalizedDeck = normalizeDeck(deck);
    if (JSON.stringify(deck) !== JSON.stringify(normalizedDeck)) {
      didChange = true;
    }
    return normalizedDeck;
  });

  return { decks: normalizedDecks, didChange };
}

export function createNormalizedFlashcard(input: Omit<Flashcard, 'content'>): Flashcard {
  return normalizeFlashcard({
    ...input,
    content: undefined,
  });
}

export function getCardQuestionForSurface(card: Flashcard, surface: 'study' | 'quest' | 'battle'): string {
  const content = getFlashcardContent(card);
  if (surface === 'study') {
    return content.projections.studyQuestion;
  }

  if (surface === 'battle') {
    return content.projections.battleQuestion;
  }

  return content.projections.gameplayQuestion;
}

export function getCardAnswerForSurface(card: Flashcard, surface: 'study' | 'tile' | 'battle'): string {
  const content = getFlashcardContent(card);
  if (surface === 'study') {
    return content.projections.studyAnswer;
  }

  if (surface === 'battle') {
    return content.projections.battleAnswer;
  }

  return content.projections.tileAnswer;
}

export function getCanonicalQuestion(card: Flashcard): string {
  return getFlashcardContent(card).canonicalQuestion;
}

export function getCanonicalAnswer(card: Flashcard): string {
  return getFlashcardContent(card).canonicalAnswer;
}

export function getNormalizedAnswerValue(cardOrAnswer: Flashcard | string): string {
  if (typeof cardOrAnswer === 'string') {
    return normalizeComparableAnswerInternal(cardOrAnswer);
  }

  return getFlashcardContent(cardOrAnswer).normalizedAnswer;
}

function createOptionId(value: string, sourceCardId?: string): string {
  const base = `${sourceCardId ?? 'option'}:${normalizeComparableAnswerInternal(value)}`;
  let hash = 0;
  for (let index = 0; index < base.length; index += 1) {
    hash = ((hash << 5) - hash) + base.charCodeAt(index);
    hash |= 0;
  }
  return `option_${Math.abs(hash)}`;
}

export function createFlashcardOption(params: {
  value: string;
  canonicalValue?: string;
  answerType?: FlashcardAnswerType;
  sourceCardId?: string;
  surface?: OptionSurface;
  question?: string;
}): FlashcardOption {
  const canonicalValue = buildCanonicalAnswer(params.canonicalValue ?? params.value);
  const answerType = params.answerType ?? inferAnswerTypeInternal(params.question ?? '', canonicalValue);
  const surface = params.surface ?? 'tile';
  const displayText = surface === 'study'
    ? compactAnswerForType(canonicalValue, answerType, SURFACE_RULES.studyAnswer.maxChars)
    : surface === 'battle'
      ? compactAnswerForType(canonicalValue, answerType, SURFACE_RULES.battleAnswer.maxChars)
      : compactAnswerForType(canonicalValue, answerType, SURFACE_RULES.tileAnswer.maxChars);

  return {
    id: createOptionId(canonicalValue, params.sourceCardId),
    displayText,
    canonicalValue,
    normalizedValue: normalizeComparableAnswerInternal(canonicalValue),
    answerType,
    sourceCardId: params.sourceCardId,
  } satisfies FlashcardOption;
}

export function createFlashcardOptionFromCard(card: Flashcard, surface: OptionSurface = 'tile'): FlashcardOption {
  const content = getFlashcardContent(card);
  return {
    id: createOptionId(content.canonicalAnswer, card.id),
    displayText: surface === 'study'
      ? content.projections.studyAnswer
      : surface === 'battle'
        ? content.projections.battleAnswer
        : content.projections.tileAnswer,
    canonicalValue: content.canonicalAnswer,
    normalizedValue: content.normalizedAnswer,
    answerType: content.answerType,
    sourceCardId: card.id,
  } satisfies FlashcardOption;
}

export function prepareGeneratedFlashcards(params: {
  deckId: string;
  createdAt: number;
  cards: Array<{
    id?: string;
    question: string;
    answer: string;
    explanation?: string;
    difficulty?: Flashcard['difficulty'];
    hint1?: string;
    hint2?: string;
    tags?: string[];
  }>;
  idPrefix: string;
}): {
  flashcards: Flashcard[];
  rejectedCount: number;
  duplicateCount: number;
} {
  const seenPairs = new Set<string>();
  let rejectedCount = 0;
  let duplicateCount = 0;

  const flashcards = params.cards.reduce<Flashcard[]>((accumulator, rawCard, index) => {
    const normalized = createNormalizedFlashcard({
      id: rawCard.id ?? `${params.idPrefix}_${index}`,
      question: rawCard.question,
      answer: rawCard.answer,
      explanation: rawCard.explanation,
      hint1: rawCard.hint1,
      hint2: rawCard.hint2,
      tags: rawCard.tags,
      deckId: params.deckId,
      difficulty: rawCard.difficulty ?? 'medium',
      createdAt: params.createdAt,
      imageUrl: undefined,
    });

    const content = normalized.content;
    const pairKey = `${normalizeComparableAnswerInternal(content?.canonicalQuestion ?? normalized.question)}::${content?.normalizedAnswer ?? normalizeComparableAnswerInternal(normalized.answer)}`;
    const hasRejectFlag = Boolean(content?.qualityFlags.some((flag) => flag === 'question_answer_too_similar'))
      || content?.quality.tileAnswer === 'reject'
      || content?.quality.battleAnswer === 'reject'
      || content?.quality.gameplayQuestion === 'reject'
      || !normalized.question.trim()
      || !normalized.answer.trim();

    if (hasRejectFlag) {
      rejectedCount += 1;
      return accumulator;
    }

    if (seenPairs.has(pairKey)) {
      duplicateCount += 1;
      return accumulator;
    }

    seenPairs.add(pairKey);
    accumulator.push(normalized);
    return accumulator;
  }, []);

  logger.debug('[FlashcardContent] Prepared generated flashcards', {
    deckId: params.deckId,
    sourceCount: params.cards.length,
    savedCount: flashcards.length,
    rejectedCount,
    duplicateCount,
  });

  return {
    flashcards,
    rejectedCount,
    duplicateCount,
  };
}

export function projectLooseGameplayQuestion(question: string): string {
  const canonical = buildCanonicalQuestion(question);
  return compactQuestionForSurface(canonical, SURFACE_RULES.gameplayQuestion.maxChars);
}

export function projectLooseGameplayOption(option: string, question?: string): string {
  const answerType = inferAnswerTypeInternal(question ?? '', option);
  return compactAnswerForType(buildCanonicalAnswer(option), answerType, SURFACE_RULES.tileAnswer.maxChars);
}

export function projectLooseHint(hint: string): string {
  return trimAtWordBoundary(normalizeBaseText(hint), 72);
}
