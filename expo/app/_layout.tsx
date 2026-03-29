import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Constants from 'expo-constants';
import { Redirect, Stack, router, usePathname } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect, useRef, useState } from 'react';
import { LogBox, Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import AchievementMonitor from '@/components/AchievementMonitor';
import DeckMasteryMonitor from '@/components/DeckMasteryMonitor';
import ErrorBoundary from '@/components/ErrorBoundary';
import LevelUpMonitor from '@/components/LevelUpMonitor';
import ConsentSheet from '@/components/privacy/ConsentSheet';
import { ArenaProvider } from '@/context/ArenaContext';
import { AvatarProvider } from '@/context/AvatarContext';
import { FlashQuestProvider } from '@/context/FlashQuestContext';
import { PerformanceProvider } from '@/context/PerformanceContext';
import { PrivacyProvider, usePrivacy } from '@/context/PrivacyContext';
import { ThemeProvider } from '@/context/ThemeContext';
import { setAnalyticsCollectionEnabled, trackEvent } from '@/lib/analytics';
import { trpc, trpcClient } from '@/lib/trpc';
import { logger } from '@/utils/logger';
import { DATA_PRIVACY_ROUTE } from '@/utils/routes';
import { readStringFlag } from '@/utils/storage';

const ONBOARDING_STORAGE_KEY = 'flashquest_onboarding_complete';
const isExpoGo = Constants.appOwnership === 'expo';

if (!isExpoGo) {
  try {
    void SplashScreen.preventAutoHideAsync();
  } catch (error) {
    logger.warn('[Layout] SplashScreen.preventAutoHideAsync failed:', error);
  }
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
    <Stack screenOptions={{ headerBackTitle: 'Back', headerShown: false }}>
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
      <Stack.Screen name="deck-hub" options={{ headerShown: false }} />
      {__DEV__ ? <Stack.Screen name="flashcard-debug" options={{ headerShown: false, presentation: 'modal' }} /> : null}
      <Stack.Screen name="data-privacy" options={{ headerShown: false }} />
      <Stack.Screen name="faq" options={{ headerShown: false }} />
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

function AppShell() {
  const pathname = usePathname();
  const { analyticsEnabled, setAnalyticsConsent, shouldAskForAnalyticsConsent } = usePrivacy();
  const [isOnboardingComplete, setIsOnboardingComplete] = useState<boolean | null>(null);
  const didTrackAppOpenRef = useRef<boolean>(false);

  useEffect(() => {
    setAnalyticsCollectionEnabled(analyticsEnabled);
  }, [analyticsEnabled]);

  useEffect(() => {
    let isMounted = true;

    readStringFlag(ONBOARDING_STORAGE_KEY)
      .then((value) => {
        if (isMounted) {
          setIsOnboardingComplete(value);
        }
      })
      .catch((error) => {
        logger.warn('[Layout] Failed to read onboarding state:', error);
        if (isMounted) {
          setIsOnboardingComplete(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (isOnboardingComplete === null) {
      return;
    }

    const readyForDisplay = isOnboardingComplete || pathname === '/onboarding';

    if (!readyForDisplay) {
      return;
    }

    const timer = setTimeout(() => {
      if (!isExpoGo) {
        SplashScreen.hideAsync().catch(() => {});
      }

      if (!didTrackAppOpenRef.current && analyticsEnabled) {
        didTrackAppOpenRef.current = true;
        trackEvent({ event: 'app_opened' });
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [analyticsEnabled, isOnboardingComplete, pathname]);

  const showAnalyticsConsent = isOnboardingComplete === true
    && shouldAskForAnalyticsConsent
    && pathname !== '/onboarding'
    && pathname !== DATA_PRIVACY_ROUTE;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <RootLayoutContent isOnboardingComplete={isOnboardingComplete} />
      <AchievementMonitor />
      <LevelUpMonitor />
      <DeckMasteryMonitor />
      <ConsentSheet
        visible={showAnalyticsConsent}
        title="Help improve FlashQuest?"
        description="You control whether FlashQuest sends usage analytics. Analytics stay off until you choose."
        bullets={[
          'Includes events like app opens, deck creation, study sessions, and battle flow activity.',
          'Some events can include app-generated session, deck, room, or player identifiers.',
          'You can change this later in Privacy & Data.',
        ]}
        primaryLabel="Allow Analytics"
        secondaryLabel="Not Now"
        onPrimaryPress={() => setAnalyticsConsent('granted')}
        onSecondaryPress={() => setAnalyticsConsent('declined')}
        footerActionLabel="Open Privacy & Data"
        onFooterActionPress={() => router.push(DATA_PRIVACY_ROUTE)}
        testID="analytics-consent-sheet"
      />
    </GestureHandlerRootView>
  );
}

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <trpc.Provider client={trpcClient} queryClient={queryClient}>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            <PrivacyProvider>
              <AvatarProvider>
                <FlashQuestProvider>
                  <PerformanceProvider>
                    <ArenaProvider>
                      <AppShell />
                    </ArenaProvider>
                  </PerformanceProvider>
                </FlashQuestProvider>
              </AvatarProvider>
            </PrivacyProvider>
          </ThemeProvider>
        </QueryClientProvider>
      </trpc.Provider>
    </ErrorBoundary>
  );
}
