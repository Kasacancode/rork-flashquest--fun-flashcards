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
  totalCorrectAnswers: number;
  totalQuestionsAttempted: number;
  studyDates: string[];
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
