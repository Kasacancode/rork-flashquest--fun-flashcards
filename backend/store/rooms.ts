const PLAYER_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
  '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F',
  '#BB8FCE', '#85C1E9', '#F8B500', '#00CED1',
];

const STALE_ROOM_MS = 30 * 60 * 1000;
const DISCONNECT_MS = 15 * 1000;
const REVEAL_DURATION_MS = 4000;
const NO_TIMER_TIMEOUT_MS = 60 * 1000;

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
}

function normalizeAnswer(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9\s]/g, '');
}

class RoomStore {
  private rooms = new Map<string, Room>();
  private lastCleanup = Date.now();

  private generateCode(): string {
    let code: string;
    do {
      code = Math.floor(100000 + Math.random() * 900000).toString();
    } while (this.rooms.has(code));
    return code;
  }

  private generateId(): string {
    return `p_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private maybeCleanup(): void {
    if (Date.now() - this.lastCleanup < 60000) return;
    this.lastCleanup = Date.now();
    const now = Date.now();
    for (const [code, room] of this.rooms.entries()) {
      if (now - room.lastActivity > STALE_ROOM_MS) {
        console.log(`[RoomStore] Cleaning stale room ${code}`);
        this.rooms.delete(code);
      }
    }
  }

  createRoom(hostName: string): { room: Room; playerId: string } {
    this.maybeCleanup();
    const code = this.generateCode();
    const playerId = this.generateId();

    const room: Room = {
      code,
      hostId: playerId,
      players: [{
        id: playerId,
        name: hostName,
        color: PLAYER_COLORS[0],
        isHost: true,
        lastSeen: Date.now(),
      }],
      deckId: null,
      deckName: null,
      settings: { rounds: 10, timerSeconds: 0, showExplanationsAtEnd: true },
      status: 'lobby',
      game: null,
      createdAt: Date.now(),
      lastActivity: Date.now(),
    };

    this.rooms.set(code, room);
    console.log(`[RoomStore] Created room ${code} by ${hostName}`);
    return { room, playerId };
  }

  getRoom(code: string): Room | null {
    return this.rooms.get(code) ?? null;
  }

  joinRoom(code: string, playerName: string): { player: RoomPlayer; room: Room } | null {
    const room = this.rooms.get(code);
    if (!room || room.status !== 'lobby' || room.players.length >= 12) return null;

    const player: RoomPlayer = {
      id: this.generateId(),
      name: playerName,
      color: PLAYER_COLORS[room.players.length % PLAYER_COLORS.length],
      isHost: false,
      lastSeen: Date.now(),
    };

    room.players.push(player);
    room.lastActivity = Date.now();
    console.log(`[RoomStore] ${playerName} joined room ${code} (${room.players.length} players)`);
    return { player, room };
  }

  leaveRoom(code: string, playerId: string): Room | null {
    const room = this.rooms.get(code);
    if (!room) return null;

    if (playerId === room.hostId) {
      console.log(`[RoomStore] Host left, destroying room ${code}`);
      this.rooms.delete(code);
      return null;
    }

    room.players = room.players.filter(p => p.id !== playerId);
    room.lastActivity = Date.now();

    if (room.players.length === 0) {
      this.rooms.delete(code);
      return null;
    }

    return room;
  }

  removePlayer(code: string, targetId: string, requesterId: string): Room | null {
    const room = this.rooms.get(code);
    if (!room || requesterId !== room.hostId || targetId === room.hostId) return null;

    room.players = room.players.filter(p => p.id !== targetId);
    room.lastActivity = Date.now();
    console.log(`[RoomStore] Removed player ${targetId} from room ${code}`);
    return room;
  }

  selectDeck(code: string, playerId: string, deckId: string, deckName: string): Room | null {
    const room = this.rooms.get(code);
    if (!room || playerId !== room.hostId) return null;

    room.deckId = deckId;
    room.deckName = deckName;
    room.lastActivity = Date.now();
    return room;
  }

  updateSettings(code: string, playerId: string, updates: Partial<RoomSettings>): Room | null {
    const room = this.rooms.get(code);
    if (!room || playerId !== room.hostId) return null;

    room.settings = { ...room.settings, ...updates };
    room.lastActivity = Date.now();
    return room;
  }

  startGame(code: string, playerId: string, questions: RoomQuestion[]): Room | null {
    const room = this.rooms.get(code);
    if (!room || playerId !== room.hostId || room.players.length < 2 || !room.deckId) return null;

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
    console.log(`[RoomStore] Game started in room ${code} with ${questions.length} questions`);
    return room;
  }

  submitAnswer(
    code: string,
    playerId: string,
    questionIndex: number,
    selectedOption: string,
  ): { room: Room; isCorrect: boolean } | null {
    const room = this.rooms.get(code);
    if (!room?.game || room.game.phase !== 'question') return null;
    if (room.game.currentQuestionIndex !== questionIndex) return null;
    if (room.game.answers[playerId]?.[questionIndex]) return null;

    const question = room.game.questions[questionIndex];
    if (!question) return null;

    const isCorrect = normalizeAnswer(selectedOption) === normalizeAnswer(question.correctAnswer);
    const timeToAnswerMs = Date.now() - room.game.questionStartedAt;

    if (!room.game.answers[playerId]) room.game.answers[playerId] = {};
    room.game.answers[playerId][questionIndex] = { selectedOption, isCorrect, timeToAnswerMs };

    const s = room.game.scores[playerId];
    if (s) {
      if (isCorrect) {
        s.correct++;
        s.points++;
        s.currentStreak++;
        s.bestStreak = Math.max(s.bestStreak, s.currentStreak);
      } else {
        s.incorrect++;
        s.currentStreak = 0;
      }
    }

    room.lastActivity = Date.now();
    this.checkAllAnswered(room);
    return { room, isCorrect };
  }

  advanceQuestion(code: string, playerId: string): Room | null {
    const room = this.rooms.get(code);
    if (!room?.game || playerId !== room.hostId || room.game.phase !== 'reveal') return null;

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

  resetRoom(code: string, playerId: string): Room | null {
    const room = this.rooms.get(code);
    if (!room || playerId !== room.hostId) return null;

    room.status = 'lobby';
    room.game = null;
    room.lastActivity = Date.now();
    console.log(`[RoomStore] Room ${code} reset to lobby`);
    return room;
  }

  heartbeat(code: string, playerId: string): void {
    const room = this.rooms.get(code);
    if (!room) return;

    const player = room.players.find(p => p.id === playerId);
    if (player) player.lastSeen = Date.now();
    room.lastActivity = Date.now();
  }

  tick(code: string): void {
    const room = this.rooms.get(code);
    if (!room?.game) return;

    if (room.game.phase === 'question') {
      this.checkTimerExpiry(room);
      this.checkDisconnectedPlayers(room);
      this.checkAllAnswered(room);
    } else if (room.game.phase === 'reveal') {
      this.checkRevealAdvance(room);
    }
  }

  private checkAllAnswered(room: Room): void {
    if (!room.game || room.game.phase !== 'question') return;
    const qi = room.game.currentQuestionIndex;
    const allAnswered = room.players.every(p => room.game!.answers[p.id]?.[qi] !== undefined);
    if (allAnswered) {
      room.game.phase = 'reveal';
      room.game.revealStartedAt = Date.now();
    }
  }

  private checkTimerExpiry(room: Room): void {
    if (!room.game || room.settings.timerSeconds === 0) return;
    const elapsed = Date.now() - room.game.questionStartedAt;
    if (elapsed < room.settings.timerSeconds * 1000) return;

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
  }

  private checkDisconnectedPlayers(room: Room): void {
    if (!room.game || room.settings.timerSeconds > 0) return;
    const qi = room.game.currentQuestionIndex;
    const now = Date.now();
    let changed = false;

    for (const p of room.players) {
      if (room.game.answers[p.id]?.[qi]) continue;

      const disconnected = (now - p.lastSeen) > DISCONNECT_MS;
      const timedOut = (now - room.game.questionStartedAt) > NO_TIMER_TIMEOUT_MS;

      if (disconnected || timedOut) {
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

    if (changed) this.checkAllAnswered(room);
  }

  private checkRevealAdvance(room: Room): void {
    if (!room.game || room.game.phase !== 'reveal' || !room.game.revealStartedAt) return;
    if (Date.now() - room.game.revealStartedAt < REVEAL_DURATION_MS) return;

    const nextIndex = room.game.currentQuestionIndex + 1;
    if (nextIndex >= room.game.questions.length) {
      room.game.phase = 'finished';
      room.status = 'finished';
      console.log(`[RoomStore] Game finished in room ${room.code}`);
    } else {
      room.game.currentQuestionIndex = nextIndex;
      room.game.questionStartedAt = Date.now();
      room.game.phase = 'question';
      room.game.revealStartedAt = null;
    }
  }

  sanitize(room: Room): SanitizedRoom {
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
      };
    }

    const g = room.game;
    const qi = g.currentQuestionIndex;
    const q = g.questions[qi];
    const isRevealOrDone = g.phase === 'reveal' || g.phase === 'finished';

    const timeRemainingMs =
      room.settings.timerSeconds > 0 && g.phase === 'question'
        ? Math.max(0, room.settings.timerSeconds * 1000 - (now - g.questionStartedAt))
        : null;

    const revealTimeRemainingMs =
      g.phase === 'reveal' && g.revealStartedAt
        ? Math.max(0, REVEAL_DURATION_MS - (now - g.revealStartedAt))
        : null;

    const answeredPlayerIds = room.players
      .filter(p => g.answers[p.id]?.[qi] !== undefined)
      .map(p => p.id);

    const currentAnswers = isRevealOrDone
      ? Object.fromEntries(room.players.map(p => [p.id, g.answers[p.id]?.[qi] ?? null]))
      : null;

    const game: SanitizedGameState = {
      currentQuestionIndex: qi,
      totalQuestions: g.questions.length,
      phase: g.phase,
      timeRemainingMs,
      revealTimeRemainingMs,
      scores: g.scores,
      currentQuestion: q
        ? {
            cardId: q.cardId,
            question: q.question,
            options: q.options,
            correctAnswer: isRevealOrDone ? q.correctAnswer : undefined,
          }
        : null,
      answeredPlayerIds,
      currentAnswers,
      allAnswers: g.phase === 'finished' ? g.answers : null,
      allQuestions: g.phase === 'finished' ? g.questions : null,
    };

    return {
      code: room.code,
      hostId: room.hostId,
      players,
      deckId: room.deckId,
      deckName: room.deckName,
      settings: room.settings,
      status: room.status,
      game,
    };
  }

  getRoomCount(): number {
    return this.rooms.size;
  }
}

export const roomStore = new RoomStore();
