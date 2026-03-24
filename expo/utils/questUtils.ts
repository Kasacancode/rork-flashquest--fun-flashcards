import * as z from 'zod/v4';
import { generateObject } from '@rork-ai/toolkit-sdk';

import type { Flashcard } from '@/types/flashcard';
import type { CardStats, QuestPerformance } from '@/types/performance';
import { buildGameplayDistractorPrompt, formatGameplayOption } from '@/utils/gameplayCopy';
import { getCardMastery, getWeaknessScore, isCardDue } from '@/utils/mastery';
import { logger } from '@/utils/logger';

const aiDistractorSchema = z.object({
  distractors: z.array(z.string().describe('A plausible but incorrect answer')).describe('3 plausible wrong answers'),
});

type AIDistractorCache = Record<string, string[]>;
type DistractorSource = 'deck' | 'global' | 'ai';

type DistractorCandidate = {
  answer: string;
  normalized: string;
  source: DistractorSource;
  freshnessPenalty: number;
  cardReusePenalty: number;
  score: number;
};

type AnswerProfile = {
  wordCount: number;
  isNumeric: boolean;
  hasComma: boolean;
  hasParenthesis: boolean;
  hasSlash: boolean;
  hasQuestionMark: boolean;
};

const aiDistractorCache: AIDistractorCache = {};
const distractorHistoryByCard: Record<string, string[]> = {};
const AI_CACHE_MAX_SIZE = 200;
const DISTRACTOR_HISTORY_LIMIT = 18;
const MAX_DISTRACTOR_LENGTH = 70;

function normalizeText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

function normalizeAnswer(answer: string): string {
  return normalizeText(answer);
}

function tokenize(value: string): string[] {
  return normalizeText(value)
    .split(/[^a-z0-9]+/)
    .filter(token => token.length > 1);
}

