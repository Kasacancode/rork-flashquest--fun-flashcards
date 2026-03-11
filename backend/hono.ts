import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { Hono } from "hono";
import type { Context } from "hono";
import { cors } from "hono/cors";

import { appRouter } from "./trpc/app-router.js";
import { createContext } from "./trpc/create-context.js";

const app = new Hono();

app.use(
  "*",
  cors({
    origin: "*",
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization", "x-trpc-source"],
  }),
);

const handleTrpcRequest = async (c: Context) => {
  const pathname = new URL(c.req.raw.url).pathname;
  const endpoint = pathname.includes("/api/trpc") ? "/api/trpc" : "/trpc";

  console.log("[Backend] FlashQuest battle request", {
    method: c.req.raw.method,
    pathname,
    endpoint,
  });

  return fetchRequestHandler({
    endpoint,
    req: c.req.raw,
    router: appRouter,
    createContext,
    onError({ path, error, type }) {
      console.error("[Backend] tRPC error", {
        type,
        path: path ?? "unknown",
        message: error.message,
        stack: error.stack,
      });
    },
  });
};

app.all("/trpc/*", (c) => handleTrpcRequest(c));
app.all("/api/trpc/*", (c) => handleTrpcRequest(c));

app.get("/", (c) => {
  return c.json({ status: "ok", message: "FlashQuest Multiplayer API", v: 3 });
});

app.get("/health", (c) => {
  return c.json({ status: "ok", service: "flashquest-battle", v: 3, timestamp: Date.now() });
});

export default app;
