import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { ArrowLeft, Crown, Target, BookOpen, Calendar, Trophy, Zap, Flame, User, Award, Settings, Users, Moon, Sun, Check } from 'lucide-react-native';
import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Dimensions, Modal, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useFlashQuest } from '@/context/FlashQuestContext';
import { useTheme } from '@/context/ThemeContext';
import { Theme } from '@/constants/colors';

const { width } = Dimensions.get('window');

type TabType = 'overview' | 'achievements' | 'avatar';
type SuitType = 'spades' | 'hearts' | 'diamonds' | 'clubs';
type ColorType = 'red' | 'blue' | 'orange' | 'green';

const SUITS: { id: SuitType; name: string; symbol: string }[] = [
  { id: 'spades', name: 'Spades', symbol: '♠' },
  { id: 'hearts', name: 'Hearts', symbol: '♥' },
  { id: 'diamonds', name: 'Diamonds', symbol: '♦' },
  { id: 'clubs', name: 'Clubs', symbol: '♣' },
];

const AVATAR_COLORS: { id: ColorType; name: string; value: string; light: string }[] = [
  { id: 'red', name: 'Red', value: '#E53E3E', light: '#FED7D7' },
  { id: 'blue', name: 'Blue', value: '#3B82F6', light: '#DBEAFE' },
  { id: 'orange', name: 'Orange', value: '#F97316', light: '#FFEDD5' },
  { id: 'green', name: 'Green', value: '#22C55E', light: '#DCFCE7' },
];

const ACHIEVEMENTS = [
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
    color: '#667eea',
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
];

