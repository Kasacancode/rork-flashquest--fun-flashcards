import * as z from 'zod/v4';
import { generateObject } from '@rork-ai/toolkit-sdk';
import type { Flashcard } from '@/types/flashcard';
import type { CardStats, QuestPerformance } from '@/types/performance';
import { logger } from '@/utils/logger';

const aiDistractorSchema = z.object({
  distractors: z.array(z.string().describe('A plausible but incorrect answer')).describe('3 plausible wrong answers'),
});

type AIDistractorCache = Record<string, string[]>;
type DistractorCandidate = {
  answer: string;
  normalized: string;
  freshnessPenalty: number;
  score: number;
};

const aiDistractorCache: AIDistractorCache = {};
// Cap cache size to prevent unbounded memory growth during long sessions
const AI_CACHE_MAX_SIZE = 200;

function normalizeAnswer(answer: string): string {
  return answer.trim().toLowerCase().replace(/\s+/g, ' ');
}

function getWordCount(value: string): number {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

function buildRecentPenaltyMap(recentDistractors: string[]): Map<string, number> {
  const recentPenaltyMap = new Map<string, number>();
  const recentWindow = recentDistractors.slice(-12).reverse();

  recentWindow.forEach((answer, index) => {
    const normalized = normalizeAnswer(answer);
    if (!recentPenaltyMap.has(normalized)) {
      const penalty = Math.max(1, 4 - Math.floor(index / 3));
      recentPenaltyMap.set(normalized, penalty);
    }
  });

  return recentPenaltyMap;
}

function scoreDistractorCandidate(params: {
  answer: string;
  correctAnswer: string;
  sourceBonus: number;
  freshnessPenalty: number;
}): number {
  const { answer, correctAnswer, sourceBonus, freshnessPenalty } = params;
  const correctWordCount = getWordCount(correctAnswer);
  const answerWordCount = getWordCount(answer);
  const lengthDelta = Math.abs(answer.length - correctAnswer.length);
  const wordDelta = Math.abs(answerWordCount - correctWordCount);
  const punctuationBonus = Number(answer.includes(',') === correctAnswer.includes(',')) +
    Number(answer.includes('(') === correctAnswer.includes('(')) +
    Number(answer.includes('/') === correctAnswer.includes('/'));

  return sourceBonus +
    Math.max(0, 3 - (lengthDelta / Math.max(4, correctAnswer.length * 0.25))) +
    Math.max(0, 2 - wordDelta) +
    punctuationBonus -
    (freshnessPenalty * 3) +
    Math.random();
}

function createCandidatePool(params: {
  cards: Flashcard[];
  correctAnswer: string;
  currentCardId: string;
  recentPenaltyMap: Map<string, number>;
  sourceBonus: number;
}): DistractorCandidate[] {
  const { cards, correctAnswer, currentCardId, recentPenaltyMap, sourceBonus } = params;
  const normalizedCorrect = normalizeAnswer(correctAnswer);
  const seen = new Set<string>();

  return shuffleArray(cards)
    .filter(card => card.id !== currentCardId)
    .map(card => card.answer.trim())
    .filter(answer => answer !== '')
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

      return {
        answer,
        normalized,
        freshnessPenalty,
        score: scoreDistractorCandidate({
          answer,
          correctAnswer,
          sourceBonus,
          freshnessPenalty,
        }),
      };
    });
}

/**
 * Weighted random card selection for quest mode.
 * Prioritizes unseen cards, weak cards (low accuracy), and cards not attempted recently.
 * Falls back to least-recently-attempted cards when all have been used.
 */
export function selectNextCard(params: {
  cards: Flashcard[];
  usedCardIds: Set<string>;
  performance: QuestPerformance;
  focusWeakOnly: boolean;
}): Flashcard | null {
  const { cards, usedCardIds, performance, focusWeakOnly } = params;
  
  if (cards.length === 0) return null;

  let candidates = cards.filter(c => !usedCardIds.has(c.id));
  
  // When all cards have been used, recycle the least-recently-attempted half
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
    const weakCandidates = candidates.filter(card => {
      const stats = performance.cardStatsById[card.id];
      if (!stats || stats.attempts < 3) return true;
      const accuracy = stats.correct / stats.attempts;
      if (accuracy < 0.7) return true;
      if (stats.incorrect > stats.correct) return true;
      return false;
    });
    
    if (weakCandidates.length >= 1) {
      candidates = weakCandidates;
    }
  }

  const weighted: { card: Flashcard; weight: number }[] = candidates.map(card => {
    const stats: CardStats | undefined = performance.cardStatsById[card.id];
    let weight = 1;

    if (!stats || stats.attempts === 0) {
      weight += 4;
    } else {
      if (stats.attempts < 3) weight += 2;
      if (stats.incorrect > stats.correct) weight += 3;
      
      const accuracy = stats.correct / stats.attempts;
      if (accuracy < 0.6) weight += 3;
      if (stats.streakCorrect >= 3) weight -= 3;
      
      const daysSinceAttempt = (Date.now() - stats.lastAttemptAt) / (1000 * 60 * 60 * 24);
      if (daysSinceAttempt > 7) weight += 1;
    }

    weight = Math.max(0.5, weight);
    return { card, weight };
  });

  const totalWeight = weighted.reduce((sum, w) => sum + w.weight, 0);
  let random = Math.random() * totalWeight;

  for (const { card, weight } of weighted) {
    random -= weight;
    if (random <= 0) return card;
  }

  return weighted[weighted.length - 1]?.card || cards[0];
}

