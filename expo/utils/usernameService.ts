import { supabase } from '@/lib/supabase';
import { containsOffensiveLanguage } from '@/utils/contentSafety';
import { logger } from '@/utils/logger';

export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 20;
const USERNAME_REGEX = /^[a-zA-Z0-9_]+$/;

export function normalizeUsernameInput(value: string): string {
  return value.replace(/[^a-zA-Z0-9_]/g, '').slice(0, USERNAME_MAX_LENGTH);
}

export function validateUsername(username: string): string | null {
  const trimmed = username.trim();

  if (trimmed.length < USERNAME_MIN_LENGTH) {
    return `Username must be at least ${USERNAME_MIN_LENGTH} characters.`;
  }

  if (trimmed.length > USERNAME_MAX_LENGTH) {
    return `Username must be ${USERNAME_MAX_LENGTH} characters or fewer.`;
  }

  if (!USERNAME_REGEX.test(trimmed)) {
    return 'Only letters, numbers, and underscores are allowed.';
  }

  if (trimmed.startsWith('_') || trimmed.endsWith('_')) {
    return 'Username cannot start or end with an underscore.';
  }

  if (containsOffensiveLanguage(trimmed)) {
    return 'Please choose a different username.';
  }

  return null;
}

export type UsernameAvailabilityStatus = 'available' | 'taken' | 'unknown';

interface UsernameAvailabilityResult {
  status: UsernameAvailabilityStatus;
  error?: string;
}

export async function getUsernameAvailability(
  username: string,
  options?: { excludeUserId?: string | null },
): Promise<UsernameAvailabilityResult> {
  try {
    const trimmed = username.trim();
    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .ilike('username', trimmed)
      .limit(1)
      .maybeSingle();

    if (error) {
      logger.warn('[Username] Availability check failed:', error.message);
      return {
        status: 'unknown',
        error: 'Could not verify availability. You can still try claiming it.',
      };
    }

    if (data?.id && options?.excludeUserId && data.id === options.excludeUserId) {
      return {
        status: 'available',
      };
    }

    return {
      status: data === null ? 'available' : 'taken',
    };
  } catch (error) {
    logger.warn('[Username] Availability check error:', error);
    return {
      status: 'unknown',
      error: 'Could not verify availability. You can still try claiming it.',
    };
  }
}

export async function checkUsernameAvailable(username: string): Promise<boolean> {
  const result = await getUsernameAvailability(username);
  return result.status === 'available';
}

export async function claimUsername(
  userId: string,
  username: string,
  options?: {
    excludeUserId?: string | null;
    currentUsername?: string | null;
    allowCurrentUsername?: boolean;
  },
): Promise<{ success: boolean; error?: string }> {
  try {
    const trimmed = username.trim();
    const currentUsername = options?.currentUsername?.trim() ?? null;
    const validationError = validateUsername(trimmed);

    if (validationError) {
      return { success: false, error: validationError };
    }

    if (options?.allowCurrentUsername && currentUsername && currentUsername.toLowerCase() === trimmed.toLowerCase()) {
      logger.log('[Username] Keeping current username:', trimmed);
      return { success: true };
    }

    const availabilityResult = await getUsernameAvailability(trimmed, {
      excludeUserId: options?.excludeUserId ?? userId,
    });
    if (availabilityResult.status === 'taken') {
      return { success: false, error: 'This username is already taken.' };
    }

    if (availabilityResult.status === 'unknown') {
      logger.warn('[Username] Availability could not be confirmed, attempting claim anyway');
    }

    const timestamp = new Date().toISOString();
    let { data, error } = await supabase
      .from('profiles')
      .update({
        username: trimmed,
        updated_at: timestamp,
      })
      .eq('id', userId)
      .select('id')
      .maybeSingle();

    if (!error && !data) {
      logger.warn('[Username] No profile row found during claim, attempting upsert for user', userId);
      const fallbackResult = await supabase
        .from('profiles')
        .upsert({
          id: userId,
          username: trimmed,
          updated_at: timestamp,
        }, {
          onConflict: 'id',
        })
        .select('id')
        .maybeSingle();

      data = fallbackResult.data;
      error = fallbackResult.error;
    }

    if (error) {
      if (error.code === '23505') {
        return { success: false, error: 'This username was just taken. Try another.' };
      }

      logger.warn('[Username] Claim failed:', error.message);
      return { success: false, error: 'Could not save username. Please try again.' };
    }

    if (!data) {
      logger.warn('[Username] Claim failed: profile row missing for user', userId);
      return { success: false, error: 'Could not save username. Please try again.' };
    }

    const syncResults = await Promise.allSettled([
      supabase
        .from('leaderboard')
        .update({ display_name: trimmed, updated_at: new Date().toISOString() })
        .eq('user_id', userId),
      supabase
        .from('public_decks')
        .update({ publisher_name: trimmed, updated_at: new Date().toISOString() })
        .eq('user_id', userId),
    ]);

    syncResults.forEach((result, index) => {
      if (result.status !== 'fulfilled') {
        logger.warn('[Username] Post-claim sync failed:', result.reason);
        return;
      }

      if (result.value.error) {
        logger.warn('[Username] Post-claim sync query failed:', {
          target: index === 0 ? 'leaderboard' : 'public_decks',
          message: result.value.error.message,
        });
      }
    });

    logger.log('[Username] Claimed username:', trimmed);
    return { success: true };
  } catch (error) {
    logger.warn('[Username] Claim error:', error);
    return { success: false, error: 'An unexpected error occurred.' };
  }
}

export async function fetchUsername(userId: string): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', userId)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    return typeof data.username === 'string' && data.username.trim().length > 0
      ? data.username.trim()
      : null;
  } catch {
    return null;
  }
}
