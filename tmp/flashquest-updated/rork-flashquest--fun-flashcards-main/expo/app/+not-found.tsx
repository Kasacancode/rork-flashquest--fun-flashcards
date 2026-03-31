import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { AlertCircle, Home } from 'lucide-react-native';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTheme } from '@/context/ThemeContext';

export default function NotFoundScreen() {
  const router = useRouter();
  const { theme, isDark } = useTheme();

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[theme.gradientStart, theme.gradientMid, theme.gradientEnd]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {isDark && (
        <LinearGradient
          colors={['rgba(6,10,22,0.06)', 'rgba(6,10,22,0.34)', 'rgba(5,8,20,0.76)']}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.95, y: 1 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      )}
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.content}>
          <AlertCircle color="rgba(255,255,255,0.5)" size={64} strokeWidth={1.5} />
          <Text style={styles.title}>Page Not Found</Text>
          <Text style={styles.subtitle}>This screen doesn’t exist or may have been moved.</Text>
          <TouchableOpacity
            style={styles.button}
            onPress={() => router.replace('/')}
            activeOpacity={0.85}
          >
            <Home color="#fff" size={20} strokeWidth={2.2} />
            <Text style={styles.buttonText}>Go Home</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, gap: 16 },
  title: { fontSize: 24, fontWeight: '800', color: '#fff', textAlign: 'center' },
  subtitle: { fontSize: 15, fontWeight: '500', color: 'rgba(255,255,255,0.6)', textAlign: 'center', maxWidth: 280 },
  button: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 16, paddingVertical: 14, paddingHorizontal: 24, marginTop: 8 },
  buttonText: { fontSize: 16, fontWeight: '700', color: '#fff' },
});