function getWordCount(value: string): number {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

function buildAnswerProfile(value: string): AnswerProfile {
  const trimmed = value.trim();

  return {
    wordCount: getWordCount(trimmed),
    isNumeric: /^\d+(?:[.,\-/]\d+)*$/.test(trimmed),
    hasComma: trimmed.includes(','),
    hasParenthesis: trimmed.includes('(') || trimmed.includes(')'),
    hasSlash: trimmed.includes('/'),
    hasQuestionMark: trimmed.includes('?') || trimmed.includes('¿'),
  };
}

function buildRecentPenaltyMap(recentDistractors: string[]): Map<string, number> {
  const recentPenaltyMap = new Map<string, number>();
  const recentWindow = recentDistractors.slice(-12).reverse();

  recentWindow.forEach((answer, index) => {
    const normalized = normalizeAnswer(answer);
    if (!recentPenaltyMap.has(normalized)) {
      const penalty = Math.max(1, 5 - Math.floor(index / 2));
      recentPenaltyMap.set(normalized, penalty);
    }
  });

  return recentPenaltyMap;
}

function buildCardHistoryPenaltyMap(cardId: string): Map<string, number> {
  const cardHistoryPenaltyMap = new Map<string, number>();
  const history = (distractorHistoryByCard[cardId] ?? []).slice(-12).reverse();

  history.forEach((answer, index) => {
    const normalized = normalizeAnswer(answer);
    if (!cardHistoryPenaltyMap.has(normalized)) {
      const penalty = Math.max(1, 6 - Math.floor(index / 2));
      cardHistoryPenaltyMap.set(normalized, penalty);
    }
  });

  return cardHistoryPenaltyMap;
}

function getQuestionSimilarityScore(candidateQuestion: string, currentQuestion: string): number {
  const candidateTokens = new Set<string>(tokenize(candidateQuestion));
  const currentTokens = new Set<string>(tokenize(currentQuestion));

  if (candidateTokens.size === 0 || currentTokens.size === 0) {
    return 0;
  }

  let overlapCount = 0;
  currentTokens.forEach((token) => {
    if (candidateTokens.has(token)) {
      overlapCount += 1;
    }
  });

  return Math.min(3, overlapCount * 0.8);
}

function getTagOverlapScore(candidateTags?: string[], currentTags?: string[]): number {
  if (!candidateTags?.length || !currentTags?.length) {
    return 0;
  }

  const currentTagSet = new Set<string>(currentTags.map(tag => normalizeText(tag)));
  const overlapCount = candidateTags.reduce((count, tag) => {
    return count + Number(currentTagSet.has(normalizeText(tag)));
  }, 0);

  return Math.min(3, overlapCount * 1.5);
}

function getAnswerSimilarityScore(answer: string, correctAnswer: string): number {
  const answerProfile = buildAnswerProfile(answer);
  const correctProfile = buildAnswerProfile(correctAnswer);
  const lengthDelta = Math.abs(answer.length - correctAnswer.length);
  const wordDelta = Math.abs(answerProfile.wordCount - correctProfile.wordCount);

  if (answerProfile.isNumeric !== correctProfile.isNumeric) {
    return -5;
  }

  let score = 0;
  score += Math.max(0, 3 - wordDelta);
  score += Math.max(0, 3 - (lengthDelta / Math.max(4, correctAnswer.length * 0.2)));
  score += Number(answerProfile.hasComma === correctProfile.hasComma);
  score += Number(answerProfile.hasParenthesis === correctProfile.hasParenthesis);
  score += Number(answerProfile.hasSlash === correctProfile.hasSlash);
  score += Number(answerProfile.hasQuestionMark === correctProfile.hasQuestionMark) * 0.5;

  return score;
}

function isReasonableGlobalFallback(answer: string, correctAnswer: string): boolean {
  const answerProfile = buildAnswerProfile(answer);
  const correctProfile = buildAnswerProfile(correctAnswer);

  if (answerProfile.isNumeric !== correctProfile.isNumeric) {
    return false;
  }

  if (Math.abs(answerProfile.wordCount - correctProfile.wordCount) > 3) {
    return false;
  }

  if (correctAnswer.length > 10 && Math.abs(answer.length - correctAnswer.length) > Math.max(12, Math.round(correctAnswer.length * 0.8))) {
    return false;
  }

  return true;
}

function scoreDistractorCandidate(params: {
  answer: string;
  correctAnswer: string;
  source: DistractorSource;
  sourceBonus: number;
  freshnessPenalty: number;
  cardReusePenalty: number;
  questionSimilarity: number;
  tagOverlap: number;
  difficultyBonus: number;
}): number {
  const {
    answer,
    correctAnswer,
    source,
    sourceBonus,
    freshnessPenalty,
    cardReusePenalty,
    questionSimilarity,
    tagOverlap,
    difficultyBonus,
  } = params;

  const answerSimilarity = getAnswerSimilarityScore(answer, correctAnswer);
  const sourceVariationBonus = source === 'deck' ? 1.5 : source === 'ai' ? 1 : 0;
  const lengthPenalty = answer.length > 52 ? Math.min(6, (answer.length - 52) / 4) : 0;

  return sourceBonus +
    sourceVariationBonus +
    answerSimilarity +
    questionSimilarity +
    tagOverlap +
    difficultyBonus -
    lengthPenalty -
    (freshnessPenalty * 3.5) -
    (cardReusePenalty * 4) +
    (Math.random() * 2.5);
}

function getCurrentCard(currentCardId: string, deckCards: Flashcard[], allCards: Flashcard[]): Flashcard | null {
  return deckCards.find(card => card.id === currentCardId) ?? allCards.find(card => card.id === currentCardId) ?? null;
}

function createCandidatePool(params: {
  cards: Flashcard[];
  correctAnswer: string;
  currentCardId: string;
  currentCard: Flashcard | null;
  recentPenaltyMap: Map<string, number>;
  cardHistoryPenaltyMap: Map<string, number>;
  source: DistractorSource;
  sourceBonus: number;
}): DistractorCandidate[] {
  const {
    cards,
    correctAnswer,
    currentCardId,
    currentCard,
    recentPenaltyMap,
    cardHistoryPenaltyMap,
    source,
    sourceBonus,
  } = params;
  const normalizedCorrect = normalizeAnswer(correctAnswer);
  const seen = new Set<string>();

  return shuffleArray(cards)
    .filter(card => card.id !== currentCardId)
    .filter(card => source !== 'global' || card.deckId !== currentCard?.deckId)
    .filter(card => source !== 'global' || isReasonableGlobalFallback(card.answer, correctAnswer))
    .map(card => ({ card, answer: card.answer.trim() }))
    .filter(({ answer }) => answer !== '')
    .filter(({ answer }) => {
      const normalized = normalizeAnswer(answer);
      if (normalized === normalizedCorrect || seen.has(normalized)) {
        return false;
      }
      seen.add(normalized);
      return true;
    })
    .map(({ card, answer }) => {
      const normalized = normalizeAnswer(answer);
      const freshnessPenalty = recentPenaltyMap.get(normalized) ?? 0;
      const cardReusePenalty = cardHistoryPenaltyMap.get(normalized) ?? 0;
      const questionSimilarity = currentCard ? getQuestionSimilarityScore(card.question, currentCard.question) : 0;
      const tagOverlap = currentCard ? getTagOverlapScore(card.tags, currentCard.tags) : 0;
      const difficultyBonus = currentCard && card.difficulty === currentCard.difficulty ? 0.75 : 0;

      return {
        answer,
        normalized,
        source,
        freshnessPenalty,
        cardReusePenalty,
        score: scoreDistractorCandidate({
          answer,
          correctAnswer,
          source,
          sourceBonus,
          freshnessPenalty,
          cardReusePenalty,
          questionSimilarity,
          tagOverlap,
          difficultyBonus,
        }),
      } satisfies DistractorCandidate;
    });
}

function createAICandidatePool(params: {
  answers: string[];
  correctAnswer: string;
  currentCardId: string;
  recentPenaltyMap: Map<string, number>;
  cardHistoryPenaltyMap: Map<string, number>;
}): DistractorCandidate[] {
  const { answers, correctAnswer, currentCardId: _currentCardId, recentPenaltyMap, cardHistoryPenaltyMap } = params;
  const normalizedCorrect = normalizeAnswer(correctAnswer);
  const seen = new Set<string>();

  return shuffleArray(answers)
    .map(answer => answer.trim())
    .filter(answer => answer !== '')
    .filter(answer => isReasonableGlobalFallback(answer, correctAnswer))
    .filter(answer => {
      const normalized = normalizeAnswer(answer);
      if (normalized === normalizedCorrect || seen.has(normalized)) {
        return false;
      }
      seen.add(normalized);
      return true;
    })
    .map(answer => {
      const normalized = normalizeAnswer(answer);
      const freshnessPenalty = recentPenaltyMap.get(normalized) ?? 0;
      const cardReusePenalty = cardHistoryPenaltyMap.get(normalized) ?? 0;

      return {
        answer,
        normalized,
        source: 'ai',
        freshnessPenalty,
        cardReusePenalty,
        score: scoreDistractorCandidate({
          answer,
          correctAnswer,
          source: 'ai',
          sourceBonus: 6,
          freshnessPenalty,
          cardReusePenalty,
          questionSimilarity: 1,
          tagOverlap: 0,
          difficultyBonus: 0,
        }),
      } satisfies DistractorCandidate;
    });
}

function dedupeCandidates(candidates: DistractorCandidate[]): DistractorCandidate[] {
  const candidateMap = new Map<string, DistractorCandidate>();

  candidates.forEach((candidate) => {
    const existing = candidateMap.get(candidate.normalized);
    if (!existing || candidate.score > existing.score) {
      candidateMap.set(candidate.normalized, candidate);
    }
  });

  return Array.from(candidateMap.values());
}

function pickWeightedCandidate(candidates: DistractorCandidate[]): DistractorCandidate | null {
  if (candidates.length === 0) {
    return null;
  }

  const weights = candidates.map(candidate => Math.max(0.25, candidate.score));
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);

  if (totalWeight <= 0) {
    return candidates[0] ?? null;
  }

  let random = Math.random() * totalWeight;

  for (let index = 0; index < candidates.length; index += 1) {
    random -= weights[index] ?? 0;
    if (random <= 0) {
      return candidates[index] ?? null;
    }
  }

  return candidates[candidates.length - 1] ?? null;
}

