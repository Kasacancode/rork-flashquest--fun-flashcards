import { LinearGradient } from 'expo-linear-gradient';
import { Pencil, Zap } from 'lucide-react-native';
import React from 'react';
import { Text, TouchableOpacity, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';

import type { Theme } from '@/constants/colors';
import type { AvatarColorOption, AvatarSuitOption } from '@/types/avatar';

type GradientTriplet = readonly [string, string, string];

type ViewStyles<K extends string> = { [P in K]: StyleProp<ViewStyle> };
type TextStyles<K extends string> = { [P in K]: StyleProp<TextStyle> };

interface ProfileHeroCardProps {
  profileDisplayName: string;
  selectedSuitData: AvatarSuitOption;
  selectedColorData: AvatarColorOption;
  heroGradient: GradientTriplet;
  level: number;
  levelEntry: { title: string };
  isPlayerNameReady: boolean;
  onEditPlayerName: () => void;
  onOpenLevels: () => void;
  styles: ViewStyles<
    | 'heroCard'
    | 'heroCardGradient'
    | 'heroTopRow'
    | 'heroIdentityRow'
    | 'heroAvatar'
    | 'heroAvatarBadge'
    | 'heroIdentityText'
    | 'heroNameRow'
    | 'heroNameEditButton'
    | 'heroLevelBadge'
    | 'heroBottomRow'
    | 'heroMetaPill'
  > &
    TextStyles<
      | 'heroAvatarSymbol'
      | 'heroEyebrow'
      | 'heroName'
      | 'heroSubtitle'
      | 'heroLevelBadgeText'
      | 'heroMetaText'
    >;
  theme: Theme;
}

export default function ProfileHeroCard({
  profileDisplayName,
  selectedSuitData,
  selectedColorData,
  heroGradient,
  level,
  levelEntry,
  isPlayerNameReady,
  onEditPlayerName,
  onOpenLevels,
  styles,
  theme,
}: ProfileHeroCardProps) {
  return (
    <View style={styles.heroCard}>
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
              <View style={styles.heroAvatarBadge}>
                <Zap color="#fff" size={12} strokeWidth={2.8} />
              </View>
            </View>

            <View style={styles.heroIdentityText}>
              <Text style={styles.heroEyebrow}>FlashQuest Profile</Text>
              <View style={styles.heroNameRow}>
                <Text style={styles.heroName} numberOfLines={1}>{profileDisplayName}</Text>
                <TouchableOpacity
                  onPress={onEditPlayerName}
                  style={styles.heroNameEditButton}
                  activeOpacity={0.84}
                  disabled={!isPlayerNameReady}
                  testID="profile-player-name-edit"
                >
                  <Pencil color="rgba(255, 255, 255, 0.96)" size={14} strokeWidth={2.4} />
                </TouchableOpacity>
              </View>
              <Text style={styles.heroSubtitle}>{levelEntry.title}</Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.heroLevelBadge}
            onPress={onOpenLevels}
            activeOpacity={0.86}
            testID="profile-open-levels"
          >
            <Text style={styles.heroLevelBadgeText}>Lv {level}</Text>
          </TouchableOpacity>
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
