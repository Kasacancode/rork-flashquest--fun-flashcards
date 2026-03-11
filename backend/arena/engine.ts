// --- Arena Game Engine ---
// Pure game logic. Functions take a Room, apply rules, return modified Room or null.
// No persistence concerns here — the TRPC router handles load/save via repository.
// This separation makes future websocket support straightforward.
//
// Phase progression model:
//   - Time-based transitions (timer expiry, reveal advance) are NOT driven by heartbeat.
//   - Mutations that depend on accurate phase call tick() to persist pending transitions.
//   - sanitizeRoom() derives the effective phase from timestamps for read-only display,
//     so clients always see the correct phase even between mutations.
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
} from './types';

import {
  PLAYER_COLORS,
  MAX_PLAYERS,
  DISCONNECT_MS,
  REVEAL_DURATION_MS,
  NO_TIMER_TIMEOUT_MS,
} from './types';

const CORRECT_BASE_POINTS = 100;
const MAX_SPEED_BONUS_POINTS = 50;
const NO_TIMER_SPEED_BONUS_WINDOW_MS = 15000;

function generatePlayerId(): string {
  return `p_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function normalizeAnswer(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9\s]/g, '');
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

export function createNewRoom(hostName: string, code: string): { room: Room; playerId: string } {
  const playerId = generatePlayerId();
  const now = Date.now();

  const room: Room = {
    code,
    hostId: playerId,
    players: [{
      id: playerId,
      name: hostName,
      color: PLAYER_COLORS[0],
      isHost: true,
      lastSeen: now,
    }],
    deckId: null,
    deckName: null,
    settings: { rounds: 10, timerSeconds: 0, showExplanationsAtEnd: true },
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
): { player: RoomPlayer; room: Room } | null {
  if (room.status !== 'lobby') {
    console.log(`[Engine] Cannot join room ${room.code}: status=${room.status}`);
    return null;
  }
  if (room.players.length >= MAX_PLAYERS) {
    console.log(`[Engine] Cannot join room ${room.code}: full`);
    return null;
  }

  const player: RoomPlayer = {
    id: generatePlayerId(),
    name: playerName,
    color: PLAYER_COLORS[room.players.length % PLAYER_COLORS.length],
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
  if (playerId !== room.hostId || room.players.length < 2 || !room.deckId) return null;

  const scores: Record<string, ScoreEntry> = {};
  const answers: Record<string, Record<number, AnswerEntry>> = {};

  for (const p of room.players) {
    scores[p.id] = { correct: 0, incorrect: 0, points: 0, currentStreak: 0, bestStreak: 0 };
    answers[p.id] = {};
  }

  room.game = {
    questions,
    currentQuestionIndex: 0,
    questionStartedAt: Date.now(),
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
  if (!room.game || playerId !== room.hostId || room.game.phase !== 'reveal') return null;

  const nextIndex = room.game.currentQuestionIndex + 1;
  if (nextIndex >= room.game.questions.length) {
    room.game.phase = 'finished';
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
  if (playerId !== room.hostId) return null;

  room.status = 'lobby';
  room.game = null;
  room.lastActivity = Date.now();
  console.log(`[Engine] Room ${room.code} reset to lobby`);
  return room;
}

// --- Tick: advance game phases based on time ---
// Called on MUTATION paths only (submitAnswer, nextQuestion) to persist pending transitions.
// Never called from read paths (getRoomState) or heartbeat.
// Returns true if room state was mutated and needs to be saved.

export function tick(room: Room): boolean {
  if (!room.game) return false;
  let changed = false;

  if (room.game.phase === 'question') {
    if (checkTimerExpiry(room)) changed = true;
    if (checkDisconnectedPlayers(room)) changed = true;
    if (checkAllAnswered(room)) changed = true;
  } else if (room.game.phase === 'reveal') {
    if (checkRevealAdvance(room)) changed = true;
  }

  return changed;
}

// --- Internal tick helpers ---

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

function checkTimerExpiry(room: Room): boolean {
  if (!room.game || room.settings.timerSeconds === 0) return false;
  const elapsed = Date.now() - room.game.questionStartedAt;
  if (elapsed < room.settings.timerSeconds * 1000) return false;

  const qi = room.game.currentQuestionIndex;
  for (const p of room.players) {
    if (!room.game.answers[p.id]?.[qi]) {
      if (!room.game.answers[p.id]) room.game.answers[p.id] = {};
      room.game.answers[p.id][qi] = {
        selectedOption: '',
        isCorrect: false,
        timeToAnswerMs: room.settings.timerSeconds * 1000,
      };
      const s = room.game.scores[p.id];
      if (s) {
        s.incorrect++;
        s.currentStreak = 0;
      }
    }
  }

  room.game.phase = 'reveal';
  room.game.revealStartedAt = Date.now();
  return true;
}

function checkDisconnectedPlayers(room: Room): boolean {
  if (!room.game || room.settings.timerSeconds > 0) return false;
  const qi = room.game.currentQuestionIndex;
  const now = Date.now();
  let changed = false;

  for (const p of room.players) {
    if (room.game.answers[p.id]?.[qi]) continue;
    const timedOut = (now - room.game.questionStartedAt) > NO_TIMER_TIMEOUT_MS;
    if (timedOut) {
      if (!room.game.answers[p.id]) room.game.answers[p.id] = {};
      room.game.answers[p.id][qi] = {
        selectedOption: '',
        isCorrect: false,
        timeToAnswerMs: now - room.game.questionStartedAt,
      };
      const s = room.game.scores[p.id];
      if (s) {
        s.incorrect++;
        s.currentStreak = 0;
      }
      changed = true;
    }
  }

  if (changed) checkAllAnswered(room);
  return changed;
}

function checkRevealAdvance(room: Room): boolean {
  if (!room.game || room.game.phase !== 'reveal' || !room.game.revealStartedAt) return false;
  if (Date.now() - room.game.revealStartedAt < REVEAL_DURATION_MS) return false;

  const nextIndex = room.game.currentQuestionIndex + 1;
  if (nextIndex >= room.game.questions.length) {
    room.game.phase = 'finished';
    room.status = 'finished';
    console.log(`[Engine] Game finished in room ${room.code}`);
  } else {
    room.game.currentQuestionIndex = nextIndex;
    room.game.questionStartedAt = Date.now();
    room.game.phase = 'question';
    room.game.revealStartedAt = null;
    console.log(`[Engine] Advanced to question ${nextIndex + 1} in room ${room.code}`);
  }

  room.lastActivity = Date.now();
  return true;
}

// --- Derive effective phase from timestamps (read-only, no mutation) ---
// Computes what phase the game should be in based on persisted timestamps.
// Used by sanitizeRoom so clients see accurate state without requiring mutations.

interface DerivedPhaseResult {
  phase: 'question' | 'reveal' | 'finished';
  currentQuestionIndex: number;
  revealStartedAt: number | null;
  questionStartedAt: number;
}

function deriveEffectivePhase(room: Room): DerivedPhaseResult {
  const g = room.game!;
  let phase = g.phase;
  let qi = g.currentQuestionIndex;
  let revealStartedAt = g.revealStartedAt;
  let questionStartedAt = g.questionStartedAt;
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

  return { phase, currentQuestionIndex: qi, revealStartedAt, questionStartedAt };
}

// --- Sanitize room for client consumption ---
// Hides correct answers until reveal/finished phase.
// Derives effective phase from timestamps so clients see accurate state
// even when no mutation has persisted the transition yet.

export function sanitizeRoom(room: Room): SanitizedRoom {
  const now = Date.now();

  const players: SanitizedPlayer[] = room.players.map(p => ({
    id: p.id,
    name: p.name,
    color: p.color,
    isHost: p.isHost,
    connected: (now - p.lastSeen) < DISCONNECT_MS,
  }));

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
