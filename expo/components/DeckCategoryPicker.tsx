import { PenLine } from 'lucide-react-native';
import React from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
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
  onSelectCategory,
  onPressManageCategories,
  theme,
  testIDPrefix = 'deck-category',
}: DeckCategoryPickerProps) {
  const displayedCategories = categories.filter((category) => category !== CUSTOM_DECK_CATEGORY_LABEL);

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
      </ScrollView>

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
