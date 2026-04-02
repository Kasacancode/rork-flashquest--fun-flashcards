import { describe, it, expect } from 'bun:test';

import {
  createNewRoom,
  joinRoom,
  leaveRoom,
  updateSettings,
  sanitizeRoom,
  selectDeck,
  removePlayer,
  startGame,
  submitAnswer,
  advanceQuestion,
  resetRoom,
} from '../engine';
import { MAX_PLAYERS, DEFAULT_ARENA_SETTINGS } from '../types';
import type { RoomQuestion } from '../types';

function buildTestQuestions(count: number): RoomQuestion[] {
  return Array.from({ length: count }, (_, index) => ({
    cardId: `card-${index}`,
    question: `Question ${index + 1}?`,
    correctAnswer: `Answer ${index + 1}`,
    correctAnswerDisplay: `Answer ${index + 1}`,
    normalizedCorrectAnswer: `answer ${index + 1}`,
    answerType: 'term' as const,
    options: [
      {
        id: `opt-${index}-0`,
        displayText: `Answer ${index + 1}`,
        canonicalValue: `Answer ${index + 1}`,
        normalizedValue: `answer ${index + 1}`,
        answerType: 'term' as const,
      },
      {
        id: `opt-${index}-1`,
        displayText: 'Wrong A',
        canonicalValue: 'Wrong A',
        normalizedValue: 'wrong a',
        answerType: 'term' as const,
      },
      {
        id: `opt-${index}-2`,
        displayText: 'Wrong B',
        canonicalValue: 'Wrong B',
        normalizedValue: 'wrong b',
        answerType: 'term' as const,
      },
      {
        id: `opt-${index}-3`,
        displayText: 'Wrong C',
        canonicalValue: 'Wrong C',
        normalizedValue: 'wrong c',
        answerType: 'term' as const,
      },
    ],
  }));
}

function buildTwoPlayerRoom(): {
  room: ReturnType<typeof createNewRoom>['room'];
  hostId: string;
  guestId: string;
} {
  const { room, playerId: hostId } = createNewRoom('Alice', 'TEST');
  const joinResult = joinRoom(room, 'Bob');

  if (!joinResult) {
    throw new Error('Failed to join room in test setup');
  }

  return { room: joinResult.room, hostId, guestId: joinResult.player.id };
}

function buildGameReadyRoom(): {
  room: ReturnType<typeof createNewRoom>['room'];
  hostId: string;
  guestId: string;
  questions: RoomQuestion[];
} {
  const { room, hostId, guestId } = buildTwoPlayerRoom();
  selectDeck(room, hostId, 'test-deck', 'Test Deck');
  const questions = buildTestQuestions(3);
  return { room, hostId, guestId, questions };
}

describe('createNewRoom', () => {
  it('creates a room with the given code', () => {
    const { room } = createNewRoom('Alice', 'ABCD');
    expect(room.code).toBe('ABCD');
  });

  it('sets the creator as host', () => {
    const { room, playerId } = createNewRoom('Alice', 'ABCD');
    expect(room.hostId).toBe(playerId);
    expect(room.players[0]!.isHost).toBe(true);
  });

  it('starts with one player', () => {
    const { room } = createNewRoom('Alice', 'ABCD');
    expect(room.players).toHaveLength(1);
  });

  it('sets the player name', () => {
    const { room } = createNewRoom('Alice', 'ABCD');
    expect(room.players[0]!.name).toBe('Alice');
  });

  it('starts in lobby state with no game', () => {
    const { room } = createNewRoom('Alice', 'ABCD');
    expect(room.game).toBeNull();
  });

  it('uses default settings', () => {
    const { room } = createNewRoom('Alice', 'ABCD');
    expect(room.settings.rounds).toBe(DEFAULT_ARENA_SETTINGS.rounds);
  });

  it('returns a unique player ID', () => {
    const { playerId: firstId } = createNewRoom('Alice', 'ABCD');
    const { playerId: secondId } = createNewRoom('Bob', 'EFGH');
    expect(firstId).not.toBe(secondId);
  });
});

