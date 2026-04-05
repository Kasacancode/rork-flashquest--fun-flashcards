import { ChevronDown, Clock } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/context/ThemeContext';
import type { Flashcard } from '@/types/flashcard';
import type { CardMemoryStatus, CardStats } from '@/types/performance';
import { getLiveCardStats, isCardDueForReview } from '@/utils/mastery';

interface CardScheduleListProps {
  flashcards: Flashcard[];
  cardStatsById: Record<string, CardStats>;
}

const STATUS_COLORS: Record<CardMemoryStatus, string> = {
  mastered: '#10B981',
  reviewing: '#3B82F6',
  learning: '#F59E0B',
  lapsed: '#EF4444',
  new: '#94A3B8',
};

const STATUS_LABELS: Record<CardMemoryStatus, string> = {
  mastered: 'Mastered',
  reviewing: 'Reviewing',
  learning: 'Learning',
  lapsed: 'Lapsed',
  new: 'New',
};

function formatDueDate(nextReviewAt: number | null, status: CardMemoryStatus, now: number): string {
  if (status === 'new') return 'Not started';
  if (status === 'mastered') return 'Mastered';
  if (!nextReviewAt) return 'No schedule';

  const diffMs = nextReviewAt - now;

  if (diffMs <= 0) return 'Due now';

  const diffHours = diffMs / (1000 * 60 * 60);
  if (diffHours < 1) return 'Due in < 1 hour';
  if (diffHours < 24) {
    const roundedHours = Math.round(diffHours);
    return `Due in ${roundedHours} hour${roundedHours === 1 ? '' : 's'}`;
  }

  const diffDays = Math.round(diffHours / 24);
  if (diffDays === 1) return 'Due tomorrow';
  if (diffDays < 7) return `Due in ${diffDays} days`;
  if (diffDays < 14) return 'Due next week';
  if (diffDays < 30) return `Due in ${Math.round(diffDays / 7)} weeks`;

  const roundedMonths = Math.round(diffDays / 30);
  return `Due in ${roundedMonths} month${roundedMonths === 1 ? '' : 's'}`;
}

interface ScheduleEntry {
  card: Flashcard;
  status: CardMemoryStatus;
  nextReviewAt: number | null;
  stability: number;
  isDue: boolean;
  sortKey: number;
}

