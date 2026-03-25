import React, { useState, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
  Platform,
  Pressable,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Lightbulb, BookOpen, Lock, CheckCircle, Sparkles } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

import { generateText } from '@rork-ai/toolkit-sdk';

import ConfidenceChips from '@/components/ConfidenceChips';
import { Theme } from '@/constants/colors';
import { usePerformance } from '@/context/PerformanceContext';
import type { Flashcard } from '@/types/flashcard';
import type { RecallQuality } from '@/types/performance';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const SWIPE_THRESHOLD = 60;
const BLOCKED_SHAKE_COOLDOWN = 300;

interface StudyFeedProps {
  flashcards: Flashcard[];
  theme: Theme;
  isDark: boolean;
  onComplete: () => void;
  onCardResolved?: (cardId: string) => void;
  onUpdateCard?: (cardId: string, updates: Partial<Flashcard>) => void;
}

export default function StudyFeed({
  flashcards,
  theme,
  isDark,
  onComplete,
  onCardResolved,
  onUpdateCard,
}: StudyFeedProps) {
  const { logQuestAttempt } = usePerformance();
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [isRevealed, setIsRevealed] = useState<boolean>(false);
  const [hintShown, setHintShown] = useState<boolean>(false);
  const [resolved, setResolved] = useState<boolean>(false);
  const [showHintOverlay, setShowHintOverlay] = useState<boolean>(false);
  const [showFeedbackOverlay, setShowFeedbackOverlay] = useState<boolean>(false);
  const [isGeneratingHint, setIsGeneratingHint] = useState<boolean>(false);
  const [isGeneratingExplanation, setIsGeneratingExplanation] = useState<boolean>(false);
  const [selectedQuality, setSelectedQuality] = useState<RecallQuality | null>(null);
  const [reviewSaved, setReviewSaved] = useState<boolean>(false);

  const flipAnim = useRef(new Animated.Value(0)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const hintOpacity = useRef(new Animated.Value(0)).current;
  const feedbackOpacity = useRef(new Animated.Value(0)).current;
  const cardScale = useRef(new Animated.Value(1)).current;
  const cardTranslateY = useRef(new Animated.Value(0)).current;
  const hintDismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cardStartedAtRef = useRef<number>(Date.now());

  const gestureStartRef = useRef<{ x: number; y: number } | null>(null);
  const isProcessingRef = useRef(false);
  const lastBlockedShakeRef = useRef<number>(0);

  const currentCard = flashcards[currentIndex];

  const triggerHaptic = useCallback(() => {
    if (Platform.OS !== 'web') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, []);

  const triggerShakeWithCooldown = useCallback(() => {
    const now = Date.now();
    if (now - lastBlockedShakeRef.current < BLOCKED_SHAKE_COOLDOWN) {
      return;
    }
    lastBlockedShakeRef.current = now;
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
    setIsGeneratingHint(false);
    setIsGeneratingExplanation(false);
    setSelectedQuality(null);
    setReviewSaved(false);
    cardStartedAtRef.current = Date.now();
    flipAnim.setValue(0);
    hintOpacity.setValue(0);
    feedbackOpacity.setValue(0);
    cardTranslateY.setValue(0);
    if (hintDismissTimer.current) {
      clearTimeout(hintDismissTimer.current);
      hintDismissTimer.current = null;
    }
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
      const nextIsRevealed = !isRevealed;
      setIsRevealed(nextIsRevealed);

      if (nextIsRevealed && !resolved && currentCard) {
        setResolved(true);
        setSelectedQuality(3);
        setReviewSaved(false);
        onCardResolved?.(currentCard.id);
      }

      isProcessingRef.current = false;
    });
  }, [isRevealed, resolved, currentCard, flipAnim, cardScale, onCardResolved, triggerHaptic]);

  const dismissHintOverlay = useCallback(() => {
    if (hintDismissTimer.current) {
      clearTimeout(hintDismissTimer.current);
      hintDismissTimer.current = null;
    }
    Animated.timing(hintOpacity, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setShowHintOverlay(false);
    });
  }, [hintOpacity]);

  const handleShowHint = useCallback(() => {
    if (isProcessingRef.current) return;
    
    if (isRevealed || resolved) {
      triggerShakeWithCooldown();
      return;
    }
    
    if (showHintOverlay) return;
    if (hintShown && currentCard?.hint1) return;

    isProcessingRef.current = true;
    triggerHaptic();
    setShowHintOverlay(true);

    if (currentCard?.hint1) {
      setHintShown(true);
    }

    Animated.timing(hintOpacity, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      isProcessingRef.current = false;
    });

    if (currentCard?.hint1) {
      hintDismissTimer.current = setTimeout(() => {
        dismissHintOverlay();
      }, 2500);
    }
  }, [isRevealed, resolved, hintShown, showHintOverlay, currentCard, hintOpacity, triggerHaptic, triggerShakeWithCooldown, dismissHintOverlay]);

  const handleShowFeedback = useCallback(() => {
    if (isProcessingRef.current) return;
    
    if (!isRevealed) {
      triggerShakeWithCooldown();
      return;
    }
    
    if (showFeedbackOverlay) return;
    
    isProcessingRef.current = true;
    triggerHaptic();
    setShowFeedbackOverlay(true);

    Animated.timing(feedbackOpacity, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      isProcessingRef.current = false;
    });
  }, [isRevealed, showFeedbackOverlay, feedbackOpacity, triggerHaptic, triggerShakeWithCooldown]);

  const commitCurrentCardReview = useCallback(() => {
    if (!currentCard || !resolved || reviewSaved) {
      return;
    }

    const quality = selectedQuality ?? 3;
    logQuestAttempt({
      deckId: currentCard.deckId,
      cardId: currentCard.id,
      isCorrect: quality !== 1,
      selectedOption: quality === 1 ? 'study-forgot' : 'study-self-rated',
      correctAnswer: currentCard.answer,
      timeToAnswerMs: Math.max(0, Date.now() - cardStartedAtRef.current),
      quality,
      mode: 'study',
      hintsUsed: hintShown ? 1 : 0,
      explanationOpened: showFeedbackOverlay,
    });
    setReviewSaved(true);
  }, [currentCard, resolved, reviewSaved, selectedQuality, logQuestAttempt, hintShown, showFeedbackOverlay]);

  const handleNextCard = useCallback(() => {
    if (!resolved) {
      triggerShakeWithCooldown();
      return;
    }

    if (isProcessingRef.current) {
      return;
    }

    commitCurrentCardReview();
    isProcessingRef.current = true;
    triggerHaptic();

    Animated.timing(cardTranslateY, {
      toValue: -SCREEN_HEIGHT,
      duration: 250,
      useNativeDriver: false,
    }).start(() => {
      // Reset position synchronously on JS thread before state update
      // to prevent blank frame when new card renders
      cardTranslateY.setValue(0);
      if (currentIndex + 1 >= flashcards.length) {
        onComplete();
      } else {
        setCurrentIndex(prev => prev + 1);
        resetForNextCard();
      }
      isProcessingRef.current = false;
    });
  }, [resolved, commitCurrentCardReview, cardTranslateY, currentIndex, flashcards.length, onComplete, resetForNextCard, triggerHaptic, triggerShakeWithCooldown]);

  const dismissFeedbackOverlay = useCallback(() => {
    if (isProcessingRef.current) return;
    Animated.timing(feedbackOpacity, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setShowFeedbackOverlay(false);
    });
  }, [feedbackOpacity]);

  const handleGenerateHint = useCallback(async () => {
    if (!currentCard || isGeneratingHint) return;

    setIsGeneratingHint(true);
    try {
      const hint = await generateText({
        messages: [{
          role: 'user' as const,
          content: `Generate a concise, helpful hint for this flashcard question. Guide the student toward the answer without revealing it directly. Keep it to 1-2 sentences.\n\nQuestion: ${currentCard.question}\nAnswer: ${currentCard.answer}`
        }]
      });
      if (!hint || hint.trim().length === 0) {
        Alert.alert('Generation Failed', 'Could not generate a hint. Please try again.');
        return;
      }

      onUpdateCard?.(currentCard.id, { hint1: hint.trim() });
      setHintShown(true);
      hintDismissTimer.current = setTimeout(() => {
        dismissHintOverlay();
      }, 3500);
    } catch {
      Alert.alert('Generation Failed', 'Could not generate a hint. Please try again.');
    } finally {
      setIsGeneratingHint(false);
    }
  }, [currentCard, isGeneratingHint, onUpdateCard, dismissHintOverlay]);

  const handleGenerateExplanation = useCallback(async () => {
    if (!currentCard || isGeneratingExplanation) return;

    setIsGeneratingExplanation(true);
    try {
      const explanation = await generateText({
        messages: [{
          role: 'user' as const,
          content: `Generate a clear, educational explanation for this flashcard. Help the student deeply understand why this answer is correct. Keep it to 2-3 sentences.\n\nQuestion: ${currentCard.question}\nAnswer: ${currentCard.answer}`
        }]
      });
      if (!explanation || explanation.trim().length === 0) {
        Alert.alert('Generation Failed', 'Could not generate an explanation. Please try again.');
        return;
      }

      onUpdateCard?.(currentCard.id, { explanation: explanation.trim() });
    } catch {
      Alert.alert('Generation Failed', 'Could not generate an explanation. Please try again.');
    } finally {
      setIsGeneratingExplanation(false);
    }
  }, [currentCard, isGeneratingExplanation, onUpdateCard]);

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

    // Check for tap (minimal movement) — single tap reveals
    if (absDx < 10 && absDy < 10) {
      handleDoubleTap();
      return;
    }

    // Check for swipe
    if (absDx < SWIPE_THRESHOLD && absDy < SWIPE_THRESHOLD) return;

    if (showFeedbackOverlay) {
      return;
    }

    if (absDx > absDy) {
      // Horizontal swipe — left = hint, right = explain
      if (dx > SWIPE_THRESHOLD) {
        handleShowFeedback();
      } else if (dx < -SWIPE_THRESHOLD) {
        handleShowHint();
      }
    } else {
      // Vertical swipe
      if (dy < -SWIPE_THRESHOLD) {
        handleNextCard();
      }
    }
  }, [showFeedbackOverlay, handleDoubleTap, handleShowHint, handleShowFeedback, handleNextCard]);

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
              Tap to reveal answer
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
              Swipe up for the next card or right for explanation
            </Text>
          </Animated.View>
        </Animated.View>
      </Pressable>

      {isRevealed ? (
        <View style={styles.confidenceWrap}>
          <ConfidenceChips
            selectedQuality={selectedQuality ?? 3}
            onSelect={setSelectedQuality}
            allowForgot
            prompt="How did that feel?"
            testIDPrefix="study-review"
          />
        </View>
      ) : null}

      <View style={styles.gestureGuide}>
        <TouchableOpacity style={styles.gestureItem} onPress={handleShowHint} activeOpacity={0.6}>
          <View style={[styles.gestureArrow, styles.arrowLeft]} />
          <Text style={styles.gestureText}>Hint</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.gestureItem} onPress={handleNextCard} activeOpacity={0.6}>
          <View style={[styles.gestureArrow, styles.arrowUp]} />
          <Text style={styles.gestureText}>Next Card</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.gestureItem} onPress={handleShowFeedback} activeOpacity={0.6}>
          <View style={[styles.gestureArrow, styles.arrowRight]} />
          <Text style={styles.gestureText}>Explain</Text>
        </TouchableOpacity>
      </View>

      {showHintOverlay && (
        <Animated.View
          style={[
            styles.overlay,
            styles.hintOverlay,
            { opacity: hintOpacity },
          ]}
        >
          <Pressable style={styles.hintPressable} onPress={dismissHintOverlay}>
            <View style={styles.overlayContent}>
              <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: '#FFD700', marginBottom: 16 }} />
              <View style={styles.overlayHeader}>
                <Lightbulb size={28} color="#FFD700" />
                <Text style={styles.overlayTitle}>Hint</Text>
              </View>
              {currentCard?.hint1 ? (
                <Text style={styles.overlayText}>{currentCard.hint1}</Text>
              ) : (
                <>
                  <Text style={styles.overlayText}>No hint available for this card.</Text>
                  <TouchableOpacity
                    style={styles.generateButton}
                    onPress={handleGenerateHint}
                    disabled={isGeneratingHint}
                    activeOpacity={0.8}
                  >
                    {isGeneratingHint ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Sparkles size={18} color="#fff" />
                    )}
                    <Text style={styles.generateButtonText}>
                      {isGeneratingHint ? 'Generating...' : 'Generate AI Hint'}
                    </Text>
                  </TouchableOpacity>
                </>
              )}
              <Text style={styles.tapHintText}>tap anywhere to dismiss</Text>
            </View>
          </Pressable>
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
            onPress={dismissFeedbackOverlay}
          >
            <View style={styles.overlayContent}>
              <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: '#4CAF50', marginBottom: 16 }} />
              <View style={styles.overlayHeader}>
                <BookOpen size={28} color="#4CAF50" />
                <Text style={styles.overlayTitle}>Explanation</Text>
              </View>
              {currentCard?.explanation ? (
                <Text style={styles.overlayText}>{currentCard.explanation}</Text>
              ) : isGeneratingExplanation ? (
                <View style={styles.generatingContainer}>
                  <ActivityIndicator size="large" color="#fff" />
                  <Text style={styles.generatingText}>Generating explanation...</Text>
                </View>
              ) : (
                <>
                  <Text style={styles.overlayText}>No explanation available for this card.</Text>
                  <TouchableOpacity
                    style={[styles.generateButton, styles.generateButtonGreen]}
                    onPress={handleGenerateExplanation}
                    disabled={isGeneratingExplanation}
                    activeOpacity={0.8}
                  >
                    <Sparkles size={18} color="#fff" />
                    <Text style={styles.generateButtonText}>Generate AI Explanation</Text>
                  </TouchableOpacity>
                </>
              )}
              <TouchableOpacity 
                style={styles.continueButton}
                onPress={dismissFeedbackOverlay}
                activeOpacity={0.8}
              >
                <Text style={styles.continueButtonText}>Continue</Text>
              </TouchableOpacity>
              <Text style={styles.tapHintText}>or tap anywhere to dismiss</Text>
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
  confidenceWrap: {
    paddingHorizontal: 24,
    marginTop: 8,
    marginBottom: 6,
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
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
  },
  feedbackOverlay: {
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
  },
  feedbackPressable: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlayContent: {
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 24,
    padding: 28,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
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
  continueButton: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 32,
  },
  continueButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#fff',
  },
  hintPressable: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  generateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 16,
    marginTop: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  generateButtonGreen: {
    backgroundColor: 'rgba(76, 175, 80, 0.2)',
    borderColor: 'rgba(76, 175, 80, 0.3)',
  },
  generateButtonText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#fff',
  },
  generatingContainer: {
    alignItems: 'center',
    gap: 16,
    paddingVertical: 12,
  },
  generatingText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  tapHintText: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 12,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600' as const,
    textAlign: 'center',
  },
});
