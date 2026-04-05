import { useRouter } from 'expo-router';
import { Bug } from 'lucide-react-native';
import React, { useCallback } from 'react';
import { Pressable, StyleSheet, Text, ViewStyle, type GestureResponderEvent, type StyleProp } from 'react-native';

import type { FlashcardOption } from '@/types/flashcard';
import { canAccessDebugFeature } from '@/utils/debugTooling';
import { flashcardDebugHref } from '@/utils/routes';

interface FlashcardDebugButtonProps {
  deckId?: string | null;
  cardId?: string | null;
  surface: string;
  options?: FlashcardOption[];
  style?: StyleProp<ViewStyle>;
  label?: string;
  testID?: string;
}

export default function FlashcardDebugButton({
  deckId,
  cardId,
  surface,
  options,
  style,
  label = 'Inspect',
  testID,
}: FlashcardDebugButtonProps) {
  const router = useRouter();
  const canInspectFlashcards = canAccessDebugFeature('flashcard_inspector');

  const handlePress = useCallback((event?: GestureResponderEvent) => {
    event?.stopPropagation();

    if (!canInspectFlashcards) {
      return;
    }

    router.push(flashcardDebugHref({
      deckId: deckId ?? undefined,
      cardId: cardId ?? undefined,
      surface,
      options,
    }));
  }, [canInspectFlashcards, cardId, deckId, options, router, surface]);

  if (!canInspectFlashcards || !cardId) {
    return null;
  }

  return (
    <Pressable
      style={[styles.button, style]}
      onPress={handlePress}
      accessibilityRole="button"
      testID={testID ?? 'flashcard-debug-button'}
    >
      <Bug color="#4f46e5" size={14} strokeWidth={2.4} />
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderWidth: 1,
    borderColor: 'rgba(99,102,241,0.18)',
  },
  label: {
    fontSize: 12,
    fontWeight: '800',
    color: '#4338ca',
  },
});
