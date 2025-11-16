import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';

import { lightTheme, darkTheme, Theme } from '@/constants/colors';

const STORAGE_KEY = 'flashquest_theme';

type ThemeMode = 'light' | 'dark';

export const [ThemeProvider, useTheme] = createContextHook(() => {
  const queryClient = useQueryClient();

  const themeQuery = useQuery({
    queryKey: ['theme'],
    queryFn: async () => {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      return (stored as ThemeMode) || 'light';
    },
  });

  const saveThemeMutation = useMutation({
    mutationFn: async (mode: ThemeMode) => {
      await AsyncStorage.setItem(STORAGE_KEY, mode);
      return mode;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['theme'] });
    },
  });
  const { mutate: saveThemeMutate } = saveThemeMutation;

  const isDark = themeQuery.data === 'dark';
  const theme: Theme = isDark ? darkTheme : lightTheme;

  const toggleTheme = useCallback(() => {
    const newMode: ThemeMode = isDark ? 'light' : 'dark';
    saveThemeMutate(newMode);
  }, [isDark, saveThemeMutate]);

  const setTheme = useCallback((mode: ThemeMode) => {
    saveThemeMutate(mode);
  }, [saveThemeMutate]);

  return useMemo(
    () => ({
      theme,
      isDark,
      toggleTheme,
      setTheme,
      isLoading: themeQuery.isLoading,
    }),
    [theme, isDark, toggleTheme, setTheme, themeQuery.isLoading]
  );
});
