import type { User } from '@supabase/supabase-js';

type UserIdentityLike = Pick<User, 'email' | 'user_metadata'> | null | undefined;

function normalizeCandidate(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function getPreferredProfileName(options: {
  username?: string | null;
  user?: UserIdentityLike;
  fallback?: string;
}): string {
  const username = normalizeCandidate(options.username);
  if (username) {
    return username;
  }

  const fullName = normalizeCandidate(options.user?.user_metadata?.full_name);
  if (fullName) {
    return fullName;
  }

  const name = normalizeCandidate(options.user?.user_metadata?.name);
  if (name) {
    return name;
  }

  const emailHandle = normalizeCandidate(options.user?.email?.split('@')[0]);
  if (emailHandle) {
    return emailHandle;
  }

  return normalizeCandidate(options.fallback) ?? 'Player';
}
