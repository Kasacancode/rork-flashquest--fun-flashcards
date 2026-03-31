import type { RecallQuality } from '@/types/performance';
import type { PracticeMode, PracticeSessionState } from '@/types/practice';

export const QUESTION_TIME = 15;

export type GamePhase = 'player-turn' | 'opponent-turn' | 'reveal-results';

export interface PlayerInfo {
  name: string;
  answer: string;
  isCorrect: boolean;
  timeUsed: number;
}

export interface TurnResult {
  answer: string;
  isCorrect: boolean;
  timeUsed: number;
}

export interface PendingCardReview {
  deckId: string;
  cardId: string;
  isCorrect: boolean;
  selectedOption: string;
  correctAnswer: string;
  timeToAnswerMs: number;
  quality: RecallQuality;
}

interface OpponentBehavior {
  correctChance: number;
  minTime: number;
  maxTime: number;
}

export interface AdaptiveOpponentState {
  streak: number;
  confidence: number;
}

const AI_NAMES = ['Quizzy', 'Ace', 'Sage', 'Brainiac', 'Nova'] as const;

export function pickDistractor(distractors: string[]): string {
  if (distractors.length === 0) {
    return 'Incorrect answer';
  }

  return distractors[Math.floor(Math.random() * distractors.length)] ?? 'Incorrect answer';
}

export function getAdaptiveOpponentBehavior(
  difficulty: string,
  playerScore: number,
  opponentScore: number,
  round: number,
  aiState: AdaptiveOpponentState,
): OpponentBehavior {
  let baseChance: number;
  switch (difficulty) {
    case 'easy':
      baseChance = 0.8;
      break;
    case 'hard':
      baseChance = 0.35;
      break;
    default:
      baseChance = 0.6;
      break;
  }

  const scoreDiff = opponentScore - playerScore;
  const rubberBand = scoreDiff > 0 ? -0.08 : scoreDiff < 0 ? 0.08 : 0;
  const streakBonus = aiState.streak > 0
    ? Math.min(aiState.streak * 0.04, 0.12)
    : Math.max(aiState.streak * 0.04, -0.12);
  const roundStability = Math.min(round / 5, 1) * 0.05;
  const finalChance = Math.max(0.15, Math.min(0.9, baseChance + rubberBand + streakBonus + roundStability));
  const isConfident = aiState.streak >= 2;
  const minTime = isConfident ? 1 : 3;
  const maxTime = isConfident ? 4 : 8;

  return { correctChance: finalChance, minTime, maxTime };
}

export function createPracticeSession(deckId: string, mode: PracticeMode): PracticeSessionState {
  const aiName = AI_NAMES[Math.floor(Math.random() * AI_NAMES.length)] ?? 'AI Bot';
  return {
    id: `practice_${Date.now()}`,
    mode,
    deckId,
    playerScore: 0,
    opponentScore: 0,
    currentRound: 0,
    totalRounds: 5,
    status: 'active',
    opponentName: mode === 'ai' ? aiName : 'Opponent',
    shuffled: false,
  };
}
