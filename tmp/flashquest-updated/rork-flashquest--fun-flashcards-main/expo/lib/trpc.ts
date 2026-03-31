import { httpLink } from '@trpc/client';
import { createTRPCReact } from '@trpc/react-query';
import { Platform } from 'react-native';
import superjson from 'superjson';

import type { AppRouter } from '@/backend/trpc/app-router';
import { logger } from '@/utils/logger';

export const trpc = createTRPCReact<AppRouter>();

function trimTrailingSlash(value: string): string {
  return value.endsWith('/') ? value.slice(0, -1) : value;
}

function normalizeBaseUrl(value: string | null | undefined): string | null {
  const trimmedValue = value?.trim();
  if (!trimmedValue) {
    return null;
  }

  return trimTrailingSlash(trimmedValue);
}

function getProjectBaseUrlCandidates(): string[] {
  return ['https://flashquest.net'];
}

function getWindowBaseUrlCandidate(): string | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined' || !window.location?.origin) {
    return null;
  }

  return trimTrailingSlash(window.location.origin);
}

function getBaseUrlCandidates(): string[] {
  const candidates = [
    normalizeBaseUrl(process.env.EXPO_PUBLIC_RORK_API_BASE_URL),
    ...getProjectBaseUrlCandidates().map((candidate) => normalizeBaseUrl(candidate)),
    normalizeBaseUrl(getWindowBaseUrlCandidate()),
  ].filter((candidate): candidate is string => Boolean(candidate));

  const uniqueCandidates: string[] = [];

  for (const candidate of candidates) {
    if (!uniqueCandidates.includes(candidate)) {
      uniqueCandidates.push(candidate);
    }
  }

  if (__DEV__) {
    logger.debug('[trpc] Base URL candidates:', uniqueCandidates);
  }

  return uniqueCandidates.length > 0 ? uniqueCandidates : [''];
}

function getRequestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') {
    return input;
  }

  if (input instanceof URL) {
    return input.toString();
  }

  if (typeof Request !== 'undefined' && input instanceof Request) {
    return input.url;
  }

  return '[unknown-request]';
}

const trpcBaseUrlCandidates = getBaseUrlCandidates();
const trpcUrlCandidates = trpcBaseUrlCandidates.map((baseUrl) => `${baseUrl}/api/trpc`);
const primaryTrpcUrl = trpcUrlCandidates[0] ?? '/api/trpc';

function shouldRetryWithAlternateUrl(input: RequestInfo | URL): boolean {
  return typeof input === 'string' || input instanceof URL;
}

function isPrimaryTrpcRequest(requestUrl: string): boolean {
  return requestUrl === primaryTrpcUrl
    || requestUrl.startsWith(`${primaryTrpcUrl}/`)
    || requestUrl.startsWith(`${primaryTrpcUrl}?`);
}

function buildRetryUrl(originalRequestUrl: string, nextBaseUrl: string): string {
  if (originalRequestUrl.startsWith(primaryTrpcUrl)) {
    return `${nextBaseUrl}${originalRequestUrl.slice(primaryTrpcUrl.length)}`;
  }

  if (originalRequestUrl.startsWith('/api/trpc')) {
    return `${nextBaseUrl}${originalRequestUrl}`;
  }

  return originalRequestUrl;
}

function isJsonResponse(response: Response): boolean {
  const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
  return contentType.includes('application/json');
}

if (__DEV__) {
  logger.debug('[trpc] Primary URL:', primaryTrpcUrl);
}

export const trpcClient = trpc.createClient({
  links: [
    httpLink({
      url: primaryTrpcUrl,
      transformer: superjson,
      fetch: async (input, init) => {
        const requestUrl = getRequestUrl(input);
        const canRetry = shouldRetryWithAlternateUrl(input) && isPrimaryTrpcRequest(requestUrl);
        const targetUrls = canRetry
          ? Array.from(new Set(trpcUrlCandidates.map((candidate) => buildRetryUrl(requestUrl, candidate))))
          : [requestUrl];
        let lastError: unknown = null;

        for (let index = 0; index < targetUrls.length; index += 1) {
          const targetUrl = targetUrls[index] ?? requestUrl;

          try {
            if (__DEV__) {
              logger.debug('[trpc] Request attempt', index + 1, '->', targetUrl);
            }

            const response = await globalThis.fetch(targetUrl, init);
            const shouldRetryUnexpectedResponse = canRetry && !isJsonResponse(response) && index < targetUrls.length - 1;

            if (__DEV__) {
              logger.debug('[trpc] Response:', response.status, response.url, response.headers.get('content-type'));
            }

            if (shouldRetryUnexpectedResponse) {
              if (__DEV__) {
                logger.warn('[trpc] Non-JSON response received, retrying next candidate:', {
                  attempt: index + 1,
                  targetUrl,
                  status: response.status,
                });
              }
              continue;
            }

            return response;
          } catch (error) {
            lastError = error;

            if (__DEV__) {
              logger.warn('[trpc] Request failed:', {
                attempt: index + 1,
                targetUrl,
                error,
              });
            }
          }
        }

        throw lastError instanceof Error ? lastError : new Error('Failed to reach tRPC endpoint');
      },
    }),
  ],
});
