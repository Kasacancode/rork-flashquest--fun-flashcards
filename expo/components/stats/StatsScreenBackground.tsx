import { LinearGradient } from 'expo-linear-gradient';
import React, { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import type { StatsViewStyles } from '@/components/stats/statsScreen.types';

interface StatsScreenBackgroundProps {
  backgroundGradient: readonly [string, string, string];
  upperAtmosphereGradient: readonly [string, string, string];
  lowerAtmosphereGradient: readonly [string, string, string];
  shellOverlayGradient: readonly [string, string, string];
  topGlowColor: string;
  midGlowColor: string;
  bottomGlowColor: string;
  styles: StatsViewStyles<'topGlow' | 'midGlow' | 'bottomGlow'>;
}

function StatsScreenBackgroundComponent({
  backgroundGradient,
  upperAtmosphereGradient,
  lowerAtmosphereGradient,
  shellOverlayGradient,
  topGlowColor,
  midGlowColor,
  bottomGlowColor,
  styles,
}: StatsScreenBackgroundProps) {
  return (
    <>
      <LinearGradient
        colors={backgroundGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={upperAtmosphereGradient}
        start={{ x: 0.02, y: 0 }}
        end={{ x: 0.86, y: 0.44 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <LinearGradient
        colors={lowerAtmosphereGradient}
        start={{ x: 0.16, y: 0.52 }}
        end={{ x: 0.94, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <LinearGradient
        colors={shellOverlayGradient}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.95, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <View pointerEvents="none" style={[styles.topGlow, { backgroundColor: topGlowColor }]} />
      <View pointerEvents="none" style={[styles.midGlow, { backgroundColor: midGlowColor }]} />
      <View pointerEvents="none" style={[styles.bottomGlow, { backgroundColor: bottomGlowColor }]} />
    </>
  );
}

export default memo(StatsScreenBackgroundComponent);
