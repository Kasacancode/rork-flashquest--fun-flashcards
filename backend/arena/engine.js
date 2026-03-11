"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.createNewRoom = createNewRoom;
exports.joinRoom = joinRoom;
exports.leaveRoom = leaveRoom;
exports.removePlayer = removePlayer;
exports.selectDeck = selectDeck;
exports.updateSettings = updateSettings;
exports.startGame = startGame;
exports.submitAnswer = submitAnswer;
exports.advanceQuestion = advanceQuestion;
exports.resetRoom = resetRoom;
exports.tick = tick;
exports.sanitizeRoom = sanitizeRoom;
const types_1 = require("./types");
const CORRECT_BASE_POINTS = 100;
const MAX_SPEED_BONUS_POINTS = 50;
const NO_TIMER_SPEED_BONUS_WINDOW_MS = 15000;
function generatePlayerId() {
    return `p_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
function normalizeAnswer(s) {
    return s.toLowerCase().trim().replace(/[^a-z0-9\s]/g, '');
}
function getIdentityByKey(identityKey) {
    return types_1.PLAYER_IDENTITIES.find((identity) => identity.key === identityKey) ?? null;
}
function resolvePlayerIdentity(player, index, usedKeys) {
    const existingIdentity = getIdentityByKey(player.identityKey);
    const fallbackIdentity = types_1.PLAYER_IDENTITIES.find((identity) => !usedKeys.has(identity.key))
        ?? types_1.PLAYER_IDENTITIES[index % types_1.PLAYER_IDENTITIES.length];
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
function getResolvedPlayers(players) {
    const usedKeys = new Set();
    return players.map((player, index) => resolvePlayerIdentity(player, index, usedKeys));
}
function normalizeRoomPlayers(room) {
    room.players = getResolvedPlayers(room.players);
}
function getNextAvailableIdentity(room) {
    const usedKeys = new Set(getResolvedPlayers(room.players).map((player) => player.identityKey));
    return types_1.PLAYER_IDENTITIES.find((identity) => !usedKeys.has(identity.key)) ?? null;
}
function calculateCorrectAnswerPoints(room, timeToAnswerMs) {
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
function createNewRoom(hostName, code) {
    const playerId = generatePlayerId();
    const now = Date.now();
    const hostIdentity = types_1.PLAYER_IDENTITIES[0];
    const room = {
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
        settings: { rounds: 10, timerSeconds: 5, showExplanationsAtEnd: true },
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
function joinRoom(room, playerName) {
    normalizeRoomPlayers(room);
    if (room.status !== 'lobby') {
        console.log(`[Engine] Cannot join room ${room.code}: status=${room.status}`);
        return null;
    }
    if (room.players.length >= types_1.MAX_PLAYERS) {
        console.log(`[Engine] Cannot join room ${room.code}: full`);
        return null;
    }
    const nextIdentity = getNextAvailableIdentity(room);
    if (!nextIdentity) {
        console.log(`[Engine] Cannot join room ${room.code}: no player identities left`);
        return null;
    }
    const player = {
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
function leaveRoom(room, playerId) {
    normalizeRoomPlayers(room);
    if (playerId === room.hostId) {
        console.log(`[Engine] Host left, destroying room ${room.code}`);
        return null;
    }
    room.players = room.players.filter(p => p.id !== playerId);
    room.lastActivity = Date.now();
    if (room.players.length === 0)
        return null;
    return room;
}
// --- Remove player (host only) ---
function removePlayer(room, targetId, requesterId) {
    normalizeRoomPlayers(room);
    if (requesterId !== room.hostId || targetId === room.hostId)
        return null;
    room.players = room.players.filter(p => p.id !== targetId);
    room.lastActivity = Date.now();
    console.log(`[Engine] Removed player ${targetId} from room ${room.code}`);
    return room;
}
// --- Deck selection (host only) ---
function selectDeck(room, playerId, deckId, deckName) {
    normalizeRoomPlayers(room);
    if (playerId !== room.hostId)
        return null;
    room.deckId = deckId;
    room.deckName = deckName;
    room.lastActivity = Date.now();
    return room;
}
// --- Settings update (host only) ---
function updateSettings(room, playerId, updates) {
    normalizeRoomPlayers(room);
    if (playerId !== room.hostId)
        return null;
    room.settings = { ...room.settings, ...updates };
    room.lastActivity = Date.now();
    return room;
}
// --- Start game (host only, 2+ players, deck selected) ---
function startGame(room, playerId, questions) {
    normalizeRoomPlayers(room);
    if (playerId !== room.hostId || room.players.length < 2 || !room.deckId)
        return null;
    const scores = {};
    const answers = {};
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
function submitAnswer(room, playerId, questionIndex, selectedOption) {
    normalizeRoomPlayers(room);
    if (!room.game || room.game.phase !== 'question')
        return null;
    if (room.game.currentQuestionIndex !== questionIndex)
        return null;
    if (room.game.answers[playerId]?.[questionIndex])
        return null;
    const question = room.game.questions[questionIndex];
    if (!question)
        return null;
    const isCorrect = normalizeAnswer(selectedOption) === normalizeAnswer(question.correctAnswer);
    const timeToAnswerMs = Date.now() - room.game.questionStartedAt;
    const awardedPoints = isCorrect ? calculateCorrectAnswerPoints(room, timeToAnswerMs) : 0;
    if (!room.game.answers[playerId])
        room.game.answers[playerId] = {};
    room.game.answers[playerId][questionIndex] = { selectedOption, isCorrect, timeToAnswerMs };
    const s = room.game.scores[playerId];
    if (s) {
        if (isCorrect) {
            s.correct++;
            s.points += awardedPoints;
            s.currentStreak++;
            s.bestStreak = Math.max(s.bestStreak, s.currentStreak);
        }
        else {
            s.incorrect++;
            s.currentStreak = 0;
        }
    }
    room.lastActivity = Date.now();
    checkAllAnswered(room);
    return { room, isCorrect };
}
// --- Advance question (host, during reveal) ---
function advanceQuestion(room, playerId) {
    normalizeRoomPlayers(room);
    if (!room.game || playerId !== room.hostId || room.game.phase !== 'reveal')
        return null;
    const nextIndex = room.game.currentQuestionIndex + 1;
    if (nextIndex >= room.game.questions.length) {
        room.game.phase = 'finished';
        room.status = 'finished';
    }
    else {
        room.game.currentQuestionIndex = nextIndex;
        room.game.questionStartedAt = Date.now();
        room.game.phase = 'question';
        room.game.revealStartedAt = null;
    }
    room.lastActivity = Date.now();
    return room;
}
// --- Reset room (host) ---
function resetRoom(room, playerId) {
    normalizeRoomPlayers(room);
    if (playerId !== room.hostId)
        return null;
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
function tick(room) {
    normalizeRoomPlayers(room);
    if (!room.game)
        return false;
    let changed = false;
    if (room.game.phase === 'question') {
        if (checkTimerExpiry(room))
            changed = true;
        if (checkDisconnectedPlayers(room))
            changed = true;
        if (checkAllAnswered(room))
            changed = true;
    }
    else if (room.game.phase === 'reveal') {
        if (checkRevealAdvance(room))
            changed = true;
    }
    return changed;
}
// --- Internal tick helpers ---
function checkAllAnswered(room) {
    if (!room.game || room.game.phase !== 'question')
        return false;
    const qi = room.game.currentQuestionIndex;
    const allAnswered = room.players.every(p => room.game.answers[p.id]?.[qi] !== undefined);
    if (allAnswered) {
        room.game.phase = 'reveal';
        room.game.revealStartedAt = Date.now();
        return true;
    }
    return false;
}
function checkTimerExpiry(room) {
    if (!room.game || room.settings.timerSeconds === 0)
        return false;
    const elapsed = Date.now() - room.game.questionStartedAt;
    if (elapsed < room.settings.timerSeconds * 1000)
        return false;
    const qi = room.game.currentQuestionIndex;
    for (const p of room.players) {
        if (!room.game.answers[p.id]?.[qi]) {
            if (!room.game.answers[p.id])
                room.game.answers[p.id] = {};
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
function checkDisconnectedPlayers(room) {
    if (!room.game || room.settings.timerSeconds > 0)
        return false;
    const qi = room.game.currentQuestionIndex;
    const now = Date.now();
    let changed = false;
    for (const p of room.players) {
        if (room.game.answers[p.id]?.[qi])
            continue;
        const timedOut = (now - room.game.questionStartedAt) > types_1.NO_TIMER_TIMEOUT_MS;
        if (timedOut) {
            if (!room.game.answers[p.id])
                room.game.answers[p.id] = {};
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
    if (changed)
        checkAllAnswered(room);
    return changed;
}
function checkRevealAdvance(room) {
    if (!room.game || room.game.phase !== 'reveal' || !room.game.revealStartedAt)
        return false;
    if (Date.now() - room.game.revealStartedAt < types_1.REVEAL_DURATION_MS)
        return false;
    const nextIndex = room.game.currentQuestionIndex + 1;
    if (nextIndex >= room.game.questions.length) {
        room.game.phase = 'finished';
        room.status = 'finished';
        console.log(`[Engine] Game finished in room ${room.code}`);
    }
    else {
        room.game.currentQuestionIndex = nextIndex;
        room.game.questionStartedAt = Date.now();
        room.game.phase = 'question';
        room.game.revealStartedAt = null;
        console.log(`[Engine] Advanced to question ${nextIndex + 1} in room ${room.code}`);
    }
    room.lastActivity = Date.now();
    return true;
}
function deriveEffectivePhase(room) {
    const g = room.game;
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
            const noTimerTimeout = room.settings.timerSeconds === 0 && elapsed >= types_1.NO_TIMER_TIMEOUT_MS;
            if (timerExpired || allAnswered || noTimerTimeout) {
                phase = 'reveal';
                if (!revealStartedAt) {
                    revealStartedAt = timerExpired
                        ? questionStartedAt + timerMs
                        : noTimerTimeout
                            ? questionStartedAt + types_1.NO_TIMER_TIMEOUT_MS
                            : now;
                }
            }
            else {
                break;
            }
        }
        if (phase === 'reveal' && revealStartedAt) {
            if ((now - revealStartedAt) >= types_1.REVEAL_DURATION_MS) {
                const nextIdx = qi + 1;
                if (nextIdx >= g.questions.length) {
                    phase = 'finished';
                    break;
                }
                else {
                    qi = nextIdx;
                    questionStartedAt = revealStartedAt + types_1.REVEAL_DURATION_MS;
                    revealStartedAt = null;
                    phase = 'question';
                }
            }
            else {
                break;
            }
        }
        if (phase === 'finished')
            break;
    }
    return { phase, currentQuestionIndex: qi, revealStartedAt, questionStartedAt };
}
// --- Sanitize room for client consumption ---
// Hides correct answers until reveal/finished phase.
// Derives effective phase from timestamps so clients see accurate state
// even when no mutation has persisted the transition yet.
function sanitizeRoom(room) {
    const now = Date.now();
    const resolvedPlayers = getResolvedPlayers(room.players);
    const players = resolvedPlayers.map(p => ({
        id: p.id,
        name: p.name,
        color: p.color,
        identityKey: p.identityKey,
        identityLabel: p.identityLabel,
        suit: p.suit,
        isHost: p.isHost,
        connected: (now - p.lastSeen) < types_1.DISCONNECT_MS,
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
    const effectiveStatus = effectivePhase === 'finished' ? 'finished' : room.status;
    const timeRemainingMs = room.settings.timerSeconds > 0 && effectivePhase === 'question'
        ? Math.max(0, room.settings.timerSeconds * 1000 - (now - effectiveQuestionStartedAt))
        : null;
    const revealTimeRemainingMs = effectivePhase === 'reveal' && effectiveRevealStartedAt
        ? Math.max(0, types_1.REVEAL_DURATION_MS - (now - effectiveRevealStartedAt))
        : null;
    const answeredPlayerIds = room.players
        .filter(p => g.answers[p.id]?.[effectiveQi] !== undefined)
        .map(p => p.id);
    const currentAnswers = isRevealOrDone
        ? Object.fromEntries(room.players.map(p => [p.id, g.answers[p.id]?.[effectiveQi] ?? null]))
        : null;
    const currentQuestion = q
        ? {
            cardId: q.cardId,
            question: q.question,
            options: q.options,
            correctAnswer: isRevealOrDone ? q.correctAnswer : undefined,
        }
        : null;
    const game = {
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
