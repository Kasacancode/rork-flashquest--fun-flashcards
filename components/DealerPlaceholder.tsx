import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';

import { useTheme } from '@/context/ThemeContext';

const IDLE_LINES = [
  "Pick a card, any card.",
  "Let's see what you've got.",
  "Ready when you are.",
  "Make your choice.",
  "Trust your instincts.",
  "The cards await.",
];

const CORRECT_LINES = [
  "Sharp.",
  "Lucky pull.",
  "You're learning fast.",
  "Impressive.",
  "Well played.",
  "Nicely done.",
  "Correct!",
  "You've got skill.",
];

const WRONG_LINES = [
  "Not this one.",
  "Bad draw.",
  "Try again.",
  "Close, but no.",
  "Better luck next time.",
  "That's not it.",
  "Wrong card.",
  "Keep practicing.",
];

type DialogueType = 'idle' | 'correct' | 'wrong';

interface DealerPlaceholderProps {
  dialogueType?: DialogueType;
  customDialogue?: string;
}

function getRandomLine(lines: string[], lastLine?: string): string {
  const available = lines.filter(l => l !== lastLine);
  const pool = available.length > 0 ? available : lines;
  return pool[Math.floor(Math.random() * pool.length)];
}

export default function DealerPlaceholder({ 
  dialogueType = 'idle',
  customDialogue,
}: DealerPlaceholderProps) {
  const { theme } = useTheme();
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const lastLineRef = useRef<string>('');

  const getDialogue = (): string => {
    if (customDialogue) return customDialogue;
    
    let lines: string[];
    switch (dialogueType) {
      case 'correct':
        lines = CORRECT_LINES;
        break;
      case 'wrong':
        lines = WRONG_LINES;
        break;
      default:
        lines = IDLE_LINES;
    }
    
    const line = getRandomLine(lines, lastLineRef.current);
    lastLineRef.current = line;
    return line;
  };

  const dialogue = getDialogue();

  useEffect(() => {
    fadeAnim.setValue(0.7);
    scaleAnim.setValue(0.95);
    
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 8,
        tension: 100,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  }, [dialogueType, customDialogue, fadeAnim, scaleAnim]);

  const avatarBgColor = dialogueType === 'correct' 
    ? theme.success 
    : dialogueType === 'wrong' 
      ? theme.error 
      : theme.primary;

  return (
    <View style={styles.container}>
      <Animated.View 
        style={[
          styles.avatarContainer,
          { 
            backgroundColor: avatarBgColor,
            transform: [{ scale: scaleAnim }],
            opacity: fadeAnim,
          }
        ]}
      >
        <Text style={styles.emoji}>🃏</Text>
        <Text style={[styles.label, { color: theme.white }]}>Dealer</Text>
      </Animated.View>
      
      <Animated.View 
        style={[
          styles.speechBubble,
          { 
            backgroundColor: theme.cardBackground,
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }],
          }
        ]}
      >
        <View style={[styles.speechTail, { backgroundColor: theme.cardBackground }]} />
        <Text style={[styles.dialogue, { color: theme.text }]}>{dialogue}</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  avatarContainer: {
    width: 80,
    height: 80,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  emoji: {
    fontSize: 32,
  },
  label: {
    fontSize: 12,
    fontWeight: '700' as const,
    marginTop: 2,
  },
  speechBubble: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 16,
    maxWidth: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  speechTail: {
    position: 'absolute',
    top: -8,
    left: '50%',
    marginLeft: -8,
    width: 16,
    height: 16,
    borderRadius: 4,
    transform: [{ rotate: '45deg' }],
  },
  dialogue: {
    fontSize: 16,
    fontWeight: '600' as const,
    textAlign: 'center',
  },
});
