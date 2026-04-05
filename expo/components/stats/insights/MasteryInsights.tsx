import { AlertCircle, ChevronRight, Target } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import React, { memo, useMemo } from 'react';
import { Text, TouchableOpacity, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';

import type { InsightStyles, InsightThemeColors } from '@/components/stats/insights/insightTypes';
import { deckHubHref } from '@/utils/routes';

interface MasteryInsightsProps {
  masteryOverview: {
    mastered: number;
    totalCards: number;
    lapsed: number;
  };
  deckProgressSummaries: Array<{
    id: string;
    name: string;
    pct: number;
    total: number;
  }>;
  colors: InsightThemeColors;
  styles: InsightStyles & {
    deckMiniBarSection: StyleProp<ViewStyle>;
    deckMiniRow: StyleProp<ViewStyle>;
    deckMiniName: StyleProp<TextStyle>;
    deckMiniBarTrack: StyleProp<ViewStyle>;
    deckMiniBarFill: StyleProp<ViewStyle>;
    deckMiniPct: StyleProp<TextStyle>;
  };
  isDark: boolean;
  onStudyDeck: (deckId: string) => void;
}

function MasteryInsights({
  masteryOverview,
  deckProgressSummaries,
  colors,
  styles,
  isDark,
  onStudyDeck,
}: MasteryInsightsProps) {
  const router = useRouter();

  const topDecks = useMemo(() => {
    return [...deckProgressSummaries]
      .filter((deck) => deck.total > 0)
      .sort((a, b) => b.pct - a.pct)
      .slice(0, 5);
  }, [deckProgressSummaries]);

  const weakestDeck = useMemo(() => {
    return [...deckProgressSummaries]
      .filter((deck) => deck.total >= 4 && deck.pct < 50)
      .sort((a, b) => a.pct - b.pct)[0] ?? null;
  }, [deckProgressSummaries]);

  const masteryText = useMemo(() => {
    const total = masteryOverview.totalCards;
    const mastered = masteryOverview.mastered;
    if (total === 0) {
      return 'Add some decks to start tracking mastery.';
    }

    const pct = Math.round((mastered / total) * 100);
    const nextMilestone = [10, 25, 50, 75, 100].find((milestone) => milestone > pct) ?? 100;
    const cardsNeeded = Math.ceil((nextMilestone / 100) * total) - mastered;

    if (pct >= 100 || cardsNeeded <= 0) {
      return '100% overall mastery. Every tracked card is mastered right now.';
    }

    return `${pct}% overall mastery. Master ${cardsNeeded} more card${cardsNeeded === 1 ? '' : 's'} to reach ${nextMilestone}%.`;
  }, [masteryOverview.mastered, masteryOverview.totalCards]);

  return (
    <View style={styles.insightSection}>
      <View style={[styles.insightDivider, { backgroundColor: colors.border }]} />

      <View style={styles.insightRow}>
        <Target color={colors.statsAccent} size={15} />
        <Text style={[styles.insightText, { color: colors.textSecondary }]}>{masteryText}</Text>
      </View>

      {masteryOverview.lapsed > 0 ? (
        <View style={styles.insightRow}>
          <AlertCircle color={colors.error} size={15} />
          <Text style={[styles.insightText, { color: colors.textSecondary }]}>
            {masteryOverview.lapsed} card{masteryOverview.lapsed === 1 ? ' has' : 's have'} lapsed. A quick review session will bring them back.
          </Text>
        </View>
      ) : null}

      <View style={styles.deckMiniBarSection}>
        {topDecks.map((deck) => (
          <TouchableOpacity
            key={deck.id}
            style={styles.deckMiniRow}
            onPress={() => router.push(deckHubHref(deck.id, 'stats'))}
            activeOpacity={0.8}
            testID={`stats-mastery-deck-${deck.id}`}
          >
            <Text style={[styles.deckMiniName, { color: colors.text }]} numberOfLines={1}>{deck.name}</Text>
            <View style={[styles.deckMiniBarTrack, { backgroundColor: isDark ? 'rgba(148,163,184,0.1)' : 'rgba(0,0,0,0.04)' }]}>
              <View style={[styles.deckMiniBarFill, { width: `${Math.max(deck.pct, 2)}%`, backgroundColor: deck.pct >= 50 ? colors.success : colors.statsAccent }]} />
            </View>
            <Text style={[styles.deckMiniPct, { color: colors.textSecondary }]}>{deck.pct}%</Text>
          </TouchableOpacity>
        ))}
      </View>

      {weakestDeck ? (
        <TouchableOpacity
          style={[styles.insightAction, { backgroundColor: isDark ? 'rgba(99,102,241,0.1)' : 'rgba(99,102,241,0.06)' }]}
          onPress={() => onStudyDeck(weakestDeck.id)}
          activeOpacity={0.8}
          testID="stats-mastery-insight-action"
        >
          <Text style={[styles.insightActionText, { color: colors.statsAccent }]}>Study {weakestDeck.name}</Text>
          <ChevronRight color={colors.statsAccent} size={14} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

export default memo(MasteryInsights);
