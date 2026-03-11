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

// Rork infrastructure mounts this Hono app at /api externally.
// Hono strips the /api prefix, so Hono routes match on /trpc/*.
// However, c.req.raw.url still contains the full external path (e.g. /api/trpc/arena.initRoom).
// fetchRequestHandler requires the Request pathname to start with `endpoint` (/trpc),
// so we must rewrite the Request URL to use c.req.path (the Hono-matched internal path)
// before passing it to tRPC. Without this rewrite, tRPC cannot parse the procedure path
// and returns a non-JSON error response.
const handleTrpcRequest = async (c: { req: { raw: Request; path: string; url: string; method: string } }) => {
  const originalRequest = c.req.raw;
  const honoPath = c.req.path;

  const rewrittenUrl = new URL(originalRequest.url);
  const originalPathname = rewrittenUrl.pathname;
  rewrittenUrl.pathname = honoPath;

  console.log('[Backend] tRPC route rewrite', {
    method: originalRequest.method,
    originalRawUrl: originalRequest.url,
    originalPathname,
    honoPath,
    rewrittenPathname: rewrittenUrl.pathname,
    endpoint,
  });

  // Rebuild the Request explicitly to avoid body/duplex issues across runtimes.
  // Some runtimes fail when using `new Request(url, existingRequest)` for POST with body.
  const init: RequestInit = {
    method: originalRequest.method,
    headers: originalRequest.headers,
  };

  // Only attach body for non-GET/HEAD requests to avoid "body not allowed" errors
  if (originalRequest.method !== 'GET' && originalRequest.method !== 'HEAD') {
    init.body = originalRequest.body;
    // @ts-ignore — duplex is required in some runtimes for streaming body
    init.duplex = 'half';
  }

  const rewrittenRequest = new Request(rewrittenUrl.toString(), init);

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
