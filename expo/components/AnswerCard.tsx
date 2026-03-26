import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import React, { useRef, useEffect, useCallback, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Platform, Dimensions, NativeSyntheticEvent, TextLayoutEventData } from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_GAP = 10;
const CARD_PADDING = 12;
const GRID_HORIZONTAL_MARGIN = 12;
const AVAILABLE_WIDTH = SCREEN_WIDTH - (GRID_HORIZONTAL_MARGIN * 2) - (CARD_PADDING * 2) - CARD_GAP;
const CARD_WIDTH = Math.floor(AVAILABLE_WIDTH / 2);
const CARD_HEIGHT = Math.min(Math.max(CARD_WIDTH * 1.05, 130), 152);

export type CardSuit = '♠' | '♥' | '♦' | '♣';
export type AnswerCardState = 'idle' | 'selected' | 'correct' | 'wrong' | 'disabled';

const SUITS: CardSuit[] = ['♠', '♥', '♦', '♣'];

type OptionSizing = {
  fontSize: number;
  lineHeight: number;
};

type CardPalette = {
  gradient: readonly [string, string, string];
  border: string;
  innerBorder: string;
  text: string;
  suitColor: string;
  shadow: string;
  glaze: string;
  texture: string;
};

function getOptionFontSize(text: string): OptionSizing {
  const len = text.length;
  if (len <= 12) return { fontSize: 16, lineHeight: 20 };
  if (len <= 24) return { fontSize: 14, lineHeight: 18 };
  if (len <= 40) return { fontSize: 12, lineHeight: 16 };
  if (len <= 55) return { fontSize: 11, lineHeight: 14 };
  return { fontSize: 10, lineHeight: 13 };
}

