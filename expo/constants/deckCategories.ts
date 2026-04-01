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
type DeckCategoryInput = string | null | undefined;

function compareDeckCategories(left: string, right: string): number {
  const leftIsOther = left === CUSTOM_DECK_CATEGORY_LABEL;
  const rightIsOther = right === CUSTOM_DECK_CATEGORY_LABEL;

  if (leftIsOther !== rightIsOther) {
    return leftIsOther ? 1 : -1;
  }

  const leftIsAi = left === AI_DEFAULT_DECK_CATEGORY;
  const rightIsAi = right === AI_DEFAULT_DECK_CATEGORY;

  if (leftIsAi !== rightIsAi) {
    return leftIsAi ? 1 : -1;
  }

  return left.localeCompare(right);
}

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

export function buildManagedDeckCategoryList(categories: readonly DeckCategoryInput[]): string[] {
  const normalizedByKey = new Map<string, string>();

  categories.forEach((category) => {
    const normalizedCategory = sanitizeDeckCategory(category);
    if (!normalizedCategory) {
      return;
    }

    const key = normalizedCategory.toLowerCase();
    if (!normalizedByKey.has(key)) {
      normalizedByKey.set(key, normalizedCategory);
    }
  });

  if (!normalizedByKey.has(CUSTOM_DECK_CATEGORY_LABEL.toLowerCase())) {
    normalizedByKey.set(CUSTOM_DECK_CATEGORY_LABEL.toLowerCase(), CUSTOM_DECK_CATEGORY_LABEL);
  }

  return Array.from(normalizedByKey.values()).sort(compareDeckCategories);
}

export const DEFAULT_DECK_CATEGORY_LIBRARY = buildManagedDeckCategoryList([
  ...PRESET_DECK_CATEGORIES,
  CUSTOM_DECK_CATEGORY_LABEL,
]);

export function mergeDeckCategoryLibraries(...categoryCollections: readonly DeckCategoryInput[][]): string[] {
  return buildManagedDeckCategoryList(categoryCollections.flat());
}

export function buildDeckCategoryOptions(
  selectedCategory: string,
  baseCategories: readonly DeckCategoryInput[] = DEFAULT_DECK_CATEGORY_LIBRARY,
): string[] {
  return buildManagedDeckCategoryList([...baseCategories, selectedCategory]);
}

export function canRenameDeckCategory(category?: string | null): boolean {
  const normalizedCategory = sanitizeDeckCategory(category);
  return !!normalizedCategory
    && normalizedCategory !== CUSTOM_DECK_CATEGORY_LABEL
    && normalizedCategory !== AI_DEFAULT_DECK_CATEGORY
    && normalizedCategory !== ALL_DECK_CATEGORIES_LABEL;
}

export function canDeleteDeckCategory(category?: string | null): boolean {
  const normalizedCategory = sanitizeDeckCategory(category);
  return !!normalizedCategory
    && normalizedCategory !== CUSTOM_DECK_CATEGORY_LABEL
    && normalizedCategory !== AI_DEFAULT_DECK_CATEGORY
    && normalizedCategory !== ALL_DECK_CATEGORIES_LABEL;
}

export function getCustomCategoryDraft(category?: string | null): string {
  const normalizedCategory = sanitizeDeckCategory(category);
  if (!normalizedCategory || isPresetDeckCategory(normalizedCategory) || normalizedCategory === CUSTOM_DECK_CATEGORY_LABEL) {
    return '';
  }

  return normalizedCategory;
}
