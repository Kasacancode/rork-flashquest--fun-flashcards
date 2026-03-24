import React, { memo } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import type { LevelRankBand } from '@/utils/levels';

export type RankEmblemSize = 'hero' | 'row';

export interface DiamondProps {
  size: number;
  color: string;
  style?: StyleProp<ViewStyle>;
}

export interface RankSigilProps {
  band: LevelRankBand;
  color: string;
  size: number;
}

export interface RankFrameAccentProps {
  band: LevelRankBand;
  size: number;
  color: string;
}

export interface RankCoreAccentProps {
  band: LevelRankBand;
  size: number;
  color: string;
  isDark?: boolean;
}

export interface EmblemTokens {
  outer: number;
  halo: number;
  diamond: number;
  diamondRadius: number;
  shell: number;
  shellRadius: number;
  inner: number;
  innerRadius: number;
  capWidth: number;
  capHeight: number;
  capRadius: number;
  capTop: number;
  sigilSize: number;
  numberSize: number;
  pipsSize: number;
  pipGap: number;
  pipBottom: number;
}

export interface BandGeometry {
  haloScale: number;
  frameScale: number;
  frameRadiusScale: number;
  shellScale: number;
  shellRadiusScale: number;
  innerScale: number;
  innerRadiusScale: number;
  capWidthScale: number;
  capHeightScale: number;
  capTopOffset: number;
  pipScale: number;
  pipGapScale: number;
}

export const HERO_TOKENS: EmblemTokens = {
  outer: 96,
  halo: 124,
  diamond: 76,
  diamondRadius: 24,
  shell: 72,
  shellRadius: 28,
  inner: 56,
  innerRadius: 22,
  capWidth: 30,
  capHeight: 22,
  capRadius: 11,
  capTop: -6,
  sigilSize: 16,
  numberSize: 28,
  pipsSize: 6,
  pipGap: 5,
  pipBottom: 10,
};

export const ROW_TOKENS: EmblemTokens = {
  outer: 66,
  halo: 82,
  diamond: 52,
  diamondRadius: 16,
  shell: 48,
  shellRadius: 18,
  inner: 38,
  innerRadius: 14,
  capWidth: 24,
  capHeight: 18,
  capRadius: 9,
  capTop: -5,
  sigilSize: 12,
  numberSize: 18,
  pipsSize: 0,
  pipGap: 0,
  pipBottom: 0,
};

export const rankPipCount: Record<LevelRankBand, number> = {
  foundation: 1,
  momentum: 2,
  skilled: 3,
  advanced: 4,
  prestige: 5,
};

export const Diamond = memo(function Diamond({ size, color, style }: DiamondProps) {
  return (
    <View
      style={[
        emblemStyles.diamond,
        {
          width: size,
          height: size,
          borderRadius: size * 0.26,
          backgroundColor: color,
        },
        style,
      ]}
    />
  );
});

export function getBandGeometry(band: LevelRankBand): BandGeometry {
  switch (band) {
    case 'foundation':
      return {
        haloScale: 0.96,
        frameScale: 0.92,
        frameRadiusScale: 1.12,
        shellScale: 0.96,
        shellRadiusScale: 1.18,
        innerScale: 0.72,
        innerRadiusScale: 1.18,
        capWidthScale: 0.8,
        capHeightScale: 0.96,
        capTopOffset: 0,
        pipScale: 0.9,
        pipGapScale: 0.94,
      };
    case 'momentum':
      return {
        haloScale: 1,
        frameScale: 0.99,
        frameRadiusScale: 0.92,
        shellScale: 0.99,
        shellRadiusScale: 0.84,
        innerScale: 0.72,
        innerRadiusScale: 0.84,
        capWidthScale: 0.92,
        capHeightScale: 0.94,
        capTopOffset: 0,
        pipScale: 1,
        pipGapScale: 1,
      };
    case 'skilled':
      return {
        haloScale: 1.02,
        frameScale: 1.01,
        frameRadiusScale: 1,
        shellScale: 1.01,
        shellRadiusScale: 1.02,
        innerScale: 0.75,
        innerRadiusScale: 1,
        capWidthScale: 1.02,
        capHeightScale: 0.92,
        capTopOffset: -1,
        pipScale: 1.04,
        pipGapScale: 1.04,
      };
    case 'advanced':
      return {
        haloScale: 1.04,
        frameScale: 1.05,
        frameRadiusScale: 0.86,
        shellScale: 1.03,
        shellRadiusScale: 0.76,
        innerScale: 0.74,
        innerRadiusScale: 0.84,
        capWidthScale: 1.1,
        capHeightScale: 0.9,
        capTopOffset: -1,
        pipScale: 1.06,
        pipGapScale: 1.1,
      };
    case 'prestige':
      return {
        haloScale: 1.08,
        frameScale: 1.08,
        frameRadiusScale: 1.18,
        shellScale: 1.05,
        shellRadiusScale: 1.24,
        innerScale: 0.76,
        innerRadiusScale: 1.16,
        capWidthScale: 1.14,
        capHeightScale: 0.86,
        capTopOffset: -2,
        pipScale: 1.1,
        pipGapScale: 1.18,
      };
  }
}

export const emblemStyles = StyleSheet.create({
  root: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  halo: {
    position: 'absolute',
  },
  frameAccentRoot: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rotatedFrame: {
    position: 'absolute',
    borderWidth: 1,
    transform: [{ rotate: '45deg' }],
  },
  shell: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
  },
  innerRing: {
    position: 'absolute',
    borderWidth: 1,
  },
  sigilCap: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  levelNumber: {
    fontWeight: '800' as const,
    letterSpacing: -0.8,
  },
  pipsRow: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  diamond: {
    transform: [{ rotate: '45deg' }],
  },
  verticalRail: {
    position: 'absolute',
    top: '50%',
    marginTop: -26,
  },
  horizontalRail: {
    position: 'absolute',
  },
  chevronRail: {
    position: 'absolute',
    top: '50%',
    borderRadius: 999,
  },
  sigilRoot: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  coreAccentRoot: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coreAccentLine: {
    position: 'absolute',
  },
  sigilLine: {
    position: 'absolute',
  },
  sigilWing: {
    position: 'absolute',
    borderRadius: 999,
  },
});
