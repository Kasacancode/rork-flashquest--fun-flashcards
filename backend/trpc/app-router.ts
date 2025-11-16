import { createTRPCRouter } from "./create-context";
import hiRoute from "./routes/example/hi/route";
import fromGoogleDocRoute from "./routes/flashcards/from-google-doc/route";
import fromImageRoute from "./routes/flashcards/from-image/route";

export const appRouter = createTRPCRouter({
  example: createTRPCRouter({
    hi: hiRoute,
  }),
  flashcards: createTRPCRouter({
    fromImage: fromImageRoute,
    fromGoogleDoc: fromGoogleDocRoute,
  }),
});

export type AppRouter = typeof appRouter;
