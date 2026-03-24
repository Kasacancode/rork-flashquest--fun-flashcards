import { LinearGradient } from 'expo-linear-gradient';
import React, { memo } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface PracticeSessionEmptyStateProps {
  isDark: boolean;
  title: string;
  ctaLabel?: string;
  onPress?: () => void;
}

function PracticeSessionEmptyStateComponent({ isDark, title, ctaLabel, onPress }: PracticeSessionEmptyStateProps) {
  return (
    <View style={{ flex: 1, backgroundColor: '#4338ca' }}>
      <LinearGradient
        colors={isDark ? ['#0f172a', '#1e293b'] : ['#4338ca', '#6366f1']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={{ position: 'absolute', inset: 0 }}
      />
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <Text style={{ fontSize: 18, fontWeight: '700', color: '#fff', marginBottom: ctaLabel ? 16 : 0 }}>{title}</Text>
          {ctaLabel && onPress ? (
            <TouchableOpacity
              onPress={onPress}
              style={{ backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 16, paddingVertical: 14, paddingHorizontal: 24 }}
            >
              <Text style={{ fontSize: 16, fontWeight: '700', color: '#fff' }}>{ctaLabel}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </SafeAreaView>
    </View>
  );
}

export default memo(PracticeSessionEmptyStateComponent);
