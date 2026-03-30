import type { Href } from 'expo-router';

export type DebugToolingFeature = 'flashcard_inspector' | 'internal_diagnostics';
export type DebugToolingRoute = 'flashcard-debug';
export type DebugToolingMode = 'development' | 'internal' | 'production';

const PRODUCTION_FALLBACK_ROUTE = '/' as const satisfies Href;

function readBooleanFlag(value: string | undefined): boolean {
  return value?.trim().toLowerCase() === 'true';
}

const isDevelopmentRuntime = typeof __DEV__ !== 'undefined' ? __DEV__ : process.env.NODE_ENV !== 'production';
const isExplicitInternalDebugToolsEnabled = readBooleanFlag(process.env.EXPO_PUBLIC_ENABLE_INTERNAL_DEBUG_TOOLS);

const debugToolingMode: DebugToolingMode = isDevelopmentRuntime
  ? 'development'
  : isExplicitInternalDebugToolsEnabled
    ? 'internal'
    : 'production';

const debugToolingEnabled = debugToolingMode !== 'production';

export function getDebugToolingMode(): DebugToolingMode {
  return debugToolingMode;
}

export function isDebugToolingEnabled(): boolean {
  return debugToolingEnabled;
}

export function isInternalDiagnosticsEnabled(): boolean {
  return canAccessDebugFeature('internal_diagnostics');
}

export function canAccessDebugFeature(feature: DebugToolingFeature): boolean {
  switch (feature) {
    case 'flashcard_inspector':
    case 'internal_diagnostics':
      return debugToolingEnabled;
    default:
      return false;
  }
}

export function canAccessDebugRoute(route: DebugToolingRoute): boolean {
  switch (route) {
    case 'flashcard-debug':
      return canAccessDebugFeature('flashcard_inspector');
    default:
      return false;
  }
}

export function getDebugToolingFallbackHref(): Href {
  return PRODUCTION_FALLBACK_ROUTE;
}
