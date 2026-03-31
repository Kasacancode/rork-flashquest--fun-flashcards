import { LinearGradient } from 'expo-linear-gradient';
import React, { memo, useMemo } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import RankCoreAccent from '@/components/stats-rank-emblem/RankCoreAccent';
import RankFrameAccent from '@/components/stats-rank-emblem/RankFrameAccent';
import RankSigil from '@/components/stats-rank-emblem/RankSigil';
import {
  Diamond,
  HERO_TOKENS,
  ROW_TOKENS,
  emblemStyles,
  getBandGeometry,
  rankPipCount,
  type RankEmblemSize,
} from '@/components/stats-rank-emblem/shared';
import {
  getLevelRankBandInfo,
  type LevelBandPalette,
} from '@/utils/levels';

interface RankEmblemProps {
  level: number;
  palette: LevelBandPalette;
  isDark?: boolean;
  size?: RankEmblemSize;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

function RankEmblem({
  level,
  palette,
  isDark = false,
  size = 'hero',
  style,
  testID,
}: RankEmblemProps) {
  const rankInfo = useMemo(() => getLevelRankBandInfo(level), [level]);
  const tokens = size === 'hero' ? HERO_TOKENS : ROW_TOKENS;
  const geometry = useMemo(() => getBandGeometry(rankInfo.band), [rankInfo.band]);
  const shadowBoost = rankInfo.band === 'prestige' ? 0.03 : rankInfo.band === 'advanced' ? 0.015 : 0;
  const shellShadowOpacity =
    (size === 'hero' ? (isDark ? 0.3 : 0.14) : isDark ? 0.2 : 0.1) + shadowBoost;
  const diamondSurface = isDark ? 'rgba(9, 16, 30, 0.42)' : 'rgba(255, 255, 255, 0.66)';
  const innerSurface = isDark ? 'rgba(5, 12, 24, 0.16)' : 'rgba(255, 255, 255, 0.14)';
  const capSurface = isDark ? 'rgba(5, 12, 24, 0.28)' : 'rgba(255, 255, 255, 0.24)';
  const innerBorder = isDark ? 'rgba(255, 255, 255, 0.14)' : 'rgba(255, 255, 255, 0.3)';
  const accentColor = isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(255, 255, 255, 0.82)';
  const pips = rankPipCount[rankInfo.band];
  const haloSize = tokens.halo * geometry.haloScale;
  const frameSize = tokens.diamond * geometry.frameScale;
  const shellSize = tokens.shell * geometry.shellScale;
  const innerSize = tokens.inner * geometry.innerScale;
  const capWidth = tokens.capWidth * geometry.capWidthScale;
  const capHeight = tokens.capHeight * geometry.capHeightScale;
  const pipSize = tokens.pipsSize * geometry.pipScale;
  const pipGap = tokens.pipGap * geometry.pipGapScale;

  return (
    <View
      style={[
        emblemStyles.root,
        {
          width: tokens.outer,
          height: tokens.outer,
        },
        style,
      ]}
      testID={testID}
    >
      <View
        pointerEvents="none"
        style={[
          emblemStyles.halo,
          {
            width: haloSize,
            height: haloSize,
            borderRadius: haloSize / 2,
            backgroundColor: palette.haloColor,
          },
        ]}
      />
      <RankFrameAccent band={rankInfo.band} size={tokens.outer} color={palette.badgeText} />
      <View
        pointerEvents="none"
        style={[
          emblemStyles.rotatedFrame,
          {
            width: frameSize,
            height: frameSize,
            borderRadius: tokens.diamondRadius * geometry.frameRadiusScale,
            borderColor: palette.badgeBorder,
            backgroundColor: diamondSurface,
          },
        ]}
      />
      <View
        style={[
          emblemStyles.shell,
          {
            width: shellSize,
            height: shellSize,
            borderRadius: tokens.shellRadius * geometry.shellRadiusScale,
            borderColor: palette.badgeBorder,
            shadowColor: palette.badgeShadow,
            shadowOpacity: shellShadowOpacity,
            shadowRadius: size === 'hero' ? 16 : 10,
            shadowOffset: { width: 0, height: size === 'hero' ? 8 : 5 },
            elevation: size === 'hero' ? 7 : 4,
          },
        ]}
      >
        <LinearGradient
          colors={palette.badgeGradient}
          start={{ x: 0.12, y: 0 }}
          end={{ x: 0.88, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <RankCoreAccent band={rankInfo.band} size={innerSize} color={palette.badgeText} isDark={isDark} />
        <View
          pointerEvents="none"
          style={[
            emblemStyles.innerRing,
            {
              width: innerSize,
              height: innerSize,
              borderRadius: tokens.innerRadius * geometry.innerRadiusScale,
              borderColor: innerBorder,
              backgroundColor: innerSurface,
            },
          ]}
        />
        <View
          pointerEvents="none"
          style={[
            emblemStyles.sigilCap,
            {
              top: tokens.capTop + geometry.capTopOffset,
              width: capWidth,
              height: capHeight,
              borderRadius: tokens.capRadius,
              backgroundColor: capSurface,
              borderColor: palette.badgeBorder,
            },
          ]}
        >
          <RankSigil band={rankInfo.band} color={palette.badgeText} size={tokens.sigilSize} />
        </View>
        <Text
          style={[
            emblemStyles.levelNumber,
            {
              fontSize: tokens.numberSize,
              color: palette.badgeText,
              marginTop: size === 'hero' ? 8 : 6,
            },
          ]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.72}
        >
          {level}
        </Text>
        {size === 'hero' ? (
          <View
            pointerEvents="none"
            style={[
              emblemStyles.pipsRow,
              {
                gap: pipGap,
                bottom: tokens.pipBottom,
              },
            ]}
          >
            {Array.from({ length: pips }).map((_, index) => (
              <Diamond
                key={`${rankInfo.band}-${index}`}
                size={pipSize}
                color={accentColor}
                style={{ opacity: rankInfo.band === 'foundation' ? 0.8 : 1 }}
              />
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
}

export default memo(RankEmblem);
