import * as Haptics from 'expo-haptics';
import { Flame, Trophy, Zap } from 'lucide-react-native';
import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Platform } from 'react-native';

import { useTheme } from '@/context/ThemeContext';

interface TimerProgressBarProps {
  timeRemaining: number;
  totalTime: number;
  isUrgent?: boolean;
}

export function TimerProgressBar({ timeRemaining, totalTime, isUrgent = false }: TimerProgressBarProps) {
  const { theme } = useTheme();
  const progressAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const progress = timeRemaining / totalTime;
    Animated.timing(progressAnim, {
      toValue: progress,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [timeRemaining, totalTime, progressAnim]);

  useEffect(() => {
    if (isUrgent && timeRemaining <= 3 && timeRemaining > 0) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.15,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }),
        ])
      ).start();

      Animated.loop(
        Animated.sequence([
          Animated.timing(shakeAnim, {
            toValue: 3,
            duration: 50,
            useNativeDriver: true,
          }),
          Animated.timing(shakeAnim, {
            toValue: -3,
            duration: 50,
            useNativeDriver: true,
          }),
          Animated.timing(shakeAnim, {
            toValue: 0,
            duration: 50,
            useNativeDriver: true,
          }),
        ])
      ).start();

      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } else {
      pulseAnim.stopAnimation();
      shakeAnim.stopAnimation();
      pulseAnim.setValue(1);
      shakeAnim.setValue(0);
    }
  }, [timeRemaining, isUrgent, pulseAnim, shakeAnim]);

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  const barColor = timeRemaining <= 3 ? theme.error : timeRemaining <= 5 ? theme.warning : theme.success;

  return (
    <Animated.View 
      style={[
        styles.timerBarContainer,
        { transform: [{ translateX: shakeAnim }, { scale: pulseAnim }] }
      ]}
    >
      <View style={[styles.timerBarBackground, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
        <Animated.View 
          style={[
            styles.timerBarFill,
            { 
              width: progressWidth,
              backgroundColor: barColor,
            }
          ]} 
        />
      </View>
      <Animated.View style={[styles.timerBadge, { backgroundColor: barColor }]}>
        <Text style={styles.timerBadgeText}>{timeRemaining}s</Text>
      </Animated.View>
    </Animated.View>
  );
}

interface DealerTimerProps {
  timeRemaining: number;
  totalTime: number;
  size?: number;
}

export function DealerTimer({ timeRemaining, totalTime, size = 56 }: DealerTimerProps) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const ringRotate = useRef(new Animated.Value(0)).current;

  const progress = timeRemaining / totalTime;
  const isUrgent = timeRemaining <= 3 && timeRemaining > 0;
  const isWarning = timeRemaining <= 5 && timeRemaining > 3;

  useEffect(() => {
    if (isUrgent) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.12, duration: 180, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 180, useNativeDriver: true }),
        ])
      ).start();

      Animated.loop(
        Animated.sequence([
          Animated.timing(shakeAnim, { toValue: 2, duration: 40, useNativeDriver: true }),
          Animated.timing(shakeAnim, { toValue: -2, duration: 40, useNativeDriver: true }),
          Animated.timing(shakeAnim, { toValue: 0, duration: 40, useNativeDriver: true }),
        ])
      ).start();

      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } else {
      pulseAnim.stopAnimation();
      shakeAnim.stopAnimation();
      pulseAnim.setValue(1);
      shakeAnim.setValue(0);
    }
  }, [isUrgent, pulseAnim, shakeAnim]);

  useEffect(() => {
    Animated.timing(ringRotate, {
      toValue: 1 - progress,
      duration: 400,
      useNativeDriver: false,
    }).start();
  }, [progress, ringRotate]);

  const ringColor = isUrgent ? '#ef4444' : isWarning ? '#f59e0b' : '#10b981';
  const bgColor = isUrgent ? 'rgba(239, 68, 68, 0.15)' : isWarning ? 'rgba(245, 158, 11, 0.1)' : 'rgba(16, 185, 129, 0.1)';

  return (
    <Animated.View
      style={[
        styles.dealerTimerContainer,
        {
          width: size,
          height: size,
          transform: [{ scale: pulseAnim }, { translateX: shakeAnim }],
        },
      ]}
    >
      <View style={[styles.dealerTimerBg, { backgroundColor: bgColor, borderRadius: size / 2 }]} />
      <View style={[styles.dealerTimerRing, { borderColor: 'rgba(255,255,255,0.15)', borderRadius: size / 2 }]} />
      <Animated.View
        style={[
          styles.dealerTimerProgress,
          {
            borderColor: ringColor,
            borderRadius: size / 2,
            borderRightColor: 'transparent',
            borderBottomColor: 'transparent',
            transform: [
              { rotate: ringRotate.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) },
            ],
          },
        ]}
      />
      <View style={styles.dealerTimerInner}>
        <Text style={[styles.dealerTimerIcon, isUrgent && styles.dealerTimerIconUrgent]}>🎰</Text>
        <Text style={[styles.dealerTimerText, { color: ringColor }]}>{timeRemaining}</Text>
      </View>
    </Animated.View>
  );
}

