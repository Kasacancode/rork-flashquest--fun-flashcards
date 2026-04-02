import { LinearGradient } from 'expo-linear-gradient';
import { Pencil } from 'lucide-react-native';
import React from 'react';
import { Text, TouchableOpacity, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';

import type { Theme } from '@/constants/colors';
import type { AvatarColorOption, AvatarSuitOption } from '@/types/avatar';

type GradientTriplet = readonly [string, string, string];

type ViewStyles<K extends string> = { [P in K]: StyleProp<ViewStyle> };
type TextStyles<K extends string> = { [P in K]: StyleProp<TextStyle> };

interface ProfileHeroCardProps {
  profileDisplayName: string;
  usernameLabel?: string | null;
  selectedSuitData: AvatarSuitOption;
  selectedColorData: AvatarColorOption;
  heroGradient: GradientTriplet;
  level: number;
  levelEntry: { title: string };
  progress: { current: number; required: number; percent: number };
  isPlayerNameReady: boolean;
  canEditPlayerName?: boolean;
  onEditPlayerName: () => void;
  onOpenLevels: () => void;
  selectedColorValue: string;
  styles: ViewStyles<
    | 'heroCard'
    | 'heroCardGradient'
    | 'heroTopRow'
    | 'heroIdentityRow'
    | 'heroAvatar'
    | 'heroIdentityText'
    | 'heroNameRow'
    | 'heroNameEditButton'
    | 'heroLevelBadge'
    | 'heroProgressBlock'
    | 'heroProgressLabelRow'
    | 'heroProgressTrack'
    | 'heroProgressFill'
    | 'heroBottomRow'
    | 'heroMetaPill'
  > &
    TextStyles<
      | 'heroAvatarSymbol'
      | 'heroEyebrow'
      | 'heroName'
      | 'heroSubtitle'
      | 'heroLevelBadgeText'
      | 'heroProgressLabel'
      | 'heroProgressValue'
      | 'heroMetaText'
    >;
  theme: Theme;
}

export default function ProfileHeroCard({
  profileDisplayName,
  usernameLabel,
  selectedSuitData,
  selectedColorData,
  heroGradient,
  level,
  levelEntry,
  progress,
  isPlayerNameReady,
  canEditPlayerName = true,
  onEditPlayerName,
  onOpenLevels,
  selectedColorValue,
  styles,
  theme,
}: ProfileHeroCardProps) {
  const progressWidth = `${Math.max(0, Math.min(progress.percent, 1)) * 100}%` as `${number}%`;

  return (
    <View
      style={styles.heroCard}
      accessible={true}
      accessibilityLabel={`Level ${level}, ${levelEntry.title} rank. ${profileDisplayName}. ${progress.current} of ${progress.required} XP to next level.`}
    >
      <LinearGradient
        colors={heroGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.heroCardGradient}
      >
        <View style={styles.heroTopRow}>
          <View style={styles.heroIdentityRow}>
            <View style={[styles.heroAvatar, { backgroundColor: selectedColorData.value || theme.primary }]}> 
              <Text style={styles.heroAvatarSymbol}>{selectedSuitData.symbol}</Text>
            </View>

            <View style={styles.heroIdentityText}>
              {usernameLabel ? (
                <Text style={styles.heroEyebrow} numberOfLines={1}>{usernameLabel}</Text>
              ) : null}
              <View style={styles.heroNameRow}>
                <Text style={styles.heroName} numberOfLines={1} accessibilityRole="header">{profileDisplayName}</Text>
                {canEditPlayerName ? (
                  <TouchableOpacity
                    onPress={onEditPlayerName}
                    style={styles.heroNameEditButton}
                    activeOpacity={0.84}
                    disabled={!isPlayerNameReady}
                    accessibilityLabel="Edit"
                    accessibilityRole="button"
                    testID="profile-player-name-edit"
                  >
                    <Pencil color="rgba(255, 255, 255, 0.96)" size={14} strokeWidth={2.4} />
                  </TouchableOpacity>
                ) : null}
              </View>
              <Text
                style={styles.heroSubtitle}
                numberOfLines={2}
                adjustsFontSizeToFit
                minimumFontScale={0.88}
              >
                {levelEntry.title}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.heroLevelBadge}
            onPress={onOpenLevels}
            activeOpacity={0.86}
            accessibilityLabel={`Level ${level}, ${levelEntry.title} rank`}
            accessibilityRole="button"
            testID="profile-open-levels"
          >
            <Text style={styles.heroLevelBadgeText}>Lv {level}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.heroProgressBlock}>
          <View style={styles.heroProgressLabelRow}>
            <Text style={styles.heroProgressLabel}>Level progress</Text>
            <Text style={styles.heroProgressValue}>
              {level >= 20 ? 'Max Level!' : `${progress.current} / ${progress.required} XP`}
            </Text>
          </View>
          <View style={styles.heroProgressTrack}>
            <View style={[styles.heroProgressFill, { width: progressWidth, backgroundColor: selectedColorValue }]} />
          </View>
        </View>

        <View style={styles.heroBottomRow}>
          <View style={styles.heroMetaPill}>
            <Text style={styles.heroMetaText}>{selectedColorData.name} {selectedSuitData.name}</Text>
          </View>
        </View>
      </LinearGradient>
    </View>
  );
}
