import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

const HAPTICS_KEY = 'flashquest_haptics_enabled';

let cachedEnabled: boolean | null = null;

async function isEnabled(): Promise<boolean> {
  if (cachedEnabled !== null) {
    return cachedEnabled;
  }

  try {
    const stored = await AsyncStorage.getItem(HAPTICS_KEY);
    cachedEnabled = stored !== 'false';
    return cachedEnabled;
  } catch {
    return true;
  }
}

/**
 * Call this from settings.tsx when the user toggles haptics
 * so the in-memory cache stays in sync without re-reading AsyncStorage.
 */
export function setHapticsEnabled(enabled: boolean): void {
  cachedEnabled = enabled;
}

export function triggerImpact(style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light): void {
  if (Platform.OS === 'web') {
    return;
  }

  void isEnabled().then((enabled) => {
    if (enabled) {
      void Haptics.impactAsync(style);
    }
  });
}

export function triggerNotification(type: Haptics.NotificationFeedbackType): void {
  if (Platform.OS === 'web') {
    return;
  }

  void isEnabled().then((enabled) => {
    if (enabled) {
      void Haptics.notificationAsync(type);
    }
  });
}

export { ImpactFeedbackStyle, NotificationFeedbackType } from 'expo-haptics';