function selectDistractors(params: {
  candidates: DistractorCandidate[];
  count: number;
}): string[] {
  const { candidates, count } = params;
  const selected: string[] = [];
  const lengthFilteredCandidates = candidates.filter((candidate) => candidate.answer.length <= MAX_DISTRACTOR_LENGTH);
  const candidatePool = lengthFilteredCandidates.length >= count ? lengthFilteredCandidates : candidates;
  let remaining = dedupeCandidates(candidatePool);

  while (selected.length < count && remaining.length > 0) {
    const sorted = [...remaining].sort((a, b) => b.score - a.score);
    const tierSize = Math.min(Math.max(count * 3, 6), sorted.length);
    const tier = sorted.slice(0, tierSize);
    const picked = pickWeightedCandidate(tier);

    if (!picked) {
      break;
    }

    selected.push(picked.answer);
    remaining = remaining.filter(candidate => candidate.normalized !== picked.normalized);
  }

  return selected.slice(0, count);
}

function rememberDistractors(cardId: string, distractors: string[]): void {
  const existing = distractorHistoryByCard[cardId] ?? [];
  distractorHistoryByCard[cardId] = [...existing, ...distractors].slice(-DISTRACTOR_HISTORY_LIMIT);
}

function buildFallbackDistractorCandidates(params: {
  correctAnswer: string;
  deckCards: Flashcard[];
  allCards: Flashcard[];
  currentCardId: string;
  recentDistractors?: string[];
}): DistractorCandidate[] {
  const { correctAnswer, deckCards, allCards, currentCardId, recentDistractors = [] } = params;
  const recentPenaltyMap = buildRecentPenaltyMap(recentDistractors);
  const cardHistoryPenaltyMap = buildCardHistoryPenaltyMap(currentCardId);
  const currentCard = getCurrentCard(currentCardId, deckCards, allCards);

  const deckCandidates = createCandidatePool({
    cards: deckCards,
    correctAnswer,
    currentCardId,
    currentCard,
    recentPenaltyMap,
    cardHistoryPenaltyMap,
    source: 'deck',
    sourceBonus: 8,
  });

  if (deckCandidates.length >= 3) {
    return deckCandidates;
  }

  const globalCandidates = createCandidatePool({
    cards: allCards,
    correctAnswer,
    currentCardId,
    currentCard,
    recentPenaltyMap,
    cardHistoryPenaltyMap,
    source: 'global',
    sourceBonus: 1.5,
  });

  return [...deckCandidates, ...globalCandidates];
}