interface DealerCountdownBarProps {
  timeRemaining: number;
  totalTime: number;
}

export function DealerCountdownBar({ timeRemaining, totalTime }: DealerCountdownBarProps) {
  const progressAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const chipAnim = useRef(new Animated.Value(0)).current;

  const isUrgent = timeRemaining <= 3 && timeRemaining > 0;
  const isWarning = timeRemaining <= 5 && timeRemaining > 3;

  useEffect(() => {
    const progress = timeRemaining / totalTime;
    Animated.timing(progressAnim, {
      toValue: progress,
      duration: 350,
      useNativeDriver: false,
    }).start();
  }, [timeRemaining, totalTime, progressAnim]);

  useEffect(() => {
    if (isUrgent) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.02, duration: 150, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
        ])
      ).start();

      Animated.loop(
        Animated.sequence([
          Animated.timing(chipAnim, { toValue: -2, duration: 80, useNativeDriver: true }),
          Animated.timing(chipAnim, { toValue: 2, duration: 80, useNativeDriver: true }),
          Animated.timing(chipAnim, { toValue: 0, duration: 80, useNativeDriver: true }),
        ])
      ).start();

      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } else {
      pulseAnim.stopAnimation();
      chipAnim.stopAnimation();
      pulseAnim.setValue(1);
      chipAnim.setValue(0);
    }
  }, [isUrgent, pulseAnim, chipAnim]);

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  const barColor = isUrgent ? '#ef4444' : isWarning ? '#f59e0b' : '#10b981';
  const trackColor = isUrgent ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255, 255, 255, 0.15)';

  return (
    <Animated.View style={[styles.dealerBarContainer, { transform: [{ scaleX: pulseAnim }] }]}>
      <View style={styles.dealerBarWrapper}>
        <View style={[styles.dealerBarTrack, { backgroundColor: trackColor }]}>
          <Animated.View
            style={[
              styles.dealerBarFill,
              { width: progressWidth, backgroundColor: barColor },
            ]}
          />
          <View style={styles.dealerBarNotches}>
            {[0.25, 0.5, 0.75].map((pos) => (
              <View key={pos} style={[styles.dealerBarNotch, { left: `${pos * 100}%` }]} />
            ))}
          </View>
        </View>
        <Animated.View style={[styles.dealerChip, { transform: [{ translateY: chipAnim }] }]}>
          <Text style={styles.dealerChipText}>{timeRemaining}s</Text>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

interface PlayerScore {
  id: string;
  name: string;
  color: string;
  points: number;
  isCurrentPlayer?: boolean;
}

interface MiniScoreboardProps {
  players: PlayerScore[];
  currentPlayerId?: string;
  maxDisplay?: number;
}

export function MiniScoreboard({ players, currentPlayerId, maxDisplay = 4 }: MiniScoreboardProps) {
  const sorted = [...players].sort((a, b) => b.points - a.points);
  const displayed = sorted.slice(0, maxDisplay);

  return (
    <View style={styles.scoreboardContainer}>
      {displayed.map((player, index) => {
        const isCurrentPlayer = player.id === currentPlayerId;
        return (
          <View 
            key={player.id} 
            style={[
              styles.scoreboardItem,
              isCurrentPlayer && styles.scoreboardItemActive,
            ]}
          >
            <View style={styles.scoreboardRank}>
              <Text style={[styles.scoreboardRankText, index === 0 && styles.scoreboardRankFirst]}>
                {index === 0 ? '👑' : `#${index + 1}`}
              </Text>
            </View>
            <View style={[styles.scoreboardDot, { backgroundColor: player.color }]} />
            <Text 
              style={[styles.scoreboardName, isCurrentPlayer && styles.scoreboardNameActive]} 
              numberOfLines={1}
            >
              {player.name}
            </Text>
            <Text style={[styles.scoreboardPoints, isCurrentPlayer && styles.scoreboardPointsActive]}>
              {player.points}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

interface StreakIndicatorProps {
  streak: number;
  multiplier?: number;
  showMultiplier?: boolean;
}

export function StreakIndicator({ streak, multiplier = 1, showMultiplier = true }: StreakIndicatorProps) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (streak > 0) {
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 1.3,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 4,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [streak, scaleAnim]);

  if (streak === 0) return null;

  const getStreakColor = () => {
    if (streak >= 5) return '#f59e0b';
    if (streak >= 3) return '#f97316';
    return '#10b981';
  };

  return (
    <Animated.View 
      style={[
        styles.streakContainer, 
        { backgroundColor: getStreakColor(), transform: [{ scale: scaleAnim }] }
      ]}
    >
      <Flame color="#fff" size={16} />
      <Text style={styles.streakText}>{streak}</Text>
      {showMultiplier && multiplier > 1 && (
        <View style={styles.multiplierBadge}>
          <Zap color="#fff" size={10} />
          <Text style={styles.multiplierText}>x{multiplier.toFixed(1)}</Text>
        </View>
      )}
    </Animated.View>
  );
}

interface AnswerFeedbackProps {
  isCorrect: boolean;
  visible: boolean;
}

export function AnswerFeedback({ isCorrect, visible }: AnswerFeedbackProps) {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 4,
          tension: 100,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      scaleAnim.setValue(0);
      opacityAnim.setValue(0);
    }
  }, [visible, scaleAnim, opacityAnim]);

  if (!visible) return null;

  return (
    <Animated.View 
      style={[
        styles.feedbackBurst,
        { 
          opacity: opacityAnim,
          transform: [{ scale: scaleAnim }],
          backgroundColor: isCorrect ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
        }
      ]}
    >
      <View style={[styles.feedbackIcon, { backgroundColor: isCorrect ? '#10b981' : '#ef4444' }]}>
        <Text style={styles.feedbackIconText}>{isCorrect ? '✓' : '✗'}</Text>
      </View>
    </Animated.View>
  );
}

interface TurnBadgeProps {
  playerName: string;
  playerColor: string;
  isYourTurn?: boolean;
}

export function TurnBadge({ playerName, playerColor, isYourTurn = false }: TurnBadgeProps) {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isYourTurn) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.05,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      ).start();
    }
    return () => {
      pulseAnim.stopAnimation();
    };
  }, [isYourTurn, pulseAnim]);

  return (
    <Animated.View 
      style={[
        styles.turnBadge,
        { transform: [{ scale: pulseAnim }] }
      ]}
    >
      <View style={[styles.turnBadgeDot, { backgroundColor: playerColor }]} />
      <Text style={styles.turnBadgeText}>{playerName}'s Turn</Text>
    </Animated.View>
  );
}

