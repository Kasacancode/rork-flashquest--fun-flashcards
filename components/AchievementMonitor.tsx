import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import AchievementToast from '@/components/AchievementToast';
import { useArena } from '@/context/ArenaContext';
import { useFlashQuest } from '@/context/FlashQuestContext';
import { usePerformance } from '@/context/PerformanceContext';
import { computeAchievements } from '@/utils/achievements';
import { enqueueToastRunner, releaseToastRunner } from '@/utils/toastQueue';

const COMPLETED_ACHIEVEMENTS_KEY = 'flashquest_completed_achievements';

type ToastAchievement = {
  name: string;
  xp: number;
  color: string;
};

export default function AchievementMonitor() {
  const { stats, decks, isLoading: isFlashQuestLoading } = useFlashQuest();
  const { leaderboard, isLoading: isArenaLoading } = useArena();
  const { performance, isLoading: isPerformanceLoading } = usePerformance();
  const [toastAchievement, setToastAchievement] = useState<ToastAchievement | null>(null);
  const previouslyCompletedRef = useRef<Set<string>>(new Set());
  const hasLoadedRef = useRef(false);

  const customDeckCount = useMemo(
    () => decks.filter((deck) => deck.isCustom).length,
    [decks]
  );
  const totalCardsOwned = useMemo(
    () => decks.flatMap((deck) => deck.flashcards).length,
    [decks]
  );
  const isReady = !isFlashQuestLoading && !isArenaLoading && !isPerformanceLoading;

  const achievements = useMemo(() => computeAchievements({
    stats,
    leaderboardCount: leaderboard.length,
    bestQuestStreak: performance.bestQuestStreak,
    customDeckCount,
    totalCardsOwned,
  }), [customDeckCount, leaderboard.length, performance.bestQuestStreak, stats, totalCardsOwned]);

  const handleDismiss = useCallback(() => {
    setToastAchievement(null);
    releaseToastRunner();
  }, []);

  useEffect(() => {
    AsyncStorage.getItem(COMPLETED_ACHIEVEMENTS_KEY)
      .then((stored) => {
        if (stored) {
          try {
            const ids = JSON.parse(stored) as string[];
            previouslyCompletedRef.current = new Set(ids);
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
    if (!isReady || !hasLoadedRef.current) {
      return;
    }

    const currentlyCompleted = achievements.filter((achievement) => achievement.progress >= achievement.total);
    const currentIds = new Set(currentlyCompleted.map((achievement) => achievement.id));
    const previousIds = previouslyCompletedRef.current;

    const newlyCompleted = currentlyCompleted.filter((achievement) => !previousIds.has(achievement.id));
    previouslyCompletedRef.current = currentIds;

    AsyncStorage.setItem(COMPLETED_ACHIEVEMENTS_KEY, JSON.stringify([...currentIds])).catch(() => {});

    if (newlyCompleted.length === 0) {
      return;
    }

    newlyCompleted.forEach((achievement) => {
      enqueueToastRunner(() => {
        setToastAchievement({
          name: achievement.name,
          xp: achievement.xp,
          color: achievement.color,
        });
      });
    });
  }, [achievements, isReady]);

  if (!isReady && !toastAchievement) {
    return null;
  }

  return <AchievementToast achievement={toastAchievement} onDismiss={handleDismiss} />;
}