const CARD_PALETTES: Record<CardSuit, CardPalette> = {
  '♠': {
    gradient: ['#FFF9F2', '#FBEBD8', '#F4DDC8'],
    border: '#FF993C',
    innerBorder: 'rgba(255, 255, 255, 0.78)',
    text: '#473122',
    suitColor: '#8B8A8C',
    shadow: 'rgba(207, 109, 33, 0.38)',
    glaze: 'rgba(255, 255, 255, 0.58)',
    texture: 'rgba(255, 153, 60, 0.08)',
  },
  '♥': {
    gradient: ['#FFF2FF', '#F5E4FF', '#EDD7FF'],
    border: '#D573E6',
    innerBorder: 'rgba(255, 255, 255, 0.76)',
    text: '#442A57',
    suitColor: '#EC6B9F',
    shadow: 'rgba(186, 92, 208, 0.34)',
    glaze: 'rgba(255, 255, 255, 0.5)',
    texture: 'rgba(213, 115, 230, 0.08)',
  },
  '♦': {
    gradient: ['#FCFDF4', '#F2F5DE', '#EBF0CB'],
    border: '#9DCE5F',
    innerBorder: 'rgba(255, 255, 255, 0.76)',
    text: '#344025',
    suitColor: '#EB5A5A',
    shadow: 'rgba(132, 171, 53, 0.34)',
    glaze: 'rgba(255, 255, 255, 0.52)',
    texture: 'rgba(157, 206, 95, 0.08)',
  },
  '♣': {
    gradient: ['#F7FAFF', '#E7EEFF', '#DDE7FF'],
    border: '#7FA3FF',
    innerBorder: 'rgba(255, 255, 255, 0.78)',
    text: '#2A3F64',
    suitColor: '#7991C9',
    shadow: 'rgba(92, 128, 214, 0.34)',
    glaze: 'rgba(255, 255, 255, 0.56)',
    texture: 'rgba(127, 163, 255, 0.08)',
  },
};

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
  const localShake = useRef(new Animated.Value(0)).current;
  const localOpacity = useRef(new Animated.Value(1)).current;
  const pressDepthAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

  const scale = animatedScale ?? localScale;
  const shake = animatedShake ?? localShake;
  const opacity = animatedOpacity ?? localOpacity;
  const [optionSizing, setOptionSizing] = useState<OptionSizing>(() => getOptionFontSize(optionText));

  useEffect(() => {
    pressDepthAnim.stopAnimation();
    pressDepthAnim.setValue(0);

    if (!animatedScale) {
      localScale.stopAnimation();
      localScale.setValue(1);
    }
  }, [optionText, state, animatedScale, localScale, pressDepthAnim]);

  useEffect(() => {
    if (state === 'correct') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, { toValue: 1, duration: 600, useNativeDriver: false }),
          Animated.timing(glowAnim, { toValue: 0.35, duration: 600, useNativeDriver: false }),
        ])
      ).start();
    } else {
      glowAnim.stopAnimation();
      glowAnim.setValue(0);
    }
  }, [state, glowAnim]);

  useEffect(() => {
    setOptionSizing(getOptionFontSize(optionText));
  }, [optionText]);

  const handleOptionTextLayout = useCallback((event: NativeSyntheticEvent<TextLayoutEventData>) => {
    const lineCount = event.nativeEvent.lines.length;

    setOptionSizing((previousSizing) => {
      if (lineCount <= 5 || previousSizing.fontSize <= 9) {
        return previousSizing;
      }

      const nextFontSize = Math.max(9, previousSizing.fontSize - 1);
      const nextLineHeight = Math.max(12, previousSizing.lineHeight - 1);

      if (nextFontSize === previousSizing.fontSize && nextLineHeight === previousSizing.lineHeight) {
        return previousSizing;
      }

      return {
        fontSize: nextFontSize,
        lineHeight: nextLineHeight,
      };
    });
  }, []);

  const handlePressIn = () => {
    if (state === 'idle') {
      Animated.parallel([
        Animated.spring(scale, { toValue: 0.976, useNativeDriver: true, speed: 52 }),
        Animated.timing(pressDepthAnim, { toValue: 1, duration: 90, useNativeDriver: true }),
      ]).start();
    }
  };

  const handlePressOut = () => {
    if (state === 'idle') {
      Animated.parallel([
        Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 5 }),
        Animated.timing(pressDepthAnim, { toValue: 0, duration: 140, useNativeDriver: true }),
      ]).start();
    }
  };

  const handlePress = () => {
    if (state !== 'idle') {
      return;
    }

    if (Platform.OS !== 'web') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    Animated.sequence([
      Animated.timing(scale, { toValue: 0.94, duration: 75, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, friction: 4.5, useNativeDriver: true }),
    ]).start();

    onPress();
  };

  const palette = CARD_PALETTES[suit];
  const textureOpacity = index % 2 === 0 ? 0.24 : 0.18;

  const getCardStateStyle = () => {
    switch (state) {
      case 'correct':
        return {
          borderColor: '#22C55E',
          shadowColor: '#22C55E',
          overlayColor: 'rgba(34, 197, 94, 0.12)',
          textColor: '#14532D',
          opacity: 1,
        };
      case 'wrong':
        return {
          borderColor: '#EF4444',
          shadowColor: '#EF4444',
          overlayColor: 'rgba(239, 68, 68, 0.14)',
          textColor: '#7F1D1D',
          opacity: 1,
        };
      case 'selected':
        return {
          borderColor: '#F59E0B',
          shadowColor: '#F59E0B',
          overlayColor: 'rgba(245, 158, 11, 0.08)',
          textColor: palette.text,
          opacity: 1,
        };
      case 'disabled':
        return {
          borderColor: palette.border,
          shadowColor: palette.shadow,
          overlayColor: 'rgba(255, 255, 255, 0.06)',
          textColor: palette.text,
          opacity: 0.7,
        };
      default:
        return {
          borderColor: palette.border,
          shadowColor: palette.shadow,
          overlayColor: 'transparent',
          textColor: palette.text,
          opacity: 1,
        };
    }
  };

  const cardStateStyle = getCardStateStyle();

  const translateY = pressDepthAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -3],
  });

  const glowOpacity = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.18],
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
            { translateY },
          ],
        },
      ]}
    >
      <TouchableOpacity
        style={[
          styles.card,
          {
            borderColor: cardStateStyle.borderColor,
            shadowColor: cardStateStyle.shadowColor,
            opacity: cardStateStyle.opacity,
          },
        ]}
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={1}
        disabled={state !== 'idle'}
        testID={`answer-card-${index}`}
      >
        <LinearGradient
          colors={palette.gradient}
          start={{ x: 0.06, y: 0.04 }}
          end={{ x: 1, y: 1 }}
          style={styles.cardFill}
        />
        <View pointerEvents="none" style={[styles.cardTexture, { backgroundColor: palette.texture, opacity: textureOpacity }]} />
        <View pointerEvents="none" style={[styles.cardGlaze, { backgroundColor: palette.glaze }]} />
        <View pointerEvents="none" style={[styles.stateWash, { backgroundColor: cardStateStyle.overlayColor }]} />
        <View pointerEvents="none" style={[styles.innerBorder, { borderColor: palette.innerBorder }]} />

        <View style={styles.suitCornerTop}>
          <Text style={[styles.suitText, { color: palette.suitColor }]}>{suit}</Text>
        </View>

        <View style={styles.suitCornerBottom}>
          <Text style={[styles.suitText, { color: palette.suitColor }]}>{suit}</Text>
        </View>

        {state === 'correct' ? (
          <Animated.View pointerEvents="none" style={[styles.glowOverlay, { opacity: glowOpacity }]} />
        ) : null}

        <View style={styles.cardContent}>
          <Text
            style={[
              styles.optionText,
              {
                fontSize: optionSizing.fontSize,
                lineHeight: optionSizing.lineHeight,
                color: cardStateStyle.textColor,
              },
            ]}
            onTextLayout={handleOptionTextLayout}
          >
            {optionText}
          </Text>
        </View>

        {state === 'correct' ? (
          <View style={styles.feedbackBadge}>
            <Text style={styles.feedbackIcon}>✓</Text>
          </View>
        ) : null}

        {state === 'wrong' ? (
          <View style={[styles.feedbackBadge, styles.feedbackBadgeWrong]}>
            <Text style={styles.feedbackIcon}>✗</Text>
          </View>
        ) : null}
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
    'Pick a card.',
    'Choose wisely.',
    'Make your move.',
    "What's your call?",
    'Trust your gut.',
  ],
  correct: [
    'Sharp.',
    'Lucky draw.',
    'Well played.',
    'Nice call.',
    'You know your cards.',
  ],
  wrong: [
    'Not this one.',
    'Bad draw.',
    'The house wins.',
    'Better luck next time.',
    'Close, but no.',
  ],
  timeout: [
    "Time's up.",
    'Too slow.',
    'Clock ran out.',
    'Dealer takes it.',
  ],
};

