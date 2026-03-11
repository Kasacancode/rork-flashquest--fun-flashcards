import { httpLink } from '@trpc/client';
import { createTRPCReact } from '@trpc/react-query';
import { Platform } from 'react-native';
import superjson from 'superjson';

type AppRouter = typeof import('@/backend/trpc/app-router').appRouter;

export const trpc = createTRPCReact<AppRouter>();

// URL resolution strategy:
// - Web: use relative '/api/trpc' (same origin, works with the Hono backend)
// - Native: use EXPO_PUBLIC_RORK_API_BASE_URL env var with '/api/trpc' appended
function getTrpcUrl(): string {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.location?.origin) {
      return `${window.location.origin}/api/trpc`;
    }
    return '/api/trpc';
  }

  const envUrl = process.env.EXPO_PUBLIC_RORK_API_BASE_URL;
  if (envUrl) {
    const base = envUrl.replace(/\/+$/, '');
    return `${base}/api/trpc`;
  }

  const projectId = process.env.EXPO_PUBLIC_PROJECT_ID ?? '7xpegtpthikn3ezzq9zt0';
  return `https://dev-${projectId}.rorktest.dev/api/trpc`;
}

const primaryTrpcUrl = getTrpcUrl();

console.log('[trpc] URL:', primaryTrpcUrl);

export const trpcClient = trpc.createClient({
  links: [
    httpLink({
      url: primaryTrpcUrl,
      transformer: superjson,
    }),
  ],
});
