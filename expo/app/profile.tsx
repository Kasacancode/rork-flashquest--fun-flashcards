import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { ArrowLeft, Crown, UserRound } from 'lucide-react-native';
import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import ResponsiveContainer from '@/components/ResponsiveContainer';
import AvatarTab from '@/components/profile/AvatarTab';
import AwardsTab from '@/components/profile/AwardsTab';
import LevelsModal from '@/components/profile/LevelsModal';
import OverviewTab from '@/components/profile/OverviewTab';
import PlayerNameModal from '@/components/profile/PlayerNameModal';
import ProfileHeroCard from '@/components/profile/ProfileHeroCard';
import ProfileTabBar from '@/components/profile/ProfileTabBar';
import type { AvatarOptionVisual } from '@/components/profile/profileScreen.types';
import { useProfileScreenState } from '@/components/profile/useProfileScreenState';
import { AVATAR_COLORS, AVATAR_SUITS } from '@/constants/avatar';
import { type Theme } from '@/constants/colors';
import type { AvatarColorId, AvatarSuitId } from '@/types/avatar';
import { ACHIEVEMENT_CATEGORIES } from '@/utils/achievements';
import { LEVELS } from '@/utils/levels';
import { LEADERBOARD_ROUTE } from '@/utils/routes';

export default function ProfilePage() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const {
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
    usernameLabel,
    canEditPlayerName,
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
    handleOpenFlashcardInspector,
    handleSelectSuit,
    handleSelectColor,
    handleEditPlayerName,
    handleCancelPlayerNameEdit,
    handleChangePlayerNameInput,
    handleSavePlayerName,
  } = useProfileScreenState();

  const styles = useMemo(() => createStyles(theme, isDark, width), [theme, isDark, width]);

  const suitOptionVisuals = useMemo<Record<AvatarSuitId, AvatarOptionVisual>>(() => {
    return AVATAR_SUITS.reduce<Record<AvatarSuitId, AvatarOptionVisual>>((visuals, suit) => {
      const isSelected = selectedSuit === suit.id;
      visuals[suit.id] = {
        cardStyle: [
          styles.optionCard,
          isSelected ? styles.optionCardSelected : null,
          isSelected ? { borderColor: selectedColorValue, backgroundColor: selectedSuitCardBackground } : null,
        ],
        symbolStyle: [styles.optionSymbol, { color: isSelected ? selectedColorValue : unselectedAvatarOptionColor }],
        titleStyle: [
          styles.optionTitle,
          isSelected ? styles.optionTitleSelected : null,
          isSelected ? { color: selectedColorValue } : null,
        ],
        checkStyle: [styles.optionCheckBadge, { backgroundColor: selectedColorValue }],
      };

      return visuals;
    }, {} as Record<AvatarSuitId, AvatarOptionVisual>);
  }, [selectedColorValue, selectedSuit, selectedSuitCardBackground, styles, unselectedAvatarOptionColor]);

  const colorOptionVisuals = useMemo<Record<AvatarColorId, AvatarOptionVisual>>(() => {
    return AVATAR_COLORS.reduce<Record<AvatarColorId, AvatarOptionVisual>>((visuals, color) => {
      const isSelected = selectedColor === color.id;
      visuals[color.id] = {
        cardStyle: [
          styles.optionCard,
          isSelected ? styles.optionCardSelected : null,
          isSelected ? { borderColor: color.value, backgroundColor: isDark ? 'rgba(15, 23, 42, 0.9)' : color.light } : null,
        ],
        swatchStyle: [styles.colorSwatch, { backgroundColor: color.value }],
        titleStyle: [
          styles.optionTitle,
          isSelected ? styles.optionTitleSelected : null,
          isSelected ? { color: color.value } : null,
        ],
        checkStyle: [styles.optionCheckBadge, { backgroundColor: color.value }],
      };

      return visuals;
    }, {} as Record<AvatarColorId, AvatarOptionVisual>);
  }, [isDark, selectedColor, styles]);

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={screenGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={overlayGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={handleBack}
            style={styles.iconButton}
            activeOpacity={0.84}
            testID="profile-back-button"
          >
            <ArrowLeft color="#fff" size={20} strokeWidth={2.5} />
          </TouchableOpacity>

          <View style={styles.headerTextBlock}>
            <View style={styles.headerTitleWrap}>
              <UserRound color="#fff" size={22} strokeWidth={2.4} />
              <Text style={styles.headerTitle}>Profile</Text>
            </View>
          </View>

          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <ResponsiveContainer>
            <ProfileHeroCard
              profileDisplayName={profileDisplayName}
              usernameLabel={usernameLabel}
              selectedSuitData={selectedSuitData}
              selectedColorData={selectedColorData}
              heroGradient={heroGradient}
              level={level}
              levelEntry={levelEntry}
              progress={levelProgress}
              isPlayerNameReady={isPlayerNameReady}
              canEditPlayerName={canEditPlayerName}
              onEditPlayerName={handleEditPlayerName}
              onOpenLevels={handleOpenLevels}
              selectedColorValue={selectedColorValue}
              styles={styles}
              theme={theme}
            />

          <TouchableOpacity
            onPress={() => router.push(LEADERBOARD_ROUTE)}
            accessibilityLabel="Open leaderboard"
            accessibilityRole="button"
            style={[
              styles.leaderboardButton,
              {
                backgroundColor: isDark ? 'rgba(99,102,241,0.1)' : 'rgba(99,102,241,0.06)',
                borderColor: isDark ? 'rgba(99,102,241,0.2)' : 'rgba(99,102,241,0.15)',
              },
            ]}
            activeOpacity={0.84}
            testID="profile-leaderboard-button"
          >
            <Crown color={isDark ? '#818CF8' : '#6366F1'} size={18} strokeWidth={2.2} />
            <Text style={[styles.leaderboardButtonText, { color: isDark ? '#818CF8' : '#6366F1' }]}>Leaderboard</Text>
          </TouchableOpacity>

          <ProfileTabBar
            activeTab={activeTab}
            onSelectTab={handleSelectTab}
            tabActiveGradient={tabActiveGradient}
            styles={styles}
            theme={theme}
          />

          {activeTab === 'overview' && (
            <OverviewTab
              isDark={isDark}
              toggleTheme={toggleTheme}
              onOpenFAQ={handleOpenFAQ}
              onOpenPrivacy={handleOpenPrivacy}
              onOpenSettings={handleOpenSettings}
              onOpenFlashcardInspector={handleOpenFlashcardInspector}
              surfaceGradient={surfaceGradient}
              styles={styles}
              theme={theme}
            />
          )}

          {activeTab === 'avatar' && (
            <AvatarTab
              selectedSuit={selectedSuit}
              selectedColor={selectedColor}
              selectedSuitData={selectedSuitData}
              selectedColorData={selectedColorData}
              suitOptionVisuals={suitOptionVisuals}
              colorOptionVisuals={colorOptionVisuals}
              avatarShowcaseGradient={avatarShowcaseGradient}
              onSelectSuit={handleSelectSuit}
              onSelectColor={handleSelectColor}
              styles={styles}
            />
          )}

          {activeTab === 'awards' && (
            <AwardsTab
              achievements={achievements}
              completedAchievements={completedAchievements}
              nextAchievement={nextAchievement}
              achievementCategories={ACHIEVEMENT_CATEGORIES}
              activeAchievementCategory={activeAchievementCategory}
              activeAchievementCategoryLabel={activeAchievementCategoryEntry.label}
              activeCategoryAchievements={activeCategoryAchievements}
              activeCategoryCompletedAchievements={activeCategoryCompletedAchievements}
              onSelectAchievementCategory={handleSelectAchievementCategory}
              achievementCategoryFade={achievementCategoryFade}
              isDark={isDark}
              surfaceGradient={surfaceGradient}
              styles={styles}
              theme={theme}
            />
          )}
          </ResponsiveContainer>
        </ScrollView>
      </SafeAreaView>

      <PlayerNameModal
        visible={isEditingPlayerName}
        playerNameInput={playerNameInput}
        playerNameError={playerNameError}
        isPlayerNameReady={isPlayerNameReady}
        onChangeInput={handleChangePlayerNameInput}
        onSave={handleSavePlayerName}
        onCancel={handleCancelPlayerNameEdit}
        tabActiveGradient={tabActiveGradient}
        styles={styles}
        theme={theme}
      />

      <LevelsModal
        visible={showLevels}
        level={level}
        levelEntry={levelEntry}
        levels={LEVELS}
        onClose={handleCloseLevels}
        styles={styles}
        theme={theme}
        isDark={isDark}
      />
    </View>
  );
}

