import { useMemo } from 'react';
import { useWindowDimensions } from 'react-native';

export interface ResponsiveLayout {
  isTablet: boolean;
  isLargeTablet: boolean;
  screenWidth: number;
  contentMaxWidth: number | undefined;
  contentPadding: number;
  deckListColumns: number;
  gameAreaMaxWidth: number;
  cardMaxWidth: number | undefined;
}

export function useResponsiveLayout(): ResponsiveLayout {
  const { width } = useWindowDimensions();

  return useMemo<ResponsiveLayout>(() => {
    const isTablet = width >= 768;
    const isLargeTablet = width >= 1024;

    return {
      isTablet,
      isLargeTablet,
      screenWidth: width,
      contentMaxWidth: isTablet ? 640 : undefined,
      contentPadding: isTablet ? 32 : 24,
      deckListColumns: isTablet ? 2 : 1,
      gameAreaMaxWidth: isTablet ? 540 : 500,
      cardMaxWidth: isTablet ? 500 : undefined,
    };
  }, [width]);
}
