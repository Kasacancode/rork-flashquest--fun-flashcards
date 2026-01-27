import * as Haptics from 'expo-haptics';
import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Platform, Dimensions } from 'react-native';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 52) / 2;
const CARD_HEIGHT = Math.min(140, width * 0.35);

export type CardSuit = '♠' | '♥' | '♦' | '♣';
export type AnswerCardState = 'idle' | 'selected' | 'correct' | 'wrong' | 'disabled';

const SUITS: CardSuit[] = ['♠', '♥', '♦', '♣'];

const SUIT_COLORS: Record<CardSuit, string> = {
  '♠': '#1e293b',
  '♥': '#dc2626',
  '♦': '#dc2626',
  '♣': '#1e293b',
};

const CARD_BACKGROUNDS = [
  { bg: '#fef7f0', border: '#d4a574', accent: 'rgba(212, 165, 116, 0.15)' },
  { bg: '#fff5f5', border: '#c9a0a0', accent: 'rgba(201, 160, 160, 0.15)' },
  { bg: '#f0f7ff', border: '#7c9fc9', accent: 'rgba(124, 159, 201, 0.15)' },
  { bg: '#f5f5f0', border: '#a0a078', accent: 'rgba(160, 160, 120, 0.15)' },
];

export function getSuitForIndex(index: number): CardSuit {
  return SUITS[index % SUITS.length];
}

interface AnswerCardProps {
  optionText: string;
  suit: CardSuit;
  index: number;
  state: AnswerCardState;
  onPress: () => void;
  animatedScale?: Animated.Value;
  animatedShake?: Animated.Value;
  animatedOpacity?: Animated.Value;
}

export function AnswerCard({
  optionText,
  suit,
  index,
  state,
  onPress,
  animatedScale,
  animatedShake,
  animatedOpacity,
}: AnswerCardProps) {
  const localScale = useRef(new Animated.Value(1)).current;
  const tiltAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  
  const scale = animatedScale || localScale;
  const shake = animatedShake || new Animated.Value(0);
  const opacity = animatedOpacity || new Animated.Value(1);

  useEffect(() => {
    if (state === 'correct') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, { toValue: 1, duration: 600, useNativeDriver: false }),
          Animated.timing(glowAnim, { toValue: 0.4, duration: 600, useNativeDriver: false }),
        ])
      ).start();
    } else {
      glowAnim.stopAnimation();
      glowAnim.setValue(0);
    }
  }, [state, glowAnim]);

  const handlePressIn = () => {
    if (state === 'idle') {
      Animated.parallel([
        Animated.spring(scale, { toValue: 0.96, useNativeDriver: true, speed: 50 }),
        Animated.timing(tiltAnim, { toValue: 1, duration: 100, useNativeDriver: true }),
      ]).start();
    }
  };

  const handlePressOut = () => {
    if (state === 'idle') {
      Animated.parallel([
        Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 4 }),
        Animated.timing(tiltAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
      ]).start();
    }
  };

  const handlePress = () => {
    if (state !== 'idle') return;
    
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    
    Animated.sequence([
      Animated.timing(scale, { toValue: 0.92, duration: 80, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, friction: 4, useNativeDriver: true }),
    ]).start();
    
    onPress();
  };

  const cardColors = CARD_BACKGROUNDS[index % CARD_BACKGROUNDS.length];
  const suitColor = SUIT_COLORS[suit];

  const getCardStyle = () => {
    switch (state) {
      case 'correct':
        return {
          backgroundColor: '#dcfce7',
          borderColor: '#16a34a',
          shadowColor: '#16a34a',
        };
      case 'wrong':
        return {
          backgroundColor: '#fee2e2',
          borderColor: '#dc2626',
          shadowColor: '#dc2626',
        };
      case 'selected':
        return {
          backgroundColor: cardColors.bg,
          borderColor: '#f59e0b',
          shadowColor: '#f59e0b',
        };
      case 'disabled':
        return {
          backgroundColor: cardColors.bg,
          borderColor: cardColors.border,
          opacity: 0.5,
        };
      default:
        return {
          backgroundColor: cardColors.bg,
          borderColor: cardColors.border,
          shadowColor: '#000',
        };
    }
  };

  const cardStyle = getCardStyle();

  const rotate = tiltAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '-2deg'],
  });

  const glowOpacity = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.6],
  });

  return (
    <Animated.View
      style={[
        styles.cardWrapper,
        {
          opacity,
          transform: [
            { scale },
            { translateX: shake },
            { rotate },
          ],
        },
      ]}
    >
      <TouchableOpacity
        style={[
          styles.card,
          {
            backgroundColor: cardStyle.backgroundColor,
            borderColor: cardStyle.borderColor,
            shadowColor: cardStyle.shadowColor,
            opacity: cardStyle.opacity ?? 1,
          },
        ]}
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={1}
        disabled={state !== 'idle'}
      >
        <View style={[styles.cardTexture, { backgroundColor: cardColors.accent }]} />
        
        <View style={styles.suitCornerTop}>
          <Text style={[styles.suitText, { color: suitColor }]}>{suit}</Text>
        </View>
        
        <View style={styles.suitCornerBottom}>
          <Text style={[styles.suitText, styles.suitRotated, { color: suitColor }]}>{suit}</Text>
        </View>
        
        <View style={styles.cardContent}>
          <Text
            style={[
              styles.optionText,
              state === 'correct' && styles.optionTextCorrect,
              state === 'wrong' && styles.optionTextWrong,
            ]}
            numberOfLines={4}
            adjustsFontSizeToFit
            minimumFontScale={0.7}
          >
            {optionText}
          </Text>
        </View>

        {state === 'correct' && (
          <Animated.View style={[styles.glowOverlay, { opacity: glowOpacity }]} />
        )}

        {state === 'correct' && (
          <View style={styles.feedbackBadge}>
            <Text style={styles.feedbackIcon}>✓</Text>
          </View>
        )}

        {state === 'wrong' && (
          <View style={[styles.feedbackBadge, styles.feedbackBadgeWrong]}>
            <Text style={styles.feedbackIcon}>✗</Text>
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

interface DealerReactionProps {
  text: string;
  isCorrect?: boolean;
}

export function DealerReaction({ text, isCorrect }: DealerReactionProps) {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 1, friction: 5, useNativeDriver: true }),
      Animated.timing(opacityAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
  }, [text, scaleAnim, opacityAnim]);

  return (
    <Animated.View
      style={[
        styles.dealerReaction,
        { transform: [{ scale: scaleAnim }], opacity: opacityAnim },
      ]}
    >
      <View style={styles.dealerAvatar}>
        <Text style={styles.dealerEmoji}>🎩</Text>
      </View>
      <View
        style={[
          styles.dealerBubble,
          isCorrect === true && styles.dealerBubbleCorrect,
          isCorrect === false && styles.dealerBubbleWrong,
        ]}
      >
        <Text style={styles.dealerText}>{text}</Text>
      </View>
    </Animated.View>
  );
}