describe('joinRoom', () => {
  it('adds a second player', () => {
    const { room } = createNewRoom('Alice', 'ABCD');
    const result = joinRoom(room, 'Bob');
    expect(result).not.toBeNull();
    expect(result!.room.players).toHaveLength(2);
  });

  it('marks the joiner as non-host', () => {
    const { room } = createNewRoom('Alice', 'ABCD');
    const result = joinRoom(room, 'Bob');
    const bob = result!.room.players.find((player) => player.name === 'Bob');
    expect(bob!.isHost).toBe(false);
  });

  it('returns a unique player ID for the joiner', () => {
    const { room, playerId: aliceId } = createNewRoom('Alice', 'ABCD');
    const result = joinRoom(room, 'Bob');
    expect(result!.player.id).not.toBe(aliceId);
  });

  it('rejects when room is full', () => {
    let { room } = createNewRoom('Host', 'FULL');
    for (let i = 1; i < MAX_PLAYERS; i += 1) {
      const result = joinRoom(room, `Player${i}`);
      if (result) {
        room = result.room;
      }
    }
    expect(room.players).toHaveLength(MAX_PLAYERS);
    const overflow = joinRoom(room, 'ExtraPlayer');
    expect(overflow).toBeNull();
  });
});

describe('leaveRoom', () => {
  it('removes the specified non-host player', () => {
    const { room } = createNewRoom('Alice', 'ABCD');
    const joinResult = joinRoom(room, 'Bob');
    const updated = leaveRoom(joinResult!.room, joinResult!.player.id);
    expect(updated).not.toBeNull();
    expect(updated!.players).toHaveLength(1);
  });

  it('returns null when the host leaves', () => {
    const { room, playerId } = createNewRoom('Alice', 'ABCD');
    const result = leaveRoom(room, playerId);
    expect(result).toBeNull();
  });
});

describe('updateSettings', () => {
  it('updates round count', () => {
    const { room, playerId } = createNewRoom('Alice', 'ABCD');
    const updated = updateSettings(room, playerId, { rounds: 10 });
    expect(updated).not.toBeNull();
    expect(updated!.settings.rounds).toBe(10);
  });

  it('rejects settings update from non-host', () => {
    const { room } = createNewRoom('Alice', 'ABCD');
    const joinResult = joinRoom(room, 'Bob');
    const updated = updateSettings(joinResult!.room, joinResult!.player.id, { rounds: 10 });
    expect(updated).toBeNull();
  });
});

describe('sanitizeRoom', () => {
  it('returns a sanitized view with the room code', () => {
    const { room } = createNewRoom('Alice', 'ABCD');
    const sanitized = sanitizeRoom(room);
    expect(sanitized.code).toBe('ABCD');
  });

  it('includes player info', () => {
    const { room } = createNewRoom('Alice', 'ABCD');
    const sanitized = sanitizeRoom(room);
    expect(sanitized.players).toHaveLength(1);
    expect(sanitized.players[0]!.name).toBe('Alice');
  });

  it('includes settings', () => {
    const { room } = createNewRoom('Alice', 'ABCD');
    const sanitized = sanitizeRoom(room);
    expect(sanitized.settings).toBeDefined();
  });
});

describe('selectDeck', () => {
  it('sets the deck on the room', () => {
    const { room, hostId } = buildTwoPlayerRoom();
    const updated = selectDeck(room, hostId, 'deck-1', 'My Deck');
    expect(updated).not.toBeNull();
    expect(updated!.deckId).toBe('deck-1');
    expect(updated!.deckName).toBe('My Deck');
  });

  it('rejects deck selection from non-host', () => {
    const { room, guestId } = buildTwoPlayerRoom();
    const updated = selectDeck(room, guestId, 'deck-1', 'My Deck');
    expect(updated).toBeNull();
  });
});

describe('removePlayer', () => {
  it('removes a non-host player', () => {
    const { room, hostId, guestId } = buildTwoPlayerRoom();
    const updated = removePlayer(room, guestId, hostId);
    expect(updated).not.toBeNull();
    expect(updated!.players).toHaveLength(1);
  });

  it('rejects removing the host', () => {
    const { room, hostId } = buildTwoPlayerRoom();
    const updated = removePlayer(room, hostId, hostId);
    expect(updated).toBeNull();
  });

  it('rejects removal request from non-host', () => {
    const { room, hostId, guestId } = buildTwoPlayerRoom();
    const updated = removePlayer(room, hostId, guestId);
    expect(updated).toBeNull();
  });
});

