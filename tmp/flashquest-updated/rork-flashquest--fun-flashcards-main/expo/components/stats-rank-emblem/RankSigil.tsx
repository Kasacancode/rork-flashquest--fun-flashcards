import React, { memo } from 'react';
import { View } from 'react-native';

import { Diamond, emblemStyles, type RankSigilProps } from '@/components/stats-rank-emblem/shared';

function RankSigil({ band, color, size }: RankSigilProps) {
  const unit = size / 12;
  const softOpacity = 0.42;
  const strongOpacity = 0.68;
  const diamondSize = Math.max(unit * 2.6, 2);
  const miniDiamond = Math.max(unit * 1.55, 1.5);
  const lineThickness = Math.max(unit * 0.8, 1);

  if (band === 'foundation') {
    return (
      <View style={[emblemStyles.sigilRoot, { width: size, height: size }]}>
        <Diamond size={diamondSize} color={color} />
        <View
          style={[
            emblemStyles.sigilLine,
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
      <View style={[emblemStyles.sigilRoot, { width: size, height: size }]}>
        <View
          style={[
            emblemStyles.sigilLine,
            {
              width: lineThickness,
              height: unit * 6.3,
              backgroundColor: color,
              opacity: softOpacity,
              borderRadius: 999,
            },
          ]}
        />
        <Diamond size={unit * 2.1} color={color} style={{ position: 'absolute', top: unit * 1.35, opacity: strongOpacity }} />
        <Diamond size={unit * 2.1} color={color} style={{ position: 'absolute', bottom: unit * 1.35, opacity: strongOpacity }} />
      </View>
    );
  }

  if (band === 'skilled') {
    return (
      <View style={[emblemStyles.sigilRoot, { width: size, height: size }]}>
        <Diamond size={unit * 2.4} color={color} />
        <View
          style={[
            emblemStyles.sigilWing,
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
            emblemStyles.sigilWing,
            {
              right: unit * 0.9,
              width: unit * 2.35,
              height: lineThickness,
              backgroundColor: color,
              opacity: softOpacity,
            },
          ]}
        />
        <Diamond size={miniDiamond} color={color} style={{ position: 'absolute', bottom: unit * 1.05, opacity: strongOpacity }} />
      </View>
    );
  }

  if (band === 'advanced') {
    return (
      <View style={[emblemStyles.sigilRoot, { width: size, height: size }]}>
        <Diamond size={miniDiamond} color={color} style={{ position: 'absolute', top: unit * 1.2, left: unit * 1.55, opacity: strongOpacity }} />
        <Diamond size={unit * 2.2} color={color} style={{ position: 'absolute', top: unit * 0.45, opacity: strongOpacity }} />
        <Diamond size={miniDiamond} color={color} style={{ position: 'absolute', top: unit * 1.2, right: unit * 1.55, opacity: strongOpacity }} />
        <Diamond size={unit * 2.3} color={color} style={{ position: 'absolute', bottom: unit * 1.3, opacity: strongOpacity }} />
        <View
          style={[
            emblemStyles.sigilLine,
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
    <View style={[emblemStyles.sigilRoot, { width: size, height: size }]}>
      <Diamond size={unit * 2.4} color={color} />
      <Diamond size={miniDiamond} color={color} style={{ position: 'absolute', top: unit * 0.75, opacity: strongOpacity }} />
      <Diamond size={miniDiamond} color={color} style={{ position: 'absolute', left: unit * 1.1, opacity: strongOpacity }} />
      <Diamond size={miniDiamond} color={color} style={{ position: 'absolute', right: unit * 1.1, opacity: strongOpacity }} />
      <Diamond size={miniDiamond} color={color} style={{ position: 'absolute', bottom: unit * 0.75, opacity: strongOpacity }} />
    </View>
  );
}

export default memo(RankSigil);