export default function ProfilePage() {
  const router = useRouter();
  const { stats, decks } = useFlashQuest();
  const { theme, isDark, toggleTheme } = useTheme();
  const [activeTab, setActiveTab] = useState<TabType>('achievements');
  const [selectedSuit, setSelectedSuit] = useState<SuitType>('spades');
  const [selectedColor, setSelectedColor] = useState<ColorType>('blue');
  const [showSettings, setShowSettings] = useState<boolean>(false);

  const level = Math.floor(stats.totalScore / 300) + 1;
  const xpProgress = stats.totalScore % 300;
  const xpForNextLevel = 300;

  const selectedSuitData = SUITS.find((s) => s.id === selectedSuit) || SUITS[0];
  const selectedColorData = AVATAR_COLORS.find((c) => c.id === selectedColor) || AVATAR_COLORS[1];
  const styles = useMemo(() => createStyles(theme, isDark), [theme, isDark]);
  const profileGradient = useMemo(
    () => (isDark ? ['#4338CA', '#7C3AED'] as const : ['#667eea', '#F093FB'] as const),
    [isDark]
  );
  const overviewGradients = useMemo(
    () => ({
      friends: (isDark ? ['#1f3c88', '#312e81'] : ['#E0F2FE', '#BAE6FD']) as [string, string],
      settings: (isDark ? ['#4c1d95', '#7c3aed'] : ['#FCE7F3', '#FBCFE8']) as [string, string],
      leaderboard: (isDark ? ['#78350f', '#ca8a04'] : ['#FEF3C7', '#FDE68A']) as [string, string],
    }),
    [isDark]
  );

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={theme.profileCard as [string, string, string]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton} testID="profile-back-button">
            <View style={styles.backButtonInner}>
              <ArrowLeft color={theme.primary} size={24} strokeWidth={2.5} />
            </View>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Profile</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.profileCard}>
            <LinearGradient
              colors={profileGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.profileCardGradient}
            >
              <View style={styles.avatarContainer}>
                <View style={[styles.avatarGradient, { backgroundColor: selectedColorData.value }]}>
                  <Text style={styles.avatarSuitSymbol}>{selectedSuitData.symbol}</Text>
                </View>
                <View style={styles.avatarBadge}>
                  <Zap color="#fff" size={12} strokeWidth={3} fill="#FFB800" />
                </View>
              </View>

              <View style={styles.profileInfo}>
                <Text style={styles.username}>gg</Text>
                <View style={styles.badges}>
                  <View style={styles.badge}>
                    <Crown color="#FFB800" size={14} strokeWidth={2.5} />
                    <Text style={styles.badgeText}>Level {level}</Text>
                  </View>
                  <View style={[styles.badge, styles.badgeStreak]}>
                    <Flame color="#FF6B6B" size={14} strokeWidth={2.5} />
                    <Text style={styles.badgeText}>{stats.currentStreak} day streak</Text>
                  </View>
                </View>
                <View style={styles.xpBar}>
                  <View style={styles.xpBarInfo}>
                    <Text style={styles.xpLabel}>Experience</Text>
                    <Text style={styles.xpValue}>
                      {xpProgress}/{xpForNextLevel} XP
                    </Text>
                  </View>
                  <View style={styles.xpBarTrack}>
                    <LinearGradient
                      colors={profileGradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={[styles.xpBarFill, { width: `${(xpProgress / xpForNextLevel) * 100}%` }]}
                    />
                  </View>
                </View>
              </View>

              <View style={styles.statsGrid}>
                <View style={styles.statBox}>
                  <View style={[styles.statIcon, { backgroundColor: '#4ECDC4' }]}>
                    <Trophy color="#fff" size={20} strokeWidth={2} />
                  </View>
                  <Text style={styles.statValue}>{stats.totalScore}</Text>
                  <Text style={styles.statLabel}>XP</Text>
                </View>
                <View style={styles.statBox}>
                  <View style={[styles.statIcon, { backgroundColor: '#FF6B6B' }]}>
                    <Target color="#fff" size={20} strokeWidth={2} />
                  </View>
                  <Text style={styles.statValue}>{stats.totalCardsStudied}</Text>
                  <Text style={styles.statLabel}>Cards</Text>
                </View>
                <View style={styles.statBox}>
                  <View style={[styles.statIcon, { backgroundColor: '#667eea' }]}>
                    <BookOpen color="#fff" size={20} strokeWidth={2} />
                  </View>
                  <Text style={styles.statValue}>{decks.length}</Text>
                  <Text style={styles.statLabel}>Decks</Text>
                </View>
                <View style={styles.statBox}>
                  <View style={[styles.statIcon, { backgroundColor: '#4EC9F0' }]}>
                    <Calendar color="#fff" size={20} strokeWidth={2} />
                  </View>
                  <Text style={styles.statValue}>{stats.currentStreak}</Text>
                  <Text style={styles.statLabel}>Streak</Text>
                </View>
              </View>
            </LinearGradient>
          </View>

          <View style={styles.tabs}>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'overview' && styles.tabActive]}
              onPress={() => setActiveTab('overview')}
              activeOpacity={0.7}
              testID="profile-tab-overview"
            >
              {activeTab === 'overview' && (
                <LinearGradient
                  colors={theme.profileTabActiveGradient as [string, string]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.tabActiveGradient}
                />
              )}
              <User
                color={activeTab === 'overview' ? theme.profileTabActiveText : theme.profileTabIconInactive}
                size={18}
                strokeWidth={2}
              />
              <Text style={[styles.tabText, activeTab === 'overview' && styles.tabTextActive]}>
                Overview
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'achievements' && styles.tabActive]}
              onPress={() => setActiveTab('achievements')}
              activeOpacity={0.7}
              testID="profile-tab-achievements"
            >
              {activeTab === 'achievements' && (
                <LinearGradient
                  colors={theme.profileTabActiveGradient as [string, string]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.tabActiveGradient}
                />
              )}
              <Award
                color={activeTab === 'achievements' ? theme.profileTabActiveText : theme.profileTabIconInactive}
                size={18}
                strokeWidth={2}
              />
              <Text style={[styles.tabText, activeTab === 'achievements' && styles.tabTextActive]}>
                Achievements
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'avatar' && styles.tabActive]}
              onPress={() => setActiveTab('avatar')}
              activeOpacity={0.7}
              testID="profile-tab-avatar"
            >
              {activeTab === 'avatar' && (
                <LinearGradient
                  colors={theme.profileTabActiveGradient as [string, string]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.tabActiveGradient}
                />
              )}
              <Zap
                color={activeTab === 'avatar' ? theme.profileTabActiveText : theme.profileTabIconInactive}
                size={18}
                strokeWidth={2}
              />
              <Text style={[styles.tabText, activeTab === 'avatar' && styles.tabTextActive]}>
                Avatar
              </Text>
            </TouchableOpacity>
          </View>

          {activeTab === 'overview' && (
            <View style={styles.tabContent}>
              <TouchableOpacity style={styles.overviewCard} activeOpacity={0.8} onPress={() => setShowSettings(true)}>
                <LinearGradient
                  colors={overviewGradients.settings}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.overviewCardGradient}
                >
                  <View style={[styles.overviewIcon, { backgroundColor: '#EC4899' }]}>
                    <Settings color="#fff" size={24} strokeWidth={2} />
                  </View>
                  <View style={styles.overviewInfo}>
                    <Text style={styles.overviewTitle}>Settings & Preferences</Text>
                    <Text style={styles.overviewDescription}>Customize your app</Text>
                  </View>
                </LinearGradient>
              </TouchableOpacity>

              <View style={[styles.overviewCard, { opacity: 0.6 }]}>
                <LinearGradient
                  colors={overviewGradients.friends}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.overviewCardGradient}
                >
                  <View style={[styles.overviewIcon, { backgroundColor: '#0EA5E9' }]}>
                    <Users color="#fff" size={24} strokeWidth={2} />
                  </View>
                  <View style={styles.overviewInfo}>
                    <Text style={styles.overviewTitle}>Friends & Social</Text>
                    <Text style={styles.overviewDescription}>Coming soon</Text>
                  </View>
                </LinearGradient>
              </View>

              <View style={[styles.overviewCard, { opacity: 0.6 }]}>
                <LinearGradient
                  colors={overviewGradients.leaderboard}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.overviewCardGradient}
                >
                  <View style={[styles.overviewIcon, { backgroundColor: '#F59E0B' }]}>
                    <Trophy color="#fff" size={24} strokeWidth={2} />
                  </View>
                  <View style={styles.overviewInfo}>
                    <Text style={styles.overviewTitle}>Global Leaderboard</Text>
                    <Text style={styles.overviewDescription}>Coming soon</Text>
                  </View>
                </LinearGradient>
              </View>
            </View>
          )}

          {activeTab === 'achievements' && (
            <View style={styles.tabContent}>
              {ACHIEVEMENTS.map((achievement) => {
                const isCompleted = achievement.progress >= achievement.total;
                const progressPercent = Math.min(
                  (achievement.progress / achievement.total) * 100,
                  100
                );

                return (
                  <View
                    key={achievement.id}
                    style={[
                      styles.achievementCard,
                      isCompleted && styles.achievementCardCompleted,
                    ]}
                  >
                    <LinearGradient
                      colors={
                        isCompleted
                          ? (theme.achievementCompletedGradient as [string, string])
                          : (theme.achievementBaseGradient as [string, string])
                      }
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.achievementGradient}
                    >
                      <View style={styles.achievementHeader}>
                        <View
                          style={[
                            styles.achievementIconContainer,
                            { backgroundColor: achievement.color },
                          ]}
                        >
                          {React.createElement(achievement.icon, {
                            color: '#fff',
                            size: 24,
                            strokeWidth: 2,
                          })}
                          {isCompleted && (
                            <View style={styles.completedBadge}>
                              <Trophy color="#10B981" size={12} strokeWidth={3} />
                            </View>
                          )}
                        </View>
                        <View style={styles.achievementInfo}>
                          <Text style={styles.achievementName}>{achievement.name}</Text>
                          <Text style={styles.achievementDescription}>
                            {achievement.description}
                          </Text>
                        </View>
                        <View style={styles.achievementXP}>
                          <Text style={styles.xpBadge}>+{achievement.xp} XP</Text>
                        </View>
                      </View>
                      <View style={styles.achievementProgressBar}>
                        <View
                          style={[
                            styles.achievementProgressFill,
                            {
                              width: `${progressPercent}%`,
                              backgroundColor: isCompleted ? theme.success : achievement.color,
                            },
                          ]}
                        />
                      </View>
                      <Text style={styles.achievementProgressText}>
                        {achievement.progress}/{achievement.total} {isCompleted ? '✓' : ''}
                      </Text>
                    </LinearGradient>
                  </View>
                );
              })}
            </View>
          )}

          {activeTab === 'avatar' && (
            <View style={styles.tabContent}>
              <View style={styles.currentAvatarSection}>
                <View style={[styles.currentAvatarContainer, { backgroundColor: selectedColorData.value }]}>
                  <Text style={styles.currentAvatarSymbol}>{selectedSuitData.symbol}</Text>
                </View>
                <Text style={styles.currentAvatarTitle}>{selectedSuitData.name} of {selectedColorData.name}</Text>
                <Text style={styles.currentAvatarSubtitle}>Your current avatar</Text>
              </View>

              <Text style={styles.sectionTitle}>Choose Your Suit</Text>
              <View style={styles.suitGrid}>
                {SUITS.map((suit) => {
                  const isSelected = selectedSuit === suit.id;
                  return (
                    <TouchableOpacity
                      key={suit.id}
                      style={[
                        styles.suitOption,
                        isSelected && { borderColor: selectedColorData.value, borderWidth: 3, backgroundColor: selectedColorData.light },
                        !isSelected && { borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)', borderWidth: 2, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' },
                      ]}
                      onPress={() => setSelectedSuit(suit.id)}
                      activeOpacity={0.75}
                    >
                      <Text style={[
                        styles.suitSymbol,
                        { color: isSelected ? selectedColorData.value : (isDark ? '#6B7280' : '#9CA3AF') },
                      ]}>
                        {suit.symbol}
                      </Text>
                      <Text style={[
                        styles.suitName,
                        { color: isSelected ? selectedColorData.value : theme.textSecondary },
                        isSelected && { fontWeight: '700' as const },
                      ]}>
                        {suit.name}
                      </Text>
                      {isSelected && (
                        <View style={[styles.suitCheckBadge, { backgroundColor: selectedColorData.value }]}>
                          <Check color="#fff" size={10} strokeWidth={3} />
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={[styles.sectionTitle, { marginTop: 28 }]}>Choose Your Color</Text>
              <View style={styles.colorRow}>
                {AVATAR_COLORS.map((col) => {
                  const isSelected = selectedColor === col.id;
                  return (
                    <TouchableOpacity
                      key={col.id}
                      style={[
                        styles.colorSwatch,
                        { backgroundColor: col.value },
                        isSelected && styles.colorSwatchSelected,
                      ]}
                      onPress={() => setSelectedColor(col.id)}
                      activeOpacity={0.8}
                    >
                      {isSelected && (
                        <Check color="#fff" size={18} strokeWidth={3} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
              <View style={styles.colorLabels}>
                {AVATAR_COLORS.map((col) => (
                  <Text key={col.id} style={[
                    styles.colorLabel,
                    { color: selectedColor === col.id ? col.value : theme.textSecondary },
                    selectedColor === col.id && { fontWeight: '700' as const },
                  ]}>
                    {col.name}
                  </Text>
                ))}
              </View>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>

      <Modal
        visible={showSettings}
        animationType="slide"
        transparent
        onRequestClose={() => setShowSettings(false)}
      >
        <View style={styles.settingsOverlay}>
          <View style={[styles.settingsModal, { backgroundColor: theme.cardBackground }]}>
            <View style={styles.settingsHeader}>
              <Text style={[styles.settingsTitle, { color: theme.text }]}>Settings & Preferences</Text>
              <TouchableOpacity onPress={() => setShowSettings(false)}>
                <Text style={[styles.settingsClose, { color: theme.textSecondary }]}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.settingsList}>
              <View style={styles.settingItem}>
                <View style={styles.settingInfo}>
                  <View style={styles.settingIconContainer}>
                    {isDark ? (
                      <Moon color={theme.primary} size={24} strokeWidth={2} />
                    ) : (
                      <Sun color={theme.primary} size={24} strokeWidth={2} />
                    )}
                  </View>
                  <View style={styles.settingTextContainer}>
                    <Text style={styles.settingLabel}>Dark Mode</Text>
                    <Text style={styles.settingDescription}>
                      {isDark ? 'Dark theme enabled' : 'Light theme enabled'}
                    </Text>
                  </View>
                </View>
                <Switch
                  value={isDark}
                  onValueChange={toggleTheme}
                  trackColor={{ false: isDark ? '#475569' : '#d1d5db', true: theme.primary }}
                  thumbColor={isDark ? theme.white : '#f3f4f6'}
                  ios_backgroundColor={isDark ? '#475569' : '#d1d5db'}
                  testID="dark-mode-switch"
                />
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (theme: Theme, isDark: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    safeArea: {
      flex: 1,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingVertical: 16,
    },
    backButton: {
      width: 44,
      height: 44,
    },
    backButtonInner: {
      flex: 1,
      backgroundColor: isDark ? 'rgba(148, 163, 184, 0.16)' : 'rgba(255, 255, 255, 0.92)',
      borderRadius: 14,
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: isDark ? '#000' : theme.primary,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: isDark ? 0.4 : 0.12,
      shadowRadius: isDark ? 12 : 8,
      elevation: isDark ? 6 : 2,
    },
    headerTitle: {
      fontSize: 22,
      fontWeight: '700' as const,
      color: theme.primary,
    },
    placeholder: {
      width: 44,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      paddingBottom: 40,
      paddingTop: 16,
    },
    profileCard: {
      marginHorizontal: 20,
      borderRadius: 24,
      overflow: 'hidden',
      shadowColor: isDark ? '#000' : theme.primary,
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: isDark ? 0.45 : 0.28,
      shadowRadius: isDark ? 20 : 16,
      elevation: isDark ? 12 : 8,
    },
    profileCardGradient: {
      padding: 24,
    },
    avatarContainer: {
      position: 'relative',
      alignSelf: 'flex-start',
    },
    avatarGradient: {
      width: 80,
      height: 80,
      borderRadius: 20,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 3,
      borderColor: isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.3)',
    },
    avatarSuitSymbol: {
      fontSize: 42,
      color: '#fff',
      lineHeight: 50,
    },
    avatarBadge: {
      position: 'absolute',
      top: -4,
      right: -4,
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: '#FFB800',
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 2,
      borderColor: theme.white,
    },
    profileInfo: {
      marginTop: 16,
    },
    username: {
      fontSize: 32,
      fontWeight: '800' as const,
      color: theme.white,
      marginBottom: 8,
    },
    badges: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 16,
    },
    badge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDark ? 'rgba(148, 163, 184, 0.18)' : 'rgba(255, 255, 255, 0.25)',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 12,
      gap: 6,
    },
    badgeStreak: {
      backgroundColor: isDark ? 'rgba(248, 113, 113, 0.32)' : 'rgba(255, 107, 107, 0.25)',
    },
    badgeText: {
      fontSize: 13,
      fontWeight: '700' as const,
      color: theme.white,
    },
    xpBar: {
      marginTop: 8,
    },
    xpBarInfo: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    xpLabel: {
      fontSize: 13,
      fontWeight: '600' as const,
      color: isDark ? 'rgba(226, 232, 240, 0.9)' : 'rgba(255, 255, 255, 0.9)',
    },
    xpValue: {
      fontSize: 13,
      fontWeight: '700' as const,
      color: theme.white,
    },
    xpBarTrack: {
      height: 8,
      backgroundColor: isDark ? 'rgba(148, 163, 184, 0.3)' : 'rgba(255, 255, 255, 0.25)',
      borderRadius: 4,
      overflow: 'hidden',
    },
    xpBarFill: {
      height: '100%',
      borderRadius: 4,
    },
    statsGrid: {
      flexDirection: 'row',
      marginTop: 24,
      gap: 12,
    },
    statBox: {
      flex: 1,
      alignItems: 'center',
      backgroundColor: theme.profileStatSurface,
      borderRadius: 16,
      padding: 12,
    },
    statIcon: {
      width: 36,
      height: 36,
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 8,
    },
    statValue: {
      fontSize: 20,
      fontWeight: '800' as const,
      color: theme.white,
      marginBottom: 2,
    },
    statLabel: {
      fontSize: 11,
      fontWeight: '600' as const,
      color: isDark ? 'rgba(226, 232, 240, 0.8)' : 'rgba(255, 255, 255, 0.9)',
    },
    tabs: {
      flexDirection: 'row',
      marginHorizontal: 20,
      marginTop: 24,
      backgroundColor: theme.profileTabBackground,
      borderRadius: 16,
      padding: 4,
      gap: 4,
    },
    tab: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 12,
      borderRadius: 12,
      gap: 6,
      position: 'relative',
      overflow: 'hidden',
    },
    tabActive: {
      backgroundColor: 'transparent',
    },
    tabActiveGradient: {
      ...StyleSheet.absoluteFillObject,
    },
    tabText: {
      fontSize: 13,
      fontWeight: '600' as const,
      color: theme.profileTabInactiveText,
    },
    tabTextActive: {
      color: theme.profileTabActiveText,
      fontWeight: '700' as const,
    },
    tabContent: {
      marginHorizontal: 20,
      marginTop: 24,
      gap: 16,
    },
    overviewCard: {
      borderRadius: 20,
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: isDark ? 0.4 : 0.12,
      shadowRadius: isDark ? 20 : 12,
      elevation: isDark ? 10 : 4,
    },
    overviewCardGradient: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 20,
      gap: 16,
    },
    overviewIcon: {
      width: 48,
      height: 48,
      borderRadius: 16,
      justifyContent: 'center',
      alignItems: 'center',
    },
    overviewInfo: {
      flex: 1,
    },
    overviewTitle: {
      fontSize: 17,
      fontWeight: '700' as const,
      color: theme.text,
      marginBottom: 2,
    },
    overviewDescription: {
      fontSize: 14,
      fontWeight: '500' as const,
      color: theme.textSecondary,
    },
    achievementCard: {
      borderRadius: 20,
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: isDark ? 0.45 : 0.15,
      shadowRadius: isDark ? 18 : 12,
      elevation: isDark ? 10 : 4,
    },
    achievementCardCompleted: {
      borderWidth: 2,
      borderColor: theme.success,
    },
    achievementGradient: {
      padding: 20,
    },
    achievementHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: 12,
    },
    achievementIconContainer: {
      width: 48,
      height: 48,
      borderRadius: 16,
      justifyContent: 'center',
      alignItems: 'center',
      position: 'relative',
    },
    completedBadge: {
      position: 'absolute',
      top: -4,
      right: -4,
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: theme.white,
      justifyContent: 'center',
      alignItems: 'center',
    },
    achievementInfo: {
      flex: 1,
      marginLeft: 16,
    },
    achievementName: {
      fontSize: 17,
      fontWeight: '700' as const,
      color: theme.text,
      marginBottom: 4,
    },
    achievementDescription: {
      fontSize: 14,
      fontWeight: '500' as const,
      color: theme.textSecondary,
      lineHeight: 20,
    },
    achievementXP: {
      marginLeft: 8,
    },
    xpBadge: {
      fontSize: 13,
      fontWeight: '700' as const,
      color: theme.warning,
      backgroundColor: isDark ? 'rgba(245, 158, 11, 0.22)' : 'rgba(245, 158, 11, 0.15)',
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 8,
    },
    achievementProgressBar: {
      height: 6,
      backgroundColor: isDark ? 'rgba(148, 163, 184, 0.3)' : 'rgba(0, 0, 0, 0.08)',
      borderRadius: 3,
      overflow: 'hidden',
      marginBottom: 8,
    },
    achievementProgressFill: {
      height: '100%',
      borderRadius: 3,
    },
    achievementProgressText: {
      fontSize: 12,
      fontWeight: '700' as const,
      color: theme.textSecondary,
      textAlign: 'right',
    },
    currentAvatarSection: {
      alignItems: 'center',
      marginBottom: 32,
    },
    currentAvatarContainer: {
      width: 120,
      height: 120,
      borderRadius: 28,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 16,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: isDark ? 0.45 : 0.2,
      shadowRadius: isDark ? 24 : 16,
      elevation: isDark ? 12 : 8,
    },
    currentAvatarSymbol: {
      fontSize: 72,
      color: '#fff',
      lineHeight: 84,
    },
    currentAvatarTitle: {
      fontSize: 22,
      fontWeight: '700' as const,
      color: theme.text,
      marginBottom: 4,
    },
    currentAvatarSubtitle: {
      fontSize: 15,
      fontWeight: '500' as const,
      color: theme.textSecondary,
    },
    sectionTitle: {
      fontSize: 20,
      fontWeight: '700' as const,
      color: theme.text,
      marginBottom: 16,
    },
    suitGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
    },
    suitOption: {
      width: (width - 64) / 2,
      paddingVertical: 20,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
    },
    suitSymbol: {
      fontSize: 52,
      lineHeight: 60,
      marginBottom: 8,
    },
    suitName: {
      fontSize: 15,
      fontWeight: '600' as const,
      color: theme.textSecondary,
    },
    suitCheckBadge: {
      position: 'absolute',
      top: 10,
      right: 10,
      width: 22,
      height: 22,
      borderRadius: 11,
      justifyContent: 'center',
      alignItems: 'center',
    },
    colorRow: {
      flexDirection: 'row',
      gap: 16,
      justifyContent: 'center',
    },
    colorSwatch: {
      width: 56,
      height: 56,
      borderRadius: 28,
      justifyContent: 'center',
      alignItems: 'center',
    },
    colorSwatchSelected: {
      transform: [{ scale: 1.18 }],
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 6,
    },
    colorLabels: {
      flexDirection: 'row',
      gap: 16,
      justifyContent: 'center',
      marginTop: 10,
    },
    colorLabel: {
      width: 56,
      fontSize: 12,
      fontWeight: '600' as const,
      textAlign: 'center',
      color: theme.textSecondary,
    },
    settingsOverlay: {
      flex: 1,
      backgroundColor: theme.modalOverlay,
      justifyContent: 'flex-end',
    },
    settingsModal: {
      borderTopLeftRadius: 32,
      borderTopRightRadius: 32,
      paddingTop: 24,
      paddingBottom: 40,
      minHeight: 300,
    },
    settingsHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 24,
      marginBottom: 32,
    },
    settingsTitle: {
      fontSize: 24,
      fontWeight: '700' as const,
    },
    settingsClose: {
      fontSize: 28,
      fontWeight: '400' as const,
    },
    settingsList: {
      paddingHorizontal: 24,
    },
    settingItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    settingInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    settingIconContainer: {
      width: 48,
      height: 48,
      borderRadius: 12,
      backgroundColor: isDark ? 'rgba(99, 102, 241, 0.16)' : 'rgba(102, 126, 234, 0.1)',
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 16,
    },
    settingTextContainer: {
      flex: 1,
    },
    settingLabel: {
      fontSize: 17,
      fontWeight: '600' as const,
      marginBottom: 4,
      color: theme.text,
    },
    settingDescription: {
      fontSize: 14,
      fontWeight: '500' as const,
      color: theme.textSecondary,
    },
  });
