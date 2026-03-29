import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
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
  PanResponder,
} from 'react-native';
import { Lightbulb, BookOpen, Lock, CheckCircle, Sparkles } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

import { generateText } from '@rork-ai/toolkit-sdk';

import ConfidenceChips from '@/components/ConfidenceChips';
import FlashcardDebugButton from '@/components/debug/FlashcardDebugButton';
import ConsentSheet from '@/components/privacy/ConsentSheet';
import type { Theme } from '@/constants/colors';
import { usePerformance } from '@/context/PerformanceContext';
import { usePrivacy } from '@/context/PrivacyContext';
import type { Flashcard } from '@/types/flashcard';
import type { RecallQuality } from '@/types/performance';
import { getCanonicalAnswer, getCanonicalQuestion, getCardAnswerForSurface, getCardQuestionForSurface } from '@/utils/flashcardContent';
import { DATA_PRIVACY_ROUTE } from '@/utils/routes';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const SWIPE_THRESHOLD = 60;
const SWIPE_AXIS_DOMINANCE_RATIO = 1.15;
const TAP_CANCEL_DISTANCE = 10;
const BLOCKED_SHAKE_COOLDOWN = 300;
const CARD_SWAP_OUT_DURATION = 80;
const CARD_SWAP_IN_DURATION = 110;
const CARD_SWAP_MIN_OPACITY = 0.78;
const CARD_ENTER_OFFSET = 24;
const CARD_ENTER_START_OPACITY = 0.58;
const CARD_EXIT_DISTANCE = Math.min(SCREEN_HEIGHT * 0.16, 120);
const CARD_EXIT_MIN_OPACITY = 0.24;
const ANIMATION_USE_NATIVE_DRIVER = Platform.OS !== 'web';

interface StudyFeedProps {
  flashcards: Flashcard[];
  theme: Theme;
  isDark: boolean;
  onComplete: () => void;
  onCardResolved?: (cardId: string) => void;
  onUpdateCard?: (cardId: string, updates: Partial<Flashcard>) => void;
}

type CardGestureIntent = 'tap' | 'hint' | 'explain' | 'next' | 'ignore';

