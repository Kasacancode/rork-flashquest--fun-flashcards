export const GAME_MODE = {
  STUDY: 'study',
  QUEST: 'quest',
  PRACTICE: 'practice',
  ARENA: 'arena',
} as const;

export type GameMode = (typeof GAME_MODE)[keyof typeof GAME_MODE];

export interface GameResultParams {
  mode: GameMode;
  deckId?: string;
  xpEarned: number;
  cardsAttempted: number;
  correctCount?: number;
  timestampISO: string;
}
