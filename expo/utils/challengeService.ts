import { supabase } from '@/lib/supabase';
import { logger } from '@/utils/logger';
import { normalizeStringArray } from '@/utils/safeJson';

export interface ChallengeData {
  id: string;
  challengerId: string;
  challengerUsername: string;
  challengerDisplayName: string;
  opponentId: string;
  opponentUsername: string;
  opponentDisplayName: string;
  deckName: string;
  deckColor: string;
  questionIds: string[];
  challengerScore: number;
  challengerCorrect: number;
  challengerTimeMs: number;
  opponentScore: number | null;
  opponentCorrect: number | null;
  opponentTimeMs: number | null;
  status: 'pending' | 'completed' | 'expired';
  createdAt: string;
  completedAt: string | null;
}

interface ChallengeRow {
  id: string;
  challenger_id: string;
  opponent_id: string;
  deck_name: string | null;
  deck_color: string | null;
  question_ids: unknown;
  challenger_score: number | null;
  challenger_correct: number | null;
  challenger_time_ms: number | null;
  opponent_score: number | null;
  opponent_correct: number | null;
  opponent_time_ms: number | null;
  status: string | null;
  created_at: string | null;
  completed_at: string | null;
}

interface ProfileLookupRow {
  id: string;
  username: string | null;
  display_name: string | null;
}

function normalizeChallengeStatus(value: string | null | undefined): ChallengeData['status'] {
  if (value === 'completed' || value === 'expired' || value === 'pending') {
    return value;
  }

  return 'pending';
}

function parseQuestionIds(value: unknown): string[] {
  const normalizedArray = normalizeStringArray(value);
  if (normalizedArray) {
    return normalizedArray;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return [];
    }

    try {
      const parsed = JSON.parse(trimmed) as unknown;
      return normalizeStringArray(parsed) ?? [];
    } catch {
      return trimmed
        .split(',')
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0);
    }
  }

  return [];
}

async function fetchProfileMap(userIds: string[]): Promise<Map<string, { username: string; displayName: string }>> {
  const uniqueUserIds = [...new Set(userIds.filter((userId) => userId.trim().length > 0))];
  if (uniqueUserIds.length === 0) {
    return new Map<string, { username: string; displayName: string }>();
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, display_name')
    .in('id', uniqueUserIds);

  if (error) {
    logger.warn('[Challenges] Profile lookup failed:', error.message);
    return new Map<string, { username: string; displayName: string }>();
  }

  const profileMap = new Map<string, { username: string; displayName: string }>();
  ((data as ProfileLookupRow[] | null) ?? []).forEach((profile) => {
    const username = profile.username?.trim() ?? '';
    profileMap.set(profile.id, {
      username,
      displayName: profile.display_name?.trim() || username || 'Player',
    });
  });

  return profileMap;
}

function mapChallengeRow(
  row: ChallengeRow,
  profileMap: Map<string, { username: string; displayName: string }>,
): ChallengeData {
  const challenger = profileMap.get(row.challenger_id) ?? { username: '', displayName: 'Player' };
  const opponent = profileMap.get(row.opponent_id) ?? { username: '', displayName: 'Player' };

  return {
    id: row.id,
    challengerId: row.challenger_id,
    challengerUsername: challenger.username,
    challengerDisplayName: challenger.displayName,
    opponentId: row.opponent_id,
    opponentUsername: opponent.username,
    opponentDisplayName: opponent.displayName,
    deckName: row.deck_name?.trim() || 'Deck',
    deckColor: row.deck_color?.trim() || '#6366F1',
    questionIds: parseQuestionIds(row.question_ids),
    challengerScore: row.challenger_score ?? 0,
    challengerCorrect: row.challenger_correct ?? 0,
    challengerTimeMs: row.challenger_time_ms ?? 0,
    opponentScore: row.opponent_score ?? null,
    opponentCorrect: row.opponent_correct ?? null,
    opponentTimeMs: row.opponent_time_ms ?? null,
    status: normalizeChallengeStatus(row.status),
    createdAt: row.created_at ?? '',
    completedAt: row.completed_at ?? null,
  };
}

export async function createChallenge(params: {
  challengerId: string;
  opponentId: string;
  deckName: string;
  deckColor: string;
  questionIds: string[];
  score: number;
  correct: number;
  timeMs: number;
}): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('challenges')
      .insert({
        challenger_id: params.challengerId,
        opponent_id: params.opponentId,
        deck_name: params.deckName,
        deck_color: params.deckColor,
        question_ids: params.questionIds,
        question_data: [],
        challenger_score: params.score,
        challenger_correct: params.correct,
        challenger_time_ms: params.timeMs,
        status: 'pending',
      })
      .select('id')
      .single();

    if (error || !data) {
      logger.warn('[Challenges] Create failed:', error?.message ?? 'missing challenge id');
      return null;
    }

    logger.log('[Challenges] Created challenge:', data.id);
    return data.id;
  } catch (error) {
    logger.warn('[Challenges] Create error:', error);
    return null;
  }
}

export async function completeChallenge(params: {
  challengeId: string;
  score: number;
  correct: number;
  timeMs: number;
}): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('challenges')
      .update({
        opponent_score: params.score,
        opponent_correct: params.correct,
        opponent_time_ms: params.timeMs,
        status: 'completed',
        completed_at: new Date().toISOString(),
      })
      .eq('id', params.challengeId)
      .eq('status', 'pending');

    if (error) {
      logger.warn('[Challenges] Complete failed:', error.message);
      return false;
    }

    logger.log('[Challenges] Completed challenge:', params.challengeId);
    return true;
  } catch (error) {
    logger.warn('[Challenges] Complete error:', error);
    return false;
  }
}

export async function fetchIncomingChallenges(userId: string): Promise<ChallengeData[]> {
  try {
    const { data, error } = await supabase
      .from('challenges')
      .select('*')
      .eq('opponent_id', userId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(10);

    if (error || !data) {
      if (error) {
        logger.warn('[Challenges] Fetch incoming failed:', error.message);
      }
      return [];
    }

    const challengeRows = data as ChallengeRow[];
    const profileMap = await fetchProfileMap(challengeRows.map((challenge) => challenge.challenger_id));

    return challengeRows.map((challenge) => mapChallengeRow(challenge, profileMap));
  } catch (error) {
    logger.warn('[Challenges] Fetch incoming error:', error);
    return [];
  }
}

export async function fetchRecentResults(userId: string): Promise<ChallengeData[]> {
  try {
    const { data, error } = await supabase
      .from('challenges')
      .select('*')
      .eq('status', 'completed')
      .or(`challenger_id.eq.${userId},opponent_id.eq.${userId}`)
      .order('completed_at', { ascending: false })
      .limit(10);

    if (error || !data) {
      if (error) {
        logger.warn('[Challenges] Fetch recent results failed:', error.message);
      }
      return [];
    }

    const challengeRows = data as ChallengeRow[];
    const profileMap = await fetchProfileMap(
      challengeRows.flatMap((challenge) => [challenge.challenger_id, challenge.opponent_id]),
    );

    return challengeRows.map((challenge) => mapChallengeRow(challenge, profileMap));
  } catch (error) {
    logger.warn('[Challenges] Fetch recent results error:', error);
    return [];
  }
}
