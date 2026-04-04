import { LinearGradient } from 'expo-linear-gradient';
import { Check } from 'lucide-react-native';
import React from 'react';
import {
  Animated,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import type { Theme } from '@/constants/colors';
import type {
  AchievementCategory,
  AchievementCategoryId,
  AchievementItem,
} from '@/utils/achievements';

type ViewStyles<K extends string> = { [P in K]: StyleProp<ViewStyle> };
type TextStyles<K extends string> = { [P in K]: StyleProp<TextStyle> };

interface AwardsTabProps {
  achievements: readonly AchievementItem[];
  completedAchievements: number;
  nextAchievement: {
    name: string;
  } | null;
  achievementCategories: readonly AchievementCategory[];
  activeAchievementCategory: AchievementCategoryId;
  activeAchievementCategoryLabel: string;
  activeCategoryAchievements: readonly AchievementItem[];
  activeCategoryCompletedAchievements: number;
  onSelectAchievementCategory: (categoryId: AchievementCategoryId) => void;
  achievementCategoryFade: Animated.Value;
  isDark: boolean;
  surfaceGradient: readonly [string, string];
  styles: ViewStyles<
    | 'tabContent'
    | 'cardShell'
    | 'appearanceCard'
    | 'sectionBanner'
    | 'sectionBannerTextWrap'
    | 'sectionBannerBadge'
    | 'achievementCategoryScroll'
    | 'achievementCategoryScrollContent'
    | 'achievementCategoryPill'
    | 'achievementCategoryPillActive'
    | 'achievementCategorySummary'
    | 'achievementCategoryCards'
    | 'achievementCard'
    | 'achievementCardGradient'
    | 'achievementHeader'
    | 'achievementIconWrap'
    | 'achievementTextWrap'
    | 'achievementXpBadge'
    | 'achievementXpBadgeCompleted'
    | 'achievementTrack'
    | 'achievementFill'
    | 'achievementFooter'
    | 'achievementCompletedPill'
  > &
    TextStyles<
      | 'cardDescription'
      | 'sectionBannerEyebrow'
      | 'sectionBannerTitle'
      | 'sectionBannerSubtitle'
      | 'sectionBannerBadgeText'
      | 'achievementCategoryPillText'
      | 'achievementCategoryPillTextActive'
      | 'achievementCategorySummaryText'
      | 'achievementName'
      | 'achievementDescription'
      | 'achievementXpText'
      | 'achievementProgressText'
      | 'achievementRemainingText'
      | 'achievementCompletedPillText'
    >;
  theme: Theme;
}

export default function AwardsTab({
  achievements,
  completedAchievements,
  nextAchievement,
  achievementCategories,
  activeAchievementCategory,
  activeAchievementCategoryLabel,
  activeCategoryAchievements,
  activeCategoryCompletedAchievements,
  onSelectAchievementCategory,
  achievementCategoryFade,
  isDark,
  surfaceGradient,
  styles,
  theme,
}: AwardsTabProps) {
  const baseSurfaceGradient = surfaceGradient || theme.achievementBaseGradient;

  return (
    <View style={styles.tabContent}>
      <View style={styles.cardShell}>
        <LinearGradient
          colors={baseSurfaceGradient as [string, string]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.appearanceCard}
        >
          <View style={styles.sectionBanner}>
            <View style={styles.sectionBannerTextWrap}>
              <Text style={styles.sectionBannerEyebrow}>Milestones</Text>
              <Text style={styles.sectionBannerTitle}>Awards</Text>
              <Text style={styles.sectionBannerSubtitle}>
                {nextAchievement ? `Next up: ${nextAchievement.name}` : 'Every current award is unlocked.'}
              </Text>
            </View>
            <View style={styles.sectionBannerBadge}>
              <Text style={styles.sectionBannerBadgeText}>{completedAchievements}/{achievements.length}</Text>
            </View>
          </View>

          <Text style={styles.cardDescription}>Track every unlock, challenge, and mastery marker across FlashQuest.</Text>

          <View style={styles.achievementCategorySummary}>
            <Text style={styles.achievementCategorySummaryText}>
              {activeCategoryCompletedAchievements}/{activeCategoryAchievements.length} in {activeAchievementCategoryLabel}
            </Text>
          </View>
        </LinearGradient>
      </View>

      <View style={styles.cardShell}>
        <LinearGradient
          colors={baseSurfaceGradient as [string, string]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.appearanceCard}
        >
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.achievementCategoryScroll}
            contentContainerStyle={styles.achievementCategoryScrollContent}
          >
            {achievementCategories.map((category) => {
              const isActive = activeAchievementCategory === category.id;

              return (
                <TouchableOpacity
                  key={category.id}
                  onPress={() => onSelectAchievementCategory(category.id)}
                  activeOpacity={0.84}
                  accessibilityLabel={category.label}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: isActive }}
                  style={[styles.achievementCategoryPill, isActive && styles.achievementCategoryPillActive]}
                >
                  <Text style={[styles.achievementCategoryPillText, isActive && styles.achievementCategoryPillTextActive]}>
                    {category.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </LinearGradient>
      </View>

      <Animated.View style={[styles.achievementCategoryCards, { opacity: achievementCategoryFade }]}>
        {activeCategoryAchievements.map((achievement) => {
          const isCompleted = achievement.progress >= achievement.total;
          const progressPercent = Math.min((achievement.progress / achievement.total) * 100, 100);
          const AchievementIcon = achievement.icon;

          return (
            <View
              key={achievement.id}
              style={styles.achievementCard}
              accessible={true}
              accessibilityLabel={`${achievement.name}: ${achievement.description}. ${achievement.progress} of ${achievement.total}${isCompleted ? ', unlocked' : ''}`}
            >
              <LinearGradient
                colors={
                  isCompleted
                    ? (isDark
                        ? ['rgba(16, 185, 129, 0.28)', 'rgba(6, 95, 70, 0.5)']
                        : ['#ECFDF5', '#D1FAE5'])
                    : (baseSurfaceGradient as [string, string])
                }
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.achievementCardGradient}
              >
                <View style={styles.achievementHeader}>
                  <View style={[styles.achievementIconWrap, { backgroundColor: achievement.color }]}> 
                    <AchievementIcon color="#fff" size={19} strokeWidth={2.2} />
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
      </Animated.View>
    </View>
  );
}
