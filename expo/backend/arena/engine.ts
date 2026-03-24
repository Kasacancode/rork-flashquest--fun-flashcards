// --- Arena Game Engine ---
// Pure game logic. Functions take a Room, apply rules, return modified Room or null.
// No persistence concerns here — the TRPC router handles load/save via repository.
//
// Phase progression model:
//   - deriveEffectivePhase() is the SINGLE SOURCE OF TRUTH for phase computation.
//     It computes the correct phase from timestamps using chained arithmetic.
//   - tick() calls deriveEffectivePhase() to determine where the game should be,
//     then applies mutations (timeout answers, scores) to get the persisted state there.
//   - sanitizeRoom() also calls deriveEffectivePhase() for read-only display.
//   - Because tick and sanitizeRoom use the SAME function, they can never diverge.
//   - submitAnswer calls checkAllAnswered() for real-time "everyone answered" transitions.
//   - getRoomState is strictly read-only. heartbeat only updates presence/TTL.

import type {
  Room,
  RoomPlayer,
  RoomQuestion,
  RoomSettings,
  ScoreEntry,
  AnswerEntry,
  SanitizedRoom,
  SanitizedPlayer,
  SanitizedGameState,
  SanitizedQuestion,
  PlayerIdentity,
} from './types';

import {
  PLAYER_IDENTITIES,
  MAX_PLAYERS,
  DISCONNECT_MS,
  REVEAL_DURATION_MS,
  NO_TIMER_TIMEOUT_MS,
  DEFAULT_ARENA_SETTINGS,
} from './types';
import { DEFAULT_AVATAR_IDENTITY, getAvatarIdentityByKey } from '../../constants/avatar';

const CORRECT_BASE_POINTS = 100;
const MAX_SPEED_BONUS_POINTS = 50;
const NO_TIMER_SPEED_BONUS_WINDOW_MS = 15000;

