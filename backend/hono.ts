import { trpcServer } from '@hono/trpc-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';

import { appRouter } from './trpc/app-router';
import { createContext as createTrpcContext } from './trpc/create-context';

const app = new Hono();
const HEALTH_RESPONSE = {
  status: 'ok',
  service: 'flashquest-battle',
  v: 6,
} as const;

const trpcOptions = {
  router: appRouter,
  createContext: (opts: Parameters<typeof createTrpcContext>[0]) => createTrpcContext(opts),
  onError({ path, error, type }: { path?: string; error: Error; type: string }) {
    console.error('[Backend] tRPC error', {
      type,
      path: path ?? 'unknown',
      message: error.message,
    });
  },
};

const trpcMiddleware = trpcServer({
  ...trpcOptions,
  endpoint: '/trpc',
});

const apiTrpcMiddleware = trpcServer({
  ...trpcOptions,
  endpoint: '/api/trpc',
});

app.use(
  '*',
  cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'x-trpc-source'],
  }),
);

app.get('/', (c) => {
  return c.json({
    ...HEALTH_RESPONSE,
    message: 'FlashQuest Multiplayer API',
  });
});

app.get('/health', (c) => {
  return c.json({
    ...HEALTH_RESPONSE,
    timestamp: Date.now(),
  });
});

app.get('/trpc-debug', (c) => {
  return c.json({
    status: 'ok',
    honoPath: c.req.path,
    rawUrl: c.req.raw.url,
    rawPathname: new URL(c.req.raw.url).pathname,
  });
});

app.get('/api/trpc-debug', (c) => {
  return c.json({
    status: 'ok',
    honoPath: c.req.path,
    rawUrl: c.req.raw.url,
    rawPathname: new URL(c.req.raw.url).pathname,
  });
});

app.use('/trpc/*', trpcMiddleware);
app.use('/api/trpc/*', apiTrpcMiddleware);

export default app;
