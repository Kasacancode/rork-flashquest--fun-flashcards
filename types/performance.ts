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
