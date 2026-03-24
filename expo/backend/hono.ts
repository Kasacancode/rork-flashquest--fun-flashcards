import { trpcServer } from "@hono/trpc-server";
import { Hono } from "hono";
import { cors } from "hono/cors";

import { appRouter } from "./trpc/app-router";
import { createContext } from "./trpc/create-context";

const app = new Hono();
const TRPC_INTERNAL_PATH = "/trpc/*" as const;
const TRPC_PUBLIC_ENDPOINT = "/api/trpc" as const;
const TRPC_SERVER_CONFIG = Object.freeze({
  endpoint: TRPC_PUBLIC_ENDPOINT,
  router: appRouter,
  createContext,
});

app.use("*", cors());

/*
 * ⚠️ Do not modify this routing unless you fully understand the runtime mount behavior.
 *
 * Architecture note:
 * - The hosting runtime mounts this Hono app behind /api.
 * - That means the public tRPC endpoint exposed to clients is /api/trpc.
 * - Inside this Hono app, the tRPC handler itself must still be mounted at /trpc/*.
 * - The apparent mismatch between the internal Hono mount (/trpc/*) and the external
 *   tRPC endpoint (/api/trpc) is intentional and expected in this environment.
 * - The tRPC server must keep endpoint: "/api/trpc" so transport links resolve against
 *   the public runtime path, even though Hono registers the handler on /trpc/* internally.
 * - Changing either side casually can break the entire tRPC transport.
 */
app.use(TRPC_INTERNAL_PATH, trpcServer(TRPC_SERVER_CONFIG));

app.get("/", (c) => {
  return c.json({ status: "ok", message: "FlashQuest Multiplayer API", v: 2 });
});

export default app;
