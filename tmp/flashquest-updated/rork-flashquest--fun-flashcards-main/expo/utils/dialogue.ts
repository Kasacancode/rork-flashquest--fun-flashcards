import { DIALOGUE_BUCKET_TEXT, type DialogueBucketId } from '@/data/dialogue/rawBuckets';
import { logger } from '@/utils/logger';

export type DialogueTier = 'common' | 'uncommon' | 'spicy' | 'rare';
export type DialogueMode = 'quest' | 'arena';
export type QuestDialogueEvent = 'intro' | 'correct' | 'wrong' | 'streak' | 'slump' | 'win' | 'loss';
export type ArenaDialogueEvent = 'intro' | 'correct' | 'wrong' | 'leadChange' | 'streak' | 'win' | 'loss';
export type DialogueEvent = QuestDialogueEvent | ArenaDialogueEvent;

export interface ParsedDialoguePool {
  common: string[];
  uncommon: string[];
  spicy: string[];
  rare: string[];
}

const TIER_ORDER: DialogueTier[] = ['common', 'uncommon', 'spicy', 'rare'];

const DIALOGUE_WEIGHTS: Record<DialogueMode, Record<DialogueTier, number>> = {
  quest: {
    common: 55,
    uncommon: 25,
    spicy: 15,
    rare: 5,
  },
  arena: {
    common: 70,
    uncommon: 20,
    spicy: 8,
    rare: 2,
  },
};

const QUEST_POOL_MAP: Record<QuestDialogueEvent, DialogueBucketId> = {
  intro: 'intro',
  correct: 'correct',
  wrong: 'wrong',
  streak: 'streak',
  slump: 'slump',
  win: 'win',
  loss: 'loss',
};

const ARENA_POOL_MAP: Record<ArenaDialogueEvent, DialogueBucketId> = {
  intro: 'intro',
  correct: 'correct',
  wrong: 'wrong',
  leadChange: 'leadChange',
  streak: 'streak',
  win: 'win',
  loss: 'loss',
};

const lastUsedDialogueByPool = new Map<string, string>();

function createEmptyPool(): ParsedDialoguePool {
  return {
    common: [],
    uncommon: [],
    spicy: [],
    rare: [],
  };
}

function normalizeRawLine(value: string): string {
  return value.replace(/^\uFEFF/, '').trim();
}

function getTierFromHeading(line: string): DialogueTier | null {
  const normalized = normalizeRawLine(line).toLowerCase();

  if (normalized.length === 0) {
    return null;
  }

  if (normalized.startsWith('common')) {
    return 'common';
  }

  if (normalized.startsWith('uncommon')) {
    return 'uncommon';
  }

  if (normalized.startsWith('spicy') || normalized.includes('funny') || normalized.includes('characterful')) {
    return 'spicy';
  }

  if (normalized.startsWith('rare') || normalized.includes('signature')) {
    return 'rare';
  }

  return null;
}

export function parseDialoguePool(rawText: string): ParsedDialoguePool {
  const parsedPool = createEmptyPool();
  const lines = rawText.replace(/^\uFEFF/, '').split(/\r?\n/);
  let currentTier: DialogueTier | null = null;

  lines.forEach((line) => {
    const trimmedLine = normalizeRawLine(line);

    if (trimmedLine.length === 0) {
      return;
    }

    const tier = getTierFromHeading(trimmedLine);
    if (tier) {
      currentTier = tier;
      return;
    }

    if (!currentTier) {
      return;
    }

    const dialogueLine = trimmedLine.replace(/^\d+\s*[.)-]?\s*/, '').trim();
    if (dialogueLine.length === 0) {
      return;
    }

    parsedPool[currentTier].push(dialogueLine);
  });

  return parsedPool;
}

const parsedDialogueBuckets: Record<DialogueBucketId, ParsedDialoguePool> = {
  intro: parseDialoguePool(DIALOGUE_BUCKET_TEXT.intro),
  correct: parseDialoguePool(DIALOGUE_BUCKET_TEXT.correct),
  wrong: parseDialoguePool(DIALOGUE_BUCKET_TEXT.wrong),
  leadChange: parseDialoguePool(DIALOGUE_BUCKET_TEXT.leadChange),
  streak: parseDialoguePool(DIALOGUE_BUCKET_TEXT.streak),
  slump: parseDialoguePool(DIALOGUE_BUCKET_TEXT.slump),
  win: parseDialoguePool(DIALOGUE_BUCKET_TEXT.win),
  loss: parseDialoguePool(DIALOGUE_BUCKET_TEXT.loss),
};

(Object.keys(parsedDialogueBuckets) as DialogueBucketId[]).forEach((bucketId) => {
  const bucket = parsedDialogueBuckets[bucketId];
  logger.log(
    '[Dialogue] Parsed bucket:',
    bucketId,
    'common:',
    bucket.common.length,
    'uncommon:',
    bucket.uncommon.length,
    'spicy:',
    bucket.spicy.length,
    'rare:',
    bucket.rare.length,
  );
});

