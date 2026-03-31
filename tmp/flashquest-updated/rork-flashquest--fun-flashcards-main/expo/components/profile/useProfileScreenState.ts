import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated } from 'react-native';

import { HERO_GRADIENTS } from '@/components/profile/profileScreen.constants';
import type { GradientTriplet, TabType } from '@/components/profile/profileScreen.types';
import { AVATAR_COLORS, AVATAR_SUITS } from '@/constants/avatar';
import { useArena } from '@/context/ArenaContext';
import { useAvatar } from '@/context/AvatarContext';
import { useFlashQuest } from '@/context/FlashQuestContext';
import { usePerformance } from '@/context/PerformanceContext';
import { useTheme } from '@/context/ThemeContext';
import { canAccessDebugFeature } from '@/utils/debugTooling';
import { DATA_PRIVACY_ROUTE, FAQ_ROUTE, SETTINGS_ROUTE, flashcardDebugHref } from '@/utils/routes';
import {
  ACHIEVEMENT_CATEGORIES,
  computeAchievements,
  type AchievementCategoryId,
  type AchievementItem,
} from '@/utils/achievements';
import { computeLevel, computeLevelProgress, getLevelEntry } from '@/utils/levels';
import { getPlayerNameValidationError } from '@/utils/playerName';

export function useProfileScreenState() {
  const navigation = useRouter();
  const { stats, decks } = useFlashQuest();
  const { performance } = usePerformance();
  const { playerName, updatePlayerName, isPlayerNameReady, leaderboard } = useArena();
  const { theme, isDark, toggleTheme } = useTheme();
  const { selectedSuit, selectedColor, setSelectedSuit, setSelectedColor } = useAvatar();
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [activeAchievementCategory, setActiveAchievementCategory] = useState<AchievementCategoryId>(ACHIEVEMENT_CATEGORIES[0].id);
  const [showLevels, setShowLevels] = useState<boolean>(false);
  const [isEditingPlayerName, setIsEditingPlayerName] = useState<boolean>(false);
  const [playerNameInput, setPlayerNameInput] = useState<string>('');
  const [playerNameError, setPlayerNameError] = useState<string | null>(null);

  const level = useMemo(() => computeLevel(stats.totalScore), [stats.totalScore]);
  const levelProgress = useMemo(() => computeLevelProgress(stats.totalScore), [stats.totalScore]);
  const levelEntry = useMemo(() => getLevelEntry(level), [level]);
  const selectedSuitData = useMemo(
    () => AVATAR_SUITS.find((suit) => suit.id === selectedSuit) ?? AVATAR_SUITS[0]!,
    [selectedSuit],
  );
  const selectedColorData = useMemo(
    () => AVATAR_COLORS.find((color) => color.id === selectedColor) ?? AVATAR_COLORS[0]!,
    [selectedColor],
  );
  const currentPlayerName = playerName.trim();
  const profileDisplayName = currentPlayerName || 'FlashQuest Player';
  const totalCardsOwned = useMemo(() => decks.flatMap((deck) => deck.flashcards).length, [decks]);
  const customDeckCount = useMemo(() => decks.filter((deck) => deck.isCustom).length, [decks]);
  const achievements: AchievementItem[] = useMemo(
    () => computeAchievements({
      stats,
      leaderboardCount: leaderboard.length,
      totalArenaBattles: stats.totalArenaBattles ?? leaderboard.length,
      bestQuestStreak: performance.bestQuestStreak,
      customDeckCount,
      totalCardsOwned,
    }),
    [stats, leaderboard.length, performance.bestQuestStreak, customDeckCount, totalCardsOwned],
  );

  const screenGradient = useMemo(
    () => [theme.gradientStart, theme.gradientMid, theme.gradientEnd] as GradientTriplet,
    [theme.gradientStart, theme.gradientMid, theme.gradientEnd],
  );
  const heroGradient = useMemo(() => {
    const palette = HERO_GRADIENTS[selectedColor] ?? HERO_GRADIENTS.blue;
    return isDark ? palette.dark : palette.light;
  }, [isDark, selectedColor]);
  const surfaceGradient = useMemo(
    () => (
      isDark
        ? ['rgba(15, 23, 42, 0.96)', 'rgba(15, 23, 42, 0.84)']
        : ['rgba(255, 255, 255, 0.96)', 'rgba(255, 255, 255, 0.88)']
    ) as [string, string],
    [isDark],
  );
  const tabActiveGradient = useMemo(() => theme.profileTabActiveGradient as [string, string], [theme.profileTabActiveGradient]);
  const overlayGradient = useMemo(
    () => (
      isDark
        ? ['rgba(2, 6, 23, 0.18)', 'rgba(2, 6, 23, 0.5)', 'rgba(2, 6, 23, 0.72)']
        : ['rgba(255, 255, 255, 0.04)', 'rgba(255, 255, 255, 0.1)', 'rgba(255, 255, 255, 0.16)']
    ) as GradientTriplet,
    [isDark],
  );
  const selectedColorValue = selectedColorData.value || AVATAR_COLORS[0]!.value;
  const canOpenFlashcardInspector = canAccessDebugFeature('flashcard_inspector');
  const avatarShowcaseGradient = useMemo(
    () => [selectedColorValue, theme.primaryDark, theme.gradientEnd] as [string, string, string],
    [selectedColorValue, theme.primaryDark, theme.gradientEnd],
  );
  const unselectedAvatarOptionColor = isDark ? '#CBD5E1' : '#64748B';
  const selectedSuitCardBackground = isDark ? 'rgba(15, 23, 42, 0.9)' : selectedColorData.light;

  const completedAchievements = useMemo(
    () => achievements.filter((achievement) => achievement.progress >= achievement.total).length,
    [achievements],
  );
  const nextAchievement = useMemo(
    () => achievements.find((achievement) => achievement.progress < achievement.total) ?? null,
    [achievements],
  );
  const activeAchievementCategoryEntry = useMemo(
    () => ACHIEVEMENT_CATEGORIES.find((category) => category.id === activeAchievementCategory) ?? ACHIEVEMENT_CATEGORIES[0],
    [activeAchievementCategory],
  );
  const activeCategoryAchievements = useMemo(
    () => achievements.filter((achievement) => achievement.category === activeAchievementCategory),
    [achievements, activeAchievementCategory],
  );
  const activeCategoryCompletedAchievements = useMemo(
    () => activeCategoryAchievements.filter((achievement) => achievement.progress >= achievement.total).length,
    [activeCategoryAchievements],
  );
  const achievementCategoryFade = useRef<Animated.Value>(new Animated.Value(1)).current;

  useEffect(() => {
    achievementCategoryFade.setValue(0);
    Animated.timing(achievementCategoryFade, {
      toValue: 1,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [achievementCategoryFade, activeAchievementCategory]);

  useEffect(() => {
    if (!isEditingPlayerName) {
      setPlayerNameInput(playerName);
    }
  }, [isEditingPlayerName, playerName]);

  const handleBack = useCallback(() => {
    navigation.back();
  }, [navigation]);

  const handleSelectTab = useCallback((tab: TabType) => {
    setActiveTab(tab);
  }, []);

  const handleOpenLevels = useCallback(() => {
    setShowLevels(true);
  }, []);

  const handleSelectAchievementCategory = useCallback((categoryId: AchievementCategoryId) => {
    setActiveAchievementCategory(categoryId);
  }, []);

  const handleCloseLevels = useCallback(() => {
    setShowLevels(false);
  }, []);

  const handleOpenFAQ = useCallback(() => {
    navigation.push(FAQ_ROUTE);
  }, [navigation]);

  const handleOpenPrivacy = useCallback(() => {
    navigation.push(DATA_PRIVACY_ROUTE);
  }, [navigation]);

  const handleOpenSettings = useCallback(() => {
    navigation.push(SETTINGS_ROUTE);
  }, [navigation]);

  const handleOpenFlashcardInspector = useCallback(() => {
    if (!canOpenFlashcardInspector) {
      return;
    }

    navigation.push(flashcardDebugHref());
  }, [canOpenFlashcardInspector, navigation]);

  const handleSelectSuit = useCallback((suitId: typeof selectedSuit) => {
    setSelectedSuit(suitId);
  }, [setSelectedSuit]);

  const handleSelectColor = useCallback((colorId: typeof selectedColor) => {
    setSelectedColor(colorId);
  }, [setSelectedColor]);

  const handleEditPlayerName = useCallback(() => {
    setPlayerNameInput(playerName);
    setPlayerNameError(null);
    setIsEditingPlayerName(true);
  }, [playerName]);

  const handleCancelPlayerNameEdit = useCallback(() => {
    setPlayerNameInput(playerName);
    setPlayerNameError(null);
    setIsEditingPlayerName(false);
  }, [playerName]);

  const handleChangePlayerNameInput = useCallback((value: string) => {
    if (playerNameError) {
      setPlayerNameError(null);
    }

    setPlayerNameInput(value);
  }, [playerNameError]);

  const handleSavePlayerName = useCallback(() => {
    const validationError = getPlayerNameValidationError(playerNameInput);
    if (validationError) {
      setPlayerNameError(validationError);
      return;
    }

    const nextPlayerName = updatePlayerName(playerNameInput);
    if (!nextPlayerName) {
      setPlayerNameError('Enter a player name.');
      return;
    }

    setPlayerNameInput(nextPlayerName);
    setPlayerNameError(null);
    setIsEditingPlayerName(false);
  }, [playerNameInput, updatePlayerName]);

  return {
    theme,
    isDark,
    toggleTheme,
    activeTab,
    activeAchievementCategory,
    showLevels,
    isEditingPlayerName,
    playerNameInput,
    playerNameError,
    level,
    levelProgress,
    levelEntry,
    selectedSuit,
    selectedColor,
    selectedSuitData,
    selectedColorData,
    profileDisplayName,
    achievements,
    completedAchievements,
    nextAchievement,
    activeAchievementCategoryEntry,
    activeCategoryAchievements,
    activeCategoryCompletedAchievements,
    achievementCategoryFade,
    isPlayerNameReady,
    screenGradient,
    heroGradient,
    surfaceGradient,
    tabActiveGradient,
    overlayGradient,
    selectedColorValue,
    avatarShowcaseGradient,
    unselectedAvatarOptionColor,
    selectedSuitCardBackground,
    handleBack,
    handleSelectTab,
    handleOpenLevels,
    handleSelectAchievementCategory,
    handleCloseLevels,
    handleOpenFAQ,
    handleOpenPrivacy,
    handleOpenSettings,
    handleOpenFlashcardInspector: canOpenFlashcardInspector ? handleOpenFlashcardInspector : undefined,
    handleSelectSuit,
    handleSelectColor,
    handleEditPlayerName,
    handleCancelPlayerNameEdit,
    handleChangePlayerNameInput,
    handleSavePlayerName,
  };
}
