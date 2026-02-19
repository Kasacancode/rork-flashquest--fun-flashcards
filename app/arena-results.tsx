import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Trophy, Target, Medal, RotateCcw, Home, Users, ChevronDown, ChevronUp, Save } from 'lucide-react-native';
import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useArena } from '@/context/ArenaContext';
import { useFlashQuest } from '@/context/FlashQuestContext';
import { useTheme } from '@/context/ThemeContext';
import { ArenaMatchResult } from '@/types/flashcard';
import { logger } from '@/utils/logger';

export default function ArenaResultsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ result: string }>();
  const { theme } = useTheme();
  const { decks, recordSessionResult } = useFlashQuest();
  const { saveMatchResult, lobby } = useArena();

  const [showMissedCards, setShowMissedCards] = useState(false);
  const [saved, setSaved] = useState(false);

  const result: ArenaMatchResult = useMemo(() => {
    try {
      return JSON.parse(params.result || '{}');
    } catch {
      return {} as ArenaMatchResult;
    }
  }, [params.result]);

  const deck = useMemo(() => decks.find(d => d.id === result.deckId), [decks, result.deckId]);

  const sortedResults = useMemo(() => {
    if (!result.playerResults) return [];
    return [...result.playerResults].sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      return b.accuracy - a.accuracy;
    });
  }, [result.playerResults]);

  const winner = sortedResults[0];

  const allMissedAnswers = useMemo(() => {
    if (!result.playerResults) return [];
    const missed: { cardId: string; correctAnswer: string; playerName: string }[] = [];
    result.playerResults.forEach(pr => {
      pr.answers.filter(a => !a.isCorrect).forEach(a => {
        if (!missed.find(m => m.cardId === a.cardId)) {
          missed.push({
            cardId: a.cardId,
            correctAnswer: a.correctAnswer,
            playerName: pr.playerName,
          });
        }
      });
    });
    return missed;
  }, [result.playerResults]);

  const missedCardsDetails = useMemo(() => {
    if (!deck) return [];
    return allMissedAnswers.map(m => {
      const card = deck.flashcards.find(c => c.id === m.cardId);
      return {
        ...m,
        question: card?.question || 'Unknown',
        explanation: card?.explanation,
      };
    });
  }, [deck, allMissedAnswers]);

  useEffect(() => {
    if (winner && Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, [winner]);

  // Award XP once on mount: winner gets 200 XP, others get 100 XP
  useEffect(() => {
    if (result.playerResults && result.playerResults.length > 0) {
      const hostResult = result.playerResults[0];
      const isWinner = hostResult.playerId === sortedResults[0]?.playerId;
      recordSessionResult({
        mode: 'battle',
        deckId: result.deckId,
        xpEarned: isWinner ? 200 : 100,
        cardsAttempted: result.totalRounds || 0,
        correctCount: hostResult.correctCount,
        timestampISO: new Date().toISOString(),
      });
      logger.log('[Battle] Recorded session result for host player');
    }
  }, []);

  const handleSaveResult = () => {
    if (!deck || saved) return;
    saveMatchResult(result, deck.name);
    setSaved(true);
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  };

  const handlePlayAgain = () => {
    if (!lobby) {
      router.replace('/arena' as any);
      return;
    }
    router.replace({
      pathname: '/arena-session' as any,
      params: { lobbyState: JSON.stringify(lobby) },
    });
  };

  const handleBackToLobby = () => {
    router.replace('/arena-lobby' as any);
  };

  const handleGoHome = () => {
    router.replace('/');
  };

  const getMedalColor = (index: number): string => {
    switch (index) {
      case 0: return '#FFD700';
      case 1: return '#C0C0C0';
      case 2: return '#CD7F32';
      default: return theme.textTertiary;
    }
  };

  const getMedalEmoji = (index: number): string => {
    switch (index) {
      case 0: return '🥇';
      case 1: return '🥈';
      case 2: return '🥉';
      default: return `${index + 1}`;
    }
  };

  if (!result.playerResults || result.playerResults.length === 0) {
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
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <Trophy color="#FFD700" size={56} />
            <Text style={styles.title}>Battle Over!</Text>
            {winner && (
              <View style={styles.winnerBadge}>
                <Text style={styles.winnerLabel}>Winner</Text>
                <Text style={styles.winnerName}>{winner.playerName}</Text>
              </View>
            )}
          </View>

          <View style={[styles.standingsCard, { backgroundColor: theme.cardBackground }]}>
            <View style={styles.standingsHeader}>
              <Medal color={theme.warning} size={22} />
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Final Standings</Text>
            </View>

            <View style={styles.standingsList}>
              {sortedResults.map((playerResult, index) => (
                <View
                  key={playerResult.playerId}
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
                    <View style={[styles.playerAvatar, { backgroundColor: playerResult.playerColor }]}>
                      <Text style={styles.playerInitial}>
                        {playerResult.playerName.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <Text style={[styles.playerName, { color: theme.text }]} numberOfLines={1}>
                      {playerResult.playerName}
                    </Text>
                  </View>
                  <View style={styles.standingRight}>
                    <View style={styles.statBadge}>
                      <Text style={[styles.statBadgeValue, { color: theme.primary }]}>
                        {playerResult.points}
                      </Text>
                      <Text style={[styles.statBadgeLabel, { color: theme.textSecondary }]}>pts</Text>
                    </View>
                    <View style={styles.statBadge}>
                      <Text style={[styles.statBadgeValue, { color: theme.success }]}>
                        {Math.round(playerResult.accuracy * 100)}%
                      </Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          </View>

          <View style={[styles.statsCard, { backgroundColor: theme.cardBackground }]}>
            <View style={styles.statsGrid}>
              <View style={styles.statBox}>
                <Users color={theme.primary} size={24} />
                <Text style={[styles.statValue, { color: theme.text }]}>
                  {result.playerResults.length}
                </Text>
                <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Players</Text>
              </View>
              <View style={styles.statBox}>
                <Target color={theme.success} size={24} />
                <Text style={[styles.statValue, { color: theme.text }]}>
                  {result.totalRounds}
                </Text>
                <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Rounds</Text>
              </View>
              <View style={styles.statBox}>
                <Trophy color="#FFD700" size={24} />
                <Text style={[styles.statValue, { color: theme.text }]}>
                  {winner?.bestStreak || 0}
                </Text>
                <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Best Streak</Text>
              </View>
            </View>
          </View>

          {missedCardsDetails.length > 0 && result.settings.showExplanationsAtEnd && (
            <View style={[styles.missedSection, { backgroundColor: theme.cardBackground }]}>
              <TouchableOpacity
                style={styles.missedHeader}
                onPress={() => setShowMissedCards(!showMissedCards)}
                activeOpacity={0.7}
              >
                <Text style={[styles.missedTitle, { color: theme.text }]}>
                  Missed Questions ({missedCardsDetails.length})
                </Text>
                {showMissedCards ? (
                  <ChevronUp color={theme.textSecondary} size={24} />
                ) : (
                  <ChevronDown color={theme.textSecondary} size={24} />
                )}
              </TouchableOpacity>

              {showMissedCards && (
                <View style={styles.missedList}>
                  {missedCardsDetails.map((item, index) => (
                    <View
                      key={`${item.cardId}-${index}`}
                      style={[styles.missedCard, { backgroundColor: theme.background }]}
                    >
                      <Text style={[styles.missedQuestion, { color: theme.text }]} numberOfLines={2}>
                        {item.question}
                      </Text>
                      <Text style={[styles.missedAnswer, { color: theme.success }]}>
                        Answer: {item.correctAnswer}
                      </Text>
                      {item.explanation && (
                        <Text style={[styles.missedExplanation, { color: theme.textSecondary }]} numberOfLines={3}>
                          {item.explanation}
                        </Text>
                      )}
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          <View style={styles.buttonContainer}>
            {!saved && (
              <TouchableOpacity
                style={styles.saveButton}
                onPress={handleSaveResult}
                activeOpacity={0.85}
              >
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
              style={styles.primaryButton}
              onPress={handlePlayAgain}
              activeOpacity={0.85}
            >
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

            <TouchableOpacity
              style={[styles.secondaryButton, { borderColor: theme.primary }]}
              onPress={handleBackToLobby}
              activeOpacity={0.7}
            >
              <Users color={theme.primary} size={20} />
              <Text style={[styles.secondaryButtonText, { color: theme.primary }]}>
                Back to Battle Lobby
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.tertiaryButton}
              onPress={handleGoHome}
              activeOpacity={0.7}
            >
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
  playerName: {
    fontSize: 15,
    fontWeight: '600' as const,
    flex: 1,
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
    marginBottom: 6,
  },
  missedExplanation: {
    fontSize: 13,
    lineHeight: 18,
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
