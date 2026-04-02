import React, { type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useResponsiveLayout } from '@/utils/responsive';

interface ResponsiveContainerProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  maxWidth?: number;
}

export default function ResponsiveContainer({ children, style, maxWidth }: ResponsiveContainerProps) {
  const { contentMaxWidth } = useResponsiveLayout();
  const effectiveMaxWidth = maxWidth ?? contentMaxWidth;

  if (!effectiveMaxWidth) {
    return <View style={style}>{children}</View>;
  }

  return (
    <View style={[styles.outer, style]}>
      <View style={[styles.inner, { maxWidth: effectiveMaxWidth }]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    width: '100%',
    alignItems: 'center',
  },
  inner: {
    width: '100%',
  },
});
