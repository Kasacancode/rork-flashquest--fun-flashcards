import React, { forwardRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';

export interface ResultCardData {
  mode: 'quest' | 'arena';
  title: string;
  playerName?: string;
  deckName: string;
  score: number;
  accuracy: number;
  correctCount: number;
  totalRounds: number;
  streakBest?: number;
  opponentName?: string;
  opponentScore?: number;
  isWinner?: boolean;
}

const ShareableResultCard = forwardRef<View, { data: ResultCardData }>(({ data }, ref) => {
  const accuracyPercent = Math.round(data.accuracy * 100);
  const modeLabel = data.mode === 'arena' ? 'ARENA BATTLE' : 'QUEST COMPLETE';
  const modeColor = data.mode === 'arena' ? '#F59E0B' : '#8B5CF6';

  return (
    <View ref={ref} collapsable={false} style={styles.card}>
      <View style={styles.cardInner}>
        <Text style={styles.brandText}>FLASHQUEST</Text>

        <View style={[styles.modeBadge, { backgroundColor: modeColor }]}>
          <Text style={styles.modeBadgeText}>{modeLabel}</Text>
        </View>

        <Text style={styles.titleText}>{data.title}</Text>

        {data.playerName ? (
          <Text style={styles.playerName}>{data.playerName}</Text>
        ) : null}

        <View style={styles.statsRow}>
          <View style={styles.statBlock}>
            <Text style={styles.statValue}>{data.score.toLocaleString()}</Text>
            <Text style={styles.statLabel}>Score</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBlock}>
            <Text style={[styles.statValue, { color: accuracyPercent >= 70 ? '#10B981' : '#F59E0B' }]}>
              {accuracyPercent}%
            </Text>
            <Text style={styles.statLabel}>Accuracy</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBlock}>
            <Text style={styles.statValue}>
              {data.correctCount}/{data.totalRounds}
            </Text>
            <Text style={styles.statLabel}>Correct</Text>
          </View>
        </View>

        {data.mode === 'arena' && data.opponentName ? (
          <View style={styles.vsRow}>
            <Text style={styles.vsText}>
              vs {data.opponentName}
              {data.opponentScore != null ? ` (${data.opponentScore.toLocaleString()} pts)` : ''}
            </Text>
          </View>
        ) : null}

        {data.streakBest && data.streakBest > 1 ? (
          <Text style={styles.streakText}>Best streak: {data.streakBest}</Text>
        ) : null}

        <View style={styles.deckRow}>
          <Text style={styles.deckLabel}>{data.deckName}</Text>
        </View>

        <Text style={styles.ctaText}>Think you can beat this? Try FlashQuest.</Text>
      </View>
    </View>
  );
});

ShareableResultCard.displayName = 'ShareableResultCard';

export default ShareableResultCard;

const styles = StyleSheet.create({
  card: {
    width: 360,
    backgroundColor: '#0F172A',
    borderRadius: 24,
    overflow: 'hidden',
  },
  cardInner: {
    padding: 28,
    alignItems: 'center',
  },
  brandText: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 3,
    marginBottom: 16,
  },
  modeBadge: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 16,
  },
  modeBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  titleText: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 6,
    letterSpacing: -0.5,
  },
  playerName: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 20,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 8,
    marginBottom: 16,
    width: '100%',
  },
  statBlock: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 4,
  },
  statLabel: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  vsRow: {
    marginBottom: 12,
  },
  vsText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
    fontWeight: '600',
  },
  streakText: {
    color: '#F59E0B',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 12,
  },
  deckRow: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginBottom: 20,
  },
  deckLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    fontWeight: '600',
  },
  ctaText: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
});
