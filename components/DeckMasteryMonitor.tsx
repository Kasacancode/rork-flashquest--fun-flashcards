import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import DeckMasteryToast from '@/components/DeckMasteryToast';
import { useFlashQuest } from '@/context/FlashQuestContext';
import { usePerformance } from '@/context/PerformanceContext';
import { enqueueToastRunner, releaseToastRunner } from '@/utils/toastQueue';

const MASTERED_DECKS_KEY = 'flashquest_mastered_decks';

export default function DeckMasteryMonitor() {
  const { decks, isLoading: isDecksLoading } = useFlashQuest();
  const { performance, isLoading: isPerfLoading } = usePerformance();
  const [toast, setToast] = useState<{ name: string } | null>(null);
  const previouslyMasteredRef = useRef<Set<string>>(new Set());
  const hasLoadedRef = useRef(false);

  const isReady = !isDecksLoading && !isPerfLoading;

  const masteredDeckIds = useMemo(() => {
    const ids: string[] = [];
    for (const deck of decks) {
      if (deck.flashcards.length === 0) continue;
      const allMastered = deck.flashcards.every((card) => {
        const stats = performance.cardStatsById[card.id];
        return stats && stats.streakCorrect >= 5;
      });
      if (allMastered) ids.push(deck.id);
    }
    return ids;
  }, [decks, performance.cardStatsById]);

  const handleDismiss = useCallback(() => {
    setToast(null);
    releaseToastRunner();
  }, []);

  useEffect(() => {
    AsyncStorage.getItem(MASTERED_DECKS_KEY)
      .then((stored) => {
        if (stored) {
          try {
            previouslyMasteredRef.current = new Set(JSON.parse(stored) as string[]);
          } catch {
          }
        }
        hasLoadedRef.current = true;
      })
      .catch(() => {
        hasLoadedRef.current = true;
      });
  }, []);

  useEffect(() => {
    if (!isReady || !hasLoadedRef.current) return;

    const currentSet = new Set(masteredDeckIds);
    const previousSet = previouslyMasteredRef.current;
    const newlyMastered = masteredDeckIds.filter((id) => !previousSet.has(id));

    previouslyMasteredRef.current = currentSet;
    AsyncStorage.setItem(MASTERED_DECKS_KEY, JSON.stringify([...currentSet])).catch(() => {});

    if (newlyMastered.length === 0) return;

    for (const deckId of newlyMastered) {
      const deck = decks.find((item) => item.id === deckId);
      if (!deck) continue;
      enqueueToastRunner(() => {
        setToast({ name: deck.name });
      });
    }
  }, [masteredDeckIds, isReady, decks]);

  return <DeckMasteryToast deck={toast} onDismiss={handleDismiss} />;
}
