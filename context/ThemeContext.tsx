// ============================================
// THEME CONTEXT - Dark/Light Mode Management
// ============================================
// This file manages the app's theme (light or dark mode)
// It saves the user's preference and provides it to all screens

// ============================================
// IMPORTS
// ============================================
// AsyncStorage - saves data even when app closes
import AsyncStorage from '@react-native-async-storage/async-storage';
// createContextHook - creates a provider to share data across screens
import createContextHook from '@nkzw/create-context-hook';
// React Query - manages data fetching and caching
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
// React hooks for optimization
import { useCallback, useMemo } from 'react';

// Import theme color definitions
import { lightTheme, darkTheme, Theme } from '@/constants/colors';

// ============================================
// CONSTANTS
// ============================================
// Key used to save/load theme from device storage
const STORAGE_KEY = 'flashquest_theme';

// Type for theme mode - can only be 'light' or 'dark'
type ThemeMode = 'light' | 'dark';

// ============================================
// THEME PROVIDER & HOOK
// ============================================
// Creates a provider that wraps the app and a hook to access theme
// Usage: wrap app with <ThemeProvider>, then call useTheme() in any component
export const [ThemeProvider, useTheme] = createContextHook(() => {
  // Get query client to manage cache
  const queryClient = useQueryClient();

  // ============================================
  // LOAD THEME FROM STORAGE
  // ============================================
  // useQuery automatically loads and caches the theme
  const themeQuery = useQuery({
    queryKey: ['theme'], // Unique identifier for this data
    queryFn: async () => {
      // Try to load saved theme from device storage
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      // Return saved theme or default to 'light' if none found
      return (stored as ThemeMode) || 'light';
    },
  });

  // ============================================
  // SAVE THEME TO STORAGE
  // ============================================
  // useMutation handles saving theme changes
  const saveThemeMutation = useMutation({
    mutationFn: async (mode: ThemeMode) => {
      // Save the new theme to device storage
      await AsyncStorage.setItem(STORAGE_KEY, mode);
      return mode;
    },
    onSuccess: () => {
      // After saving, refresh the theme query to get updated value
      queryClient.invalidateQueries({ queryKey: ['theme'] });
    },
  });
  
  // Extract the mutate function for easier use
  const { mutate: saveThemeMutate } = saveThemeMutation;

  // ============================================
  // COMPUTED VALUES
  // ============================================
  // Check if current theme is dark mode
  const isDark = themeQuery.data === 'dark';
  
  // Get the actual theme object (colors, gradients, etc.)
  // If dark mode, use darkTheme, otherwise use lightTheme
  const theme: Theme = isDark ? darkTheme : lightTheme;

  // ============================================
  // THEME ACTIONS
  // ============================================
  // Function to toggle between light and dark mode
  // useCallback prevents recreating this function on every render
  const toggleTheme = useCallback(() => {
    // Switch to opposite mode
    const newMode: ThemeMode = isDark ? 'light' : 'dark';
    // Save the new mode
    saveThemeMutate(newMode);
  }, [isDark, saveThemeMutate]);

  // Function to set a specific theme mode
  const setTheme = useCallback((mode: ThemeMode) => {
    saveThemeMutate(mode);
  }, [saveThemeMutate]);

  // ============================================
  // RETURN VALUES
  // ============================================
  // useMemo prevents recreating this object unless values change
  // This optimizes performance by preventing unnecessary re-renders
  return useMemo(
    () => ({
      theme,          // Current theme colors object
      isDark,         // Boolean: is dark mode active?
      toggleTheme,    // Function to switch themes
      setTheme,       // Function to set specific theme
      isLoading: themeQuery.isLoading,  // Is theme still loading?
    }),
    [theme, isDark, toggleTheme, setTheme, themeQuery.isLoading]
  );
});
