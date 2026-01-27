// ============================================
// TYPE DEFINITIONS FOR FLASHQUEST APP
// ============================================
// This file contains all the TypeScript interfaces (data structures)
// used throughout the app. Think of interfaces as blueprints that
// define what data an object should contain.

// ============================================
// FLASHCARD INTERFACE
// ============================================
// Represents a single flashcard with a question and answer
export interface Flashcard {
  // Unique identifier for this flashcard (like a serial number)
  id: string;
  
  // The question text displayed on the front of the card
  question: string;
  
  // The answer text displayed on the back of the card
  answer: string;
  
  // ID of the deck this card belongs to (links card to a deck)
  deckId: string;
  
  // Optional: URL to an image for the card (? means it's not required)
  imageUrl?: string;
  
  // How hard the question is: easy, medium, or hard
  difficulty: 'easy' | 'medium' | 'hard';
  
  // Optional: Array of tags for categorizing cards (e.g., ['math', 'algebra'])
  tags?: string[];
  
  // Timestamp (number) of when this card was created
  createdAt: number;
  
  // Optional: First hint to help the user before revealing the answer
  hint1?: string;
  
  // Optional: Second hint (more revealing) if user needs more help
  hint2?: string;
  
  // Optional: Explanation shown after user views the answer
  explanation?: string;
}

// ============================================
// DECK INTERFACE
// ============================================
// Represents a collection of flashcards grouped by topic
export interface Deck {
  // Unique identifier for this deck
  id: string;
  
  // Display name of the deck (e.g., "World Capitals")
  name: string;
  
  // Brief description of what the deck teaches
  description: string;
  
  // Color code for the deck (e.g., "#FF6B6B" for red)
  color: string;
  
  // Icon name to display with the deck (e.g., "globe", "book")
  icon: string;
  
  // Array of all flashcards in this deck
  flashcards: Flashcard[];
  
  // Category this deck belongs to (e.g., "Geography", "Science")
  category: string;
  
  // Timestamp of when this deck was created
  createdAt: number;
  
  // Whether user created this deck (true) or it came pre-made (false)
  isCustom: boolean;
}

// ============================================
// USER PROGRESS INTERFACE
// ============================================
// Tracks user's study progress with each deck (no correctness tracking in MVP)
export interface UserProgress {
  // ID of the deck this progress tracks
  deckId: string;
  
  // Total number of cards reviewed/completed
  cardsReviewed: number;
  
  // Timestamp of the last time user studied this deck
  lastStudied: number;
  
  // Array of card IDs that user has mastered (knows very well)
  masteredCards: string[];
}

// ============================================
// USER STATS INTERFACE
// ============================================
// Tracks overall user statistics and achievements
export interface UserStats {
  // User's total score across all activities
  totalScore: number;
  
  // How many consecutive days user has been active
  currentStreak: number;
  
  // The longest streak the user has ever achieved
  longestStreak: number;
  
  // Total number of flashcards user has studied
  totalCardsStudied: number;
  
  // Total number of decks user has completed
  totalDecksCompleted: number;
  
  // Array of achievements the user has earned
  achievements: Achievement[];
  
  // Date string of the last time user was active (format: "YYYY-MM-DD")
  lastActiveDate: string;
}

// ============================================
// ACHIEVEMENT INTERFACE
// ============================================
// Represents a badge or achievement users can earn
export interface Achievement {
  // Unique identifier for this achievement
  id: string;
  
  // Display name of the achievement (e.g., "First Win")
  name: string;
  
  // Description of how to earn this achievement
  description: string;
  
  // Icon name to display with the achievement
  icon: string;
  
  // Optional: Timestamp of when achievement was unlocked
  // (undefined means not yet unlocked)
  unlockedAt?: number;
  
  // Current progress toward unlocking (e.g., 3 out of 10)
  progress: number;
  
  // Maximum progress needed to unlock (e.g., 10)
  maxProgress: number;
}

// ============================================
// DUEL SESSION INTERFACE
// ============================================
// Represents an active or completed battle/duel session
export interface DuelSession {
  // Unique identifier for this duel
  id: string;
  
  // Type of opponent: 'ai' (computer) or 'multiplayer' (another person)
  mode: 'ai' | 'multiplayer';
  
  // ID of the deck being used for this duel
  deckId: string;
  
  // Player's current score in this duel
  playerScore: number;
  
  // Opponent's current score in this duel
  opponentScore: number;
  
  // Which round we're currently on (starts at 0)
  currentRound: number;
  
  // Total number of rounds in this duel (default: 5)
  totalRounds: number;
  
  // Whether duel is still going ('active') or finished ('completed')
  status: 'active' | 'completed';
  
  // Display name of the opponent
  opponentName: string;
  
  // Optional: Timestamp of when duel was completed
  completedAt?: number;
  
  // Optional: Whether the deck cards were shuffled for this duel
  shuffled?: boolean;
}

// ============================================
// QUEST MODE TYPES
// ============================================

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

// ============================================
// ARENA MODE TYPES
// ============================================

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
