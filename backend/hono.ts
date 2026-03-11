import { trpcServer } from "@hono/trpc-server/dist/index.js";
import { Hono } from "hono/dist/index.js";
import { cors } from "hono/dist/middleware/cors/index.js";

import { appRouter } from "./trpc/app-router.js";
import { createContext } from "./trpc/create-context.js";

const app = new Hono();

app.use("*", cors());

app.use(
  "/trpc/*",
  trpcServer({
    endpoint: "/api/trpc",
    router: appRouter,
    createContext,
  }),
);

app.get("/", (c) => {
  return c.json({ status: "ok", message: "FlashQuest Multiplayer API", v: 2 });
});

export default app;
