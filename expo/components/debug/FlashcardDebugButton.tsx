import { useRouter } from 'expo-router';
import { Bug } from 'lucide-react-native';
import React, { useCallback } from 'react';
import { StyleSheet, Text, TouchableOpacity, ViewStyle, type StyleProp } from 'react-native';

import type { FlashcardOption } from '@/types/flashcard';
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

  const handlePress = useCallback(() => {
    router.push(flashcardDebugHref({
      deckId: deckId ?? undefined,
      cardId: cardId ?? undefined,
      surface,
      options,
    }));
  }, [cardId, deckId, options, router, surface]);

  if (!__DEV__ || !cardId) {
    return null;
  }

  return (
    <TouchableOpacity
      style={[styles.button, style]}
      onPress={handlePress}
      activeOpacity={0.82}
      testID={testID ?? 'flashcard-debug-button'}
    >
      <Bug color="#4f46e5" size={14} strokeWidth={2.4} />
      <Text style={styles.label}>{label}</Text>
    </TouchableOpacity>
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
