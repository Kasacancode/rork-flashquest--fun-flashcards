import React, { memo, useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { useTheme } from '@/context/ThemeContext';

interface PublishDeckFields {
  name: string;
  description: string;
  category: string;
}

interface PublishDeckSheetProps {
  visible: boolean;
  onClose: () => void;
  onPublish: (fields: PublishDeckFields) => void | Promise<void>;
  isPublishing: boolean;
  isUpdate: boolean;
  cardCount: number;
  initialName: string;
  initialDescription: string;
  initialCategory: string;
}

const CATEGORY_OPTIONS = ['Science', 'Math', 'Languages', 'History', 'Geography', 'Arts', 'Technology', 'Business', 'General'] as const;

function PublishDeckSheet({
  visible,
  onClose,
  onPublish,
  isPublishing,
  isUpdate,
  cardCount,
  initialName,
  initialDescription,
  initialCategory,
}: PublishDeckSheetProps) {
  const { theme, isDark } = useTheme();
  const [publishFields, setPublishFields] = useState<PublishDeckFields>({
    name: initialName,
    description: initialDescription,
    category: initialCategory,
  });

  useEffect(() => {
    if (!visible) {
      return;
    }

    setPublishFields({
      name: initialName,
      description: initialDescription,
      category: initialCategory,
    });
  }, [initialCategory, initialDescription, initialName, visible]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.publishBackdrop}>
        <Pressable style={StyleSheet.absoluteFillObject} onPress={onClose} />
        <Pressable
          style={[styles.publishSheet, { backgroundColor: isDark ? 'rgba(10,17,34,0.98)' : theme.cardBackground }]}
          onPress={() => {}}
        >
          <View style={[styles.publishHandle, { backgroundColor: theme.sheetHandle }]} />
          <Text style={[styles.publishTitle, { color: theme.text }]}>{isUpdate ? 'Update Published Deck' : 'Publish to Community'}</Text>
          <Text style={[styles.publishSubtitle, { color: theme.textSecondary }]}> 
            {cardCount} cards will be shared with the FlashQuest community. Your username will appear as the author.
          </Text>

          <Text style={[styles.publishLabel, { color: theme.textSecondary }]}>Deck Name</Text>
          <TextInput
            style={[
              styles.publishInput,
              {
                color: theme.text,
                backgroundColor: isDark ? 'rgba(148,163,184,0.08)' : 'rgba(0,0,0,0.03)',
                borderColor: isDark ? 'rgba(148,163,184,0.15)' : 'rgba(0,0,0,0.08)',
              },
            ]}
            value={publishFields.name}
            onChangeText={(text) => setPublishFields((prev) => ({ ...prev, name: text }))}
            placeholder="e.g., AP Biology Chapter 5"
            placeholderTextColor={theme.textTertiary}
            maxLength={80}
            testID="publish-deck-name-input"
          />

          <Text style={[styles.publishLabel, { color: theme.textSecondary }]}>Description</Text>
          <TextInput
            style={[
              styles.publishInput,
              styles.publishTextArea,
              {
                color: theme.text,
                backgroundColor: isDark ? 'rgba(148,163,184,0.08)' : 'rgba(0,0,0,0.03)',
                borderColor: isDark ? 'rgba(148,163,184,0.15)' : 'rgba(0,0,0,0.08)',
              },
            ]}
            value={publishFields.description}
            onChangeText={(text) => setPublishFields((prev) => ({ ...prev, description: text }))}
            placeholder="Brief description of what this deck covers..."
            placeholderTextColor={theme.textTertiary}
            multiline
            numberOfLines={3}
            maxLength={300}
            textAlignVertical="top"
            testID="publish-deck-description-input"
          />

          <Text style={[styles.publishLabel, { color: theme.textSecondary }]}>Category</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.publishCategoryScroll}>
            {CATEGORY_OPTIONS.map((category) => (
              <TouchableOpacity
                key={category}
                style={[
                  styles.publishCategoryPill,
                  {
                    backgroundColor: publishFields.category === category
                      ? (isDark ? 'rgba(99,102,241,0.2)' : 'rgba(99,102,241,0.12)')
                      : (isDark ? 'rgba(148,163,184,0.08)' : 'rgba(0,0,0,0.03)'),
                    borderColor: publishFields.category === category
                      ? (isDark ? 'rgba(99,102,241,0.4)' : 'rgba(99,102,241,0.3)')
                      : (isDark ? 'rgba(148,163,184,0.15)' : 'rgba(0,0,0,0.08)'),
                  },
                ]}
                onPress={() => setPublishFields((prev) => ({ ...prev, category }))}
                activeOpacity={0.8}
                testID={`publish-category-${category.toLowerCase()}`}
              >
                <Text style={[styles.publishCategoryText, { color: publishFields.category === category ? theme.primary : theme.textSecondary }]}>{category}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <TouchableOpacity
            style={[styles.publishButton, { backgroundColor: theme.primary, opacity: isPublishing ? 0.6 : 1 }]}
            onPress={() => {
              void onPublish(publishFields);
            }}
            disabled={isPublishing}
            activeOpacity={0.8}
            testID="publish-confirm-button"
          >
            <Text style={styles.publishButtonText}>{isPublishing ? 'Publishing...' : isUpdate ? 'Update Deck' : 'Publish'}</Text>
          </TouchableOpacity>
        </Pressable>
      </View>
    </Modal>
  );
}

export default memo(PublishDeckSheet);

const styles = StyleSheet.create({
  publishBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  publishSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  publishHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  publishTitle: {
    fontSize: 20,
    fontWeight: '800' as const,
    marginBottom: 6,
  },
  publishSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 20,
  },
  publishLabel: {
    fontSize: 12,
    fontWeight: '700' as const,
    letterSpacing: 0.5,
    textTransform: 'uppercase' as const,
    marginBottom: 6,
    marginTop: 12,
  },
  publishInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontWeight: '600' as const,
  },
  publishTextArea: {
    minHeight: 72,
    paddingTop: 12,
  },
  publishCategoryScroll: {
    marginVertical: 8,
  },
  publishCategoryPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    marginRight: 8,
  },
  publishCategoryText: {
    fontSize: 13,
    fontWeight: '600' as const,
  },
  publishButton: {
    alignItems: 'center',
    paddingVertical: 16,
    borderRadius: 14,
    marginTop: 20,
  },
  publishButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800' as const,
  },
});