export function selectNextCard(params: {
  cards: Flashcard[];
  usedCardIds: Set<string>;
  performance: QuestPerformance;
  focusWeakOnly: boolean;
}): Flashcard | null {
  const { cards, usedCardIds, performance, focusWeakOnly } = params;

  if (cards.length === 0) {
    return null;
  }

  const now = Date.now();
  let candidates = cards.filter((card) => !usedCardIds.has(card.id));

  if (candidates.length === 0) {
    const sortedByLastAttempt = [...cards].sort((a, b) => {
      const aStats = performance.cardStatsById[a.id];
      const bStats = performance.cardStatsById[b.id];
      const aTime = aStats?.lastAttemptAt || 0;
      const bTime = bStats?.lastAttemptAt || 0;
      return aTime - bTime;
    });
    candidates = sortedByLastAttempt.slice(0, Math.ceil(cards.length / 2));
  }

  if (focusWeakOnly) {
    const weakCandidates = candidates
      .map((card) => {
        const stats = performance.cardStatsById[card.id];
        return {
          card,
          score: getWeaknessScore(stats, now),
          due: isCardDue(stats, now),
          status: getCardMastery(stats, now),
        };
      })
      .filter((entry) => entry.status === 'lapsed' || entry.due || entry.score >= 6);

    if (weakCandidates.length > 0) {
      candidates = weakCandidates
        .sort((a, b) => b.score - a.score)
        .map((entry) => entry.card);
    }
  }

  const weighted: { card: Flashcard; weight: number }[] = candidates.map((card) => {
    const stats: CardStats | undefined = performance.cardStatsById[card.id];
    const weaknessScore = getWeaknessScore(stats, now);
    const status = getCardMastery(stats, now);
    const due = isCardDue(stats, now);
    let weight = 1 + weaknessScore;

    if (due) {
      weight += 2.8;
    }

    if (status === 'lapsed') {
      weight += 4;
    } else if (status === 'learning') {
      weight += 1.8;
    } else if (status === 'mastered') {
      weight -= 1.6;
    }

    if (!stats || stats.attempts === 0) {
      weight += 0.8;
    }

    const daysSinceAttempt = stats?.lastAttemptAt
      ? (now - stats.lastAttemptAt) / (1000 * 60 * 60 * 24)
      : 0;

    if (daysSinceAttempt > 10) {
      weight += 0.8;
    }

    return {
      card,
      weight: Math.max(0.35, weight),
    };
  });

  const totalWeight = weighted.reduce((sum, entry) => sum + entry.weight, 0);
  let random = Math.random() * totalWeight;

  for (const { card, weight } of weighted) {
    random -= weight;
    if (random <= 0) {
      return card;
    }
  }

  return weighted[weighted.length - 1]?.card || cards[0];
}

