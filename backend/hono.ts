import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { Hono } from 'hono';
import { cors } from 'hono/cors';

import { appRouter } from './trpc/app-router';
import { createContext } from './trpc/create-context';

const app = new Hono();
const TRPC_ENDPOINTS = ['/trpc', '/api/trpc'] as const;
const HEALTH_RESPONSE = {
  status: 'ok',
  service: 'flashquest-battle',
  v: 4,
} as const;

app.use(
  '*',
  cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'x-trpc-source'],
  }),
);

const handleTrpcRequest = async (request: Request, endpoint: (typeof TRPC_ENDPOINTS)[number]) => {
  const pathname = new URL(request.url).pathname;

  console.log('[Backend] FlashQuest battle request', {
    method: request.method,
    pathname,
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

for (const endpoint of TRPC_ENDPOINTS) {
  app.all(endpoint, (c) => handleTrpcRequest(c.req.raw, endpoint));
  app.all(`${endpoint}/*`, (c) => handleTrpcRequest(c.req.raw, endpoint));
}

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
