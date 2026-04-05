import React, { type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useResponsiveLayout } from '@/utils/responsive';

interface ResponsiveContainerProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  maxWidth?: number;
  fill?: boolean;
}

export default function ResponsiveContainer({ children, style, maxWidth, fill = false }: ResponsiveContainerProps) {
  const { contentMaxWidth } = useResponsiveLayout();
  const effectiveMaxWidth = maxWidth ?? contentMaxWidth;

  if (!effectiveMaxWidth) {
    return <View style={[fill ? styles.fill : null, style]}>{children}</View>;
  }

  return (
    <View style={[styles.outer, fill ? styles.fill : null, style]}>
      <View style={[styles.inner, fill ? styles.fill : null, { maxWidth: effectiveMaxWidth }]}>{children}</View>
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
  fill: {
    flex: 1,
    minHeight: 0,
  },
});
