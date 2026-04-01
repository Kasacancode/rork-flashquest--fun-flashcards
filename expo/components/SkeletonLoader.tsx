import React, { useEffect, useMemo } from 'react';
import {
  Animated,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { useTheme } from '@/context/ThemeContext';

interface SkeletonBoxProps {
  width: number | string;
  height: number;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
  sharedAnim?: Animated.Value;
}

interface SkeletonCardProps {
  style?: StyleProp<ViewStyle>;
  sharedAnim?: Animated.Value;
}

const sharedPulseAnim = new Animated.Value(0.3);
let sharedPulseStarted = false;

function ensureSharedPulseAnimation() {
  if (sharedPulseStarted) {
    return;
  }

  sharedPulseStarted = true;

  Animated.loop(
    Animated.sequence([
      Animated.timing(sharedPulseAnim, {
        toValue: 0.7,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(sharedPulseAnim, {
        toValue: 0.3,
        duration: 500,
        useNativeDriver: true,
      }),
    ])
  ).start();
}

export function SkeletonBox({
  width,
  height,
  borderRadius = 8,
  style,
  sharedAnim,
}: SkeletonBoxProps) {
  const { isDark } = useTheme();
  const pulseAnim = sharedAnim ?? sharedPulseAnim;
  const boxStyle = useMemo<ViewStyle>(
    () => ({
      width: width as ViewStyle['width'],
      height,
      borderRadius,
      backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)',
    }),
    [borderRadius, height, isDark, width]
  );

  useEffect(() => {
    ensureSharedPulseAnimation();
  }, []);

  return (
    <Animated.View
      style={[
        styles.box,
        boxStyle,
        { opacity: pulseAnim },
        style,
      ]}
    />
  );
}

export function SkeletonCard({ style, sharedAnim }: SkeletonCardProps) {
  const { isDark } = useTheme();
  const containerStyle = useMemo(
    () => ({
      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.7)',
      borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
    }),
    [isDark]
  );

  return (
    <View style={[styles.card, containerStyle, style]}>
      <SkeletonBox width="70%" height={18} borderRadius={10} sharedAnim={sharedAnim} />
      <SkeletonBox width="40%" height={14} borderRadius={8} sharedAnim={sharedAnim} />
      <SkeletonBox width="25%" height={12} borderRadius={8} sharedAnim={sharedAnim} />
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    overflow: 'hidden',
  },
  card: {
    borderRadius: 20,
    padding: 16,
    gap: 10,
    borderWidth: 1,
  },
});
