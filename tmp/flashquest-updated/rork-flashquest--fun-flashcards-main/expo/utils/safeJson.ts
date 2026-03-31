import { logger } from '@/utils/logger';

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function getFirstRouteParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return typeof value[0] === 'string' ? value[0] : undefined;
  }

  return typeof value === 'string' ? value : undefined;
}

export function toFiniteNumber(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || Number.isNaN(value) || !Number.isFinite(value)) {
    return fallback;
  }

  return value;
}

export function toRoundedPositiveInteger(value: unknown, fallback: number = 0): number {
  return Math.max(0, Math.round(toFiniteNumber(value, fallback)));
}

export function safeParseJson<T>(options: {
  raw: string | null | undefined;
  label: string;
  fallback: T;
  normalize?: (value: unknown) => T | null;
}): T {
  const { raw, label, fallback, normalize } = options;

  if (!raw || !raw.trim()) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(raw) as unknown;

    if (!normalize) {
      return parsed as T;
    }

    const normalized = normalize(parsed);
    if (normalized !== null) {
      return normalized;
    }

    logger.warn(`[safeJson] Invalid ${label} payload shape.`);
    return fallback;
  } catch (error) {
    logger.warn(`[safeJson] Failed to parse ${label}:`, error);
    return fallback;
  }
}

export function safeParseJsonOrNull<T>(options: {
  raw: string | null | undefined;
  label: string;
  normalize?: (value: unknown) => T | null;
}): T | null {
  const { raw, label, normalize } = options;

  if (!raw || !raw.trim()) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as unknown;

    if (!normalize) {
      return parsed as T;
    }

    return normalize(parsed);
  } catch (error) {
    logger.warn(`[safeJson] Failed to parse ${label}:`, error);
    return null;
  }
}

export function normalizeStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  return value.filter((entry): entry is string => typeof entry === 'string');
}
