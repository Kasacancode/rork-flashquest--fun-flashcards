import { useCallback, useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { ArrowDownToLine } from 'lucide-react-native';

import { useReduceMotion } from '@/utils/reduceMotion';

interface DownloadToastProps {
  download: { deckName: string; newDownloads: number } | null;
  onDismiss: () => void;
}

export default function DownloadToast({ download, onDismiss }: DownloadToastProps) {
  const reduceMotion = useReduceMotion();
  const slideAnim = useRef(new Animated.Value(-120)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  const dismiss = useCallback(() => {
    if (reduceMotion) {
      slideAnim.setValue(-120);
      opacityAnim.setValue(0);
      onDismiss();
      return;
    }

    Animated.parallel([
      Animated.timing(slideAnim, { toValue: -120, duration: 300, useNativeDriver: true }),
      Animated.timing(opacityAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start(() => onDismiss());
  }, [onDismiss, opacityAnim, reduceMotion, slideAnim]);

  useEffect(() => {
    if (!download) {
      return;
    }

    if (reduceMotion) {
      slideAnim.setValue(0);
      opacityAnim.setValue(1);
    } else {
      slideAnim.setValue(-120);
      opacityAnim.setValue(0);
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 60, friction: 9 }),
        Animated.timing(opacityAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]).start();
    }

    const timer = setTimeout(dismiss, 4000);
    return () => clearTimeout(timer);
  }, [dismiss, download, opacityAnim, reduceMotion, slideAnim]);

  if (!download) {
    return null;
  }

  const count = download.newDownloads;
  const subtitle = `Your deck "${download.deckName}" is getting traction`;

  return (
    <Animated.View
      style={[
        styles.container,
        { transform: [{ translateY: slideAnim }], opacity: opacityAnim },
      ]}
      pointerEvents="none"
      testID="download-toast"
    >
      <View
        style={styles.toast}
        accessible={true}
        accessibilityRole="alert"
        accessibilityLabel={`${count} new download${count === 1 ? '' : 's'}. ${subtitle}`}
      >
        <View style={styles.iconWrap}>
          <ArrowDownToLine color="#FFFFFF" size={16} strokeWidth={2.5} />
        </View>
        <View style={styles.textWrap}>
          <Text style={styles.title} numberOfLines={1}>
            {count} new download{count === 1 ? '' : 's'}!
          </Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 60,
    left: 16,
    right: 16,
    zIndex: 9999,
    alignItems: 'center',
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10B981',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
    maxWidth: 400,
    width: '100%',
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWrap: {
    flex: 1,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800' as const,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
    fontWeight: '500' as const,
    marginTop: 1,
  },
});
