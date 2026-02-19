export interface Flashcard {
  id: string;
  question: string;
  answer: string;
  deckId: string;
  imageUrl?: string;
  difficulty: 'easy' | 'medium' | 'hard';
  tags?: string[];
  createdAt: number;
  hint1?: string;
  hint2?: string;
  explanation?: string;
}

export interface Deck {
  id: string;
  name: string;
  description: string;
  color: string;
  icon: string;
  flashcards: Flashcard[];
  category: string;
  createdAt: number;
  isCustom: boolean;
}

export interface UserProgress {
  deckId: string;
  cardsReviewed: number;
  lastStudied: number;
  masteredCards: string[];
}

export interface UserStats {
  totalScore: number;
  currentStreak: number;
  longestStreak: number;
  totalCardsStudied: number;
  totalDecksCompleted: number;
  achievements: Achievement[];
  lastActiveDate: string;
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  unlockedAt?: number;
  progress: number;
  maxProgress: number;
}

export interface DuelSession {
  id: string;
  mode: 'ai' | 'multiplayer';
  deckId: string;
  playerScore: number;
  opponentScore: number;
  currentRound: number;
  totalRounds: number;
  status: 'active' | 'completed';
  opponentName: string;
  completedAt?: number;
  shuffled?: boolean;
}

export type QuestMode = 'learn' | 'test';

export interface QuestSettings {
  deckId: string;
  mode: QuestMode;
  runLength: 5 | 10 | 20;
  timerSeconds: 0 | 5 | 10;
  focusWeakOnly: boolean;
  hintsEnabled: boolean;
  explanationsEnabled: boolean;
  secondChanceEnabled: boolean;
}

export interface CardStats {
  attempts: number;
  correct: number;
  incorrect: number;
  streakCorrect: number;
  lastAttemptAt: number;
}

export interface DeckStats {
  attempts: number;
  correct: number;
  incorrect: number;
  lastAttemptAt: number;
}

export interface QuestPerformance {
  cardStatsById: Record<string, CardStats>;
  deckStatsById: Record<string, DeckStats>;
  bestQuestStreak: number;
  lastQuestSettings?: QuestSettings;
}

export interface QuestAttempt {
  id: string;
  timestamp: number;
  deckId: string;
  cardId: string;
  isCorrect: boolean;
  selectedOption: string;
  correctAnswer: string;
  timeToAnswerMs: number;
}

export interface QuestRunResult {
  deckId: string;
  settings: QuestSettings;
  totalScore: number;
  correctCount: number;
  incorrectCount: number;
  accuracy: number;
  bestStreak: number;
  totalTimeMs: number;
  missedCardIds: string[];
  askedCardIds: string[];
}

export interface ArenaPlayer {
  id: string;
  name: string;
  isHost: boolean;
  color: string;
}

export interface ArenaSettings {
  rounds: 5 | 10 | 20;
  timerSeconds: 0 | 5 | 10;
  showExplanationsAtEnd: boolean;
}

export interface ArenaLobbyState {
  roomCode: string;
  players: ArenaPlayer[];
  deckId: string | null;
  settings: ArenaSettings;
}

export interface ArenaPlayerResult {
  playerId: string;
  playerName: string;
  playerColor: string;
  correctCount: number;
  incorrectCount: number;
  points: number;
  accuracy: number;
  bestStreak: number;
  answers: ArenaAnswer[];
}

export interface ArenaAnswer {
  cardId: string;
  selectedOption: string;
  correctAnswer: string;
  isCorrect: boolean;
  timeToAnswerMs: number;
}

export interface ArenaMatchResult {
  roomCode: string;
  deckId: string;
  settings: ArenaSettings;
  playerResults: ArenaPlayerResult[];
  totalRounds: number;
  completedAt: number;
}

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
