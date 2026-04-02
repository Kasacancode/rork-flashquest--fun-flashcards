import React, { useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, StyleSheet, View } from 'react-native';

import { useReduceMotion } from '@/utils/reduceMotion';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const CONFETTI_COLORS = [
  '#FF6B6B',
  '#4ECDC4',
  '#FFD93D',
  '#6366F1',
  '#F59E0B',
  '#10B981',
  '#8B5CF6',
  '#EC4899',
  '#3B82F6',
  '#F97316',
] as const;

const PARTICLE_COUNT = 40;

interface Particle {
  id: number;
  x: number;
  color: string;
  size: number;
  driftX: number;
  rotationDeg: string;
  fallAnim: Animated.Value;
}

interface ConfettiCelebrationProps {
  trigger: boolean;
}

export default function ConfettiCelebration({ trigger }: ConfettiCelebrationProps) {
  const reduceMotion = useReduceMotion();
  const [particles, setParticles] = useState<Particle[]>([]);
  const previousTriggerRef = useRef<boolean>(false);

  useEffect(() => {
    if (trigger && !previousTriggerRef.current) {
      if (reduceMotion) {
        setParticles([]);
        previousTriggerRef.current = trigger;
        return;
      }

      const nextParticles: Particle[] = Array.from({ length: PARTICLE_COUNT }, (_, index) => ({
        id: index,
        x: Math.random() * SCREEN_WIDTH,
        color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)] ?? '#FF6B6B',
        size: 5 + (Math.random() * 7),
        driftX: (Math.random() - 0.5) * 80,
        rotationDeg: `${(Math.random() > 0.5 ? 1 : -1) * (180 + (Math.random() * 360))}deg`,
        fallAnim: new Animated.Value(0),
      }));

      setParticles(nextParticles);

      Animated.stagger(
        35,
        nextParticles.map((particle) => Animated.timing(particle.fallAnim, {
          toValue: 1,
          duration: 1600 + Math.round(Math.random() * 700),
          useNativeDriver: true,
        })),
      ).start(() => {
        setParticles([]);
      });
    }

    previousTriggerRef.current = trigger;
  }, [reduceMotion, trigger]);

  if (particles.length === 0) {
    return null;
  }

  return (
    <View style={styles.container} pointerEvents="none">
      {particles.map((particle) => (
        <Animated.View
          key={particle.id}
          style={[
            styles.particle,
            {
              left: particle.x,
              width: particle.size,
              height: particle.size * 1.4,
              backgroundColor: particle.color,
              borderRadius: particle.size * 0.3,
              opacity: particle.fallAnim.interpolate({
                inputRange: [0, 0.7, 1],
                outputRange: [1, 0.8, 0],
              }),
              transform: [
                {
                  translateY: particle.fallAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-40, SCREEN_HEIGHT + 40],
                  }),
                },
                {
                  translateX: particle.fallAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, particle.driftX],
                  }),
                },
                {
                  rotate: particle.fallAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0deg', particle.rotationDeg],
                  }),
                },
              ],
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
  },
  particle: {
    position: 'absolute',
  },
});
