import { normalizeRoomCode } from '@/utils/arenaInvite';

function getRedirectPath(path: string): string {
  const parsedUrl = path.includes('://')
    ? new URL(path)
    : new URL(path, 'flashquest://app');
  const pathname = parsedUrl.pathname.startsWith('/') ? parsedUrl.pathname : `/${parsedUrl.pathname}`;
  const segments = pathname.split('/').filter(Boolean);
  const joinSegmentIndex = segments.findIndex((segment) => segment === 'join');

  if (joinSegmentIndex >= 0 && segments[joinSegmentIndex + 1]) {
    return `/join/${normalizeRoomCode(segments[joinSegmentIndex + 1] ?? '')}`;
  }

  return `${pathname}${parsedUrl.search}`;
}

export function redirectSystemPath({
  path,
  initial,
}: { path: string; initial: boolean }) {
  console.log('[NativeIntent] Redirecting path:', path, 'initial:', initial);

  try {
    return getRedirectPath(path);
  } catch (error) {
    console.warn('[NativeIntent] Failed to redirect path:', error);
    return '/';
  }
}
