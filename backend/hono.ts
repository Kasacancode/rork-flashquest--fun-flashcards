import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { Hono } from "hono";
import { cors } from "hono/cors";

import { appRouter } from "./trpc/app-router.js";
import { createContext } from "./trpc/create-context.js";

const app = new Hono();

app.use("*", cors());

app.all("/trpc/*", async (c) => {
  const pathname = new URL(c.req.raw.url).pathname;
  const endpoint = pathname.startsWith("/api/trpc") ? "/api/trpc" : "/trpc";

  console.log("[Backend] tRPC request", c.req.raw.method, pathname);

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
});

app.get("/", (c) => {
  return c.json({ status: "ok", message: "FlashQuest Multiplayer API", v: 2 });
});

export default app;
