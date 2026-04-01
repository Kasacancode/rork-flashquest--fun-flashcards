import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

const HAPTICS_KEY = 'flashquest_haptics_enabled';

let cachedEnabled: boolean | null = null;
let cacheVersion = 0;
let enabledPromise: Promise<boolean> | null = null;

async function getHapticsEnabled(): Promise<boolean> {
  if (cachedEnabled !== null) {
    return cachedEnabled;
  }

  if (enabledPromise) {
    return enabledPromise;
  }

  const requestVersion = cacheVersion;
  enabledPromise = AsyncStorage.getItem(HAPTICS_KEY)
    .then((storedValue) => {
      const nextEnabled = storedValue !== 'false';

      if (cacheVersion === requestVersion && cachedEnabled === null) {
        cachedEnabled = nextEnabled;
      }

      return cachedEnabled ?? nextEnabled;
    })
    .catch(() => cachedEnabled ?? true)
    .finally(() => {
      enabledPromise = null;
    });

  return enabledPromise;
}

export function setHapticsEnabled(enabled: boolean): void {
  cacheVersion += 1;
  cachedEnabled = enabled;
  enabledPromise = Promise.resolve(enabled);
}

export function triggerImpact(
  style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light,
): void {
  if (Platform.OS === 'web') {
    return;
  }

  void getHapticsEnabled().then((enabled) => {
    if (enabled) {
      void Haptics.impactAsync(style);
    }
  });
}

export function triggerNotification(type: Haptics.NotificationFeedbackType): void {
  if (Platform.OS === 'web') {
    return;
  }

  void getHapticsEnabled().then((enabled) => {
    if (enabled) {
      void Haptics.notificationAsync(type);
    }
  });
}

export { ImpactFeedbackStyle, NotificationFeedbackType } from 'expo-haptics';
