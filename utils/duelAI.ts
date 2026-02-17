import * as z from 'zod/v4';
import { generateObject } from '@rork-ai/toolkit-sdk';

const distractorSchema = z.object({
  distractors: z.array(z.string().describe('A plausible but incorrect answer')).describe('3 plausible wrong answers'),
});

type DistractorCache = Record<string, string[]>;
const cache: DistractorCache = {};
// Cap cache size to prevent unbounded memory growth during long sessions
const CACHE_MAX_SIZE = 200;

export async function generateDistractors(
  question: string,
  correctAnswer: string,
  cardId: string,
): Promise<string[]> {
  if (cache[cardId] && cache[cardId].length > 0) {
    return cache[cardId];
  }

  try {
    const result = await generateObject({
      messages: [
        {
          role: 'user',
          content: `You are a flashcard quiz game AI. Given a question and its correct answer, generate exactly 3 plausible but WRONG answers. The wrong answers should be believable and similar in style/format to the correct answer, but clearly incorrect. They should be the kind of mistakes a student might make.

Question: ${question}
Correct Answer: ${correctAnswer}

Generate 3 wrong answers that:
- Match the format/length of the correct answer
- Sound plausible but are factually wrong
- Are distinct from each other and from the correct answer
- Would trick someone who doesn't know the material well`,
        },
      ],
      schema: distractorSchema,
    });

    const distractors = result.distractors.filter(
      (d: string) => d.toLowerCase().trim() !== correctAnswer.toLowerCase().trim()
    );

    if (distractors.length > 0) {
      const keys = Object.keys(cache);
      if (keys.length >= CACHE_MAX_SIZE) {
        delete cache[keys[0]];
      }
      cache[cardId] = distractors;
      return distractors;
    }

    return getFallbackDistractors(correctAnswer);
  } catch (error) {

    return getFallbackDistractors(correctAnswer);
  }
}

function getFallbackDistractors(correctAnswer: string): string[] {
  const isNumber = /^\d+(\.\d+)?$/.test(correctAnswer.trim());

  if (isNumber) {
    const num = parseFloat(correctAnswer.trim());
    return [
      String(Math.round(num * 0.7)),
      String(Math.round(num * 1.4)),
      String(Math.round(num + (num > 10 ? 5 : 2))),
    ];
  }

  return [
    `Not ${correctAnswer}`,
    `Similar to ${correctAnswer}`,
    `Almost ${correctAnswer}`,
  ];
}

export function pickDistractor(distractors: string[]): string {
  if (distractors.length === 0) return 'Incorrect answer';
  return distractors[Math.floor(Math.random() * distractors.length)];
}

export function getOpponentBehavior(difficulty: string): { correctChance: number; minTime: number; maxTime: number } {
  switch (difficulty) {
    case 'easy':
      return { correctChance: 0.75, minTime: 2, maxTime: 5 };
    case 'hard':
      return { correctChance: 0.4, minTime: 6, maxTime: 12 };
    case 'medium':
    default:
      return { correctChance: 0.6, minTime: 4, maxTime: 8 };
  }
}

export function clearDistractorCache() {
  Object.keys(cache).forEach((key) => delete cache[key]);
}
