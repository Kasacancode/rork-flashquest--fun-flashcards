import React, { useState, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
  Platform,
  Pressable,
} from 'react-native';
import { Lightbulb, BookOpen, ChevronUp, Lock, CheckCircle } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

import { Flashcard } from '@/types/flashcard';
import { Theme } from '@/constants/colors';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const SWIPE_THRESHOLD = 60;
const DOUBLE_TAP_DELAY = 300;

interface StudyFeedProps {
  flashcards: Flashcard[];
  theme: Theme;
  isDark: boolean;
  onComplete: () => void;
  onCardResolved?: (cardId: string, correct: boolean) => void;
}

export default function StudyFeed({
  flashcards,
  theme,
  isDark,
  onComplete,
  onCardResolved,
}: StudyFeedProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isRevealed, setIsRevealed] = useState(false);
  const [hintShown, setHintShown] = useState(false);
  
  const [resolved, setResolved] = useState(false);
  const [showHintOverlay, setShowHintOverlay] = useState(false);
  const [showFeedbackOverlay, setShowFeedbackOverlay] = useState(false);

  const flipAnim = useRef(new Animated.Value(0)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const hintOpacity = useRef(new Animated.Value(0)).current;
  const feedbackOpacity = useRef(new Animated.Value(0)).current;
  const cardScale = useRef(new Animated.Value(1)).current;
  const cardTranslateY = useRef(new Animated.Value(0)).current;

  const lastTapRef = useRef<number>(0);
  const gestureStartRef = useRef<{ x: number; y: number } | null>(null);
  const isProcessingRef = useRef(false);

  const currentCard = flashcards[currentIndex];

  const triggerHaptic = useCallback(() => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, []);

  const triggerShake = useCallback(() => {
    triggerHaptic();
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 12, duration: 40, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -12, duration: 40, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 8, duration: 40, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 40, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 40, useNativeDriver: true }),
    ]).start();
  }, [shakeAnim, triggerHaptic]);

  const resetForNextCard = useCallback(() => {
    setIsRevealed(false);
    setHintShown(false);
    
    setResolved(false);
    setShowHintOverlay(false);
    setShowFeedbackOverlay(false);
    flipAnim.setValue(0);
    hintOpacity.setValue(0);
    feedbackOpacity.setValue(0);
    cardTranslateY.setValue(0);
  }, [flipAnim, hintOpacity, feedbackOpacity, cardTranslateY]);

  const handleDoubleTap = useCallback(() => {
    if (isProcessingRef.current) return;
    isProcessingRef.current = true;
    triggerHaptic();

    Animated.sequence([
      Animated.timing(cardScale, { toValue: 0.96, duration: 80, useNativeDriver: true }),
      Animated.timing(cardScale, { toValue: 1, duration: 80, useNativeDriver: true }),
    ]).start();

    const targetValue = isRevealed ? 0 : 1;
    Animated.timing(flipAnim, {
      toValue: targetValue,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      setIsRevealed(!isRevealed);
      isProcessingRef.current = false;
    });
  }, [isRevealed, flipAnim, cardScale, triggerHaptic]);

  const handleShowHint = useCallback(() => {
    if (isRevealed || hintShown || isProcessingRef.current) return;
    
    const hint = currentCard?.hint1;
    if (!hint) return;

    isProcessingRef.current = true;
    triggerHaptic();
    setHintShown(true);
    setShowHintOverlay(true);

    Animated.timing(hintOpacity, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      isProcessingRef.current = false;
    });

    setTimeout(() => {
      Animated.timing(hintOpacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        setShowHintOverlay(false);
      });
    }, 2500);
  }, [isRevealed, hintShown, currentCard, hintOpacity, triggerHaptic]);

  const handleShowFeedback = useCallback(() => {
    if (!isRevealed || isProcessingRef.current) return;
    
    isProcessingRef.current = true;
    triggerHaptic();
    setShowFeedbackOverlay(true);
    
    setResolved(true);

    Animated.timing(feedbackOpacity, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      isProcessingRef.current = false;
      if (currentCard) {
        onCardResolved?.(currentCard.id, true);
      }
    });
  }, [isRevealed, currentCard, feedbackOpacity, onCardResolved, triggerHaptic]);

  const handleNextCard = useCallback(() => {
    if (!resolved) {
      triggerShake();
      return;
    }

    if (isProcessingRef.current) return;
    isProcessingRef.current = true;
    triggerHaptic();

    Animated.timing(cardTranslateY, {
      toValue: -SCREEN_HEIGHT,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      if (currentIndex + 1 >= flashcards.length) {
        onComplete();
      } else {
        setCurrentIndex(prev => prev + 1);
        resetForNextCard();
      }
      isProcessingRef.current = false;
    });
  }, [resolved, currentIndex, flashcards.length, cardTranslateY, resetForNextCard, onComplete, triggerShake, triggerHaptic]);

  const closeFeedback = useCallback(() => {
    Animated.timing(feedbackOpacity, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setShowFeedbackOverlay(false);
    });
  }, [feedbackOpacity]);

  const handleTouchStart = useCallback((e: any) => {
    const touch = e.nativeEvent;
    gestureStartRef.current = { x: touch.pageX, y: touch.pageY };
  }, []);

  const handleTouchEnd = useCallback((e: any) => {
    if (!gestureStartRef.current) return;

    const touch = e.nativeEvent;
    const dx = touch.pageX - gestureStartRef.current.x;
    const dy = touch.pageY - gestureStartRef.current.y;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    gestureStartRef.current = null;

    // Check for tap (minimal movement)
    if (absDx < 10 && absDy < 10) {
      const now = Date.now();
      if (now - lastTapRef.current < DOUBLE_TAP_DELAY) {
        lastTapRef.current = 0;
        handleDoubleTap();
      } else {
        lastTapRef.current = now;
      }
      return;
    }

    // Check for swipe
    if (absDx < SWIPE_THRESHOLD && absDy < SWIPE_THRESHOLD) return;

    if (showFeedbackOverlay) {
      // In feedback view: swipe up to go next, swipe left to close
      if (absDy > absDx && dy < -SWIPE_THRESHOLD) {
        handleNextCard();
      } else if (absDx > absDy && dx > SWIPE_THRESHOLD) {
        closeFeedback();
      }
      return;
    }

    if (absDx > absDy) {
      // Horizontal swipe
      if (dx > SWIPE_THRESHOLD) {
        handleShowHint();
      } else if (dx < -SWIPE_THRESHOLD) {
        handleShowFeedback();
      }
    } else {
      // Vertical swipe
      if (dy < -SWIPE_THRESHOLD) {
        handleNextCard();
      }
    }
  }, [showFeedbackOverlay, handleDoubleTap, handleShowHint, handleShowFeedback, handleNextCard, closeFeedback]);

  const frontInterpolate = flipAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  const backInterpolate = flipAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['180deg', '360deg'],
  });

  const progress = useMemo(() => ((currentIndex + 1) / flashcards.length) * 100, [currentIndex, flashcards.length]);

  if (!currentCard) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Text style={[styles.emptyText, { color: theme.text }]}>No cards available</Text>
      </View>
    );
  }

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
        <View style={[styles.statusBadge, isRevealed && styles.statusBadgeActive]}>
          <CheckCircle 
            size={14} 
            color={isRevealed ? '#fff' : 'rgba(255,255,255,0.5)'} 
          />
          <Text style={[styles.statusText, isRevealed && styles.statusTextActive]}>
            Revealed
          </Text>
        </View>
        <View style={[styles.statusBadge, resolved && styles.statusBadgeActive]}>
          {resolved ? (
            <CheckCircle size={14} color="#fff" />
          ) : (
            <Lock size={14} color="rgba(255,255,255,0.5)" />
          )}
          <Text style={[styles.statusText, resolved && styles.statusTextActive]}>
            Resolved
          </Text>
        </View>
      </View>

      <Pressable 
        style={styles.cardContainer}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <Animated.View
          style={[
            styles.cardWrapper,
            {
              transform: [
                { translateX: shakeAnim },
                { translateY: cardTranslateY },
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
              {hintShown && (
                <View style={styles.hintBadge}>
                  <Lightbulb size={12} color="#FFD700" />
                  <Text style={styles.hintBadgeText}>Hint used</Text>
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
              Swipe left to see explanation
            </Text>
          </Animated.View>
        </Animated.View>
      </Pressable>

      <View style={styles.gestureGuide}>
        <View style={styles.gestureItem}>
          <View style={[styles.gestureArrow, styles.arrowLeft]} />
          <Text style={styles.gestureText}>Explain</Text>
        </View>
        <View style={styles.gestureItem}>
          <View style={[styles.gestureArrow, styles.arrowUp]} />
          <Text style={styles.gestureText}>Next</Text>
        </View>
        <View style={styles.gestureItem}>
          <View style={[styles.gestureArrow, styles.arrowRight]} />
          <Text style={styles.gestureText}>Hint</Text>
        </View>
      </View>

      {showHintOverlay && (
        <Animated.View
          style={[
            styles.overlay,
            styles.hintOverlay,
            { opacity: hintOpacity },
          ]}
          pointerEvents="none"
        >
          <View style={styles.overlayContent}>
            <View style={styles.overlayHeader}>
              <Lightbulb size={28} color="#FFD700" />
              <Text style={styles.overlayTitle}>Hint</Text>
            </View>
            <Text style={styles.overlayText}>
              {currentCard.hint1 || 'No hint available'}
            </Text>
          </View>
        </Animated.View>
      )}

      {showFeedbackOverlay && (
        <Animated.View
          style={[
            styles.overlay,
            styles.feedbackOverlay,
            { opacity: feedbackOpacity },
          ]}
        >
          <Pressable 
            style={styles.feedbackPressable}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
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
          </Pressable>
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
  feedbackPressable: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
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
