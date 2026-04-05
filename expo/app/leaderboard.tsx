import { useQuery } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { ArrowLeft, Crown, Flame, Medal, Trophy } from 'lucide-react-native';
import React, { useCallback, useMemo, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import ResponsiveContainer from '@/components/ResponsiveContainer';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { logger } from '@/utils/logger';
import {
  fetchFriendsLeaderboard,
  fetchLeaderboard,
  fetchUserRank,
  type LeaderboardEntry,
  type LeaderboardPeriod,
} from '@/utils/leaderboardService';
import { getLevelBand } from '@/utils/levels';

function getRankIcon(rank: number): ReactNode {
  if (rank === 1) {
    return <Crown color="#FBBF24" size={18} strokeWidth={2.45} />;
  }

  if (rank === 2) {
    return <Medal color="#CBD5E1" size={18} strokeWidth={2.45} />;
  }

  if (rank === 3) {
    return <Medal color="#D97706" size={18} strokeWidth={2.45} />;
  }

  return null;
}

function getLevelColor(level: number): string {
  const band = getLevelBand(level);

  switch (band) {
    case 'elite':
      return '#8B5CF6';
    case 'high':
      return '#F59E0B';
    case 'mid':
      return '#10B981';
    case 'early':
    default:
      return '#3B82F6';
  }
}

export default function LeaderboardScreen() {
  const router = useRouter();
  const { theme, isDark } = useTheme();
  const { isSignedIn, user } = useAuth();
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [period, setPeriod] = useState<LeaderboardPeriod>('all');
  const currentUserId = user?.id ?? null;

  const leaderboardQuery = useQuery({
    queryKey: ['global-leaderboard', period, currentUserId],
    queryFn: () => {
      if (period === 'friends') {
        return currentUserId ? fetchFriendsLeaderboard(currentUserId) : Promise.resolve<LeaderboardEntry[]>([]);
      }

      return fetchLeaderboard(period);
    },
  });

  const entries = useMemo<LeaderboardEntry[]>(() => leaderboardQuery.data ?? [], [leaderboardQuery.data]);
  const currentUserEntry = useMemo<LeaderboardEntry | null>(() => {
    if (!currentUserId) {
      return null;
    }

    return entries.find((entry) => entry.userId === currentUserId) ?? null;
  }, [currentUserId, entries]);

  const currentUserTopRank = useMemo<number | null>(() => {
    if (!currentUserId) {
      return null;
    }

    const index = entries.findIndex((entry) => entry.userId === currentUserId);
    return index >= 0 ? index + 1 : null;
  }, [currentUserId, entries]);

  const userRankQuery = useQuery({
    queryKey: ['user-rank', currentUserId],
    queryFn: () => fetchUserRank(currentUserId ?? ''),
    enabled: Boolean(currentUserId) && period !== 'friends' && !currentUserTopRank,
  });

  const userRank = period === 'friends' ? null : currentUserTopRank ?? userRankQuery.data ?? null;

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      logger.log('[Leaderboard] Refresh requested', { period });
      await Promise.all([
        leaderboardQuery.refetch(),
        currentUserId && period !== 'friends' ? userRankQuery.refetch() : Promise.resolve(),
      ]);
    } finally {
      setIsRefreshing(false);
    }
  }, [currentUserId, leaderboardQuery, period, userRankQuery]);

  const backgroundGradient = useMemo<readonly [string, string, string]>(() => (
    isDark
      ? ['#09111F', '#11203A', '#0A1323']
      : ['#F7FBFF', '#E6EFFF', '#EEF0FF']
  ), [isDark]);
  const cardBg = isDark ? 'rgba(11, 20, 37, 0.84)' : 'rgba(255, 255, 255, 0.9)';
  const cardBorder = isDark ? 'rgba(148, 163, 184, 0.12)' : 'rgba(148, 163, 184, 0.18)';
  const headerTextColor = isDark ? '#F8FAFC' : '#173A71';
  const toggleActiveBg = isDark ? 'rgba(99, 102, 241, 0.2)' : 'rgba(99, 102, 241, 0.12)';
  const toggleInactiveBg = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)';
  const rowDividerColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.06)';
  const highlightBg = isDark ? 'rgba(99,102,241,0.1)' : 'rgba(99,102,241,0.05)';

  return (
    <View style={styles.container} testID="leaderboard-screen">
      <LinearGradient
        colors={backgroundGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />

      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <TouchableOpacity
            style={[
              styles.backButton,
              {
                backgroundColor: isDark ? 'rgba(10,17,34,0.46)' : 'rgba(255,255,255,0.58)',
                borderColor: cardBorder,
              },
            ]}
            onPress={() => router.back()}
            accessibilityLabel="Go back"
            accessibilityRole="button"
            testID="leaderboard-back-button"
          >
            <ArrowLeft color={headerTextColor} size={22} strokeWidth={2.5} />
          </TouchableOpacity>

          <View
            style={[
              styles.headerPill,
              {
                backgroundColor: isDark ? 'rgba(10,17,34,0.42)' : 'rgba(255,255,255,0.5)',
                borderColor: cardBorder,
              },
            ]}
          >
            <Trophy color={isDark ? '#FCD34D' : '#B45309'} size={20} strokeWidth={2.35} />
            <Text style={[styles.headerTitle, { color: headerTextColor }]}>Leaderboard</Text>
          </View>

          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.toggleRow}>
          <TouchableOpacity
            style={[
              styles.toggleButton,
              {
                backgroundColor: period === 'all' ? toggleActiveBg : toggleInactiveBg,
                borderColor: period === 'all' ? 'rgba(99,102,241,0.3)' : 'transparent',
              },
            ]}
            onPress={() => setPeriod('all')}
            activeOpacity={0.84}
            accessibilityRole="button"
            testID="leaderboard-period-all"
          >
            <Text
              style={[
                styles.toggleText,
                { color: period === 'all' ? (isDark ? '#818CF8' : '#6366F1') : theme.textSecondary },
              ]}
            >
              All Time
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.toggleButton,
              {
                backgroundColor: period === 'weekly' ? toggleActiveBg : toggleInactiveBg,
                borderColor: period === 'weekly' ? 'rgba(99,102,241,0.3)' : 'transparent',
              },
            ]}
            onPress={() => setPeriod('weekly')}
            activeOpacity={0.84}
            accessibilityRole="button"
            testID="leaderboard-period-weekly"
          >
            <Text
              style={[
                styles.toggleText,
                { color: period === 'weekly' ? (isDark ? '#818CF8' : '#6366F1') : theme.textSecondary },
              ]}
            >
              This Week
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.toggleButton,
              {
                backgroundColor: period === 'friends' ? toggleActiveBg : toggleInactiveBg,
                borderColor: period === 'friends' ? 'rgba(99,102,241,0.3)' : 'transparent',
              },
            ]}
            onPress={() => setPeriod('friends')}
            activeOpacity={0.84}
            accessibilityLabel="Friends leaderboard"
            accessibilityRole="button"
            testID="leaderboard-period-friends"
          >
            <Text
              style={[
                styles.toggleText,
                { color: period === 'friends' ? (isDark ? '#818CF8' : '#6366F1') : theme.textSecondary },
              ]}
            >
              Friends
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={(
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor={theme.primary}
              colors={[theme.primary]}
            />
          )}
        >
          <ResponsiveContainer maxWidth={760}>
            {!isSignedIn ? (
              <TouchableOpacity
                style={[
                  styles.signInBanner,
                  {
                    backgroundColor: isDark ? 'rgba(99,102,241,0.12)' : 'rgba(99,102,241,0.08)',
                    borderColor: isDark ? 'rgba(99,102,241,0.25)' : 'rgba(99,102,241,0.2)',
                  },
                ]}
                onPress={() => router.push('/auth')}
                activeOpacity={0.85}
                accessibilityRole="button"
                testID="leaderboard-signin-banner"
              >
                <Text style={[styles.signInBannerText, { color: isDark ? '#818CF8' : '#6366F1' }]}>Sign in to join the leaderboard</Text>
              </TouchableOpacity>
            ) : period !== 'friends' && userRank ? (
              <View
                style={[
                  styles.userCard,
                  {
                    backgroundColor: isDark ? 'rgba(99,102,241,0.12)' : 'rgba(99,102,241,0.06)',
                    borderColor: isDark ? 'rgba(99,102,241,0.25)' : 'rgba(99,102,241,0.18)',
                  },
                ]}
                testID="leaderboard-your-rank-card"
              >
                <Text style={[styles.userRankLabel, { color: isDark ? '#818CF8' : '#6366F1' }]}>Your Rank</Text>
                <View style={styles.userCardRow}>
                  <Text style={[styles.userRankNumber, { color: isDark ? '#818CF8' : '#6366F1' }]}>#{userRank}</Text>
                  <View style={styles.userCardStats}>
                    {currentUserEntry ? (
                      <>
                        <Text style={[styles.userCardScore, { color: theme.text }]}>{currentUserEntry.totalScore.toLocaleString()} XP</Text>
                        <Text style={[styles.userCardMeta, { color: theme.textSecondary }]}>
                          Level {currentUserEntry.level} · {currentUserEntry.currentStreak} day streak
                        </Text>
                      </>
                    ) : (
                      <>
                        <Text style={[styles.userCardScore, { color: theme.text }]}>Keep climbing</Text>
                        <Text style={[styles.userCardMeta, { color: theme.textSecondary }]}>Study more to break into the visible top 100.</Text>
                      </>
                    )}
                  </View>
                </View>
              </View>
            ) : null}

            {leaderboardQuery.isLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator color={theme.primary} size="large" />
              </View>
            ) : entries.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Trophy color={theme.textTertiary} size={48} strokeWidth={1.6} />
                <Text style={[styles.emptyTitle, { color: theme.text }]}>No rankings yet</Text>
                <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
                  {period === 'friends'
                    ? 'Add friends from your Profile to see them here.'
                    : period === 'weekly'
                      ? 'No one has studied this week yet. Be the first!'
                      : 'No leaderboard entries yet.'}
                </Text>
              </View>
            ) : (
              <View style={[styles.listCard, { backgroundColor: cardBg, borderColor: cardBorder }]} testID="leaderboard-list-card">
                {entries.map((entry, index) => {
                  const rank = index + 1;
                  const isCurrentUser = entry.userId === currentUserId;
                  const rankIcon = getRankIcon(rank);
                  const levelColor = getLevelColor(entry.level);

                  return (
                    <View
                      key={entry.userId}
                      style={[
                        styles.row,
                        isCurrentUser ? [styles.rowHighlight, { backgroundColor: highlightBg }] : null,
                        index < entries.length - 1 ? [styles.rowBorder, { borderBottomColor: rowDividerColor }] : null,
                      ]}
                      testID={`leaderboard-row-${rank}`}
                    >
                      <View style={styles.rankColumn}>
                        {rankIcon ?? <Text style={[styles.rankText, { color: theme.textSecondary }]}>{rank}</Text>}
                      </View>

                      <View style={[styles.levelBadge, { backgroundColor: `${levelColor}18` }]}>
                        <Text style={[styles.levelBadgeText, { color: levelColor }]}>Lv {entry.level}</Text>
                      </View>

                      <View style={styles.nameColumn}>
                        <Text
                          style={[styles.nameText, { color: isCurrentUser ? (isDark ? '#818CF8' : '#6366F1') : theme.text }]}
                          numberOfLines={1}
                        >
                          {entry.displayName}
                          {isCurrentUser ? ' (you)' : ''}
                        </Text>
                        {entry.currentStreak > 0 ? (
                          <View style={styles.streakRow}>
                            <Flame color="#F59E0B" size={12} strokeWidth={2.5} />
                            <Text style={[styles.streakText, { color: theme.textTertiary }]}>{entry.currentStreak}d streak</Text>
                          </View>
                        ) : (
                          <Text style={[styles.metaText, { color: theme.textTertiary }]}>Level {entry.level}</Text>
                        )}
                      </View>

                      <Text style={[styles.scoreText, { color: theme.text }]}>{entry.totalScore.toLocaleString()}</Text>
                    </View>
                  );
                })}
              </View>
            )}
          </ResponsiveContainer>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  headerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
  },
  headerSpacer: {
    width: 40,
    height: 40,
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  toggleButton: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '700',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  signInBanner: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    marginBottom: 16,
  },
  signInBannerText: {
    fontSize: 15,
    fontWeight: '700',
  },
  userCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  userRankLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  userCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  userRankNumber: {
    fontSize: 28,
    fontWeight: '800',
  },
  userCardStats: {
    flex: 1,
  },
  userCardScore: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 2,
  },
  userCardMeta: {
    fontSize: 13,
    fontWeight: '500',
  },
  loadingContainer: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  emptyContainer: {
    paddingVertical: 60,
    alignItems: 'center',
    gap: 10,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  emptySubtitle: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 20,
  },
  listCard: {
    borderRadius: 20,
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
  rowHighlight: {
    borderRadius: 0,
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rankColumn: {
    width: 28,
    alignItems: 'center',
  },
  rankText: {
    fontSize: 14,
    fontWeight: '800',
  },
  levelBadge: {
    minWidth: 42,
    height: 28,
    paddingHorizontal: 8,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  levelBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  nameColumn: {
    flex: 1,
    minWidth: 0,
  },
  nameText: {
    fontSize: 15,
    fontWeight: '700',
  },
  streakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  streakText: {
    fontSize: 11,
    fontWeight: '600',
  },
  metaText: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  scoreText: {
    fontSize: 15,
    fontWeight: '800',
  },
});
