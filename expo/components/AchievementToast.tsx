import { useCallback, useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { Award } from 'lucide-react-native';

import { triggerNotification, NotificationFeedbackType } from '@/utils/haptics';
import { useReduceMotion } from '@/utils/reduceMotion';
import { playSound } from '@/utils/sounds';

interface AchievementToastProps {
  achievement: { name: string; xp: number; color: string; description?: string } | null;
  onDismiss: () => void;
}

export default function AchievementToast({ achievement, onDismiss }: AchievementToastProps) {
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
    if (!achievement) {
      return;
    }

    triggerNotification(NotificationFeedbackType.Success);
    void playSound('achievement');

    if (reduceMotion) {
      slideAnim.setValue(60);
      opacityAnim.setValue(1);
    } else {
      slideAnim.setValue(-120);
      opacityAnim.setValue(0);
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 60, friction: 8, tension: 60, useNativeDriver: true }),
        Animated.timing(opacityAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]).start();
    }

    const timer = setTimeout(dismiss, 3000);
    return () => clearTimeout(timer);
  }, [achievement, dismiss, opacityAnim, reduceMotion, slideAnim]);

  if (!achievement) {
    return null;
  }

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ translateY: slideAnim }],
          opacity: opacityAnim,
        },
      ]}
      pointerEvents="none"
    >
      <View
        style={[styles.toast, { borderLeftColor: achievement.color }]}
        accessible={true}
        accessibilityLabel={`Achievement unlocked: ${achievement.name}. ${achievement.description ?? `Earned ${achievement.xp} XP.`}`}
        accessibilityRole="alert"
      >
        <View style={[styles.iconWrap, { backgroundColor: achievement.color }]}> 
          <Award color="#fff" size={18} />
        </View>
        <View style={styles.textWrap}>
          <Text style={styles.label}>Achievement Unlocked!</Text>
          <Text style={styles.name}>{achievement.name}</Text>
        </View>
        <View style={styles.xpBadge}>
          <Text style={styles.xpText}>+{achievement.xp} XP</Text>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 16,
    right: 16,
    zIndex: 9999,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    borderRadius: 16,
    borderLeftWidth: 4,
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 10,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textWrap: {
    flex: 1,
  },
  label: {
    fontSize: 11,
    fontWeight: '800' as const,
    color: 'rgba(255,255,255,0.6)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  name: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#fff',
    marginTop: 2,
  },
  xpBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  xpText: {
    fontSize: 12,
    fontWeight: '800' as const,
    color: '#6ee7b7',
  },
});
