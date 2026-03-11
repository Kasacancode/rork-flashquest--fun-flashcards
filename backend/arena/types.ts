// --- Arena type definitions ---
// All room, game, and sanitized types live here.
// Shared by repository, engine, and TRPC routes.

export const PLAYER_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
  '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F',
  '#BB8FCE', '#85C1E9', '#F8B500', '#00CED1',
] as const;

export const MAX_PLAYERS = 12;
export const ROOM_TTL_MS = 60 * 60 * 1000;
export const DISCONNECT_MS = 60 * 1000;
export const REVEAL_DURATION_MS = 3500;
export const NO_TIMER_TIMEOUT_MS = 90 * 1000;

export interface RoomPlayer {
  id: string;
  name: string;
  color: string;
  isHost: boolean;
  lastSeen: number;
}

export interface RoomQuestion {
  cardId: string;
  question: string;
  correctAnswer: string;
  options: string[];
}

export interface ScoreEntry {
  correct: number;
  incorrect: number;
  points: number;
  currentStreak: number;
  bestStreak: number;
}

export interface AnswerEntry {
  selectedOption: string;
  isCorrect: boolean;
  timeToAnswerMs: number;
}

export interface GameState {
  questions: RoomQuestion[];
  currentQuestionIndex: number;
  questionStartedAt: number;
  phase: 'question' | 'reveal' | 'finished';
  revealStartedAt: number | null;
  scores: Record<string, ScoreEntry>;
  answers: Record<string, Record<number, AnswerEntry>>;
}

export interface RoomSettings {
  rounds: number;
  timerSeconds: number;
  showExplanationsAtEnd: boolean;
}

export interface Room {
  code: string;
  hostId: string;
  players: RoomPlayer[];
  deckId: string | null;
  deckName: string | null;
  settings: RoomSettings;
  status: 'lobby' | 'playing' | 'finished';
  game: GameState | null;
  createdAt: number;
  lastActivity: number;
  version: number;
  updatedAt: number;
}

export interface SanitizedPlayer {
  id: string;
  name: string;
  color: string;
  isHost: boolean;
  connected: boolean;
}

export interface SanitizedQuestion {
  cardId: string;
  question: string;
  options: string[];
  correctAnswer?: string;
}

export interface SanitizedGameState {
  currentQuestionIndex: number;
  totalQuestions: number;
  phase: 'question' | 'reveal' | 'finished';
  timeRemainingMs: number | null;
  revealTimeRemainingMs: number | null;
  scores: Record<string, ScoreEntry>;
  currentQuestion: SanitizedQuestion | null;
  answeredPlayerIds: string[];
  currentAnswers: Record<string, AnswerEntry | null> | null;
  allAnswers: Record<string, Record<number, AnswerEntry>> | null;
  allQuestions: RoomQuestion[] | null;
}

export interface SanitizedRoom {
  code: string;
  hostId: string;
  players: SanitizedPlayer[];
  deckId: string | null;
  deckName: string | null;
  settings: RoomSettings;
  status: 'lobby' | 'playing' | 'finished';
  game: SanitizedGameState | null;
  version: number;
  updatedAt: number;
}
