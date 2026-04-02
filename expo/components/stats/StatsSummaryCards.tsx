import { BookOpen, Swords, Target, Zap } from 'lucide-react-native';
import React, { memo } from 'react';
import { Text, View } from 'react-native';

import type { StatsTextStyles, StatsViewStyles } from '@/components/stats/statsScreen.types';
import type { DeckMasteryOverview } from '@/utils/deckSelectors';
import type { AccuracyTrendEntry, ArenaStatsSummary } from '@/utils/statsSelectors';

interface StatsSummaryCardsProps {
  formattedStudyTime: string;
  theme: { text: string; success: string; warning: string };
  isDark: boolean;
  statsAccent: string;
  masteryOverview: DeckMasteryOverview;
  decksCount: number;
  displaySessions: { study: number; quest: number; practice: number; arena: number; estimated: boolean };
  totalQuestionsAttempted: number;
  lifetimeAccuracy: number | null;
  bestQuestStreak: number;
  totalCardsStudied: number;
  arenaStats: ArenaStatsSummary | null;
  accuracyTrend: AccuracyTrendEntry[];
  hasRealAccuracyData: boolean;
  styles: StatsViewStyles<'masteryCard' | 'masteryBar' | 'masteryLegend' | 'performanceCard' | 'perfRow' | 'perfRowLast' | 'perfIconWrap' | 'perfContent' | 'trendCard' | 'trendRow' | 'trendColumn' | 'trendBarContainer' | 'trendBar'> &
    StatsTextStyles<'sectionLabel' | 'masteryBigText' | 'masterySubtext' | 'masteryLegendItem' | 'perfLabel' | 'perfValue' | 'perfDetail' | 'trendPct' | 'trendWeek'>;
}

interface PerformanceRowProps {
  label: string;
  value: string;
  detail?: string;
  isLast?: boolean;
  icon: React.ReactNode;
  styles: StatsViewStyles<'perfRow' | 'perfRowLast' | 'perfIconWrap' | 'perfContent'> &
    StatsTextStyles<'perfLabel' | 'perfValue' | 'perfDetail'>;
}

const PerformanceRow = memo(function PerformanceRow({ label, value, detail, isLast = false, icon, styles }: PerformanceRowProps) {
  return (
    <View style={[styles.perfRow, isLast ? styles.perfRowLast : null]}>
      <View style={styles.perfIconWrap}>{icon}</View>
      <View style={styles.perfContent}>
        <Text style={styles.perfLabel}>{label}</Text>
        <Text style={styles.perfValue}>{value}</Text>
        {detail ? <Text style={styles.perfDetail}>{detail}</Text> : null}
      </View>
    </View>
  );
});

