import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { Hono } from 'hono';
import { cors } from 'hono/cors';

import { appRouter } from './trpc/app-router';
import { createContext } from './trpc/create-context';

const app = new Hono();
const HEALTH_RESPONSE = {
  status: 'ok',
  service: 'flashquest-battle',
  v: 6,
} as const;

app.use(
  '*',
  cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'x-trpc-source'],
  }),
);

// The Rork platform mounts this Hono app at /api.
// Depending on the runtime, Hono may or may not see the /api prefix in the path.
// To handle both cases reliably, we:
//   1. Register routes for BOTH /trpc/* and /api/trpc/*
//   2. Dynamically detect the correct endpoint from the raw request URL
//   3. Pass c.req.raw directly — no URL rewriting needed
const handleTrpcRequest = async (c: { req: { raw: Request; path: string } }) => {
  const rawUrl = new URL(c.req.raw.url);
  const pathname = rawUrl.pathname;

  // Detect which prefix the raw URL actually has, and use that as the endpoint.
  // fetchRequestHandler strips `endpoint` from the pathname to get the procedure name.
  // e.g. pathname="/api/trpc/arena.initRoom" with endpoint="/api/trpc" → procedure="arena.initRoom"
  // e.g. pathname="/trpc/arena.initRoom" with endpoint="/trpc" → procedure="arena.initRoom"
  const actualEndpoint = pathname.startsWith('/api/trpc') ? '/api/trpc' : '/trpc';

  console.log('[Backend] tRPC request', {
    method: c.req.raw.method,
    rawPathname: pathname,
    honoPath: c.req.path,
    detectedEndpoint: actualEndpoint,
  });

  return fetchRequestHandler({
    endpoint: actualEndpoint,
    req: c.req.raw,
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

// Handle both possible path shapes — covers whether the platform strips /api or not
app.all('/trpc', (c) => handleTrpcRequest(c));
app.all('/trpc/*', (c) => handleTrpcRequest(c));
app.all('/api/trpc', (c) => handleTrpcRequest(c));
app.all('/api/trpc/*', (c) => handleTrpcRequest(c));

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

// Debug route — hit /api/trpc-debug or /trpc-debug to verify routing
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

export default app;