const createStyles = (theme: Theme, isDark: boolean, width: number) => {
  const cardSurface = isDark ? 'rgba(15, 23, 42, 0.78)' : 'rgba(255, 255, 255, 0.94)';
  const optionWidth = Math.min(Math.max((width - 56) / 2, 138), 220);
  const stackUtilityCards = width < 390;

  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    safeArea: {
      flex: 1,
    },
    header: {
      paddingHorizontal: 20,
      paddingTop: 10,
      paddingBottom: 12,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    iconButton: {
      width: 46,
      height: 46,
      borderRadius: 16,
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.14)' : 'rgba(255, 255, 255, 0.22)',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255, 255, 255, 0.18)' : 'rgba(255, 255, 255, 0.28)',
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: isDark ? 0.24 : 0.08,
      shadowRadius: 14,
      elevation: isDark ? 6 : 3,
    },
    headerTextBlock: {
      alignItems: 'center',
      justifyContent: 'center',
      flex: 1,
    },
    headerTitleWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      paddingHorizontal: 18,
      paddingVertical: 12,
      borderRadius: 18,
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.14)' : 'rgba(255, 255, 255, 0.22)',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.32)',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: isDark ? 0.2 : 0.08,
      shadowRadius: 14,
      elevation: isDark ? 5 : 2,
    },
    headerSpacer: {
      width: 46,
      height: 46,
    },
    headerEyebrow: {
      fontSize: 11,
      fontWeight: '700' as const,
      color: 'rgba(255, 255, 255, 0.78)',
      letterSpacing: 1,
      textTransform: 'uppercase' as const,
    },
    headerTitle: {
      fontSize: 22,
      fontWeight: '800' as const,
      color: '#fff',
      letterSpacing: -0.4,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: 20,
      paddingBottom: 32,
      gap: 14,
    },
    leaderboardButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 12,
      paddingHorizontal: 20,
      borderRadius: 14,
      borderWidth: 1,
      marginTop: -2,
    },
    leaderboardButtonText: {
      fontSize: 15,
      fontWeight: '700' as const,
    },
    heroCard: {
      borderRadius: 24,
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 16 },
      shadowOpacity: isDark ? 0.34 : 0.14,
      shadowRadius: 24,
      elevation: isDark ? 10 : 5,
    },
    heroCardGradient: {
      padding: 18,
      gap: 14,
    },
    heroTopRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 12,
    },
    heroIdentityRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
      gap: 12,
    },
    heroAvatar: {
      width: 72,
      height: 72,
      borderRadius: 22,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 2,
      borderColor: 'rgba(255, 255, 255, 0.26)',
      position: 'relative',
    },
    heroAvatarSymbol: {
      fontSize: 40,
      lineHeight: 46,
      color: '#fff',
    },
    heroIdentityText: {
      flex: 1,
      minWidth: 0,
    },
    heroEyebrow: {
      fontSize: 11,
      fontWeight: '700' as const,
      color: 'rgba(255, 255, 255, 0.78)',
      letterSpacing: 1,
      textTransform: 'uppercase' as const,
      marginBottom: 3,
    },
    heroNameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 3,
    },
    heroName: {
      flexShrink: 1,
      fontSize: 24,
      fontWeight: '800' as const,
      color: '#fff',
      letterSpacing: -0.7,
    },
    heroNameEditButton: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: 'rgba(255, 255, 255, 0.16)',
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.22)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    heroSubtitle: {
      fontSize: 14,
      fontWeight: '600' as const,
      color: 'rgba(255, 255, 255, 0.9)',
    },
    heroLevelBadge: {
      paddingHorizontal: 12,
      paddingVertical: 9,
      borderRadius: 14,
      backgroundColor: 'rgba(255, 255, 255, 0.16)',
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.18)',
      minWidth: 66,
      alignItems: 'center',
    },
    heroLevelBadgeText: {
      fontSize: 12,
      fontWeight: '800' as const,
      color: '#fff',
      letterSpacing: 0.4,
      textTransform: 'uppercase' as const,
    },
    heroProgressBlock: {
      gap: 8,
    },
    heroProgressLabelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    heroProgressLabel: {
      fontSize: 11,
      fontWeight: '700' as const,
      color: 'rgba(255, 255, 255, 0.74)',
      letterSpacing: 0.8,
      textTransform: 'uppercase' as const,
    },
    heroProgressValue: {
      fontSize: 12,
      fontWeight: '700' as const,
      color: 'rgba(255, 255, 255, 0.94)',
    },
    heroProgressTrack: {
      height: 4,
      borderRadius: 999,
      overflow: 'hidden',
      backgroundColor: 'rgba(255, 255, 255, 0.2)',
    },
    heroProgressFill: {
      height: '100%',
      borderRadius: 999,
    },
    heroBottomRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    heroMetaPill: {
      flex: 1,
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 10,
      backgroundColor: 'rgba(255, 255, 255, 0.14)',
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.16)',
    },
    heroMetaText: {
      fontSize: 12,
      fontWeight: '700' as const,
      color: 'rgba(255, 255, 255, 0.92)',
      textAlign: 'center' as const,
    },
    tabs: {
      flexDirection: 'row',
      backgroundColor: theme.profileTabBackground,
      padding: 5,
      borderRadius: 20,
      gap: 6,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(148, 163, 184, 0.18)' : 'rgba(255, 255, 255, 0.42)',
    },
    tab: {
      flex: 1,
      minWidth: 0,
      minHeight: 52,
      borderRadius: 16,
      overflow: 'hidden',
      position: 'relative',
    },
    tabActiveBackground: {
      ...StyleSheet.absoluteFillObject,
    },
    tabContentWrap: {
      minHeight: 52,
      paddingHorizontal: 10,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
    },
    tabText: {
      flexShrink: 1,
      fontSize: 12,
      fontWeight: '700' as const,
      color: theme.profileTabInactiveText,
      textAlign: 'center' as const,
    },
    tabTextActive: {
      color: theme.profileTabActiveText,
    },
    tabContent: {
      gap: 12,
    },
    cardShell: {
      borderRadius: 24,
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: isDark ? 0.22 : 0.08,
      shadowRadius: 18,
      elevation: isDark ? 7 : 3,
    },
    appearanceCard: {
      padding: 18,
      gap: 16,
    },
    appearanceHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 12,
    },
    appearanceIntro: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
    },
    appearanceIconWrap: {
      width: 42,
      height: 42,
      borderRadius: 14,
      justifyContent: 'center',
      alignItems: 'center',
    },
    appearanceTextWrap: {
      flex: 1,
      gap: 4,
    },
    cardTitle: {
      fontSize: 20,
      fontWeight: '800' as const,
      color: theme.text,
      letterSpacing: -0.4,
    },
    cardDescription: {
      fontSize: 13,
      fontWeight: '500' as const,
      color: theme.textSecondary,
      lineHeight: 18,
    },
    inlineActionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderRadius: 12,
      backgroundColor: isDark ? 'rgba(148, 163, 184, 0.1)' : 'rgba(15, 23, 42, 0.05)',
      alignSelf: 'flex-start',
    },
    inlineActionButtonText: {
      fontSize: 12,
      fontWeight: '700' as const,
      color: theme.textSecondary,
      textTransform: 'uppercase' as const,
      letterSpacing: 0.5,
    },
    playerNameSummaryCard: {
      padding: 16,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(148, 163, 184, 0.16)' : 'rgba(15, 23, 42, 0.08)',
      backgroundColor: isDark ? 'rgba(2, 6, 23, 0.18)' : 'rgba(99, 102, 241, 0.05)',
      gap: 6,
    },
    playerNameSummaryLabel: {
      fontSize: 11,
      fontWeight: '700' as const,
      color: theme.textTertiary,
      letterSpacing: 0.8,
      textTransform: 'uppercase' as const,
    },
    playerNameSummaryValue: {
      fontSize: 24,
      fontWeight: '800' as const,
      color: theme.text,
      letterSpacing: -0.6,
    },
    playerNameSummaryValueEmpty: {
      color: theme.textSecondary,
    },
    playerNameSummaryHint: {
      fontSize: 13,
      fontWeight: '500' as const,
      color: theme.textSecondary,
      lineHeight: 18,
    },
    playerNameModalCard: {
      marginTop: 'auto',
      borderTopLeftRadius: 30,
      borderTopRightRadius: 30,
      paddingTop: 24,
      paddingHorizontal: 20,
      paddingBottom: 36,
      gap: 10,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -10 },
      shadowOpacity: 0.2,
      shadowRadius: 18,
      elevation: 12,
    },
    playerNameModalEyebrow: {
      fontSize: 12,
      fontWeight: '700' as const,
      color: theme.textTertiary,
      textTransform: 'uppercase' as const,
      letterSpacing: 0.8,
    },
    playerNameModalTitle: {
      fontSize: 24,
      fontWeight: '800' as const,
      color: theme.text,
      letterSpacing: -0.5,
    },
    playerNameModalSubtitle: {
      fontSize: 14,
      fontWeight: '500' as const,
      color: theme.textSecondary,
      lineHeight: 20,
      marginBottom: 4,
    },
    playerNameEditor: {
      gap: 12,
    },
    playerNameInput: {
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: isDark ? 'rgba(2, 6, 23, 0.24)' : 'rgba(255, 255, 255, 0.9)',
      color: theme.text,
      fontSize: 16,
      fontWeight: '600' as const,
      paddingHorizontal: 16,
      paddingVertical: 14,
    },
    playerNameHelper: {
      fontSize: 12,
      fontWeight: '500' as const,
      color: theme.textTertiary,
    },
    playerNameErrorText: {
      color: theme.error,
    },
    playerNameActions: {
      flexDirection: 'row',
      gap: 12,
    },
    playerNameSecondaryButton: {
      flex: 1,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(148, 163, 184, 0.18)' : 'rgba(15, 23, 42, 0.08)',
      backgroundColor: isDark ? 'rgba(2, 6, 23, 0.16)' : 'rgba(15, 23, 42, 0.04)',
      minHeight: 48,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 14,
    },
    playerNameSecondaryButtonText: {
      fontSize: 15,
      fontWeight: '700' as const,
      color: theme.textSecondary,
    },
    playerNamePrimaryButton: {
      flex: 1,
      borderRadius: 16,
      overflow: 'hidden',
    },
    playerNamePrimaryGradient: {
      minHeight: 48,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 14,
    },
    playerNamePrimaryButtonText: {
      fontSize: 15,
      fontWeight: '800' as const,
      color: '#fff',
    },
    debugButton: {
      alignSelf: 'flex-start',
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(148, 163, 184, 0.2)' : 'rgba(15, 23, 42, 0.08)',
      backgroundColor: isDark ? 'rgba(15, 23, 42, 0.42)' : 'rgba(255, 255, 255, 0.72)',
    },
    debugButtonText: {
      fontSize: 13,
      fontWeight: '700' as const,
      color: theme.text,
    },
    toggleCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      borderRadius: 18,
      padding: 14,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(148, 163, 184, 0.16)' : 'rgba(15, 23, 42, 0.08)',
      backgroundColor: isDark ? 'rgba(2, 6, 23, 0.18)' : 'rgba(99, 102, 241, 0.05)',
    },
    toggleLeadingIcon: {
      width: 38,
      height: 38,
      borderRadius: 12,
      backgroundColor: isDark ? 'rgba(129, 140, 248, 0.12)' : 'rgba(102, 126, 234, 0.12)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    toggleTextWrap: {
      flex: 1,
      gap: 3,
    },
    toggleTitle: {
      fontSize: 15,
      fontWeight: '800' as const,
      color: theme.text,
    },
    toggleSubtitle: {
      fontSize: 12,
      fontWeight: '500' as const,
      color: theme.textSecondary,
      lineHeight: 17,
    },
    utilityGrid: {
      flexDirection: stackUtilityCards ? 'column' : 'row',
      gap: 12,
    },
    utilityCard: {
      flex: 1,
      borderRadius: 22,
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: isDark ? 0.2 : 0.07,
      shadowRadius: 16,
      elevation: isDark ? 6 : 3,
    },
    utilityCardGradient: {
      minHeight: 156,
      padding: 16,
      gap: 10,
      justifyContent: 'space-between',
    },
    utilityIconWrap: {
      width: 40,
      height: 40,
      borderRadius: 14,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: isDark ? 'rgba(129, 140, 248, 0.12)' : 'rgba(102, 126, 234, 0.1)',
    },
    utilityTitle: {
      fontSize: 18,
      fontWeight: '800' as const,
      color: theme.text,
      letterSpacing: -0.4,
    },
    utilityDescription: {
      fontSize: 13,
      fontWeight: '500' as const,
      color: theme.textSecondary,
      lineHeight: 18,
      flex: 1,
    },
    utilityTag: {
      fontSize: 11,
      fontWeight: '800' as const,
      color: theme.primary,
      textTransform: 'uppercase' as const,
      letterSpacing: 0.8,
    },
    sectionBanner: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 12,
      marginTop: 2,
    },
    sectionBannerTextWrap: {
      flex: 1,
      gap: 3,
    },
    sectionBannerEyebrow: {
      fontSize: 11,
      fontWeight: '700' as const,
      color: 'rgba(255, 255, 255, 0.72)',
      textTransform: 'uppercase' as const,
      letterSpacing: 0.9,
    },
    sectionBannerTitle: {
      fontSize: 24,
      fontWeight: '800' as const,
      color: '#fff',
      letterSpacing: -0.6,
    },
    sectionBannerSubtitle: {
      fontSize: 13,
      fontWeight: '500' as const,
      color: 'rgba(255, 255, 255, 0.76)',
      lineHeight: 18,
    },
    sectionBannerBadge: {
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 999,
      backgroundColor: 'rgba(255, 255, 255, 0.14)',
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.16)',
    },
    sectionBannerBadgeText: {
      fontSize: 12,
      fontWeight: '700' as const,
      color: '#fff',
    },
    achievementCategoryScroll: {
      marginTop: 4,
    },
    achievementCategoryScrollContent: {
      flexDirection: 'row',
      gap: 12,
      paddingRight: 4,
    },
    achievementCategoryPill: {
      minHeight: 36,
      paddingHorizontal: 14,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.cardBackground,
    },
    achievementCategoryPillActive: {
      backgroundColor: theme.primary,
      borderColor: theme.primary,
    },
    achievementCategoryPillText: {
      fontSize: 13,
      fontWeight: '600' as const,
      color: theme.textSecondary,
    },
    achievementCategoryPillTextActive: {
      color: '#fff',
    },
    achievementCategorySummary: {
      marginTop: 12,
    },
    achievementCategorySummaryText: {
      fontSize: 13,
      fontWeight: '700' as const,
      color: isDark ? 'rgba(226, 232, 240, 0.84)' : 'rgba(255, 255, 255, 0.975)',
    },
    achievementCategoryCards: {
      marginTop: 12,
      gap: 12,
    },
    achievementCard: {
      borderRadius: 22,
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: isDark ? 0.2 : 0.07,
      shadowRadius: 16,
      elevation: isDark ? 6 : 3,
    },
    achievementCardGradient: {
      padding: 16,
      gap: 12,
    },
    achievementHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
    },
    achievementIconWrap: {
      width: 42,
      height: 42,
      borderRadius: 14,
      justifyContent: 'center',
      alignItems: 'center',
    },
    achievementTextWrap: {
      flex: 1,
      gap: 4,
    },
    achievementName: {
      fontSize: 16,
      fontWeight: '800' as const,
      color: theme.text,
      letterSpacing: -0.2,
    },
    achievementDescription: {
      fontSize: 13,
      fontWeight: '500' as const,
      color: theme.textSecondary,
      lineHeight: 18,
    },
    achievementXpBadge: {
      minWidth: 54,
      paddingHorizontal: 10,
      paddingVertical: 7,
      borderRadius: 12,
      backgroundColor: isDark ? 'rgba(245, 158, 11, 0.18)' : 'rgba(245, 158, 11, 0.14)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    achievementXpBadgeCompleted: {
      backgroundColor: 'rgba(16, 185, 129, 0.18)',
    },
    achievementXpText: {
      fontSize: 13,
      fontWeight: '800' as const,
      color: theme.warning,
    },
    achievementTrack: {
      height: 8,
      borderRadius: 999,
      overflow: 'hidden',
      backgroundColor: isDark ? 'rgba(148, 163, 184, 0.22)' : 'rgba(15, 23, 42, 0.08)',
    },
    achievementFill: {
      height: '100%',
      borderRadius: 999,
    },
    achievementFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
    },
    achievementProgressText: {
      fontSize: 13,
      fontWeight: '700' as const,
      color: theme.textSecondary,
    },
    achievementRemainingText: {
      fontSize: 13,
      fontWeight: '700' as const,
      color: theme.textTertiary,
    },
    achievementCompletedPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor: '#10B981',
    },
    achievementCompletedPillText: {
      fontSize: 12,
      fontWeight: '800' as const,
      color: '#fff',
    },
    avatarShowcaseCard: {
      borderRadius: 24,
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 14 },
      shadowOpacity: isDark ? 0.3 : 0.12,
      shadowRadius: 20,
      elevation: isDark ? 9 : 4,
    },
    avatarShowcaseGradient: {
      padding: 18,
      gap: 14,
    },
    avatarShowcaseHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 12,
    },
    avatarShowcaseBadge: {
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 999,
      backgroundColor: 'rgba(255, 255, 255, 0.16)',
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.2)',
    },
    avatarShowcaseBadgeText: {
      fontSize: 12,
      fontWeight: '700' as const,
      color: '#fff',
    },
    avatarShowcaseHint: {
      fontSize: 12,
      fontWeight: '600' as const,
      color: 'rgba(255, 255, 255, 0.86)',
      textAlign: 'right' as const,
    },
    avatarShowcaseBody: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
    },
    avatarShowcaseTile: {
      width: 76,
      height: 76,
      borderRadius: 22,
      backgroundColor: 'rgba(255, 255, 255, 0.16)',
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.18)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    avatarShowcaseSymbol: {
      fontSize: 46,
      lineHeight: 52,
      color: '#fff',
    },
    avatarShowcaseTextBlock: {
      flex: 1,
      gap: 5,
    },
    avatarShowcaseTitle: {
      fontSize: 21,
      fontWeight: '800' as const,
      color: '#fff',
      letterSpacing: -0.5,
    },
    avatarShowcaseDescription: {
      fontSize: 13,
      fontWeight: '500' as const,
      color: 'rgba(255, 255, 255, 0.84)',
      lineHeight: 19,
    },
    sectionHeader: {
      gap: 3,
      marginTop: 2,
    },
    sectionTitle: {
      fontSize: 20,
      fontWeight: '800' as const,
      color: '#fff',
      letterSpacing: -0.4,
    },
    sectionSubtitle: {
      fontSize: 13,
      fontWeight: '500' as const,
      color: 'rgba(255, 255, 255, 0.74)',
      lineHeight: 18,
    },
    optionGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
    },
    optionPressable: {
      borderRadius: 20,
    },
    optionCard: {
      width: optionWidth,
      borderRadius: 20,
      paddingVertical: 16,
      paddingHorizontal: 14,
      backgroundColor: cardSurface,
      borderWidth: 1.5,
      borderColor: isDark ? 'rgba(148, 163, 184, 0.14)' : 'rgba(255, 255, 255, 0.38)',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      minHeight: 126,
    },
    optionCardSelected: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: isDark ? 0.24 : 0.1,
      shadowRadius: 16,
      elevation: isDark ? 6 : 3,
    },
    optionCardPressed: {
      transform: [{ scale: 0.985 }],
    },
    optionSymbol: {
      fontSize: 44,
      lineHeight: 50,
      marginBottom: 8,
    },
    colorSwatch: {
      width: 48,
      height: 48,
      borderRadius: 15,
      marginBottom: 10,
      borderWidth: 2,
      borderColor: 'rgba(255, 255, 255, 0.32)',
    },
    optionTitle: {
      fontSize: 16,
      fontWeight: '700' as const,
      color: theme.text,
      marginBottom: 4,
    },
    optionTitleSelected: {
      fontWeight: '800' as const,
    },
    optionDescription: {
      fontSize: 12,
      fontWeight: '500' as const,
      color: theme.textSecondary,
      textAlign: 'center' as const,
    },
    optionCheckBadge: {
      position: 'absolute',
      top: 12,
      right: 12,
      width: 22,
      height: 22,
      borderRadius: 11,
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalOverlay: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: theme.modalOverlay,
    },
    settingsSheet: {
      borderTopLeftRadius: 30,
      borderTopRightRadius: 30,
      paddingTop: 10,
      paddingHorizontal: 20,
      paddingBottom: 36,
      gap: 18,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -10 },
      shadowOpacity: 0.2,
      shadowRadius: 18,
      elevation: 12,
    },
    sheetHandle: {
      alignSelf: 'center',
      width: 44,
      height: 5,
      borderRadius: 999,
      backgroundColor: theme.sheetHandle,
      marginBottom: 8,
    },
    settingsSheetHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 16,
    },
    settingsSheetEyebrow: {
      fontSize: 12,
      fontWeight: '700' as const,
      color: theme.textTertiary,
      textTransform: 'uppercase' as const,
      letterSpacing: 0.8,
      marginBottom: 3,
    },
    settingsSheetTitle: {
      fontSize: 24,
      fontWeight: '800' as const,
      color: theme.text,
      letterSpacing: -0.5,
    },
    settingsCloseButton: {
      width: 40,
      height: 40,
      borderRadius: 14,
      backgroundColor: isDark ? 'rgba(148, 163, 184, 0.1)' : 'rgba(15, 23, 42, 0.05)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    settingsCloseText: {
      fontSize: 24,
      lineHeight: 24,
      color: theme.textSecondary,
    },
    themePickerRow: {
      gap: 12,
    },
    themeModeButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      padding: 16,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: isDark ? 'rgba(15, 23, 42, 0.48)' : 'rgba(15, 23, 42, 0.03)',
    },
    themeModeButtonActive: {
      borderColor: theme.primary,
      backgroundColor: isDark ? 'rgba(99, 102, 241, 0.16)' : 'rgba(102, 126, 234, 0.12)',
    },
    themeModeIconWrap: {
      width: 42,
      height: 42,
      borderRadius: 14,
      backgroundColor: isDark ? 'rgba(148, 163, 184, 0.1)' : 'rgba(15, 23, 42, 0.05)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    themeModeIconWrapActive: {
      backgroundColor: theme.primary,
    },
    themeModeTextWrap: {
      flex: 1,
      gap: 3,
    },
    themeModeTitle: {
      fontSize: 17,
      fontWeight: '800' as const,
      color: theme.text,
    },
    themeModeTitleActive: {
      color: theme.primary,
    },
    themeModeSubtitle: {
      fontSize: 13,
      fontWeight: '500' as const,
      color: theme.textSecondary,
    },
    settingsToggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 4,
      gap: 16,
    },
    settingsToggleTextWrap: {
      flex: 1,
      gap: 3,
    },
    settingsToggleTitle: {
      fontSize: 17,
      fontWeight: '800' as const,
      color: theme.text,
    },
    settingsToggleSubtitle: {
      fontSize: 13,
      fontWeight: '500' as const,
      color: theme.textSecondary,
    },
    levelModalOverlay: {
      flex: 1,
      justifyContent: 'center',
      paddingHorizontal: 20,
      backgroundColor: theme.modalOverlay,
    },
    levelModalCard: {
      borderRadius: 28,
      padding: 18,
      maxHeight: '78%',
      gap: 16,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 14 },
      shadowOpacity: 0.24,
      shadowRadius: 22,
      elevation: 12,
    },
    levelModalHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 12,
    },
    levelModalTitleWrap: {
      flex: 1,
      gap: 4,
    },
    levelModalEyebrow: {
      fontSize: 11,
      fontWeight: '700' as const,
      color: theme.textTertiary,
      textTransform: 'uppercase' as const,
      letterSpacing: 0.9,
    },
    levelModalTitle: {
      fontSize: 24,
      fontWeight: '800' as const,
      color: theme.text,
      letterSpacing: -0.6,
    },
    levelModalSubtitle: {
      fontSize: 13,
      fontWeight: '500' as const,
      color: theme.textSecondary,
      lineHeight: 18,
    },
    levelList: {
      gap: 10,
      paddingBottom: 4,
    },
    levelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 14,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(148, 163, 184, 0.12)' : 'rgba(15, 23, 42, 0.08)',
      backgroundColor: isDark ? 'rgba(15, 23, 42, 0.46)' : 'rgba(15, 23, 42, 0.03)',
    },
    levelRowCurrent: {
      borderColor: theme.primary,
      backgroundColor: isDark ? 'rgba(99, 102, 241, 0.16)' : 'rgba(102, 126, 234, 0.1)',
    },
    levelRowReached: {
      borderColor: isDark ? 'rgba(16, 185, 129, 0.22)' : 'rgba(16, 185, 129, 0.14)',
    },
    levelBadge: {
      minWidth: 58,
      paddingHorizontal: 10,
      paddingVertical: 9,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? 'rgba(148, 163, 184, 0.12)' : 'rgba(15, 23, 42, 0.06)',
    },
    levelBadgeReached: {
      backgroundColor: isDark ? 'rgba(16, 185, 129, 0.14)' : 'rgba(16, 185, 129, 0.1)',
    },
    levelBadgeText: {
      fontSize: 12,
      fontWeight: '800' as const,
      color: theme.textSecondary,
      textTransform: 'uppercase' as const,
      letterSpacing: 0.4,
    },
    levelBadgeTextCurrent: {
      color: '#fff',
    },
    levelRowTextWrap: {
      flex: 1,
      gap: 2,
    },
    levelRowTitle: {
      fontSize: 15,
      fontWeight: '800' as const,
      color: theme.text,
    },
    levelRowSubtitle: {
      fontSize: 12,
      fontWeight: '500' as const,
      color: theme.textSecondary,
      lineHeight: 17,
    },
    levelRowMeta: {
      fontSize: 11,
      fontWeight: '700' as const,
      color: theme.textTertiary,
      letterSpacing: 0.3,
      textTransform: 'uppercase' as const,
    },
    levelReachedPill: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: '#10B981',
      justifyContent: 'center',
      alignItems: 'center',
    },
  });
};
