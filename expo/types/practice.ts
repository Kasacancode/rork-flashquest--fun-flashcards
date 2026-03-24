export type PracticeMode = 'ai' | 'multiplayer';
export type PracticeSessionStatus = 'active' | 'completed';

export interface PracticeSessionState {
  id: string;
  mode: PracticeMode;
  deckId: string;
  playerScore: number;
  opponentScore: number;
  currentRound: number;
  totalRounds: number;
  status: PracticeSessionStatus;
  opponentName: string;
  completedAt?: number;
  shuffled?: boolean;
}
