import AsyncStorage from '@react-native-async-storage/async-storage';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Redirect, Stack, usePathname } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useRef, useState } from "react";
import { Platform, LogBox } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import AchievementMonitor from '@/components/AchievementMonitor';
import ErrorBoundary from '@/components/ErrorBoundary';
import { ArenaProvider } from '@/context/ArenaContext';
import { AvatarProvider } from '@/context/AvatarContext';
import { DeveloperAccessProvider } from '@/context/DeveloperAccessContext';
import { FlashQuestProvider } from '@/context/FlashQuestContext';
import { PerformanceProvider } from '@/context/PerformanceContext';
import { ThemeProvider } from '@/context/ThemeContext';
import { trackEvent } from '@/lib/analytics';
import { trpc, trpcClient } from '@/lib/trpc';
import { requestNotificationPermission, scheduleStreakReminder } from '@/utils/notifications';

const ONBOARDING_STORAGE_KEY = 'flashquest_onboarding_complete';

try {
  void SplashScreen.preventAutoHideAsync();
} catch (e) {
  console.warn('[Layout] SplashScreen.preventAutoHideAsync failed:', e);
}

if (Platform.OS !== 'web') {
  LogBox.ignoreLogs(['Require cycle']);
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 1000 * 60,
    },
  },
});

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerBackTitle: "Back", headerShown: false }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="onboarding" options={{ headerShown: false, gestureEnabled: false }} />
      <Stack.Screen name="stats" options={{ headerShown: false }} />
      <Stack.Screen name="profile" options={{ headerShown: false }} />
      <Stack.Screen name="decks" options={{ headerShown: false }} />
      <Stack.Screen name="practice" options={{ headerShown: false }} />
      <Stack.Screen name="practice-session" options={{ headerShown: false }} />
      <Stack.Screen name="study" options={{ headerShown: false }} />
      <Stack.Screen name="create-flashcard" options={{ headerShown: false }} />
      <Stack.Screen name="quest" options={{ headerShown: false }} />
      <Stack.Screen name="quest-session" options={{ headerShown: false }} />
      <Stack.Screen name="quest-results" options={{ headerShown: false }} />
      <Stack.Screen name="arena" options={{ headerShown: false }} />
      <Stack.Screen name="arena-lobby" options={{ headerShown: false }} />
      <Stack.Screen name="arena-session" options={{ headerShown: false }} />
      <Stack.Screen name="arena-results" options={{ headerShown: false }} />
      <Stack.Screen name="join/[code]" options={{ headerShown: false }} />
      <Stack.Screen name="scan-notes" options={{ headerShown: false }} />
      <Stack.Screen name="text-to-deck" options={{ headerShown: false }} />
      <Stack.Screen name="analytics-debug" options={{ headerShown: false }} />
    </Stack>
  );
}

function RootLayoutContent({ isOnboardingComplete }: { isOnboardingComplete: boolean | null }) {
  const pathname = usePathname();
  const previousPathnameRef = useRef<string | null>(null);
  const isReturningFromOnboarding = previousPathnameRef.current === '/onboarding' && pathname === '/';

  useEffect(() => {
    previousPathnameRef.current = pathname;
  }, [pathname]);

  if (isOnboardingComplete === null) {
    return null;
  }

  if (!isOnboardingComplete && pathname !== '/onboarding' && !isReturningFromOnboarding) {
    return <Redirect href="/onboarding" />;
  }

  if (isOnboardingComplete && pathname === '/onboarding') {
    return <Redirect href="/" />;
  }

  return <RootLayoutNav />;
}

export default function RootLayout() {
  const pathname = usePathname();
  const [isOnboardingComplete, setIsOnboardingComplete] = useState<boolean | null>(null);
  const didTrackAppOpenRef = useRef<boolean>(false);
  const didSetupNotificationsRef = useRef<boolean>(false);

  useEffect(() => {
    let isMounted = true;

    AsyncStorage.getItem(ONBOARDING_STORAGE_KEY)
      .then((value) => {
        if (isMounted) {
          setIsOnboardingComplete(value === 'true');
        }
      })
      .catch((error) => {
        console.warn('[Layout] Failed to read onboarding state:', error);
        if (isMounted) {
          setIsOnboardingComplete(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [pathname]);

  useEffect(() => {
    if (isOnboardingComplete === null) {
      return;
    }

    const readyForDisplay = isOnboardingComplete || pathname === '/onboarding';

    if (!readyForDisplay) {
      return;
    }

    const timer = setTimeout(() => {
      SplashScreen.hideAsync().catch(() => {});

      if (!didTrackAppOpenRef.current) {
        didTrackAppOpenRef.current = true;
        trackEvent({ event: 'app_opened' });
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [isOnboardingComplete, pathname]);

  useEffect(() => {
    if (isOnboardingComplete === null || didSetupNotificationsRef.current) {
      return;
    }

    didSetupNotificationsRef.current = true;

    requestNotificationPermission()
      .then((granted) => {
        if (granted) {
          return scheduleStreakReminder();
        }

        return Promise.resolve();
      })
      .catch((error) => {
        console.warn('[Layout] Notification setup skipped:', error);
      });
  }, [isOnboardingComplete]);

  return (
    <ErrorBoundary>
      <trpc.Provider client={trpcClient} queryClient={queryClient}>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            <DeveloperAccessProvider>
              <AvatarProvider>
                <FlashQuestProvider>
                  <PerformanceProvider>
                    <ArenaProvider>
                      <GestureHandlerRootView style={{ flex: 1 }}>
                        <RootLayoutContent isOnboardingComplete={isOnboardingComplete} />
                        <AchievementMonitor />
                      </GestureHandlerRootView>
                    </ArenaProvider>
                  </PerformanceProvider>
                </FlashQuestProvider>
              </AvatarProvider>
            </DeveloperAccessProvider>
          </ThemeProvider>
        </QueryClientProvider>
      </trpc.Provider>
    </ErrorBoundary>
  );
}
