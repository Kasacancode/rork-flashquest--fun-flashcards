import { LinearGradient } from 'expo-linear-gradient';
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

function getPerformanceTier(accuracy: number): { label: string; color: string; glow: string } {
  if (accuracy >= 0.95) {
    return { label: 'PERFECT RUN', color: '#FFD700', glow: 'rgba(255, 215, 0, 0.3)' };
  }

  if (accuracy >= 0.9) {
    return { label: 'OUTSTANDING', color: '#A78BFA', glow: 'rgba(167, 139, 250, 0.3)' };
  }

  if (accuracy >= 0.8) {
    return { label: 'IMPRESSIVE', color: '#34D399', glow: 'rgba(52, 211, 153, 0.3)' };
  }

  if (accuracy >= 0.7) {
    return { label: 'SOLID RUN', color: '#60A5FA', glow: 'rgba(96, 165, 250, 0.3)' };
  }

  return { label: 'KEEP GRINDING', color: '#F59E0B', glow: 'rgba(245, 158, 11, 0.3)' };
}

const ShareableResultCard = forwardRef<View, { data: ResultCardData }>(({ data }, ref) => {
  const accuracyPercent = Math.round(data.accuracy * 100);
  const tier = getPerformanceTier(data.accuracy);
  const isArena = data.mode === 'arena';
  const modeGradient: readonly [string, string, string] = isArena
    ? ['#7C2D12', '#9A3412', '#C2410C'] as const
    : ['#1E1040', '#2D1B69', '#4C2889'] as const;

  return (
    <View ref={ref} collapsable={false} style={styles.card}>
      <LinearGradient
        colors={modeGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <View style={[styles.glowOrb, styles.glowTop, { backgroundColor: tier.glow }]} />
      <View
        style={[
          styles.glowOrb,
          styles.glowBottom,
          { backgroundColor: isArena ? 'rgba(249, 115, 22, 0.15)' : 'rgba(99, 102, 241, 0.15)' },
        ]}
      />

      <View style={styles.cardInner}>
        <View style={styles.header}>
          <Text style={styles.brandText}>FLASHQUEST</Text>
          <View
            style={[
              styles.modePill,
              {
                backgroundColor: isArena ? 'rgba(249,115,22,0.25)' : 'rgba(139,92,246,0.25)',
                borderColor: isArena ? 'rgba(249,115,22,0.4)' : 'rgba(139,92,246,0.4)',
              },
            ]}
          >
            <Text style={[styles.modePillText, { color: isArena ? '#FB923C' : '#A78BFA' }]}>
              {isArena ? 'ARENA BATTLE' : 'QUEST MODE'}
            </Text>
          </View>
        </View>

        <View style={[styles.tierBadge, { backgroundColor: tier.glow, borderColor: tier.color }]}>
          <Text style={[styles.tierText, { color: tier.color }]}>{tier.label}</Text>
        </View>

        <Text style={styles.scoreNumber}>{data.score.toLocaleString()}</Text>
        <Text style={styles.scoreLabel}>POINTS</Text>

        <View style={styles.statsBar}>
          <View style={styles.statItem}>
            <Text
              style={[
                styles.statItemValue,
                { color: accuracyPercent >= 80 ? '#34D399' : accuracyPercent >= 60 ? '#FBBF24' : '#F87171' },
              ]}
            >
              {accuracyPercent}%
            </Text>
            <Text style={styles.statItemLabel}>ACCURACY</Text>
          </View>
          <View style={styles.statBarDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statItemValue}>
              {data.correctCount}/{data.totalRounds}
            </Text>
            <Text style={styles.statItemLabel}>CORRECT</Text>
          </View>
          {data.streakBest && data.streakBest > 1 ? (
            <>
              <View style={styles.statBarDivider} />
              <View style={styles.statItem}>
                <Text style={[styles.statItemValue, styles.streakValue]}>{data.streakBest}</Text>
                <Text style={styles.statItemLabel}>STREAK</Text>
              </View>
            </>
          ) : null}
        </View>

        {isArena && data.opponentName ? (
          <View style={styles.vsSection}>
            <Text style={styles.vsLabel}>{data.isWinner ? 'DEFEATED' : 'LOST TO'}</Text>
            <Text style={styles.vsName}>{data.opponentName}</Text>
            {data.opponentScore != null ? (
              <Text style={styles.vsScore}>{data.opponentScore.toLocaleString()} pts</Text>
            ) : null}
          </View>
        ) : null}

        <View style={styles.deckPill}>
          <Text style={styles.deckPillText} numberOfLines={1}>
            {data.deckName}
          </Text>
        </View>

        {data.playerName ? <Text style={styles.playerText}>{data.playerName}</Text> : null}

        <View style={styles.ctaSection}>
          <View style={styles.ctaDivider} />
          <Text style={styles.ctaText}>Can you top this?</Text>
          <Text style={styles.ctaUrl}>flashquest.net</Text>
        </View>
      </View>
    </View>
  );
});

ShareableResultCard.displayName = 'ShareableResultCard';

export default ShareableResultCard;

const styles = StyleSheet.create({
  card: {
    width: 360,
    borderRadius: 28,
    overflow: 'hidden',
    position: 'relative',
  },
  glowOrb: {
    position: 'absolute',
    borderRadius: 999,
  },
  glowTop: {
    width: 250,
    height: 250,
    top: -80,
    right: -60,
  },
  glowBottom: {
    width: 300,
    height: 300,
    bottom: -120,
    left: -80,
  },
  cardInner: {
    paddingHorizontal: 28,
    paddingTop: 32,
    paddingBottom: 28,
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  brandText: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 4,
    marginBottom: 12,
  },
  modePill: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 100,
    borderWidth: 1,
  },
  modePillText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  tierBadge: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 100,
    borderWidth: 1.5,
    marginBottom: 20,
  },
  tierText: {
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 2,
  },
  scoreNumber: {
    color: '#FFFFFF',
    fontSize: 64,
    fontWeight: '900',
    letterSpacing: -3,
    lineHeight: 70,
    marginBottom: 2,
    textShadowColor: 'rgba(255,255,255,0.15)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 20,
  },
  scoreLabel: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 3,
    marginBottom: 24,
  },
  statsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingVertical: 14,
    paddingHorizontal: 4,
    width: '100%',
    marginBottom: 20,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statItemValue: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 3,
  },
  streakValue: {
    color: '#FBBF24',
  },
  statItemLabel: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
  },
  statBarDivider: {
    width: 1,
    height: 28,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  vsSection: {
    alignItems: 'center',
    marginBottom: 16,
  },
  vsLabel: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 2,
  },
  vsName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  vsScore: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  deckPill: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 7,
    marginBottom: 8,
    maxWidth: '85%',
  },
  deckPillText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    fontWeight: '600',
  },
  playerText: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 4,
  },
  ctaSection: {
    alignItems: 'center',
    marginTop: 16,
    width: '100%',
  },
  ctaDivider: {
    width: 40,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginBottom: 14,
  },
  ctaText: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  ctaUrl: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
