import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  PanResponder,
  Dimensions,
  Platform,
} from 'react-native';
import { Lightbulb, BookOpen, ChevronUp, Lock, CheckCircle } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

import { Flashcard } from '@/types/flashcard';
import { Theme } from '@/constants/colors';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const SWIPE_THRESHOLD = 70;
const DOUBLE_TAP_DELAY = 300;
const SWIPE_COOLDOWN = 300;

interface StudyFeedProps {
  flashcards: Flashcard[];
  theme: Theme;
  isDark: boolean;
  onComplete: () => void;
  onCardResolved?: (cardId: string, correct: boolean) => void;
}

interface CardState {
  isRevealed: boolean;
  hintLevel: 0 | 1 | 2;
  feedbackViewed: boolean;
  resolved: boolean;
}

export default function StudyFeed({
  flashcards,
  theme,
  isDark,
  onComplete,
  onCardResolved,
}: StudyFeedProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [cardState, setCardState] = useState<CardState>({
    isRevealed: false,
    hintLevel: 0,
    feedbackViewed: false,
    resolved: false,
  });
  const [showHintOverlay, setShowHintOverlay] = useState(false);
  const [showFeedbackOverlay, setShowFeedbackOverlay] = useState(false);
  const [currentHintText, setCurrentHintText] = useState('');

  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const flipAnim = useRef(new Animated.Value(0)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const hintSlideAnim = useRef(new Animated.Value(SCREEN_WIDTH)).current;
  const feedbackSlideAnim = useRef(new Animated.Value(-SCREEN_WIDTH)).current;
  const cardScale = useRef(new Animated.Value(1)).current;

  const lastTapRef = useRef<number>(0);
  const lastSwipeRef = useRef<number>(0);
  const isAnimatingRef = useRef(false);

  const currentCard = flashcards[currentIndex];

  const resetCardState = useCallback(() => {
    setCardState({
      isRevealed: false,
      hintLevel: 0,
      feedbackViewed: false,
      resolved: false,
    });
    setShowHintOverlay(false);
    setShowFeedbackOverlay(false);
    flipAnim.setValue(0);
    hintSlideAnim.setValue(SCREEN_WIDTH);
    feedbackSlideAnim.setValue(-SCREEN_WIDTH);
  }, [flipAnim, hintSlideAnim, feedbackSlideAnim]);

  const triggerHaptic = useCallback(() => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, []);

  const triggerShake = useCallback(() => {
    triggerHaptic();
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  }, [shakeAnim, triggerHaptic]);

  const handleDoubleTap = useCallback(() => {
    if (isAnimatingRef.current) return;
    isAnimatingRef.current = true;
    triggerHaptic();

    Animated.sequence([
      Animated.timing(cardScale, { toValue: 0.95, duration: 100, useNativeDriver: true }),
      Animated.timing(cardScale, { toValue: 1, duration: 100, useNativeDriver: true }),
    ]).start();

    Animated.timing(flipAnim, {
      toValue: cardState.isRevealed ? 0 : 1,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setCardState(prev => ({ ...prev, isRevealed: !prev.isRevealed }));
      isAnimatingRef.current = false;
    });
  }, [cardState.isRevealed, flipAnim, cardScale, triggerHaptic]);

  const handleSwipeLeft = useCallback(() => {
    if (cardState.isRevealed || isAnimatingRef.current) return;
    if (Date.now() - lastSwipeRef.current < SWIPE_COOLDOWN) return;
    lastSwipeRef.current = Date.now();

    const newHintLevel = Math.min(cardState.hintLevel + 1, 2) as 0 | 1 | 2;
    if (newHintLevel === cardState.hintLevel && cardState.hintLevel === 2) return;

    triggerHaptic();

    const hintText = newHintLevel === 1 
      ? currentCard?.hint1 || 'No hint available'
      : currentCard?.hint2 || currentCard?.hint1 || 'No hint available';

    setCurrentHintText(hintText);
    setCardState(prev => ({ ...prev, hintLevel: newHintLevel }));
    setShowHintOverlay(true);

    Animated.spring(hintSlideAnim, {
      toValue: 0,
      useNativeDriver: true,
      tension: 50,
      friction: 8,
    }).start();

    setTimeout(() => {
      Animated.timing(hintSlideAnim, {
        toValue: SCREEN_WIDTH,
        duration: 300,
        useNativeDriver: true,
      }).start(() => setShowHintOverlay(false));
    }, 2500);
  }, [cardState, currentCard, hintSlideAnim, triggerHaptic]);

  const handleSwipeRight = useCallback(() => {
    if (!cardState.isRevealed || isAnimatingRef.current) return;
    if (Date.now() - lastSwipeRef.current < SWIPE_COOLDOWN) return;
    lastSwipeRef.current = Date.now();

    triggerHaptic();
    setShowFeedbackOverlay(true);

    Animated.spring(feedbackSlideAnim, {
      toValue: 0,
      useNativeDriver: true,
      tension: 50,
      friction: 8,
    }).start(() => {
      setCardState(prev => ({ ...prev, feedbackViewed: true, resolved: true }));
      onCardResolved?.(currentCard?.id || '', true);
    });
  }, [cardState.isRevealed, currentCard, feedbackSlideAnim, onCardResolved, triggerHaptic]);

  const handleSwipeUp = useCallback(() => {
    if (!cardState.resolved) {
      triggerShake();
      return;
    }

    if (isAnimatingRef.current) return;
    if (Date.now() - lastSwipeRef.current < SWIPE_COOLDOWN) return;
    lastSwipeRef.current = Date.now();
    isAnimatingRef.current = true;

    triggerHaptic();

    Animated.timing(translateY, {
      toValue: -SCREEN_HEIGHT,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      if (currentIndex + 1 >= flashcards.length) {
        onComplete();
      } else {
        setCurrentIndex(prev => prev + 1);
        resetCardState();
        translateY.setValue(0);
      }
      isAnimatingRef.current = false;
    });
  }, [cardState.resolved, currentIndex, flashcards.length, translateY, resetCardState, onComplete, triggerShake, triggerHaptic]);

  const closeFeedbackOverlay = useCallback(() => {
    Animated.timing(feedbackSlideAnim, {
      toValue: -SCREEN_WIDTH,
      duration: 300,
      useNativeDriver: true,
    }).start(() => setShowFeedbackOverlay(false));
  }, [feedbackSlideAnim]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 10 || Math.abs(gestureState.dy) > 10;
      },
      onPanResponderGrant: () => {
        const now = Date.now();
        if (now - lastTapRef.current < DOUBLE_TAP_DELAY) {
          handleDoubleTap();
          lastTapRef.current = 0;
        } else {
          lastTapRef.current = now;
        }
      },
      onPanResponderMove: (_, gestureState) => {
        if (showFeedbackOverlay) {
          feedbackSlideAnim.setValue(-gestureState.dx * 0.3);
        } else {
          translateX.setValue(gestureState.dx * 0.3);
          translateY.setValue(gestureState.dy * 0.3);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        const { dx, dy } = gestureState;

        if (showFeedbackOverlay) {
          if (dx < -SWIPE_THRESHOLD) {
            closeFeedbackOverlay();
          } else {
            Animated.spring(feedbackSlideAnim, {
              toValue: 0,
              useNativeDriver: true,
            }).start();
          }
          return;
        }

        const absDx = Math.abs(dx);
        const absDy = Math.abs(dy);

        if (absDx < SWIPE_THRESHOLD && absDy < SWIPE_THRESHOLD) {
          Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
          Animated.spring(translateY, { toValue: 0, useNativeDriver: true }).start();
          return;
        }

        if (absDx > absDy) {
          if (dx < -SWIPE_THRESHOLD) {
            handleSwipeLeft();
          } else if (dx > SWIPE_THRESHOLD) {
            handleSwipeRight();
          }
        } else {
          if (dy < -SWIPE_THRESHOLD) {
            handleSwipeUp();
          }
        }

        Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true }).start();
      },
    })
  ).current;

  useEffect(() => {
    translateX.setValue(0);
    translateY.setValue(0);
  }, [currentIndex, translateX, translateY]);

  const frontInterpolate = flipAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  const backInterpolate = flipAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['180deg', '360deg'],
  });

  if (!currentCard) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Text style={[styles.emptyText, { color: theme.text }]}>No cards available</Text>
      </View>
    );
  }

  const progress = ((currentIndex + 1) / flashcards.length) * 100;

  return (
    <View style={styles.container}>
      <View style={styles.progressContainer}>
        <Text style={styles.progressText}>
          {currentIndex + 1} / {flashcards.length}
        </Text>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${progress}%` }]} />
        </View>
      </View>

      <View style={styles.statusIndicators}>
        <View style={[styles.statusBadge, cardState.isRevealed && styles.statusBadgeActive]}>
          <CheckCircle 
            size={14} 
            color={cardState.isRevealed ? '#fff' : 'rgba(255,255,255,0.5)'} 
          />
          <Text style={[styles.statusText, cardState.isRevealed && styles.statusTextActive]}>
            Revealed
          </Text>
        </View>
        <View style={[styles.statusBadge, cardState.resolved && styles.statusBadgeActive]}>
          {cardState.resolved ? (
            <CheckCircle size={14} color="#fff" />
          ) : (
            <Lock size={14} color="rgba(255,255,255,0.5)" />
          )}
          <Text style={[styles.statusText, cardState.resolved && styles.statusTextActive]}>
            Resolved
          </Text>
        </View>
      </View>

      <View style={styles.cardContainer} {...panResponder.panHandlers}>
        <Animated.View
          style={[
            styles.cardWrapper,
            {
              transform: [
                { translateX: Animated.add(translateX, shakeAnim) },
                { translateY },
                { scale: cardScale },
              ],
            },
          ]}
        >
          <Animated.View
            style={[
              styles.card,
              { backgroundColor: isDark ? theme.card : '#fff' },
              { transform: [{ rotateY: frontInterpolate }] },
              styles.cardFront,
            ]}
          >
            <View style={styles.cardLabelContainer}>
              <Text style={[styles.cardLabel, { color: theme.primary || '#667eea' }]}>QUESTION</Text>
              {cardState.hintLevel > 0 && (
                <View style={styles.hintBadge}>
                  <Lightbulb size={12} color="#FFD700" />
                  <Text style={styles.hintBadgeText}>Hint {cardState.hintLevel}</Text>
                </View>
              )}
            </View>
            <Text style={[styles.cardText, { color: isDark ? theme.text : '#333' }]}>
              {currentCard.question}
            </Text>
            <Text style={[styles.cardHint, { color: isDark ? theme.textSecondary : '#999' }]}>
              Double-tap to reveal answer
            </Text>
          </Animated.View>

          <Animated.View
            style={[
              styles.card,
              { backgroundColor: isDark ? theme.card : '#fff' },
              { transform: [{ rotateY: backInterpolate }] },
              styles.cardBack,
            ]}
          >
            <Text style={[styles.cardLabel, { color: '#4CAF50' }]}>ANSWER</Text>
            <Text style={[styles.cardText, { color: isDark ? theme.text : '#333' }]}>
              {currentCard.answer}
            </Text>
            <Text style={[styles.cardHint, { color: isDark ? theme.textSecondary : '#999' }]}>
              Swipe right to see explanation
            </Text>
          </Animated.View>
        </Animated.View>
      </View>

      <View style={styles.gestureGuide}>
        <View style={styles.gestureItem}>
          <View style={[styles.gestureArrow, styles.arrowLeft]} />
          <Text style={styles.gestureText}>Hint</Text>
        </View>
        <View style={styles.gestureItem}>
          <View style={[styles.gestureArrow, styles.arrowUp]} />
          <Text style={styles.gestureText}>Next</Text>
        </View>
        <View style={styles.gestureItem}>
          <View style={[styles.gestureArrow, styles.arrowRight]} />
          <Text style={styles.gestureText}>Explain</Text>
        </View>
      </View>

      {showHintOverlay && (
        <Animated.View
          style={[
            styles.overlay,
            styles.hintOverlay,
            { transform: [{ translateX: hintSlideAnim }] },
          ]}
        >
          <View style={styles.overlayContent}>
            <View style={styles.overlayHeader}>
              <Lightbulb size={28} color="#FFD700" />
              <Text style={styles.overlayTitle}>Hint {cardState.hintLevel}</Text>
            </View>
            <Text style={styles.overlayText}>{currentHintText}</Text>
          </View>
        </Animated.View>
      )}

      {showFeedbackOverlay && (
        <Animated.View
          style={[
            styles.overlay,
            styles.feedbackOverlay,
            { transform: [{ translateX: feedbackSlideAnim }] },
          ]}
        >
          <View style={styles.overlayContent}>
            <View style={styles.overlayHeader}>
              <BookOpen size={28} color="#4CAF50" />
              <Text style={styles.overlayTitle}>Explanation</Text>
            </View>
            <Text style={styles.overlayText}>
              {currentCard.explanation || 'No additional explanation available for this card.'}
            </Text>
            <View style={styles.swipeUpPrompt}>
              <ChevronUp size={24} color="rgba(255,255,255,0.7)" />
              <Text style={styles.swipeUpText}>Swipe up for next card</Text>
            </View>
          </View>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  progressContainer: {
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  progressText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#fff',
    marginBottom: 8,
    textAlign: 'center',
  },
  progressBar: {
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#fff',
    borderRadius: 3,
  },
  statusIndicators: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 20,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  statusBadgeActive: {
    backgroundColor: 'rgba(76, 175, 80, 0.8)',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: 'rgba(255,255,255,0.5)',
  },
  statusTextActive: {
    color: '#fff',
  },
  cardContainer: {
    flex: 1,
    paddingHorizontal: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardWrapper: {
    width: '100%',
    height: 420,
    maxWidth: 400,
  },
  card: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: 28,
    padding: 32,
    justifyContent: 'center',
    alignItems: 'center',
    backfaceVisibility: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 16,
  },
  cardFront: {
    zIndex: 1,
  },
  cardBack: {
    zIndex: 0,
  },
  cardLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 24,
  },
  cardLabel: {
    fontSize: 13,
    fontWeight: '700' as const,
    letterSpacing: 2,
  },
  hintBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 215, 0, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  hintBadgeText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: '#FFD700',
  },
  cardText: {
    fontSize: 24,
    fontWeight: '700' as const,
    textAlign: 'center',
    lineHeight: 34,
    marginBottom: 24,
  },
  cardHint: {
    fontSize: 14,
    fontWeight: '500' as const,
    textAlign: 'center',
  },
  gestureGuide: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 40,
    paddingVertical: 20,
  },
  gestureItem: {
    alignItems: 'center',
    gap: 6,
  },
  gestureArrow: {
    width: 24,
    height: 24,
    borderColor: 'rgba(255,255,255,0.4)',
    borderWidth: 2,
  },
  arrowLeft: {
    borderTopWidth: 0,
    borderRightWidth: 0,
    transform: [{ rotate: '45deg' }],
  },
  arrowUp: {
    borderBottomWidth: 0,
    borderRightWidth: 0,
    transform: [{ rotate: '45deg' }],
  },
  arrowRight: {
    borderBottomWidth: 0,
    borderLeftWidth: 0,
    transform: [{ rotate: '45deg' }],
  },
  gestureText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: 'rgba(255,255,255,0.6)',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  hintOverlay: {
    backgroundColor: 'rgba(255, 193, 7, 0.95)',
  },
  feedbackOverlay: {
    backgroundColor: 'rgba(56, 142, 60, 0.95)',
  },
  overlayContent: {
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
  },
  overlayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 24,
  },
  overlayTitle: {
    fontSize: 24,
    fontWeight: '800' as const,
    color: '#fff',
  },
  overlayText: {
    fontSize: 18,
    fontWeight: '500' as const,
    color: '#fff',
    textAlign: 'center',
    lineHeight: 28,
  },
  swipeUpPrompt: {
    alignItems: 'center',
    marginTop: 40,
    opacity: 0.8,
  },
  swipeUpText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600' as const,
    textAlign: 'center',
  },
});
