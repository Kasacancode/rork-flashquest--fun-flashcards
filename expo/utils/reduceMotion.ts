import { useEffect, useState } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';

let cachedReduceMotion = false;

export function useReduceMotion(): boolean {
  const [reduceMotion, setReduceMotion] = useState<boolean>(cachedReduceMotion);

  useEffect(() => {
    if (Platform.OS === 'web') {
      return;
    }

    let isMounted = true;

    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (!isMounted) {
          return;
        }

        cachedReduceMotion = enabled;
        setReduceMotion(enabled);
      })
      .catch(() => {});

    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled: boolean) => {
      cachedReduceMotion = enabled;
      if (isMounted) {
        setReduceMotion(enabled);
      }
    });

    return () => {
      isMounted = false;
      subscription?.remove();
    };
  }, []);

  return reduceMotion;
}

export function isReduceMotionEnabled(): boolean {
  return cachedReduceMotion;
}
