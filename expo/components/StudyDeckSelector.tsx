import { useRouter } from 'expo-router';
import { Clock, Sparkles } from 'lucide-react-native';
import React, { useMemo } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { usePerformance } from '@/context/PerformanceContext';
import { useTheme } from '@/context/ThemeContext';
import type { Deck } from '@/types/flashcard';
import { DECKS_ROUTE } from '@/utils/routes';
import { getDeckStudySummary, type StudyMode } from '@/utils/studyHelpers';

interface StudyDeckSelectorProps {
  visible: boolean;
  onSelectDeck: (deckId: string) => void;
  onClose: () => void;
  decks: Deck[];
  selectedDeckId: string | null;
  studyMode: StudyMode | null;
}

export default function StudyDeckSelector({
  visible,
  onSelectDeck,
  onClose,
  decks,
  selectedDeckId,
  studyMode,
}: StudyDeckSelectorProps) {
  const router = useRouter();
  const { performance } = usePerformance();
  const { theme, isDark } = useTheme();

  const deckSummaries = useMemo(() => {
    const entries = new Map<string, ReturnType<typeof getDeckStudySummary>>();

    for (const deck of decks) {
      entries.set(deck.id, getDeckStudySummary(deck.flashcards, performance.cardStatsById));
    }

    return entries;
  }, [decks, performance.cardStatsById]);

  const selectorTestId = studyMode ? `study-deck-selector-${studyMode}` : 'study-deck-selector';

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: isDark ? theme.card : '#fff' }]} testID={selectorTestId}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: isDark ? theme.text : '#333' }]}>Select a Deck</Text>
            <TouchableOpacity onPress={onClose} accessibilityRole="button" accessibilityLabel="Close deck selector">
              <Text style={[styles.modalClose, { color: isDark ? theme.textSecondary : '#666' }]}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.deckList} showsVerticalScrollIndicator={false}>
            {decks.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={[styles.emptyStateTitle, { color: isDark ? '#fff' : '#333' }]}>No Decks Yet</Text>
                <Text style={[styles.emptyStateText, { color: isDark ? 'rgba(255,255,255,0.6)' : '#666' }]}>Create your first deck to start studying.</Text>
                <TouchableOpacity
                  onPress={() => {
                    onClose();
                    router.push(DECKS_ROUTE);
                  }}
                  style={[styles.emptyStateButton, { backgroundColor: theme.primary }]}
                  testID="study-empty-go-to-decks-button"
                >
                  <Text style={styles.emptyStateButtonText}>Go to Decks</Text>
                </TouchableOpacity>
              </View>
            ) : (
              decks.map((deck) => {
                const summary = deckSummaries.get(deck.id);
                const actionCount = (summary?.dueCount ?? 0) + (summary?.lapsedCount ?? 0);
                const hasAction = actionCount > 0;
                const allNew = (summary?.newCount ?? 0) === deck.flashcards.length;

                return (
                  <TouchableOpacity
                    key={deck.id}
                    style={[styles.deckOption, { backgroundColor: theme.deckOption }]}
                    onPress={() => onSelectDeck(deck.id)}
                    activeOpacity={0.7}
                    accessibilityLabel={`${deck.name}. ${deck.flashcards.length} cards`}
                    accessibilityRole="button"
                    accessibilityState={{ selected: selectedDeckId === deck.id }}
                  >
                    <View style={[styles.deckColorDot, { backgroundColor: deck.color }]} />
                    <View style={styles.deckOptionInfo}>
                      <Text style={[styles.deckOptionName, { color: isDark ? '#f1f5f9' : '#333' }]}>{deck.name}</Text>
                      <View style={styles.deckOptionMeta}>
                        <Text style={[styles.deckOptionCards, { color: isDark ? '#cbd5e1' : '#666' }]}>{deck.flashcards.length} cards</Text>
                        {hasAction ? (
                          <View style={styles.deckDueBadge}>
                            <Clock color="#F59E0B" size={11} strokeWidth={2.5} />
                            <Text style={styles.deckDueBadgeText}>{actionCount} due</Text>
                          </View>
                        ) : allNew ? (
                          <View style={[styles.deckDueBadge, styles.deckNewBadge]}>
                            <Sparkles color="#60A5FA" size={11} strokeWidth={2.5} />
                            <Text style={[styles.deckDueBadgeText, styles.deckNewBadgeText]}>New</Text>
                          </View>
                        ) : null}
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingTop: 24,
    paddingBottom: 40,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: '#333',
  },
  modalClose: {
    fontSize: 28,
    color: '#666',
    fontWeight: '400' as const,
  },
  deckList: {
    paddingHorizontal: 24,
  },
  emptyState: {
    alignItems: 'center',
    padding: 32,
  },
  emptyStateTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyStateText: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
  },
  emptyStateButton: {
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 24,
  },
  emptyStateButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#fff',
  },
  deckOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  deckColorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 16,
  },
  deckOptionInfo: {
    flex: 1,
  },
  deckOptionName: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: '#333',
    marginBottom: 2,
  },
  deckOptionCards: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500' as const,
  },
  deckOptionMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 1,
  },
  deckDueBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(245, 158, 11, 0.14)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  deckDueBadgeText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: '#D97706',
  },
  deckNewBadge: {
    backgroundColor: 'rgba(96, 165, 250, 0.14)',
  },
  deckNewBadgeText: {
    color: '#2563EB',
  },
});
