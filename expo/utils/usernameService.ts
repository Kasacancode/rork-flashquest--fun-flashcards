import { supabase } from '@/lib/supabase';
import { containsOffensiveLanguage } from '@/utils/contentSafety';
import { logger } from '@/utils/logger';

export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 20;
const USERNAME_REGEX = /^[a-zA-Z0-9_]+$/;
const USERNAME_LOOKUP_RETRY_COUNT = 3;
const USERNAME_LOOKUP_RETRY_DELAY_MS = 250;
export const USERNAME_AVAILABILITY_FALLBACK_MESSAGE = 'Live availability check is unavailable right now. You can still claim it. Saving will still enforce uniqueness.';

interface UsernameAvailabilityResult {
  status: UsernameAvailabilityStatus;
  error?: string;
}

interface UsernameOwnerRow {
  id: string;
  username: string | null;
}

export function normalizeUsernameInput(value: string): string {
  return value.toLowerCase().replace(/[^a-zA-Z0-9_]/g, '').slice(0, USERNAME_MAX_LENGTH);
}

function getCanonicalUsername(value: string): string {
  return normalizeUsernameInput(value.trim());
}

function isUniqueViolationError(error: { code?: string; message?: string } | null | undefined): boolean {
  const message = error?.message?.toLowerCase() ?? '';
  return error?.code === '23505' || message.includes('duplicate key');
}

async function pause(durationMs: number): Promise<void> {
  await new Promise<void>((resolve) => {
    setTimeout(() => resolve(), durationMs);
  });
}

async function lookupUsernameOwners(canonicalUsername: string): Promise<{
  data: UsernameOwnerRow[] | null;
  error: string | null;
}> {
  if (!canonicalUsername) {
    return {
      data: [],
      error: null,
    };
  }

  for (let attempt = 0; attempt < USERNAME_LOOKUP_RETRY_COUNT; attempt += 1) {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, username')
      .eq('username', canonicalUsername)
      .limit(10);

    if (!error) {
      return {
        data: Array.isArray(data) ? data as UsernameOwnerRow[] : [],
        error: null,
      };
    }

    logger.warn('[Username] Availability lookup failed:', {
      attempt: attempt + 1,
      code: error.code,
      details: error.details,
      hint: error.hint,
      message: error.message,
      username: canonicalUsername,
    });

    if (attempt < USERNAME_LOOKUP_RETRY_COUNT - 1) {
      await pause(USERNAME_LOOKUP_RETRY_DELAY_MS * (attempt + 1));
    }
  }

  return {
    data: null,
    error: USERNAME_AVAILABILITY_FALLBACK_MESSAGE,
  };
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

export async function getUsernameAvailability(
  username: string,
  options?: { excludeUserId?: string | null },
): Promise<UsernameAvailabilityResult> {
  try {
    const canonicalUsername = getCanonicalUsername(username);
    const lookupResult = await lookupUsernameOwners(canonicalUsername);

    if (lookupResult.error) {
      return {
        status: 'unknown',
        error: lookupResult.error,
      };
    }

    const exactMatches = lookupResult.data ?? [];
    const conflictingMatches = exactMatches.filter((row) => row.id !== options?.excludeUserId);

    return {
      status: conflictingMatches.length === 0 ? 'available' : 'taken',
    };
  } catch (error) {
    logger.warn('[Username] Availability check error:', error);
    return {
      status: 'unknown',
      error: USERNAME_AVAILABILITY_FALLBACK_MESSAGE,
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
    const trimmed = getCanonicalUsername(username);
    const currentUsername = options?.currentUsername ? getCanonicalUsername(options.currentUsername) : null;
    const validationError = validateUsername(trimmed);

    if (validationError) {
      return { success: false, error: validationError };
    }

    if (options?.allowCurrentUsername && currentUsername && currentUsername === trimmed) {
      logger.log('[Username] Keeping current username:', trimmed);
      return { success: true };
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
      if (isUniqueViolationError(error)) {
        return { success: false, error: 'This username was just taken. Try another.' };
      }

      logger.warn('[Username] Claim failed:', {
        code: error.code,
        details: error.details,
        hint: error.hint,
        message: error.message,
      });
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

    if (typeof data.username !== 'string' || data.username.trim().length === 0) {
      return null;
    }

    const canonicalUsername = getCanonicalUsername(data.username);
    return canonicalUsername.length > 0 ? canonicalUsername : null;
  } catch {
    return null;
  }
}