function generatePlayerId(): string {
  return `p_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function normalizeAnswer(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9\s]/g, '');
}

function getIdentityByKey(identityKey: string | undefined): PlayerIdentity | null {
  return getAvatarIdentityByKey(identityKey);
}

function resolvePlayerIdentity(player: RoomPlayer, index: number, usedKeys: Set<string>): RoomPlayer {
  const existingIdentity = getIdentityByKey(player.identityKey);
  const fallbackIdentity = PLAYER_IDENTITIES.find((identity) => !usedKeys.has(identity.key))
    ?? PLAYER_IDENTITIES[index % PLAYER_IDENTITIES.length]!;
  const identity = existingIdentity && !usedKeys.has(existingIdentity.key) ? existingIdentity : fallbackIdentity;

  usedKeys.add(identity.key);

  return {
    ...player,
    color: identity.color,
    identityKey: identity.key,
    identityLabel: identity.label,
    suit: identity.suit,
  };
}

function getResolvedPlayers(players: RoomPlayer[]): RoomPlayer[] {
  const usedKeys = new Set<string>();
  return players.map((player, index) => resolvePlayerIdentity(player, index, usedKeys));
}

function normalizeRoomPlayers(room: Room): void {
  room.players = getResolvedPlayers(room.players);
}

function getNextAvailableIdentity(room: Room, preferredIdentityKey?: string): PlayerIdentity | null {
  const usedKeys = new Set(getResolvedPlayers(room.players).map((player) => player.identityKey));
  const preferredIdentity = getIdentityByKey(preferredIdentityKey);

  if (preferredIdentity && !usedKeys.has(preferredIdentity.key)) {
    return preferredIdentity;
  }

  return PLAYER_IDENTITIES.find((identity) => !usedKeys.has(identity.key)) ?? null;
}

function calculateCorrectAnswerPoints(room: Room, timeToAnswerMs: number): number {
  const bonusWindowMs = room.settings.timerSeconds > 0
    ? room.settings.timerSeconds * 1000
    : NO_TIMER_SPEED_BONUS_WINDOW_MS;
  const clampedElapsedMs = Math.max(0, Math.min(timeToAnswerMs, bonusWindowMs));
  const speedRatio = 1 - (clampedElapsedMs / bonusWindowMs);
  const speedBonus = Math.round(MAX_SPEED_BONUS_POINTS * speedRatio);

  // Score = 100 base points for any correct answer + up to 50 bonus points for faster answers.
  return CORRECT_BASE_POINTS + speedBonus;
}

// --- Room creation ---

export function createNewRoom(hostName: string, code: string, preferredIdentityKey?: string): { room: Room; playerId: string } {
  const playerId = generatePlayerId();
  const now = Date.now();
  const hostIdentity = getIdentityByKey(preferredIdentityKey) ?? DEFAULT_AVATAR_IDENTITY;

  const room: Room = {
    code,
    hostId: playerId,
    players: [{
      id: playerId,
      name: hostName,
      color: hostIdentity.color,
      identityKey: hostIdentity.key,
      identityLabel: hostIdentity.label,
      suit: hostIdentity.suit,
      isHost: true,
      lastSeen: now,
    }],
    deckId: null,
    deckName: null,
    settings: { ...DEFAULT_ARENA_SETTINGS },
    status: 'lobby',
    game: null,
    createdAt: now,
    lastActivity: now,
    version: 0,
    updatedAt: now,
  };

  console.log(`[Engine] Created room ${code} by ${hostName}`);
  return { room, playerId };
}

// --- Join ---

export function joinRoom(
  room: Room,
  playerName: string,
  preferredIdentityKey?: string,
): { player: RoomPlayer; room: Room } | null {
  normalizeRoomPlayers(room);

  if (room.status !== 'lobby') {
    console.log(`[Engine] Cannot join room ${room.code}: status=${room.status}`);
    return null;
  }
  if (room.players.length >= MAX_PLAYERS) {
    console.log(`[Engine] Cannot join room ${room.code}: full`);
    return null;
  }

  const nextIdentity = getNextAvailableIdentity(room, preferredIdentityKey);
  if (!nextIdentity) {
    console.log(`[Engine] Cannot join room ${room.code}: no player identities left`);
    return null;
  }

  const player: RoomPlayer = {
    id: generatePlayerId(),
    name: playerName,
    color: nextIdentity.color,
    identityKey: nextIdentity.key,
    identityLabel: nextIdentity.label,
    suit: nextIdentity.suit,
    isHost: false,
    lastSeen: Date.now(),
  };

  room.players.push(player);
  room.lastActivity = Date.now();
  console.log(`[Engine] ${playerName} joined room ${room.code} (${room.players.length} players)`);
  return { player, room };
}

// --- Leave ---
// Returns the updated room, or null if room should be destroyed.

export function leaveRoom(room: Room, playerId: string): Room | null {
  normalizeRoomPlayers(room);

  if (playerId === room.hostId) {
    console.log(`[Engine] Host left, destroying room ${room.code}`);
    return null;
  }

  room.players = room.players.filter(p => p.id !== playerId);
  room.lastActivity = Date.now();

  if (room.players.length === 0) return null;
  return room;
}

// --- Remove player (host only) ---

export function removePlayer(
  room: Room,
  targetId: string,
  requesterId: string,
): Room | null {
  normalizeRoomPlayers(room);
  if (requesterId !== room.hostId || targetId === room.hostId) return null;

  room.players = room.players.filter(p => p.id !== targetId);
  room.lastActivity = Date.now();
  console.log(`[Engine] Removed player ${targetId} from room ${room.code}`);
  return room;
}

// --- Deck selection (host only) ---

export function selectDeck(
  room: Room,
  playerId: string,
  deckId: string,
  deckName: string,
): Room | null {
  normalizeRoomPlayers(room);
  if (playerId !== room.hostId) return null;
  room.deckId = deckId;
  room.deckName = deckName;
  room.lastActivity = Date.now();
  return room;
}

// --- Settings update (host only) ---

export function updateSettings(
  room: Room,
  playerId: string,
  updates: Partial<RoomSettings>,
): Room | null {
  normalizeRoomPlayers(room);
  if (playerId !== room.hostId) return null;
  room.settings = { ...room.settings, ...updates };
  room.lastActivity = Date.now();
  return room;
}

// --- Start game (host only, 2+ players, deck selected) ---

export function startGame(
  room: Room,
  playerId: string,
  questions: RoomQuestion[],
): Room | null {
  normalizeRoomPlayers(room);
  if (playerId !== room.hostId || room.players.length < 2 || !room.deckId) return null;

  const scores: Record<string, ScoreEntry> = {};
  const answers: Record<string, Record<number, AnswerEntry>> = {};

  for (const p of room.players) {
    scores[p.id] = { correct: 0, incorrect: 0, points: 0, currentStreak: 0, bestStreak: 0 };
    answers[p.id] = {};
  }

  const now = Date.now();

  room.game = {
    questions,
    currentQuestionIndex: 0,
    questionStartedAt: now,
    startedAt: now,
    finishedAt: null,
    phase: 'question',
    revealStartedAt: null,
    scores,
    answers,
  };
  room.status = 'playing';
  room.lastActivity = Date.now();

  console.log(`[Engine] Game started in room ${room.code} with ${questions.length} questions`);
  return room;
}

// --- Submit answer ---

export function submitAnswer(
  room: Room,
  playerId: string,
  questionIndex: number,
  selectedOption: string,
): { room: Room; isCorrect: boolean } | null {
  normalizeRoomPlayers(room);
  if (!room.game || room.game.phase !== 'question') return null;
  if (room.game.currentQuestionIndex !== questionIndex) return null;
  if (room.game.answers[playerId]?.[questionIndex]) return null;

  const question = room.game.questions[questionIndex];
  if (!question) return null;

  const isCorrect = normalizeAnswer(selectedOption) === normalizeAnswer(question.correctAnswer);
  const timeToAnswerMs = Date.now() - room.game.questionStartedAt;
  const awardedPoints = isCorrect ? calculateCorrectAnswerPoints(room, timeToAnswerMs) : 0;

  if (!room.game.answers[playerId]) room.game.answers[playerId] = {};
  room.game.answers[playerId][questionIndex] = { selectedOption, isCorrect, timeToAnswerMs };

  const s = room.game.scores[playerId];
  if (s) {
    if (isCorrect) {
      s.correct++;
      s.points += awardedPoints;
      s.currentStreak++;
      s.bestStreak = Math.max(s.bestStreak, s.currentStreak);
    } else {
      s.incorrect++;
      s.currentStreak = 0;
    }
  }

  room.lastActivity = Date.now();

  checkAllAnswered(room);

  return { room, isCorrect };
}

// --- Advance question (host, during reveal) ---

export function advanceQuestion(room: Room, playerId: string): Room | null {
  normalizeRoomPlayers(room);
  if (!room.game || playerId !== room.hostId || room.game.phase !== 'reveal') return null;

  const nextIndex = room.game.currentQuestionIndex + 1;
  if (nextIndex >= room.game.questions.length) {
    room.game.phase = 'finished';
    room.game.finishedAt = Date.now();
    room.status = 'finished';
  } else {
    room.game.currentQuestionIndex = nextIndex;
    room.game.questionStartedAt = Date.now();
    room.game.phase = 'question';
    room.game.revealStartedAt = null;
  }

  room.lastActivity = Date.now();
  return room;
}

// --- Reset room (host) ---

export function resetRoom(room: Room, playerId: string): Room | null {
  normalizeRoomPlayers(room);
  if (playerId !== room.hostId) return null;

  room.status = 'lobby';
  room.game = null;
  room.lastActivity = Date.now();
  console.log(`[Engine] Room ${room.code} reset to lobby`);
  return room;
}

// --- Tick: advance persisted game state to match real time ---
// Called on mutation paths (submitAnswer, nextQuestion) to catch up the persisted room.
// Delegates ALL phase computation to deriveEffectivePhase — the same function used by
// sanitizeRoom for reads. This guarantees tick and the read path can never diverge.
//
// tick() does two things deriveEffectivePhase doesn't:
//   1. Fills in timeout answers (with scores) for players who didn't answer expired questions
//   2. Mutates the room object to persist the derived state
//
// Returns true if room state was mutated and needs to be saved.

export function tick(room: Room): boolean {
  normalizeRoomPlayers(room);
  if (!room.game) return false;

  const g = room.game;
  const derived = deriveEffectivePhase(room);

  // If persisted state already matches derived state, nothing to do
  if (
    g.phase === derived.phase
    && g.currentQuestionIndex === derived.currentQuestionIndex
    && g.questionStartedAt === derived.questionStartedAt
    && g.revealStartedAt === derived.revealStartedAt
    && g.finishedAt === derived.finishedAt
  ) {
    return false;
  }

  // Fill in timeout answers for every question we're advancing past.
  // If derived says we should be on question 5 but we're persisted at question 2,
  // questions 2-4 need timeout answers for any player who didn't answer.
  // If derived is in 'reveal' or 'finished', the current derived question also needs fills.
  const lastQiNeedingFills = (derived.phase === 'reveal' || derived.phase === 'finished')
    ? derived.currentQuestionIndex
    : derived.currentQuestionIndex - 1;

  for (let qi = g.currentQuestionIndex; qi <= lastQiNeedingFills; qi++) {
    fillTimeoutAnswers(room, qi);
  }

  // Apply derived state to room
  const previousQi = g.currentQuestionIndex;
  g.phase = derived.phase;
  g.currentQuestionIndex = derived.currentQuestionIndex;
  g.questionStartedAt = derived.questionStartedAt;
  g.revealStartedAt = derived.revealStartedAt;
  g.finishedAt = derived.finishedAt;

  if (derived.phase === 'finished') {
    room.status = 'finished';
    console.log(`[Engine] Game finished in room ${room.code}`);
  } else if (derived.currentQuestionIndex !== previousQi) {
    console.log(`[Engine] Advanced to question ${derived.currentQuestionIndex + 1} in room ${room.code}`);
  }

  room.lastActivity = Date.now();
  return true;
}

// Fill in blank (timeout) answers for a single question.
// For every player who has no answer recorded for this question,
// record a timeout answer and update their score.
function fillTimeoutAnswers(room: Room, qi: number): void {
  if (!room.game) return;
  if (qi < 0 || qi >= room.game.questions.length) return;

  const timerSeconds = room.settings.timerSeconds;
  const timeoutMs = timerSeconds > 0
    ? timerSeconds * 1000
    : NO_TIMER_TIMEOUT_MS;

  for (const p of room.players) {
    if (room.game.answers[p.id]?.[qi]) continue;

    if (!room.game.answers[p.id]) room.game.answers[p.id] = {};
    room.game.answers[p.id][qi] = {
      selectedOption: '',
      isCorrect: false,
      timeToAnswerMs: timeoutMs,
    };

    const s = room.game.scores[p.id];
    if (s) {
      s.incorrect++;
      s.currentStreak = 0;
    }
  }
}

// checkAllAnswered: Real-time transition when all players answer the current question.
// Called from submitAnswer (NOT from tick). When the last player submits their answer,
// this immediately transitions to reveal with Date.now() as the start time.
// This is the ONE place where a real-time (non-derived) transition happens.
function checkAllAnswered(room: Room): boolean {
  if (!room.game || room.game.phase !== 'question') return false;
  const qi = room.game.currentQuestionIndex;
  const allAnswered = room.players.every(p => room.game!.answers[p.id]?.[qi] !== undefined);
  if (allAnswered) {
    room.game.phase = 'reveal';
    room.game.revealStartedAt = Date.now();
    return true;
  }
  return false;
}

// --- Derive effective phase from timestamps (read-only, no mutation) ---
// Computes what phase the game should be in based on persisted timestamps.
// Used by sanitizeRoom so clients see accurate state without requiring mutations.

interface DerivedPhaseResult {
  phase: 'question' | 'reveal' | 'finished';
  currentQuestionIndex: number;
  revealStartedAt: number | null;
  questionStartedAt: number;
  finishedAt: number | null;
}

function deriveEffectivePhase(room: Room): DerivedPhaseResult {
  const g = room.game!;
  let phase = g.phase;
  let qi = g.currentQuestionIndex;
  let revealStartedAt = g.revealStartedAt;
  let questionStartedAt = g.questionStartedAt;
  let finishedAt = g.finishedAt;
  const now = Date.now();

  const maxIterations = g.questions.length * 2;
  let iterations = 0;

  while (iterations++ < maxIterations) {
    if (phase === 'question') {
      const timerMs = room.settings.timerSeconds * 1000;
      const elapsed = now - questionStartedAt;
      const timerExpired = room.settings.timerSeconds > 0 && elapsed >= timerMs;
      const allAnswered = room.players.every(p => g.answers[p.id]?.[qi] !== undefined);
      const noTimerTimeout = room.settings.timerSeconds === 0 && elapsed >= NO_TIMER_TIMEOUT_MS;

      if (timerExpired || allAnswered || noTimerTimeout) {
        phase = 'reveal';
        if (!revealStartedAt) {
          revealStartedAt = timerExpired
            ? questionStartedAt + timerMs
            : noTimerTimeout
              ? questionStartedAt + NO_TIMER_TIMEOUT_MS
              : now;
        }
      } else {
        break;
      }
    }

    if (phase === 'reveal' && revealStartedAt) {
      if ((now - revealStartedAt) >= REVEAL_DURATION_MS) {
        const nextIdx = qi + 1;
        if (nextIdx >= g.questions.length) {
          phase = 'finished';
          finishedAt = revealStartedAt + REVEAL_DURATION_MS;
          break;
        } else {
          qi = nextIdx;
          questionStartedAt = revealStartedAt + REVEAL_DURATION_MS;
          revealStartedAt = null;
          phase = 'question';
        }
      } else {
        break;
      }
    }

    if (phase === 'finished') break;
  }

  return { phase, currentQuestionIndex: qi, revealStartedAt, questionStartedAt, finishedAt };
}

// --- Sanitize room for client consumption ---
// Hides correct answers until reveal/finished phase.
// Derives effective phase from timestamps so clients see accurate state
// even when no mutation has persisted the transition yet.

export function sanitizeRoom(room: Room, playerLastSeenById?: Record<string, number>): SanitizedRoom {
  const now = Date.now();

  const resolvedPlayers = getResolvedPlayers(room.players);

  const players: SanitizedPlayer[] = resolvedPlayers.map((p) => {
    const lastSeen = playerLastSeenById?.[p.id] ?? p.lastSeen;

    return {
      id: p.id,
      name: p.name,
      color: p.color,
      identityKey: p.identityKey,
      identityLabel: p.identityLabel,
      suit: p.suit,
      isHost: p.isHost,
      connected: (now - lastSeen) < DISCONNECT_MS,
    };
  });

  if (!room.game) {
    return {
      code: room.code,
      hostId: room.hostId,
      players,
      deckId: room.deckId,
      deckName: room.deckName,
      settings: room.settings,
      status: room.status,
      game: null,
      version: room.version,
      updatedAt: room.updatedAt,
    };
  }

  const g = room.game;
  const derived = deriveEffectivePhase(room);
  const effectivePhase = derived.phase;
  const effectiveQi = derived.currentQuestionIndex;
  const effectiveRevealStartedAt = derived.revealStartedAt;
  const effectiveQuestionStartedAt = derived.questionStartedAt;
  const effectiveFinishedAt = derived.finishedAt;

  const q = g.questions[effectiveQi];
  const isRevealOrDone = effectivePhase === 'reveal' || effectivePhase === 'finished';
  const effectiveStatus = effectivePhase === 'finished' ? 'finished' as const : room.status;

  const timeRemainingMs =
    room.settings.timerSeconds > 0 && effectivePhase === 'question'
      ? Math.max(0, room.settings.timerSeconds * 1000 - (now - effectiveQuestionStartedAt))
      : null;

  const revealTimeRemainingMs =
    effectivePhase === 'reveal' && effectiveRevealStartedAt
      ? Math.max(0, REVEAL_DURATION_MS - (now - effectiveRevealStartedAt))
      : null;

  const answeredPlayerIds = room.players
    .filter(p => g.answers[p.id]?.[effectiveQi] !== undefined)
    .map(p => p.id);

  const currentAnswers = isRevealOrDone
    ? Object.fromEntries(room.players.map(p => [p.id, g.answers[p.id]?.[effectiveQi] ?? null]))
    : null;

  const currentQuestion: SanitizedQuestion | null = q
    ? {
        cardId: q.cardId,
        question: q.question,
        options: q.options,
        correctAnswer: isRevealOrDone ? q.correctAnswer : undefined,
      }
    : null;

  const game: SanitizedGameState = {
    currentQuestionIndex: effectiveQi,
    totalQuestions: g.questions.length,
    phase: effectivePhase,
    startedAt: g.startedAt ?? room.createdAt,
    finishedAt: effectiveFinishedAt,
    questionStartedAt: effectiveQuestionStartedAt,
    revealStartedAt: effectiveRevealStartedAt,
    timeRemainingMs,
    revealTimeRemainingMs,
    scores: g.scores,
    currentQuestion,
    answeredPlayerIds,
    currentAnswers,
    allAnswers: effectivePhase === 'finished' ? g.answers : null,
    allQuestions: effectivePhase === 'finished' ? g.questions : null,
  };

  return {
    code: room.code,
    hostId: room.hostId,
    players,
    deckId: room.deckId,
    deckName: room.deckName,
    settings: room.settings,
    status: effectiveStatus,
    game,
    version: room.version,
    updatedAt: room.updatedAt,
  };
}
