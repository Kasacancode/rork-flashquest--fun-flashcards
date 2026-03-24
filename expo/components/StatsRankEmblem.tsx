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

interface RankFrameAccentProps {
  band: LevelRankBand;
  size: number;
  color: string;
}

interface RankCoreAccentProps {
  band: LevelRankBand;
  size: number;
  color: string;
  isDark?: boolean;
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

interface BandGeometry {
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

function getBandGeometry(band: LevelRankBand): BandGeometry {
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

const RankFrameAccent = memo(function RankFrameAccent({ band, size, color }: RankFrameAccentProps) {
  const unit = size / 12;
  const lineThickness = Math.max(unit * 0.22, 1);
  const strongOpacity = 0.28;
  const softOpacity = 0.16;
  const microDiamond = Math.max(unit * 1.45, 2);
  const smallDiamond = Math.max(unit * 1.75, 2.4);

  if (band === 'foundation') {
    return (
      <View pointerEvents="none" style={[styles.frameAccentRoot, { width: size, height: size }]}>
        <Diamond
          size={smallDiamond}
          color={color}
          style={{
            position: 'absolute',
            top: unit * 1.2,
            opacity: strongOpacity,
          }}
        />
        <View
          style={[
            styles.verticalRail,
            {
              bottom: unit * 0.9,
              width: lineThickness,
              height: unit * 2.8,
              borderRadius: 999,
              backgroundColor: color,
              opacity: softOpacity,
            },
          ]}
        />
      </View>
    );
  }

  if (band === 'momentum') {
    return (
      <View pointerEvents="none" style={[styles.frameAccentRoot, { width: size, height: size }]}>
        <View
          style={[
            styles.verticalRail,
            {
              left: unit * 1.85,
              width: lineThickness,
              height: unit * 6.4,
              borderRadius: 999,
              backgroundColor: color,
              opacity: softOpacity,
            },
          ]}
        />
        <View
          style={[
            styles.verticalRail,
            {
              right: unit * 1.85,
              width: lineThickness,
              height: unit * 6.4,
              borderRadius: 999,
              backgroundColor: color,
              opacity: softOpacity,
            },
          ]}
        />
        <Diamond
          size={microDiamond}
          color={color}
          style={{
            position: 'absolute',
            top: unit * 1.5,
            opacity: strongOpacity,
          }}
        />
        <Diamond
          size={microDiamond}
          color={color}
          style={{
            position: 'absolute',
            bottom: unit * 1.5,
            opacity: strongOpacity,
          }}
        />
      </View>
    );
  }

  if (band === 'skilled') {
    return (
      <View pointerEvents="none" style={[styles.frameAccentRoot, { width: size, height: size }]}>
        <View
          style={[
            styles.chevronRail,
            {
              left: unit * 0.55,
              width: unit * 2.7,
              height: lineThickness,
              backgroundColor: color,
              opacity: strongOpacity,
              transform: [{ rotate: '-24deg' }],
            },
          ]}
        />
        <View
          style={[
            styles.chevronRail,
            {
              right: unit * 0.55,
              width: unit * 2.7,
              height: lineThickness,
              backgroundColor: color,
              opacity: strongOpacity,
              transform: [{ rotate: '24deg' }],
            },
          ]}
        />
        <Diamond
          size={microDiamond}
          color={color}
          style={{
            position: 'absolute',
            bottom: unit * 1.4,
            opacity: strongOpacity,
          }}
        />
      </View>
    );
  }

  if (band === 'advanced') {
    return (
      <View pointerEvents="none" style={[styles.frameAccentRoot, { width: size, height: size }]}>
        <Diamond
          size={microDiamond}
          color={color}
          style={{
            position: 'absolute',
            top: unit * 1.2,
            left: unit * 3.05,
            opacity: strongOpacity,
          }}
        />
        <Diamond
          size={smallDiamond}
          color={color}
          style={{
            position: 'absolute',
            top: unit * 0.55,
            opacity: strongOpacity,
          }}
        />
        <Diamond
          size={microDiamond}
          color={color}
          style={{
            position: 'absolute',
            top: unit * 1.2,
            right: unit * 3.05,
            opacity: strongOpacity,
          }}
        />
        <View
          style={[
            styles.horizontalRail,
            {
              bottom: unit * 1.15,
              width: unit * 6.2,
              height: lineThickness,
              borderRadius: 999,
              backgroundColor: color,
              opacity: softOpacity,
            },
          ]}
        />
      </View>
    );
  }

  return (
    <View pointerEvents="none" style={[styles.frameAccentRoot, { width: size, height: size }]}>
      <View
        style={{
          position: 'absolute',
          width: size * 0.82,
          height: size * 0.82,
          borderRadius: (size * 0.82) / 2,
          borderWidth: 1,
          borderColor: color,
          opacity: softOpacity,
        }}
      />
      <Diamond
        size={microDiamond}
        color={color}
        style={{
          position: 'absolute',
          top: unit * 1.2,
          opacity: strongOpacity,
        }}
      />
      <Diamond
        size={microDiamond}
        color={color}
        style={{
          position: 'absolute',
          bottom: unit * 1.2,
          opacity: strongOpacity,
        }}
      />
      <Diamond
        size={microDiamond}
        color={color}
        style={{
          position: 'absolute',
          left: unit * 1.2,
          opacity: strongOpacity,
        }}
      />
      <Diamond
        size={microDiamond}
        color={color}
        style={{
          position: 'absolute',
          right: unit * 1.2,
          opacity: strongOpacity,
        }}
      />
    </View>
  );
});

const RankSigil = memo(function RankSigil({ band, color, size }: RankSigilProps) {
  const unit = size / 12;
  const softOpacity = 0.42;
  const strongOpacity = 0.68;
  const diamondSize = Math.max(unit * 2.6, 2);
  const miniDiamond = Math.max(unit * 1.55, 1.5);
  const lineThickness = Math.max(unit * 0.8, 1);

  if (band === 'foundation') {
    return (
      <View style={[styles.sigilRoot, { width: size, height: size }]}>
        <Diamond size={diamondSize} color={color} />
        <View
          style={[
            styles.sigilLine,
            {
              bottom: unit * 0.9,
              width: lineThickness,
              height: unit * 2.5,
              backgroundColor: color,
              opacity: softOpacity,
              borderRadius: 999,
            },
          ]}
        />
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
              height: unit * 6.3,
              backgroundColor: color,
              opacity: softOpacity,
              borderRadius: 999,
            },
          ]}
        />
        <Diamond
          size={unit * 2.1}
          color={color}
          style={{ position: 'absolute', top: unit * 1.35, opacity: strongOpacity }}
        />
        <Diamond
          size={unit * 2.1}
          color={color}
          style={{ position: 'absolute', bottom: unit * 1.35, opacity: strongOpacity }}
        />
      </View>
    );
  }

