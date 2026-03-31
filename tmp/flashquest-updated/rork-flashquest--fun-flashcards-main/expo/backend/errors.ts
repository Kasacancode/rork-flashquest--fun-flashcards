import { TRPCError } from '@trpc/server';

export type BackendTRPCCode = 'BAD_REQUEST' | 'FORBIDDEN' | 'NOT_FOUND' | 'CONFLICT' | 'PRECONDITION_FAILED' | 'INTERNAL_SERVER_ERROR';

export const REDIS_CONFIG_ERROR_CODE = 'REDIS_CONFIG_MISSING' as const;
export const REDIS_CONFIG_USER_MESSAGE = 'Service temporarily unavailable.' as const;
export const REDIS_CONFIG_DEVELOPER_MESSAGE = 'Missing UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN' as const;

export type BackendErrorCode = string;

type BackendAppErrorOptions<Code extends string = string> = {
  code: Code;
  userMessage: string;
  developerMessage?: string;
  exposeDeveloperMessage?: boolean;
  trpcCode?: BackendTRPCCode;
  meta?: Record<string, unknown>;
};

type RedisConfigErrorOptions = {
  userMessage?: string;
  developerMessage?: string;
  exposeDeveloperMessage?: boolean;
};

export function isProductionEnvironment(): boolean {
  return process.env.NODE_ENV === 'production';
}

export class BackendAppError<Code extends string = string> extends Error {
  readonly code: Code;
  readonly userMessage: string;
  readonly developerMessage: string;
  readonly trpcCode: BackendTRPCCode;
  readonly meta?: Record<string, unknown>;

  constructor(options: BackendAppErrorOptions<Code>) {
    const userMessage = options.userMessage;
    const developerMessage = options.developerMessage ?? options.userMessage;
    const exposeDeveloperMessage = options.exposeDeveloperMessage ?? !isProductionEnvironment();

    super(exposeDeveloperMessage ? developerMessage : userMessage);

    this.name = 'BackendAppError';
    this.code = options.code;
    this.userMessage = userMessage;
    this.developerMessage = developerMessage;
    this.trpcCode = options.trpcCode ?? 'BAD_REQUEST';
    this.meta = options.meta;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class RedisConfigError extends BackendAppError<typeof REDIS_CONFIG_ERROR_CODE> {
  constructor(options?: RedisConfigErrorOptions) {
    const userMessage = options?.userMessage ?? REDIS_CONFIG_USER_MESSAGE;
    const developerMessage = options?.developerMessage ?? REDIS_CONFIG_DEVELOPER_MESSAGE;
    const exposeDeveloperMessage = options?.exposeDeveloperMessage ?? !isProductionEnvironment();

    super({
      code: REDIS_CONFIG_ERROR_CODE,
      userMessage,
      developerMessage,
      exposeDeveloperMessage,
      trpcCode: 'INTERNAL_SERVER_ERROR',
    });

    this.name = 'RedisConfigError';
  }
}

export function createRedisConfigError(developerMessage?: string): RedisConfigError {
  return new RedisConfigError({ developerMessage });
}

export function isBackendAppError(error: unknown): error is BackendAppError {
  return error instanceof BackendAppError
    || (typeof error === 'object'
      && error !== null
      && 'code' in error
      && 'userMessage' in error
      && typeof (error as { code?: unknown }).code === 'string'
      && typeof (error as { userMessage?: unknown }).userMessage === 'string');
}

export function isRedisConfigError(error: unknown): error is RedisConfigError {
  return error instanceof RedisConfigError
    || (typeof error === 'object'
      && error !== null
      && 'code' in error
      && (error as { code?: unknown }).code === REDIS_CONFIG_ERROR_CODE);
}

export function toTRPCError(error: unknown): TRPCError {
  if (error instanceof TRPCError) {
    return error;
  }

  if (isBackendAppError(error)) {
    return new TRPCError({
      code: error.trpcCode,
      message: error.message,
      cause: error,
    });
  }

  return new TRPCError({
    code: 'INTERNAL_SERVER_ERROR',
    message: !isProductionEnvironment() && error instanceof Error && error.message
      ? error.message
      : 'Request failed.',
    cause: error instanceof Error ? error : undefined,
  });
}