describe('startGame', () => {
  it('starts a game with valid setup', () => {
    const { room, hostId, questions } = buildGameReadyRoom();
    const updated = startGame(room, hostId, questions);
    expect(updated).not.toBeNull();
    expect(updated!.game).not.toBeNull();
    expect(updated!.status).toBe('playing');
  });

  it('initializes scores for all players', () => {
    const { room, hostId, guestId, questions } = buildGameReadyRoom();
    startGame(room, hostId, questions);
    expect(room.game!.scores[hostId]).toBeDefined();
    expect(room.game!.scores[guestId]).toBeDefined();
    expect(room.game!.scores[hostId]!.points).toBe(0);
    expect(room.game!.scores[hostId]!.correct).toBe(0);
  });

  it('starts at question index 0 in question phase', () => {
    const { room, hostId, questions } = buildGameReadyRoom();
    startGame(room, hostId, questions);
    expect(room.game!.currentQuestionIndex).toBe(0);
    expect(room.game!.phase).toBe('question');
  });

  it('rejects start from non-host', () => {
    const { room, guestId, questions } = buildGameReadyRoom();
    const updated = startGame(room, guestId, questions);
    expect(updated).toBeNull();
  });

  it('rejects start with only one player', () => {
    const { room, playerId } = createNewRoom('Alice', 'SOLO');
    selectDeck(room, playerId, 'deck-1', 'Deck');
    const updated = startGame(room, playerId, buildTestQuestions(3));
    expect(updated).toBeNull();
  });

  it('rejects start with no deck selected', () => {
    const { room, hostId } = buildTwoPlayerRoom();
    const updated = startGame(room, hostId, buildTestQuestions(3));
    expect(updated).toBeNull();
  });

  it('rejects start with empty questions', () => {
    const { room, hostId } = buildGameReadyRoom();
    const updated = startGame(room, hostId, []);
    expect(updated).toBeNull();
  });

  it('rejects start when game already exists', () => {
    const { room, hostId, questions } = buildGameReadyRoom();
    startGame(room, hostId, questions);
    const secondStart = startGame(room, hostId, questions);
    expect(secondStart).toBeNull();
  });
});

describe('submitAnswer', () => {
  it('records a correct answer and awards points', () => {
    const { room, hostId, questions } = buildGameReadyRoom();
    startGame(room, hostId, questions);
    const result = submitAnswer(room, hostId, 0, 'Answer 1');
    expect(result).not.toBeNull();
    expect(result!.isCorrect).toBe(true);
    expect(room.game!.scores[hostId]!.correct).toBe(1);
    expect(room.game!.scores[hostId]!.points).toBeGreaterThan(0);
  });

  it('records an incorrect answer with zero points', () => {
    const { room, hostId, questions } = buildGameReadyRoom();
    startGame(room, hostId, questions);
    const result = submitAnswer(room, hostId, 0, 'Wrong Answer');
    expect(result).not.toBeNull();
    expect(result!.isCorrect).toBe(false);
    expect(room.game!.scores[hostId]!.incorrect).toBe(1);
    expect(room.game!.scores[hostId]!.points).toBe(0);
  });

  it('rejects duplicate answer for same question', () => {
    const { room, hostId, questions } = buildGameReadyRoom();
    startGame(room, hostId, questions);
    submitAnswer(room, hostId, 0, 'Answer 1');
    const duplicate = submitAnswer(room, hostId, 0, 'Answer 1');
    expect(duplicate).toBeNull();
  });

  it('rejects answer for wrong question index', () => {
    const { room, hostId, questions } = buildGameReadyRoom();
    startGame(room, hostId, questions);
    const result = submitAnswer(room, hostId, 1, 'Answer 2');
    expect(result).toBeNull();
  });

  it('transitions to reveal when all players answer', () => {
    const { room, hostId, guestId, questions } = buildGameReadyRoom();
    startGame(room, hostId, questions);
    submitAnswer(room, hostId, 0, 'Answer 1');
    submitAnswer(room, guestId, 0, 'Answer 1');
    expect(room.game!.phase).toBe('reveal');
  });

  it('stays in question phase when only one player answers', () => {
    const { room, hostId, questions } = buildGameReadyRoom();
    startGame(room, hostId, questions);
    submitAnswer(room, hostId, 0, 'Answer 1');
    expect(room.game!.phase).toBe('question');
  });

  it('tracks streaks correctly', () => {
    const { room, hostId, guestId, questions } = buildGameReadyRoom();
    startGame(room, hostId, questions);

    submitAnswer(room, hostId, 0, 'Answer 1');
    submitAnswer(room, guestId, 0, 'Answer 1');
    expect(room.game!.scores[hostId]!.currentStreak).toBe(1);
    expect(room.game!.scores[hostId]!.bestStreak).toBe(1);

    advanceQuestion(room, hostId);
    submitAnswer(room, hostId, 1, 'Answer 2');
    expect(room.game!.scores[hostId]!.currentStreak).toBe(2);
    expect(room.game!.scores[hostId]!.bestStreak).toBe(2);

    submitAnswer(room, guestId, 1, 'Wrong');
    advanceQuestion(room, hostId);
    submitAnswer(room, hostId, 2, 'Wrong');
    expect(room.game!.scores[hostId]!.currentStreak).toBe(0);
    expect(room.game!.scores[hostId]!.bestStreak).toBe(2);
  });

  it('handles case-insensitive answer matching', () => {
    const { room, hostId, questions } = buildGameReadyRoom();
    startGame(room, hostId, questions);
    const result = submitAnswer(room, hostId, 0, 'answer 1');
    expect(result).not.toBeNull();
    expect(result!.isCorrect).toBe(true);
  });
});

