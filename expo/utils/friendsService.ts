import { supabase } from '@/lib/supabase';
import { logger } from '@/utils/logger';

export interface FriendProfile {
  userId: string;
  username: string;
  displayName: string;
  avatarKey: string;
  level: number;
  currentStreak: number;
  totalScore: number;
  totalCardsStudied: number;
  lastActive: string | null;
}

export interface FriendRequest {
  id: string;
  user: FriendProfile;
  createdAt: string;
}

export interface Friendship {
  id: string;
  friend: FriendProfile;
  createdAt: string;
}

interface ProfileRow {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_key: string | null;
}

interface LeaderboardRow {
  user_id: string;
  level: number | null;
  current_streak: number | null;
  total_score: number | null;
  total_cards_studied: number | null;
  updated_at?: string | null;
}

interface FriendshipRow {
  id: string;
  requester_id: string;
  addressee_id: string;
  created_at: string;
  status?: string | null;
}

function buildFriendProfile(profile: ProfileRow, stats?: LeaderboardRow | null): FriendProfile {
  return {
    userId: profile.id,
    username: profile.username?.trim() || '',
    displayName: profile.display_name?.trim() || profile.username?.trim() || 'Player',
    avatarKey: profile.avatar_key ?? 'bear',
    level: stats?.level ?? 1,
    currentStreak: stats?.current_streak ?? 0,
    totalScore: stats?.total_score ?? 0,
    totalCardsStudied: stats?.total_cards_studied ?? 0,
    lastActive: stats?.updated_at ?? null,
  };
}

export async function searchUsers(query: string, currentUserId: string): Promise<FriendProfile[]> {
  try {
    const trimmed = query.trim().toLowerCase();
    if (trimmed.length < 2) {
      return [];
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_key')
      .neq('id', currentUserId)
      .ilike('username', `%${trimmed}%`)
      .limit(20);

    if (error || !data) {
      logger.warn('[Friends] Search query failed:', error?.message ?? 'missing data');
      return [];
    }

    const userIds = (data as ProfileRow[]).map((profile) => profile.id);
    if (userIds.length === 0) {
      return [];
    }

    const { data: statsData, error: statsError } = await supabase
      .from('leaderboard')
      .select('user_id, level, current_streak, total_score, total_cards_studied, updated_at')
      .in('user_id', userIds);

    if (statsError) {
      logger.warn('[Friends] Search stats lookup failed:', statsError.message);
    }

    const statsMap = new Map<string, LeaderboardRow>();
    (statsData as LeaderboardRow[] | null ?? []).forEach((row) => {
      statsMap.set(row.user_id, row);
    });

    return (data as ProfileRow[])
      .filter((profile) => profile.username && profile.username.trim().length > 0)
      .map((profile) => buildFriendProfile(profile, statsMap.get(profile.id)));
  } catch (error) {
    logger.warn('[Friends] Search failed:', error);
    return [];
  }
}

export async function sendFriendRequest(userId: string, friendId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: existing, error: existingError } = await supabase
      .from('friendships')
      .select('id, status, requester_id, addressee_id, created_at')
      .or(`and(requester_id.eq.${userId},addressee_id.eq.${friendId}),and(requester_id.eq.${friendId},addressee_id.eq.${userId})`)
      .maybeSingle();

    if (existingError) {
      logger.warn('[Friends] Failed to inspect existing friendship:', existingError.message);
    }

    const existingRow = existing as FriendshipRow | null;
    if (existingRow) {
      if (existingRow.status === 'accepted') {
        return { success: false, error: 'You are already friends.' };
      }

      if (existingRow.status === 'pending') {
        return { success: false, error: 'A request is already pending.' };
      }
    }

    const { error } = await supabase
      .from('friendships')
      .insert({ requester_id: userId, addressee_id: friendId, status: 'pending' });

    if (error) {
      if (error.code === '23505') {
        return { success: false, error: 'A request is already pending.' };
      }

      logger.warn('[Friends] Send request failed:', error.message);
      return { success: false, error: 'Could not send request. Try again.' };
    }

    logger.log('[Friends] Friend request sent:', { userId, friendId });
    return { success: true };
  } catch (error) {
    logger.warn('[Friends] Send request error:', error);
    return { success: false, error: 'An unexpected error occurred.' };
  }
}

export async function acceptFriendRequest(friendshipId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('friendships')
      .update({ status: 'accepted' })
      .eq('id', friendshipId);

    if (error) {
      logger.warn('[Friends] Accept failed:', error.message);
      return false;
    }

    logger.log('[Friends] Friend request accepted:', friendshipId);
    return true;
  } catch (error) {
    logger.warn('[Friends] Accept request error:', error);
    return false;
  }
}

export async function declineFriendRequest(friendshipId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('friendships')
      .delete()
      .eq('id', friendshipId);

    if (error) {
      logger.warn('[Friends] Decline failed:', error.message);
      return false;
    }

    logger.log('[Friends] Friend request declined:', friendshipId);
    return true;
  } catch (error) {
    logger.warn('[Friends] Decline request error:', error);
    return false;
  }
}

