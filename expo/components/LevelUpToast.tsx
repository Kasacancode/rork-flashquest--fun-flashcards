import React, { useEffect, useRef, useCallback, useState } from 'react';
import { Animated, Text, View, StyleSheet } from 'react-native';
import { Star } from 'lucide-react-native';

import ConfettiCelebration from '@/components/ConfettiCelebration';
import { triggerNotification, NotificationFeedbackType } from '@/utils/haptics';
import { useReduceMotion } from '@/utils/reduceMotion';
import { playSound } from '@/utils/sounds';

interface Props {
  levelUp: { level: number; title: string } | null;
  onDismiss: () => void;
}

export default function LevelUpToast({ levelUp, onDismiss }: Props) {
  const reduceMotion = useReduceMotion();
  const slide = useRef(new Animated.Value(-120)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const [showConfetti, setShowConfetti] = useState<boolean>(false);

  const dismiss = useCallback(() => {
    setShowConfetti(false);

    if (reduceMotion) {
      slide.setValue(-120);
      opacity.setValue(0);
      onDismiss();
      return;
    }

    Animated.parallel([
      Animated.timing(slide, { toValue: -120, duration: 300, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start(() => onDismiss());
  }, [opacity, onDismiss, reduceMotion, slide]);

  useEffect(() => {
    if (!levelUp) {
      return;
    }

    triggerNotification(NotificationFeedbackType.Success);
    void playSound('levelUp');
    setShowConfetti(!reduceMotion);

    if (reduceMotion) {
      slide.setValue(60);
      opacity.setValue(1);
    } else {
      slide.setValue(-120);
      opacity.setValue(0);
      Animated.parallel([
        Animated.spring(slide, { toValue: 60, friction: 8, tension: 60, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]).start();
    }

    const timer = setTimeout(dismiss, 4000);
    return () => clearTimeout(timer);
  }, [dismiss, levelUp, opacity, reduceMotion, slide]);

  if (!levelUp) {
    return null;
  }

  return (
    <>
      <ConfettiCelebration trigger={showConfetti} />
      <Animated.View style={[styles.wrap, { transform: [{ translateY: slide }], opacity }]} pointerEvents="none">
        <View
          style={styles.toast}
          accessible={true}
          accessibilityLabel={`Level up! You are now level ${levelUp.level}.`}
          accessibilityRole="alert"
        >
          <View style={styles.icon}><Star color="#fff" size={20} fill="#fff" /></View>
          <View style={styles.text}>
            <Text style={styles.label}>Level Up!</Text>
            <Text style={styles.title}>Level {levelUp.level} — {levelUp.title}</Text>
          </View>
        </View>
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', top: 0, left: 16, right: 16, zIndex: 9998 },
  toast: { flexDirection: 'row', alignItems: 'center', borderRadius: 16, borderLeftWidth: 4, borderLeftColor: '#F59E0B', paddingVertical: 14, paddingHorizontal: 14, gap: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 10, backgroundColor: 'rgba(15,23,42,0.95)' },
  icon: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F59E0B', justifyContent: 'center', alignItems: 'center' },
  text: { flex: 1 },
  label: { fontSize: 11, fontWeight: '800', color: '#FBBF24', textTransform: 'uppercase', letterSpacing: 0.5 },
  title: { fontSize: 16, fontWeight: '700', color: '#fff', marginTop: 2 },
});
