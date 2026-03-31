export function getOptionalRenderKey(value: string | number | null | undefined, prefix: string, index: number): string {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return `${prefix}-${value}`;
  }

  const normalizedValue = typeof value === 'string' ? value.trim() : '';
  if (normalizedValue.length > 0) {
    return `${prefix}-${normalizedValue}`;
  }

  return `${prefix}-${index}`;
}

export function getIndexedRenderKey(value: string | number | null | undefined, prefix: string, index: number): string {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return `${prefix}-${value}-${index}`;
  }

  const normalizedValue = typeof value === 'string' ? value.trim() : '';
  if (normalizedValue.length > 0) {
    return `${prefix}-${normalizedValue}-${index}`;
  }

  return `${prefix}-${index}`;
}
