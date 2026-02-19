import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { Platform, LogBox } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import ErrorBoundary from '@/components/ErrorBoundary';
import { ArenaProvider } from '@/context/ArenaContext';
import { FlashQuestProvider } from '@/context/FlashQuestContext';
import { PerformanceProvider } from '@/context/PerformanceContext';
import { ThemeProvider } from '@/context/ThemeContext';
import { trpc, trpcClient } from '@/lib/trpc';

try {
  SplashScreen.preventAutoHideAsync();
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
      <Stack.Screen name="stats" options={{ headerShown: false }} />
      <Stack.Screen name="profile" options={{ headerShown: false }} />
      <Stack.Screen name="decks" options={{ headerShown: false }} />
      <Stack.Screen name="duel-arena" options={{ headerShown: false }} />
      <Stack.Screen name="duel-session" options={{ headerShown: false }} />
      <Stack.Screen name="study" options={{ headerShown: false }} />
      <Stack.Screen name="create-flashcard" options={{ headerShown: false }} />
      <Stack.Screen name="quest" options={{ headerShown: false }} />
      <Stack.Screen name="quest-session" options={{ headerShown: false }} />
      <Stack.Screen name="quest-results" options={{ headerShown: false }} />
      <Stack.Screen name="arena" options={{ headerShown: false }} />
      <Stack.Screen name="arena-lobby" options={{ headerShown: false }} />
      <Stack.Screen name="arena-session" options={{ headerShown: false }} />
      <Stack.Screen name="arena-results" options={{ headerShown: false }} />
      <Stack.Screen name="scan-notes" options={{ headerShown: false }} />
      <Stack.Screen name="text-to-deck" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  useEffect(() => {
    const timer = setTimeout(() => {
      SplashScreen.hideAsync().catch(() => {});
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  return (
    <ErrorBoundary>
      <trpc.Provider client={trpcClient} queryClient={queryClient}>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            <FlashQuestProvider>
              <PerformanceProvider>
                <ArenaProvider>
                  <GestureHandlerRootView style={{ flex: 1 }}>
                    <RootLayoutNav />
                  </GestureHandlerRootView>
                </ArenaProvider>
              </PerformanceProvider>
            </FlashQuestProvider>
          </ThemeProvider>
        </QueryClientProvider>
      </trpc.Provider>
    </ErrorBoundary>
  );
}
