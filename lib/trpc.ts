import { httpLink } from "@trpc/client";
import { createTRPCReact } from "@trpc/react-query";
import superjson from "superjson";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const trpc: any = (createTRPCReact as any)();

const normalizeBaseUrl = (value: string): string => value.replace(/\/+$/, "");

const buildFallbackBaseUrl = (): string => {
  const projectId = process.env.EXPO_PUBLIC_PROJECT_ID;
  if (projectId) {
    return `https://dev-${projectId}.rorktest.dev`;
  }

  return "";
};

const getBaseUrl = (): string => {
  try {
    const envUrl = process.env.EXPO_PUBLIC_RORK_API_BASE_URL;
    if (envUrl) {
      return normalizeBaseUrl(envUrl);
    }

    const fallbackUrl = buildFallbackBaseUrl();
    if (fallbackUrl) {
      console.warn("[trpc] EXPO_PUBLIC_RORK_API_BASE_URL missing, using project fallback:", fallbackUrl);
      return fallbackUrl;
    }

    console.warn("[trpc] Could not resolve API base URL, falling back to relative /api/trpc");
    return "";
  } catch (error) {
    console.warn("[trpc] Failed to resolve API base URL:", error);
    return "";
  }
};

const trpcUrl = (() => {
  const baseUrl = getBaseUrl();
  return baseUrl ? `${baseUrl}/api/trpc` : "/api/trpc";
})();

let trpcClientInstance: any = null;

try {
  console.log("[trpc] Creating client for", trpcUrl);
  trpcClientInstance = trpc.createClient({
    links: [
      httpLink({
        url: trpcUrl,
        transformer: superjson,
      }),
    ],
  });
} catch (error) {
  console.error("[trpc] Failed to create client:", error);
  trpcClientInstance = trpc.createClient({
    links: [
      httpLink({
        url: "/api/trpc",
        transformer: superjson,
      }),
    ],
  });
}

export const trpcClient = trpcClientInstance;
