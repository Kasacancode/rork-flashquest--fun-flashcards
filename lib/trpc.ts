import { httpLink } from "@trpc/client";
import { createTRPCReact } from "@trpc/react-query";
import { Platform } from "react-native";
import superjson from "superjson";

import type { AppRouter } from "@/backend/trpc/app-router";

export const trpc = createTRPCReact<AppRouter>();

const PROJECT_ID_FALLBACK = "7xpegtpthikn3ezzq9zt0";

const normalizeBaseUrl = (value: string): string => value.replace(/\/+$/, "");

const isHttpUrl = (value: string): boolean => /^https?:\/\//i.test(value);

const getWindowOrigin = (): string | null => {
  if (Platform.OS !== "web") {
    return null;
  }

  if (typeof window === "undefined" || !window.location?.origin) {
    return null;
  }

  return normalizeBaseUrl(window.location.origin);
};

const buildProjectBaseUrl = (): string => {
  const projectId = process.env.EXPO_PUBLIC_PROJECT_ID ?? PROJECT_ID_FALLBACK;
  return `https://dev-${projectId}.rorktest.dev`;
};

const getCandidateBaseUrls = (): string[] => {
  const candidates: string[] = [];
  const windowOrigin = getWindowOrigin();
  const envUrl = process.env.EXPO_PUBLIC_RORK_API_BASE_URL;
  const projectBaseUrl = buildProjectBaseUrl();

  if (windowOrigin && isHttpUrl(windowOrigin)) {
    candidates.push(windowOrigin);
  }

  if (envUrl && isHttpUrl(envUrl)) {
    candidates.push(normalizeBaseUrl(envUrl));
  }

  if (projectBaseUrl) {
    candidates.push(projectBaseUrl);
  }

  return Array.from(new Set(candidates.map(normalizeBaseUrl).filter(Boolean)));
};

const getCandidateTrpcUrls = (): string[] => {
  const candidateBaseUrls = getCandidateBaseUrls();
  const absoluteUrls = candidateBaseUrls.map((baseUrl) => `${baseUrl}/api/trpc`);

  if (Platform.OS === "web") {
    return Array.from(new Set(["/api/trpc", ...absoluteUrls]));
  }

  return absoluteUrls;
};

const trpcUrls = getCandidateTrpcUrls();
const primaryTrpcUrl = trpcUrls[0] ?? "/api/trpc";

const resilientFetch: typeof fetch = async (input, init) => {
  const requestedUrl = typeof input === "string"
    ? input
    : input instanceof URL
      ? input.toString()
      : input.url;

  const orderedUrls = Array.from(
    new Set([requestedUrl, ...trpcUrls.filter((candidateUrl) => candidateUrl !== requestedUrl)]),
  );

  let lastError: unknown = null;

  for (let index = 0; index < orderedUrls.length; index += 1) {
    const candidateUrl = orderedUrls[index];
    const hasFallback = index < orderedUrls.length - 1;

    try {
      console.log("[trpc] Requesting", candidateUrl);
      const response = await globalThis.fetch(candidateUrl, init);

      if ((response.status === 404 || response.status >= 500) && hasFallback) {
        console.warn("[trpc] Retrying with fallback after response", response.status, "from", candidateUrl);
        continue;
      }

      if (!response.ok) {
        console.warn("[trpc] Non-success response", response.status, "from", candidateUrl);
      }

      return response;
    } catch (error) {
      lastError = error;
      console.warn("[trpc] Request failed for", candidateUrl, error);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Failed to reach the FlashQuest battle service");
};

console.log("[trpc] Candidate URLs:", trpcUrls);
console.log("[trpc] Primary URL:", primaryTrpcUrl);

export const trpcClient = trpc.createClient({
  links: [
    httpLink({
      url: primaryTrpcUrl,
      transformer: superjson,
      fetch: resilientFetch,
    }),
  ],
});
