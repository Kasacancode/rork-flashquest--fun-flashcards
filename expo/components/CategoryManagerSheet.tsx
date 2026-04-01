import { Check, PenLine, Plus, Trash2, X } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import {
  CUSTOM_DECK_CATEGORY_LABEL,
  canDeleteDeckCategory,
  canRenameDeckCategory,
  isPresetDeckCategory,
  sanitizeDeckCategory,
} from '@/constants/deckCategories';
import { useFlashQuest } from '@/context/FlashQuestContext';
import { useTheme } from '@/context/ThemeContext';

interface CategoryManagerSheetProps {
  visible: boolean;
  onClose: () => void;
  selectedCategory?: string;
  onSelectCategory?: (category: string) => void;
  title?: string;
  testID?: string;
}

export default function CategoryManagerSheet({
  visible,
  onClose,
  selectedCategory,
  onSelectCategory,
  title = 'Manage Categories',
  testID = 'category-manager-sheet',
}: CategoryManagerSheetProps) {
  const { theme, isDark } = useTheme();
  const {
    decks,
    deckCategories,
    createDeckCategory,
    renameDeckCategory,
    deleteDeckCategory,
  } = useFlashQuest();
  const [newCategoryInput, setNewCategoryInput] = useState<string>('');
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState<string>('');
  const [activeOperation, setActiveOperation] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) {
      setNewCategoryInput('');
      setEditingCategory(null);
      setEditingValue('');
      setActiveOperation(null);
    }
  }, [visible]);

  const categoryCounts = useMemo(() => {
    return decks.reduce<Record<string, number>>((accumulator, deck) => {
      const category = sanitizeDeckCategory(deck.category);
      if (!category) {
        return accumulator;
      }

      accumulator[category] = (accumulator[category] ?? 0) + 1;
      return accumulator;
    }, {});
  }, [decks]);

  const closeEditor = useCallback(() => {
    setEditingCategory(null);
    setEditingValue('');
  }, []);

  const handleSelectCategory = useCallback((category: string) => {
    if (!onSelectCategory) {
      return;
    }

    onSelectCategory(category);
    onClose();
  }, [onClose, onSelectCategory]);

  const handleCreateCategory = useCallback(async () => {
    const normalizedCategory = sanitizeDeckCategory(newCategoryInput);
    if (!normalizedCategory) {
      Alert.alert('Category required', 'Enter a category name to add it.');
      return;
    }

    setActiveOperation('create');
    try {
      const createdCategory = await createDeckCategory(normalizedCategory);
      setNewCategoryInput('');
      if (onSelectCategory) {
        onSelectCategory(createdCategory);
      }
    } catch (error) {
      Alert.alert('Could not add category', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setActiveOperation(null);
    }
  }, [createDeckCategory, newCategoryInput, onSelectCategory]);

  const handleStartRename = useCallback((category: string) => {
    setEditingCategory(category);
    setEditingValue(category);
  }, []);

  const handleSaveRename = useCallback(async () => {
    if (!editingCategory) {
      return;
    }

    const normalizedCategory = sanitizeDeckCategory(editingValue);
    if (!normalizedCategory) {
      Alert.alert('Category required', 'Enter a category name to save the change.');
      return;
    }

    setActiveOperation(`rename:${editingCategory}`);
    try {
      const renamedCategory = await renameDeckCategory(editingCategory, normalizedCategory);
      closeEditor();
      if (selectedCategory?.trim().toLowerCase() === editingCategory.trim().toLowerCase() && onSelectCategory) {
        onSelectCategory(renamedCategory);
      }
    } catch (error) {
      Alert.alert('Could not rename category', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setActiveOperation(null);
    }
  }, [closeEditor, editingCategory, editingValue, onSelectCategory, renameDeckCategory, selectedCategory]);

  const handleDeleteCategory = useCallback((category: string) => {
    const deckCount = categoryCounts[category] ?? 0;
    Alert.alert(
      'Delete category',
      deckCount > 0
        ? `Delete "${category}"? ${deckCount} deck${deckCount === 1 ? '' : 's'} will move to Other.`
        : `Delete "${category}"?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setActiveOperation(`delete:${category}`);
              try {
                await deleteDeckCategory(category);
                if (selectedCategory?.trim().toLowerCase() === category.trim().toLowerCase() && onSelectCategory) {
                  onSelectCategory(CUSTOM_DECK_CATEGORY_LABEL);
                }
                if (editingCategory?.trim().toLowerCase() === category.trim().toLowerCase()) {
                  closeEditor();
                }
              } catch (error) {
                Alert.alert('Could not delete category', error instanceof Error ? error.message : 'Please try again.');
              } finally {
                setActiveOperation(null);
              }
            })();
          },
        },
      ],
    );
  }, [categoryCounts, closeEditor, deleteDeckCategory, editingCategory, onSelectCategory, selectedCategory]);

  const sheetBackgroundColor = isDark ? 'rgba(9, 15, 28, 0.98)' : 'rgba(255, 255, 255, 0.98)';
  const cardBackgroundColor = isDark ? 'rgba(15, 23, 42, 0.72)' : 'rgba(243, 246, 255, 0.85)';
  const subtleBorderColor = isDark ? 'rgba(148, 163, 184, 0.14)' : 'rgba(99, 102, 241, 0.12)';
  const mutedTextColor = theme.textSecondary;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={[styles.overlay, { backgroundColor: theme.modalOverlay }]} onPress={onClose}>
        <Pressable
          style={[styles.sheet, { backgroundColor: sheetBackgroundColor, borderColor: subtleBorderColor }]}
          onPress={(event) => event.stopPropagation()}
          testID={testID}
        >
          <View style={[styles.handle, { backgroundColor: theme.sheetHandle }]} />
          <View style={styles.headerRow}>
            <View style={styles.titleWrap}>
              <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
              <Text style={[styles.subtitle, { color: mutedTextColor }]}>Add, rename, or delete built-in and custom categories.</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={[styles.closeButton, { borderColor: subtleBorderColor }]} activeOpacity={0.8} testID={`${testID}-close`}>
              <X color={theme.textSecondary} size={18} strokeWidth={2.4} />
            </TouchableOpacity>
          </View>

          <View style={[styles.addCard, { backgroundColor: cardBackgroundColor, borderColor: subtleBorderColor }]}>
            <Text style={[styles.sectionLabel, { color: theme.text }]}>New category</Text>
            <View style={styles.addRow}>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: isDark ? 'rgba(2, 6, 23, 0.46)' : '#fff',
                    color: theme.text,
                    borderColor: subtleBorderColor,
                  },
                ]}
                value={newCategoryInput}
                onChangeText={setNewCategoryInput}
                placeholder="e.g. Geography"
                placeholderTextColor={theme.textTertiary}
                autoCapitalize="words"
                autoCorrect={false}
                maxLength={30}
                returnKeyType="done"
                onSubmitEditing={() => {
                  void handleCreateCategory();
                }}
                testID={`${testID}-new-input`}
              />
              <TouchableOpacity
                style={[styles.primaryButton, { backgroundColor: theme.primary, opacity: activeOperation === 'create' ? 0.72 : 1 }]}
                onPress={() => {
                  void handleCreateCategory();
                }}
                activeOpacity={0.85}
                disabled={activeOperation === 'create'}
                testID={`${testID}-add-button`}
              >
                <Plus color="#fff" size={18} strokeWidth={2.5} />
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView
            style={styles.listScroll}
            contentContainerStyle={styles.listWrap}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {deckCategories.map((category) => {
              const isSelected = sanitizeDeckCategory(selectedCategory) === category;
              const isEditing = editingCategory === category;
              const isRenameable = canRenameDeckCategory(category);
              const isDeletable = canDeleteDeckCategory(category);
              const isBuiltInPreset = isPresetDeckCategory(category);
              const deckCount = categoryCounts[category] ?? 0;
              const isBusy = activeOperation === `rename:${category}` || activeOperation === `delete:${category}`;

              return (
                <View
                  key={category}
                  style={[
                    styles.categoryCard,
                    {
                      backgroundColor: cardBackgroundColor,
                      borderColor: isSelected ? theme.primary : subtleBorderColor,
                    },
                  ]}
                >
                  {isEditing ? (
                    <>
                      <TextInput
                        style={[
                          styles.input,
                          {
                            backgroundColor: isDark ? 'rgba(2, 6, 23, 0.46)' : '#fff',
                            color: theme.text,
                            borderColor: subtleBorderColor,
                          },
                        ]}
                        value={editingValue}
                        onChangeText={setEditingValue}
                        autoCapitalize="words"
                        autoCorrect={false}
                        maxLength={30}
                        returnKeyType="done"
                        onSubmitEditing={() => {
                          void handleSaveRename();
                        }}
                        testID={`${testID}-rename-input-${category.replace(/\s+/g, '-').toLowerCase()}`}
                      />
                      <View style={styles.editRow}>
                        <TouchableOpacity
                          style={[styles.secondaryButton, { borderColor: subtleBorderColor }]}
                          onPress={closeEditor}
                          activeOpacity={0.8}
                          testID={`${testID}-rename-cancel-${category.replace(/\s+/g, '-').toLowerCase()}`}
                        >
                          <Text style={[styles.secondaryButtonText, { color: theme.textSecondary }]}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.secondaryFilledButton, { backgroundColor: theme.primary, opacity: isBusy ? 0.72 : 1 }]}
                          onPress={() => {
                            void handleSaveRename();
                          }}
                          activeOpacity={0.85}
                          disabled={isBusy}
                          testID={`${testID}-rename-save-${category.replace(/\s+/g, '-').toLowerCase()}`}
                        >
                          <Check color="#fff" size={16} strokeWidth={2.6} />
                          <Text style={styles.secondaryFilledButtonText}>Save</Text>
                        </TouchableOpacity>
                      </View>
                    </>
                  ) : (
                    <>
                      <TouchableOpacity
                        style={styles.categoryMain}
                        onPress={() => handleSelectCategory(category)}
                        activeOpacity={onSelectCategory ? 0.8 : 1}
                        disabled={!onSelectCategory}
                        testID={`${testID}-select-${category.replace(/\s+/g, '-').toLowerCase()}`}
                      >
                        <View style={styles.categoryInfo}>
                          <View style={styles.categoryTitleRow}>
                            <Text style={[styles.categoryName, { color: theme.text }]}>{category}</Text>
                            {isSelected ? (
                              <View style={[styles.selectedBadge, { backgroundColor: theme.primary }]}> 
                                <Text style={styles.selectedBadgeText}>Selected</Text>
                              </View>
                            ) : null}
                          </View>
                          <Text style={[styles.categoryMeta, { color: mutedTextColor }]}>
                            {deckCount} deck{deckCount === 1 ? '' : 's'}
                            {isBuiltInPreset ? ' · Built-in' : ''}
                          </Text>
                        </View>
                      </TouchableOpacity>

                      <View style={styles.actionRow}>
                        {isRenameable ? (
                          <TouchableOpacity
                            style={[styles.iconButton, { borderColor: subtleBorderColor }]}
                            onPress={() => handleStartRename(category)}
                            activeOpacity={0.8}
                            testID={`${testID}-edit-${category.replace(/\s+/g, '-').toLowerCase()}`}
                          >
                            <PenLine color={theme.textSecondary} size={16} strokeWidth={2.2} />
                          </TouchableOpacity>
                        ) : null}
                        {isDeletable ? (
                          <TouchableOpacity
                            style={[styles.iconButton, { borderColor: subtleBorderColor, opacity: isBusy ? 0.6 : 1 }]}
                            onPress={() => handleDeleteCategory(category)}
                            activeOpacity={0.8}
                            disabled={isBusy}
                            testID={`${testID}-delete-${category.replace(/\s+/g, '-').toLowerCase()}`}
                          >
                            <Trash2 color={theme.error} size={16} strokeWidth={2.2} />
                          </TouchableOpacity>
                        ) : null}
                      </View>
                    </>
                  )}
                </View>
              );
            })}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: 16,
  },
  sheet: {
    borderRadius: 28,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 24,
    maxHeight: '82%',
    gap: 16,
  },
  handle: {
    width: 46,
    height: 5,
    borderRadius: 999,
    alignSelf: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  titleWrap: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontSize: 22,
    fontWeight: '800' as const,
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500' as const,
  },
  closeButton: {
    width: 38,
    height: 38,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addCard: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 14,
    gap: 10,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '700' as const,
  },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  input: {
    flex: 1,
    minHeight: 48,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 15,
    fontWeight: '600' as const,
  },
  primaryButton: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listScroll: {
    flexGrow: 0,
  },
  listWrap: {
    gap: 10,
    paddingBottom: 4,
  },
  categoryCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 14,
    gap: 12,
  },
  categoryMain: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  categoryInfo: {
    flex: 1,
    gap: 4,
  },
  categoryTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryName: {
    fontSize: 16,
    fontWeight: '700' as const,
  },
  selectedBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  selectedBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700' as const,
  },
  categoryMeta: {
    fontSize: 12,
    fontWeight: '500' as const,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  secondaryButton: {
    minHeight: 40,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    fontSize: 13,
    fontWeight: '700' as const,
  },
  secondaryFilledButton: {
    minHeight: 40,
    borderRadius: 14,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  secondaryFilledButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700' as const,
  },
});
