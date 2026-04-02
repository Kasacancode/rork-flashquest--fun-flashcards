import { Clock } from 'lucide-react-native';
import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

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

  const surfaceBg = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)';
  const borderColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';

  return (
    <View style={styles.container} testID="card-schedule-list">
      <View style={styles.header}>
        <Clock color={theme.textSecondary} size={16} strokeWidth={2.2} />
        <Text style={[styles.headerText, { color: theme.text }]}>Card Schedule</Text>
        <Text style={[styles.headerCount, { color: theme.textSecondary }]}>
          {entries.filter((entry) => entry.isDue).length} due now
        </Text>
      </View>

      <View style={[styles.list, { backgroundColor: surfaceBg, borderColor }]}>
        {entries.map((entry, index) => (
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
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  headerText: {
    fontSize: 16,
    fontWeight: '800',
    flex: 1,
  },
  headerCount: {
    fontSize: 13,
    fontWeight: '600',
  },
  list: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 10,
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  rowContent: {
    flex: 1,
    minWidth: 0,
  },
  questionText: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 3,
  },
  rowMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusLabel: {
    fontSize: 11,
    fontWeight: '700',
  },
  dueText: {
    fontSize: 11,
    fontWeight: '500',
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
});
