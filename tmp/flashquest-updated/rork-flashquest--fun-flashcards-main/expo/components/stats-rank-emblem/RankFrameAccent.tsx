import React, { memo } from 'react';
import { View } from 'react-native';

import { Diamond, emblemStyles, type RankFrameAccentProps } from '@/components/stats-rank-emblem/shared';

function RankFrameAccent({ band, size, color }: RankFrameAccentProps) {
  const unit = size / 12;
  const lineThickness = Math.max(unit * 0.22, 1);
  const strongOpacity = 0.28;
  const softOpacity = 0.16;
  const microDiamond = Math.max(unit * 1.45, 2);
  const smallDiamond = Math.max(unit * 1.75, 2.4);

  if (band === 'foundation') {
    return (
      <View pointerEvents="none" style={[emblemStyles.frameAccentRoot, { width: size, height: size }]}>
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
            emblemStyles.verticalRail,
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
      <View pointerEvents="none" style={[emblemStyles.frameAccentRoot, { width: size, height: size }]}>
        <View
          style={[
            emblemStyles.verticalRail,
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
            emblemStyles.verticalRail,
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
      <View pointerEvents="none" style={[emblemStyles.frameAccentRoot, { width: size, height: size }]}>
        <View
          style={[
            emblemStyles.chevronRail,
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
            emblemStyles.chevronRail,
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
      <View pointerEvents="none" style={[emblemStyles.frameAccentRoot, { width: size, height: size }]}>
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
            emblemStyles.horizontalRail,
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
    <View pointerEvents="none" style={[emblemStyles.frameAccentRoot, { width: size, height: size }]}>
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
      <Diamond size={microDiamond} color={color} style={{ position: 'absolute', top: unit * 1.2, opacity: strongOpacity }} />
      <Diamond size={microDiamond} color={color} style={{ position: 'absolute', bottom: unit * 1.2, opacity: strongOpacity }} />
      <Diamond size={microDiamond} color={color} style={{ position: 'absolute', left: unit * 1.2, opacity: strongOpacity }} />
      <Diamond size={microDiamond} color={color} style={{ position: 'absolute', right: unit * 1.2, opacity: strongOpacity }} />
    </View>
  );
}

export default memo(RankFrameAccent);
