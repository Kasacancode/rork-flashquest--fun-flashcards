import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import Constants from 'expo-constants';
import { Redirect, Stack, router, usePathname } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Image, LogBox, Platform, StyleSheet as LayoutStyles, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import AchievementMonitor from '@/components/AchievementMonitor';
import DeckMasteryMonitor from '@/components/DeckMasteryMonitor';
import DownloadToast from '@/components/DownloadToast';
import ErrorBoundary from '@/components/ErrorBoundary';
import LevelUpMonitor from '@/components/LevelUpMonitor';
import OfflineBanner from '@/components/OfflineBanner';
import ConsentSheet from '@/components/privacy/ConsentSheet';
import { ArenaProvider } from '@/context/ArenaContext';
import { AuthProvider } from '@/context/AuthContext';
import { AvatarProvider } from '@/context/AvatarContext';
import { FlashQuestProvider, useFlashQuest } from '@/context/FlashQuestContext';
import { PerformanceProvider, usePerformance } from '@/context/PerformanceContext';
import { PrivacyProvider, usePrivacy } from '@/context/PrivacyContext';
import { ThemeProvider, useTheme } from '@/context/ThemeContext';
import { setAnalyticsCollectionEnabled, trackEvent } from '@/lib/analytics';
import { supabase } from '@/lib/supabase';
import { trpc, trpcClient } from '@/lib/trpc';
import { syncWithCloud } from '@/utils/cloudSync';
import { canAccessDebugRoute } from '@/utils/debugTooling';
import { logger } from '@/utils/logger';
import { getLiveCardStats, isCardDueForReview } from '@/utils/mastery';
import { checkNewDownloads } from '@/utils/marketplaceService';
import { clearAppBadge, scheduleSmartReminder, updateAppBadgeCount } from '@/utils/notifications';
import { DATA_PRIVACY_ROUTE } from '@/utils/routes';
import { loadSoundsEnabledPreference, preloadSounds } from '@/utils/sounds';
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

const layoutStyles = LayoutStyles.create({
  startupLoadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startupLogo: {
    width: 72,
    height: 72,
    marginBottom: 24,
    opacity: 0.85,
  },
});

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerBackTitle: 'Back', headerShown: false }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="onboarding" options={{ headerShown: false, gestureEnabled: false }} />
      <Stack.Screen name="stats" options={{ headerShown: false }} />
      <Stack.Screen name="leaderboard" options={{ headerShown: false, gestureEnabled: true }} />
      <Stack.Screen name="profile" options={{ headerShown: false }} />
      <Stack.Screen name="decks" options={{ headerShown: false }} />
      <Stack.Screen name="explore" options={{ headerShown: false, gestureEnabled: true }} />
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
      <Stack.Screen name="settings" options={{ headerShown: false }} />
      <Stack.Screen name="auth" options={{ headerShown: false, gestureEnabled: true }} />
      <Stack.Screen name="auth-callback" options={{ headerShown: false, gestureEnabled: false }} />
      <Stack.Screen name="choose-username" options={{ headerShown: false, gestureEnabled: false }} />
      <Stack.Screen name="account" options={{ headerShown: false, gestureEnabled: true }} />
      <Stack.Screen name="edit-deck" options={{ headerShown: false }} />
      <Stack.Screen name="edit-flashcard" options={{ headerShown: false }} />
      <Stack.Protected guard={canAccessDebugRoute('flashcard-debug')}>
        <Stack.Screen name="flashcard-debug" options={{ headerShown: false, presentation: 'modal' }} />
      </Stack.Protected>
      <Stack.Screen name="data-privacy" options={{ headerShown: false }} />
      <Stack.Screen name="faq" options={{ headerShown: false }} />
    </Stack>
  );
}