/**
 * Generates plausible wrong answers by pulling from same-deck cards first,
 * preferring answers of similar length, then falling back to global cards.
 */
export function generateDistractors(params: {
  correctAnswer: string;
  deckCards: Flashcard[];
  allCards: Flashcard[];
  currentCardId: string;
  recentDistractors?: string[];
  count?: number;
}): string[] {
  const { correctAnswer, deckCards, allCards, currentCardId, recentDistractors = [], count = 3 } = params;
  const distractors: string[] = [];
  const usedNormalized = new Set<string>([normalizeAnswer(correctAnswer)]);
  const recentPenaltyMap = buildRecentPenaltyMap(recentDistractors);

  const candidatePool = [
    ...createCandidatePool({
      cards: deckCards,
      correctAnswer,
      currentCardId,
      recentPenaltyMap,
      sourceBonus: 4,
    }),
    ...createCandidatePool({
      cards: allCards,
      correctAnswer,
      currentCardId,
      recentPenaltyMap,
      sourceBonus: 1,
    }),
  ];

  const freshCandidates = shuffleArray(
    candidatePool.filter(candidate => candidate.freshnessPenalty === 0)
  ).sort((a, b) => b.score - a.score);
  const recycledCandidates = shuffleArray(
    candidatePool.filter(candidate => candidate.freshnessPenalty > 0)
  ).sort((a, b) => b.score - a.score);

  for (const pool of [freshCandidates, recycledCandidates]) {
    for (const candidate of pool) {
      if (distractors.length >= count) {
        break;
      }

      if (usedNormalized.has(candidate.normalized)) {
        continue;
      }

      distractors.push(candidate.answer);
      usedNormalized.add(candidate.normalized);
    }
  }

  return distractors.slice(0, count);
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
  const fallbackDistractors = generateDistractors({
    correctAnswer: params.correctAnswer,
    deckCards: params.deckCards,
    allCards: params.allCards,
    currentCardId: params.currentCardId,
    recentDistractors: params.recentDistractors,
    count: 3,
  });

  const usedNormalized = new Set<string>([normalizeAnswer(params.correctAnswer)]);
  const distractors: string[] = [];

  for (const answer of [...cachedAIDistractors, ...fallbackDistractors]) {
    const normalized = normalizeAnswer(answer);
    if (usedNormalized.has(normalized)) {
      continue;
    }

    distractors.push(answer);
    usedNormalized.add(normalized);

    if (distractors.length >= 3) {
      break;
    }
  }

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
    logger.log('[QuestUtils] Using cached AI distractors for card:', cardId);
    return aiDistractorCache[cardId];
  }

  try {
    const result = await generateObject({
      messages: [
        {
          role: 'user',
          content: `You are a flashcard quiz game AI. Given a question and its correct answer, generate exactly 3 plausible but WRONG answers. The wrong answers should be believable and similar in style/format to the correct answer, but clearly incorrect.

Question: ${question}
Correct Answer: ${correctAnswer}

Generate 3 wrong answers that:
- Match the format/length of the correct answer
- Sound plausible but are factually wrong
- Are distinct from each other and from the correct answer
- Would trick someone who doesn't know the material well`,
        },
      ],
      schema: aiDistractorSchema,
    });

    const distractors = result.distractors.filter(
      (d: string) => d.toLowerCase().trim() !== correctAnswer.toLowerCase().trim()
    );

    if (distractors.length > 0) {
      // Evict oldest entries when cache exceeds max size
      const keys = Object.keys(aiDistractorCache);
      if (keys.length >= AI_CACHE_MAX_SIZE) {
        delete aiDistractorCache[keys[0]];
      }
      aiDistractorCache[cardId] = distractors;
      logger.log('[QuestUtils] Generated AI distractors for card:', cardId, distractors);
      return distractors;
    }

    return [];
  } catch (error) {
    logger.log('[QuestUtils] AI distractor generation failed:', error);
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

  const aiDistractors = await generateAIDistractors(question, correctAnswer, currentCardId);

  if (aiDistractors.length >= 3) {
    const options = [correctAnswer, ...aiDistractors.slice(0, 3)];
    return shuffleArray(options);
  }

  const fallbackDistractors = generateDistractors({
    correctAnswer,
    deckCards,
    allCards,
    currentCardId,
    count: 3 - aiDistractors.length,
  });

  const combinedDistractors = [...aiDistractors, ...fallbackDistractors].slice(0, 3);
  const options = [correctAnswer, ...combinedDistractors];
  return shuffleArray(options);
}

export function clearAIDistractorCache() {
  Object.keys(aiDistractorCache).forEach((key) => delete aiDistractorCache[key]);
}

/**
 * Calculates points for a single quest answer.
 * Test mode awards 15 base pts (higher risk), learn mode awards 10.
 * Streak multiplier rewards consecutive correct answers up to 2x.
 */
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
