import { httpBatchLink } from "@trpc/client";
import { createTRPCReact } from "@trpc/react-query";
import { Platform } from "react-native";
import superjson from "superjson";

import type { AppRouter } from "@/backend/trpc/app-router";

export const trpc = createTRPCReact<AppRouter>();

function trimTrailingSlash(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function getBaseUrl(): string {
  try {
    const envUrl = process.env.EXPO_PUBLIC_RORK_API_BASE_URL?.trim();
    if (envUrl) {
      const normalizedUrl = trimTrailingSlash(envUrl);
      console.log("[trpc] Using EXPO_PUBLIC_RORK_API_BASE_URL:", normalizedUrl);
      return normalizedUrl;
    }

    if (Platform.OS === "web" && typeof window !== "undefined" && window.location?.origin) {
      const webOrigin = trimTrailingSlash(window.location.origin);
      console.warn("[trpc] Falling back to window.location.origin:", webOrigin);
      return webOrigin;
    }

    console.warn("[trpc] EXPO_PUBLIC_RORK_API_BASE_URL is missing, falling back to relative API path");
    return "";
  } catch (error) {
    console.error("[trpc] Failed to resolve API base URL:", error);
    return "";
  }
}

const trpcUrl = `${getBaseUrl()}/api/trpc`;

console.log("[trpc] Initializing client with URL:", trpcUrl);

export const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: trpcUrl,
      transformer: superjson,
      fetch: async (input, init) => {
        const requestUrl = typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : input instanceof Request
              ? input.url
              : "[unknown-request]";
        console.log("[trpc] Request:", requestUrl);
        const response = await fetch(input, init);
        console.log("[trpc] Response:", response.status, response.url);
        return response;
      },
    }),
  ],
});