function StatsSummaryCardsComponent({
  formattedStudyTime,
  theme,
  isDark,
  statsAccent,
  masteryOverview,
  decksCount,
  displaySessions,
  totalQuestionsAttempted,
  lifetimeAccuracy,
  bestQuestStreak,
  totalCardsStudied,
  arenaStats,
  accuracyTrend,
  hasRealAccuracyData,
  styles,
}: StatsSummaryCardsProps) {
  return (
    <>
      <View style={styles.masteryCard}>
        <Text style={styles.sectionLabel}>MASTERY OVERVIEW</Text>
        <Text style={[styles.masteryBigText, { color: statsAccent }]}>{masteryOverview.mastered}/{masteryOverview.totalCards}</Text>
        <Text style={styles.masterySubtext}>cards mastered across {decksCount} decks</Text>
        <View style={[styles.masteryBar, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }]}>
          {masteryOverview.mastered > 0 ? (
            <View style={{ width: `${(masteryOverview.mastered / Math.max(masteryOverview.totalCards, 1)) * 100}%`, height: '100%', backgroundColor: '#10B981', borderRadius: 4 }} />
          ) : null}
          {masteryOverview.reviewing > 0 ? (
            <View style={{ width: `${(masteryOverview.reviewing / Math.max(masteryOverview.totalCards, 1)) * 100}%`, height: '100%', backgroundColor: '#3B82F6' }} />
          ) : null}
          {masteryOverview.learning > 0 ? (
            <View style={{ width: `${(masteryOverview.learning / Math.max(masteryOverview.totalCards, 1)) * 100}%`, height: '100%', backgroundColor: '#F59E0B' }} />
          ) : null}
          {masteryOverview.lapsed > 0 ? (
            <View style={{ width: `${(masteryOverview.lapsed / Math.max(masteryOverview.totalCards, 1)) * 100}%`, height: '100%', backgroundColor: '#F43F5E' }} />
          ) : null}
        </View>
        <View style={styles.masteryLegend}>
          <Text style={styles.masteryLegendItem}><Text style={{ color: '#10B981' }}>●</Text> {masteryOverview.mastered} mastered</Text>
          <Text style={styles.masteryLegendItem}><Text style={{ color: '#3B82F6' }}>●</Text> {masteryOverview.reviewing} reviewing</Text>
          <Text style={styles.masteryLegendItem}><Text style={{ color: '#F59E0B' }}>●</Text> {masteryOverview.learning} learning</Text>
          <Text style={styles.masteryLegendItem}><Text style={{ color: '#F43F5E' }}>●</Text> {masteryOverview.lapsed} lapsed</Text>
          <Text style={styles.masteryLegendItem}><Text style={{ color: isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.2)' }}>●</Text> {masteryOverview.newCards} new</Text>
        </View>
      </View>

      <View style={styles.performanceCard}>
        <Text style={styles.sectionLabel}>PERFORMANCE</Text>
        <PerformanceRow
          label="Study"
          value={`${displaySessions.study} sessions${formattedStudyTime !== '' ? ` · ${formattedStudyTime} total` : ''}`}
          icon={<BookOpen color={statsAccent} size={18} strokeWidth={2.2} />}
          styles={styles}
        />
        <PerformanceRow
          label="Quest"
          value={`${displaySessions.quest} sessions · ${totalQuestionsAttempted} questions`}
          detail={lifetimeAccuracy !== null ? `${lifetimeAccuracy}% accuracy${bestQuestStreak > 0 ? ` · ${bestQuestStreak} best streak` : ''}` : undefined}
          icon={<Target color={statsAccent} size={18} strokeWidth={2.2} />}
          styles={styles}
        />
        <PerformanceRow
          label="Practice"
          value={`${displaySessions.practice} sessions · ${totalCardsStudied} cards`}
          isLast={!arenaStats}
          icon={<Swords color={statsAccent} size={18} strokeWidth={2.2} />}
          styles={styles}
        />
        {arenaStats ? (
          <PerformanceRow
            label="Arena"
            value={`${displaySessions.arena || arenaStats.total} battles · ${arenaStats.wins} wins · ${arenaStats.winRate}% rate`}
            isLast
            icon={<Zap color={statsAccent} size={18} strokeWidth={2.2} />}
            styles={styles}
          />
        ) : null}
      </View>

      {accuracyTrend.length >= 2 && hasRealAccuracyData ? (
        <View style={styles.trendCard}>
          <Text style={styles.sectionLabel}>ACCURACY TREND</Text>
          <View style={styles.trendRow}>
            {accuracyTrend.map((entry) => {
              const label = entry.week.replace(/^\d{4}-W/, 'W');
              const pct = entry.accuracy;
              return (
                <View key={entry.week} style={styles.trendColumn}>
                  <View style={styles.trendBarContainer}>
                    {pct !== null ? (
                      <View
                        style={[
                          styles.trendBar,
                          { height: `${pct}%`, backgroundColor: pct >= 70 ? theme.success : theme.warning },
                        ]}
                      />
                    ) : null}
                  </View>
                  <Text style={styles.trendPct}>{pct !== null ? `${pct}%` : '–'}</Text>
                  <Text style={styles.trendWeek}>{label}</Text>
                </View>
              );
            })}
          </View>
        </View>
      ) : null}
    </>
  );
}

export default memo(StatsSummaryCardsComponent);
