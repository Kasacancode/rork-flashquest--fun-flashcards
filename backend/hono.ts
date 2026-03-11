import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { Hono } from 'hono';
import { cors } from 'hono/cors';

import { appRouter } from './trpc/app-router';
import { createContext } from './trpc/create-context';

const app = new Hono();
const HEALTH_RESPONSE = {
  status: 'ok',
  service: 'flashquest-battle',
  v: 5,
} as const;

app.use(
  '*',
  cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'x-trpc-source'],
  }),
);

const handleTrpcRequest = async (request: Request) => {
  const url = new URL(request.url);
  // Rork infrastructure mounts this Hono app at /api externally.
  // Hono receives requests with /api already stripped, so the path seen here is /trpc/...
  // The fetchRequestHandler endpoint must match the path Hono sees, NOT the external path.
  const endpoint = '/trpc';

  console.log('[Backend] FlashQuest battle request', {
    method: request.method,
    fullUrl: url.toString(),
    pathname: url.pathname,
    endpoint,
  });

  return fetchRequestHandler({
    endpoint,
    req: request,
    router: appRouter,
    createContext,
    onError({ path, error, type }) {
      console.error('[Backend] tRPC error', {
        type,
        path: path ?? 'unknown',
        message: error.message,
        stack: error.stack,
      });
    },
  });
};

app.all('/trpc', (c) => handleTrpcRequest(c.req.raw));
app.all('/trpc/*', (c) => handleTrpcRequest(c.req.raw));

app.get('/', (c) => {
  return c.json({
    ...HEALTH_RESPONSE,
    message: 'FlashQuest Multiplayer API',
    mountedAt: '/api',
  });
});

app.get('/health', (c) => {
  return c.json({
    ...HEALTH_RESPONSE,
    timestamp: Date.now(),
  });
});

export default app;
