export interface ArenaLeaderboardEntry {
  id: string;
  deckId: string;
  deckName: string;
  winnerName: string;
  winnerPoints: number;
  winnerAccuracy: number;
  playerCount: number;
  rounds: number;
  timerSeconds: number;
  completedAt: number;
}
