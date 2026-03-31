import type {
  Deck,
  Flashcard,
  FlashcardAnswerType,
  FlashcardContentModel,
  FlashcardDeckNormalizationSummary,
  FlashcardFitStatus,
  FlashcardNormalizationReasonCode,
  FlashcardNormalizationSource,
  FlashcardOption,
  FlashcardOptionCollisionEntry,
  FlashcardOptionCollisionResult,
  FlashcardOptionSurface,
  FlashcardProjectionQuality,
  FlashcardProjectionSet,
} from '@/types/flashcard';
import { normalizeDeckCategory } from '@/constants/deckCategories';
import { recordDeckNormalizationSummary, recordOptionCollision } from '@/utils/flashcardDiagnostics';
import { logger } from '@/utils/logger';

const CARD_CONTENT_VERSION = 3;
const MARKDOWN_DECORATION_REGEX = /[*_`>#~]+/g;
const MARKDOWN_ARTIFACT_TEST_REGEX = /[*_`>#~]|\[(.*?)\]\((.*?)\)|\||_{2,}/;
const BULLET_PREFIX_REGEX = /^\s*(?:[-•–—*]|\d+[.)]|[A-Za-z][.)])\s+/;
const QUESTION_PREFIX_REGEX = /^\s*(?:q(?:uestion)?|prompt|front)\s*[:.-]\s*/i;
const ANSWER_PREFIX_REGEX = /^\s*(?:a(?:nswer)?|back|response|correct answer)\s*[:.-]\s*/i;
const LEADING_FILLER_REGEX = /^\s*(?:the answer is|it is|it's|this is|these are|they are|it refers to|refers to|defined as)\s+/i;
const TRAILING_PUNCTUATION_REGEX = /[\s.;:!?]+$/g;
const LEADING_WRAPPER_REGEX = /^["'“”‘’([{\s]+/g;
const TRAILING_WRAPPER_REGEX = /["'“”‘’)]}\s]+$/g;
const WRAPPER_TEST_REGEX = /^["'“”‘’([{\s]+|["'“”‘’)]}\s]+$/;
const MULTI_SPACE_REGEX = /\s+/g;
function hasControlCharacters(value: string): boolean {
  for (const character of value) {
    const code = character.charCodeAt(0);
    if (code <= 31 || code === 127) {
      return true;
    }
  }

  return false;
}
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

const SURFACE_REASON_CODES: Record<keyof FlashcardProjectionSet, FlashcardNormalizationReasonCode> = {
  studyQuestion: 'compressed_study_question',
  studyAnswer: 'compressed_study_answer',
  gameplayQuestion: 'compressed_gameplay_question',
  tileAnswer: 'compressed_tile_answer',
  battleQuestion: 'compressed_battle_question',
  battleAnswer: 'compressed_battle_answer',
};

const FIT_STATUS_SCORES: Record<FlashcardFitStatus, number> = {
  safe: 100,
  compress: 72,
  reject: 24,
};

type ProjectionSurface = keyof FlashcardProjectionSet;

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

const OPTION_SURFACE_LIMITS: Record<FlashcardOptionSurface, number> = {
  study: SURFACE_RULES.studyAnswer.maxChars,
  tile: SURFACE_RULES.tileAnswer.maxChars,
  battle: SURFACE_RULES.battleAnswer.maxChars,
};

function addReason(reasonCodes: Set<FlashcardNormalizationReasonCode>, code: FlashcardNormalizationReasonCode): void {
  reasonCodes.add(code);
}

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

function normalizeBaseText(value: string): string {
  return collapseWhitespace(stripWrappers(stripListPrefix(stripMarkdownArtifacts(value))));
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

function normalizeQuestionBase(value: string, reasonCodes?: Set<FlashcardNormalizationReasonCode>): string {
  if (reasonCodes) {
    if (hasControlCharacters(value) || value.trim() !== value || /\s{2,}/.test(stripControlCharacters(value))) {
      addReason(reasonCodes, 'trimmed_whitespace');
    }
    if (MARKDOWN_ARTIFACT_TEST_REGEX.test(value)) {
      addReason(reasonCodes, 'stripped_markdown_artifacts');
    }
    if (BULLET_PREFIX_REGEX.test(value)) {
      addReason(reasonCodes, 'removed_list_prefix');
    }
    if (WRAPPER_TEST_REGEX.test(value)) {
      addReason(reasonCodes, 'removed_wrapping_quotes');
    }
  }

  let result = normalizeBaseText(value);
  const withoutPrefix = result.replace(QUESTION_PREFIX_REGEX, '');
  if (reasonCodes && withoutPrefix !== result) {
    addReason(reasonCodes, 'removed_question_prefix');
  }

  result = withoutPrefix
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

  return result;
}

function normalizeAnswerBase(value: string, reasonCodes?: Set<FlashcardNormalizationReasonCode>): string {
  if (reasonCodes) {
    if (hasControlCharacters(value) || value.trim() !== value || /\s{2,}/.test(stripControlCharacters(value))) {
      addReason(reasonCodes, 'trimmed_whitespace');
    }
    if (MARKDOWN_ARTIFACT_TEST_REGEX.test(value)) {
      addReason(reasonCodes, 'stripped_markdown_artifacts');
    }
    if (BULLET_PREFIX_REGEX.test(value)) {
      addReason(reasonCodes, 'removed_list_prefix');
    }
    if (WRAPPER_TEST_REGEX.test(value)) {
      addReason(reasonCodes, 'removed_wrapping_quotes');
    }
  }

  let result = normalizeBaseText(value);
  const withoutAnswerPrefix = result.replace(ANSWER_PREFIX_REGEX, '');
  if (reasonCodes && withoutAnswerPrefix !== result) {
    addReason(reasonCodes, 'removed_answer_prefix');
  }

  const withoutFiller = withoutAnswerPrefix.replace(LEADING_FILLER_REGEX, '');
  if (reasonCodes && withoutFiller !== withoutAnswerPrefix) {
    addReason(reasonCodes, 'removed_leading_filler');
  }

  return withoutFiller.trim();
}

function sentenceCaseFirstLetter(value: string, reasonCodes?: Set<FlashcardNormalizationReasonCode>): string {
  if (!value) {
    return value;
  }

  const nextValue = value[0]!.toUpperCase() + value.slice(1);
  if (reasonCodes && nextValue !== value) {
    addReason(reasonCodes, 'normalized_sentence_case');
  }

  return nextValue;
}

function ensureQuestionPunctuation(value: string, reasonCodes?: Set<FlashcardNormalizationReasonCode>): string {
  if (!value) {
    return value;
  }

  if (/[?!]$/.test(value)) {
    return value;
  }

  if (reasonCodes) {
    addReason(reasonCodes, 'normalized_question_punctuation');
  }

  return `${value}?`;
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

function getFitStatus(value: string, surface: ProjectionSurface, answerType?: FlashcardAnswerType): FlashcardFitStatus {
  const rule = SURFACE_RULES[surface];
  const profile = getTextProfile(value, rule);
  const punctuationRelaxation = answerType === 'numeric' ? 2.8 : answerType === 'formula' ? 2.1 : 1;
  const parenthesisRelaxation = answerType === 'formula' ? 1.6 : 1;
  const symbolLimit = answerType === 'numeric' ? 0.62 : answerType === 'formula' ? 0.58 : 0.42;

  const isReject = profile.charCount > Math.round(rule.maxChars * rule.rejectMultiplier)
    || profile.wordCount > Math.round(rule.maxWords * rule.rejectMultiplier)
    || profile.longestTokenLength > Math.round(rule.maxLongestToken * 1.45)
    || profile.punctuationDensity > rule.maxPunctuationDensity * 1.65 * punctuationRelaxation
    || profile.parenthesisDensity > rule.maxParenthesisDensity * 1.8 * parenthesisRelaxation
    || profile.symbolDensity > symbolLimit
    || profile.estimatedLines > Math.max(rule.maxLines + 2, Math.round(rule.maxLines * 1.75));

  if (isReject) {
    return 'reject';
  }

  const isCompress = profile.charCount > rule.maxChars
    || profile.wordCount > rule.maxWords
    || profile.longestTokenLength > rule.maxLongestToken
    || profile.punctuationDensity > rule.maxPunctuationDensity * punctuationRelaxation
    || profile.parenthesisDensity > rule.maxParenthesisDensity * parenthesisRelaxation
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
  return value;
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

function extractExplanation(answer: string, existingExplanation: string | undefined, reasonCodes: Set<FlashcardNormalizationReasonCode>): { cleanedAnswer: string; explanation?: string; explanationExtracted: boolean } {
  const normalizedExplanation = normalizeBaseText(existingExplanation ?? '');
  if (normalizedExplanation) {
    return {
      cleanedAnswer: answer,
      explanation: normalizedExplanation,
      explanationExtracted: false,
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
      addReason(reasonCodes, 'extracted_explanation');
      return {
        cleanedAnswer: head,
        explanation: sentenceCaseFirstLetter(tail),
        explanationExtracted: true,
      };
    }
  }

  return {
    cleanedAnswer: answer,
    explanationExtracted: false,
  };
}

function buildCanonicalQuestion(value: string, reasonCodes?: Set<FlashcardNormalizationReasonCode>): string {
  const normalized = normalizeQuestionBase(value, reasonCodes);
  const trimmed = trimAtWordBoundary(normalized, 240).replace(TRAILING_PUNCTUATION_REGEX, '').trim();
  if (reasonCodes && trimmed !== normalized) {
    addReason(reasonCodes, 'trimmed_question_length');
  }
  return ensureQuestionPunctuation(sentenceCaseFirstLetter(trimmed, reasonCodes), reasonCodes);
}

function buildCanonicalAnswer(value: string, reasonCodes?: Set<FlashcardNormalizationReasonCode>): string {
  const normalized = normalizeAnswerBase(value, reasonCodes);
  const trimmed = trimAtWordBoundary(normalized, 220).replace(TRAILING_PUNCTUATION_REGEX, '').trim();
  if (reasonCodes && trimmed !== normalized) {
    addReason(reasonCodes, 'trimmed_answer_length');
  }
  return sentenceCaseFirstLetter(trimmed, reasonCodes);
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
  answerType?: FlashcardAnswerType;
}): { value: string; status: FlashcardFitStatus } {
  const originalStatus = getFitStatus(options.original, options.surface, options.answerType);
  if (originalStatus === 'safe') {
    return { value: options.original, status: 'safe' };
  }

  let projected = options.compressed.trim() || options.original;
  let projectedStatus = getFitStatus(projected, options.surface, options.answerType);

  if (projectedStatus === 'reject') {
    projected = trimAtWordBoundary(projected, options.fallbackMaxChars);
    projectedStatus = getFitStatus(projected, options.surface, options.answerType);
  }

  return {
    value: projected,
    status: projectedStatus === 'safe' ? 'compress' : projectedStatus,
  };
}

function buildProjectionSet(
  canonicalQuestion: string,
  canonicalAnswer: string,
  answerType: FlashcardAnswerType,
  reasonCodes: Set<FlashcardNormalizationReasonCode>,
): {
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
    answerType,
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
    answerType,
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
    answerType,
  });

  const nextProjections: FlashcardProjectionSet = {
    studyQuestion: studyQuestion.value,
    studyAnswer: studyAnswer.value,
    gameplayQuestion: gameplayQuestion.value,
    tileAnswer: tileAnswer.value,
    battleQuestion: battleQuestion.value,
    battleAnswer: battleAnswer.value,
  };

  const nextQuality: FlashcardProjectionQuality = {
    studyQuestion: studyQuestion.status,
    studyAnswer: studyAnswer.status,
    gameplayQuestion: gameplayQuestion.status,
    tileAnswer: tileAnswer.status,
    battleQuestion: battleQuestion.status,
    battleAnswer: battleAnswer.status,
  };

  (Object.keys(nextProjections) as ProjectionSurface[]).forEach((surface) => {
    const originalValue = surface.includes('Question') ? canonicalQuestion : canonicalAnswer;
    if (nextProjections[surface] !== originalValue && nextQuality[surface] !== 'reject') {
      addReason(reasonCodes, SURFACE_REASON_CODES[surface]);
    }
  });

  if (answerType === 'binary' && (nextProjections.tileAnswer !== canonicalAnswer || nextProjections.battleAnswer !== canonicalAnswer)) {
    addReason(reasonCodes, 'normalized_binary');
  }

  if (answerType === 'numeric' && (nextProjections.tileAnswer !== canonicalAnswer || nextProjections.battleAnswer !== canonicalAnswer)) {
    addReason(reasonCodes, 'normalized_numeric');
  }

  if (answerType === 'formula' && (nextProjections.tileAnswer !== canonicalAnswer || nextProjections.battleAnswer !== canonicalAnswer)) {
    addReason(reasonCodes, 'normalized_formula');
  }

  if (Object.values(nextQuality).some((status) => status === 'reject')) {
    addReason(reasonCodes, 'rejected_low_fit');
  }

  const gameplayProfile = getTextProfile(nextProjections.gameplayQuestion, SURFACE_RULES.gameplayQuestion);
  const tileProfile = getTextProfile(nextProjections.tileAnswer, SURFACE_RULES.tileAnswer);
  const battleProfile = getTextProfile(nextProjections.battleAnswer, SURFACE_RULES.battleAnswer);
  if (
    gameplayProfile.symbolDensity > 0.36
    || tileProfile.symbolDensity > 0.36
    || battleProfile.symbolDensity > 0.36
    || gameplayProfile.punctuationDensity > SURFACE_RULES.gameplayQuestion.maxPunctuationDensity * 1.3
    || tileProfile.punctuationDensity > SURFACE_RULES.tileAnswer.maxPunctuationDensity * 1.3
    || battleProfile.punctuationDensity > SURFACE_RULES.battleAnswer.maxPunctuationDensity * 1.3
  ) {
    addReason(reasonCodes, 'rejected_display_hostile');
  }

  return {
    projections: nextProjections,
    quality: nextQuality,
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

  if (params.quality.studyQuestion === 'reject') {
    flags.add('study_question_reject');
  }

  if (params.quality.studyAnswer === 'reject') {
    flags.add('study_answer_reject');
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

  if (params.quality.battleQuestion === 'reject') {
    flags.add('battle_question_reject');
  }

  if (params.explanation && params.explanation.length > 220) {
    flags.add('long_explanation');
  }

  return Array.from(flags);
}

function computeFitScore(quality: FlashcardProjectionQuality): number {
  const scores = [
    FIT_STATUS_SCORES[quality.studyQuestion],
    FIT_STATUS_SCORES[quality.studyAnswer],
    FIT_STATUS_SCORES[quality.gameplayQuestion],
    FIT_STATUS_SCORES[quality.tileAnswer],
    FIT_STATUS_SCORES[quality.battleQuestion],
    FIT_STATUS_SCORES[quality.battleAnswer],
  ];

  return Math.round(scores.reduce((sum, value) => sum + value, 0) / scores.length);
}

function hasCompressionReason(reasonCodes: Set<FlashcardNormalizationReasonCode>): boolean {
  return Array.from(reasonCodes).some((reasonCode) => reasonCode.startsWith('compressed_') || reasonCode === 'trimmed_question_length' || reasonCode === 'trimmed_answer_length' || reasonCode === 'trimmed_explanation_length');
}

function buildContentModel(input: {
  rawQuestion: string;
  rawAnswer: string;
  rawExplanation?: string;
  wasLegacyMigrated: boolean;
}): FlashcardContentModel {
  const reasonCodes = new Set<FlashcardNormalizationReasonCode>();

  if (input.wasLegacyMigrated) {
    addReason(reasonCodes, 'legacy_card_upgraded');
  }

  const canonicalQuestion = buildCanonicalQuestion(input.rawQuestion, reasonCodes);
  const normalizedRawAnswer = normalizeAnswerBase(input.rawAnswer, reasonCodes);
  const extracted = extractExplanation(normalizedRawAnswer, input.rawExplanation, reasonCodes);
  const canonicalAnswer = buildCanonicalAnswer(extracted.cleanedAnswer, reasonCodes);
  const explanation = extracted.explanation
    ? (() => {
        const trimmedExplanation = trimAtWordBoundary(extracted.explanation, 280);
        if (trimmedExplanation !== extracted.explanation) {
          addReason(reasonCodes, 'trimmed_explanation_length');
        }
        return sentenceCaseFirstLetter(trimmedExplanation, reasonCodes);
      })()
    : undefined;
  const answerType = inferAnswerTypeInternal(canonicalQuestion, canonicalAnswer);
  const normalizedAnswer = normalizeComparableAnswerInternal(canonicalAnswer);
  const { projections, quality } = buildProjectionSet(canonicalQuestion, canonicalAnswer, answerType, reasonCodes);
  const qualityFlags = buildQualityFlags({
    canonicalQuestion,
    canonicalAnswer,
    normalizedAnswer,
    quality,
    explanation,
  });
  const fitScore = computeFitScore(quality);
  const substantiveReasonCount = Array.from(reasonCodes).filter((reasonCode) => reasonCode !== 'legacy_card_upgraded').length;

  return {
    version: CARD_CONTENT_VERSION,
    canonicalQuestion,
    canonicalAnswer,
    normalizedAnswer,
    answerType,
    explanation,
    projections,
    quality,
    qualityFlags,
    normalization: {
      rawQuestion: input.rawQuestion,
      rawAnswer: input.rawAnswer,
      rawExplanation: input.rawExplanation,
      reasonCodes: Array.from(reasonCodes),
      explanationExtracted: extracted.explanationExtracted,
      wasCompressed: hasCompressionReason(reasonCodes),
      wasLegacyMigrated: input.wasLegacyMigrated,
      unchanged: substantiveReasonCount === 0,
      fitScore,
    },
  } satisfies FlashcardContentModel;
}

function hasCompleteFlashcardContent(content: Flashcard['content'] | undefined): content is FlashcardContentModel {
  return content?.version === CARD_CONTENT_VERSION
    && typeof content.canonicalQuestion === 'string'
    && typeof content.canonicalAnswer === 'string'
    && typeof content.normalizedAnswer === 'string'
    && typeof content.answerType === 'string'
    && typeof content.projections?.studyQuestion === 'string'
    && typeof content.projections?.studyAnswer === 'string'
    && typeof content.projections?.gameplayQuestion === 'string'
    && typeof content.projections?.tileAnswer === 'string'
    && typeof content.projections?.battleQuestion === 'string'
    && typeof content.projections?.battleAnswer === 'string'
    && typeof content.quality?.studyQuestion === 'string'
    && typeof content.quality?.studyAnswer === 'string'
    && typeof content.quality?.gameplayQuestion === 'string'
    && typeof content.quality?.tileAnswer === 'string'
    && typeof content.quality?.battleQuestion === 'string'
    && typeof content.quality?.battleAnswer === 'string'
    && Array.isArray(content.qualityFlags)
    && Array.isArray(content.normalization?.reasonCodes)
    && typeof content.normalization?.rawQuestion === 'string'
    && typeof content.normalization?.rawAnswer === 'string'
    && typeof content.normalization?.explanationExtracted === 'boolean'
    && typeof content.normalization?.wasCompressed === 'boolean'
    && typeof content.normalization?.wasLegacyMigrated === 'boolean'
    && typeof content.normalization?.unchanged === 'boolean'
    && typeof content.normalization?.fitScore === 'number';
}

function shouldUseCurrentRawValue<T extends string | undefined>(currentValue: T, previousCanonicalValue: T): boolean {
  return (currentValue ?? '') !== (previousCanonicalValue ?? '');
}

function getExistingRawQuestion(card: Flashcard): string {
  return shouldUseCurrentRawValue(card.question, card.content?.canonicalQuestion)
    ? card.question
    : (card.content?.normalization?.rawQuestion ?? card.question);
}

function getExistingRawAnswer(card: Flashcard): string {
  return shouldUseCurrentRawValue(card.answer, card.content?.canonicalAnswer)
    ? card.answer
    : (card.content?.normalization?.rawAnswer ?? card.answer);
}

function getExistingRawExplanation(card: Flashcard): string | undefined {
  return shouldUseCurrentRawValue(card.explanation, card.content?.explanation)
    ? card.explanation
    : (card.content?.normalization?.rawExplanation ?? card.explanation);
}

function getStoredContentVersion(card: Flashcard): number | undefined {
  const version = (card.content as { version?: unknown } | undefined)?.version;
  return typeof version === 'number' ? version : undefined;
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
  if (hasCompleteFlashcardContent(card.content)) {
    return card.content;
  }

  const storedContentVersion = getStoredContentVersion(card);

  return buildContentModel({
    rawQuestion: getExistingRawQuestion(card),
    rawAnswer: getExistingRawAnswer(card),
    rawExplanation: getExistingRawExplanation(card),
    wasLegacyMigrated: storedContentVersion == null || storedContentVersion < CARD_CONTENT_VERSION,
  });
}

export function normalizeFlashcard(card: Flashcard, options?: { wasLegacyMigrated?: boolean }): Flashcard {
  const storedContentVersion = getStoredContentVersion(card);
  const content = buildContentModel({
    rawQuestion: getExistingRawQuestion(card),
    rawAnswer: getExistingRawAnswer(card),
    rawExplanation: getExistingRawExplanation(card),
    wasLegacyMigrated: options?.wasLegacyMigrated ?? (storedContentVersion == null || storedContentVersion < CARD_CONTENT_VERSION),
  });

  return {
    ...card,
    question: content.canonicalQuestion,
    answer: content.canonicalAnswer,
    explanation: content.explanation,
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

export function buildDeckNormalizationSummary(params: {
  deckId: string;
  flashcards: Flashcard[];
  source: FlashcardNormalizationSource;
  originalCardCount?: number;
  rejectedCount?: number;
  duplicatePairsRemoved?: number;
  extraReasonCodeCounts?: Partial<Record<FlashcardNormalizationReasonCode, number>>;
}): FlashcardDeckNormalizationSummary {
  const cards = params.flashcards.map((card) => {
    const content = getFlashcardContent(card);
    return {
      cardId: card.id,
      answerType: content.answerType,
      reasonCodes: content.normalization.reasonCodes,
      qualityFlags: content.qualityFlags,
      rawAnswerLength: content.normalization.rawAnswer.trim().length,
      canonicalAnswerLength: content.canonicalAnswer.length,
      fitScore: content.normalization.fitScore,
      wasCompressed: content.normalization.wasCompressed,
      wasLegacyMigrated: content.normalization.wasLegacyMigrated,
      unchanged: content.normalization.unchanged,
    };
  });

  const answerTypeDistribution = cards.reduce<Partial<Record<FlashcardAnswerType, number>>>((accumulator, card) => {
    accumulator[card.answerType] = (accumulator[card.answerType] ?? 0) + 1;
    return accumulator;
  }, {});

  const reasonCodeCounts = cards.reduce<Partial<Record<FlashcardNormalizationReasonCode, number>>>((accumulator, card) => {
    card.reasonCodes.forEach((reasonCode) => {
      accumulator[reasonCode] = (accumulator[reasonCode] ?? 0) + 1;
    });
    return accumulator;
  }, {});

  Object.entries(params.extraReasonCodeCounts ?? {}).forEach(([key, value]) => {
    const reasonCode = key as FlashcardNormalizationReasonCode;
    reasonCodeCounts[reasonCode] = (reasonCodeCounts[reasonCode] ?? 0) + (value ?? 0);
  });

  const qualityFlagCounts = cards.reduce<Record<string, number>>((accumulator, card) => {
    card.qualityFlags.forEach((flag) => {
      accumulator[flag] = (accumulator[flag] ?? 0) + 1;
    });
    return accumulator;
  }, {});

  const acceptedCount = cards.length;
  const rejectedCount = params.rejectedCount ?? 0;
  const duplicatePairsRemoved = params.duplicatePairsRemoved ?? 0;
  const processedCount = params.originalCardCount ?? (acceptedCount + rejectedCount + duplicatePairsRemoved);
  const acceptedUnchangedCount = cards.filter((card) => card.unchanged).length;
  const acceptedCompressedCount = cards.filter((card) => card.wasCompressed).length;
  const explanationExtractedCount = params.flashcards.filter((card) => getFlashcardContent(card).normalization.explanationExtracted).length;
  const legacyCardsUpgraded = cards.filter((card) => card.wasLegacyMigrated).length;
  const averageRawAnswerLength = acceptedCount > 0
    ? cards.reduce((sum, card) => sum + card.rawAnswerLength, 0) / acceptedCount
    : 0;
  const averageCanonicalAnswerLength = acceptedCount > 0
    ? cards.reduce((sum, card) => sum + card.canonicalAnswerLength, 0) / acceptedCount
    : 0;
  const distinctAnswerCount = new Set(params.flashcards.map((card) => getFlashcardContent(card).normalizedAnswer)).size;
  const battleSafe = acceptedCount >= 4
    && distinctAnswerCount >= 4
    && params.flashcards.every((card) => {
      const content = getFlashcardContent(card);
      return content.quality.battleAnswer !== 'reject' && content.quality.battleQuestion !== 'reject';
    });

  return {
    deckId: params.deckId,
    source: params.source,
    processedCount,
    acceptedCount,
    acceptedUnchangedCount,
    acceptedCompressedCount,
    explanationExtractedCount,
    rejectedCount,
    duplicatePairsRemoved,
    legacyCardsUpgraded,
    affectedCardCount: acceptedCount - acceptedUnchangedCount,
    answerTypeDistribution,
    reasonCodeCounts,
    qualityFlagCounts,
    averageRawAnswerLength,
    averageCanonicalAnswerLength,
    battleSafe,
    cards,
    createdAt: Date.now(),
  } satisfies FlashcardDeckNormalizationSummary;
}

export function normalizeDeck(deck: Deck, options?: { source?: FlashcardNormalizationSource; trackDiagnostics?: boolean }): Deck {
  const normalizedDeck = {
    ...deck,
    category: normalizeDeckCategory(deck.category),
    flashcards: deck.flashcards.map((card) => normalizeFlashcard(card)),
  } satisfies Deck;

  if (options?.trackDiagnostics) {
    recordDeckNormalizationSummary(buildDeckNormalizationSummary({
      deckId: deck.id,
      flashcards: normalizedDeck.flashcards,
      source: options.source ?? 'unknown',
      originalCardCount: deck.flashcards.length,
    }));
  }

  return normalizedDeck;
}

export function normalizeDeckCollection(decks: Deck[], options?: { source?: FlashcardNormalizationSource; trackDiagnostics?: boolean }): { decks: Deck[]; didChange: boolean } {
  let didChange = false;
  const normalizedDecks = decks.map((deck) => {
    const normalizedDeck = normalizeDeck(deck, options);
    if (JSON.stringify(deck) !== JSON.stringify(normalizedDeck)) {
      didChange = true;
    }
    return normalizedDeck;
  });

  return { decks: normalizedDecks, didChange };
}

export function createNormalizedFlashcard(input: Omit<Flashcard, 'content'>, options?: { wasLegacyMigrated?: boolean }): Flashcard {
  return normalizeFlashcard({
    ...input,
    content: undefined,
  }, {
    wasLegacyMigrated: options?.wasLegacyMigrated ?? false,
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
  surface?: FlashcardOptionSurface;
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

export function createFlashcardOptionFromCard(card: Flashcard, surface: FlashcardOptionSurface = 'tile'): FlashcardOption {
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

function normalizeOptionDisplayKey(value: string): string {
  return collapseWhitespace(value).toLowerCase();
}

function detectOptionDisplayCollisions(options: FlashcardOption[]): FlashcardOptionCollisionEntry[] {
  const grouped = options.reduce<Map<string, FlashcardOption[]>>((accumulator, option) => {
    const key = normalizeOptionDisplayKey(option.displayText);
    const existing = accumulator.get(key) ?? [];
    accumulator.set(key, [...existing, option]);
    return accumulator;
  }, new Map<string, FlashcardOption[]>());

  return Array.from(grouped.entries())
    .map(([normalizedDisplayText, groupedOptions]) => ({ normalizedDisplayText, groupedOptions }))
    .filter(({ groupedOptions }) => groupedOptions.length > 1)
    .filter(({ groupedOptions }) => new Set(groupedOptions.map((option) => option.normalizedValue)).size > 1)
    .map(({ normalizedDisplayText, groupedOptions }) => ({
      displayText: groupedOptions[0]?.displayText ?? '',
      normalizedDisplayText,
      optionIds: groupedOptions.map((option) => option.id),
      canonicalValues: groupedOptions.map((option) => option.canonicalValue),
    }));
}

function getFallbackOptionDisplayText(option: FlashcardOption, surface: FlashcardOptionSurface): string {
  const maxChars = OPTION_SURFACE_LIMITS[surface];
  const label = sentenceCaseFirstLetter(trimAtWordBoundary(buildCanonicalAnswer(option.canonicalValue), maxChars));
  return label || option.displayText;
}

export function resolveOptionDisplayCollisions(params: {
  options: FlashcardOption[];
  surface: FlashcardOptionSurface;
  source?: FlashcardNormalizationSource;
  deckId?: string;
  cardId?: string;
}): FlashcardOptionCollisionResult {
  const collisions = detectOptionDisplayCollisions(params.options);
  if (collisions.length === 0) {
    return {
      options: params.options,
      collisions: [],
      fallbackCount: 0,
    };
  }

  const collisionOptionIds = new Set(collisions.flatMap((collision) => collision.optionIds));
  let fallbackCount = 0;
  const nextOptions = params.options.map((option) => {
    if (!collisionOptionIds.has(option.id)) {
      return option;
    }

    const nextDisplayText = getFallbackOptionDisplayText(option, params.surface);
    if (nextDisplayText !== option.displayText) {
      fallbackCount += 1;
      return {
        ...option,
        displayText: nextDisplayText,
      } satisfies FlashcardOption;
    }

    return option;
  });

  recordOptionCollision({
    deckId: params.deckId,
    cardId: params.cardId,
    source: params.source ?? 'option_generation',
    surface: params.surface,
    collisions,
    fallbackCount,
  });

  return {
    options: nextOptions,
    collisions,
    fallbackCount,
  } satisfies FlashcardOptionCollisionResult;
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
  source?: FlashcardNormalizationSource;
}): {
  flashcards: Flashcard[];
  rejectedCount: number;
  duplicateCount: number;
} {
  const seenPairs = new Set<string>();
  let rejectedCount = 0;
  let duplicateCount = 0;
  const extraReasonCodeCounts: Partial<Record<FlashcardNormalizationReasonCode, number>> = {};

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
      if (content?.quality.tileAnswer === 'reject' || content?.quality.battleAnswer === 'reject' || content?.quality.gameplayQuestion === 'reject') {
        extraReasonCodeCounts.rejected_low_fit = (extraReasonCodeCounts.rejected_low_fit ?? 0) + 1;
      }
      if (content?.qualityFlags.includes('markdown_artifacts')) {
        extraReasonCodeCounts.rejected_display_hostile = (extraReasonCodeCounts.rejected_display_hostile ?? 0) + 1;
      }
      return accumulator;
    }

    if (seenPairs.has(pairKey)) {
      duplicateCount += 1;
      extraReasonCodeCounts.rejected_duplicate = (extraReasonCodeCounts.rejected_duplicate ?? 0) + 1;
      return accumulator;
    }

    seenPairs.add(pairKey);
    accumulator.push(normalized);
    return accumulator;
  }, []);

  recordDeckNormalizationSummary(buildDeckNormalizationSummary({
    deckId: params.deckId,
    flashcards,
    source: params.source ?? 'unknown',
    originalCardCount: params.cards.length,
    rejectedCount,
    duplicatePairsRemoved: duplicateCount,
    extraReasonCodeCounts,
  }));

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