export function generateDistractors(params: {
  correctAnswer: string;
  deckCards: Flashcard[];
  allCards: Flashcard[];
  currentCardId: string;
  recentDistractors?: string[];
  count?: number;
}): string[] {
  const { count = 3, currentCardId } = params;
  const candidates = buildFallbackDistractorCandidates(params);
  const distractors = selectDistractors({ candidates, count });

  rememberDistractors(currentCardId, distractors);
  logger.debug('[QuestUtils] Generated deck-aware distractors for card:', currentCardId, distractors);

  return distractors;
}

export function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export function generateOptions(params: {
  correctAnswer: string;
  deckCards: Flashcard[];
  allCards: Flashcard[];
  currentCardId: string;
  recentDistractors?: string[];
}): string[] {
  const cachedAIDistractors = aiDistractorCache[params.currentCardId] ?? [];
  const recentPenaltyMap = buildRecentPenaltyMap(params.recentDistractors ?? []);
  const cardHistoryPenaltyMap = buildCardHistoryPenaltyMap(params.currentCardId);

  const aiCandidates = createAICandidatePool({
    answers: cachedAIDistractors,
    correctAnswer: params.correctAnswer,
    currentCardId: params.currentCardId,
    recentPenaltyMap,
    cardHistoryPenaltyMap,
  });

  const fallbackCandidates = buildFallbackDistractorCandidates({
    correctAnswer: params.correctAnswer,
    deckCards: params.deckCards,
    allCards: params.allCards,
    currentCardId: params.currentCardId,
    recentDistractors: params.recentDistractors,
  });

  const allCandidates = [...aiCandidates, ...fallbackCandidates];

  const distractors = selectDistractors({
    candidates: allCandidates,
    count: 3,
  });

  rememberDistractors(params.currentCardId, distractors);
  logger.debug('[QuestUtils] Generated options for card:', params.currentCardId, distractors);

  const options = [params.correctAnswer, ...distractors];
  return shuffleArray(options);
}

export function checkAnswer(selected: string, correct: string): boolean {
  return normalizeAnswer(selected) === normalizeAnswer(correct);
}

export async function generateAIDistractors(
  question: string,
  correctAnswer: string,
  cardId: string,
): Promise<string[]> {
  if (aiDistractorCache[cardId] && aiDistractorCache[cardId].length > 0) {
    logger.debug('[QuestUtils] Using cached AI distractors for card:', cardId);
    return aiDistractorCache[cardId];
  }

  try {
    const result = await generateObject({
      messages: [
        {
          role: 'user',
          content: buildGameplayDistractorPrompt(question, correctAnswer),
        },
      ],
      schema: aiDistractorSchema,
    });

    const distractors = result.distractors
      .map((d: string) => formatGameplayOption(d))
      .filter((d: string) => d.toLowerCase().trim() !== correctAnswer.toLowerCase().trim());

    if (distractors.length > 0) {
      const keys = Object.keys(aiDistractorCache);
      if (keys.length >= AI_CACHE_MAX_SIZE) {
        delete aiDistractorCache[keys[0]];
      }
      aiDistractorCache[cardId] = distractors;
      logger.debug('[QuestUtils] Generated AI distractors for card:', cardId, distractors);
      return distractors;
    }

    return [];
  } catch (error) {
    logger.debug('[QuestUtils] AI distractor generation failed:', error);
    return [];
  }
}

export async function generateOptionsWithAI(params: {
  correctAnswer: string;
  question: string;
  deckCards: Flashcard[];
  allCards: Flashcard[];
  currentCardId: string;
}): Promise<string[]> {
  const { correctAnswer, question, deckCards, allCards, currentCardId } = params;

  await generateAIDistractors(question, correctAnswer, currentCardId);

  return generateOptions({
    correctAnswer,
    deckCards,
    allCards,
    currentCardId,
  });
}

export function clearAIDistractorCache() {
  Object.keys(aiDistractorCache).forEach((key) => delete aiDistractorCache[key]);
  Object.keys(distractorHistoryByCard).forEach((key) => delete distractorHistoryByCard[key]);
}

export function calculateScore(params: {
  isCorrect: boolean;
  mode: 'learn' | 'test';
  currentStreak: number;
}): number {
  if (!params.isCorrect) return 0;

  const basePoints = params.mode === 'test' ? 15 : 10;

  let multiplier = 1.0;
  if (params.currentStreak >= 4) multiplier = 2.0;
  else if (params.currentStreak >= 3) multiplier = 1.6;
  else if (params.currentStreak >= 2) multiplier = 1.4;
  else if (params.currentStreak >= 1) multiplier = 1.2;

  return Math.round(basePoints * multiplier);
}
