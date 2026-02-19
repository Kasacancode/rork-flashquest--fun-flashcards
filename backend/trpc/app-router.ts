import { createTRPCRouter } from "./create-context";
import { arenaRouter } from "./routes/arena";

export const appRouter = createTRPCRouter({
  arena: arenaRouter,
});

export type AppRouter = typeof appRouter;
