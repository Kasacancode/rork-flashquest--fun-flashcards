import { X } from 'lucide-react-native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { useTheme } from '@/context/ThemeContext';
import { isFirstVisit, markVisited, type FirstVisitScreen } from '@/utils/firstVisit';

interface FirstVisitCardProps {
  screen: FirstVisitScreen;
  title: string;
  lines: string[];
  accentColor: string;
}

export default function FirstVisitCard({ screen, title, lines, accentColor }: FirstVisitCardProps) {
  const { theme, isDark } = useTheme();
  const [visible, setVisible] = useState<boolean>(false);
  const opacity = useRef<Animated.Value>(new Animated.Value(0)).current;

  useEffect(() => {
    let isMounted = true;

    isFirstVisit(screen)
      .then((firstVisit) => {
        if (!isMounted || !firstVisit) {
          return;
        }

        setVisible(true);
        Animated.timing(opacity, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }).start();
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [opacity, screen]);

  const handleDismiss = useCallback(() => {
    Animated.timing(opacity, {
      toValue: 0,
      duration: 180,
      useNativeDriver: true,
    }).start(() => {
      setVisible(false);
      void markVisited(screen);
    });
  }, [opacity, screen]);

  if (!visible) {
    return null;
  }

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity,
          backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
          borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
          borderLeftColor: accentColor,
        },
      ]}
      accessible={true}
      accessibilityRole="alert"
      accessibilityLabel={`${title}. ${lines.join(' ')}`}
      testID={`first-visit-card-${screen}`}
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
        <TouchableOpacity
          onPress={handleDismiss}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityLabel="Dismiss tip"
          accessibilityRole="button"
          testID={`first-visit-card-dismiss-${screen}`}
        >
          <X color={theme.textSecondary} size={16} strokeWidth={2.4} />
        </TouchableOpacity>
      </View>
      {lines.map((line, index) => (
        <Text key={`${screen}-${index}`} style={[styles.line, { color: theme.textSecondary }]}>
          {line}
        </Text>
      ))}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 14,
    borderWidth: 1,
    borderLeftWidth: 3,
    padding: 14,
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    flex: 1,
    fontSize: 14,
    fontWeight: '800',
    marginRight: 12,
  },
  line: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '500',
    marginBottom: 4,
  },
});
