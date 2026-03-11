// --- Arena type definitions ---
// All room, game, and sanitized types live here.
// Shared by repository, engine, and TRPC routes.

export type PlayerSuit = '♠' | '♥' | '♦' | '♣';

export interface PlayerIdentity {
  key: string;
  colorName: string;
  suit: PlayerSuit;
  label: string;
  color: string;
}

export const PLAYER_IDENTITIES = [
  { key: 'blue-spade', colorName: 'Blue', suit: '♠', label: 'Blue ♠', color: '#2563EB' },
  { key: 'red-heart', colorName: 'Red', suit: '♥', label: 'Red ♥', color: '#DC2626' },
  { key: 'green-diamond', colorName: 'Green', suit: '♦', label: 'Green ♦', color: '#16A34A' },
  { key: 'purple-club', colorName: 'Purple', suit: '♣', label: 'Purple ♣', color: '#7C3AED' },
  { key: 'gold-spade', colorName: 'Gold', suit: '♠', label: 'Gold ♠', color: '#D97706' },
  { key: 'pink-heart', colorName: 'Pink', suit: '♥', label: 'Pink ♥', color: '#DB2777' },
] as const satisfies readonly PlayerIdentity[];

export const PLAYER_COLORS = PLAYER_IDENTITIES.map((identity) => identity.color) as string[];

export const MAX_PLAYERS = 6;
export const ROOM_TTL_MS = 60 * 60 * 1000;
export const DISCONNECT_MS = 60 * 1000;
export const REVEAL_DURATION_MS = 3500;
export const NO_TIMER_TIMEOUT_MS = 90 * 1000;

export interface RoomPlayer {
  id: string;
  name: string;
  color: string;
  identityKey: string;
  identityLabel: string;
  suit: PlayerSuit;
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
  identityKey: string;
  identityLabel: string;
  suit: PlayerSuit;
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
