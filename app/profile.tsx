import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import {
  ArrowLeft,
  Award,
  BookOpen,
  Calendar,
  Check,
  ChevronRight,
  Crown,
  Flame,
  Moon,
  Settings,
  Sun,
  Target,
  Trophy,
  User,
  Zap,
} from 'lucide-react-native';
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
  { id: 'achievements', label: 'Achievements', icon: Award },
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
  const { stats, decks } = useFlashQuest();
  const { theme, isDark, toggleTheme, setTheme } = useTheme();
  const { selectedSuit, selectedColor, setSelectedSuit, setSelectedColor } = useAvatar();
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [showSettings, setShowSettings] = useState<boolean>(false);

  const level = Math.floor(stats.totalScore / 300) + 1;
  const xpProgress = stats.totalScore % 300;
  const xpForNextLevel = 300;
  const xpNeeded = xpProgress === 0 ? xpForNextLevel : xpForNextLevel - xpProgress;
  const xpPercent = Math.min((xpProgress / xpForNextLevel) * 100, 100);

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

  const achievementSummaryGradient = useMemo(
    () =>
      (
        isDark
          ? ['rgba(79, 70, 229, 0.38)', 'rgba(249, 115, 22, 0.26)']
          : ['rgba(99, 102, 241, 0.2)', 'rgba(249, 115, 22, 0.16)']
      ) as [string, string],
    [isDark]
  );

  const rankTitle = useMemo(() => getRankTitle(level), [level]);

  const completedAchievements = useMemo(
    () => ACHIEVEMENTS.filter((achievement) => achievement.progress >= achievement.total).length,
    []
  );

  const bonusXpUnlocked = useMemo(
    () =>
      ACHIEVEMENTS.reduce((total, achievement) => {
        if (achievement.progress >= achievement.total) {
          return total + achievement.xp;
        }

        return total;
      }, 0),
    []
  );

  const nextAchievement = useMemo(
    () => ACHIEVEMENTS.find((achievement) => achievement.progress < achievement.total) ?? null,
    []
  );

  const heroStats = useMemo(
    () => [
      {
        key: 'xp',
        label: 'Total XP',
        value: stats.totalScore.toLocaleString(),
        icon: Trophy,
        accent: '#34D399',
      },
      {
        key: 'cards',
        label: 'Cards Studied',
        value: stats.totalCardsStudied.toLocaleString(),
        icon: Target,
        accent: '#F97316',
      },
      {
        key: 'decks',
        label: 'Decks Built',
        value: decks.length.toString(),
        icon: BookOpen,
        accent: '#60A5FA',
      },
      {
        key: 'streak',
        label: 'Current Streak',
        value: `${stats.currentStreak}`,
        icon: Calendar,
        accent: '#F472B6',
      },
    ],
    [stats.totalScore, stats.totalCardsStudied, stats.currentStreak, decks.length]
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
            ? ['rgba(2, 6, 23, 0.14)', 'rgba(2, 6, 23, 0.55)', 'rgba(2, 6, 23, 0.86)']
            : ['rgba(255, 255, 255, 0.04)', 'rgba(255, 255, 255, 0.12)', 'rgba(255, 255, 255, 0.18)']
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
            <ArrowLeft color="#fff" size={22} strokeWidth={2.5} />
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
            <Settings color="#fff" size={20} strokeWidth={2.4} />
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
                    <Text style={styles.heroEyebrow}>Battle-ready profile</Text>
                    <Text style={styles.heroName}>FlashQuest Player</Text>
                    <Text style={styles.heroSubtitle}>{rankTitle}</Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.heroEditButton}
                  onPress={() => handleSelectTab('avatar')}
                  activeOpacity={0.84}
                  testID="profile-hero-edit-avatar"
                >
                  <Text style={styles.heroEditButtonText}>Edit avatar</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.heroBadgeRow}>
                <View style={styles.heroBadge}>
                  <Crown color="#FDE68A" size={14} strokeWidth={2.4} />
                  <Text style={styles.heroBadgeText}>Level {level}</Text>
                </View>
                <View style={[styles.heroBadge, styles.heroBadgeWarm]}>
                  <Flame color="#FDBA74" size={14} strokeWidth={2.4} />
                  <Text style={styles.heroBadgeText}>{stats.currentStreak} day streak</Text>
                </View>
              </View>

              <View style={styles.progressSection}>
                <View style={styles.progressHeader}>
                  <Text style={styles.progressTitle}>Rank Progress</Text>
                  <Text style={styles.progressValue}>
                    {xpProgress}/{xpForNextLevel} XP
                  </Text>
                </View>
                <View style={styles.progressTrack}>
                  <LinearGradient
                    colors={['#FFFFFF', '#FDE68A']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={[styles.progressFill, { width: `${xpPercent}%` }]}
                  />
                </View>
                <Text style={styles.progressHint}>{xpNeeded} XP until Level {level + 1}</Text>
              </View>

              <View style={styles.heroStatsGrid}>
                {heroStats.map((stat) => {
                  const Icon = stat.icon;

                  return (
                    <View key={stat.key} style={styles.heroStatCard}>
                      <View style={[styles.heroStatIconWrap, { backgroundColor: stat.accent }]}>
                        <Icon color="#fff" size={16} strokeWidth={2.4} />
                      </View>
                      <Text style={styles.heroStatValue}>{stat.value}</Text>
                      <Text style={styles.heroStatLabel}>{stat.label}</Text>
                    </View>
                  );
                })}
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
                  <Icon
                    color={isActive ? theme.profileTabActiveText : theme.profileTabIconInactive}
                    size={16}
                    strokeWidth={2.3}
                  />
                  <Text style={[styles.tabText, isActive && styles.tabTextActive]} numberOfLines={1}>
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {activeTab === 'overview' && (
            <View style={styles.tabContent}>
              <TouchableOpacity
                style={styles.surfaceCard}
                onPress={handleOpenSettings}
                activeOpacity={0.9}
                testID="profile-card-settings"
              >
                <LinearGradient
                  colors={surfaceGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.surfaceCardGradient}
                >
                  <View style={[styles.surfaceCardIcon, { backgroundColor: isDark ? 'rgba(129, 140, 248, 0.24)' : 'rgba(102, 126, 234, 0.14)' }]}>
                    <Settings color={theme.primary} size={22} strokeWidth={2.3} />
                  </View>
                  <View style={styles.surfaceCardBody}>
                    <Text style={styles.surfaceCardTitle}>Appearance & settings</Text>
                    <Text style={styles.surfaceCardDescription}>Theme controls and profile preferences in one place.</Text>
                  </View>
                  <ChevronRight color={theme.textSecondary} size={18} strokeWidth={2.4} />
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.surfaceCard}
                onPress={() => handleSelectTab('avatar')}
                activeOpacity={0.9}
                testID="profile-card-avatar-studio"
              >
                <LinearGradient
                  colors={surfaceGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.surfaceCardGradient}
                >
                  <View style={[styles.surfaceCardIcon, { backgroundColor: selectedColorData.value }]}>
                    <Text style={styles.surfaceAvatarSymbol}>{selectedSuitData.symbol}</Text>
                  </View>
                  <View style={styles.surfaceCardBody}>
                    <Text style={styles.surfaceCardTitle}>Avatar studio</Text>
                    <Text style={styles.surfaceCardDescription}>
                      Equipped: {selectedColorData.name} {selectedSuitData.name}
                    </Text>
                  </View>
                  <ChevronRight color={theme.textSecondary} size={18} strokeWidth={2.4} />
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.achievementSummaryCard}
                onPress={() => handleSelectTab('achievements')}
                activeOpacity={0.9}
                testID="profile-card-achievement-summary"
              >
                <LinearGradient
                  colors={achievementSummaryGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.achievementSummaryGradient}
                >
                  <View style={styles.achievementSummaryHeader}>
                    <View style={styles.achievementSummaryIconWrap}>
                      <Award color="#fff" size={20} strokeWidth={2.3} />
                    </View>
                    <View style={styles.achievementSummaryBadge}>
                      <Text style={styles.achievementSummaryBadgeText}>
                        {completedAchievements}/{ACHIEVEMENTS.length} unlocked
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.achievementSummaryTitle}>Achievement track</Text>
                  <Text style={styles.achievementSummaryDescription}>
                    Complete milestones to stack bonus XP and keep your FlashQuest profile looking earned.
                  </Text>

                  <View style={styles.achievementSummaryFooter}>
                    <View>
                      <Text style={styles.achievementSummaryMetaLabel}>Bonus XP claimed</Text>
                      <Text style={styles.achievementSummaryMetaValue}>{bonusXpUnlocked} XP</Text>
                    </View>
                    <View style={styles.achievementSummaryNextWrap}>
                      <Text style={styles.achievementSummaryMetaLabel}>Next</Text>
                      <Text style={styles.achievementSummaryMetaValue} numberOfLines={1}>
                        {nextAchievement?.name ?? 'All done'}
                      </Text>
                    </View>
                  </View>
                </LinearGradient>
              </TouchableOpacity>

              <View style={styles.twoColumnRow}>
                <View style={styles.miniSurfaceCard}>
                  <Text style={styles.miniSurfaceEyebrow}>Longest streak</Text>
                  <Text style={styles.miniSurfaceValue}>{stats.longestStreak} days</Text>
                  <Text style={styles.miniSurfaceDescription}>Your best daily grind so far.</Text>
                </View>

                <View style={styles.miniSurfaceCard}>
                  <Text style={styles.miniSurfaceEyebrow}>Deck library</Text>
                  <Text style={styles.miniSurfaceValue}>{decks.length} ready</Text>
                  <Text style={styles.miniSurfaceDescription}>Jump into study, quest, or battle faster.</Text>
                </View>
              </View>
            </View>
          )}

          {activeTab === 'achievements' && (
            <View style={styles.tabContent}>
              <View style={styles.sectionBanner}>
                <View>
                  <Text style={styles.sectionBannerEyebrow}>Progress</Text>
                  <Text style={styles.sectionBannerTitle}>Achievements</Text>
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
                          <AchievementIcon color="#fff" size={22} strokeWidth={2.2} />
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
                        Pick the look that follows you through study, quests, and battle rooms.
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
  const miniSurface = isDark ? 'rgba(15, 23, 42, 0.68)' : 'rgba(255, 255, 255, 0.88)';
  const optionWidth = (width - 52) / 2;

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
      backgroundColor: 'rgba(255, 255, 255, 0.14)',
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.18)',
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: isDark ? 0.3 : 0.14,
      shadowRadius: 18,
      elevation: isDark ? 10 : 4,
    },
    headerTextBlock: {
      alignItems: 'center',
      justifyContent: 'center',
      flex: 1,
    },
    headerEyebrow: {
      fontSize: 12,
      fontWeight: '700' as const,
      color: 'rgba(255, 255, 255, 0.78)',
      letterSpacing: 1,
      textTransform: 'uppercase' as const,
      marginBottom: 2,
    },
    headerTitle: {
      fontSize: 28,
      fontWeight: '800' as const,
      color: '#fff',
      letterSpacing: -0.7,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: 20,
      paddingBottom: 40,
      gap: 18,
    },
    heroCard: {
      borderRadius: 28,
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 18 },
      shadowOpacity: isDark ? 0.4 : 0.18,
      shadowRadius: 28,
      elevation: isDark ? 14 : 8,
    },
    heroCardGradient: {
      padding: 22,
      gap: 18,
    },
    heroTopRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: 14,
    },
    heroIdentityRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
      gap: 14,
    },
    heroAvatar: {
      width: 84,
      height: 84,
      borderRadius: 24,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 3,
      borderColor: 'rgba(255, 255, 255, 0.26)',
      position: 'relative',
    },
    heroAvatarSymbol: {
      fontSize: 46,
      lineHeight: 52,
      color: '#fff',
    },
    heroAvatarBadge: {
      position: 'absolute',
      right: -4,
      top: -4,
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: '#F59E0B',
      borderWidth: 2,
      borderColor: '#fff',
      justifyContent: 'center',
      alignItems: 'center',
    },
    heroIdentityText: {
      flex: 1,
      paddingRight: 4,
    },
    heroEyebrow: {
      fontSize: 12,
      fontWeight: '700' as const,
      color: 'rgba(255, 255, 255, 0.78)',
      letterSpacing: 1,
      textTransform: 'uppercase' as const,
      marginBottom: 4,
    },
    heroName: {
      fontSize: 28,
      fontWeight: '800' as const,
      color: '#fff',
      letterSpacing: -0.8,
      marginBottom: 4,
    },
    heroSubtitle: {
      fontSize: 15,
      fontWeight: '600' as const,
      color: 'rgba(255, 255, 255, 0.88)',
    },
    heroEditButton: {
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 14,
      backgroundColor: 'rgba(255, 255, 255, 0.16)',
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.2)',
    },
    heroEditButtonText: {
      fontSize: 12,
      fontWeight: '700' as const,
      color: '#fff',
    },
    heroBadgeRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    heroBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: 'rgba(255, 255, 255, 0.16)',
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.14)',
    },
    heroBadgeWarm: {
      backgroundColor: 'rgba(249, 115, 22, 0.22)',
    },
    heroBadgeText: {
      fontSize: 13,
      fontWeight: '700' as const,
      color: '#fff',
    },
    progressSection: {
      gap: 8,
    },
    progressHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    progressTitle: {
      fontSize: 13,
      fontWeight: '700' as const,
      color: 'rgba(255, 255, 255, 0.86)',
      textTransform: 'uppercase' as const,
      letterSpacing: 0.7,
    },
    progressValue: {
      fontSize: 13,
      fontWeight: '700' as const,
      color: '#fff',
    },
    progressTrack: {
      height: 10,
      borderRadius: 999,
      backgroundColor: 'rgba(255, 255, 255, 0.18)',
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      borderRadius: 999,
    },
    progressHint: {
      fontSize: 13,
      fontWeight: '600' as const,
      color: 'rgba(255, 255, 255, 0.78)',
    },
    heroStatsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
    },
    heroStatCard: {
      width: '48%',
      minHeight: 94,
      borderRadius: 20,
      padding: 14,
      backgroundColor: 'rgba(255, 255, 255, 0.12)',
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.12)',
      justifyContent: 'center',
    },
    heroStatIconWrap: {
      width: 30,
      height: 30,
      borderRadius: 10,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 10,
    },
    heroStatValue: {
      fontSize: 24,
      fontWeight: '800' as const,
      color: '#fff',
      letterSpacing: -0.5,
      marginBottom: 3,
    },
    heroStatLabel: {
      fontSize: 12,
      fontWeight: '600' as const,
      color: 'rgba(255, 255, 255, 0.76)',
    },
    tabs: {
      flexDirection: 'row',
      backgroundColor: isDark ? 'rgba(15, 23, 42, 0.76)' : 'rgba(255, 255, 255, 0.72)',
      padding: 4,
      borderRadius: 18,
      gap: 4,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(148, 163, 184, 0.18)' : 'rgba(255, 255, 255, 0.4)',
    },
    tab: {
      flex: 1,
      minHeight: 48,
      borderRadius: 14,
      justifyContent: 'center',
      alignItems: 'center',
      flexDirection: 'row',
      gap: 6,
      overflow: 'hidden',
      position: 'relative',
      paddingHorizontal: 8,
    },
    tabActiveBackground: {
      ...StyleSheet.absoluteFillObject,
    },
    tabText: {
      fontSize: 12,
      fontWeight: '700' as const,
      color: theme.profileTabInactiveText,
    },
    tabTextActive: {
      color: theme.profileTabActiveText,
    },
    tabContent: {
      gap: 14,
    },
    surfaceCard: {
      borderRadius: 24,
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: isDark ? 0.24 : 0.08,
      shadowRadius: 18,
      elevation: isDark ? 8 : 3,
    },
    surfaceCardGradient: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      padding: 18,
    },
    surfaceCardIcon: {
      width: 52,
      height: 52,
      borderRadius: 18,
      justifyContent: 'center',
      alignItems: 'center',
    },
    surfaceAvatarSymbol: {
      fontSize: 28,
      lineHeight: 32,
      color: '#fff',
    },
    surfaceCardBody: {
      flex: 1,
      gap: 4,
    },
    surfaceCardTitle: {
      fontSize: 18,
      fontWeight: '800' as const,
      color: theme.text,
      letterSpacing: -0.4,
    },
    surfaceCardDescription: {
      fontSize: 14,
      fontWeight: '500' as const,
      color: theme.textSecondary,
      lineHeight: 20,
    },
    achievementSummaryCard: {
      borderRadius: 26,
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 14 },
      shadowOpacity: isDark ? 0.28 : 0.1,
      shadowRadius: 20,
      elevation: isDark ? 9 : 4,
    },
    achievementSummaryGradient: {
      padding: 20,
      gap: 14,
    },
    achievementSummaryHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    achievementSummaryIconWrap: {
      width: 40,
      height: 40,
      borderRadius: 14,
      backgroundColor: 'rgba(255, 255, 255, 0.18)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    achievementSummaryBadge: {
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 8,
      backgroundColor: 'rgba(255, 255, 255, 0.16)',
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.18)',
    },
    achievementSummaryBadgeText: {
      fontSize: 12,
      fontWeight: '700' as const,
      color: '#fff',
    },
    achievementSummaryTitle: {
      fontSize: 24,
      fontWeight: '800' as const,
      color: '#fff',
      letterSpacing: -0.6,
    },
    achievementSummaryDescription: {
      fontSize: 14,
      fontWeight: '500' as const,
      color: 'rgba(255, 255, 255, 0.86)',
      lineHeight: 22,
    },
    achievementSummaryFooter: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
      gap: 16,
    },
    achievementSummaryNextWrap: {
      flex: 1,
      alignItems: 'flex-end',
    },
    achievementSummaryMetaLabel: {
      fontSize: 11,
      fontWeight: '700' as const,
      color: 'rgba(255, 255, 255, 0.66)',
      letterSpacing: 0.8,
      textTransform: 'uppercase' as const,
      marginBottom: 4,
    },
    achievementSummaryMetaValue: {
      fontSize: 16,
      fontWeight: '800' as const,
      color: '#fff',
    },
    twoColumnRow: {
      flexDirection: 'row',
      gap: 12,
    },
    miniSurfaceCard: {
      flex: 1,
      borderRadius: 22,
      padding: 18,
      backgroundColor: miniSurface,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(148, 163, 184, 0.14)' : 'rgba(255, 255, 255, 0.4)',
    },
    miniSurfaceEyebrow: {
      fontSize: 11,
      fontWeight: '700' as const,
      color: theme.textTertiary,
      textTransform: 'uppercase' as const,
      letterSpacing: 0.8,
      marginBottom: 10,
    },
    miniSurfaceValue: {
      fontSize: 22,
      fontWeight: '800' as const,
      color: theme.text,
      letterSpacing: -0.4,
      marginBottom: 6,
    },
    miniSurfaceDescription: {
      fontSize: 13,
      fontWeight: '500' as const,
      color: theme.textSecondary,
      lineHeight: 19,
    },
    sectionBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 2,
    },
    sectionBannerEyebrow: {
      fontSize: 12,
      fontWeight: '700' as const,
      color: 'rgba(255, 255, 255, 0.72)',
      textTransform: 'uppercase' as const,
      letterSpacing: 0.9,
      marginBottom: 3,
    },
    sectionBannerTitle: {
      fontSize: 28,
      fontWeight: '800' as const,
      color: '#fff',
      letterSpacing: -0.7,
    },
    sectionBannerBadge: {
      paddingHorizontal: 12,
      paddingVertical: 8,
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
      borderRadius: 24,
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: isDark ? 0.28 : 0.08,
      shadowRadius: 18,
      elevation: isDark ? 7 : 3,
    },
    achievementCardGradient: {
      padding: 18,
      gap: 14,
    },
    achievementHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 14,
    },
    achievementIconWrap: {
      width: 46,
      height: 46,
      borderRadius: 16,
      justifyContent: 'center',
      alignItems: 'center',
    },
    achievementTextWrap: {
      flex: 1,
      gap: 4,
    },
    achievementName: {
      fontSize: 17,
      fontWeight: '800' as const,
      color: theme.text,
      letterSpacing: -0.3,
    },
    achievementDescription: {
      fontSize: 14,
      fontWeight: '500' as const,
      color: theme.textSecondary,
      lineHeight: 20,
    },
    achievementXpBadge: {
      minWidth: 56,
      paddingHorizontal: 10,
      paddingVertical: 8,
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
      borderRadius: 28,
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 16 },
      shadowOpacity: isDark ? 0.34 : 0.12,
      shadowRadius: 24,
      elevation: isDark ? 10 : 5,
    },
    avatarShowcaseGradient: {
      padding: 20,
      gap: 16,
    },
    avatarShowcaseHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 12,
    },
    avatarShowcaseBadge: {
      paddingHorizontal: 12,
      paddingVertical: 8,
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
      fontSize: 13,
      fontWeight: '600' as const,
      color: 'rgba(255, 255, 255, 0.86)',
    },
    avatarShowcaseBody: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
    },
    avatarShowcaseTile: {
      width: 88,
      height: 88,
      borderRadius: 24,
      backgroundColor: 'rgba(255, 255, 255, 0.16)',
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.18)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    avatarShowcaseSymbol: {
      fontSize: 54,
      lineHeight: 62,
      color: '#fff',
    },
    avatarShowcaseTextBlock: {
      flex: 1,
      gap: 6,
    },
    avatarShowcaseTitle: {
      fontSize: 24,
      fontWeight: '800' as const,
      color: '#fff',
      letterSpacing: -0.6,
    },
    avatarShowcaseDescription: {
      fontSize: 14,
      fontWeight: '500' as const,
      color: 'rgba(255, 255, 255, 0.84)',
      lineHeight: 21,
    },
    sectionHeader: {
      gap: 4,
      marginTop: 4,
    },
    sectionTitle: {
      fontSize: 22,
      fontWeight: '800' as const,
      color: '#fff',
      letterSpacing: -0.5,
    },
    sectionSubtitle: {
      fontSize: 14,
      fontWeight: '500' as const,
      color: 'rgba(255, 255, 255, 0.72)',
      lineHeight: 20,
    },
    optionGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
    },
    optionCard: {
      width: optionWidth,
      borderRadius: 24,
      paddingVertical: 18,
      paddingHorizontal: 16,
      backgroundColor: cardSurface,
      borderWidth: 1.5,
      borderColor: isDark ? 'rgba(148, 163, 184, 0.14)' : 'rgba(255, 255, 255, 0.38)',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      minHeight: 144,
    },
    optionSymbol: {
      fontSize: 52,
      lineHeight: 60,
      marginBottom: 10,
    },
    colorSwatch: {
      width: 56,
      height: 56,
      borderRadius: 18,
      marginBottom: 12,
      borderWidth: 2,
      borderColor: 'rgba(255, 255, 255, 0.32)',
    },
    optionTitle: {
      fontSize: 17,
      fontWeight: '700' as const,
      color: theme.text,
      marginBottom: 4,
    },
    optionDescription: {
      fontSize: 13,
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