interface MatchHeaderProps {
  players: PlayerScore[];
  currentPlayerId?: string;
  questionNumber: number;
  totalQuestions: number;
  streak?: number;
}

export function MatchHeader({ 
  players, 
  currentPlayerId, 
  questionNumber, 
  totalQuestions,
  streak = 0,
}: MatchHeaderProps) {
  const currentPlayer = players.find(p => p.id === currentPlayerId);
  const sortedPlayers = [...players].sort((a, b) => b.points - a.points);
  const leader = sortedPlayers[0];
  const isLeading = currentPlayer?.id === leader?.id;

  return (
    <View style={styles.matchHeader}>
      <View style={styles.matchHeaderTop}>
        <View style={styles.questionProgress}>
          <Text style={styles.questionProgressText}>
            {questionNumber}/{totalQuestions}
          </Text>
        </View>
        
        {streak > 0 && <StreakIndicator streak={streak} showMultiplier={false} />}
        
        <View style={styles.leaderIndicator}>
          <Trophy color={isLeading ? '#f59e0b' : 'rgba(255,255,255,0.5)'} size={16} />
          <Text style={[styles.leaderText, isLeading && styles.leaderTextActive]}>
            {leader?.name}: {leader?.points}
          </Text>
        </View>
      </View>

      {currentPlayer != null && (
        <View style={styles.currentPlayerBar}>
          <View style={[styles.currentPlayerDot, { backgroundColor: currentPlayer.color }]} />
          <Text style={styles.currentPlayerName}>{currentPlayer.name}</Text>
          <Text style={styles.currentPlayerPoints}>{currentPlayer.points} pts</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  timerBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
  },
  timerBarBackground: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  timerBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  timerBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    minWidth: 48,
    alignItems: 'center',
  },
  timerBadgeText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700' as const,
  },
  scoreboardContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    borderRadius: 16,
    padding: 12,
    gap: 8,
  },
  scoreboardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  scoreboardItemActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  scoreboardRank: {
    width: 28,
    alignItems: 'center',
  },
  scoreboardRankText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    fontWeight: '600' as const,
  },
  scoreboardRankFirst: {
    fontSize: 16,
  },
  scoreboardDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  scoreboardName: {
    flex: 1,
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.85)',
    fontWeight: '500' as const,
  },
  scoreboardNameActive: {
    color: '#fff',
    fontWeight: '700' as const,
  },
  scoreboardPoints: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.85)',
    fontWeight: '700' as const,
    minWidth: 24,
    textAlign: 'right',
  },
  scoreboardPointsActive: {
    color: '#fff',
  },
  streakContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
  },
  streakText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700' as const,
  },
  multiplierBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginLeft: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  multiplierText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700' as const,
  },
  feedbackBurst: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 16,
  },
  feedbackIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  feedbackIconText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '700' as const,
  },
  turnBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  turnBadgeDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  turnBadgeText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700' as const,
  },
  matchHeader: {
    paddingHorizontal: 16,
    gap: 10,
  },
  matchHeaderTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  questionProgress: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
  },
  questionProgressText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700' as const,
  },
  leaderIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
  },
  leaderText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
    fontWeight: '600' as const,
  },
  leaderTextActive: {
    color: '#f59e0b',
  },
  currentPlayerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 14,
  },
  currentPlayerDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  currentPlayerName: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700' as const,
  },
  currentPlayerPoints: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
    fontWeight: '600' as const,
    marginLeft: 'auto',
  },
  dealerTimerContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  dealerTimerBg: {
    ...StyleSheet.absoluteFillObject,
  },
  dealerTimerRing: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 3,
  },
  dealerTimerProgress: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 3,
  },
  dealerTimerInner: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  dealerTimerIcon: {
    fontSize: 16,
    marginBottom: 2,
  },
  dealerTimerIconUrgent: {
    opacity: 0.9,
  },
  dealerTimerText: {
    fontSize: 14,
    fontWeight: '800' as const,
  },
  dealerBarContainer: {
    paddingHorizontal: 20,
  },
  dealerBarWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dealerBarTrack: {
    flex: 1,
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
    position: 'relative',
  },
  dealerBarFill: {
    height: '100%',
    borderRadius: 5,
  },
  dealerBarNotches: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
  },
  dealerBarNotch: {
    position: 'absolute',
    width: 2,
    height: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.15)',
  },
  dealerChip: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  dealerChipText: {
    fontSize: 14,
    fontWeight: '800' as const,
    color: '#fff',
  },
});
