import { supabase } from '@/lib/supabase';
import { logger } from '@/utils/logger';

export type LeaderboardPeriod = 'all' | 'weekly' | 'friends';

export interface LeaderboardEntry {
  userId: string;
  displayName: string;
  avatarKey: string;
  totalScore: number;
  level: number;
  currentStreak: number;
  longestStreak: number;
  totalCardsStudied: number;
  updatedAt: string;
}

interface LeaderboardRow {
  user_id: string;
  display_name: string | null;
  avatar_key: string | null;
  total_score: number | null;
  level: number | null;
  current_streak: number | null;
  longest_streak: number | null;
  total_cards_studied: number | null;
  updated_at: string | null;
}

interface FriendshipRow {
  requester_id: string;
  addressee_id: string;
}

function mapLeaderboardRow(row: LeaderboardRow): LeaderboardEntry {
  return {
    userId: row.user_id,
    displayName: row.display_name?.trim() || 'Player',
    avatarKey: row.avatar_key ?? 'bear',
    totalScore: row.total_score ?? 0,
    level: row.level ?? 1,
    currentStreak: row.current_streak ?? 0,
    longestStreak: row.longest_streak ?? 0,
    totalCardsStudied: row.total_cards_studied ?? 0,
    updatedAt: row.updated_at ?? '',
  };
}

export async function fetchLeaderboard(period: LeaderboardPeriod): Promise<LeaderboardEntry[]> {
  try {
    logger.log('[Leaderboard] Fetching leaderboard', { period });

    let query = supabase
      .from('leaderboard')
      .select('user_id, display_name, avatar_key, total_score, level, current_streak, longest_streak, total_cards_studied, updated_at')
      .order('total_score', { ascending: false })
      .limit(100);

    if (period === 'weekly') {
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      query = query.gte('updated_at', weekAgo);
    }

    const { data, error } = await query;

    if (error) {
      logger.warn('[Leaderboard] Fetch failed:', error.message);
      return [];
    }

    const entries = (data ?? []).map((row) => mapLeaderboardRow(row as LeaderboardRow));
    logger.log('[Leaderboard] Fetch complete', { period, count: entries.length });
    return entries;
  } catch (error: unknown) {
    logger.warn('[Leaderboard] Fetch error:', error);
    return [];
  }
}

export async function fetchFriendsLeaderboard(userId: string): Promise<LeaderboardEntry[]> {
  try {
    logger.log('[Leaderboard] Fetching friends leaderboard', { userId });

    const { data: friendships, error: friendError } = await supabase
      .from('friendships')
      .select('requester_id, addressee_id')
      .eq('status', 'accepted')
      .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`);

    if (friendError) {
      logger.warn('[Leaderboard] Friends fetch failed:', friendError.message);
      return [];
    }

    const friendRows = (friendships ?? []) as FriendshipRow[];
    if (friendRows.length === 0) {
      return [];
    }

    const allIds = [...new Set<string>([
      userId,
      ...friendRows.map((friendship) => (
        friendship.requester_id === userId ? friendship.addressee_id : friendship.requester_id
      )),
    ])];

    const { data, error } = await supabase
      .from('leaderboard')
      .select('user_id, display_name, avatar_key, total_score, level, current_streak, longest_streak, total_cards_studied, updated_at')
      .in('user_id', allIds)
      .order('total_score', { ascending: false });

    if (error) {
      logger.warn('[Leaderboard] Friends fetch failed:', error.message);
      return [];
    }

    const entries = (data ?? []).map((row) => mapLeaderboardRow(row as LeaderboardRow));
    logger.log('[Leaderboard] Friends fetch complete', { userId, count: entries.length });
    return entries;
  } catch (error: unknown) {
    logger.warn('[Leaderboard] Friends fetch failed:', error);
    return [];
  }
}

export async function fetchUserRank(userId: string): Promise<number | null> {
  try {
    logger.log('[Leaderboard] Fetching user rank', { userId });

    const { data: scoreRow, error: scoreError } = await supabase
      .from('leaderboard')
      .select('total_score')
      .eq('user_id', userId)
      .maybeSingle();

    if (scoreError) {
      logger.warn('[Leaderboard] Failed to fetch user score for rank:', scoreError.message);
      return null;
    }

    const userScore = scoreRow?.total_score;
    if (typeof userScore !== 'number') {
      return null;
    }

    const { count, error } = await supabase
      .from('leaderboard')
      .select('user_id', { count: 'exact', head: true })
      .gt('total_score', userScore);

    if (error) {
      logger.warn('[Leaderboard] Failed to fetch user rank:', error.message);
      return null;
    }

    return (count ?? 0) + 1;
  } catch (error: unknown) {
    logger.warn('[Leaderboard] User rank fetch error:', error);
    return null;
  }
}
