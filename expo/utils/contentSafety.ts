const OFFENSIVE_PATTERNS: readonly RegExp[] = [
  /f+u+c+k+/i,
  /s+h+i+t+/i,
  /b+i+t+c+h+/i,
  /a+s+s+h+o+l+e+/i,
  /d+i+c+k+/i,
  /c+u+n+t+/i,
  /p+u+s+s+y+/i,
  /n+i+g+g+/i,
  /f+a+g+/i,
  /r+a+p+e+/i,
  /w+h+o+r+e+/i,
  /s+l+u+t+/i,
  /n+a+z+i+/i,
];

function normalizeForSafetyChecks(value: string): string {
  return value
    .toLowerCase()
    .replace(/[@4]/g, 'a')
    .replace(/[3]/g, 'e')
    .replace(/[1!|]/g, 'i')
    .replace(/[0]/g, 'o')
    .replace(/[5$]/g, 's')
    .replace(/[7]/g, 't')
    .replace(/[^a-z]/g, '');
}

export function containsOffensiveLanguage(value: string): boolean {
  const normalized = normalizeForSafetyChecks(value);
  return OFFENSIVE_PATTERNS.some((pattern) => pattern.test(normalized));
}

export function sanitizePublicLabel(value: string, options?: { maxLength?: number; fallback?: string }): string {
  const maxLength = options?.maxLength ?? 60;
  const fallback = options?.fallback ?? '';
  const trimmed = value.trim().replace(/\s+/g, ' ').slice(0, maxLength);

  if (!trimmed) {
    return fallback;
  }

  if (containsOffensiveLanguage(trimmed)) {
    return fallback;
  }

  return trimmed;
}
