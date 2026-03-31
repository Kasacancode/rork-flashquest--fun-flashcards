import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import AchievementToast from '@/components/AchievementToast';
import { useArena } from '@/context/ArenaContext';
import { useFlashQuest } from '@/context/FlashQuestContext';
import { usePerformance } from '@/context/PerformanceContext';
import { computeAchievements } from '@/utils/achievements';
import { logger } from '@/utils/logger';
import { normalizeStringArray, safeParseJsonOrNull } from '@/utils/safeJson';
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
  const [hasLoadedStoredAchievements, setHasLoadedStoredAchievements] = useState<boolean>(false);
  const previouslyCompletedRef = useRef<Set<string>>(new Set());
  const hasInitializedSnapshotRef = useRef<boolean>(false);

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
    totalArenaBattles: stats.totalArenaBattles ?? leaderboard.length,
    bestQuestStreak: performance.bestQuestStreak,
    customDeckCount,
    totalCardsOwned,
  }), [customDeckCount, leaderboard.length, performance.bestQuestStreak, stats, totalCardsOwned]);

  const handleDismiss = useCallback(() => {
    setToastAchievement(null);
    releaseToastRunner();
  }, []);

  useEffect(() => {
    let isMounted = true;

    AsyncStorage.getItem(COMPLETED_ACHIEVEMENTS_KEY)
      .then((stored) => {
        if (stored) {
          const ids = safeParseJsonOrNull<string[]>({
            raw: stored,
            label: 'completed achievements',
            normalize: normalizeStringArray,
          });

          if (ids) {
            previouslyCompletedRef.current = new Set(ids);
            logger.log('[AchievementMonitor] Loaded persisted achievements:', ids.length);
          } else {
            logger.warn('[AchievementMonitor] Failed to parse persisted achievements.');
          }
        }

        if (isMounted) {
          setHasLoadedStoredAchievements(true);
        }
      })
      .catch((error) => {
        logger.warn('[AchievementMonitor] Failed to load persisted achievements:', error);
        if (isMounted) {
          setHasLoadedStoredAchievements(true);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!isReady || !hasLoadedStoredAchievements) {
      return;
    }

    const currentlyCompleted = achievements.filter((achievement) => achievement.progress >= achievement.total);
    const currentIds = new Set(currentlyCompleted.map((achievement) => achievement.id));
    const previousIds = previouslyCompletedRef.current;
    const nextKnownIds = new Set<string>([...previousIds, ...currentIds]);

    if (!hasInitializedSnapshotRef.current) {
      hasInitializedSnapshotRef.current = true;
      previouslyCompletedRef.current = nextKnownIds;
      logger.log('[AchievementMonitor] Hydrated baseline snapshot:', {
        storedCount: previousIds.size,
        completedCount: currentIds.size,
        mergedCount: nextKnownIds.size,
      });
      AsyncStorage.setItem(COMPLETED_ACHIEVEMENTS_KEY, JSON.stringify([...nextKnownIds])).catch((error) => {
        logger.warn('[AchievementMonitor] Failed to persist baseline achievements:', error);
      });
      return;
    }

    const newlyCompleted = currentlyCompleted.filter((achievement) => !previousIds.has(achievement.id));
    previouslyCompletedRef.current = nextKnownIds;

    AsyncStorage.setItem(COMPLETED_ACHIEVEMENTS_KEY, JSON.stringify([...nextKnownIds])).catch((error) => {
      logger.warn('[AchievementMonitor] Failed to persist achievements:', error);
    });

    if (newlyCompleted.length === 0) {
      return;
    }

    logger.log('[AchievementMonitor] Queueing newly completed achievements:', newlyCompleted.map((achievement) => achievement.id));

    newlyCompleted.forEach((achievement) => {
      enqueueToastRunner(() => {
        setToastAchievement({
          name: achievement.name,
          xp: achievement.xp,
          color: achievement.color,
        });
      });
    });
  }, [achievements, hasLoadedStoredAchievements, isReady]);

  if (!isReady && !toastAchievement) {
    return null;
  }

  return <AchievementToast achievement={toastAchievement} onDismiss={handleDismiss} />;
}
