import { useSyncExternalStore } from 'react';

import type {
  FlashcardAnswerType,
  FlashcardDeckNormalizationSummary,
  FlashcardNormalizationReasonCode,
  FlashcardNormalizationSource,
  FlashcardOptionCollisionEntry,
  FlashcardOptionSurface,
} from '@/types/flashcard';

const DIAGNOSTICS_ENABLED = typeof __DEV__ !== 'undefined' ? __DEV__ : process.env.NODE_ENV !== 'production';
const MAX_RECENT_DECK_SUMMARIES = 18;
const MAX_RECENT_OPTION_COLLISIONS = 36;

interface FlashcardDiagnosticsSourceAggregate {
  decks: number;
  cardsProcessed: number;
  cardsAccepted: number;
  acceptedUnchangedCount: number;
  acceptedCompressedCount: number;
  explanationExtractedCount: number;
  rejectedCount: number;
  duplicatePairsRemoved: number;
  legacyCardsUpgraded: number;
}

export interface FlashcardOptionCollisionLogEntry {
  deckId?: string;
  cardId?: string;
  source: FlashcardNormalizationSource;
  surface: FlashcardOptionSurface;
  collisions: FlashcardOptionCollisionEntry[];
  fallbackCount: number;
  createdAt: number;
}

export interface FlashcardDiagnosticsAggregate {
  decksProcessed: number;
  cardsProcessed: number;
  cardsAccepted: number;
  acceptedUnchangedCount: number;
  acceptedCompressedCount: number;
  explanationExtractedCount: number;
  rejectedCount: number;
  duplicatePairsRemoved: number;
  legacyCardsUpgraded: number;
  averageRawAnswerLength: number;
  averageCanonicalAnswerLength: number;
  optionCollisionCount: number;
  optionCollisionFallbackCount: number;
  answerTypeDistribution: Partial<Record<FlashcardAnswerType, number>>;
  reasonCodeCounts: Partial<Record<FlashcardNormalizationReasonCode, number>>;
  qualityFlagCounts: Record<string, number>;
  sourceBreakdown: Record<FlashcardNormalizationSource, FlashcardDiagnosticsSourceAggregate>;
}

export interface FlashcardDiagnosticsState {
  aggregate: FlashcardDiagnosticsAggregate;
  recentDecks: FlashcardDeckNormalizationSummary[];
  recentOptionCollisions: FlashcardOptionCollisionLogEntry[];
  lastUpdatedAt: number | null;
}

const SOURCE_KEYS: FlashcardNormalizationSource[] = [
  'text_to_deck',
  'scan_notes',
  'import',
  'manual_create',
  'retry_regenerate',
  'legacy_load_normalization',
  'deck_update',
  'arena_prepare',
  'option_generation',
  'unknown',
];

function createEmptySourceAggregate(): FlashcardDiagnosticsSourceAggregate {
  return {
    decks: 0,
    cardsProcessed: 0,
    cardsAccepted: 0,
    acceptedUnchangedCount: 0,
    acceptedCompressedCount: 0,
    explanationExtractedCount: 0,
    rejectedCount: 0,
    duplicatePairsRemoved: 0,
    legacyCardsUpgraded: 0,
  };
}

function createEmptyState(): FlashcardDiagnosticsState {
  const sourceBreakdown = SOURCE_KEYS.reduce<Record<FlashcardNormalizationSource, FlashcardDiagnosticsSourceAggregate>>((accumulator, key) => {
    accumulator[key] = createEmptySourceAggregate();
    return accumulator;
  }, {} as Record<FlashcardNormalizationSource, FlashcardDiagnosticsSourceAggregate>);

  return {
    aggregate: {
      decksProcessed: 0,
      cardsProcessed: 0,
      cardsAccepted: 0,
      acceptedUnchangedCount: 0,
      acceptedCompressedCount: 0,
      explanationExtractedCount: 0,
      rejectedCount: 0,
      duplicatePairsRemoved: 0,
      legacyCardsUpgraded: 0,
      averageRawAnswerLength: 0,
      averageCanonicalAnswerLength: 0,
      optionCollisionCount: 0,
      optionCollisionFallbackCount: 0,
      answerTypeDistribution: {},
      reasonCodeCounts: {},
      qualityFlagCounts: {},
      sourceBreakdown,
    },
    recentDecks: [],
    recentOptionCollisions: [],
    lastUpdatedAt: null,
  };
}

