import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { ArrowLeft, Award, BookOpen, Check, ChevronRight, Crown, Flame, Moon, Settings, Sun, User, Zap } from 'lucide-react-native';
import React, { useCallback, useMemo, useState } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  AVATAR_COLORS,
  AVATAR_SUITS,
  type AvatarColorId,
  type AvatarSuitId,
} from '@/constants/avatar';
import { Theme } from '@/constants/colors';
import { useAvatar } from '@/context/AvatarContext';
import { useFlashQuest } from '@/context/FlashQuestContext';
import { useTheme } from '@/context/ThemeContext';
import { logger } from '@/utils/logger';

type TabType = 'overview' | 'achievements' | 'avatar';

type IconComponent = React.ComponentType<{
  color?: string;
  size?: number;
  strokeWidth?: number;
}>;

interface AchievementItem {
  id: string;
  name: string;
  description: string;
  xp: number;
  progress: number;
  total: number;
  color: string;
  icon: IconComponent;
}

const PROFILE_TABS: ReadonlyArray<{ id: TabType; label: string; icon: IconComponent }> = [
  { id: 'overview', label: 'Overview', icon: User },
  { id: 'achievements', label: 'Awards', icon: Award },
  { id: 'avatar', label: 'Avatar', icon: Zap },
];

const ACHIEVEMENTS: readonly AchievementItem[] = [
  {
    id: 'first_steps',
    name: 'First Steps',
    description: 'Complete your first flashcard session',
    xp: 50,
    progress: 1,
    total: 1,
    color: '#4ECDC4',
    icon: BookOpen,
  },
  {
    id: 'quick_draw',
    name: 'Quick Draw',
    description: 'Answer 10 questions in under 5 seconds each',
    xp: 100,
    progress: 7,
    total: 10,
    color: '#667EEA',
    icon: Zap,
  },
  {
    id: 'fire_streak',
    name: 'Fire Streak',
    description: 'Maintain a 7-day study streak',
    xp: 200,
    progress: 7,
    total: 7,
    color: '#FF6B6B',
    icon: Flame,
  },
  {
    id: 'knowledge_master',
    name: 'Knowledge Master',
    description: 'Complete 50 flashcard sessions',
    xp: 500,
    progress: 12,
    total: 50,
    color: '#F093FB',
    icon: Crown,
  },
] as const;

function getRankTitle(level: number): string {
  if (level >= 20) {
    return 'Legend of the Deck';
  }

  if (level >= 14) {
    return 'Mythic Scholar';
  }

  if (level >= 9) {
    return 'Arena Strategist';
  }

  if (level >= 5) {
    return 'Quest Challenger';
  }

  return 'Rookie Explorer';
}