export default function CardScheduleList({ flashcards, cardStatsById }: CardScheduleListProps) {
  const { theme, isDark } = useTheme();
  const now = Date.now();
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [contentHeight, setContentHeight] = useState<number>(0);
  const expandAnimation = useRef<Animated.Value>(new Animated.Value(0)).current;

  const entries = useMemo<ScheduleEntry[]>(() => {
    const statusPriority: Record<CardMemoryStatus, number> = {
      lapsed: 0,
      learning: 2,
      reviewing: 3,
      new: 4,
      mastered: 5,
    };

    const result: ScheduleEntry[] = flashcards.map((card) => {
      const stats = cardStatsById[card.id];
      const live = getLiveCardStats(stats, now);
      const isDue = live.status === 'lapsed' || isCardDueForReview(stats, now);

      let sortKey = statusPriority[live.status] ?? 4;
      if (isDue) {
        sortKey = 1;
      }
      if (live.nextReviewAt && isDue) {
        sortKey += (live.nextReviewAt - now) / 1e12;
      }

      return {
        card,
        status: live.status,
        nextReviewAt: live.nextReviewAt,
        stability: live.stability,
        isDue,
        sortKey,
      };
    });

    result.sort((a, b) => a.sortKey - b.sortKey);
    return result;
  }, [cardStatsById, flashcards, now]);

  const dueNowCount = useMemo<number>(() => entries.filter((entry) => entry.isDue).length, [entries]);

  const dueNowSummary = dueNowCount === 0 ? 'Zero Due Now' : `${dueNowCount} Due Now`;
  const trackedSummary = entries.length === 1 ? '1 card tracked' : `${entries.length} cards tracked`;

  useEffect(() => {
    Animated.timing(expandAnimation, {
      toValue: isExpanded ? 1 : 0,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [expandAnimation, isExpanded]);

  const handleToggle = useCallback(() => {
    const nextExpanded = !isExpanded;
    console.log('[CardScheduleList] Toggling schedule section', {
      nextExpanded,
      dueNowCount,
      totalEntries: entries.length,
    });
    setIsExpanded(nextExpanded);
  }, [dueNowCount, entries.length, isExpanded]);

  const handleContentLayout = useCallback((height: number) => {
    if (height <= 0 || Math.abs(height - contentHeight) < 1) {
      return;
    }

    console.log('[CardScheduleList] Measured expanded content height', { height });
    setContentHeight(height);
  }, [contentHeight]);

  const shellBg = isDark ? 'rgba(10, 20, 40, 0.88)' : 'rgba(255,255,255,0.84)';
  const shellBorder = isDark ? 'rgba(148,163,184,0.16)' : 'rgba(99,102,241,0.08)';
  const surfaceBg = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(54, 71, 122, 0.04)';
  const borderColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(54, 71, 122, 0.08)';
  const iconBg = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(99,102,241,0.08)';
  const iconBorder = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(99,102,241,0.12)';
  const countPillBg = dueNowCount > 0
    ? (isDark ? 'rgba(245,158,11,0.14)' : 'rgba(245,158,11,0.1)')
    : (isDark ? 'rgba(148,163,184,0.12)' : 'rgba(99,102,241,0.08)');
  const countPillBorder = dueNowCount > 0
    ? 'rgba(245,158,11,0.22)'
    : (isDark ? 'rgba(148,163,184,0.16)' : 'rgba(99,102,241,0.1)');
  const countTextColor = dueNowCount > 0 ? '#F59E0B' : theme.textSecondary;

  const expandHeight = expandAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, Math.max(contentHeight, 1)],
  });

  const expandOpacity = expandAnimation.interpolate({
    inputRange: [0, 0.15, 1],
    outputRange: [0, 0.45, 1],
  });

  const contentTranslateY = expandAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [-10, 0],
  });

  const chevronRotation = expandAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  return (
    <View style={styles.container} testID="card-schedule-list">
      <View style={[styles.shell, { backgroundColor: shellBg, borderColor: shellBorder }]}> 
        <Pressable
          style={({ pressed }) => [styles.headerPressable, pressed ? styles.headerPressablePressed : null]}
          onPress={handleToggle}
          accessibilityRole="button"
          accessibilityLabel={isExpanded ? 'Collapse card schedule' : 'Expand card schedule'}
          testID="cardScheduleToggle"
        >
          <View style={styles.headerMain}>
            <View style={[styles.headerIconWrap, { backgroundColor: iconBg, borderColor: iconBorder }]}> 
              <Clock color={theme.textSecondary} size={17} strokeWidth={2.2} />
            </View>
            <View style={styles.headerTextWrap}>
              <Text style={[styles.headerText, { color: theme.text }]}>Card Schedule</Text>
              <Text style={[styles.headerSubtext, { color: theme.textSecondary }]} numberOfLines={1}>
                Upcoming reviews and new cards
              </Text>
            </View>
          </View>

          <View style={styles.headerMeta}>
            {!isExpanded ? (
              <View style={[styles.countPill, { backgroundColor: countPillBg, borderColor: countPillBorder }]}>
                <Text style={[styles.countPillText, { color: countTextColor }]}>{dueNowSummary}</Text>
              </View>
            ) : null}
            <Animated.View style={[styles.chevronWrap, { transform: [{ rotate: chevronRotation }] }]}>
              <ChevronDown color={theme.textSecondary} size={18} strokeWidth={2.5} />
            </Animated.View>
          </View>
        </Pressable>

        <Animated.View style={[styles.expandWrap, { height: expandHeight, opacity: expandOpacity }]}>
          <Animated.View
            style={[styles.expandInner, { transform: [{ translateY: contentTranslateY }] }]}
            onLayout={(event) => handleContentLayout(event.nativeEvent.layout.height)}
          >
            <View style={[styles.list, { backgroundColor: surfaceBg, borderColor }]}>
              {entries.length > 0 ? entries.map((entry, index) => (
                <View
                  key={entry.card.id}
                  style={[
                    styles.row,
                    index < entries.length - 1 ? [styles.rowBorder, { borderBottomColor: borderColor }] : null,
                  ]}
                >
                  <View style={[styles.statusDot, { backgroundColor: STATUS_COLORS[entry.status] }]} />
                  <View style={styles.rowContent}>
                    <Text style={[styles.questionText, { color: theme.text }]} numberOfLines={1}>
                      {entry.card.question}
                    </Text>
                    <View style={styles.rowMeta}>
                      <Text style={[styles.statusLabel, { color: STATUS_COLORS[entry.status] }]}> 
                        {STATUS_LABELS[entry.status]}
                      </Text>
                      <Text style={[styles.dueText, { color: entry.isDue ? '#F59E0B' : theme.textTertiary }]}>
                        {formatDueDate(entry.nextReviewAt, entry.status, now)}
                      </Text>
                    </View>
                  </View>
                  {entry.status !== 'new' ? (
                    <View style={styles.stabilityContainer}>
                      <View
                        style={[
                          styles.stabilityBar,
                          { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' },
                        ]}
                      >
                        <View
                          style={[
                            styles.stabilityFill,
                            {
                              backgroundColor: STATUS_COLORS[entry.status],
                              width: `${Math.min(Math.round((entry.stability / 30) * 100), 100)}%`,
                            },
                          ]}
                        />
                      </View>
                    </View>
                  ) : null}
                </View>
              )) : (
                <View style={styles.emptyState}>
                  <Text style={[styles.emptyTitle, { color: theme.text }]}>No cards yet</Text>
                  <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>Add cards to see their schedule here.</Text>
                </View>
              )}
            </View>

            <View style={styles.footerRow}>
              <View style={[styles.footerPill, { backgroundColor: countPillBg, borderColor: countPillBorder }]}>
                <Text style={[styles.footerPillText, { color: countTextColor }]}>{dueNowSummary}</Text>
              </View>
              <Text style={[styles.footerHint, { color: theme.textTertiary }]}>{trackedSummary}</Text>
            </View>
          </Animated.View>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 18,
  },
  shell: {
    borderRadius: 24,
    borderWidth: 1,
    overflow: 'hidden',
  },
  headerPressable: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 18,
    gap: 12,
  },
  headerPressablePressed: {
    opacity: 0.94,
  },
  headerMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    minWidth: 0,
  },
  headerIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  headerTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  headerText: {
    fontSize: 16,
    fontWeight: '800' as const,
  },
  headerSubtext: {
    fontSize: 12,
    fontWeight: '600' as const,
    marginTop: 3,
  },
  headerMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginLeft: 10,
  },
  countPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderWidth: 1,
  },
  countPillText: {
    fontSize: 11,
    fontWeight: '800' as const,
  },
  chevronWrap: {
    width: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  expandWrap: {
    overflow: 'hidden',
  },
  expandInner: {
    paddingHorizontal: 18,
    paddingBottom: 18,
  },
  list: {
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
    gap: 10,
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  statusDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
  },
  rowContent: {
    flex: 1,
    minWidth: 0,
  },
  questionText: {
    fontSize: 14,
    fontWeight: '700' as const,
    marginBottom: 4,
  },
  rowMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  statusLabel: {
    fontSize: 11,
    fontWeight: '800' as const,
  },
  dueText: {
    fontSize: 11,
    fontWeight: '600' as const,
  },
  stabilityContainer: {
    width: 40,
    alignItems: 'flex-end',
  },
  stabilityBar: {
    width: 32,
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  stabilityFill: {
    height: '100%',
    borderRadius: 2,
  },
  emptyState: {
    paddingHorizontal: 18,
    paddingVertical: 22,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700' as const,
  },
  emptySubtitle: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: '500' as const,
    textAlign: 'center' as const,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingTop: 14,
  },
  footerPill: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
  },
  footerPillText: {
    fontSize: 12,
    fontWeight: '800' as const,
  },
  footerHint: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600' as const,
    textAlign: 'right' as const,
  },
});