function RootLayoutContent({ isOnboardingComplete }: { isOnboardingComplete: boolean | null }) {
  const { theme, isDark } = useTheme();
  const pathname = usePathname();
  const previousPathnameRef = useRef<string | null>(null);
  const isReturningFromOnboarding = previousPathnameRef.current === '/onboarding' && pathname === '/';

  useEffect(() => {
    previousPathnameRef.current = pathname;
  }, [pathname]);

  if (isOnboardingComplete === null) {
    return (
      <View style={[layoutStyles.startupLoadingContainer, { backgroundColor: theme.background }]}>
        <Image
          source={require('../assets/images/flashquest-q-logo.png')}
          style={layoutStyles.startupLogo}
          resizeMode="contain"
        />
        <ActivityIndicator size="small" color={isDark ? '#8b5cf6' : '#667eea'} />
      </View>
    );
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
  const reactQueryClient = useQueryClient();
  const { analyticsEnabled, setAnalyticsConsent, shouldAskForAnalyticsConsent } = usePrivacy();
  const { decks, stats } = useFlashQuest();
  const { performance } = usePerformance();
  const [isOnboardingComplete, setIsOnboardingComplete] = useState<boolean | null>(null);
  const [downloadNotification, setDownloadNotification] = useState<{ deckName: string; newDownloads: number } | null>(null);
  const didTrackAppOpenRef = useRef<boolean>(false);
  const latestDueCardCountRef = useRef<number>(0);
  const dueReviewSummary = useMemo(() => {
    const now = Date.now();
    let dueCardCount = 0;
    let deckCount = 0;

    for (const deck of decks) {
      let deckDueCount = 0;

      for (const card of deck.flashcards) {
        const cardStats = performance.cardStatsById[card.id];
        if (!cardStats || cardStats.attempts === 0) {
          continue;
        }

        const liveStats = getLiveCardStats(cardStats, now);
        if (liveStats.status === 'lapsed' || isCardDueForReview(cardStats, now)) {
          deckDueCount += 1;
        }
      }

      if (deckDueCount > 0) {
        deckCount += 1;
        dueCardCount += deckDueCount;
      }
    }

    return { dueCardCount, deckCount };
  }, [decks, performance.cardStatsById]);

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

  useEffect(() => {
    latestDueCardCountRef.current = dueReviewSummary.dueCardCount;
  }, [dueReviewSummary.dueCardCount]);

  useEffect(() => {
    let isMounted = true;

    supabase.auth.getSession()
      .then(async ({ data: { session: currentSession } }) => {
        if (!isMounted || !currentSession?.user?.id) {
          return;
        }

        await syncWithCloud(currentSession.user.id);

        if (isMounted) {
          void reactQueryClient.invalidateQueries();
        }
      })
      .catch((error) => {
        logger.warn('[Layout] Initial cloud sync failed:', error);
      });

    return () => {
      isMounted = false;
    };
  }, [reactQueryClient]);

  useEffect(() => {
    let isMounted = true;

    supabase.auth.getSession()
      .then(({ data: { session: currentSession } }) => {
        if (!currentSession?.user?.id) {
          return;
        }

        void checkNewDownloads(currentSession.user.id).then((result) => {
          if (isMounted && result) {
            setDownloadNotification(result);
          }
        });
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (isOnboardingComplete !== true) {
      return;
    }

    void scheduleSmartReminder({
      dueCardCount: dueReviewSummary.dueCardCount,
      deckCount: dueReviewSummary.deckCount,
      currentStreak: stats.currentStreak,
    });
  }, [dueReviewSummary.deckCount, dueReviewSummary.dueCardCount, isOnboardingComplete, stats.currentStreak]);

  useEffect(() => {
    if (isOnboardingComplete !== true) {
      return;
    }

    void clearAppBadge();
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        void clearAppBadge();
        return;
      }

      if (nextState === 'background' || nextState === 'inactive') {
        void updateAppBadgeCount(latestDueCardCountRef.current);
      }
    });

    return () => {
      subscription.remove();
    };
  }, [isOnboardingComplete]);

  useEffect(() => {
    if (isOnboardingComplete === null) {
      return;
    }

    void loadSoundsEnabledPreference();
    void preloadSounds();
  }, [isOnboardingComplete]);

  const showAnalyticsConsent = isOnboardingComplete === true
    && shouldAskForAnalyticsConsent
    && pathname !== '/onboarding'
    && pathname !== DATA_PRIVACY_ROUTE;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <OfflineBanner />
      <RootLayoutContent isOnboardingComplete={isOnboardingComplete} />
      <AchievementMonitor />
      <LevelUpMonitor />
      <DeckMasteryMonitor />
      <DownloadToast
        download={downloadNotification}
        onDismiss={() => setDownloadNotification(null)}
      />
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
              <AuthProvider>
                <AvatarProvider>
                  <FlashQuestProvider>
                    <PerformanceProvider>
                      <ArenaProvider>
                        <AppShell />
                      </ArenaProvider>
                    </PerformanceProvider>
                  </FlashQuestProvider>
                </AvatarProvider>
              </AuthProvider>
            </PrivacyProvider>
          </ThemeProvider>
        </QueryClientProvider>
      </trpc.Provider>
    </ErrorBoundary>
  );
}
