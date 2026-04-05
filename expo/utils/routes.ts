import type { Href } from 'expo-router';

import type { FlashcardOption } from '@/types/flashcard';
import type { QuestMode, QuestSettings } from '@/types/performance';
import type { PracticeMode } from '@/types/practice';
import { canAccessDebugRoute, getDebugToolingFallbackHref } from '@/utils/debugTooling';
import { serializeQuestSettings } from '@/utils/questParams';

export const HOME_ROUTE = '/' as const satisfies Href;
export const ONBOARDING_ROUTE = '/onboarding' as const satisfies Href;
export const DECKS_ROUTE = '/decks' as const satisfies Href;
export const EXPLORE_ROUTE = '/explore' as const satisfies Href;
export const PROFILE_ROUTE = '/profile' as const satisfies Href;
export const FRIENDS_ROUTE = '/friends' as const satisfies Href;
export const LEADERBOARD_ROUTE = '/leaderboard' as const satisfies Href;
export const AUTH_ROUTE = '/auth' as const satisfies Href;
export const AUTH_CALLBACK_ROUTE = '/auth-callback' as const satisfies Href;
export const CHOOSE_USERNAME_ROUTE = '/choose-username' as const satisfies Href;
export const ACCOUNT_ROUTE = '/account' as const satisfies Href;
export const DATA_PRIVACY_ROUTE = '/data-privacy' as const satisfies Href;
export const FAQ_ROUTE = '/faq' as const satisfies Href;
export const QUEST_ROUTE = '/quest' as const satisfies Href;
export const QUEST_SESSION_ROUTE = '/quest-session' as const satisfies Href;
export const QUEST_RESULTS_ROUTE = '/quest-results' as const satisfies Href;
export const ARENA_ROUTE = '/arena' as const satisfies Href;
export const ARENA_LOBBY_ROUTE = '/arena-lobby' as const satisfies Href;
export const ARENA_SESSION_ROUTE = '/arena-session' as const satisfies Href;
export const ARENA_RESULTS_ROUTE = '/arena-results' as const satisfies Href;
export const CREATE_FLASHCARD_ROUTE = '/create-flashcard' as const satisfies Href;
export const SCAN_NOTES_ROUTE = '/scan-notes' as const satisfies Href;
export const TEXT_TO_DECK_ROUTE = '/text-to-deck' as const satisfies Href;
export const PRACTICE_ROUTE = '/practice' as const satisfies Href;
export const PRACTICE_SESSION_ROUTE = '/practice-session' as const satisfies Href;
export const STUDY_ROUTE = '/study' as const satisfies Href;
export const DECK_HUB_ROUTE = '/deck-hub' as const satisfies Href;
export const SETTINGS_ROUTE = '/settings' as const satisfies Href;
export const EDIT_DECK_ROUTE = '/edit-deck' as const satisfies Href;
export const EDIT_FLASHCARD_ROUTE = '/edit-flashcard' as const satisfies Href;
export const FLASHCARD_DEBUG_ROUTE = '/flashcard-debug' as unknown as Href;

export function createFlashcardHref(deckId?: string): Href {
  return deckId
    ? { pathname: CREATE_FLASHCARD_ROUTE, params: { deckId } }
    : CREATE_FLASHCARD_ROUTE;
}

export function studyHref(deckId: string, mode?: string, source?: 'review-hub'): Href {
  const params: Record<string, string> = { deckId };
  if (mode) {
    params.initialMode = mode;
  }
  if (source) {
    params.source = source;
  }
  return { pathname: STUDY_ROUTE, params } as Href;
}

export function deckHubHref(deckId: string): Href {
  return { pathname: DECK_HUB_ROUTE, params: { deckId } };
}

export function editDeckHref(deckId: string): Href {
  return { pathname: EDIT_DECK_ROUTE, params: { deckId } };
}

export function editFlashcardHref(deckId: string, cardId: string): Href {
  return { pathname: EDIT_FLASHCARD_ROUTE, params: { deckId, cardId } };
}

