import { LinearGradient } from 'expo-linear-gradient';
import { Check } from 'lucide-react-native';
import React from 'react';
import { Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';

import type { Theme } from '@/constants/colors';

type IconComponent = React.ComponentType<{
  color?: string;
  size?: number;
  strokeWidth?: number;
}>;

type ViewStyles<K extends string> = { [P in K]: StyleProp<ViewStyle> };
type TextStyles<K extends string> = { [P in K]: StyleProp<TextStyle> };

interface AwardsTabProps {
  achievements: readonly {
    id: string;
    name: string;
    description: string;
    xp: number;
    progress: number;
    total: number;
    color: string;
    icon: IconComponent;
  }[];
  completedAchievements: number;
  nextAchievement: {
    name: string;
  } | null;
  isDark: boolean;
  surfaceGradient: readonly [string, string];
  styles: ViewStyles<
    | 'tabContent'
    | 'sectionBanner'
    | 'sectionBannerTextWrap'
    | 'sectionBannerBadge'
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
      | 'sectionBannerEyebrow'
      | 'sectionBannerTitle'
      | 'sectionBannerSubtitle'
      | 'sectionBannerBadgeText'
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
  isDark,
  surfaceGradient,
  styles,
  theme,
}: AwardsTabProps) {
  const baseSurfaceGradient = surfaceGradient || theme.achievementBaseGradient;

  return (
    <View style={styles.tabContent}>
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

      {achievements.map((achievement) => {
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
    </View>
  );
}
