// ============================================
// ROOT LAYOUT - App Entry Point
// ============================================
// This is the main entry point of the FlashQuest app.
// It sets up all the providers (data management systems) and navigation.
// Think of this as the foundation that holds everything together.

// ============================================
// IMPORTS
// ============================================
// React Query - manages server data, caching, and synchronization
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
// Stack navigation - allows moving between screens with back button
import { Stack } from "expo-router";
// Splash screen - the loading screen shown when app first opens
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
// Gesture handler - enables touch gestures like swiping
import { GestureHandlerRootView } from "react-native-gesture-handler";

// Our custom providers for managing app state
import { ArenaProvider } from '@/context/ArenaContext';
import { FlashQuestProvider } from '@/context/FlashQuestContext';
import { PerformanceProvider } from '@/context/PerformanceContext';
import { ThemeProvider } from '@/context/ThemeContext';

// ============================================
// SPLASH SCREEN SETUP
// ============================================
// Prevent the splash screen from auto-hiding until we're ready
// This gives us time to load any necessary data or assets
SplashScreen.preventAutoHideAsync();

// ============================================
// REACT QUERY CLIENT
// ============================================
// Create a client for managing data fetching and caching
// This helps keep our app fast by storing data intelligently
const queryClient = new QueryClient();

// ============================================
// NAVIGATION STRUCTURE
// ============================================
// This function defines all the screens (pages) in our app
// Stack navigation means screens stack on top of each other
// Users can press back to return to the previous screen
function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerBackTitle: "Back", headerShown: false }}>
      {/* Home screen - the main dashboard */}
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

// ============================================
// MAIN LAYOUT COMPONENT
// ============================================
// This wraps the entire app with all necessary providers
// Provider order matters! Outer providers are available to inner ones
export default function RootLayout() {
  // Hide the splash screen once the app is ready
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    // 1. React Query Provider - handles data fetching (outermost)
    <QueryClientProvider client={queryClient}>
      {/* 2. Theme Provider - manages light/dark mode */}
      <ThemeProvider>
        {/* 3. FlashQuest Provider - manages app data (decks, progress, stats) */}
        <FlashQuestProvider>
          {/* 4. Performance Provider - tracks quest accuracy and stats */}
          <PerformanceProvider>
            {/* 5. Arena Provider - manages multiplayer arena state */}
            <ArenaProvider>
              {/* 6. Gesture Handler - enables touch gestures throughout app */}
              <GestureHandlerRootView>
                {/* 7. Navigation - the actual screens */}
                <RootLayoutNav />
              </GestureHandlerRootView>
            </ArenaProvider>
          </PerformanceProvider>
        </FlashQuestProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