export default function ProfilePage() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { stats } = useFlashQuest();
  const { theme, isDark, toggleTheme, setTheme } = useTheme();
  const { selectedSuit, selectedColor, setSelectedSuit, setSelectedColor } = useAvatar();
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [showSettings, setShowSettings] = useState<boolean>(false);

  const level = Math.floor(stats.totalScore / 300) + 1;
  const selectedSuitData = AVATAR_SUITS.find((suit) => suit.id === selectedSuit) ?? AVATAR_SUITS[0]!;
  const selectedColorData = AVATAR_COLORS.find((color) => color.id === selectedColor) ?? AVATAR_COLORS[1]!;

  const styles = useMemo(() => createStyles(theme, isDark, width), [theme, isDark, width]);

  const screenGradient = useMemo(
    () => [theme.gradientStart, theme.gradientMid, theme.gradientEnd] as [string, string, string],
    [theme.gradientStart, theme.gradientMid, theme.gradientEnd]
  );

  const heroGradient = useMemo(
    () => [theme.questGradient[0], theme.questGradient[1], theme.arenaGradient[0]] as [string, string, string],
    [theme.questGradient, theme.arenaGradient]
  );

  const surfaceGradient = useMemo(
    () =>
      (
        isDark
          ? ['rgba(30, 41, 59, 0.96)', 'rgba(15, 23, 42, 0.94)']
          : ['rgba(255, 255, 255, 0.96)', 'rgba(255, 255, 255, 0.9)']
      ) as [string, string],
    [isDark]
  );

  const awardsGradient = useMemo(
    () =>
      (
        isDark
          ? ['rgba(79, 70, 229, 0.42)', 'rgba(249, 115, 22, 0.28)']
          : ['rgba(99, 102, 241, 0.22)', 'rgba(249, 115, 22, 0.18)']
      ) as [string, string],
    [isDark]
  );

  const rankTitle = useMemo(() => getRankTitle(level), [level]);

  const completedAchievements = useMemo(
    () => ACHIEVEMENTS.filter((achievement) => achievement.progress >= achievement.total).length,
    []
  );

  const nextAchievement = useMemo(
    () => ACHIEVEMENTS.find((achievement) => achievement.progress < achievement.total) ?? null,
    []
  );

  const handleBack = useCallback(() => {
    logger.log('[Profile] Navigating back');
    router.back();
  }, [router]);

  const handleSelectTab = useCallback((tab: TabType) => {
    logger.log('[Profile] Switching tab to', tab);
    setActiveTab(tab);
  }, []);

  const handleOpenSettings = useCallback(() => {
    logger.log('[Profile] Opening settings sheet');
    setShowSettings(true);
  }, []);

  const handleCloseSettings = useCallback(() => {
    logger.log('[Profile] Closing settings sheet');
    setShowSettings(false);
  }, []);

  const handleSelectSuit = useCallback(
    (suitId: AvatarSuitId) => {
      logger.log('[Profile] Selecting avatar suit', suitId);
      setSelectedSuit(suitId);
    },
    [setSelectedSuit]
  );

  const handleSelectColor = useCallback(
    (colorId: AvatarColorId) => {
      logger.log('[Profile] Selecting avatar color', colorId);
      setSelectedColor(colorId);
    },
    [setSelectedColor]
  );

  const handleSetLightTheme = useCallback(() => {
    logger.log('[Profile] Setting theme mode to light');
    setTheme('light');
  }, [setTheme]);

  const handleSetDarkTheme = useCallback(() => {
    logger.log('[Profile] Setting theme mode to dark');
    setTheme('dark');
  }, [setTheme]);

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={screenGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={
          isDark
            ? ['rgba(2, 6, 23, 0.16)', 'rgba(2, 6, 23, 0.56)', 'rgba(2, 6, 23, 0.84)']
            : ['rgba(255, 255, 255, 0.05)', 'rgba(255, 255, 255, 0.12)', 'rgba(255, 255, 255, 0.18)']
        }
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={handleBack}
            style={styles.iconButton}
            activeOpacity={0.82}
            testID="profile-back-button"
          >
            <ArrowLeft color="#fff" size={20} strokeWidth={2.5} />
          </TouchableOpacity>

          <View style={styles.headerTextBlock}>
            <Text style={styles.headerEyebrow}>FlashQuest</Text>
            <Text style={styles.headerTitle}>Profile</Text>
          </View>

          <TouchableOpacity
            onPress={handleOpenSettings}
            style={styles.iconButton}
            activeOpacity={0.82}
            testID="profile-open-settings"
          >
            <Settings color="#fff" size={19} strokeWidth={2.4} />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.heroCard}>
            <LinearGradient
              colors={heroGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.heroCardGradient}
            >
              <View style={styles.heroTopRow}>
                <View style={styles.heroIdentityRow}>
                  <View style={[styles.heroAvatar, { backgroundColor: selectedColorData.value }]}> 
                    <Text style={styles.heroAvatarSymbol}>{selectedSuitData.symbol}</Text>
                    <View style={styles.heroAvatarBadge}>
                      <Zap color="#fff" size={12} strokeWidth={2.8} />
                    </View>
                  </View>

                  <View style={styles.heroIdentityText}>
                    <Text style={styles.heroEyebrow}>FlashQuest Profile</Text>
                    <Text style={styles.heroName}>FlashQuest Player</Text>
                    <Text style={styles.heroSubtitle}>{rankTitle}</Text>
                  </View>
                </View>

                <View style={styles.heroLevelBadge}>
                  <Text style={styles.heroLevelBadgeText}>Lv {level}</Text>
                </View>
              </View>

              <View style={styles.heroBottomRow}>
                <View style={styles.heroMetaPill}>
                  <Text style={styles.heroMetaText}>
                    {selectedColorData.name} {selectedSuitData.name}
                  </Text>
                </View>

                <TouchableOpacity
                  style={styles.heroEditButton}
                  onPress={() => handleSelectTab('avatar')}
                  activeOpacity={0.84}
                  testID="profile-hero-edit-avatar"
                >
                  <Text style={styles.heroEditButtonText}>Customize</Text>
                </TouchableOpacity>
              </View>
            </LinearGradient>
          </View>

          <View style={styles.tabs}>
            {PROFILE_TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              const Icon = tab.icon;

              return (
                <TouchableOpacity
                  key={tab.id}
                  style={styles.tab}
                  onPress={() => handleSelectTab(tab.id)}
                  activeOpacity={0.82}
                  testID={`profile-tab-${tab.id}`}
                >
                  {isActive && (
                    <LinearGradient
                      colors={theme.profileTabActiveGradient as [string, string]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.tabActiveBackground}
                    />
                  )}
                  <View style={styles.tabContentWrap}>
                    <Icon
                      color={isActive ? theme.profileTabActiveText : theme.profileTabIconInactive}
                      size={15}
                      strokeWidth={2.3}
                    />
                    <Text style={[styles.tabText, isActive && styles.tabTextActive]} numberOfLines={1}>
                      {tab.label}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          {activeTab === 'overview' && (
            <View style={styles.tabContent}>
              <View style={styles.quickActionsRow}>
                <TouchableOpacity
                  style={styles.overviewCard}
                  onPress={handleOpenSettings}
                  activeOpacity={0.9}
                  testID="profile-card-settings"
                >
                  <LinearGradient
                    colors={surfaceGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.overviewCardGradient}
                  >
                    <View
                      style={[
                        styles.overviewCardIcon,
                        { backgroundColor: isDark ? 'rgba(129, 140, 248, 0.24)' : 'rgba(102, 126, 234, 0.14)' },
                      ]}
                    >
                      <Settings color={theme.primary} size={20} strokeWidth={2.3} />
                    </View>
                    <Text style={styles.overviewCardTitle}>Appearance</Text>
                    <Text style={styles.overviewCardDescription} numberOfLines={2}>
                      Theme, mode, and profile preferences.
                    </Text>
                    <View style={styles.overviewCardFooter}>
                      <Text style={styles.overviewCardFooterText}>Open settings</Text>
                      <ChevronRight color={theme.textSecondary} size={16} strokeWidth={2.4} />
                    </View>
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.overviewCard}
                  onPress={() => handleSelectTab('achievements')}
                  activeOpacity={0.9}
                  testID="profile-card-achievement-summary"
                >
                  <LinearGradient
                    colors={awardsGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.overviewCardGradient}
                  >
                    <View style={[styles.overviewCardIcon, styles.overviewCardIconWarm]}>
                      <Award color="#fff" size={20} strokeWidth={2.3} />
                    </View>
                    <Text style={styles.overviewCardTitleLight}>Awards</Text>
                    <Text style={styles.overviewCardDescriptionLight} numberOfLines={2}>
                      {completedAchievements}/{ACHIEVEMENTS.length} unlocked
                      {nextAchievement ? ` · Next: ${nextAchievement.name}` : ' · All complete'}
                    </Text>
                    <View style={styles.overviewCardFooter}>
                      <Text style={styles.overviewCardFooterTextLight}>View progress</Text>
                      <ChevronRight color="#fff" size={16} strokeWidth={2.4} />
                    </View>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {activeTab === 'achievements' && (
            <View style={styles.tabContent}>
              <View style={styles.sectionBanner}>
                <View>
                  <Text style={styles.sectionBannerEyebrow}>Milestones</Text>
                  <Text style={styles.sectionBannerTitle}>Awards</Text>
                </View>
                <View style={styles.sectionBannerBadge}>
                  <Text style={styles.sectionBannerBadgeText}>{completedAchievements} complete</Text>
                </View>
              </View>

              {ACHIEVEMENTS.map((achievement) => {
                const isCompleted = achievement.progress >= achievement.total;
                const progressPercent = Math.min((achievement.progress / achievement.total) * 100, 100);
                const AchievementIcon = achievement.icon;

                return (
                  <View key={achievement.id} style={styles.achievementCard}>
                    <LinearGradient
                      colors={
                        isCompleted
                          ? (isDark
                              ? ['rgba(16, 185, 129, 0.28)', 'rgba(6, 95, 70, 0.5)']
                              : ['#ECFDF5', '#D1FAE5'])
                          : (theme.achievementBaseGradient as [string, string])
                      }
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.achievementCardGradient}
                    >
                      <View style={styles.achievementHeader}>
                        <View style={[styles.achievementIconWrap, { backgroundColor: achievement.color }]}> 
                          <AchievementIcon color="#fff" size={20} strokeWidth={2.2} />
                        </View>

                        <View style={styles.achievementTextWrap}>
                          <Text style={styles.achievementName}>{achievement.name}</Text>
                          <Text style={styles.achievementDescription}>{achievement.description}</Text>
                        </View>

                        <View style={[styles.achievementXpBadge, isCompleted && styles.achievementXpBadgeCompleted]}>
                          <Text style={styles.achievementXpText}>+{achievement.xp}</Text>
                        </View>
                      </View>

                      <View style={styles.achievementTrack}>
                        <View
                          style={[
                            styles.achievementFill,
                            {
                              width: `${progressPercent}%`,
                              backgroundColor: isCompleted ? '#10B981' : achievement.color,
                            },
                          ]}
                        />
                      </View>

                      <View style={styles.achievementFooter}>
                        <Text style={styles.achievementProgressText}>
                          {achievement.progress}/{achievement.total}
                        </Text>
                        {isCompleted ? (
                          <View style={styles.achievementCompletedPill}>
                            <Check color="#fff" size={11} strokeWidth={3} />
                            <Text style={styles.achievementCompletedPillText}>Unlocked</Text>
                          </View>
                        ) : (
                          <Text style={styles.achievementRemainingText}>
                            {achievement.total - achievement.progress} to go
                          </Text>
                        )}
                      </View>
                    </LinearGradient>
                  </View>
                );
              })}
            </View>
          )}

          {activeTab === 'avatar' && (
            <View style={styles.tabContent}>
              <View style={styles.avatarShowcaseCard}>
                <LinearGradient
                  colors={[selectedColorData.value, theme.primaryDark, theme.gradientEnd] as [string, string, string]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.avatarShowcaseGradient}
                >
                  <View style={styles.avatarShowcaseHeader}>
                    <View style={styles.avatarShowcaseBadge}>
                      <Text style={styles.avatarShowcaseBadgeText}>Equipped</Text>
                    </View>
                    <Text style={styles.avatarShowcaseHint}>Used across FlashQuest menus</Text>
                  </View>

                  <View style={styles.avatarShowcaseBody}>
                    <View style={styles.avatarShowcaseTile}>
                      <Text style={styles.avatarShowcaseSymbol}>{selectedSuitData.symbol}</Text>
                    </View>
                    <View style={styles.avatarShowcaseTextBlock}>
                      <Text style={styles.avatarShowcaseTitle}>
                        {selectedColorData.name} {selectedSuitData.name}
                      </Text>
                      <Text style={styles.avatarShowcaseDescription}>
                        Pick the badge that follows you through study, quests, and arena rooms.
                      </Text>
                    </View>
                  </View>
                </LinearGradient>
              </View>

              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Choose a suit</Text>
                <Text style={styles.sectionSubtitle}>Select the symbol shown on your player badge.</Text>
              </View>

              <View style={styles.optionGrid}>
                {AVATAR_SUITS.map((suit) => {
                  const isSelected = selectedSuit === suit.id;

                  return (
                    <TouchableOpacity
                      key={suit.id}
                      style={[
                        styles.optionCard,
                        isSelected && {
                          borderColor: selectedColorData.value,
                          backgroundColor: isDark ? 'rgba(15, 23, 42, 0.9)' : selectedColorData.light,
                        },
                      ]}
                      onPress={() => handleSelectSuit(suit.id)}
                      activeOpacity={0.86}
                      testID={`profile-avatar-suit-${suit.id}`}
                    >
                      <Text
                        style={[
                          styles.optionSymbol,
                          {
                            color: isSelected ? selectedColorData.value : isDark ? '#CBD5E1' : '#64748B',
                          },
                        ]}
                      >
                        {suit.symbol}
                      </Text>
                      <Text
                        style={[
                          styles.optionTitle,
                          isSelected && { color: selectedColorData.value, fontWeight: '800' as const },
                        ]}
                      >
                        {suit.name}
                      </Text>
                      <Text style={styles.optionDescription}>Tap to equip</Text>
                      {isSelected && (
                        <View style={[styles.optionCheckBadge, { backgroundColor: selectedColorData.value }]}>
                          <Check color="#fff" size={10} strokeWidth={3} />
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Choose a color</Text>
                <Text style={styles.sectionSubtitle}>This tint carries through your cards and player marker.</Text>
              </View>

              <View style={styles.optionGrid}>
                {AVATAR_COLORS.map((color) => {
                  const isSelected = selectedColor === color.id;

                  return (
                    <TouchableOpacity
                      key={color.id}
                      style={[
                        styles.optionCard,
                        isSelected && {
                          borderColor: color.value,
                          backgroundColor: isDark ? 'rgba(15, 23, 42, 0.9)' : color.light,
                        },
                      ]}
                      onPress={() => handleSelectColor(color.id)}
                      activeOpacity={0.86}
                      testID={`profile-avatar-color-${color.id}`}
                    >
                      <View style={[styles.colorSwatch, { backgroundColor: color.value }]} />
                      <Text
                        style={[
                          styles.optionTitle,
                          isSelected && { color: color.value, fontWeight: '800' as const },
                        ]}
                      >
                        {color.name}
                      </Text>
                      <Text style={styles.optionDescription}>Tap to equip</Text>
                      {isSelected && (
                        <View style={[styles.optionCheckBadge, { backgroundColor: color.value }]}>
                          <Check color="#fff" size={10} strokeWidth={3} />
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>

      <Modal
        visible={showSettings}
        transparent
        animationType="slide"
        onRequestClose={handleCloseSettings}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={handleCloseSettings}
            testID="profile-settings-overlay"
          />

          <View style={[styles.settingsSheet, { backgroundColor: theme.cardBackground }]}> 
            <View style={styles.sheetHandle} />

            <View style={styles.settingsSheetHeader}>
              <View>
                <Text style={styles.settingsSheetEyebrow}>Appearance</Text>
                <Text style={styles.settingsSheetTitle}>Settings & preferences</Text>
              </View>
              <TouchableOpacity
                onPress={handleCloseSettings}
                style={styles.settingsCloseButton}
                activeOpacity={0.8}
                testID="profile-close-settings"
              >
                <Text style={styles.settingsCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.themePickerRow}>
              <TouchableOpacity
                style={[styles.themeModeButton, !isDark && styles.themeModeButtonActive]}
                onPress={handleSetLightTheme}
                activeOpacity={0.86}
                testID="profile-theme-light"
              >
                <View style={[styles.themeModeIconWrap, !isDark && styles.themeModeIconWrapActive]}>
                  <Sun color={!isDark ? '#fff' : theme.primary} size={18} strokeWidth={2.3} />
                </View>
                <View style={styles.themeModeTextWrap}>
                  <Text style={[styles.themeModeTitle, !isDark && styles.themeModeTitleActive]}>Light</Text>
                  <Text style={styles.themeModeSubtitle}>Bright, airy menus</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.themeModeButton, isDark && styles.themeModeButtonActive]}
                onPress={handleSetDarkTheme}
                activeOpacity={0.86}
                testID="profile-theme-dark"
              >
                <View style={[styles.themeModeIconWrap, isDark && styles.themeModeIconWrapActive]}>
                  <Moon color={isDark ? '#fff' : theme.primary} size={18} strokeWidth={2.3} />
                </View>
                <View style={styles.themeModeTextWrap}>
                  <Text style={[styles.themeModeTitle, isDark && styles.themeModeTitleActive]}>Dark</Text>
                  <Text style={styles.themeModeSubtitle}>Low-light battle vibe</Text>
                </View>
              </TouchableOpacity>
            </View>

            <View style={styles.settingsToggleRow}>
              <View style={styles.settingsToggleTextWrap}>
                <Text style={styles.settingsToggleTitle}>Dark mode</Text>
                <Text style={styles.settingsToggleSubtitle}>
                  {isDark ? 'Dark theme enabled' : 'Light theme enabled'}
                </Text>
              </View>
              <Switch
                value={isDark}
                onValueChange={toggleTheme}
                trackColor={{ false: isDark ? '#475569' : '#CBD5E1', true: theme.primary }}
                thumbColor={theme.white}
                ios_backgroundColor={isDark ? '#475569' : '#CBD5E1'}
                testID="dark-mode-switch"
              />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (theme: Theme, isDark: boolean, width: number) => {
  const cardSurface = isDark ? 'rgba(15, 23, 42, 0.74)' : 'rgba(255, 255, 255, 0.94)';
  const optionWidth = Math.min(Math.max((width - 56) / 2, 136), 220);

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
      paddingTop: 8,
      paddingBottom: 10,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    iconButton: {
      width: 42,
      height: 42,
      borderRadius: 14,
      backgroundColor: 'rgba(255, 255, 255, 0.14)',
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.18)',
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: isDark ? 0.28 : 0.12,
      shadowRadius: 16,
      elevation: isDark ? 8 : 3,
    },
    headerTextBlock: {
      alignItems: 'center',
      justifyContent: 'center',
      flex: 1,
    },
    headerEyebrow: {
      fontSize: 11,
      fontWeight: '700' as const,
      color: 'rgba(255, 255, 255, 0.78)',
      letterSpacing: 1,
      textTransform: 'uppercase' as const,
      marginBottom: 2,
    },
    headerTitle: {
      fontSize: 24,
      fontWeight: '800' as const,
      color: '#fff',
      letterSpacing: -0.6,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: 20,
      paddingBottom: 32,
      gap: 14,
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
    heroAvatarBadge: {
      position: 'absolute',
      right: -3,
      top: -3,
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: '#F59E0B',
      borderWidth: 2,
      borderColor: '#fff',
      justifyContent: 'center',
      alignItems: 'center',
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
    heroName: {
      fontSize: 24,
      fontWeight: '800' as const,
      color: '#fff',
      letterSpacing: -0.7,
      marginBottom: 3,
    },
    heroSubtitle: {
      fontSize: 14,
      fontWeight: '600' as const,
      color: 'rgba(255, 255, 255, 0.9)',
    },
    heroLevelBadge: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 14,
      backgroundColor: 'rgba(255, 255, 255, 0.16)',
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.18)',
    },
    heroLevelBadgeText: {
      fontSize: 12,
      fontWeight: '800' as const,
      color: '#fff',
      letterSpacing: 0.4,
      textTransform: 'uppercase' as const,
    },
    heroBottomRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    heroMetaPill: {
      flex: 1,
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 9,
      backgroundColor: 'rgba(255, 255, 255, 0.14)',
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.16)',
    },
    heroMetaText: {
      fontSize: 12,
      fontWeight: '700' as const,
      color: 'rgba(255, 255, 255, 0.92)',
    },
    heroEditButton: {
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 12,
      backgroundColor: 'rgba(255, 255, 255, 0.18)',
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.2)',
    },
    heroEditButtonText: {
      fontSize: 12,
      fontWeight: '700' as const,
      color: '#fff',
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
    quickActionsRow: {
      flexDirection: 'row',
      gap: 12,
    },
    overviewCard: {
      flex: 1,
      borderRadius: 22,
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: isDark ? 0.22 : 0.08,
      shadowRadius: 16,
      elevation: isDark ? 6 : 3,
    },
    overviewCardGradient: {
      minHeight: 152,
      padding: 16,
      justifyContent: 'space-between',
      gap: 10,
    },
    overviewCardIcon: {
      width: 40,
      height: 40,
      borderRadius: 14,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'rgba(255, 255, 255, 0.16)',
    },
    overviewCardIconWarm: {
      backgroundColor: 'rgba(255, 255, 255, 0.18)',
    },
    overviewCardTitle: {
      fontSize: 18,
      fontWeight: '800' as const,
      color: theme.text,
      letterSpacing: -0.4,
    },
    overviewCardTitleLight: {
      fontSize: 18,
      fontWeight: '800' as const,
      color: '#fff',
      letterSpacing: -0.4,
    },
    overviewCardDescription: {
      fontSize: 13,
      fontWeight: '500' as const,
      color: theme.textSecondary,
      lineHeight: 18,
    },
    overviewCardDescriptionLight: {
      fontSize: 13,
      fontWeight: '500' as const,
      color: 'rgba(255, 255, 255, 0.86)',
      lineHeight: 18,
    },
    overviewCardFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    overviewCardFooterText: {
      fontSize: 11,
      fontWeight: '800' as const,
      color: theme.textSecondary,
      letterSpacing: 0.8,
      textTransform: 'uppercase' as const,
    },
    overviewCardFooterTextLight: {
      fontSize: 11,
      fontWeight: '800' as const,
      color: 'rgba(255, 255, 255, 0.86)',
      letterSpacing: 0.8,
      textTransform: 'uppercase' as const,
    },
    sectionBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      marginTop: 2,
    },
    sectionBannerEyebrow: {
      fontSize: 11,
      fontWeight: '700' as const,
      color: 'rgba(255, 255, 255, 0.72)',
      textTransform: 'uppercase' as const,
      letterSpacing: 0.9,
      marginBottom: 3,
    },
    sectionBannerTitle: {
      fontSize: 24,
      fontWeight: '800' as const,
      color: '#fff',
      letterSpacing: -0.6,
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
    achievementCard: {
      borderRadius: 22,
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: isDark ? 0.24 : 0.08,
      shadowRadius: 16,
      elevation: isDark ? 7 : 3,
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
    optionDescription: {
      fontSize: 12,
      fontWeight: '500' as const,
      color: theme.textSecondary,
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
  });
};