function getBucketId(mode: DialogueMode, event: DialogueEvent): DialogueBucketId {
  if (mode === 'quest') {
    return QUEST_POOL_MAP[event as QuestDialogueEvent];
  }

  return ARENA_POOL_MAP[event as ArenaDialogueEvent];
}

function getPoolKey(mode: DialogueMode, event: DialogueEvent): string {
  return `${mode}:${event}`;
}

function getNonEmptyTiers(pool: ParsedDialoguePool): DialogueTier[] {
  return TIER_ORDER.filter((tier) => pool[tier].length > 0);
}

function pickWeightedTier(mode: DialogueMode, availableTiers: DialogueTier[]): DialogueTier | null {
  if (availableTiers.length === 0) {
    return null;
  }

  const weights = DIALOGUE_WEIGHTS[mode];
  const totalWeight = availableTiers.reduce((sum, tier) => sum + weights[tier], 0);

  if (totalWeight <= 0) {
    return availableTiers[0] ?? null;
  }

  let roll = Math.random() * totalWeight;

  for (const tier of TIER_ORDER) {
    if (!availableTiers.includes(tier)) {
      continue;
    }

    roll -= weights[tier];
    if (roll <= 0) {
      return tier;
    }
  }

  return availableTiers[availableTiers.length - 1] ?? null;
}

function pickRandomLine(lines: string[], excludeLine?: string): string | null {
  const preferredLines = excludeLine ? lines.filter((line) => line !== excludeLine) : lines;
  const pool = preferredLines.length > 0 ? preferredLines : lines;

  if (pool.length === 0) {
    return null;
  }

  return pool[Math.floor(Math.random() * pool.length)] ?? null;
}

function getAllPoolLines(pool: ParsedDialoguePool): string[] {
  return TIER_ORDER.flatMap((tier) => pool[tier]);
}

function pickFallbackLineFromOtherTiers(params: {
  mode: DialogueMode;
  pool: ParsedDialoguePool;
  selectedTier: DialogueTier | null;
  lastLine?: string;
}): string | null {
  const { mode, pool, selectedTier, lastLine } = params;
  const availableOtherTiers = getNonEmptyTiers(pool).filter((tier) => tier !== selectedTier);
  const attemptedTiers = new Set<DialogueTier>();

  while (availableOtherTiers.some((tier) => !attemptedTiers.has(tier))) {
    const tier = pickWeightedTier(
      mode,
      availableOtherTiers.filter((candidateTier) => !attemptedTiers.has(candidateTier)),
    );

    if (!tier) {
      break;
    }

    attemptedTiers.add(tier);
    const line = pickRandomLine(pool[tier], lastLine);

    if (line && line !== lastLine) {
      return line;
    }
  }

  return null;
}

export function selectAssistantDialogue(params: {
  mode: DialogueMode;
  event: DialogueEvent;
}): string {
  const { mode, event } = params;
  const bucketId = getBucketId(mode, event);
  const pool = parsedDialogueBuckets[bucketId];
  const lastLine = lastUsedDialogueByPool.get(getPoolKey(mode, event));
  const availableTiers = getNonEmptyTiers(pool);

  if (availableTiers.length === 0) {
    logger.warn('[Dialogue] Empty pool for mode/event:', mode, event);
    return '';
  }

  const selectedTier = pickWeightedTier(mode, availableTiers);
  let line = selectedTier ? pickRandomLine(pool[selectedTier], lastLine) : null;

  if ((!line || line === lastLine) && selectedTier) {
    line = pickRandomLine(pool[selectedTier], lastLine);
  }

  if ((!line || line === lastLine) && selectedTier) {
    line = pickFallbackLineFromOtherTiers({
      mode,
      pool,
      selectedTier,
      lastLine,
    });
  }

  if (!line || line === lastLine) {
    const differentLine = getAllPoolLines(pool).find((candidateLine) => candidateLine !== lastLine);
    if (differentLine) {
      line = differentLine;
    }
  }

  if (!line) {
    line = getAllPoolLines(pool)[0] ?? '';
  }

  lastUsedDialogueByPool.set(getPoolKey(mode, event), line);
  logger.log('[Dialogue] Selected line:', { mode, event, bucketId, tier: selectedTier, line });
  return line;
}

export function isMeaningfulQuestStreak(streak: number): boolean {
  return streak >= 2 && (streak === 2 || streak % 3 === 0);
}

export function isMeaningfulArenaStreak(streak: number): boolean {
  return streak >= 3 && streak % 3 === 0;
}

export function isMeaningfulQuestSlump(missStreak: number): boolean {
  return missStreak >= 2 && (missStreak === 2 || missStreak % 3 === 0);
}

export function getQuestCompletionDialogueEvent(params: {
  accuracy?: number;
  correctCount?: number;
  incorrectCount?: number;
}): 'win' | 'loss' {
  const accuracy = params.accuracy ?? 0;
  const correctCount = params.correctCount ?? 0;
  const incorrectCount = params.incorrectCount ?? 0;

  if (accuracy >= 0.5 || correctCount >= incorrectCount) {
    return 'win';
  }

  return 'loss';
}