describe('advanceQuestion', () => {
  it('advances to next question', () => {
    const { room, hostId, guestId, questions } = buildGameReadyRoom();
    startGame(room, hostId, questions);
    submitAnswer(room, hostId, 0, 'Answer 1');
    submitAnswer(room, guestId, 0, 'Answer 1');
    const updated = advanceQuestion(room, hostId);
    expect(updated).not.toBeNull();
    expect(room.game!.currentQuestionIndex).toBe(1);
    expect(room.game!.phase).toBe('question');
  });

  it('finishes game when advancing past last question', () => {
    const { room, hostId, guestId } = buildTwoPlayerRoom();
    selectDeck(room, hostId, 'deck-1', 'Deck');
    const questions = buildTestQuestions(1);
    startGame(room, hostId, questions);
    submitAnswer(room, hostId, 0, 'Answer 1');
    submitAnswer(room, guestId, 0, 'Answer 1');
    advanceQuestion(room, hostId);
    expect(room.game!.phase).toBe('finished');
    expect(room.status).toBe('finished');
  });

  it('rejects advance from non-host', () => {
    const { room, hostId, guestId, questions } = buildGameReadyRoom();
    startGame(room, hostId, questions);
    submitAnswer(room, hostId, 0, 'Answer 1');
    submitAnswer(room, guestId, 0, 'Answer 1');
    const updated = advanceQuestion(room, guestId);
    expect(updated).toBeNull();
  });

  it('rejects advance during question phase', () => {
    const { room, hostId, questions } = buildGameReadyRoom();
    startGame(room, hostId, questions);
    const updated = advanceQuestion(room, hostId);
    expect(updated).toBeNull();
  });
});

describe('resetRoom', () => {
  it('resets a finished room back to lobby', () => {
    const { room, hostId, guestId } = buildTwoPlayerRoom();
    selectDeck(room, hostId, 'deck-1', 'Deck');
    startGame(room, hostId, buildTestQuestions(1));
    submitAnswer(room, hostId, 0, 'Answer 1');
    submitAnswer(room, guestId, 0, 'Answer 1');
    advanceQuestion(room, hostId);
    expect(room.status).toBe('finished');

    const updated = resetRoom(room, hostId);
    expect(updated).not.toBeNull();
    expect(updated!.status).toBe('lobby');
    expect(updated!.game).toBeNull();
  });

  it('rejects reset from non-host', () => {
    const { room, hostId, guestId } = buildTwoPlayerRoom();
    selectDeck(room, hostId, 'deck-1', 'Deck');
    startGame(room, hostId, buildTestQuestions(1));
    submitAnswer(room, hostId, 0, 'Answer 1');
    submitAnswer(room, guestId, 0, 'Answer 1');
    advanceQuestion(room, hostId);
    const updated = resetRoom(room, guestId);
    expect(updated).toBeNull();
  });
});

describe('full gameplay loop', () => {
  it('completes a 3-round game with scoring', () => {
    const { room, hostId, guestId, questions } = buildGameReadyRoom();

    startGame(room, hostId, questions);
    expect(room.game!.phase).toBe('question');

    submitAnswer(room, hostId, 0, 'Answer 1');
    submitAnswer(room, guestId, 0, 'Wrong');
    expect(room.game!.phase).toBe('reveal');

    advanceQuestion(room, hostId);
    expect(room.game!.currentQuestionIndex).toBe(1);

    submitAnswer(room, hostId, 1, 'Answer 2');
    submitAnswer(room, guestId, 1, 'Answer 2');

    advanceQuestion(room, hostId);
    submitAnswer(room, hostId, 2, 'Wrong');
    submitAnswer(room, guestId, 2, 'Answer 3');

    advanceQuestion(room, hostId);
    expect(room.game!.phase).toBe('finished');
    expect(room.status).toBe('finished');

    const hostScore = room.game!.scores[hostId]!;
    const guestScore = room.game!.scores[guestId]!;
    expect(hostScore.correct).toBe(2);
    expect(hostScore.incorrect).toBe(1);
    expect(guestScore.correct).toBe(2);
    expect(guestScore.incorrect).toBe(1);
    expect(hostScore.points).toBeGreaterThan(0);
    expect(guestScore.points).toBeGreaterThan(0);
  });
});