export async function removeFriend(friendshipId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('friendships')
      .delete()
      .eq('id', friendshipId);

    if (error) {
      logger.warn('[Friends] Remove failed:', error.message);
      return false;
    }

    logger.log('[Friends] Friend removed:', friendshipId);
    return true;
  } catch (error) {
    logger.warn('[Friends] Remove friend error:', error);
    return false;
  }
}

export async function fetchFriends(userId: string): Promise<Friendship[]> {
  try {
    const { data, error } = await supabase
      .from('friendships')
      .select('id, requester_id, addressee_id, created_at')
      .eq('status', 'accepted')
      .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`);

    if (error || !data || data.length === 0) {
      if (error) {
        logger.warn('[Friends] Fetch friends failed:', error.message);
      }
      return [];
    }

    const friendshipRows = data as FriendshipRow[];
    const friendIds = friendshipRows.map((friendship) => (
      friendship.requester_id === userId ? friendship.addressee_id : friendship.requester_id
    ));

    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_key')
      .in('id', friendIds);

    if (profilesError) {
      logger.warn('[Friends] Fetch friend profiles failed:', profilesError.message);
      return [];
    }

    const { data: stats, error: statsError } = await supabase
      .from('leaderboard')
      .select('user_id, level, current_streak, total_score, total_cards_studied, updated_at')
      .in('user_id', friendIds);

    if (statsError) {
      logger.warn('[Friends] Fetch friend stats failed:', statsError.message);
    }

    const profileMap = new Map<string, ProfileRow>();
    ((profiles as ProfileRow[] | null) ?? []).forEach((profile) => {
      profileMap.set(profile.id, profile);
    });

    const statsMap = new Map<string, LeaderboardRow>();
    ((stats as LeaderboardRow[] | null) ?? []).forEach((stat) => {
      statsMap.set(stat.user_id, stat);
    });

    return friendshipRows
      .map((friendship) => {
        const friendId = friendship.requester_id === userId ? friendship.addressee_id : friendship.requester_id;
        const profile = profileMap.get(friendId);
        if (!profile) {
          return null;
        }

        return {
          id: friendship.id,
          friend: buildFriendProfile(profile, statsMap.get(friendId)),
          createdAt: friendship.created_at,
        };
      })
      .filter((friendship): friendship is Friendship => friendship !== null)
      .sort((left, right) => right.friend.totalScore - left.friend.totalScore);
  } catch (error) {
    logger.warn('[Friends] Fetch failed:', error);
    return [];
  }
}

export async function fetchPendingRequests(userId: string): Promise<FriendRequest[]> {
  try {
    const { data, error } = await supabase
      .from('friendships')
      .select('id, requester_id, created_at')
      .eq('addressee_id', userId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error || !data || data.length === 0) {
      if (error) {
        logger.warn('[Friends] Fetch pending requests failed:', error.message);
      }
      return [];
    }

    const requestRows = data as Pick<FriendshipRow, 'id' | 'requester_id' | 'created_at'>[];
    const requesterIds = requestRows.map((request) => request.requester_id);

    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_key')
      .in('id', requesterIds);

    if (profilesError) {
      logger.warn('[Friends] Fetch requester profiles failed:', profilesError.message);
      return [];
    }

    const { data: stats, error: statsError } = await supabase
      .from('leaderboard')
      .select('user_id, level, current_streak, total_score, total_cards_studied, updated_at')
      .in('user_id', requesterIds);

    if (statsError) {
      logger.warn('[Friends] Fetch requester stats failed:', statsError.message);
    }

    const profileMap = new Map<string, ProfileRow>();
    ((profiles as ProfileRow[] | null) ?? []).forEach((profile) => {
      profileMap.set(profile.id, profile);
    });

    const statsMap = new Map<string, LeaderboardRow>();
    ((stats as LeaderboardRow[] | null) ?? []).forEach((stat) => {
      statsMap.set(stat.user_id, stat);
    });

    return requestRows
      .map((request) => {
        const profile = profileMap.get(request.requester_id);
        if (!profile) {
          return null;
        }

        return {
          id: request.id,
          user: buildFriendProfile(profile, statsMap.get(request.requester_id)),
          createdAt: request.created_at,
        };
      })
      .filter((request): request is FriendRequest => request !== null);
  } catch (error) {
    logger.warn('[Friends] Fetch requests failed:', error);
    return [];
  }
}

export async function getFriendCount(userId: string): Promise<number> {
  try {
    const { count, error } = await supabase
      .from('friendships')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'accepted')
      .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`);

    if (error) {
      logger.warn('[Friends] Count fetch failed:', error.message);
      return 0;
    }

    return count ?? 0;
  } catch (error) {
    logger.warn('[Friends] Count fetch error:', error);
    return 0;
  }
}

export async function getPendingRequestCount(userId: string): Promise<number> {
  try {
    const { count, error } = await supabase
      .from('friendships')
      .select('id', { count: 'exact', head: true })
      .eq('addressee_id', userId)
      .eq('status', 'pending');

    if (error) {
      logger.warn('[Friends] Pending count fetch failed:', error.message);
      return 0;
    }

    return count ?? 0;
  } catch (error) {
    logger.warn('[Friends] Pending count fetch error:', error);
    return 0;
  }
}