export function flashcardDebugHref(params?: {
  deckId?: string;
  cardId?: string;
  surface?: string;
  options?: FlashcardOption[];
}): Href {
  if (!canAccessDebugRoute('flashcard-debug')) {
    return getDebugToolingFallbackHref();
  }

  if (!params?.deckId && !params?.cardId && !params?.surface && (!params?.options || params.options.length === 0)) {
    return FLASHCARD_DEBUG_ROUTE as Href;
  }

  const nextParams: Record<string, string> = {};

  if (params?.deckId) {
    nextParams.deckId = params.deckId;
  }

  if (params?.cardId) {
    nextParams.cardId = params.cardId;
  }

  if (params?.surface) {
    nextParams.surface = params.surface;
  }

  if (params?.options && params.options.length > 0) {
    nextParams.options = JSON.stringify(params.options.slice(0, 8));
  }

  return { pathname: FLASHCARD_DEBUG_ROUTE as unknown as string, params: nextParams } as Href;
}

export function questHref(params?: { deckId?: string; focusWeak?: 'true' }): Href {
  if (!params?.deckId && !params?.focusWeak) {
    return QUEST_ROUTE;
  }

  const nextParams: Record<string, string> = {};

  if (params.deckId) {
    nextParams.deckId = params.deckId;
  }

  if (params.focusWeak) {
    nextParams.focusWeak = params.focusWeak;
  }

  return { pathname: QUEST_ROUTE, params: nextParams };
}

export function practiceHref(deckId?: string): Href {
  return deckId ? { pathname: PRACTICE_ROUTE, params: { deckId } } : PRACTICE_ROUTE;
}

export function practiceSessionHref(deckId: string, mode: PracticeMode): Href {
  return { pathname: PRACTICE_SESSION_ROUTE, params: { deckId, mode } };
}

export function questSessionHref(params: {
  settings: string;
  drillCardIds?: string;
  challengeId?: string;
  challengerScore?: string;
  challengeOpponentId?: string;
  challengeCardIds?: string;
}): Href {
  const routeParams: Record<string, string> = {
    settings: params.settings,
  };

  if (params.drillCardIds) {
    routeParams.drillCardIds = params.drillCardIds;
  }

  if (params.challengeId) {
    routeParams.challengeId = params.challengeId;
  }

  if (params.challengerScore) {
    routeParams.challengerScore = params.challengerScore;
  }

  if (params.challengeOpponentId) {
    routeParams.challengeOpponentId = params.challengeOpponentId;
  }

  if (params.challengeCardIds) {
    routeParams.challengeCardIds = params.challengeCardIds;
  }

  return {
    pathname: QUEST_SESSION_ROUTE,
    params: routeParams,
  };
}

function getFocusedQuestRunLength(cardCount: number): QuestSettings['runLength'] {
  if (cardCount >= 20) {
    return 20;
  }

  if (cardCount >= 10) {
    return 10;
  }

  return 5;
}

export function focusedQuestSessionHref(params: {
  deckId: string;
  cardIds: string[];
  mode?: QuestMode;
}): Href {
  const settings: QuestSettings = {
    deckId: params.deckId,
    mode: params.mode ?? 'learn',
    runLength: getFocusedQuestRunLength(params.cardIds.length),
    timerSeconds: 0,
    focusWeakOnly: false,
    hintsEnabled: true,
    explanationsEnabled: true,
    secondChanceEnabled: false,
  };

  return questSessionHref({
    settings: serializeQuestSettings(settings),
    drillCardIds: JSON.stringify(params.cardIds),
  });
}

export function questResultsHref(params: {
  result: string;
  challengeId?: string;
  challengerScore?: string;
  challengeOpponentId?: string;
  challengeCardIds?: string;
} | string): Href {
  if (typeof params === 'string') {
    return { pathname: QUEST_RESULTS_ROUTE, params: { result: params } };
  }

  const routeParams: Record<string, string> = {
    result: params.result,
  };

  if (params.challengeId) {
    routeParams.challengeId = params.challengeId;
  }

  if (params.challengerScore) {
    routeParams.challengerScore = params.challengerScore;
  }

  if (params.challengeOpponentId) {
    routeParams.challengeOpponentId = params.challengeOpponentId;
  }

  if (params.challengeCardIds) {
    routeParams.challengeCardIds = params.challengeCardIds;
  }

  return { pathname: QUEST_RESULTS_ROUTE, params: routeParams };
}
