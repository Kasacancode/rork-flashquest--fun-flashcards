import { ChevronDown } from 'lucide-react-native';
import React, { memo, useCallback, useState } from 'react';
import { FlatList, LayoutAnimation, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import type { DeckProgressSummary } from '@/utils/deckSelectors';
import type { MasteryBreakdown } from '@/utils/mastery';

interface StatsDeckProgressListProps {
  deckProgressSummaries: DeckProgressSummary[];
  deckMasteryDetails: Map<string, MasteryBreakdown>;
  deckDueCounts: Map<string, number>;
  textColor: string;
  secondaryTextColor: string;
  emptyTextColor: string;
  emptySurfaceColor: string;
  trackColor: string;
  isDark: boolean;
  onStudyDeck: (deckId: string) => void;
}

interface StatsDeckProgressRowProps {
  item: DeckProgressSummary;
  mastery: MasteryBreakdown | undefined;
  dueCount: number;
  isExpanded: boolean;
  onToggle: () => void;
  onStudy: () => void;
  textColor: string;
  secondaryTextColor: string;
  trackColor: string;
  isDark: boolean;
}

const StatsDeckProgressRow = memo(function StatsDeckProgressRow({
  item,
  mastery,
  dueCount,
  isExpanded,
  onToggle,
  onStudy,
  textColor,
  secondaryTextColor,
  trackColor,
  isDark,
}: StatsDeckProgressRowProps) {
  return (
    <TouchableOpacity
      style={styles.deckProgressCard}
      onPress={onToggle}
      activeOpacity={0.8}
      testID={`progress-card-${item.id}`}
      accessible={true}
      accessibilityRole="button"
      accessibilityState={{ expanded: isExpanded }}
      accessibilityLabel={`${item.name}: ${item.pct}% mastered`}
    >
      <View style={[styles.deckIndicator, { backgroundColor: item.color }]} />
      <View style={styles.deckProgressInfo}>
        <View style={styles.deckProgressHeader}>
          <Text style={[styles.deckProgressName, { color: textColor }]} numberOfLines={1}>
            {item.name}
          </Text>
          <View style={styles.deckProgressRight}>
            <Text
              style={[
                styles.deckProgressPct,
                {
                  color: item.pct === 100 ? '#10B981' : secondaryTextColor,
                },
              ]}
            >
              {item.pct === 100 ? '100%' : `${item.mastered}/${item.total}`}
            </Text>
            <ChevronDown
              color={secondaryTextColor}
              size={14}
              strokeWidth={2}
              style={{ transform: [{ rotate: isExpanded ? '180deg' : '0deg' }] }}
            />
          </View>
        </View>
        <View style={[styles.deckProgressBarTrack, { backgroundColor: trackColor }]}>
          <View
            style={[
              styles.deckProgressBarFill,
              {
                width: `${item.pct}%`,
                backgroundColor: item.color,
              },
            ]}
          />
        </View>

        {isExpanded && mastery ? (
          <View style={styles.deckExpandedSection}>
            <View style={styles.deckBreakdownRow}>
              <View style={styles.deckBreakdownItem}>
                <View style={[styles.deckBreakdownDot, { backgroundColor: '#10B981' }]} />
                <Text style={[styles.deckBreakdownText, { color: secondaryTextColor }]}>{mastery.mastered} mastered</Text>
              </View>
              <View style={styles.deckBreakdownItem}>
                <View style={[styles.deckBreakdownDot, { backgroundColor: '#3B82F6' }]} />
                <Text style={[styles.deckBreakdownText, { color: secondaryTextColor }]}>{mastery.reviewing} reviewing</Text>
              </View>
              <View style={styles.deckBreakdownItem}>
                <View style={[styles.deckBreakdownDot, { backgroundColor: '#F59E0B' }]} />
                <Text style={[styles.deckBreakdownText, { color: secondaryTextColor }]}>{mastery.learning} learning</Text>
              </View>
            </View>
            <View style={styles.deckBreakdownRow}>
              {mastery.lapsed > 0 ? (
                <View style={styles.deckBreakdownItem}>
                  <View style={[styles.deckBreakdownDot, { backgroundColor: '#EF4444' }]} />
                  <Text style={[styles.deckBreakdownText, { color: secondaryTextColor }]}>{mastery.lapsed} lapsed</Text>
                </View>
              ) : null}
              {mastery.newCards > 0 ? (
                <View style={styles.deckBreakdownItem}>
                  <View
                    style={[
                      styles.deckBreakdownDot,
                      { backgroundColor: isDark ? 'rgba(148,163,184,0.4)' : 'rgba(0,0,0,0.2)' },
                    ]}
                  />
                  <Text style={[styles.deckBreakdownText, { color: secondaryTextColor }]}>{mastery.newCards} new</Text>
                </View>
              ) : null}
              {dueCount > 0 ? (
                <View style={styles.deckBreakdownItem}>
                  <View style={[styles.deckBreakdownDot, { backgroundColor: '#8B5CF6' }]} />
                  <Text style={[styles.deckBreakdownText, { color: secondaryTextColor }]}>{dueCount} due now</Text>
                </View>
              ) : null}
            </View>

            <TouchableOpacity
              style={[
                styles.deckStudyButton,
                { backgroundColor: isDark ? `${item.color}18` : `${item.color}12` },
              ]}
              onPress={(event) => {
                event.stopPropagation();
                onStudy();
              }}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={`Study ${item.name}`}
              testID={`progress-study-${item.id}`}
            >
              <Text style={[styles.deckStudyButtonText, { color: item.color }]}>Study this deck</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  );
});

function StatsDeckProgressList({
  deckProgressSummaries,
  deckMasteryDetails,
  deckDueCounts,
  textColor,
  secondaryTextColor,
  emptyTextColor,
  emptySurfaceColor,
  trackColor,
  isDark,
  onStudyDeck,
}: StatsDeckProgressListProps) {
  const [expandedDeckId, setExpandedDeckId] = useState<string | null>(null);

  const handleToggle = useCallback((deckId: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedDeckId((prev) => (prev === deckId ? null : deckId));
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: DeckProgressSummary }) => (
      <StatsDeckProgressRow
        item={item}
        mastery={deckMasteryDetails.get(item.id)}
        dueCount={deckDueCounts.get(item.id) ?? 0}
        isExpanded={expandedDeckId === item.id}
        onToggle={() => handleToggle(item.id)}
        onStudy={() => onStudyDeck(item.id)}
        textColor={textColor}
        secondaryTextColor={secondaryTextColor}
        trackColor={trackColor}
        isDark={isDark}
      />
    ),
    [deckDueCounts, deckMasteryDetails, expandedDeckId, handleToggle, isDark, onStudyDeck, secondaryTextColor, textColor, trackColor],
  );

  const keyExtractor = useCallback((item: DeckProgressSummary) => item.id, []);

  if (deckProgressSummaries.length === 0) {
    return (
      <View style={[styles.emptyState, { backgroundColor: emptySurfaceColor }]} testID="stats-empty-progress">
        <Text style={[styles.emptyText, { color: emptyTextColor }]}>Create a deck to start tracking progress!</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={deckProgressSummaries}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      scrollEnabled={false}
      removeClippedSubviews={false}
      contentContainerStyle={styles.listContent}
      initialNumToRender={8}
      maxToRenderPerBatch={12}
      windowSize={5}
      extraData={expandedDeckId}
    />
  );
}

export default memo(StatsDeckProgressList);

const styles = StyleSheet.create({
  listContent: {
    gap: 12,
  },
  emptyState: {
    borderRadius: 18,
    paddingVertical: 18,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '600' as const,
    textAlign: 'center',
  },
  deckProgressCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  deckIndicator: {
    width: 10,
    minHeight: 46,
    borderRadius: 999,
  },
  deckProgressInfo: {
    flex: 1,
    gap: 9,
  },
  deckProgressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  deckProgressName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700' as const,
  },
  deckProgressPct: {
    fontSize: 13,
    fontWeight: '700' as const,
  },
  deckProgressRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  deckProgressBarTrack: {
    height: 10,
    borderRadius: 999,
    overflow: 'hidden',
  },
  deckProgressBarFill: {
    height: '100%',
    borderRadius: 999,
  },
  deckExpandedSection: {
    marginTop: 10,
    gap: 8,
  },
  deckBreakdownRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  deckBreakdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  deckBreakdownDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  deckBreakdownText: {
    fontSize: 12,
    fontWeight: '600' as const,
  },
  deckStudyButton: {
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 4,
  },
  deckStudyButtonText: {
    fontSize: 13,
    fontWeight: '700' as const,
  },
});
