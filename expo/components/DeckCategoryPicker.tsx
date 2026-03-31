import { PenLine } from 'lucide-react-native';
import React from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import type { Theme } from '@/constants/colors';
import { CUSTOM_DECK_CATEGORY_LABEL } from '@/constants/deckCategories';

interface DeckCategoryPickerProps {
  label?: string;
  labelColor?: string;
  categories: readonly string[];
  selectedCategory: string;
  showCustomCategory: boolean;
  customCategoryInput: string;
  onSelectCategory: (category: string) => void;
  onPressCustom: () => void;
  onChangeCustomCategoryInput: (value: string) => void;
  onSubmitCustomCategory: () => void;
  onPressManageCategories?: () => void;
  theme: Theme;
  isDark: boolean;
  testIDPrefix?: string;
}

export default function DeckCategoryPicker({
  label = 'Category',
  labelColor,
  categories,
  selectedCategory,
  showCustomCategory,
  customCategoryInput,
  onSelectCategory,
  onPressCustom,
  onChangeCustomCategoryInput,
  onSubmitCustomCategory,
  onPressManageCategories,
  theme,
  isDark,
  testIDPrefix = 'deck-category',
}: DeckCategoryPickerProps) {
  const inputBackgroundColor = isDark ? 'rgba(15, 23, 42, 0.68)' : theme.cardBackground;
  const displayedCategories = categories.filter((category) => category !== CUSTOM_DECK_CATEGORY_LABEL);
  const normalizedSelectedCategory = selectedCategory.trim();
  const isCustomTriggerActive = showCustomCategory
    || normalizedSelectedCategory === CUSTOM_DECK_CATEGORY_LABEL
    || (!!normalizedSelectedCategory && !displayedCategories.includes(normalizedSelectedCategory));

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: labelColor ?? theme.white }]}>{label}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.pillsContent}
        style={styles.pillsScroll}
      >
        {displayedCategories.map((category) => {
          const isActive = selectedCategory === category;
          return (
            <TouchableOpacity
              key={category}
              style={[
                styles.pill,
                {
                  backgroundColor: isActive ? theme.primary : theme.cardBackground,
                  borderColor: isActive ? theme.primary : theme.border,
                },
              ]}
              onPress={() => onSelectCategory(category)}
              activeOpacity={0.82}
              testID={`${testIDPrefix}-${category.replace(/\s+/g, '-').toLowerCase()}`}
            >
              <Text style={[styles.pillText, { color: isActive ? '#fff' : theme.textSecondary }]}>
                {category}
              </Text>
            </TouchableOpacity>
          );
        })}
        <TouchableOpacity
          style={[
            styles.pill,
            {
              backgroundColor: isCustomTriggerActive ? theme.primary : theme.cardBackground,
              borderColor: isCustomTriggerActive ? theme.primary : theme.border,
            },
          ]}
          onPress={onPressCustom}
          activeOpacity={0.82}
          testID={`${testIDPrefix}-custom-trigger`}
        >
          <Text style={[styles.pillText, { color: isCustomTriggerActive ? '#fff' : theme.textSecondary }]}>
            {CUSTOM_DECK_CATEGORY_LABEL}
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {showCustomCategory ? (
        <TextInput
          style={[
            styles.customInput,
            {
              backgroundColor: inputBackgroundColor,
              color: theme.text,
              borderColor: theme.border,
            },
          ]}
          value={customCategoryInput}
          onChangeText={onChangeCustomCategoryInput}
          onSubmitEditing={onSubmitCustomCategory}
          onBlur={onSubmitCustomCategory}
          placeholder="Enter category"
          placeholderTextColor={theme.textTertiary}
          maxLength={30}
          returnKeyType="done"
          autoCapitalize="words"
          autoCorrect={false}
          testID={`${testIDPrefix}-custom-input`}
        />
      ) : null}

      {onPressManageCategories ? (
        <TouchableOpacity
          style={styles.manageButton}
          onPress={onPressManageCategories}
          activeOpacity={0.8}
          testID={`${testIDPrefix}-manage-button`}
        >
          <PenLine color={theme.primary} size={15} strokeWidth={2.3} />
          <Text style={[styles.manageButtonText, { color: theme.primary }]}>Manage categories</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  label: {
    fontSize: 16,
    fontWeight: '700' as const,
  },
  pillsScroll: {
    marginHorizontal: -2,
  },
  pillsContent: {
    gap: 8,
    paddingHorizontal: 2,
  },
  pill: {
    height: 34,
    paddingHorizontal: 14,
    borderRadius: 17,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pillText: {
    fontSize: 13,
    fontWeight: '600' as const,
  },
  customInput: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontWeight: '500' as const,
  },
  manageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 8,
    paddingVertical: 4,
  },
  manageButtonText: {
    fontSize: 13,
    fontWeight: '700' as const,
  },
});
