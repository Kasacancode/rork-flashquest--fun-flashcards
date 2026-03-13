import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { Trophy, Target, Medal, RotateCcw, Home, Users, ChevronDown, ChevronUp, Save, Share2 } from 'lucide-react-native';
import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { trackEvent } from '@/lib/analytics';
import { useArena } from '@/context/ArenaContext';
import { useFlashQuest } from '@/context/FlashQuestContext';
import { useTheme } from '@/context/ThemeContext';
import type { ArenaLeaderboardEntry } from '@/types/arena';
import { GAME_MODE } from '@/types/game';
import { logger } from '@/utils/logger';
import { shareTextWithFallback } from '@/utils/share';

interface ResultPlayer {
  id: string;
  name: string;
  color: string;
  identityKey: string;
  identityLabel: string;
  suit: string;
  isHost: boolean;
  connected: boolean;
}

interface CachedResults {
  players: ResultPlayer[];
  scores: Record<string, { correct: number; incorrect: number; points: number; currentStreak: number; bestStreak: number }>;
  allQuestions: { cardId: string; question: string; correctAnswer: string; options: string[] }[] | null;
  allAnswers: Record<string, Record<number, { selectedOption: string; isCorrect: boolean; timeToAnswerMs: number }>> | null;
  totalQuestions: number;
  startedAt: number;
  finishedAt: number | null;
  deckId: string | null;
  deckName: string | null;
  settings: { rounds: number; timerSeconds: number; showExplanationsAtEnd: boolean };
  roomCode: string;
}

interface PlayerPerformance {
  correct: number;
  totalTimeSeconds: number;
  accuracy: number;
  points: number;
  bestStreak: number;
  summary: string;
  statLine: string;
}

