import type { Href } from 'expo-router';

import type { QuestMode, QuestSettings } from '@/types/performance';
import type { PracticeMode } from '@/types/practice';
import { serializeQuestSettings } from '@/utils/questParams';

export const HOME_ROUTE = '/' as const satisfies Href;
export const ONBOARDING_ROUTE = '/onboarding' as const satisfies Href;
export const DECKS_ROUTE = '/decks' as const satisfies Href;
export const PROFILE_ROUTE = '/profile' as const satisfies Href;
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
export const ANALYTICS_DEBUG_ROUTE = '/analytics-debug' as const satisfies Href;

export function createFlashcardHref(deckId?: string): Href {
  return deckId
    ? { pathname: CREATE_FLASHCARD_ROUTE, params: { deckId } }
    : CREATE_FLASHCARD_ROUTE;
}

export function studyHref(deckId: string): Href {
  return { pathname: STUDY_ROUTE, params: { deckId } };
}

export function deckHubHref(deckId: string): Href {
  return { pathname: DECK_HUB_ROUTE, params: { deckId } };
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

export function questSessionHref(params: { settings: string; drillCardIds?: string }): Href {
  return {
    pathname: QUEST_SESSION_ROUTE,
    params: params.drillCardIds
      ? { settings: params.settings, drillCardIds: params.drillCardIds }
      : { settings: params.settings },
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

export function questResultsHref(result: string): Href {
  return { pathname: QUEST_RESULTS_ROUTE, params: { result } };
}
