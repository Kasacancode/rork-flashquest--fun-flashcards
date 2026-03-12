import { createTRPCRouter } from "./create-context";
import { analyticsRouter } from "./routes/analytics";
import { arenaRouter } from "./routes/arena";

export const appRouter = createTRPCRouter({
  arena: arenaRouter,
  analytics: analyticsRouter,
});

export type AppRouter = typeof appRouter;