export function getRandomDealerLine(type: keyof typeof DEALER_LINES, lastLine?: string): string {
  const lines = DEALER_LINES[type].filter((line) => line !== lastLine);
  return lines[Math.floor(Math.random() * lines.length)];
}

export { CARD_WIDTH, CARD_HEIGHT, CARD_GAP, CARD_PADDING, GRID_HORIZONTAL_MARGIN };

const styles = StyleSheet.create({
  cardWrapper: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
  },
  card: {
    width: '100%',
    height: '100%',
    borderRadius: 28,
    borderWidth: 4,
    paddingHorizontal: 12,
    paddingVertical: 12,
    justifyContent: 'center',
    alignItems: 'center',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 14,
    elevation: 8,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#fff',
  },
  cardFill: {
    ...StyleSheet.absoluteFillObject,
  },
  cardTexture: {
    position: 'absolute',
    width: '78%',
    height: '72%',
    right: -14,
    bottom: -10,
    borderRadius: 32,
    transform: [{ rotate: '-12deg' }],
  },
  cardGlaze: {
    position: 'absolute',
    top: 10,
    left: 12,
    width: '68%',
    height: '48%',
    borderRadius: 26,
    transform: [{ rotate: '-8deg' }],
  },
  stateWash: {
    ...StyleSheet.absoluteFillObject,
  },
  innerBorder: {
    position: 'absolute',
    top: 6,
    left: 6,
    right: 6,
    bottom: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  suitCornerTop: {
    position: 'absolute',
    top: 12,
    left: 12,
  },
  suitCornerBottom: {
    position: 'absolute',
    bottom: 10,
    right: 12,
  },
  suitText: {
    fontSize: 26,
    fontWeight: '800' as const,
    opacity: 0.68,
  },
  cardContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 18,
    zIndex: 1,
  },
  optionText: {
    width: '100%',
    fontWeight: '800' as const,
    textAlign: 'center',
    flexShrink: 1,
    letterSpacing: -0.2,
  },
  glowOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#22c55e',
  },
  feedbackBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#16a34a',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
    zIndex: 2,
  },
  feedbackBadgeWrong: {
    backgroundColor: '#dc2626',
  },
  feedbackIcon: {
    fontSize: 13,
    fontWeight: '800' as const,
    color: '#fff',
  },
  dealerReaction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
  },
  dealerAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dealerEmoji: {
    fontSize: 12,
  },
  dealerBubble: {
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    maxWidth: '80%',
  },
  dealerBubbleCorrect: {
    backgroundColor: 'rgba(22, 163, 74, 0.3)',
  },
  dealerBubbleWrong: {
    backgroundColor: 'rgba(220, 38, 38, 0.3)',
  },
  dealerText: {
    fontSize: 12,
    fontWeight: '500' as const,
    color: 'rgba(255, 255, 255, 0.85)',
    fontStyle: 'italic',
  },
});