  if (band === 'skilled') {
    return (
      <View style={[styles.sigilRoot, { width: size, height: size }]}>
        <Diamond size={unit * 2.4} color={color} />
        <View
          style={[
            styles.sigilWing,
            {
              left: unit * 0.9,
              width: unit * 2.35,
              height: lineThickness,
              backgroundColor: color,
              opacity: softOpacity,
            },
          ]}
        />
        <View
          style={[
            styles.sigilWing,
            {
              right: unit * 0.9,
              width: unit * 2.35,
              height: lineThickness,
              backgroundColor: color,
              opacity: softOpacity,
            },
          ]}
        />
        <Diamond
          size={miniDiamond}
          color={color}
          style={{ position: 'absolute', bottom: unit * 1.05, opacity: strongOpacity }}
        />
      </View>
    );
  }

  if (band === 'advanced') {
    return (
      <View style={[styles.sigilRoot, { width: size, height: size }]}>
        <Diamond
          size={miniDiamond}
          color={color}
          style={{ position: 'absolute', top: unit * 1.2, left: unit * 1.55, opacity: strongOpacity }}
        />
        <Diamond
          size={unit * 2.2}
          color={color}
          style={{ position: 'absolute', top: unit * 0.45, opacity: strongOpacity }}
        />
        <Diamond
          size={miniDiamond}
          color={color}
          style={{ position: 'absolute', top: unit * 1.2, right: unit * 1.55, opacity: strongOpacity }}
        />
        <Diamond
          size={unit * 2.3}
          color={color}
          style={{ position: 'absolute', bottom: unit * 1.3, opacity: strongOpacity }}
        />
        <View
          style={[
            styles.sigilLine,
            {
              bottom: unit * 0.85,
              width: unit * 5.7,
              height: lineThickness,
              backgroundColor: color,
              opacity: softOpacity,
              borderRadius: 999,
            },
          ]}
        />
      </View>
    );
  }

  return (
    <View style={[styles.sigilRoot, { width: size, height: size }]}>
      <Diamond size={unit * 2.4} color={color} />
      <Diamond
        size={miniDiamond}
        color={color}
        style={{ position: 'absolute', top: unit * 0.75, opacity: strongOpacity }}
      />
      <Diamond
        size={miniDiamond}
        color={color}
        style={{ position: 'absolute', left: unit * 1.1, opacity: strongOpacity }}
      />
      <Diamond
        size={miniDiamond}
        color={color}
        style={{ position: 'absolute', right: unit * 1.1, opacity: strongOpacity }}
      />
      <Diamond
        size={miniDiamond}
        color={color}
        style={{ position: 'absolute', bottom: unit * 0.75, opacity: strongOpacity }}
      />
    </View>
  );
});

