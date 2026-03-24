import { LinearGradient } from 'expo-linear-gradient';
import React, { memo, useMemo } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import {
  getLevelRankBandInfo,
  type LevelBandPalette,
  type LevelRankBand,
} from '@/utils/levels';

type RankEmblemSize = 'hero' | 'row';

interface RankEmblemProps {
  level: number;
  palette: LevelBandPalette;
  isDark?: boolean;
  size?: RankEmblemSize;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

interface DiamondProps {
  size: number;
  color: string;
  style?: StyleProp<ViewStyle>;
}

interface RankSigilProps {
  band: LevelRankBand;
  color: string;
  size: number;
}

interface EmblemTokens {
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

const HERO_TOKENS: EmblemTokens = {
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

const ROW_TOKENS: EmblemTokens = {
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

const rankPipCount: Record<LevelRankBand, number> = {
  foundation: 1,
  momentum: 2,
  skilled: 3,
  advanced: 4,
  prestige: 5,
};

const Diamond = memo(function Diamond({ size, color, style }: DiamondProps) {
  return (
    <View
      style={[
        styles.diamond,
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

const RankSigil = memo(function RankSigil({ band, color, size }: RankSigilProps) {
  const unit = size / 12;
  const softOpacity = 0.42;
  const softColor = color;
  const dotSize = Math.max(unit * 1.2, 1.5);
  const lineThickness = Math.max(unit * 0.8, 1);

  if (band === 'foundation') {
    return (
      <View style={[styles.sigilRoot, { width: size, height: size }]}>
        <Diamond size={unit * 3.1} color={color} />
      </View>
    );
  }

  if (band === 'momentum') {
    return (
      <View style={[styles.sigilRoot, { width: size, height: size }]}>
        <View
          style={[
            styles.sigilLine,
            {
              width: lineThickness,
              height: unit * 6,
              backgroundColor: softColor,
              opacity: softOpacity,
              borderRadius: 999,
            },
          ]}
        />
        <Diamond size={unit * 2.4} color={color} style={{ position: 'absolute', top: unit * 1.4 }} />
        <Diamond size={unit * 2.4} color={color} style={{ position: 'absolute', bottom: unit * 1.4 }} />
      </View>
    );
  }

  if (band === 'skilled') {
    return (
      <View style={[styles.sigilRoot, { width: size, height: size }]}>
        <Diamond size={unit * 2.8} color={color} />
        <View
          style={[
            styles.sigilWing,
            {
              left: unit * 0.8,
              width: unit * 2.3,
              height: lineThickness,
              backgroundColor: softColor,
              opacity: softOpacity,
            },
          ]}
        />
        <View
          style={[
            styles.sigilWing,
            {
              right: unit * 0.8,
              width: unit * 2.3,
              height: lineThickness,
              backgroundColor: softColor,
              opacity: softOpacity,
            },
          ]}
        />
        <View
          style={{
            position: 'absolute',
            bottom: unit * 1.2,
            width: dotSize,
            height: dotSize,
            borderRadius: dotSize / 2,
            backgroundColor: softColor,
            opacity: softOpacity,
          }}
        />
      </View>
    );
  }

  if (band === 'advanced') {
    return (
      <View style={[styles.sigilRoot, { width: size, height: size }]}>
        <Diamond size={unit * 2.5} color={color} style={{ position: 'absolute', top: unit * 0.9, left: unit * 1.3 }} />
        <Diamond size={unit * 2.5} color={color} style={{ position: 'absolute', top: unit * 0.9, right: unit * 1.3 }} />
        <Diamond size={unit * 3} color={color} style={{ position: 'absolute', bottom: unit * 1.2 }} />
        <View
          style={{
            position: 'absolute',
            bottom: unit * 0.6,
            width: unit * 6,
            height: lineThickness,
            borderRadius: 999,
            backgroundColor: softColor,
            opacity: softOpacity,
          }}
        />
      </View>
    );
  }

  return (
    <View style={[styles.sigilRoot, { width: size, height: size }]}>
      <Diamond size={unit * 3} color={color} />
      <View
        style={{
          position: 'absolute',
          top: unit * 0.9,
          left: unit * 1.3,
          width: dotSize,
          height: dotSize,
          borderRadius: dotSize / 2,
          backgroundColor: softColor,
          opacity: softOpacity,
        }}
      />
      <View
        style={{
          position: 'absolute',
          top: unit * 0.9,
          right: unit * 1.3,
          width: dotSize,
          height: dotSize,
          borderRadius: dotSize / 2,
          backgroundColor: softColor,
          opacity: softOpacity,
        }}
      />
      <View
        style={{
          position: 'absolute',
          bottom: unit * 1.1,
          left: unit * 1.1,
          width: dotSize,
          height: dotSize,
          borderRadius: dotSize / 2,
          backgroundColor: softColor,
          opacity: softOpacity,
        }}
      />
      <View
        style={{
          position: 'absolute',
          bottom: unit * 1.1,
          right: unit * 1.1,
          width: dotSize,
          height: dotSize,
          borderRadius: dotSize / 2,
          backgroundColor: softColor,
          opacity: softOpacity,
        }}
      />
    </View>
  );
});

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
  const shellShadowOpacity = size === 'hero' ? (isDark ? 0.3 : 0.14) : isDark ? 0.2 : 0.1;
  const diamondSurface = isDark ? 'rgba(9, 16, 30, 0.42)' : 'rgba(255, 255, 255, 0.66)';
  const innerSurface = isDark ? 'rgba(5, 12, 24, 0.16)' : 'rgba(255, 255, 255, 0.14)';
  const capSurface = isDark ? 'rgba(5, 12, 24, 0.28)' : 'rgba(255, 255, 255, 0.24)';
  const innerBorder = isDark ? 'rgba(255, 255, 255, 0.14)' : 'rgba(255, 255, 255, 0.3)';
  const accentColor = isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(255, 255, 255, 0.82)';
  const pips = rankPipCount[rankInfo.band];

  return (
    <View
      style={[
        styles.root,
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
          styles.halo,
          {
            width: tokens.halo,
            height: tokens.halo,
            borderRadius: tokens.halo / 2,
            backgroundColor: palette.haloColor,
          },
        ]}
      />
      <View
        pointerEvents="none"
        style={[
          styles.rotatedFrame,
          {
            width: tokens.diamond,
            height: tokens.diamond,
            borderRadius: tokens.diamondRadius,
            borderColor: palette.badgeBorder,
            backgroundColor: diamondSurface,
          },
        ]}
      />
      <View
        style={[
          styles.shell,
          {
            width: tokens.shell,
            height: tokens.shell,
            borderRadius: tokens.shellRadius,
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
        <View
          pointerEvents="none"
          style={[
            styles.innerRing,
            {
              width: tokens.inner,
              height: tokens.inner,
              borderRadius: tokens.innerRadius,
              borderColor: innerBorder,
              backgroundColor: innerSurface,
            },
          ]}
        />
        <View
          pointerEvents="none"
          style={[
            styles.sigilCap,
            {
              top: tokens.capTop,
              width: tokens.capWidth,
              height: tokens.capHeight,
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
            styles.levelNumber,
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
              styles.pipsRow,
              {
                gap: tokens.pipGap,
                bottom: tokens.pipBottom,
              },
            ]}
          >
            {Array.from({ length: pips }).map((_, index) => (
              <Diamond key={`${rankInfo.band}-${index}`} size={tokens.pipsSize} color={accentColor} />
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
}

export default memo(RankEmblem);

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  halo: {
    position: 'absolute',
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
    fontWeight: '800',
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
  sigilRoot: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  sigilLine: {
    position: 'absolute',
  },
  sigilWing: {
    position: 'absolute',
    borderRadius: 999,
  },
});
