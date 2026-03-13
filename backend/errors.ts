import { TRPCError } from '@trpc/server';

export const REDIS_CONFIG_ERROR_CODE = 'REDIS_CONFIG_MISSING' as const;
export const REDIS_CONFIG_USER_MESSAGE = 'Service temporarily unavailable.' as const;
export const REDIS_CONFIG_DEVELOPER_MESSAGE = 'Missing UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN' as const;

export type BackendErrorCode = typeof REDIS_CONFIG_ERROR_CODE;

type RedisConfigErrorOptions = {
  userMessage?: string;
  developerMessage?: string;
  exposeDeveloperMessage?: boolean;
};

export function isProductionEnvironment(): boolean {
  return process.env.NODE_ENV === 'production';
}

export class RedisConfigError extends Error {
  readonly code: BackendErrorCode;
  readonly userMessage: string;
  readonly developerMessage: string;

  constructor(options?: RedisConfigErrorOptions) {
    const userMessage = options?.userMessage ?? REDIS_CONFIG_USER_MESSAGE;
    const developerMessage = options?.developerMessage ?? REDIS_CONFIG_DEVELOPER_MESSAGE;
    const exposeDeveloperMessage = options?.exposeDeveloperMessage ?? !isProductionEnvironment();

    super(exposeDeveloperMessage ? developerMessage : userMessage);

    this.name = 'RedisConfigError';
    this.code = REDIS_CONFIG_ERROR_CODE;
    this.userMessage = userMessage;
    this.developerMessage = developerMessage;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export function createRedisConfigError(developerMessage?: string): RedisConfigError {
  return new RedisConfigError({ developerMessage });
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

  if (isRedisConfigError(error)) {
    return new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
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
