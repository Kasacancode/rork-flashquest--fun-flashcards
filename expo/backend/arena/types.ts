// --- Arena type definitions ---
// All room, game, and sanitized types live here.
// Shared by repository, engine, and TRPC routes.

import { PLAYER_IDENTITIES } from '../../constants/avatar';
import type { FlashcardAnswerType, FlashcardOption } from '../../types/flashcard';
import type { AvatarIdentity, PlayerSuit } from '../../types/avatar';

export type { PlayerSuit };
export type PlayerIdentity = AvatarIdentity;
export { PLAYER_IDENTITIES };

export const PLAYER_COLORS = PLAYER_IDENTITIES.map((identity) => identity.color) as string[];

export const MAX_PLAYERS = 6;
export const ROOM_TTL_MS = 60 * 60 * 1000;
export const DISCONNECT_MS = 60 * 1000;
export const REVEAL_DURATION_MS = 9000;
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
  correctAnswerDisplay: string;
  normalizedCorrectAnswer: string;
  answerType: FlashcardAnswerType;
  options: FlashcardOption[];
}

export const ARENA_BACKEND_ERROR_CODES = {
  DECK_NOT_SELECTED: 'ARENA_DECK_NOT_SELECTED',
  DECK_NOT_READY: 'ARENA_DECK_NOT_READY',
  DECK_NOT_FOUND: 'ARENA_DECK_NOT_FOUND',
  DECK_TOO_FEW_VALID_CARDS: 'ARENA_DECK_TOO_FEW_VALID_CARDS',
  DECK_CONTENT_TOO_LONG: 'ARENA_DECK_CONTENT_TOO_LONG',
  DECK_MALFORMED: 'ARENA_DECK_MALFORMED',
  NOT_ENOUGH_DISTINCT_ANSWERS: 'ARENA_NOT_ENOUGH_DISTINCT_ANSWERS',
  HOST_MISMATCH: 'ARENA_HOST_MISMATCH',
  MIN_PLAYERS_REQUIRED: 'ARENA_MIN_PLAYERS_REQUIRED',
  INVALID_ROOM_STATE: 'ARENA_INVALID_ROOM_STATE',
  ROOM_SAVE_FAILED: 'ARENA_ROOM_SAVE_FAILED',
  GAME_GENERATION_FAILED: 'ARENA_GAME_GENERATION_FAILED',
  DECK_UPLOAD_TOO_LARGE: 'ARENA_DECK_UPLOAD_TOO_LARGE',
} as const;

export type ArenaBackendErrorCode = (typeof ARENA_BACKEND_ERROR_CODES)[keyof typeof ARENA_BACKEND_ERROR_CODES];

export interface ArenaDeckSourceCard {
  id: string;
  question: string;
  answer: string;
}

export interface ArenaReadyCard {
  id: string;
  canonicalQuestion: string;
  canonicalAnswer: string;
  battleQuestion: string;
  battleAnswer: string;
  normalizedAnswer: string;
  answerType: FlashcardAnswerType;
}

export interface ArenaDeckPreparationDiagnostics {
  deckId: string;
  originalCardCount: number;
  validCardCount: number;
  usableCardCount: number;
  distinctAnswerCount: number;
  approxSerializedBytes: number;
}

export interface ArenaPreparedDeck {
  deckId: string;
  deckName: string;
  cards: ArenaReadyCard[];
  syncedAt: number;
  diagnostics: ArenaDeckPreparationDiagnostics;
}

export interface ArenaQuestionGenerationDiagnostics {
  deckId: string;
  originalCardCount: number;
  validCardCount: number;
  selectedRoundCount: number;
  distinctAnswerCount: number;
  approxSerializedRoomBytes: number;
}

export const MAX_ARENA_DECK_UPLOAD_CARDS = 500;
export const ARENA_OPTION_COUNT = 4;
export const MIN_ARENA_READY_CARDS = 4;
export const MAX_ARENA_QUESTION_LENGTH = 220;
export const MAX_ARENA_ANSWER_LENGTH = 120;

export interface ArenaDeckPreparationResult {
  preparedDeck: ArenaPreparedDeck;
  diagnostics: ArenaDeckPreparationDiagnostics;
}

export interface ArenaQuestionGenerationResult {
  questions: RoomQuestion[];
  diagnostics: ArenaQuestionGenerationDiagnostics;
}

export interface ArenaDeckSelectionResult {
  room: SanitizedRoom;
  diagnostics: ArenaDeckPreparationDiagnostics;
}

export interface ArenaGameStartResult {
  room: SanitizedRoom;
  diagnostics: ArenaQuestionGenerationDiagnostics;
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
  startedAt: number;
  finishedAt: number | null;
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

export const ARENA_ROUND_OPTIONS = [5, 10, 15, 20] as const;
export const ARENA_TIMER_OPTIONS = [0, 10, 15, 20] as const;

export type ArenaRoundOption = (typeof ARENA_ROUND_OPTIONS)[number];
export type ArenaTimerOption = (typeof ARENA_TIMER_OPTIONS)[number];

export const DEFAULT_ARENA_SETTINGS: RoomSettings = {
  rounds: 10,
  timerSeconds: 10,
  showExplanationsAtEnd: true,
};

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
  options: FlashcardOption[];
  correctAnswer?: string;
  correctAnswerDisplay?: string;
}

export interface SanitizedGameState {
  currentQuestionIndex: number;
  totalQuestions: number;
  phase: 'question' | 'reveal' | 'finished';
  startedAt: number;
  finishedAt: number | null;
  questionStartedAt: number;
  revealStartedAt: number | null;
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
