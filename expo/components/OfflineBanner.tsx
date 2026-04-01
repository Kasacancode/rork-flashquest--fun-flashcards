import React, { useEffect, useRef, useState } from 'react';
import { AppState, Animated, Platform, StyleSheet, Text, View } from 'react-native';
import { WifiOff } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

async function checkConnectivity(): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4000);

  try {
    await fetch('https://clients3.google.com/generate_204', {
      method: 'HEAD',
      signal: controller.signal,
    });
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

export default function OfflineBanner() {
  const insets = useSafeAreaInsets();
  const opacity = useRef(new Animated.Value(0)).current;
  const [isOffline, setIsOffline] = useState<boolean>(false);
  const [shouldRender, setShouldRender] = useState<boolean>(false);

  useEffect(() => {
    if (isOffline) {
      setShouldRender(true);
      Animated.timing(opacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
      return;
    }

    Animated.timing(opacity, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        setShouldRender(false);
      }
    });
  }, [isOffline, opacity]);

  useEffect(() => {
    if (Platform.OS === 'web') {
      const syncOnlineState = () => {
        setIsOffline(!navigator.onLine);
      };

      syncOnlineState();
      window.addEventListener('online', syncOnlineState);
      window.addEventListener('offline', syncOnlineState);

      return () => {
        window.removeEventListener('online', syncOnlineState);
        window.removeEventListener('offline', syncOnlineState);
      };
    }

    let active = true;

    const runConnectivityCheck = async () => {
      const connected = await checkConnectivity();
      if (active) {
        setIsOffline(!connected);
      }
    };

    void runConnectivityCheck();

    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        void runConnectivityCheck();
      }
    });

    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  if (!shouldRender) {
    return null;
  }

  return (
    <Animated.View style={[styles.banner, { opacity, paddingTop: insets.top, paddingBottom: 6 }]}>
      <View style={styles.content}>
        <WifiOff color="#FFFFFF" size={14} strokeWidth={2.2} />
        <Text style={styles.text}>No internet connection</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 12,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 6,
  },
  text: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700' as const,
  },
});
