import type { QuestRunResult, QuestSettings, QuestMode } from '@/types/performance';
import { getFirstRouteParam, isRecord, normalizeStringArray, safeParseJsonOrNull, toFiniteNumber, toRoundedPositiveInteger } from '@/utils/safeJson';

const QUEST_RUN_LENGTHS = new Set<QuestSettings['runLength']>([5, 10, 20]);
const QUEST_TIMER_OPTIONS = new Set<QuestSettings['timerSeconds']>([0, 5, 10]);

function normalizeQuestMode(value: unknown): QuestMode | null {
  return value === 'learn' || value === 'test' ? value : null;
}

export function normalizeQuestSettings(value: unknown): QuestSettings | null {
  if (!isRecord(value) || typeof value.deckId !== 'string') {
    return null;
  }

  const mode = normalizeQuestMode(value.mode);
  if (!mode) {
    return null;
  }

  const runLength = toFiniteNumber(value.runLength, Number.NaN) as QuestSettings['runLength'];
  const timerSeconds = toFiniteNumber(value.timerSeconds, Number.NaN) as QuestSettings['timerSeconds'];

  if (!QUEST_RUN_LENGTHS.has(runLength) || !QUEST_TIMER_OPTIONS.has(timerSeconds)) {
    return null;
  }

  return {
    deckId: value.deckId,
    mode,
    runLength,
    timerSeconds,
    focusWeakOnly: Boolean(value.focusWeakOnly),
    hintsEnabled: Boolean(value.hintsEnabled),
    explanationsEnabled: Boolean(value.explanationsEnabled),
    secondChanceEnabled: Boolean(value.secondChanceEnabled),
  };
}

export function parseQuestSettingsParam(raw: string | string[] | undefined): QuestSettings | null {
  return safeParseJsonOrNull<QuestSettings>({
    raw: getFirstRouteParam(raw),
    label: 'quest settings route param',
    normalize: normalizeQuestSettings,
  });
}

export function parseDrillCardIdsParam(raw: string | string[] | undefined): string[] | null {
  return safeParseJsonOrNull<string[]>({
    raw: getFirstRouteParam(raw),
    label: 'quest drill card ids route param',
    normalize: normalizeStringArray,
  });
}

export function serializeQuestSettings(settings: QuestSettings): string {
  return JSON.stringify(settings);
}

export function normalizeQuestRunResult(value: unknown): QuestRunResult | null {
  if (!isRecord(value) || typeof value.deckId !== 'string') {
    return null;
  }

  const settings = normalizeQuestSettings(value.settings);
  if (!settings) {
    return null;
  }

  const missedCardIds = normalizeStringArray(value.missedCardIds) ?? [];
  const askedCardIds = normalizeStringArray(value.askedCardIds) ?? [];

  return {
    deckId: value.deckId,
    settings,
    totalScore: toRoundedPositiveInteger(value.totalScore),
    correctCount: toRoundedPositiveInteger(value.correctCount),
    incorrectCount: toRoundedPositiveInteger(value.incorrectCount),
    accuracy: Math.max(0, Math.min(1, toFiniteNumber(value.accuracy, 0))),
    bestStreak: toRoundedPositiveInteger(value.bestStreak),
    totalTimeMs: toRoundedPositiveInteger(value.totalTimeMs),
    missedCardIds,
    askedCardIds,
  };
}

export function parseQuestResultParam(raw: string | string[] | undefined): QuestRunResult | null {
  return safeParseJsonOrNull<QuestRunResult>({
    raw: getFirstRouteParam(raw),
    label: 'quest result route param',
    normalize: normalizeQuestRunResult,
  });
}

export function serializeQuestResult(result: QuestRunResult): string {
  return JSON.stringify(result);
}
