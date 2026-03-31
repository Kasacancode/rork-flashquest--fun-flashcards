export const PRESET_DECK_CATEGORIES = [
  'Science',
  'History',
  'Languages',
  'Math',
  'Geography',
  'Technology',
  'Art',
  'Business',
] as const;

export const CUSTOM_DECK_CATEGORY_LABEL = 'Other';
export const MANUAL_DEFAULT_DECK_CATEGORY = CUSTOM_DECK_CATEGORY_LABEL;
export const AI_DEFAULT_DECK_CATEGORY = 'AI Generated';
export const ALL_DECK_CATEGORIES_LABEL = 'All';

const LEGACY_CUSTOM_CATEGORY_LABELS = new Set<string>(['custom', 'other', '+ custom']);

type DeckPresetCategory = (typeof PRESET_DECK_CATEGORIES)[number];

export function getPresetDeckCategory(category: string): DeckPresetCategory | null {
  const normalizedCategory = category.trim().toLowerCase();
  return PRESET_DECK_CATEGORIES.find((presetCategory) => presetCategory.toLowerCase() === normalizedCategory) ?? null;
}

export function isPresetDeckCategory(category: string): category is DeckPresetCategory {
  return getPresetDeckCategory(category) != null;
}

export function sanitizeDeckCategory(category?: string | null): string {
  const trimmedCategory = category?.trim() ?? '';
  if (!trimmedCategory) {
    return '';
  }

  const presetCategory = getPresetDeckCategory(trimmedCategory);
  if (presetCategory) {
    return presetCategory;
  }

  if (LEGACY_CUSTOM_CATEGORY_LABELS.has(trimmedCategory.toLowerCase())) {
    return CUSTOM_DECK_CATEGORY_LABEL;
  }

  return trimmedCategory;
}

export function normalizeDeckCategory(category?: string | null, fallback: string = MANUAL_DEFAULT_DECK_CATEGORY): string {
  return sanitizeDeckCategory(category) || fallback;
}

export function buildDeckCategoryOptions(selectedCategory: string): string[] {
  const normalizedSelectedCategory = sanitizeDeckCategory(selectedCategory);
  if (
    normalizedSelectedCategory
    && !isPresetDeckCategory(normalizedSelectedCategory)
    && normalizedSelectedCategory !== CUSTOM_DECK_CATEGORY_LABEL
  ) {
    return [...PRESET_DECK_CATEGORIES, normalizedSelectedCategory];
  }

  return [...PRESET_DECK_CATEGORIES];
}

export function getCustomCategoryDraft(category?: string | null): string {
  const normalizedCategory = sanitizeDeckCategory(category);
  if (!normalizedCategory || isPresetDeckCategory(normalizedCategory) || normalizedCategory === CUSTOM_DECK_CATEGORY_LABEL) {
    return '';
  }

  return normalizedCategory;
}
