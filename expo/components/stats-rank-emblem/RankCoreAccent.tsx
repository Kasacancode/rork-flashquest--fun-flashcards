import React, { memo } from 'react';
import { View } from 'react-native';

import { Diamond, emblemStyles, type RankCoreAccentProps } from '@/components/stats-rank-emblem/shared';

function RankCoreAccent({ band, size, color, isDark = false }: RankCoreAccentProps) {
  const unit = size / 12;
  const softOpacity = isDark ? 0.12 : 0.1;
  const strongOpacity = isDark ? 0.18 : 0.15;
  const lineThickness = Math.max(unit * 0.5, 1);
  const microDiamond = Math.max(unit * 1.2, 1.3);
  const orbitSize = size * 0.58;

  if (band === 'foundation') {
    return (
      <View pointerEvents="none" style={[emblemStyles.coreAccentRoot, { width: size, height: size }]}>
        <View
          style={[
            emblemStyles.coreAccentLine,
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
        <Diamond size={microDiamond} color={color} style={{ position: 'absolute', bottom: unit * 0.95, opacity: strongOpacity }} />
      </View>
    );
  }

  if (band === 'momentum') {
    return (
      <View pointerEvents="none" style={[emblemStyles.coreAccentRoot, { width: size, height: size }]}>
        <View
          style={[
            emblemStyles.coreAccentLine,
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
            emblemStyles.coreAccentLine,
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
            emblemStyles.coreAccentLine,
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
      <View pointerEvents="none" style={[emblemStyles.coreAccentRoot, { width: size, height: size }]}>
        <View
          style={[
            emblemStyles.coreAccentLine,
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
            emblemStyles.coreAccentLine,
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
            emblemStyles.coreAccentLine,
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
        <Diamond size={microDiamond} color={color} style={{ position: 'absolute', bottom: unit * 0.95, opacity: strongOpacity }} />
      </View>
    );
  }

  if (band === 'advanced') {
    return (
      <View pointerEvents="none" style={[emblemStyles.coreAccentRoot, { width: size, height: size }]}>
        <Diamond size={microDiamond} color={color} style={{ position: 'absolute', top: unit * 1.1, opacity: strongOpacity }} />
        <View
          style={[
            emblemStyles.coreAccentLine,
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
            emblemStyles.coreAccentLine,
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
            emblemStyles.coreAccentLine,
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
    <View pointerEvents="none" style={[emblemStyles.coreAccentRoot, { width: size, height: size }]}>
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
      <Diamond size={microDiamond} color={color} style={{ position: 'absolute', top: unit * 1, opacity: strongOpacity }} />
      <Diamond size={microDiamond} color={color} style={{ position: 'absolute', left: unit * 1, opacity: strongOpacity }} />
      <Diamond size={microDiamond} color={color} style={{ position: 'absolute', right: unit * 1, opacity: strongOpacity }} />
      <Diamond size={microDiamond} color={color} style={{ position: 'absolute', bottom: unit * 1, opacity: strongOpacity }} />
    </View>
  );
}

export default memo(RankCoreAccent);
