import { httpLink } from '@trpc/client';
import { createTRPCReact } from '@trpc/react-query';
import { Platform } from 'react-native';
import superjson from 'superjson';

type AppRouter = typeof import('@/backend/trpc/app-router').appRouter;

export const trpc = createTRPCReact<AppRouter>();

function getTrpcUrl(): string {
  if (Platform.OS === 'web') {
    return '/api/trpc';
  }

  const envUrl = process.env.EXPO_PUBLIC_RORK_API_BASE_URL?.trim();
  if (!envUrl) {
    throw new Error('Missing EXPO_PUBLIC_RORK_API_BASE_URL for native TRPC requests.');
  }

  return `${envUrl.replace(/\/+$/, '')}/api/trpc`;
}

const primaryTrpcUrl = getTrpcUrl();

if (__DEV__) {
  console.log('[trpc] URL:', primaryTrpcUrl);
}

export const trpcClient = trpc.createClient({
  links: [
    httpLink({
      url: primaryTrpcUrl,
      transformer: superjson,
      async fetch(url, options) {
        const response = await globalThis.fetch(url, options);

        if (__DEV__) {
          const contentType = response.headers.get('content-type') ?? 'unknown';
          if (!contentType.toLowerCase().includes('application/json')) {
            const finalUrl =
              typeof url === 'string' ? url : url instanceof URL ? url.toString() : url.url;
            console.error('[trpc] TRPC route mismatch likely: received non-JSON response.', {
              url: finalUrl,
              contentType,
            });
            throw new Error(
              `TRPC route mismatch likely: received non-JSON response. URL: ${finalUrl} Content-Type: ${contentType}`,
            );
          }
        }

        return response;
      },
    }),
  ],
});
