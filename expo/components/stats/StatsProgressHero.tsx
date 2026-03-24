import { LinearGradient } from 'expo-linear-gradient';
import React, { memo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import type { StatsTextStyles, StatsViewStyles } from '@/components/stats/statsScreen.types';
import StatsRankEmblem from '@/components/StatsRankEmblem';
import type { LevelBandPalette } from '@/utils/levels';

interface StatsProgressHeroProps {
  level: number;
  levelEntry: { title: string };
  levelProgress: { current: number; required: number; percent: number };
  levelPalette: LevelBandPalette;
  totalScore: number;
  isDark: boolean;
  styles: StatsViewStyles<'levelCard' | 'levelOrb' | 'levelBadge' | 'levelBarContainer' | 'levelBarTrack' | 'levelBarFill'> &
    StatsTextStyles<'levelEyebrow' | 'levelTitle' | 'levelXpText' | 'levelBarLabel' | 'levelHint'>;
  onPress: () => void;
}

function StatsProgressHeroComponent({
  level,
  levelEntry,
  levelProgress,
  levelPalette,
  totalScore,
  isDark,
  styles,
  onPress,
}: StatsProgressHeroProps) {
  return (
    <TouchableOpacity
      style={[
        styles.levelCard,
        {
          borderColor: levelPalette.badgeBorder,
          shadowColor: levelPalette.badgeShadow,
        },
      ]}
      onPress={onPress}
      activeOpacity={0.92}
      testID="stats-score-card"
    >
      <LinearGradient
        colors={levelPalette.heroGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={['rgba(255, 255, 255, 0)', levelPalette.heroEdgeTint]}
        start={{ x: 0.12, y: 0.2 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.levelOrb, { backgroundColor: levelPalette.haloColor }]} />
      <Text style={styles.levelEyebrow}>Progression</Text>
      <StatsRankEmblem
        level={level}
        palette={levelPalette}
        isDark={isDark}
        size="hero"
        style={styles.levelBadge}
        testID="stats-rank-emblem"
      />
      <Text style={styles.levelTitle} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.86}>
        {levelEntry.title}
      </Text>
      <Text style={styles.levelXpText}>{totalScore.toLocaleString()} XP</Text>
      <View style={styles.levelBarContainer}>
        <View style={[styles.levelBarTrack, { backgroundColor: levelPalette.progressTrack }]}> 
          <LinearGradient
            colors={levelPalette.progressGradient}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={[
              styles.levelBarFill,
              {
                width: `${Math.round(levelProgress.percent * 100)}%`,
                shadowColor: levelPalette.progressGlow,
              },
            ]}
          />
        </View>
        <Text style={styles.levelBarLabel}>
          {level >= 20 ? 'Max Level Reached!' : `${levelProgress.current} / ${levelProgress.required} to Level ${level + 1}`}
        </Text>
      </View>
      <Text style={[styles.levelHint, { color: levelPalette.band === 'elite' ? '#6D28D9' : undefined }]}>Tap to view the rank ladder</Text>
    </TouchableOpacity>
  );
}

export default memo(StatsProgressHeroComponent);
