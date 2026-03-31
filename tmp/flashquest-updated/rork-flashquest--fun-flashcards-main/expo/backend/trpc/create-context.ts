import { initTRPC } from '@trpc/server';
import type { FetchCreateContextFnOptions } from '@trpc/server/adapters/fetch';
import superjson from 'superjson';

import { isBackendAppError, toTRPCError } from '../errors';

export const createContext = async (opts: FetchCreateContextFnOptions) => {
  return {
    req: opts.req,
  };
};

export type Context = Awaited<ReturnType<typeof createContext>>;

const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    const backendCode = isBackendAppError(error.cause) ? error.cause.code : undefined;
    const backendMeta = isBackendAppError(error.cause) ? error.cause.meta : undefined;

    return {
      ...shape,
      data: {
        ...shape.data,
        backendCode,
        backendMeta,
      },
    };
  },
});

const errorHandlingMiddleware = t.middleware(async ({ next, path, type }) => {
  try {
    return await next();
  } catch (error) {
    console.error('[tRPC] Procedure failed:', { path, type, error });
    throw toTRPCError(error);
  }
});

export const createTRPCRouter = t.router;
export const publicProcedure = t.procedure.use(errorHandlingMiddleware);