export default function StudyFeed({
  flashcards,
  theme,
  isDark,
  onComplete,
  onCardResolved,
  onUpdateCard,
}: StudyFeedProps) {
  const router = useRouter();
  const { logQuestAttempt } = usePerformance();
  const { hasAcknowledgedAIDisclosure, acknowledgeAIDisclosure } = usePrivacy();
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [displayCard, setDisplayCard] = useState<Flashcard | null>(() => flashcards[0] ?? null);
  const [isRevealed, setIsRevealed] = useState<boolean>(false);
  const [hintShown, setHintShown] = useState<boolean>(false);
  const [resolved, setResolved] = useState<boolean>(false);
  const [showHintOverlay, setShowHintOverlay] = useState<boolean>(false);
  const [showFeedbackOverlay, setShowFeedbackOverlay] = useState<boolean>(false);
  const [isGeneratingHint, setIsGeneratingHint] = useState<boolean>(false);
  const [isGeneratingExplanation, setIsGeneratingExplanation] = useState<boolean>(false);
  const [pendingAiAction, setPendingAiAction] = useState<'hint' | 'explanation' | null>(null);
  const [selectedQuality, setSelectedQuality] = useState<RecallQuality | null>(null);
  const [reviewSaved, setReviewSaved] = useState<boolean>(false);

  const shakeAnim = useRef(new Animated.Value(0)).current;
  const hintOpacity = useRef(new Animated.Value(0)).current;
  const feedbackOpacity = useRef(new Animated.Value(0)).current;
  const cardScale = useRef(new Animated.Value(1)).current;
  const cardTranslateY = useRef(new Animated.Value(0)).current;
  const cardOpacity = useRef(new Animated.Value(1)).current;
  const hintDismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cardIntroTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cardStartedAtRef = useRef<number>(Date.now());
  const isProcessingRef = useRef<boolean>(false);
  const lastBlockedShakeRef = useRef<number>(0);

  const sourceCard = flashcards[currentIndex] ?? null;
  const currentCard = displayCard ?? sourceCard;
  const displayQuestion = currentCard ? getCardQuestionForSurface(currentCard, 'study') : '';
  const displayAnswer = currentCard ? getCardAnswerForSurface(currentCard, 'study') : '';

  const clearHintDismissTimer = useCallback(() => {
    if (hintDismissTimer.current) {
      clearTimeout(hintDismissTimer.current);
      hintDismissTimer.current = null;
    }
  }, []);

  const clearCardIntroTimer = useCallback(() => {
    if (cardIntroTimer.current) {
      clearTimeout(cardIntroTimer.current);
      cardIntroTimer.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      clearHintDismissTimer();
      clearCardIntroTimer();
    };
  }, [clearHintDismissTimer, clearCardIntroTimer]);

  useEffect(() => {
    isProcessingRef.current = false;
  }, [currentCard?.id]);

  useEffect(() => {
    setDisplayCard((previousCard) => {
      if (sourceCard == null) {
        return null;
      }

      if (previousCard == null) {
        return sourceCard;
      }

      if (previousCard.id !== sourceCard.id && isProcessingRef.current) {
        return previousCard;
      }

      return sourceCard;
    });
  }, [sourceCard]);

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
      Animated.timing(shakeAnim, { toValue: 12, duration: 40, useNativeDriver: ANIMATION_USE_NATIVE_DRIVER }),
      Animated.timing(shakeAnim, { toValue: -12, duration: 40, useNativeDriver: ANIMATION_USE_NATIVE_DRIVER }),
      Animated.timing(shakeAnim, { toValue: 8, duration: 40, useNativeDriver: ANIMATION_USE_NATIVE_DRIVER }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 40, useNativeDriver: ANIMATION_USE_NATIVE_DRIVER }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 40, useNativeDriver: ANIMATION_USE_NATIVE_DRIVER }),
    ]).start();
  }, [shakeAnim, triggerHaptic]);

  const resetAnimatedValues = useCallback((options?: { translateY?: number; opacity?: number; scale?: number }) => {
    shakeAnim.stopAnimation();
    hintOpacity.stopAnimation();
    feedbackOpacity.stopAnimation();
    cardScale.stopAnimation();
    cardTranslateY.stopAnimation();
    cardOpacity.stopAnimation();

    shakeAnim.setValue(0);
    hintOpacity.setValue(0);
    feedbackOpacity.setValue(0);
    cardScale.setValue(options?.scale ?? 1);
    cardTranslateY.setValue(options?.translateY ?? 0);
    cardOpacity.setValue(options?.opacity ?? 1);
  }, [shakeAnim, hintOpacity, feedbackOpacity, cardScale, cardTranslateY, cardOpacity]);

  const resetForNextCard = useCallback((options?: { translateY?: number; opacity?: number; scale?: number }) => {
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
    clearHintDismissTimer();
    resetAnimatedValues(options);
  }, [clearHintDismissTimer, resetAnimatedValues]);

  const animateCardSwap = useCallback((onMidpoint: () => void, onComplete?: () => void) => {
    Animated.parallel([
      Animated.timing(cardOpacity, {
        toValue: CARD_SWAP_MIN_OPACITY,
        duration: CARD_SWAP_OUT_DURATION,
        useNativeDriver: ANIMATION_USE_NATIVE_DRIVER,
      }),
      Animated.timing(cardScale, {
        toValue: 0.985,
        duration: CARD_SWAP_OUT_DURATION,
        useNativeDriver: ANIMATION_USE_NATIVE_DRIVER,
      }),
      Animated.timing(cardTranslateY, {
        toValue: -10,
        duration: CARD_SWAP_OUT_DURATION,
        useNativeDriver: ANIMATION_USE_NATIVE_DRIVER,
      }),
    ]).start(({ finished }) => {
      if (!finished) {
        resetAnimatedValues();
        isProcessingRef.current = false;
        return;
      }

      onMidpoint();

      Animated.parallel([
        Animated.timing(cardOpacity, {
          toValue: 1,
          duration: CARD_SWAP_IN_DURATION,
          useNativeDriver: ANIMATION_USE_NATIVE_DRIVER,
        }),
        Animated.timing(cardScale, {
          toValue: 1,
          duration: CARD_SWAP_IN_DURATION,
          useNativeDriver: ANIMATION_USE_NATIVE_DRIVER,
        }),
        Animated.timing(cardTranslateY, {
          toValue: 0,
          duration: CARD_SWAP_IN_DURATION,
          useNativeDriver: ANIMATION_USE_NATIVE_DRIVER,
        }),
      ]).start(({ finished: finishedIn }) => {
        if (!finishedIn) {
          resetAnimatedValues();
        }
        isProcessingRef.current = false;
        onComplete?.();
      });
    });
  }, [cardOpacity, cardScale, cardTranslateY, resetAnimatedValues]);

  const handleFlipCard = useCallback(() => {
    if (isProcessingRef.current || showHintOverlay || showFeedbackOverlay) {
      return;
    }

    isProcessingRef.current = true;
    triggerHaptic();

    const nextIsRevealed = !isRevealed;
    animateCardSwap(() => {
      setIsRevealed(nextIsRevealed);

      if (nextIsRevealed && !resolved && currentCard) {
        setResolved(true);
        setSelectedQuality(3);
        setReviewSaved(false);
        onCardResolved?.(currentCard.id);
      }
    });
  }, [isRevealed, resolved, currentCard, onCardResolved, showHintOverlay, showFeedbackOverlay, triggerHaptic, animateCardSwap]);

  const dismissHintOverlay = useCallback(() => {
    clearHintDismissTimer();
    Animated.timing(hintOpacity, {
      toValue: 0,
      duration: 300,
      useNativeDriver: ANIMATION_USE_NATIVE_DRIVER,
    }).start(() => {
      setShowHintOverlay(false);
    });
  }, [clearHintDismissTimer, hintOpacity]);

  const handleShowHint = useCallback(() => {
    if (isProcessingRef.current) {
      return;
    }

    if (isRevealed || resolved) {
      triggerShakeWithCooldown();
      return;
    }

    if (showHintOverlay) {
      return;
    }

    if (hintShown && currentCard?.hint1) {
      return;
    }

    isProcessingRef.current = true;
    triggerHaptic();
    setShowHintOverlay(true);

    if (currentCard?.hint1) {
      setHintShown(true);
    }

    Animated.timing(hintOpacity, {
      toValue: 1,
      duration: 200,
      useNativeDriver: ANIMATION_USE_NATIVE_DRIVER,
    }).start(() => {
      isProcessingRef.current = false;
    });

    if (currentCard?.hint1) {
      clearHintDismissTimer();
      hintDismissTimer.current = setTimeout(() => {
        dismissHintOverlay();
      }, 2500);
    }
  }, [
    isRevealed,
    resolved,
    hintShown,
    showHintOverlay,
    currentCard,
    hintOpacity,
    triggerHaptic,
    triggerShakeWithCooldown,
    dismissHintOverlay,
    clearHintDismissTimer,
  ]);

  const handleShowFeedback = useCallback(() => {
    if (isProcessingRef.current) {
      return;
    }

    if (!isRevealed) {
      triggerShakeWithCooldown();
      return;
    }

    if (showFeedbackOverlay) {
      return;
    }

    isProcessingRef.current = true;
    triggerHaptic();
    setShowFeedbackOverlay(true);

    Animated.timing(feedbackOpacity, {
      toValue: 1,
      duration: 200,
      useNativeDriver: ANIMATION_USE_NATIVE_DRIVER,
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
      correctAnswer: getCanonicalAnswer(currentCard),
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
    clearCardIntroTimer();

    Animated.parallel([
      Animated.timing(cardTranslateY, {
        toValue: -CARD_EXIT_DISTANCE,
        duration: 150,
        useNativeDriver: ANIMATION_USE_NATIVE_DRIVER,
      }),
      Animated.timing(cardOpacity, {
        toValue: CARD_EXIT_MIN_OPACITY,
        duration: 140,
        useNativeDriver: ANIMATION_USE_NATIVE_DRIVER,
      }),
      Animated.timing(cardScale, {
        toValue: 0.985,
        duration: 150,
        useNativeDriver: ANIMATION_USE_NATIVE_DRIVER,
      }),
    ]).start(({ finished }) => {
      if (!finished) {
        resetAnimatedValues();
        isProcessingRef.current = false;
        return;
      }

      const nextIndex = currentIndex + 1;
      if (nextIndex >= flashcards.length) {
        resetAnimatedValues();
        isProcessingRef.current = false;
        onComplete();
        return;
      }

      const nextCard = flashcards[nextIndex] ?? null;
      if (!nextCard) {
        resetAnimatedValues();
        isProcessingRef.current = false;
        onComplete();
        return;
      }

      resetForNextCard({ translateY: CARD_ENTER_OFFSET, opacity: CARD_ENTER_START_OPACITY, scale: 0.99 });
      setDisplayCard(nextCard);
      setCurrentIndex(nextIndex);

      cardIntroTimer.current = setTimeout(() => {
        Animated.parallel([
          Animated.timing(cardTranslateY, {
            toValue: 0,
            duration: 160,
            useNativeDriver: ANIMATION_USE_NATIVE_DRIVER,
          }),
          Animated.timing(cardOpacity, {
            toValue: 1,
            duration: 150,
            useNativeDriver: ANIMATION_USE_NATIVE_DRIVER,
          }),
          Animated.timing(cardScale, {
            toValue: 1,
            duration: 160,
            useNativeDriver: ANIMATION_USE_NATIVE_DRIVER,
          }),
        ]).start(({ finished: finishedIn }) => {
          if (!finishedIn) {
            resetAnimatedValues();
          }
          isProcessingRef.current = false;
        });
      }, 0);
    });
  }, [
    resolved,
    commitCurrentCardReview,
    clearCardIntroTimer,
    cardTranslateY,
    cardOpacity,
    currentIndex,
    flashcards,
    onComplete,
    resetAnimatedValues,
    resetForNextCard,
    triggerHaptic,
    triggerShakeWithCooldown,
    cardScale,
  ]);

  const dismissFeedbackOverlay = useCallback(() => {
    if (isProcessingRef.current) {
      return;
    }

    Animated.timing(feedbackOpacity, {
      toValue: 0,
      duration: 200,
      useNativeDriver: ANIMATION_USE_NATIVE_DRIVER,
    }).start(() => {
      setShowFeedbackOverlay(false);
    });
  }, [feedbackOpacity]);

  const handleGenerateHint = useCallback(async () => {
    if (!currentCard || isGeneratingHint) {
      return;
    }

    setIsGeneratingHint(true);
    try {
      const hint = await generateText({
        messages: [{
          role: 'user' as const,
          content: `Generate a concise, helpful hint for this flashcard question. Guide the student toward the answer without revealing it directly. Keep it to 1-2 sentences.\n\nQuestion: ${getCanonicalQuestion(currentCard)}\nAnswer: ${getCanonicalAnswer(currentCard)}`,
        }],
      });

      if (!hint || hint.trim().length === 0) {
        Alert.alert('Generation Failed', 'Could not generate a hint. Please try again.');
        return;
      }

      onUpdateCard?.(currentCard.id, { hint1: hint.trim() });
      setHintShown(true);
      clearHintDismissTimer();
      hintDismissTimer.current = setTimeout(() => {
        dismissHintOverlay();
      }, 3500);
    } catch {
      Alert.alert('Generation Failed', 'Could not generate a hint. Please try again.');
    } finally {
      setIsGeneratingHint(false);
    }
  }, [currentCard, isGeneratingHint, onUpdateCard, dismissHintOverlay, clearHintDismissTimer]);

  const handleGenerateExplanation = useCallback(async () => {
    if (!currentCard || isGeneratingExplanation) {
      return;
    }

    setIsGeneratingExplanation(true);
    try {
      const explanation = await generateText({
        messages: [{
          role: 'user' as const,
          content: `Generate a clear, educational explanation for this flashcard. Help the student deeply understand why this answer is correct. Keep it to 2-3 sentences.\n\nQuestion: ${getCanonicalQuestion(currentCard)}\nAnswer: ${getCanonicalAnswer(currentCard)}`,
        }],
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

  const handlePressGenerateHint = useCallback(() => {
    if (!hasAcknowledgedAIDisclosure('studyAssist')) {
      setPendingAiAction('hint');
      return;
    }

    void handleGenerateHint();
  }, [handleGenerateHint, hasAcknowledgedAIDisclosure]);

  const handlePressGenerateExplanation = useCallback(() => {
    if (!hasAcknowledgedAIDisclosure('studyAssist')) {
      setPendingAiAction('explanation');
      return;
    }

    void handleGenerateExplanation();
  }, [handleGenerateExplanation, hasAcknowledgedAIDisclosure]);

  const handleAcceptStudyDisclosure = useCallback(() => {
    if (!pendingAiAction) {
      return;
    }

    const nextAction = pendingAiAction;
    setPendingAiAction(null);
    acknowledgeAIDisclosure('studyAssist');

    if (nextAction === 'hint') {
      void handleGenerateHint();
      return;
    }

    void handleGenerateExplanation();
  }, [acknowledgeAIDisclosure, handleGenerateExplanation, handleGenerateHint, pendingAiAction]);

  const handleDismissStudyDisclosure = useCallback(() => {
    setPendingAiAction(null);
  }, []);

  const resolveCardGestureIntent = useCallback((gestureState: { dx: number; dy: number }): CardGestureIntent => {
    const absDx = Math.abs(gestureState.dx);
    const absDy = Math.abs(gestureState.dy);

    if (absDx <= TAP_CANCEL_DISTANCE && absDy <= TAP_CANCEL_DISTANCE) {
      return 'tap';
    }

    if (absDx > absDy * SWIPE_AXIS_DOMINANCE_RATIO) {
      if (gestureState.dx >= SWIPE_THRESHOLD) {
        return 'explain';
      }

      if (gestureState.dx <= -SWIPE_THRESHOLD) {
        return 'hint';
      }
    }

    if (gestureState.dy <= -SWIPE_THRESHOLD && absDy > absDx * SWIPE_AXIS_DOMINANCE_RATIO) {
      return 'next';
    }

    return 'ignore';
  }, []);

  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onStartShouldSetPanResponderCapture: () => false,
    onMoveShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponderCapture: () => false,
    onPanResponderTerminationRequest: () => true,
    onPanResponderRelease: (_, gestureState) => {
      if (showHintOverlay || showFeedbackOverlay || isProcessingRef.current) {
        return;
      }

      const intent = resolveCardGestureIntent(gestureState);
      console.log('[StudyFeed] card gesture resolved', {
        intent,
        dx: gestureState.dx,
        dy: gestureState.dy,
        isRevealed,
        resolved,
      });

      if (intent === 'tap') {
        handleFlipCard();
        return;
      }

      if (intent === 'hint') {
        handleShowHint();
        return;
      }

      if (intent === 'explain') {
        handleShowFeedback();
        return;
      }

      if (intent === 'next') {
        handleNextCard();
      }
    },
  }), [handleFlipCard, handleNextCard, handleShowFeedback, handleShowHint, isRevealed, resolveCardGestureIntent, resolved, showFeedbackOverlay, showHintOverlay]);

  const progress = useMemo(() => {
    if (flashcards.length === 0) {
      return 0;
    }
    return ((currentIndex + 1) / flashcards.length) * 100;
  }, [currentIndex, flashcards.length]);

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
          <CheckCircle size={14} color={isRevealed ? '#fff' : 'rgba(255,255,255,0.5)'} />
          <Text style={[styles.statusText, isRevealed && styles.statusTextActive]}>Revealed</Text>
        </View>
        <View style={[styles.statusBadge, resolved && styles.statusBadgeActive]}>
          {resolved ? <CheckCircle size={14} color="#fff" /> : <Lock size={14} color="rgba(255,255,255,0.5)" />}
          <Text style={[styles.statusText, resolved && styles.statusTextActive]}>Resolved</Text>
        </View>
      </View>

      <View style={styles.cardContainer}>
        <Animated.View
          testID="study-card-surface"
          {...panResponder.panHandlers}
          style={[
            styles.cardWrapper,
            {
              opacity: cardOpacity,
              transform: [
                { translateX: shakeAnim },
                { translateY: cardTranslateY },
                { scale: cardScale },
              ],
            },
          ]}
        >
          <View style={[styles.card, { backgroundColor: isDark ? theme.card : '#fff' }]}>
            <View style={styles.cardLabelContainer}>
              <Text style={[styles.cardLabel, { color: isRevealed ? '#4CAF50' : theme.primary || '#667eea' }]}>
                {isRevealed ? 'ANSWER' : 'QUESTION'}
              </Text>
              <View style={styles.cardLabelActions}>
                {hintShown && !isRevealed ? (
                  <View style={styles.hintBadge}>
                    <Lightbulb size={12} color="#FFD700" />
                    <Text style={styles.hintBadgeText}>Hint used</Text>
                  </View>
                ) : null}
                <FlashcardDebugButton
                  deckId={currentCard?.deckId}
                  cardId={currentCard?.id}
                  surface="study"
                  label="Inspect"
                  testID="study-flashcard-debug-button"
                />
              </View>
            </View>
            <Text style={[styles.cardText, { color: isDark ? theme.text : '#333' }]}>
              {isRevealed ? displayAnswer : displayQuestion}
            </Text>
            <Text style={[styles.cardHint, { color: isDark ? theme.textSecondary : '#999' }]}>
              {isRevealed ? 'Swipe up for the next card or right for explanation' : 'Tap to reveal answer'}
            </Text>
          </View>
        </Animated.View>
      </View>

      {isRevealed ? (
        <View style={styles.confidenceWrap}>
          <ConfidenceChips
            selectedQuality={selectedQuality ?? 3}
            onSelect={setSelectedQuality}
            allowForgot
            prompt="How did that feel?"
            promptColor="#F8FAFC"
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

      {showHintOverlay ? (
        <Animated.View style={[styles.overlay, styles.hintOverlay, { opacity: hintOpacity }]}>
          <Pressable style={styles.hintPressable} onPress={dismissHintOverlay}>
            <View style={styles.overlayContent}>
              <View style={styles.overlayHandleYellow} />
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
                    onPress={handlePressGenerateHint}
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
      ) : null}

      {showFeedbackOverlay ? (
        <Animated.View style={[styles.overlay, styles.feedbackOverlay, { opacity: feedbackOpacity }]}>
          <Pressable style={styles.feedbackPressable} onPress={dismissFeedbackOverlay}>
            <View style={styles.overlayContent}>
              <View style={styles.overlayHandleGreen} />
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
                    onPress={handlePressGenerateExplanation}
                    disabled={isGeneratingExplanation}
                    activeOpacity={0.8}
                  >
                    <Sparkles size={18} color="#fff" />
                    <Text style={styles.generateButtonText}>Generate AI Explanation</Text>
                  </TouchableOpacity>
                </>
              )}
              <TouchableOpacity style={styles.continueButton} onPress={dismissFeedbackOverlay} activeOpacity={0.8}>
                <Text style={styles.continueButtonText}>Continue</Text>
              </TouchableOpacity>
              <Text style={styles.tapHintText}>or tap anywhere to dismiss</Text>
            </View>
          </Pressable>
        </Animated.View>
      ) : null}

      <ConsentSheet
        visible={pendingAiAction !== null}
        title="Use AI study tools?"
        description="FlashQuest sends the current question and answer to an AI processing service when you ask it to generate a hint or explanation."
        bullets={[
          'This only happens when you tap the AI hint or explanation button.',
          'The generated hint or explanation is saved back onto the card on your device.',
          'You can revisit this anytime in Privacy & Data.',
        ]}
        primaryLabel="Continue"
        secondaryLabel="Cancel"
        onPrimaryPress={handleAcceptStudyDisclosure}
        onSecondaryPress={handleDismissStudyDisclosure}
        footerActionLabel="Open Privacy & Data"
        onFooterActionPress={() => router.push(DATA_PRIVACY_ROUTE)}
        testID="study-ai-disclosure"
      />
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
    width: '100%',
    height: '100%',
    borderRadius: 28,
    padding: 32,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 16,
  },
  cardLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 24,
  },
  cardLabelActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
  hintPressable: {
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
  overlayHandleYellow: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#FFD700',
    marginBottom: 16,
  },
  overlayHandleGreen: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#4CAF50',
    marginBottom: 16,
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