const RankCoreAccent = memo(function RankCoreAccent({
  band,
  size,
  color,
  isDark = false,
}: RankCoreAccentProps) {
  const unit = size / 12;
  const softOpacity = isDark ? 0.12 : 0.1;
  const strongOpacity = isDark ? 0.18 : 0.15;
  const lineThickness = Math.max(unit * 0.5, 1);
  const microDiamond = Math.max(unit * 1.2, 1.3);
  const orbitSize = size * 0.58;

  if (band === 'foundation') {
    return (
      <View pointerEvents="none" style={[styles.coreAccentRoot, { width: size, height: size }]}> 
        <View
          style={[
            styles.coreAccentLine,
            {
              bottom: unit * 1,
              width: lineThickness,
              height: unit * 4.2,
              borderRadius: 999,
              backgroundColor: color,
              opacity: softOpacity,
            },
          ]}
        />
        <Diamond
          size={microDiamond}
          color={color}
          style={{ position: 'absolute', bottom: unit * 0.95, opacity: strongOpacity }}
        />
      </View>
    );
  }

  if (band === 'momentum') {
    return (
      <View pointerEvents="none" style={[styles.coreAccentRoot, { width: size, height: size }]}> 
        <View
          style={[
            styles.coreAccentLine,
            {
              width: lineThickness,
              height: unit * 3.8,
              bottom: unit * 1,
              borderRadius: 999,
              backgroundColor: color,
              opacity: softOpacity,
            },
          ]}
        />
        <View
          style={[
            styles.coreAccentLine,
            {
              left: unit * 1.15,
              bottom: unit * 3.55,
              width: unit * 3.1,
              height: lineThickness,
              borderRadius: 999,
              backgroundColor: color,
              opacity: strongOpacity,
              transform: [{ rotate: '-30deg' }],
            },
          ]}
        />
        <View
          style={[
            styles.coreAccentLine,
            {
              right: unit * 1.15,
              bottom: unit * 3.55,
              width: unit * 3.1,
              height: lineThickness,
              borderRadius: 999,
              backgroundColor: color,
              opacity: strongOpacity,
              transform: [{ rotate: '30deg' }],
            },
          ]}
        />
      </View>
    );
  }

  if (band === 'skilled') {
    return (
      <View pointerEvents="none" style={[styles.coreAccentRoot, { width: size, height: size }]}> 
        <View
          style={[
            styles.coreAccentLine,
            {
              left: unit * 1.1,
              width: unit * 2.4,
              height: lineThickness,
              borderRadius: 999,
              backgroundColor: color,
              opacity: strongOpacity,
            },
          ]}
        />
        <View
          style={[
            styles.coreAccentLine,
            {
              right: unit * 1.1,
              width: unit * 2.4,
              height: lineThickness,
              borderRadius: 999,
              backgroundColor: color,
              opacity: strongOpacity,
            },
          ]}
        />
        <View
          style={[
            styles.coreAccentLine,
            {
              bottom: unit * 1.15,
              width: lineThickness,
              height: unit * 3,
              borderRadius: 999,
              backgroundColor: color,
              opacity: softOpacity,
            },
          ]}
        />
        <Diamond
          size={microDiamond}
          color={color}
          style={{ position: 'absolute', bottom: unit * 0.95, opacity: strongOpacity }}
        />
      </View>
    );
  }

  if (band === 'advanced') {
    return (
      <View pointerEvents="none" style={[styles.coreAccentRoot, { width: size, height: size }]}> 
        <Diamond
          size={microDiamond}
          color={color}
          style={{ position: 'absolute', top: unit * 1.1, opacity: strongOpacity }}
        />
        <View
          style={[
            styles.coreAccentLine,
            {
              left: unit * 1.15,
              top: unit * 3.2,
              width: unit * 2.8,
              height: lineThickness,
              borderRadius: 999,
              backgroundColor: color,
              opacity: strongOpacity,
              transform: [{ rotate: '-26deg' }],
            },
          ]}
        />
        <View
          style={[
            styles.coreAccentLine,
            {
              right: unit * 1.15,
              top: unit * 3.2,
              width: unit * 2.8,
              height: lineThickness,
              borderRadius: 999,
              backgroundColor: color,
              opacity: strongOpacity,
              transform: [{ rotate: '26deg' }],
            },
          ]}
        />
        <View
          style={[
            styles.coreAccentLine,
            {
              bottom: unit * 1.1,
              width: unit * 4.5,
              height: lineThickness,
              borderRadius: 999,
              backgroundColor: color,
              opacity: softOpacity,
            },
          ]}
        />
      </View>
    );
  }

  return (
    <View pointerEvents="none" style={[styles.coreAccentRoot, { width: size, height: size }]}> 
      <View
        style={{
          position: 'absolute',
          width: orbitSize,
          height: orbitSize,
          borderRadius: orbitSize / 2,
          borderWidth: 1,
          borderColor: color,
          opacity: softOpacity,
        }}
      />
      <Diamond
        size={microDiamond}
        color={color}
        style={{ position: 'absolute', top: unit * 1, opacity: strongOpacity }}
      />
      <Diamond
        size={microDiamond}
        color={color}
        style={{ position: 'absolute', left: unit * 1, opacity: strongOpacity }}
      />
      <Diamond
        size={microDiamond}
        color={color}
        style={{ position: 'absolute', right: unit * 1, opacity: strongOpacity }}
      />
      <Diamond
        size={microDiamond}
        color={color}
        style={{ position: 'absolute', bottom: unit * 1, opacity: strongOpacity }}
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
          styles.rotatedFrame,
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
          styles.shell,
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
            styles.innerRing,
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
            styles.sigilCap,
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

const styles = StyleSheet.create({
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
