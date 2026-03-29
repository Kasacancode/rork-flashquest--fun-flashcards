import { BackendAppError, type BackendTRPCCode } from '../errors';
import { ARENA_BACKEND_ERROR_CODES, type ArenaBackendErrorCode } from './types';

type ArenaErrorOptions = {
  code: ArenaBackendErrorCode;
  userMessage: string;
  developerMessage: string;
  trpcCode?: BackendTRPCCode;
  meta?: Record<string, unknown>;
};

export function createArenaError(options: ArenaErrorOptions): BackendAppError<ArenaBackendErrorCode> {
  return new BackendAppError<ArenaBackendErrorCode>({
    code: options.code,
    userMessage: options.userMessage,
    developerMessage: options.developerMessage,
    trpcCode: options.trpcCode ?? 'BAD_REQUEST',
    meta: options.meta,
  });
}

export function createArenaDeckNotSelectedError(meta?: Record<string, unknown>): BackendAppError<ArenaBackendErrorCode> {
  return createArenaError({
    code: ARENA_BACKEND_ERROR_CODES.DECK_NOT_SELECTED,
    userMessage: 'Choose a deck before starting a battle.',
    developerMessage: 'Arena start requested without a selected deck.',
    trpcCode: 'BAD_REQUEST',
    meta,
  });
}

export function createArenaDeckNotReadyError(meta?: Record<string, unknown>): BackendAppError<ArenaBackendErrorCode> {
  return createArenaError({
    code: ARENA_BACKEND_ERROR_CODES.DECK_NOT_READY,
    userMessage: 'This deck is still getting ready for battle. Try again in a moment.',
    developerMessage: 'Arena start requested before a prepared deck snapshot was available.',
    trpcCode: 'PRECONDITION_FAILED',
    meta,
  });
}

export function createArenaDeckNotFoundError(meta?: Record<string, unknown>): BackendAppError<ArenaBackendErrorCode> {
  return createArenaError({
    code: ARENA_BACKEND_ERROR_CODES.DECK_NOT_FOUND,
    userMessage: 'That deck could not be found for this battle.',
    developerMessage: 'Prepared arena deck was missing or mismatched with the selected room deck.',
    trpcCode: 'NOT_FOUND',
    meta,
  });
}

export function createArenaHostMismatchError(meta?: Record<string, unknown>): BackendAppError<ArenaBackendErrorCode> {
  return createArenaError({
    code: ARENA_BACKEND_ERROR_CODES.HOST_MISMATCH,
    userMessage: 'Only the host can start this battle.',
    developerMessage: 'Arena mutation attempted by a non-host player.',
    trpcCode: 'FORBIDDEN',
    meta,
  });
}

export function createArenaMinPlayersError(meta?: Record<string, unknown>): BackendAppError<ArenaBackendErrorCode> {
  return createArenaError({
    code: ARENA_BACKEND_ERROR_CODES.MIN_PLAYERS_REQUIRED,
    userMessage: 'You need at least 2 players to start a battle.',
    developerMessage: 'Arena start requested without the minimum player count.',
    trpcCode: 'BAD_REQUEST',
    meta,
  });
}

export function createArenaInvalidRoomStateError(meta?: Record<string, unknown>): BackendAppError<ArenaBackendErrorCode> {
  return createArenaError({
    code: ARENA_BACKEND_ERROR_CODES.INVALID_ROOM_STATE,
    userMessage: 'This battle room is no longer in a startable state.',
    developerMessage: 'Arena mutation hit an invalid or unexpected room state.',
    trpcCode: 'CONFLICT',
    meta,
  });
}

export function createArenaRoomSaveFailedError(meta?: Record<string, unknown>): BackendAppError<ArenaBackendErrorCode> {
  return createArenaError({
    code: ARENA_BACKEND_ERROR_CODES.ROOM_SAVE_FAILED,
    userMessage: 'Battle state could not be saved right now. Please try again.',
    developerMessage: 'Arena room save failed after generation.',
    trpcCode: 'INTERNAL_SERVER_ERROR',
    meta,
  });
}

export function createArenaGameGenerationFailedError(meta?: Record<string, unknown>): BackendAppError<ArenaBackendErrorCode> {
  return createArenaError({
    code: ARENA_BACKEND_ERROR_CODES.GAME_GENERATION_FAILED,
    userMessage: 'This battle could not be generated right now. Please try again.',
    developerMessage: 'Arena game generation failed unexpectedly.',
    trpcCode: 'INTERNAL_SERVER_ERROR',
    meta,
  });
}
