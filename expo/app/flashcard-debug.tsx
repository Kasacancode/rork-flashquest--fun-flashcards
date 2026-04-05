import * as Clipboard from 'expo-clipboard';
import { LinearGradient } from 'expo-linear-gradient';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { Alert } from 'react-native';
import { Bug, Copy, RefreshCw, X } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useDeckContext } from '@/context/DeckContext';
import { useTheme } from '@/context/ThemeContext';
import type { Flashcard, FlashcardOption } from '@/types/flashcard';
import { canAccessDebugRoute, getDebugToolingFallbackHref } from '@/utils/debugTooling';
import { getFlashcardDiagnosticsState, useFlashcardDiagnostics } from '@/utils/flashcardDiagnostics';
import { normalizeFlashcard } from '@/utils/flashcardContent';
import { buildFlashcardDebugSnapshot, serializeFlashcardDebugSnapshot } from '@/utils/flashcardInspector';
import { logger } from '@/utils/logger';

function parseOptionsParam(value: string | string[] | undefined): FlashcardOption[] {
  const rawValue = Array.isArray(value) ? value[0] : value;
  if (!rawValue) {
    return [];
  }

  try {
    const parsed = JSON.parse(rawValue) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((entry): entry is FlashcardOption => {
      if (typeof entry !== 'object' || entry == null) {
        return false;
      }

      const candidate = entry as Partial<FlashcardOption>;
      return typeof candidate.id === 'string'
        && typeof candidate.displayText === 'string'
        && typeof candidate.canonicalValue === 'string'
        && typeof candidate.normalizedValue === 'string'
        && typeof candidate.answerType === 'string';
    });
  } catch (error) {
    logger.warn('[FlashcardDebug] Failed to parse search params:', error);
    return [];
  }
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function CodeBlock({ label, value }: { label: string; value?: string }) {
  return (
    <View style={styles.blockWrap}>
      <Text style={styles.blockLabel}>{label}</Text>
      <View style={styles.codeBlock}>
        <Text style={styles.codeText}>{value && value.length > 0 ? value : '-'}</Text>
      </View>
    </View>
  );
}

function MetricChip({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={styles.metricChip}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function SelectionRow({
  label,
  options,
  selectedValue,
  onSelect,
}: {
  label: string;
  options: Array<{ id: string; title: string; subtitle?: string }>;
  selectedValue: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <View style={styles.selectionSection}>
      <Text style={styles.selectionTitle}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.selectionScrollContent}>
        {options.map((option) => {
          const isSelected = option.id === selectedValue;
          return (
            <TouchableOpacity
              key={option.id}
              style={[styles.selectionChip, isSelected ? styles.selectionChipSelected : null]}
              onPress={() => onSelect(option.id)}
              activeOpacity={0.8}
              testID={`flashcard-debug-select-${label}-${option.id}`}
            >
              <Text style={[styles.selectionChipTitle, isSelected ? styles.selectionChipTitleSelected : null]} numberOfLines={1}>
                {option.title}
              </Text>
              {option.subtitle ? (
                <Text style={[styles.selectionChipSubtitle, isSelected ? styles.selectionChipSubtitleSelected : null]} numberOfLines={1}>
                  {option.subtitle}
                </Text>
              ) : null}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

export default function FlashcardDebugScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ deckId?: string | string[]; cardId?: string | string[]; surface?: string | string[]; options?: string | string[] }>();
  const { decks, updateFlashcard } = useDeckContext();
  const diagnostics = useFlashcardDiagnostics();
  const { theme, isDark } = useTheme();

  const initialDeckId = useMemo(() => (Array.isArray(params.deckId) ? params.deckId[0] : params.deckId) ?? decks[0]?.id ?? null, [decks, params.deckId]);
  const initialCardId = useMemo(() => Array.isArray(params.cardId) ? params.cardId[0] : params.cardId, [params.cardId]);
  const surface = useMemo(() => (Array.isArray(params.surface) ? params.surface[0] : params.surface) ?? 'manual', [params.surface]);
  const incomingOptions = useMemo(() => parseOptionsParam(params.options), [params.options]);

  const [selectedDeckId, setSelectedDeckId] = useState<string | null>(initialDeckId);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(initialCardId ?? null);

  useEffect(() => {
    setSelectedDeckId(initialDeckId);
  }, [initialDeckId]);

  useEffect(() => {
    if (initialCardId) {
      setSelectedCardId(initialCardId);
    }
  }, [initialCardId]);

  const selectedDeck = useMemo(() => decks.find((deck) => deck.id === selectedDeckId) ?? null, [decks, selectedDeckId]);
  const selectedCard = useMemo<Flashcard | null>(() => {
    if (!selectedDeck) {
      return null;
    }

    return selectedDeck.flashcards.find((card) => card.id === selectedCardId) ?? selectedDeck.flashcards[0] ?? null;
  }, [selectedCardId, selectedDeck]);

  useEffect(() => {
    if (!selectedDeck) {
      return;
    }

    if (!selectedCardId || !selectedDeck.flashcards.some((card) => card.id === selectedCardId)) {
      setSelectedCardId(selectedDeck.flashcards[0]?.id ?? null);
    }
  }, [selectedCardId, selectedDeck]);

  const snapshot = useMemo(() => {
    if (!selectedCard) {
      return null;
    }

    return buildFlashcardDebugSnapshot({
      card: selectedCard,
      deckCards: selectedDeck?.flashcards ?? [],
      options: incomingOptions,
    });
  }, [incomingOptions, selectedCard, selectedDeck?.flashcards]);

  const copySnapshot = useCallback(async () => {
    if (!snapshot) {
      return;
    }

    await Clipboard.setStringAsync(serializeFlashcardDebugSnapshot(snapshot));
    Alert.alert('Copied', 'Flashcard debug snapshot copied to your clipboard.');
  }, [snapshot]);

  const rerunNormalization = useCallback(() => {
    if (!selectedDeck || !selectedCard) {
      return;
    }

    const normalized = normalizeFlashcard(selectedCard);
    updateFlashcard(selectedDeck.id, selectedCard.id, {
      question: normalized.question,
      answer: normalized.answer,
      explanation: normalized.explanation,
      content: normalized.content,
    });
    Alert.alert('Normalization re-run', 'The selected flashcard was re-normalized and saved.');
  }, [selectedCard, selectedDeck, updateFlashcard]);

  const deckOptions = useMemo(() => decks.map((deck) => ({
    id: deck.id,
    title: deck.name,
    subtitle: `${deck.flashcards.length} cards`,
  })), [decks]);

  const cardOptions = useMemo(() => (selectedDeck?.flashcards ?? []).map((card) => ({
    id: card.id,
    title: card.content?.canonicalQuestion ?? card.question,
    subtitle: card.content?.answerType ?? card.answer,
  })), [selectedDeck?.flashcards]);

  const aggregate = diagnostics.aggregate;
  const lastUpdatedAt = diagnostics.lastUpdatedAt ? new Date(diagnostics.lastUpdatedAt).toLocaleTimeString() : 'Never';
  const snapshotText = useMemo(() => snapshot ? serializeFlashcardDebugSnapshot(snapshot) : '', [snapshot]);

  if (!canAccessDebugRoute('flashcard-debug')) {
    return <Redirect href={getDebugToolingFallbackHref()} />;
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}> 
      <LinearGradient
        colors={isDark ? [theme.gradientStart, theme.gradientMid, theme.gradientEnd] : ['#eef2ff', '#f8fafc', '#ffffff']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <View style={styles.headerTitleWrap}>
            <View style={[styles.headerIcon, { backgroundColor: `${theme.primary}18` }]}>
              <Bug color={theme.primary} size={18} strokeWidth={2.4} />
            </View>
            <View>
              <Text style={[styles.headerTitle, { color: theme.text }]}>Flashcard Inspector</Text>
              <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>Surface: {surface}</Text>
            </View>
          </View>
          <TouchableOpacity onPress={() => router.back()} style={styles.closeButton} activeOpacity={0.8} testID="flashcard-debug-close">
            <X color={theme.text} size={18} strokeWidth={2.4} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Section title="Diagnostics summary">
            <View style={styles.metricsRow}>
              <MetricChip label="Processed" value={aggregate.cardsProcessed} />
              <MetricChip label="Compressed" value={aggregate.acceptedCompressedCount} />
              <MetricChip label="Rejected" value={aggregate.rejectedCount} />
              <MetricChip label="Collisions" value={aggregate.optionCollisionCount} />
            </View>
            <View style={styles.metricsRow}>
              <MetricChip label="Legacy upgrades" value={aggregate.legacyCardsUpgraded} />
              <MetricChip label="Duplicates" value={aggregate.duplicatePairsRemoved} />
              <MetricChip label="Raw avg" value={aggregate.averageRawAnswerLength.toFixed(1)} />
              <MetricChip label="Canonical avg" value={aggregate.averageCanonicalAnswerLength.toFixed(1)} />
            </View>
            <Text style={[styles.summaryText, { color: theme.textSecondary }]}>Last update: {lastUpdatedAt}</Text>
          </Section>

          {deckOptions.length > 0 ? (
            <SelectionRow
              label="Deck"
              options={deckOptions}
              selectedValue={selectedDeck?.id ?? null}
              onSelect={setSelectedDeckId}
            />
          ) : null}

          {cardOptions.length > 0 ? (
            <SelectionRow
              label="Card"
              options={cardOptions}
              selectedValue={selectedCard?.id ?? null}
              onSelect={setSelectedCardId}
            />
          ) : null}

          {snapshot ? (
            <>
              <View style={styles.actionsRow}>
                <TouchableOpacity style={[styles.primaryButton, { backgroundColor: theme.primary }]} onPress={copySnapshot} activeOpacity={0.85} testID="flashcard-debug-copy">
                  <Copy color="#fff" size={16} strokeWidth={2.4} />
                  <Text style={styles.primaryButtonText}>Copy snapshot</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.secondaryButton, { borderColor: `${theme.primary}3a` }]} onPress={rerunNormalization} activeOpacity={0.85} testID="flashcard-debug-rerun">
                  <RefreshCw color={theme.primary} size={16} strokeWidth={2.4} />
                  <Text style={[styles.secondaryButtonText, { color: theme.primary }]}>Re-run</Text>
                </TouchableOpacity>
              </View>

              <Section title="Meta">
                <View style={styles.inlineMetaWrap}>
                  <MetricChip label="Fit score" value={snapshot.canonical.fitScore} />
                  <MetricChip label="Answer type" value={snapshot.canonical.answerType} />
                  <MetricChip label="Compressed" value={snapshot.meta.wasCompressed ? 'Yes' : 'No'} />
                  <MetricChip label="Legacy" value={snapshot.meta.wasLegacyMigrated ? 'Yes' : 'No'} />
                </View>
                <View style={styles.inlineMetaWrap}>
                  <MetricChip label="Extracted explanation" value={snapshot.meta.explanationExtracted ? 'Yes' : 'No'} />
                  <MetricChip label="Unchanged" value={snapshot.meta.unchanged ? 'Yes' : 'No'} />
                  <MetricChip label="Duplicate count" value={snapshot.meta.duplicateCountInDeck} />
                  <MetricChip label="Preservation" value={snapshot.meta.preservation} />
                </View>
              </Section>

              <Section title="Raw layer">
                <CodeBlock label="Raw question" value={snapshot.raw.question} />
                <CodeBlock label="Raw answer" value={snapshot.raw.answer} />
                <CodeBlock label="Raw explanation" value={snapshot.raw.explanation} />
              </Section>

              <Section title="Canonical layer">
                <CodeBlock label="Canonical question" value={snapshot.canonical.question} />
                <CodeBlock label="Canonical answer" value={snapshot.canonical.answer} />
                <CodeBlock label="Normalized answer" value={snapshot.canonical.normalizedAnswer} />
                <CodeBlock label="Explanation" value={snapshot.canonical.explanation} />
                <CodeBlock label="Quality flags" value={snapshot.canonical.qualityFlags.join(', ')} />
                <CodeBlock label="Reason codes" value={snapshot.canonical.reasonCodes.join(', ')} />
              </Section>

              <Section title="Projection layer">
                <CodeBlock label={`Study question (${snapshot.quality.studyQuestion})`} value={snapshot.projections.studyQuestion} />
                <CodeBlock label={`Study answer (${snapshot.quality.studyAnswer})`} value={snapshot.projections.studyAnswer} />
                <CodeBlock label={`Gameplay question (${snapshot.quality.gameplayQuestion})`} value={snapshot.projections.gameplayQuestion} />
                <CodeBlock label={`Tile answer (${snapshot.quality.tileAnswer})`} value={snapshot.projections.tileAnswer} />
                <CodeBlock label={`Battle question (${snapshot.quality.battleQuestion})`} value={snapshot.projections.battleQuestion} />
                <CodeBlock label={`Battle answer (${snapshot.quality.battleAnswer})`} value={snapshot.projections.battleAnswer} />
              </Section>

              <Section title="Options">
                {snapshot.options.length === 0 ? (
                  <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No option payload was supplied for this surface.</Text>
                ) : snapshot.options.map((option) => (
                  <View key={option.id} style={styles.optionCard}>
                    <Text style={[styles.optionTitle, { color: theme.text }]}>{option.displayText}</Text>
                    <Text style={[styles.optionMeta, { color: theme.textSecondary }]}>displayText</Text>
                    <Text style={[styles.optionBody, { color: theme.text }]}>{option.canonicalValue}</Text>
                    <Text style={[styles.optionMeta, { color: theme.textSecondary }]}>canonicalValue</Text>
                    <Text style={[styles.optionBody, { color: theme.text }]}>{option.normalizedValue}</Text>
                    <Text style={[styles.optionMeta, { color: theme.textSecondary }]}>normalizedValue</Text>
                  </View>
                ))}
              </Section>

              <Section title="Source breakdown">
                {Object.entries(aggregate.sourceBreakdown)
                  .filter(([, value]) => value.decks > 0 || value.cardsProcessed > 0)
                  .map(([source, value]) => (
                    <View key={source} style={styles.summaryCard}>
                      <Text style={[styles.summaryCardTitle, { color: theme.text }]}>{source}</Text>
                      <Text style={[styles.summaryCardSubtitle, { color: theme.textSecondary }]}>
                        decks {value.decks} · processed {value.cardsProcessed} · accepted {value.cardsAccepted} · compressed {value.acceptedCompressedCount} · rejected {value.rejectedCount}
                      </Text>
                    </View>
                  ))}
              </Section>

              <Section title="Recent deck summaries">
                {(diagnostics.recentDecks.length === 0 ? getFlashcardDiagnosticsState().recentDecks : diagnostics.recentDecks).slice(0, 6).map((summary) => (
                  <View key={`${summary.deckId}-${summary.createdAt}`} style={styles.summaryCard}>
                    <Text style={[styles.summaryCardTitle, { color: theme.text }]}>{summary.deckId}</Text>
                    <Text style={[styles.summaryCardSubtitle, { color: theme.textSecondary }]}>
                      {summary.source} · accepted {summary.acceptedCount}/{summary.processedCount} · compressed {summary.acceptedCompressedCount} · rejected {summary.rejectedCount}
                    </Text>
                  </View>
                ))}
              </Section>

              <Section title="Recent option collisions">
                {diagnostics.recentOptionCollisions.length === 0 ? (
                  <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No option label collisions have been recorded in this session.</Text>
                ) : diagnostics.recentOptionCollisions.slice(0, 6).map((collision) => (
                  <View key={`${collision.cardId ?? 'unknown'}-${collision.createdAt}`} style={styles.summaryCard}>
                    <Text style={[styles.summaryCardTitle, { color: theme.text }]}>{collision.surface} · {collision.source}</Text>
                    <Text style={[styles.summaryCardSubtitle, { color: theme.textSecondary }]}>
                      {collision.cardId ?? 'no-card'} · fallback {collision.fallbackCount} · labels {collision.collisions.map((entry) => entry.displayText).join(', ')}
                    </Text>
                  </View>
                ))}
              </Section>

              <Section title="Snapshot payload">
                <CodeBlock label="JSON" value={snapshotText} />
              </Section>
            </>
          ) : (
            <View style={styles.emptyWrap}>
              <Text style={[styles.emptyTitle, { color: theme.text }]}>No flashcard selected</Text>
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>Pick a deck and flashcard to inspect its raw, canonical, projection, and option layers.</Text>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  headerSubtitle: {
    marginTop: 2,
    fontSize: 13,
    fontWeight: '600',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.08)',
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 36,
    gap: 16,
  },
  section: {
    borderRadius: 22,
    padding: 16,
    backgroundColor: 'rgba(255,255,255,0.82)',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.18)',
    gap: 12,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
  },
  metricsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metricChip: {
    minWidth: 92,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: 'rgba(15, 23, 42, 0.04)',
    gap: 4,
  },
  metricValue: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
  },
  summaryText: {
    fontSize: 13,
    fontWeight: '600',
  },
  selectionSection: {
    gap: 8,
  },
  selectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#334155',
    paddingHorizontal: 4,
  },
  selectionScrollContent: {
    gap: 10,
    paddingHorizontal: 2,
  },
  selectionChip: {
    width: 176,
    padding: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.84)',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.16)',
    gap: 4,
  },
  selectionChipSelected: {
    backgroundColor: 'rgba(99, 102, 241, 0.14)',
    borderColor: 'rgba(99, 102, 241, 0.28)',
  },
  selectionChipTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  selectionChipTitleSelected: {
    color: '#4338ca',
  },
  selectionChipSubtitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
  },
  selectionChipSubtitleSelected: {
    color: '#6366f1',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderRadius: 16,
    flex: 1,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderRadius: 16,
    borderWidth: 1,
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.84)',
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '800',
  },
  inlineMetaWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  blockWrap: {
    gap: 6,
  },
  blockLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#475569',
  },
  codeBlock: {
    borderRadius: 16,
    backgroundColor: 'rgba(15, 23, 42, 0.06)',
    padding: 12,
  },
  codeText: {
    fontSize: 13,
    lineHeight: 20,
    color: '#0f172a',
  },
  optionCard: {
    borderRadius: 16,
    backgroundColor: 'rgba(15, 23, 42, 0.04)',
    padding: 12,
    gap: 4,
  },
  optionTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  optionMeta: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  optionBody: {
    fontSize: 13,
    lineHeight: 18,
  },
  summaryCard: {
    borderRadius: 16,
    backgroundColor: 'rgba(15, 23, 42, 0.04)',
    padding: 12,
    gap: 4,
  },
  summaryCardTitle: {
    fontSize: 13,
    fontWeight: '800',
  },
  summaryCardSubtitle: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
  },
  emptyWrap: {
    borderRadius: 22,
    padding: 18,
    backgroundColor: 'rgba(255,255,255,0.82)',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.18)',
    gap: 8,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  emptyText: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
  },
  devOnlyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 14,
  },
  devOnlyTitle: {
    fontSize: 20,
    fontWeight: '800',
  },
});
