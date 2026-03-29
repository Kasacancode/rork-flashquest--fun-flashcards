export type FlashcardAnswerType =
  | 'term'
  | 'definition'
  | 'formula'
  | 'numeric'
  | 'comparison'
  | 'process'
  | 'binary'
  | 'concept_label'
  | 'phrase';

export type FlashcardFitStatus = 'safe' | 'compress' | 'reject';

export interface FlashcardProjectionSet {
  studyQuestion: string;
  studyAnswer: string;
  gameplayQuestion: string;
  tileAnswer: string;
  battleQuestion: string;
  battleAnswer: string;
}

export interface FlashcardProjectionQuality {
  studyAnswer: FlashcardFitStatus;
  gameplayQuestion: FlashcardFitStatus;
  tileAnswer: FlashcardFitStatus;
  battleQuestion: FlashcardFitStatus;
  battleAnswer: FlashcardFitStatus;
}

export interface FlashcardContentModel {
  version: number;
  canonicalQuestion: string;
  canonicalAnswer: string;
  normalizedAnswer: string;
  answerType: FlashcardAnswerType;
  projections: FlashcardProjectionSet;
  quality: FlashcardProjectionQuality;
  qualityFlags: string[];
}

export interface FlashcardOption {
  id: string;
  displayText: string;
  canonicalValue: string;
  normalizedValue: string;
  answerType: FlashcardAnswerType;
  sourceCardId?: string;
}

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
  content?: FlashcardContentModel;
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
  totalStudySessions: number;
  totalQuestSessions: number;
  totalPracticeSessions: number;
  totalArenaSessions: number;
  totalArenaBattles: number;
  totalStudyTimeMs: number;
  weeklyAccuracy: { week: string; correct: number; attempted: number }[];
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