export default function ArenaResultsScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { recordSessionResult } = useFlashQuest();
  const {
    room,
    playerId,
    isHost,
    disconnect,
    resetRoom,
    saveMatchResult,
  } = useArena();

  const [showMissedCards, setShowMissedCards] = useState(false);
  const [saved, setSaved] = useState(false);
  const cachedRef = useRef<CachedResults | null>(null);
  const xpRecordedRef = useRef(false);

  useEffect(() => {
    if (room && room.game && room.game.phase === 'finished' && !cachedRef.current) {
      cachedRef.current = {
        players: room.players,
        scores: room.game.scores,
        allQuestions: room.game.allQuestions,
        allAnswers: room.game.allAnswers,
        totalQuestions: room.game.totalQuestions,
        startedAt: room.game.startedAt,
        finishedAt: room.game.finishedAt,
        deckId: room.deckId,
        deckName: room.deckName,
        settings: room.settings,
        roomCode: room.code,
      };
      logger.log('[Results] Cached game results');
    }
  }, [room]);

  const data = cachedRef.current;

  useEffect(() => {
    if (room?.status === 'lobby') {
      logger.log('[Results] Room reset to lobby, navigating');
      router.replace('/arena-lobby' as any);
    }
  }, [room?.status, router]);

  const sortedPlayers = useMemo(() => {
    if (!data) return [];
    return [...data.players].sort((a, b) => {
      const aScore = data.scores[a.id]?.points ?? 0;
      const bScore = data.scores[b.id]?.points ?? 0;
      if (bScore !== aScore) return bScore - aScore;
      const aCorrect = data.scores[a.id]?.correct ?? 0;
      const bCorrect = data.scores[b.id]?.correct ?? 0;
      return bCorrect - aCorrect;
    });
  }, [data]);

  const winner = sortedPlayers[0];
  const winnerName = winner?.name ?? 'Unknown';
  const winnerIdentityLabel = winner?.identityLabel ?? '';
  const winnerDisplayName = winner ? `${winner.identityLabel} ${winner.name}` : 'Unknown';
  const winnerScore = winner ? data?.scores[winner.id] : undefined;

  const playerPerformance = useMemo(() => {
    if (!data) {
      return {} as Record<string, PlayerPerformance>;
    }

    return data.players.reduce<Record<string, PlayerPerformance>>((acc, player) => {
      const score = data.scores[player.id];
      const correct = score?.correct ?? 0;
      const points = score?.points ?? 0;
      const bestStreak = score?.bestStreak ?? 0;
      const accuracy = data.totalQuestions > 0 ? correct / data.totalQuestions : 0;
      const playerAnswers = data.allAnswers?.[player.id];
      const totalTimeMs = playerAnswers
        ? Object.values(playerAnswers).reduce((total, answer) => {
            const timeToAnswerMs = typeof answer.timeToAnswerMs === 'number' ? answer.timeToAnswerMs : 0;
            return total + Math.max(0, timeToAnswerMs);
          }, 0)
        : 0;
      const totalTimeSeconds = Math.max(0, Math.round(totalTimeMs / 1000));

      acc[player.id] = {
        correct,
        totalTimeSeconds,
        accuracy,
        points,
        bestStreak,
        summary: `${correct} correct — ${totalTimeSeconds}s`,
        statLine: `${correct} correct • ${totalTimeSeconds}s • ${points} pts`,
      };

      return acc;
    }, {});
  }, [data]);

  const winnerStatsText = winner ? playerPerformance[winner.id]?.statLine ?? '0 correct • 0s • 0 pts' : '0 correct • 0s • 0 pts';

  const winnerCallouts = useMemo(() => {
    if (!winner) {
      return [] as string[];
    }

    const performances = sortedPlayers
      .map((player) => playerPerformance[player.id])
      .filter((performance): performance is PlayerPerformance => performance != null);

    if (performances.length === 0) {
      return [] as string[];
    }

    const fastestTime = performances
      .map((performance) => performance.totalTimeSeconds)
      .filter((time) => time > 0)
      .reduce((fastest, time) => Math.min(fastest, time), Number.POSITIVE_INFINITY);
    const highestAccuracy = performances.reduce((highest, performance) => Math.max(highest, performance.accuracy), 0);
    const bestStreak = performances.reduce((highest, performance) => Math.max(highest, performance.bestStreak), 0);
    const winnerPerformance = playerPerformance[winner.id];

    if (!winnerPerformance) {
      return [] as string[];
    }

    const callouts: string[] = [];

    if (Number.isFinite(fastestTime) && winnerPerformance.totalTimeSeconds > 0 && winnerPerformance.totalTimeSeconds === fastestTime) {
      callouts.push('Fastest finisher');
    }

    if (winnerPerformance.accuracy > 0 && winnerPerformance.accuracy === highestAccuracy) {
      callouts.push('Highest accuracy');
    }

    if (winnerPerformance.bestStreak > 1 && winnerPerformance.bestStreak === bestStreak) {
      callouts.push('Best streak');
    }

    if (callouts.length === 0 && winnerPerformance.points > 0) {
      callouts.push('Most points');
    }

    return callouts.slice(0, 2);
  }, [playerPerformance, sortedPlayers, winner]);

  const shareMessage = useMemo(() => {
    if (!winner) {
      return 'Play FlashQuest.';
    }

    const roomCodeLine = data?.roomCode ? `\n\nRoom Code: ${data.roomCode}` : '';
    return `🏆 FlashQuest Arena Winner\n${winnerDisplayName}\n\n${winnerStatsText}\n\nI took the crown in FlashQuest Arena.\nThink you can beat this?\nPlay FlashQuest.${roomCodeLine}`;
  }, [data?.roomCode, winner, winnerDisplayName, winnerStatsText]);

  const missedQuestions = useMemo(() => {
    if (!data?.allQuestions || !data.allAnswers) return [];
    const missed: { question: string; correctAnswer: string; questionIndex: number }[] = [];
    const seenIds = new Set<string>();

    for (const [, playerAnswers] of Object.entries(data.allAnswers)) {
      for (const [qIndexStr, answer] of Object.entries(playerAnswers)) {
        const qIndex = parseInt(qIndexStr, 10);
        const q = data.allQuestions?.[qIndex];
        if (!answer.isCorrect && q && !seenIds.has(q.cardId)) {
          seenIds.add(q.cardId);
          missed.push({
            question: q.question,
            correctAnswer: q.correctAnswer,
            questionIndex: qIndex,
          });
        }
      }
    }
    return missed;
  }, [data]);

  useEffect(() => {
    if (winner && Platform.OS !== 'web') {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, [winner]);

  useEffect(() => {
    if (data && playerId && !xpRecordedRef.current) {
      xpRecordedRef.current = true;
      const myScore = data.scores[playerId];
      const isWinner = winner?.id === playerId;
      const xp = isWinner ? 200 : 100;

      recordSessionResult({
        mode: GAME_MODE.ARENA,
        deckId: data.deckId || '',
        xpEarned: xp,
        cardsAttempted: data.totalQuestions,
        correctCount: myScore?.correct ?? 0,
        timestampISO: new Date().toISOString(),
      });
      logger.log('[Results] Recorded XP:', xp, 'winner:', isWinner);
    }
  }, [data, playerId, recordSessionResult, winner]);

  const handleSaveResult = () => {
    if (!data || saved) return;
    const winnerData = data.scores[winner?.id];
    const totalQ = data.totalQuestions;

    const entry: ArenaLeaderboardEntry = {
      id: `arena_${Date.now()}`,
      deckId: data.deckId || '',
      deckName: data.deckName || 'Unknown',
      winnerName: winnerDisplayName,
      winnerPoints: winnerData?.points ?? 0,
      winnerAccuracy: totalQ > 0 ? (winnerData?.correct ?? 0) / totalQ : 0,
      playerCount: data.players.length,
      rounds: data.settings.rounds,
      timerSeconds: data.settings.timerSeconds,
      completedAt: Date.now(),
    };

    saveMatchResult(entry);
    setSaved(true);
    if (Platform.OS !== 'web') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  };

  const handleShareResults = useCallback(async () => {
    if (!winner) {
      return;
    }

    logger.log('[Results] Sharing arena results');

    const shareResult = await shareTextWithFallback({
      message: shareMessage,
      title: 'FlashQuest Results',
      fallbackTitle: 'Unable to share',
      fallbackMessage: 'Please try again in a moment.',
      copiedTitle: 'Results copied',
      copiedMessage: 'Sharing is limited here, so the results were copied to your clipboard.',
    });

    logger.log('[Results] Share arena results result:', shareResult);

    if (shareResult !== 'failed' && shareResult !== 'cancelled' && Platform.OS !== 'web') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, [shareMessage, winner]);

  const handlePlayAgain = () => {
    if (isHost) {
      trackEvent({
        event: 'rematch_started',
        roomCode: data?.roomCode,
        userId: playerId ?? undefined,
        deckId: data?.deckId ?? undefined,
        properties: {
          players_per_battle: data?.players.length ?? 0,
          mode: GAME_MODE.ARENA,
          deck_name: data?.deckName ?? null,
        },
      });
      resetRoom();
    }
  };

  const handleBackToLobby = () => {
    if (isHost) {
      resetRoom();
    } else {
      router.replace('/arena-lobby' as any);
    }
  };

  const handleGoHome = () => {
    disconnect();
    router.replace('/');
  };

  const getMedalEmoji = (index: number): string => {
    switch (index) {
      case 0: return '🥇';
      case 1: return '🥈';
      case 2: return '🥉';
      default: return `${index + 1}`;
    }
  };

  const getMedalColor = (index: number): string => {
    switch (index) {
      case 0: return '#FFD700';
      case 1: return '#C0C0C0';
      case 2: return '#CD7F32';
      default: return theme.textTertiary;
    }
  };

  if (!data) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <SafeAreaView style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: theme.text }]}>Loading results...</Text>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <LinearGradient
        colors={[theme.arenaGradient[0], theme.arenaGradient[1]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <Trophy color="#FFD700" size={56} />
            <Text style={styles.title}>Battle Over!</Text>
          </View>

          {winner != null && (
            <View
              testID="arena-results-winner-card"
              style={[
                styles.winnerSection,
                {
                  backgroundColor: theme.cardBackground,
                  borderColor: `${winner.color}55`,
                },
              ]}
            >
              <LinearGradient
                colors={[`${winner.color}22`, 'rgba(255, 215, 0, 0.10)', 'rgba(255, 255, 255, 0.02)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.winnerSectionGlow}
              />
              <View style={styles.winnerSectionHeader}>
                <View style={styles.winnerTitleBadge}>
                  <Text style={styles.winnerSectionEmoji}>🏆</Text>
                  <Text style={[styles.winnerSectionLabel, { color: theme.textSecondary }]}>Winner</Text>
                </View>
                {winnerIdentityLabel.length > 0 && (
                  <View
                    style={[
                      styles.winnerIdentityBadge,
                      {
                        backgroundColor: `${winner.color}18`,
                        borderColor: `${winner.color}44`,
                      },
                    ]}
                  >
                    <Text style={[styles.winnerIdentityBadgeText, { color: winner.color }]}>{winnerIdentityLabel}</Text>
                  </View>
                )}
              </View>
              <Text style={[styles.winnerSectionName, { color: theme.text }]} numberOfLines={1}>
                {winnerName}
              </Text>
              <Text style={[styles.winnerSectionStats, { color: theme.textSecondary }]}>{winnerStatsText}</Text>
              {winnerCallouts.length > 0 && (
                <View style={styles.winnerCalloutRow}>
                  {winnerCallouts.map((callout) => (
                    <View
                      key={callout}
                      style={[
                        styles.winnerCalloutBadge,
                        {
                          backgroundColor: theme.background,
                          borderColor: theme.border,
                        },
                      ]}
                    >
                      <Text style={[styles.winnerCalloutText, { color: theme.text }]}>{callout}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          <View style={[styles.standingsCard, { backgroundColor: theme.cardBackground }]}>
            <View style={styles.standingsHeader}>
              <Medal color={theme.warning} size={22} />
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Leaderboard</Text>
            </View>

            <View style={styles.standingsList}>
              {sortedPlayers.map((player, index) => {
                const score = data.scores[player.id];
                const totalQ = data.totalQuestions;
                const accuracy = totalQ > 0 ? ((score?.correct ?? 0) / totalQ) : 0;
                const performanceSummary = playerPerformance[player.id]?.summary ?? '0 correct — 0s';

                return (
                  <View
                    key={player.id}
                    testID={`arena-results-player-row-${index + 1}`}
                    style={[
                      styles.standingRow,
                      {
                        backgroundColor: player.id === winner?.id ? `${player.color}14` : theme.background,
                        borderColor: player.id === winner?.id ? `${player.color}55` : 'transparent',
                      },
                      index === 0 && styles.winnerRow,
                    ]}
                  >
                    <View style={styles.standingLeft}>
                      <Text style={[styles.rankText, { color: getMedalColor(index) }]}>
                        {getMedalEmoji(index)}
                      </Text>
                      <View style={[styles.playerAvatar, { backgroundColor: player.color }]}>
                        <Text style={styles.playerInitial}>{player.suit}</Text>
                      </View>
                      <View style={styles.playerNameCol}>
                        <View style={styles.playerLabelRow}>
                          <Text
                            style={[
                              styles.playerName,
                              { color: theme.text },
                              player.id === winner?.id && styles.winnerPlayerName,
                            ]}
                            numberOfLines={1}
                          >
                            {player.name}
                          </Text>
                          {player.id === winner?.id && (
                            <View
                              style={[
                                styles.rowWinnerBadge,
                                {
                                  backgroundColor: `${player.color}18`,
                                  borderColor: `${player.color}40`,
                                },
                              ]}
                            >
                              <Text style={[styles.rowWinnerBadgeText, { color: player.color }]}>Winner</Text>
                            </View>
                          )}
                          {player.id === playerId && (
                            <Text style={[styles.youLabel, { color: theme.primary }]}>(You)</Text>
                          )}
                        </View>
                        <Text style={[styles.playerIdentity, { color: player.color }]} numberOfLines={1}>
                          {player.identityLabel}
                        </Text>
                        <Text style={[styles.playerPerformance, { color: theme.textSecondary }]} numberOfLines={1}>
                          {performanceSummary}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.standingRight}>
                      <View style={styles.statBadge}>
                        <Text style={[styles.statBadgeValue, { color: theme.primary }]}>
                          {score?.points ?? 0}
                        </Text>
                        <Text style={[styles.statBadgeLabel, { color: theme.textSecondary }]}>pts</Text>
                      </View>
                      <View style={styles.statBadge}>
                        <Text style={[styles.statBadgeValue, { color: theme.success }]}>
                          {Math.round(accuracy * 100)}%
                        </Text>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>

          </View>

          <View style={[styles.statsCard, { backgroundColor: theme.cardBackground }]}>
            <View style={styles.statsGrid}>
              <View style={styles.statBox}>
                <Users color={theme.primary} size={24} />
                <Text style={[styles.statValue, { color: theme.text }]}>{data.players.length}</Text>
                <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Players</Text>
              </View>
              <View style={styles.statBox}>
                <Target color={theme.success} size={24} />
                <Text style={[styles.statValue, { color: theme.text }]}>{data.totalQuestions}</Text>
                <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Questions</Text>
              </View>
              <View style={styles.statBox}>
                <Trophy color="#FFD700" size={24} />
                <Text style={[styles.statValue, { color: theme.text }]}>{winnerScore?.bestStreak ?? 0}</Text>
                <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Best Streak</Text>
              </View>
            </View>
          </View>

          {missedQuestions.length > 0 && data.settings.showExplanationsAtEnd && (
            <View style={[styles.missedSection, { backgroundColor: theme.cardBackground }]}>
              <TouchableOpacity
                style={styles.missedHeader}
                onPress={() => setShowMissedCards(!showMissedCards)}
                activeOpacity={0.7}
              >
                <Text style={[styles.missedTitle, { color: theme.text }]}>
                  Missed Questions ({missedQuestions.length})
                </Text>
                {showMissedCards ? (
                  <ChevronUp color={theme.textSecondary} size={24} />
                ) : (
                  <ChevronDown color={theme.textSecondary} size={24} />
                )}
              </TouchableOpacity>

              {showMissedCards && (
                <View style={styles.missedList}>
                  {missedQuestions.map((item, index) => (
                    <View key={`missed-${index}`} style={[styles.missedCard, { backgroundColor: theme.background }]}>
                      <Text style={[styles.missedQuestion, { color: theme.text }]} numberOfLines={2}>
                        {item.question}
                      </Text>
                      <Text style={[styles.missedAnswer, { color: theme.success }]}>
                        Answer: {item.correctAnswer}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          <View style={styles.buttonContainer}>
            {isHost && (
              <TouchableOpacity testID="arena-results-play-again-button" style={styles.primaryButton} onPress={handlePlayAgain} activeOpacity={0.85}>
                <LinearGradient
                  colors={[theme.arenaGradient[0], theme.arenaGradient[1]]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.buttonGradient}
                >
                  <RotateCcw color="#fff" size={20} />
                  <Text style={styles.primaryButtonText}>Play Again</Text>
                </LinearGradient>
              </TouchableOpacity>
            )}

            {!isHost && (
              <View style={styles.waitingForHostReset}>
                <Text style={styles.waitingForHostResetText}>Waiting for host to start next round...</Text>
              </View>
            )}

            <TouchableOpacity
              testID="arena-results-share-button"
              style={[
                styles.shareButton,
                {
                  backgroundColor: theme.cardBackground,
                  borderColor: theme.primary,
                },
              ]}
              onPress={() => {
                void handleShareResults();
              }}
              activeOpacity={0.7}
            >
              <Share2 color={theme.primary} size={18} />
              <Text style={[styles.shareButtonText, { color: theme.primary }]}>Share Results</Text>
            </TouchableOpacity>

            {!saved && (
              <TouchableOpacity style={styles.saveButton} onPress={handleSaveResult} activeOpacity={0.85}>
                <LinearGradient
                  colors={['#8b5cf6', '#7c3aed']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.saveButtonGradient}
                >
                  <Save color="#fff" size={20} />
                  <Text style={styles.saveButtonText}>Save to Leaderboard</Text>
                </LinearGradient>
              </TouchableOpacity>
            )}

            {saved && (
              <View style={[styles.savedBadge, { backgroundColor: theme.success + '20' }]}>
                <Text style={[styles.savedText, { color: theme.success }]}>✓ Saved to Leaderboard</Text>
              </View>
            )}

            <TouchableOpacity
              style={[styles.secondaryButton, { borderColor: theme.primary }]}
              onPress={handleBackToLobby}
              activeOpacity={0.7}
            >
              <Users color={theme.primary} size={20} />
              <Text style={[styles.secondaryButtonText, { color: theme.primary }]}>
                Back to Lobby
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.tertiaryButton} onPress={handleGoHome} activeOpacity={0.7}>
              <Home color={theme.textSecondary} size={18} />
              <Text style={[styles.tertiaryButtonText, { color: theme.textSecondary }]}>
                Back to Home
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    fontWeight: '500' as const,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  title: {
    fontSize: 36,
    fontWeight: '800' as const,
    color: '#fff',
    marginTop: 16,
    marginBottom: 16,
  },
  winnerSection: {
    borderRadius: 24,
    paddingHorizontal: 22,
    paddingVertical: 22,
    marginBottom: 20,
    borderWidth: 1.5,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 18,
    elevation: 7,
  },
  winnerSectionGlow: {
    ...StyleSheet.absoluteFillObject,
  },
  winnerSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    flexWrap: 'wrap' as const,
  },
  winnerTitleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 215, 0, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.32)',
  },
  winnerSectionEmoji: {
    fontSize: 20,
  },
  winnerSectionLabel: {
    fontSize: 13,
    fontWeight: '700' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.8,
  },
  winnerIdentityBadge: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  winnerIdentityBadgeText: {
    fontSize: 13,
    fontWeight: '700' as const,
  },
  winnerSectionName: {
    fontSize: 36,
    fontWeight: '900' as const,
    marginTop: 18,
  },
  winnerSectionStats: {
    fontSize: 16,
    fontWeight: '700' as const,
    marginTop: 8,
  },
  winnerCalloutRow: {
    flexDirection: 'row',
    flexWrap: 'wrap' as const,
    gap: 10,
    marginTop: 16,
  },
  winnerCalloutBadge: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  winnerCalloutText: {
    fontSize: 12,
    fontWeight: '700' as const,
  },
  standingsCard: {
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  standingsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
  },
  standingsList: {
    gap: 10,
  },
  standingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  winnerRow: {
    borderWidth: 2,
    borderColor: '#FFD700',
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 4,
  },
  standingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  rankText: {
    fontSize: 20,
    fontWeight: '700' as const,
    width: 32,
    textAlign: 'center',
  },
  playerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  playerInitial: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#fff',
  },
  playerNameCol: {
    flex: 1,
  },
  playerLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  playerName: {
    fontSize: 15,
    fontWeight: '600' as const,
  },
  rowWinnerBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  rowWinnerBadgeText: {
    fontSize: 10,
    fontWeight: '800' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.4,
  },
  playerIdentity: {
    fontSize: 12,
    fontWeight: '600' as const,
    marginTop: 2,
  },
  playerPerformance: {
    fontSize: 12,
    fontWeight: '500' as const,
    marginTop: 3,
  },
  winnerPlayerName: {
    fontWeight: '800' as const,
  },
  youLabel: {
    fontSize: 11,
    fontWeight: '600' as const,
  },
  standingRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statBadge: {
    alignItems: 'center',
  },
  statBadgeValue: {
    fontSize: 16,
    fontWeight: '700' as const,
  },
  statBadgeLabel: {
    fontSize: 11,
  },
  statsCard: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statBox: {
    alignItems: 'center',
    gap: 6,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '700' as const,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '500' as const,
  },
  missedSection: {
    borderRadius: 20,
    marginBottom: 20,
    overflow: 'hidden',
  },
  missedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  missedTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
  },
  missedList: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 12,
  },
  missedCard: {
    padding: 14,
    borderRadius: 14,
  },
  missedQuestion: {
    fontSize: 15,
    fontWeight: '600' as const,
    marginBottom: 8,
  },
  missedAnswer: {
    fontSize: 14,
    fontWeight: '500' as const,
  },
  buttonContainer: {
    gap: 12,
  },
  saveButton: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  saveButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#fff',
  },
  savedBadge: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 14,
    alignItems: 'center',
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  shareButtonText: {
    fontSize: 15,
    fontWeight: '700' as const,
  },
  savedText: {
    fontSize: 15,
    fontWeight: '600' as const,
  },
  primaryButton: {
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.26,
    shadowRadius: 14,
    elevation: 6,
  },
  buttonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 20,
  },
  primaryButtonText: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#fff',
  },
  waitingForHostReset: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  waitingForHostResetText: {
    fontSize: 15,
    fontWeight: '500' as const,
    color: 'rgba(255, 255, 255, 0.7)',
    fontStyle: 'italic' as const,
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 2,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
  },
  tertiaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  tertiaryButtonText: {
    fontSize: 15,
    fontWeight: '500' as const,
  },
});
