import { createTRPCRouter } from "./create-context.js";
import { arenaRouter } from "./routes/arena.js";

export const appRouter = createTRPCRouter({
  arena: arenaRouter,
});

export type AppRouter = typeof appRouter;
