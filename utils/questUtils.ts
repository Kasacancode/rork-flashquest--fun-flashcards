import * as z from 'zod/v4';
import { generateObject } from '@rork-ai/toolkit-sdk';
import { Flashcard, CardStats, QuestPerformance } from '@/types/flashcard';

const aiDistractorSchema = z.object({
  distractors: z.array(z.string().describe('A plausible but incorrect answer')).describe('3 plausible wrong answers'),
});

type AIDistractorCache = Record<string, string[]>;
const aiDistractorCache: AIDistractorCache = {};

function normalizeAnswer(answer: string): string {
  return answer.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function selectNextCard(params: {
  cards: Flashcard[];
  usedCardIds: Set<string>;
  performance: QuestPerformance;
  focusWeakOnly: boolean;
}): Flashcard | null {
  const { cards, usedCardIds, performance, focusWeakOnly } = params;
  
  if (cards.length === 0) return null;

  let candidates = cards.filter(c => !usedCardIds.has(c.id));
  
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

export function generateDistractors(params: {
  correctAnswer: string;
  deckCards: Flashcard[];
  allCards: Flashcard[];
  currentCardId: string;
  count?: number;
}): string[] {
  const { correctAnswer, deckCards, allCards, currentCardId, count = 3 } = params;
  const normalizedCorrect = normalizeAnswer(correctAnswer);
  const distractors: string[] = [];
  const usedNormalized = new Set<string>([normalizedCorrect]);

  const correctLength = correctAnswer.length;
  const minLength = correctLength * 0.5;
  const maxLength = correctLength * 1.5;

  const deckAnswers = deckCards
    .filter(c => c.id !== currentCardId)
    .map(c => c.answer)
    .filter(a => {
      const norm = normalizeAnswer(a);
      return a.trim() !== '' && !usedNormalized.has(norm);
    });

  const preferredDeck = deckAnswers.filter(a => 
    a.length >= minLength && a.length <= maxLength
  );
  
  const otherDeck = deckAnswers.filter(a => 
    a.length < minLength || a.length > maxLength
  );

  for (const answer of preferredDeck) {
    if (distractors.length >= count) break;
    const norm = normalizeAnswer(answer);
    if (!usedNormalized.has(norm)) {
      distractors.push(answer);
      usedNormalized.add(norm);
    }
  }

  for (const answer of otherDeck) {
    if (distractors.length >= count) break;
    const norm = normalizeAnswer(answer);
    if (!usedNormalized.has(norm)) {
      distractors.push(answer);
      usedNormalized.add(norm);
    }
  }

  if (distractors.length < count) {
    const globalAnswers = allCards
      .filter(c => c.id !== currentCardId)
      .map(c => c.answer)
      .filter(a => {
        const norm = normalizeAnswer(a);
        return a.trim() !== '' && !usedNormalized.has(norm);
      });

    for (const answer of globalAnswers) {
      if (distractors.length >= count) break;
      const norm = normalizeAnswer(answer);
      if (!usedNormalized.has(norm)) {
        distractors.push(answer);
        usedNormalized.add(norm);
      }
    }
  }

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
}): string[] {
  const distractors = generateDistractors({
    correctAnswer: params.correctAnswer,
    deckCards: params.deckCards,
    allCards: params.allCards,
    currentCardId: params.currentCardId,
    count: 3,
  });

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
    console.log('[QuestUtils] Using cached AI distractors for card:', cardId);
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
      aiDistractorCache[cardId] = distractors;
      console.log('[QuestUtils] Generated AI distractors for card:', cardId, distractors);
      return distractors;
    }

    return [];
  } catch (error) {
    console.log('[QuestUtils] AI distractor generation failed:', error);
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
