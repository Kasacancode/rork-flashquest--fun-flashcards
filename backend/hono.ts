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

// Rork infrastructure mounts this Hono app at /api externally.
// So the external URL is /api/trpc/... but Hono matches on /trpc/... (stripped).
// c.req.raw.url still contains the full external path (/api/trpc/...).
// fetchRequestHandler needs the Request pathname to match its `endpoint` value,
// so we rewrite the Request URL to use c.req.path (the Hono-matched path).
const endpoint = '/trpc';

const handleTrpcRequest = async (c: { req: { raw: Request; path: string } }) => {
  const originalRequest = c.req.raw;
  const honoPath = c.req.path;

  // Rork mounts this Hono app at /api externally.
  // c.req.path is the Hono-matched path (e.g. /trpc/arena.initRoom)
  // but c.req.raw.url still has the full external path (e.g. /api/trpc/arena.initRoom).
  // fetchRequestHandler needs the Request pathname to match `endpoint`,
  // so we rewrite the URL to use the Hono-matched path.
  const rewrittenUrl = new URL(originalRequest.url);
  const originalPathname = rewrittenUrl.pathname;
  rewrittenUrl.pathname = honoPath;

  console.log('[Backend] tRPC route rewrite', {
    method: originalRequest.method,
    originalPathname,
    honoPath,
    rewrittenPathname: rewrittenUrl.pathname,
    endpoint,
  });

  // Use the original Request as init to properly transfer method, headers, body, and signal
  // without running into ReadableStream duplex issues.
  const rewrittenRequest = new Request(rewrittenUrl.toString(), originalRequest);

  return fetchRequestHandler({
    endpoint,
    req: rewrittenRequest,
    router: appRouter,
    createContext,
    onError({ path, error, type }) {
      console.error('[Backend] tRPC error', {
        type,
        path: path ?? 'unknown',
        message: error.message,
      });
    },
  });
};

app.all('/trpc', (c) => handleTrpcRequest(c));
app.all('/trpc/*', (c) => handleTrpcRequest(c));

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