export const DEALER_LINES = {
  idle: [
    "Pick a card.",
    "Choose wisely.",
    "Make your move.",
    "What's your call?",
    "Trust your gut.",
  ],
  correct: [
    "Sharp.",
    "Lucky draw.",
    "Well played.",
    "Nice call.",
    "You know your cards.",
  ],
  wrong: [
    "Not this one.",
    "Bad draw.",
    "The house wins.",
    "Better luck next time.",
    "Close, but no.",
  ],
  timeout: [
    "Time's up.",
    "Too slow.",
    "Clock ran out.",
    "Dealer takes it.",
  ],
};

export function getRandomDealerLine(type: keyof typeof DEALER_LINES, lastLine?: string): string {
  const lines = DEALER_LINES[type].filter(l => l !== lastLine);
  return lines[Math.floor(Math.random() * lines.length)];
}

const styles = StyleSheet.create({
  cardWrapper: {
    width: CARD_WIDTH,
  },
  card: {
    width: '100%',
    minHeight: CARD_HEIGHT,
    borderRadius: 16,
    borderWidth: 2,
    padding: 14,
    justifyContent: 'center',
    alignItems: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
    overflow: 'hidden',
    position: 'relative',
  },
  cardTexture: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.5,
  },
  suitCornerTop: {
    position: 'absolute',
    top: 8,
    left: 10,
  },
  suitCornerBottom: {
    position: 'absolute',
    bottom: 8,
    right: 10,
  },
  suitText: {
    fontSize: 18,
    fontWeight: '700' as const,
    opacity: 0.6,
  },
  suitRotated: {
    transform: [{ rotate: '180deg' }],
  },
  cardContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  optionText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#1e293b',
    textAlign: 'center',
    lineHeight: 21,
  },
  optionTextCorrect: {
    color: '#166534',
  },
  optionTextWrong: {
    color: '#991b1b',
  },
  glowOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#22c55e',
    borderRadius: 14,
  },
  feedbackBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#16a34a',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  feedbackBadgeWrong: {
    backgroundColor: '#dc2626',
  },
  feedbackIcon: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#fff',
  },
  dealerReaction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
  },
  dealerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dealerEmoji: {
    fontSize: 20,
  },
  dealerBubble: {
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
    maxWidth: '75%',
  },
  dealerBubbleCorrect: {
    backgroundColor: 'rgba(22, 163, 74, 0.3)',
  },
  dealerBubbleWrong: {
    backgroundColor: 'rgba(220, 38, 38, 0.3)',
  },
  dealerText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#fff',
    fontStyle: 'italic',
  },
});
