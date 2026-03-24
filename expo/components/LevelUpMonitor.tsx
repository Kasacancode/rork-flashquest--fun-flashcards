import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import LevelUpToast from '@/components/LevelUpToast';
import { useFlashQuest } from '@/context/FlashQuestContext';
import { computeLevel, getLevelEntry } from '@/utils/levels';
import { enqueueToastRunner, releaseToastRunner } from '@/utils/toastQueue';

const LAST_LEVEL_KEY = 'flashquest_last_known_level';

export default function LevelUpMonitor() {
  const { stats, isLoading } = useFlashQuest();
  const [toast, setToast] = useState<{ level: number; title: string } | null>(null);
  const prevLevelRef = useRef<number>(1);
  const hasLoadedRef = useRef(false);
  const currentLevel = useMemo(() => computeLevel(stats.totalScore), [stats.totalScore]);
  const handleDismiss = useCallback(() => {
    setToast(null);
    releaseToastRunner();
  }, []);

  useEffect(() => {
    AsyncStorage.getItem(LAST_LEVEL_KEY)
      .then((stored) => {
        if (stored) {
          const parsed = parseInt(stored, 10);
          if (!Number.isNaN(parsed)) {
            prevLevelRef.current = parsed;
          }
        }
        hasLoadedRef.current = true;
      })
      .catch(() => {
        hasLoadedRef.current = true;
      });
  }, []);

  useEffect(() => {
    if (isLoading || !hasLoadedRef.current) {
      return;
    }

    if (currentLevel > prevLevelRef.current) {
      const entry = getLevelEntry(currentLevel);
      enqueueToastRunner(() => {
        setToast({ level: currentLevel, title: entry.title });
      });
    }

    prevLevelRef.current = currentLevel;
    AsyncStorage.setItem(LAST_LEVEL_KEY, String(currentLevel)).catch(() => {});
  }, [currentLevel, isLoading]);

  if (isLoading && !toast) {
    return null;
  }

  return <LevelUpToast levelUp={toast} onDismiss={handleDismiss} />;
}
