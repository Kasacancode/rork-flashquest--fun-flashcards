import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { Trophy, Target, Medal, RotateCcw, Home, Users, ChevronDown, ChevronUp, Save } from 'lucide-react-native';
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useArena } from '@/context/ArenaContext';
import { useFlashQuest } from '@/context/FlashQuestContext';
import { useTheme } from '@/context/ThemeContext';
import type { ArenaLeaderboardEntry } from '@/types/flashcard';
import { logger } from '@/utils/logger';

interface CachedResults {
  players: Array<{ id: string; name: string; color: string; isHost: boolean; connected: boolean }>;
  scores: Record<string, { correct: number; incorrect: number; points: number; currentStreak: number; bestStreak: number }>;
  allQuestions: Array<{ cardId: string; question: string; correctAnswer: string; options: string[] }> | null;
  allAnswers: Record<string, Record<number, { selectedOption: string; isCorrect: boolean; timeToAnswerMs: number }>> | null;
  totalQuestions: number;
  deckId: string | null;
  deckName: string | null;
  settings: { rounds: number; timerSeconds: number; showExplanationsAtEnd: boolean };
  roomCode: string;
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
    leaderboard,
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
  }, [room?.status]);

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
  const winnerScore = data?.scores[winner?.id];

  const missedQuestions = useMemo(() => {
    if (!data?.allQuestions || !data.allAnswers) return [];
    const missed: Array<{ question: string; correctAnswer: string; questionIndex: number }> = [];
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
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, [winner]);

  useEffect(() => {
    if (data && playerId && !xpRecordedRef.current) {
      xpRecordedRef.current = true;
      const myScore = data.scores[playerId];
      const isWinner = winner?.id === playerId;
      const xp = isWinner ? 200 : 100;

      recordSessionResult({
        mode: 'battle',
        deckId: data.deckId || '',
        xpEarned: xp,
        cardsAttempted: data.totalQuestions,
        correctCount: myScore?.correct ?? 0,
        timestampISO: new Date().toISOString(),
      });
      logger.log('[Results] Recorded XP:', xp, 'winner:', isWinner);
    }
  }, [data, playerId, winner]);

  const handleSaveResult = () => {
    if (!data || saved) return;
    const winnerData = data.scores[winner?.id];
    const totalQ = data.totalQuestions;

    const entry: ArenaLeaderboardEntry = {
      id: `arena_${Date.now()}`,
      deckId: data.deckId || '',
      deckName: data.deckName || 'Unknown',
      winnerName: winner?.name || 'Unknown',
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
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  };

  const handlePlayAgain = () => {
    if (isHost) {
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
            {winner != null && (
              <View style={styles.winnerBadge}>
                <Text style={styles.winnerLabel}>Winner</Text>
                <Text style={styles.winnerName}>{winner.name}</Text>
              </View>
            )}
          </View>

          <View style={[styles.standingsCard, { backgroundColor: theme.cardBackground }]}>
            <View style={styles.standingsHeader}>
              <Medal color={theme.warning} size={22} />
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Final Standings</Text>
            </View>

            <View style={styles.standingsList}>
              {sortedPlayers.map((player, index) => {
                const score = data.scores[player.id];
                const totalQ = data.totalQuestions;
                const accuracy = totalQ > 0 ? ((score?.correct ?? 0) / totalQ) : 0;

                return (
                  <View
                    key={player.id}
                    style={[
                      styles.standingRow,
                      { backgroundColor: theme.background },
                      index === 0 && styles.winnerRow,
                    ]}
                  >
                    <View style={styles.standingLeft}>
                      <Text style={[styles.rankText, { color: getMedalColor(index) }]}>
                        {getMedalEmoji(index)}
                      </Text>
                      <View style={[styles.playerAvatar, { backgroundColor: player.color }]}>
                        <Text style={styles.playerInitial}>
                          {player.name.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <View style={styles.playerNameCol}>
                        <Text style={[styles.playerName, { color: theme.text }]} numberOfLines={1}>
                          {player.name}
                        </Text>
                        {player.id === playerId && (
                          <Text style={[styles.youLabel, { color: theme.primary }]}>(You)</Text>
                        )}
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

            {isHost && (
              <TouchableOpacity style={styles.primaryButton} onPress={handlePlayAgain} activeOpacity={0.85}>
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
  winnerBadge: {
    backgroundColor: 'rgba(255, 215, 0, 0.2)',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 16,
    alignItems: 'center',
  },
  winnerLabel: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '500' as const,
    marginBottom: 4,
  },
  winnerName: {
    fontSize: 24,
    fontWeight: '800' as const,
    color: '#FFD700',
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
  },
  winnerRow: {
    borderWidth: 2,
    borderColor: '#FFD700',
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
  playerName: {
    fontSize: 15,
    fontWeight: '600' as const,
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
  savedText: {
    fontSize: 15,
    fontWeight: '600' as const,
  },
  primaryButton: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 18,
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
