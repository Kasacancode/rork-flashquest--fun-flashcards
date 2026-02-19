import { httpLink } from "@trpc/client";
import { createTRPCReact } from "@trpc/react-query";
import superjson from "superjson";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const trpc: any = (createTRPCReact as any)();

const getBaseUrl = () => {
  const url = process.env.EXPO_PUBLIC_RORK_API_BASE_URL;

  if (!url) {
    console.warn("[trpc] EXPO_PUBLIC_RORK_API_BASE_URL not set, multiplayer will not work");
    return "";
  }

  return url;
};

export const trpcClient = trpc.createClient({
  links: [
    httpLink({
      url: `${getBaseUrl()}/api/trpc`,
      transformer: superjson,
    }),
  ],
});