let diagnosticsState: FlashcardDiagnosticsState = createEmptyState();
const listeners = new Set<() => void>();

function emitChange(): void {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function updateReasonCodeCounts(
  target: Partial<Record<FlashcardNormalizationReasonCode, number>>,
  next: Partial<Record<FlashcardNormalizationReasonCode, number>>,
): Partial<Record<FlashcardNormalizationReasonCode, number>> {
  const merged = { ...target };
  Object.entries(next).forEach(([key, value]) => {
    const reasonCode = key as FlashcardNormalizationReasonCode;
    merged[reasonCode] = (merged[reasonCode] ?? 0) + (value ?? 0);
  });
  return merged;
}

function updateAnswerTypeDistribution(
  target: Partial<Record<FlashcardAnswerType, number>>,
  next: Partial<Record<FlashcardAnswerType, number>>,
): Partial<Record<FlashcardAnswerType, number>> {
  const merged = { ...target };
  Object.entries(next).forEach(([key, value]) => {
    const answerType = key as FlashcardAnswerType;
    merged[answerType] = (merged[answerType] ?? 0) + (value ?? 0);
  });
  return merged;
}

function updateQualityFlagCounts(target: Record<string, number>, next: Record<string, number>): Record<string, number> {
  const merged = { ...target };
  Object.entries(next).forEach(([key, value]) => {
    merged[key] = (merged[key] ?? 0) + value;
  });
  return merged;
}

function sumCardValues(
  cards: FlashcardDeckNormalizationSummary['cards'],
  selector: (card: FlashcardDeckNormalizationSummary['cards'][number]) => number,
): number {
  return cards.reduce((total, card) => total + selector(card), 0);
}

export function recordDeckNormalizationSummary(summary: FlashcardDeckNormalizationSummary): void {
  if (!DIAGNOSTICS_ENABLED) {
    return;
  }

  const aggregate = diagnosticsState.aggregate;
  const sourceAggregate = aggregate.sourceBreakdown[summary.source] ?? createEmptySourceAggregate();
  const totalRawAnswerLength = (aggregate.averageRawAnswerLength * aggregate.cardsAccepted) + sumCardValues(summary.cards, (card) => card.rawAnswerLength);
  const totalCanonicalAnswerLength = (aggregate.averageCanonicalAnswerLength * aggregate.cardsAccepted) + sumCardValues(summary.cards, (card) => card.canonicalAnswerLength);
  const nextAcceptedCount = aggregate.cardsAccepted + summary.acceptedCount;

  diagnosticsState = {
    aggregate: {
      ...aggregate,
      decksProcessed: aggregate.decksProcessed + 1,
      cardsProcessed: aggregate.cardsProcessed + summary.processedCount,
      cardsAccepted: nextAcceptedCount,
      acceptedUnchangedCount: aggregate.acceptedUnchangedCount + summary.acceptedUnchangedCount,
      acceptedCompressedCount: aggregate.acceptedCompressedCount + summary.acceptedCompressedCount,
      explanationExtractedCount: aggregate.explanationExtractedCount + summary.explanationExtractedCount,
      rejectedCount: aggregate.rejectedCount + summary.rejectedCount,
      duplicatePairsRemoved: aggregate.duplicatePairsRemoved + summary.duplicatePairsRemoved,
      legacyCardsUpgraded: aggregate.legacyCardsUpgraded + summary.legacyCardsUpgraded,
      averageRawAnswerLength: nextAcceptedCount > 0 ? totalRawAnswerLength / nextAcceptedCount : 0,
      averageCanonicalAnswerLength: nextAcceptedCount > 0 ? totalCanonicalAnswerLength / nextAcceptedCount : 0,
      answerTypeDistribution: updateAnswerTypeDistribution(aggregate.answerTypeDistribution, summary.answerTypeDistribution),
      reasonCodeCounts: updateReasonCodeCounts(aggregate.reasonCodeCounts, summary.reasonCodeCounts),
      qualityFlagCounts: updateQualityFlagCounts(aggregate.qualityFlagCounts, summary.qualityFlagCounts),
      sourceBreakdown: {
        ...aggregate.sourceBreakdown,
        [summary.source]: {
          decks: sourceAggregate.decks + 1,
          cardsProcessed: sourceAggregate.cardsProcessed + summary.processedCount,
          cardsAccepted: sourceAggregate.cardsAccepted + summary.acceptedCount,
          acceptedUnchangedCount: sourceAggregate.acceptedUnchangedCount + summary.acceptedUnchangedCount,
          acceptedCompressedCount: sourceAggregate.acceptedCompressedCount + summary.acceptedCompressedCount,
          explanationExtractedCount: sourceAggregate.explanationExtractedCount + summary.explanationExtractedCount,
          rejectedCount: sourceAggregate.rejectedCount + summary.rejectedCount,
          duplicatePairsRemoved: sourceAggregate.duplicatePairsRemoved + summary.duplicatePairsRemoved,
          legacyCardsUpgraded: sourceAggregate.legacyCardsUpgraded + summary.legacyCardsUpgraded,
        },
      },
    },
    recentDecks: [summary, ...diagnosticsState.recentDecks].slice(0, MAX_RECENT_DECK_SUMMARIES),
    recentOptionCollisions: diagnosticsState.recentOptionCollisions,
    lastUpdatedAt: summary.createdAt,
  };

  emitChange();
}

export function recordOptionCollision(options: {
  deckId?: string;
  cardId?: string;
  source: FlashcardNormalizationSource;
  surface: FlashcardOptionSurface;
  collisions: FlashcardOptionCollisionEntry[];
  fallbackCount: number;
  createdAt?: number;
}): void {
  if (!DIAGNOSTICS_ENABLED || options.collisions.length === 0) {
    return;
  }

  const entry: FlashcardOptionCollisionLogEntry = {
    deckId: options.deckId,
    cardId: options.cardId,
    source: options.source,
    surface: options.surface,
    collisions: options.collisions,
    fallbackCount: options.fallbackCount,
    createdAt: options.createdAt ?? Date.now(),
  };

  diagnosticsState = {
    aggregate: {
      ...diagnosticsState.aggregate,
      optionCollisionCount: diagnosticsState.aggregate.optionCollisionCount + options.collisions.length,
      optionCollisionFallbackCount: diagnosticsState.aggregate.optionCollisionFallbackCount + options.fallbackCount,
    },
    recentDecks: diagnosticsState.recentDecks,
    recentOptionCollisions: [entry, ...diagnosticsState.recentOptionCollisions].slice(0, MAX_RECENT_OPTION_COLLISIONS),
    lastUpdatedAt: entry.createdAt,
  };

  emitChange();
}

export function clearFlashcardDiagnostics(): void {
  diagnosticsState = createEmptyState();
  emitChange();
}

export function getFlashcardDiagnosticsState(): FlashcardDiagnosticsState {
  return diagnosticsState;
}

export function useFlashcardDiagnostics(): FlashcardDiagnosticsState {
  return useSyncExternalStore(subscribe, getFlashcardDiagnosticsState, getFlashcardDiagnosticsState);
}

export function isFlashcardDiagnosticsEnabled(): boolean {
  return DIAGNOSTICS_ENABLED;
}
