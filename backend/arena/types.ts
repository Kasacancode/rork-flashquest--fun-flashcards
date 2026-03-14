// --- Arena type definitions ---
// All room, game, and sanitized types live here.
// Shared by repository, engine, and TRPC routes.

import { PLAYER_IDENTITIES } from '../../constants/avatar';
import type { AvatarIdentity, PlayerSuit } from '../../types/avatar';

export type { PlayerSuit };
export type PlayerIdentity = AvatarIdentity;
export { PLAYER_IDENTITIES };

export const PLAYER_COLORS = PLAYER_IDENTITIES.map((identity) => identity.color) as string[];

export const MAX_PLAYERS = 6;
export const ROOM_TTL_MS = 60 * 60 * 1000;
export const DISCONNECT_MS = 60 * 1000;
export const REVEAL_DURATION_MS = 2000;
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
  options: string[];
  correctAnswer?: string;
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
