import React, { memo, useCallback } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';

import type { Theme } from '@/constants/colors';
import type { ArenaLeaderboardEntry } from '@/types/arena';

interface ArenaRecentBattlesListProps {
  entries: ArenaLeaderboardEntry[];
  theme: Theme;
  isDark: boolean;
  arenaAccent: string;
  insetSurface: string;
  secondarySurface: string;
  subtleBorderColor: string;
  hasSavedPlayerName: boolean;
  savedPlayerName: string;
}

interface ArenaRecentBattleRowProps {
  entry: ArenaLeaderboardEntry;
  theme: Theme;
  isDark: boolean;
  arenaAccent: string;
  insetSurface: string;
  secondarySurface: string;
  subtleBorderColor: string;
  isPersonalWin: boolean;
}

function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatTimerLabel(timerSeconds: number): string {
  return timerSeconds > 0 ? `${timerSeconds}s timer` : 'No timer';
}

const ArenaRecentBattleRow = memo(function ArenaRecentBattleRow({
  entry,
  theme,
  isDark,
  arenaAccent,
  insetSurface,
  secondarySurface,
  subtleBorderColor,
  isPersonalWin,
}: ArenaRecentBattleRowProps) {
  return (
    <View
      style={[
        styles.item,
        {
          backgroundColor: secondarySurface,
          borderColor: subtleBorderColor,
        },
      ]}
      testID={`battle-recent-row-${entry.id}`}
    >
      <View style={styles.main}>
        <View style={styles.titleRow}>
          <Text style={[styles.winner, { color: theme.text }]} numberOfLines={1}>
            {entry.winnerName}
          </Text>
          <View
            style={[
              styles.resultPill,
              {
                backgroundColor: isPersonalWin ? (isDark ? 'rgba(251, 146, 60, 0.16)' : 'rgba(235, 106, 26, 0.1)') : insetSurface,
                borderColor: isPersonalWin ? (isDark ? 'rgba(251, 146, 60, 0.28)' : 'rgba(235, 106, 26, 0.15)') : subtleBorderColor,
              },
            ]}
          >
            <Text style={[styles.resultPillText, { color: isPersonalWin ? arenaAccent : theme.textSecondary }]}>
              {isPersonalWin ? 'You won' : 'Winner'}
            </Text>
          </View>
        </View>
        <Text style={[styles.deck, { color: theme.textSecondary }]} numberOfLines={1}>
          {entry.deckName}
        </Text>
        <Text style={[styles.meta, { color: theme.textTertiary }]} numberOfLines={2}>
          {`${entry.playerCount} players · ${entry.rounds} rounds · ${formatTimerLabel(entry.timerSeconds)} · ${formatDate(entry.completedAt)}`}
        </Text>
      </View>
      <View style={styles.scoreBlock}>
        <Text style={[styles.points, { color: theme.text }]}>{entry.winnerPoints}</Text>
        <Text style={[styles.scoreLabel, { color: theme.textSecondary }]}>{`${Math.round(entry.winnerAccuracy * 100)}% acc`}</Text>
      </View>
    </View>
  );
});

function ArenaRecentBattlesList({
  entries,
  theme,
  isDark,
  arenaAccent,
  insetSurface,
  secondarySurface,
  subtleBorderColor,
  hasSavedPlayerName,
  savedPlayerName,
}: ArenaRecentBattlesListProps) {
  const normalizedSavedPlayerName = savedPlayerName.toLowerCase();

  const renderItem = useCallback(
    ({ item }: { item: ArenaLeaderboardEntry }) => (
      <ArenaRecentBattleRow
        entry={item}
        theme={theme}
        isDark={isDark}
        arenaAccent={arenaAccent}
        insetSurface={insetSurface}
        secondarySurface={secondarySurface}
        subtleBorderColor={subtleBorderColor}
        isPersonalWin={hasSavedPlayerName && item.winnerName.toLowerCase() === normalizedSavedPlayerName}
      />
    ),
    [arenaAccent, hasSavedPlayerName, insetSurface, isDark, normalizedSavedPlayerName, secondarySurface, subtleBorderColor, theme],
  );

  const keyExtractor = useCallback((item: ArenaLeaderboardEntry) => item.id, []);

  return (
    <FlatList
      data={entries}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      scrollEnabled={false}
      ItemSeparatorComponent={ItemSeparator}
      removeClippedSubviews={false}
      initialNumToRender={6}
      maxToRenderPerBatch={8}
      windowSize={5}
      testID="battle-recent-battles-list"
    />
  );
}

function ItemSeparator() {
  return <View style={styles.separator} />;
}

export default memo(ArenaRecentBattlesList);

const styles = StyleSheet.create({
  separator: {
    height: 12,
  },
  item: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  main: {
    flex: 1,
    minWidth: 0,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 4,
  },
  winner: {
    flex: 1,
    fontSize: 15,
    fontWeight: '800' as const,
  },
  resultPill: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
  resultPillText: {
    fontSize: 10,
    fontWeight: '800' as const,
    textTransform: 'uppercase' as const,
  },
  deck: {
    fontSize: 13,
    fontWeight: '700' as const,
    marginBottom: 4,
  },
  meta: {
    fontSize: 12,
    fontWeight: '600' as const,
    lineHeight: 18,
  },
  scoreBlock: {
    minWidth: 60,
    alignItems: 'flex-end',
  },
  points: {
    fontSize: 20,
    fontWeight: '900' as const,
  },
  scoreLabel: {
    fontSize: 11,
    fontWeight: '700' as const,
  },
});
