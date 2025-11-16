export interface Flashcard {
  id: string;
  question: string;
  answer: string;
  deckId: string;
  imageUrl?: string;
  difficulty: 'easy' | 'medium' | 'hard';
  tags?: string[];
  createdAt: number;
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
  correctAnswers: number;
  totalAttempts: number;
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
