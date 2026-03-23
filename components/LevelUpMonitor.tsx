import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';

import LevelUpToast from '@/components/LevelUpToast';
import { useFlashQuest } from '@/context/FlashQuestContext';
import { computeLevel, getLevelEntry } from '@/utils/levels';
import { enqueueToastRunner, releaseToastRunner } from '@/utils/toastQueue';

export default function LevelUpMonitor() {
  const { stats, isLoading } = useFlashQuest();
  const [toast, setToast] = useState<{ level: number; title: string } | null>(null);
  const prevLevelRef = useRef<number | null>(null);
  const currentLevel = useMemo(() => computeLevel(stats.totalScore), [stats.totalScore]);
  const handleDismiss = useCallback(() => {
    setToast(null);
    releaseToastRunner();
  }, []);

  useEffect(() => {
    if (isLoading) {
      return;
    }

    if (prevLevelRef.current === null) {
      prevLevelRef.current = currentLevel;
      return;
    }

    if (currentLevel > prevLevelRef.current) {
      const entry = getLevelEntry(currentLevel);
      enqueueToastRunner(() => {
        setToast({ level: currentLevel, title: entry.title });
      });
    }

    prevLevelRef.current = currentLevel;
  }, [currentLevel, isLoading]);

  if (isLoading && !toast) {
    return null;
  }

  return <LevelUpToast levelUp={toast} onDismiss={handleDismiss} />;
}
