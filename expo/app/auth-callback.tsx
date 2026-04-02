import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import ResponsiveContainer from '@/components/ResponsiveContainer';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { uploadToCloud } from '@/utils/cloudSync';
import { AUTH_ROUTE, CHOOSE_USERNAME_ROUTE, SETTINGS_ROUTE } from '@/utils/routes';
import { fetchUsername } from '@/utils/usernameService';

const FALLBACK_DELAY_MS = 3500;

export default function AuthCallbackScreen() {
  const router = useRouter();
  const { isDark } = useTheme();
  const { isLoading, isSignedIn, user } = useAuth();
  const [showFallback, setShowFallback] = useState<boolean>(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowFallback(true);
    }, FALLBACK_DELAY_MS);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!isSignedIn || !user || isLoading) {
      return;
    }

    void uploadToCloud(user.id);
    void fetchUsername(user.id)
      .then((existingUsername) => {
        if (existingUsername) {
          router.replace(SETTINGS_ROUTE);
          return;
        }

        router.replace(CHOOSE_USERNAME_ROUTE);
      })
      .catch(() => {
        router.replace(SETTINGS_ROUTE);
      });
  }, [isLoading, isSignedIn, router, user]);

  const gradientColors = useMemo<readonly [string, string, string]>(() => (
    isDark
      ? ['#08111f', '#1c1633', '#0b1322']
      : ['#667eea', '#764ba2', '#f093fb']
  ), [isDark]);
  const cardBg = isDark ? 'rgba(15, 23, 42, 0.82)' : 'rgba(255, 255, 255, 0.92)';
  const cardBorder = isDark ? 'rgba(148, 163, 184, 0.18)' : 'rgba(255, 255, 255, 0.55)';
  const titleColor = isDark ? '#FFFFFF' : '#1E293B';
  const subtitleColor = isDark ? 'rgba(255,255,255,0.66)' : '#64748B';
  const buttonBorder = isDark ? 'rgba(255,255,255,0.18)' : 'rgba(30,41,59,0.12)';

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={gradientColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <ResponsiveContainer maxWidth={560} style={styles.content}>
          <View style={[styles.card, { backgroundColor: cardBg, borderColor: cardBorder }]} testID="auth-callback-screen">
            <ActivityIndicator size="large" color="#6366F1" />
            <Text style={[styles.title, { color: titleColor }]}>Finishing sign in</Text>
            <Text style={[styles.subtitle, { color: subtitleColor }]}>We&apos;re securely connecting your account and bringing you back into FlashQuest.</Text>

            {showFallback && !isSignedIn ? (
              <TouchableOpacity
                style={[styles.button, { borderColor: buttonBorder }]}
                onPress={() => router.replace(AUTH_ROUTE)}
                activeOpacity={0.85}
                testID="auth-callback-back-button"
              >
                <Text style={[styles.buttonText, { color: titleColor }]}>Back to sign in</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </ResponsiveContainer>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  card: {
    borderRadius: 24,
    borderWidth: 1,
    paddingHorizontal: 24,
    paddingVertical: 28,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: 18,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 22,
    textAlign: 'center',
  },
  button: {
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '700',
  },
});
