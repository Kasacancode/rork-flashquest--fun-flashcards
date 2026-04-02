import React, { memo, useCallback } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';

import type { DeckProgressSummary } from '@/utils/deckSelectors';

interface StatsDeckProgressListProps {
  deckProgressSummaries: DeckProgressSummary[];
  textColor: string;
  secondaryTextColor: string;
  emptyTextColor: string;
  emptySurfaceColor: string;
  trackColor: string;
}

interface StatsDeckProgressRowProps {
  item: DeckProgressSummary;
  textColor: string;
  secondaryTextColor: string;
  trackColor: string;
}

const StatsDeckProgressRow = memo(function StatsDeckProgressRow({ item, textColor, secondaryTextColor, trackColor }: StatsDeckProgressRowProps) {
  return (
    <View
      style={styles.deckProgressCard}
      testID={`progress-card-${item.id}`}
      accessible={true}
      accessibilityLabel={`${item.name}: ${item.pct}% mastered, ${item.mastered} of ${item.total} cards mastered`}
    >
      <View style={[styles.deckIndicator, { backgroundColor: item.color }]} />
      <View style={styles.deckProgressInfo}>
        <View style={styles.deckProgressHeader}>
          <Text style={[styles.deckProgressName, { color: textColor }]} numberOfLines={1}>
            {item.name}
          </Text>
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
      </View>
    </View>
  );
});

function StatsDeckProgressList({
  deckProgressSummaries,
  textColor,
  secondaryTextColor,
  emptyTextColor,
  emptySurfaceColor,
  trackColor,
}: StatsDeckProgressListProps) {
  const renderItem = useCallback(
    ({ item }: { item: DeckProgressSummary }) => (
      <StatsDeckProgressRow
        item={item}
        textColor={textColor}
        secondaryTextColor={secondaryTextColor}
        trackColor={trackColor}
      />
    ),
    [secondaryTextColor, textColor, trackColor],
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
    alignItems: 'center',
    gap: 12,
  },
  deckIndicator: {
    width: 10,
    height: 46,
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
  deckProgressBarTrack: {
    height: 10,
    borderRadius: 999,
    overflow: 'hidden',
  },
  deckProgressBarFill: {
    height: '100%',
    borderRadius: 999,
  },
});
