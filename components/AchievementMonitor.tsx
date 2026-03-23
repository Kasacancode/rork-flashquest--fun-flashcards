import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import AchievementToast from '@/components/AchievementToast';
import { useArena } from '@/context/ArenaContext';
import { useFlashQuest } from '@/context/FlashQuestContext';
import { usePerformance } from '@/context/PerformanceContext';
import { computeAchievements } from '@/utils/achievements';
import { enqueueToastRunner, releaseToastRunner } from '@/utils/toastQueue';

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
  const previouslyCompletedRef = useRef<Set<string> | null>(null);

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
    if (!isReady) {
      return;
    }

    const currentlyCompleted = achievements.filter((achievement) => achievement.progress >= achievement.total);

    if (previouslyCompletedRef.current === null) {
      previouslyCompletedRef.current = new Set(currentlyCompleted.map((achievement) => achievement.id));
      return;
    }

    const previouslyCompleted = previouslyCompletedRef.current;
    const newlyCompleted = currentlyCompleted.filter((achievement) => !previouslyCompleted.has(achievement.id));
    previouslyCompletedRef.current = new Set(currentlyCompleted.map((achievement) => achievement.id));

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
