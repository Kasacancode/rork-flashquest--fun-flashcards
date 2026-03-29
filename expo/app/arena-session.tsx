import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { X, Crown, Users, Check, Clock } from 'lucide-react-native';
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, Animated, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { REVEAL_DURATION_MS } from '@/backend/arena/types';
import { AnswerCard, getSuitForIndex, DealerReaction, AnswerCardState, CARD_GAP, CARD_HEIGHT, CARD_PADDING, CARD_WIDTH, GRID_HORIZONTAL_MARGIN } from '@/components/AnswerCard';
import FlashcardDebugButton from '@/components/debug/FlashcardDebugButton';
import { DealerCountdownBar, StreakIndicator } from '@/components/GameUI';
import { useArena } from '@/context/ArenaContext';
import { useTheme } from '@/context/ThemeContext';
import { isMeaningfulArenaStreak, selectAssistantDialogue, type ArenaDialogueEvent } from '@/utils/dialogue';
import { logger } from '@/utils/logger';
import { ARENA_RESULTS_ROUTE, ARENA_ROUTE } from '@/utils/routes';

type ArenaRevealBeat = 'question' | 'lock' | 'answer' | 'leaderboard' | 'next';

interface ScoreboardPlayer {
  id: string;
  name: string;
  color: string;
  suit: string;
  identityLabel: string;
  points: number;
  rank: number;
  pointsDelta: number;
  rankDelta: number;
}

const LOCK_BEAT_MS = 450;
const ANSWER_BEAT_MS = 1650;
const LEADERBOARD_BEAT_MS = 900;

function getRevealBeat(phase: string | null, revealTimeRemainingMs: number | null): ArenaRevealBeat {
  if (phase !== 'reveal') {
    return 'question';
  }

  const clampedRemainingMs = Math.max(0, Math.min(REVEAL_DURATION_MS, revealTimeRemainingMs ?? REVEAL_DURATION_MS));
  const elapsedMs = REVEAL_DURATION_MS - clampedRemainingMs;

  if (elapsedMs < LOCK_BEAT_MS) {
    return 'lock';
  }

  if (elapsedMs < LOCK_BEAT_MS + ANSWER_BEAT_MS) {
    return 'answer';
  }

  if (elapsedMs < LOCK_BEAT_MS + ANSWER_BEAT_MS + LEADERBOARD_BEAT_MS) {
    return 'leaderboard';
  }

  return 'next';
}

function getPlacementLabel(rank: number): string {
  if (rank === 1) {
    return '1st';
  }

  if (rank === 2) {
    return '2nd';
  }

  if (rank === 3) {
    return '3rd';
  }

  return `${rank}th`;
}

export default function ArenaSessionScreen() {
  const router = useRouter();
  const { theme, isDark } = useTheme();
  const {
    room,
    playerId,
    hasAnsweredCurrent,
    lastAnswerCorrect,
    isSubmitting,
    submitAnswer,
    disconnect,
    connectionError,
    clearError,
  } = useArena();

  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [dealerLine, setDealerLine] = useState<string>('');
  const [dealerReactionCorrect, setDealerReactionCorrect] = useState<boolean | undefined>(undefined);
  const lastDealerLineRef = useRef<string>('');
  const prevQuestionSnapshotKeyRef = useRef<string>('no-question');
  const leaderAtQuestionStartRef = useRef<string | null>(null);
  const hasNavigatedToResults = useRef(false);

  const cardAnimations = useRef([
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
  ]).current;

  const cardScales = useRef([
    new Animated.Value(1),
    new Animated.Value(1),
    new Animated.Value(1),
    new Animated.Value(1),
  ]).current;

  const shakeAnims = useRef([
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
  ]).current;

  const revealOpacity = useRef(new Animated.Value(0)).current;
  const waitingPulse = useRef(new Animated.Value(1)).current;
  const leaderboardPanelAnim = useRef(new Animated.Value(0)).current;
  const leaderboardRowAnims = useRef([
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
  ]).current;
  const countdownDeadlineRef = useRef<number | null>(null);
  const countdownSessionKeyRef = useRef<string>('');
  const roundStartPointsRef = useRef<Record<string, number>>({});
  const roundStartRanksRef = useRef<Record<string, number>>({});
  const roundStartPointsSnapshotRef = useRef<{ key: string; value: Record<string, number> }>({ key: 'no-question', value: {} });
  const roundStartRanksSnapshotRef = useRef<{ key: string; value: Record<string, number> }>({ key: 'no-question', value: {} });
  const [displayTimeRemainingMs, setDisplayTimeRemainingMs] = useState<number | null>(null);

  const game = room?.game ?? null;
  const phase = game?.phase ?? null;
  const currentQuestion = game?.currentQuestion ?? null;
  const options = currentQuestion?.options ?? [];
  const questionIndex = game?.currentQuestionIndex ?? 0;
  const totalQuestions = game?.totalQuestions ?? 0;
  const scores = game?.scores ?? {};
  const answeredPlayerIds = game?.answeredPlayerIds ?? [];
  const currentAnswers = game?.currentAnswers ?? null;
  const players = room?.players ?? [];
  const timerTotal = room?.settings?.timerSeconds ?? 0;
  const questionTimingKey = currentQuestion
    ? `${questionIndex}:${game?.questionStartedAt ?? 0}:${currentQuestion.cardId}:${phase ?? 'idle'}`
    : 'no-question';
  const questionRoundSnapshotKey = currentQuestion
    ? `${questionIndex}:${game?.questionStartedAt ?? 0}:${currentQuestion.cardId}`
    : 'no-question';

  const myScore = playerId && scores[playerId] ? scores[playerId] : null;
  const myStreak = myScore?.currentStreak ?? 0;

  const sortedPlayers = [...players].sort((a, b) => {
    const aScore = scores[a.id]?.points ?? 0;
    const bScore = scores[b.id]?.points ?? 0;
    if (bScore !== aScore) {
      return bScore - aScore;
    }

    const aCorrect = scores[a.id]?.correct ?? 0;
    const bCorrect = scores[b.id]?.correct ?? 0;
    return bCorrect - aCorrect;
  });

  const scoreboardPlayers: ScoreboardPlayer[] = sortedPlayers.map((player, index) => {
    const currentPoints = scores[player.id]?.points ?? 0;
    const previousRank = roundStartRanksRef.current[player.id] ?? (index + 1);
    const startingPoints = roundStartPointsRef.current[player.id] ?? currentPoints;

    return {
      id: player.id,
      name: player.name,
      color: player.color,
      suit: player.suit,
      identityLabel: player.identityLabel,
      points: currentPoints,
      rank: index + 1,
      pointsDelta: Math.max(0, currentPoints - startingPoints),
      rankDelta: Math.max(0, previousRank - (index + 1)),
    };
  });

  if (roundStartPointsSnapshotRef.current.key !== questionRoundSnapshotKey) {
    roundStartPointsSnapshotRef.current = {
      key: questionRoundSnapshotKey,
      value: Object.fromEntries(players.map((player) => [player.id, scores[player.id]?.points ?? 0])),
    };
  }

  if (roundStartRanksSnapshotRef.current.key !== questionRoundSnapshotKey) {
    roundStartRanksSnapshotRef.current = {
      key: questionRoundSnapshotKey,
      value: Object.fromEntries(sortedPlayers.map((player, index) => [player.id, index + 1])),
    };
  }

  const roundStartPointsSnapshot: Record<string, number> = roundStartPointsSnapshotRef.current.value;
  const roundStartRanksSnapshot: Record<string, number> = roundStartRanksSnapshotRef.current.value;

  const leader = sortedPlayers[0];
  const leaderId = leader?.id ?? null;
  const revealTimeRemainingMs = game?.revealTimeRemainingMs ?? null;
  const revealBeat = getRevealBeat(phase, revealTimeRemainingMs);
  const myStanding = playerId ? scoreboardPlayers.find((player) => player.id === playerId) ?? null : null;
  const myPointsGain = myStanding?.pointsDelta ?? 0;
  const leadShiftCallout = useMemo(() => {
    if (phase !== 'reveal') {
      return '';
    }

    const previousLeaderId = leaderAtQuestionStartRef.current;
    if (previousLeaderId && leaderId && previousLeaderId !== leaderId && leader != null) {
      return `${leader.name} takes the lead`;
    }

    if (myStanding != null && myStanding.rankDelta > 0) {
      return `You climb to ${getPlacementLabel(myStanding.rank)}`;
    }

    const biggestMover = scoreboardPlayers
      .filter((player) => player.rankDelta > 0)
      .sort((a, b) => b.rankDelta - a.rankDelta)[0];

    if (biggestMover != null) {
      return `${biggestMover.name} climbs to ${getPlacementLabel(biggestMover.rank)}`;
    }

    return 'Standings settle';
  }, [leader, leaderId, myStanding, phase, scoreboardPlayers]);
  const displayQuestion = currentQuestion?.question ?? '';
  const displayOptions = options.map((option) => ({
    value: option.canonicalValue,
    label: option.displayText,
  }));
  const displayOptionRows: { value: string; label: string }[][] = [];

  for (let index = 0; index < displayOptions.length; index += 2) {
    displayOptionRows.push(displayOptions.slice(index, index + 2));
  }

  const questionFooterText = [
    '4 answer cards',
    '1 correct',
    timerTotal > 0 ? `${timerTotal}s clock` : 'live round',
  ].join(' • ');

  useEffect(() => {
    if (!game || phase !== 'question' || timerTotal <= 0 || game.timeRemainingMs == null) {
      countdownDeadlineRef.current = null;
      countdownSessionKeyRef.current = '';
      setDisplayTimeRemainingMs(null);
      return;
    }

    const nextRemainingMs = Math.max(0, game.timeRemainingMs);
    const isNewCountdownSession = countdownSessionKeyRef.current !== questionTimingKey;

    if (isNewCountdownSession || countdownDeadlineRef.current == null) {
      countdownSessionKeyRef.current = questionTimingKey;
      countdownDeadlineRef.current = Date.now() + nextRemainingMs;
      setDisplayTimeRemainingMs(nextRemainingMs);
      return;
    }

    const predictedRemainingMs = Math.max(0, countdownDeadlineRef.current - Date.now());
    if (nextRemainingMs < predictedRemainingMs - 250) {
      countdownDeadlineRef.current = Date.now() + nextRemainingMs;
      setDisplayTimeRemainingMs(nextRemainingMs);
    }
  }, [game, phase, questionTimingKey, timerTotal]);

  useEffect(() => {
    if (countdownDeadlineRef.current == null || phase !== 'question' || timerTotal <= 0) {
      return;
    }

    const updateCountdown = () => {
      const deadline = countdownDeadlineRef.current;
      if (deadline == null) {
        setDisplayTimeRemainingMs(null);
        return;
      }

      setDisplayTimeRemainingMs(Math.max(0, deadline - Date.now()));
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 100);

    return () => {
      clearInterval(interval);
    };
  }, [phase, questionTimingKey, timerTotal]);

  useEffect(() => {
    if (connectionError) {
      return;
    }

    if (room && game && (phase === 'finished' || room.status === 'finished') && !hasNavigatedToResults.current) {
      hasNavigatedToResults.current = true;
      logger.log('[Session] Game finished, navigating to results');
      if (Platform.OS !== 'web') {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      setTimeout(() => {
        router.replace(ARENA_RESULTS_ROUTE);
      }, 500);
      return;
    }

    if (!room || (!game && room.status !== 'finished')) {
      if (!hasNavigatedToResults.current) {
        logger.log('[Session] No active game, redirecting');
        router.replace(ARENA_ROUTE);
      }
    }
  }, [connectionError, room, game, phase, router]);

  useEffect(() => {
    if (connectionError) {
      Alert.alert('Connection Lost', connectionError, [
        {
          text: 'OK',
          onPress: () => {
            clearError();
            router.replace(ARENA_ROUTE);
          },
        },
      ]);
    }
  }, [connectionError, clearError, router]);

  useEffect(() => {
    if (questionRoundSnapshotKey !== prevQuestionSnapshotKeyRef.current) {
      const previousLeaderId = leaderAtQuestionStartRef.current;
      const dialogueEvent: ArenaDialogueEvent = previousLeaderId && leaderId && previousLeaderId !== leaderId
        ? 'leadChange'
        : 'intro';
      const line = selectAssistantDialogue({ mode: 'arena', event: dialogueEvent });

      prevQuestionSnapshotKeyRef.current = questionRoundSnapshotKey;
      setSelectedOption(null);
      setDealerReactionCorrect(undefined);
      setDealerLine(line);
      lastDealerLineRef.current = line;
      leaderAtQuestionStartRef.current = leaderId;
      roundStartPointsRef.current = roundStartPointsSnapshot;
      roundStartRanksRef.current = roundStartRanksSnapshot;
      logger.log('[ArenaDialogue] Showing line:', { event: dialogueEvent, line, questionIndex, leaderId, previousLeaderId });

      revealOpacity.setValue(0);
      leaderboardPanelAnim.setValue(0);
      leaderboardRowAnims.forEach((animation) => animation.setValue(0));

      cardAnimations.forEach((anim, index) => {
        anim.setValue(0);
        cardScales[index].setValue(1);
        shakeAnims[index].setValue(0);
        Animated.spring(anim, {
          toValue: 1,
          friction: 7,
          tension: 60,
          delay: index * 60,
          useNativeDriver: true,
        }).start();
      });
    }
  }, [questionRoundSnapshotKey, leaderId, cardAnimations, cardScales, shakeAnims, revealOpacity, leaderboardPanelAnim, leaderboardRowAnims, roundStartPointsSnapshot, roundStartRanksSnapshot, questionIndex]);

  useEffect(() => {
    if (lastAnswerCorrect !== null && selectedOption) {
      const dialogueEvent: ArenaDialogueEvent = lastAnswerCorrect && isMeaningfulArenaStreak(myStreak)
        ? 'streak'
        : lastAnswerCorrect
          ? 'correct'
          : 'wrong';
      const line = selectAssistantDialogue({ mode: 'arena', event: dialogueEvent });
      setDealerLine(line);
      lastDealerLineRef.current = line;
      setDealerReactionCorrect(lastAnswerCorrect);
      logger.log('[ArenaDialogue] Showing line:', { event: dialogueEvent, line, questionIndex, myStreak, lastAnswerCorrect });

      if (Platform.OS !== 'web') {
        void Haptics.notificationAsync(
          lastAnswerCorrect ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error
        );
      }

      const selectedIndex = (currentQuestion?.options ?? []).findIndex((option) => option.canonicalValue === selectedOption);
      if (selectedIndex >= 0) {
        if (lastAnswerCorrect) {
          Animated.sequence([
            Animated.timing(cardScales[selectedIndex], { toValue: 1.08, duration: 150, useNativeDriver: true }),
            Animated.spring(cardScales[selectedIndex], { toValue: 1, friction: 4, useNativeDriver: true }),
          ]).start();
        } else {
          Animated.sequence([
            Animated.timing(shakeAnims[selectedIndex], { toValue: 10, duration: 50, useNativeDriver: true }),
            Animated.timing(shakeAnims[selectedIndex], { toValue: -10, duration: 50, useNativeDriver: true }),
            Animated.timing(shakeAnims[selectedIndex], { toValue: 8, duration: 50, useNativeDriver: true }),
            Animated.timing(shakeAnims[selectedIndex], { toValue: -8, duration: 50, useNativeDriver: true }),
            Animated.timing(shakeAnims[selectedIndex], { toValue: 0, duration: 50, useNativeDriver: true }),
          ]).start();
        }
      }
    }
  }, [lastAnswerCorrect, selectedOption, currentQuestion?.options, questionIndex, myStreak, cardScales, shakeAnims]);

  useEffect(() => {
    if (phase === 'reveal') {
      Animated.timing(revealOpacity, {
        toValue: 1,
        duration: 260,
        useNativeDriver: true,
      }).start();
    }
  }, [phase, revealOpacity]);

  useEffect(() => {
    if (phase !== 'reveal' || (revealBeat !== 'leaderboard' && revealBeat !== 'next')) {
      return;
    }

    leaderboardPanelAnim.setValue(0);
    leaderboardRowAnims.forEach((animation) => animation.setValue(0));

    Animated.parallel([
      Animated.spring(leaderboardPanelAnim, {
        toValue: 1,
        friction: 7,
        tension: 68,
        useNativeDriver: true,
      }),
      Animated.stagger(90, leaderboardRowAnims.map((animation) => Animated.spring(animation, {
        toValue: 1,
        friction: 8,
        tension: 72,
        useNativeDriver: true,
      }))),
    ]).start();
  }, [phase, revealBeat, leaderboardPanelAnim, leaderboardRowAnims]);

  useEffect(() => {
    if (hasAnsweredCurrent && phase === 'question') {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(waitingPulse, { toValue: 1.03, duration: 800, useNativeDriver: true }),
          Animated.timing(waitingPulse, { toValue: 1, duration: 800, useNativeDriver: true }),
        ])
      );
      loop.start();
      return () => loop.stop();
    } else {
      waitingPulse.setValue(1);
    }
  }, [hasAnsweredCurrent, phase, waitingPulse]);

  const handleOptionPress = useCallback((option: string, index: number) => {
    if (hasAnsweredCurrent || isSubmitting || phase !== 'question' || !game) return;

    setSelectedOption(option);

    Animated.sequence([
      Animated.timing(cardScales[index], { toValue: 0.95, duration: 80, useNativeDriver: true }),
      Animated.spring(cardScales[index], { toValue: 1, friction: 4, useNativeDriver: true }),
    ]).start();

    submitAnswer(game.currentQuestionIndex, option);
    logger.log('[Session] Submitted answer:', option);
  }, [hasAnsweredCurrent, isSubmitting, phase, game, submitAnswer, cardScales]);

  const handleQuit = useCallback(() => {
    Alert.alert('Leave Game', 'Are you sure you want to leave the game?', [
      { text: 'Stay', style: 'cancel' },
      {
        text: 'Leave',
        style: 'destructive',
        onPress: () => {
          disconnect();
          router.replace(ARENA_ROUTE);
        },
      },
    ]);
  }, [disconnect, router]);

  const getCardState = useCallback((option: string): AnswerCardState => {
    if (phase === 'reveal' || phase === 'finished') {
      const isCorrectOption = currentQuestion?.correctAnswer === option;
      if (isCorrectOption) return 'correct';
      if (option === selectedOption && !isCorrectOption) return 'wrong';
      return 'disabled';
    }

    if (hasAnsweredCurrent) {
      if (option === selectedOption) return 'disabled';
      return 'disabled';
    }

    if (isSubmitting) return 'disabled';
    return 'idle';
  }, [phase, currentQuestion, selectedOption, hasAnsweredCurrent, isSubmitting]);

  if (!room || !game || phase === 'finished' || room.status === 'finished') {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <LinearGradient
          colors={[theme.arenaGradient[0], theme.arenaGradient[1]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <SafeAreaView style={styles.loadingContainer}>
          <Text style={styles.loadingText}>
            {(phase === 'finished' || room?.status === 'finished') ? 'Loading results...' : 'Connecting...'}
          </Text>
        </SafeAreaView>
      </View>
    );
  }

  const answeredCount = answeredPlayerIds.length;
  const totalPlayers = players.length;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <LinearGradient
        colors={[theme.arenaGradient[0], theme.arenaGradient[1]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.gameHeader}>
          <TouchableOpacity style={styles.quitButton} onPress={handleQuit} activeOpacity={0.7}>
            <X color="#fff" size={20} />
          </TouchableOpacity>

          <View style={styles.questionBadge}>
            <Text style={styles.questionBadgeText}>{questionIndex + 1}/{totalQuestions}</Text>
          </View>

          {myStreak > 0 && (
            <StreakIndicator streak={myStreak} showMultiplier={false} />
          )}

          {leader != null && (
            <View style={styles.leaderBadge}>
              <Crown color="#f59e0b" size={12} />
              <Text style={styles.leaderBadgeText}>
                {leader.name.slice(0, 6)}: {scores[leader.id]?.points ?? 0}
              </Text>
            </View>
          )}
        </View>

        {phase === 'question' && hasAnsweredCurrent && (
          <Animated.View style={[styles.waitingBanner, { transform: [{ scale: waitingPulse }] }]}>
            <Clock color="rgba(255,255,255,0.8)" size={16} />
            <Text style={styles.waitingBannerText}>
              Waiting for others... ({answeredCount}/{totalPlayers})
            </Text>
          </Animated.View>
        )}

        {phase === 'question' && !hasAnsweredCurrent && (
          <View style={styles.answeredIndicator}>
            <Users color="rgba(255,255,255,0.6)" size={14} />
            <Text style={styles.answeredText}>{answeredCount}/{totalPlayers} answered</Text>
          </View>
        )}

        {phase === 'reveal' && (
          <Animated.View style={[styles.revealBanner, { opacity: revealOpacity }]}> 
            <Text style={styles.revealBannerEyebrow}>
              {revealBeat === 'lock'
                ? 'Round locked'
                : revealBeat === 'answer'
                  ? 'Answer reveal'
                  : revealBeat === 'leaderboard'
                    ? 'Leaderboard update'
                    : 'Next deal'}
            </Text>
            <Text style={styles.revealBannerText}>
              {revealBeat === 'lock'
                ? 'Cards are in. Resolving the round...'
                : revealBeat === 'answer'
                  ? (lastAnswerCorrect ? 'You nailed it.' : selectedOption ? 'The table turns over.' : 'Time expires.')
                  : revealBeat === 'leaderboard'
                    ? leadShiftCallout
                    : 'Next question incoming'}
            </Text>
            <Text style={styles.revealBannerSubtext}>
              {revealBeat === 'answer'
                ? (myPointsGain > 0 ? `+${myPointsGain} pts banked` : 'Check the correct card and round result')
                : revealBeat === 'leaderboard'
                  ? 'Scores settle before the next draw'
                  : 'A short beat keeps the round readable'}
            </Text>
          </Animated.View>
        )}

        <View style={styles.topStage}>
          {!!dealerLine && (phase === 'question' || phase === 'reveal') && (
            <View
              style={[
                styles.assistantCard,
                { backgroundColor: 'rgba(0, 0, 0, 0.18)', borderColor: 'rgba(255, 255, 255, 0.12)' },
              ]}
              testID="arenaAssistantRow"
            >
              <View style={styles.assistantMetaRow}>
                <Text style={styles.assistantEyebrow}>FLASHQUEST AI</Text>
                <Text style={styles.assistantMode}>
                  {phase === 'reveal'
                    ? (revealBeat === 'leaderboard' || revealBeat === 'next' ? 'Standings update' : 'Round reveal')
                    : hasAnsweredCurrent
                      ? 'Answer locked'
                      : 'Live battle'}
                </Text>
              </View>
              <View style={styles.dealerSection}>
                <DealerReaction text={dealerLine} isCorrect={dealerReactionCorrect} />
              </View>
            </View>
          )}

          <View style={[styles.questionCard, { backgroundColor: isDark ? theme.cardBackground : 'rgba(255,255,255,0.95)' }]} testID="arenaQuestionCard">
            <View style={styles.questionMetaRow}>
              <View style={styles.questionPill}>
                <Text style={styles.questionPillText} numberOfLines={1}>
                  {room?.code ? `ROOM ${room.code}` : 'ARENA BATTLE'}
                </Text>
              </View>
              <FlashcardDebugButton
                deckId={room?.deckId}
                cardId={currentQuestion?.cardId}
                surface="arena"
                options={currentQuestion?.options ?? []}
                testID="arena-flashcard-debug-button"
              />
            </View>
            {timerTotal > 0 && displayTimeRemainingMs !== null && phase === 'question' && (
              <View style={styles.inlineTimer}>
                <DealerCountdownBar
                  timeRemainingMs={displayTimeRemainingMs}
                  totalTimeMs={timerTotal * 1000}
                />
              </View>
            )}
            <Text style={[styles.questionText, { color: theme.text }]} numberOfLines={4}>
              {displayQuestion}
            </Text>
            <View style={styles.questionFooter}>
              <Text style={[styles.questionFooterText, { color: isDark ? 'rgba(255,255,255,0.72)' : theme.textSecondary }]} numberOfLines={1}>
                {questionFooterText}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.gameArea}>
          <View style={[styles.tableSurface, { backgroundColor: theme.arenaTableSurface }]}>
            <View style={styles.optionsGrid} testID="arenaAnswerGrid">
              {displayOptionRows.map((row, rowIndex) => {
                const isLastRow = rowIndex === displayOptionRows.length - 1;

                return (
                  <View key={`row-${questionIndex}-${rowIndex}`} style={[styles.optionsRow, isLastRow && styles.optionsRowLast]}>
                    {row.map(({ value, label }, columnIndex) => {
                      const optionIndex = (rowIndex * 2) + columnIndex;

                      return (
                        <AnswerCard
                          key={`${questionIndex}-${optionIndex}-${value}`}
                          optionText={label}
                          suit={getSuitForIndex(optionIndex)}
                          index={optionIndex}
                          state={getCardState(value)}
                          onPress={() => handleOptionPress(value, optionIndex)}
                          animatedScale={cardScales[optionIndex]}
                          animatedShake={shakeAnims[optionIndex]}
                          animatedOpacity={cardAnimations[optionIndex]}
                        />
                      );
                    })}
                    {row.length === 1 ? <View style={styles.answerCardSpacer} /> : null}
                  </View>
                );
              })}
            </View>
          </View>

          {phase === 'reveal' && currentAnswers && (
            <Animated.View style={[styles.playerAnswers, { opacity: revealOpacity }]}>
              <View style={styles.playerAnswersHeader}>
                <View>
                  <Text style={styles.playerAnswersEyebrow}>Correct answer</Text>
                  <Text style={styles.playerAnswersTitle}>{currentQuestion?.correctAnswerDisplay ?? currentQuestion?.correctAnswer ?? '—'}</Text>
                </View>
                <View
                  style={[
                    styles.playerAnswersOutcomeBadge,
                    {
                      backgroundColor: lastAnswerCorrect ? 'rgba(16,185,129,0.22)' : 'rgba(239,68,68,0.22)',
                      borderColor: lastAnswerCorrect ? 'rgba(16,185,129,0.38)' : 'rgba(239,68,68,0.38)',
                    },
                  ]}
                >
                  <Text style={styles.playerAnswersOutcomeText}>
                    {lastAnswerCorrect ? 'You were right' : selectedOption ? 'Your pick missed' : 'Timed out'}
                  </Text>
                </View>
              </View>
              {myPointsGain > 0 && (
                <View style={styles.pointsPill}>
                  <Text style={styles.pointsPillText}>+{myPointsGain} pts</Text>
                </View>
              )}
              {players.map((player: any) => {
                const answer = currentAnswers[player.id];
                if (!answer) return null;
                const pointsDelta = scoreboardPlayers.find((entry) => entry.id === player.id)?.pointsDelta ?? 0;
                return (
                  <View key={player.id} style={styles.playerAnswerRow}>
                    <View style={[styles.playerAnswerDot, { backgroundColor: player.color }]} />
                    <Text style={styles.playerAnswerName} numberOfLines={1}>{player.name}</Text>
                    {pointsDelta > 0 && (
                      <View style={styles.playerAnswerPointsBadge}>
                        <Text style={styles.playerAnswerPointsText}>+{pointsDelta}</Text>
                      </View>
                    )}
                    <View style={[
                      styles.playerAnswerBadge,
                      { backgroundColor: answer.isCorrect ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)' },
                    ]}>
                      {answer.isCorrect ? (
                        <Check color="#10b981" size={14} />
                      ) : (
                        <X color="#ef4444" size={14} />
                      )}
                      <Text style={[
                        styles.playerAnswerStatus,
                        { color: answer.isCorrect ? '#10b981' : '#ef4444' },
                      ]}>
                        {answer.isCorrect ? 'Correct' : 'Wrong'}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </Animated.View>
          )}

          <View style={styles.compactScoreboard}>
            {scoreboardPlayers.slice(0, 4).map((player) => (
              <View
                key={player.id}
                style={[
                  styles.compactScoreItem,
                  player.id === playerId && styles.compactScoreItemActive,
                ]}
              >
                <Text style={styles.compactRank}>{player.rank === 1 ? '👑' : `#${player.rank}`}</Text>
                <View style={[styles.compactDot, { backgroundColor: player.color }]} />
                <Text style={styles.compactName} numberOfLines={1}>{player.name}</Text>
                {phase === 'reveal' && player.pointsDelta > 0 ? (
                  <Text style={styles.compactDelta}>+{player.pointsDelta}</Text>
                ) : null}
                <Text style={styles.compactPoints}>{player.points}</Text>
              </View>
            ))}
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: 'rgba(255,255,255,0.8)',
  },
  gameHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 8,
  },
  quitButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  questionBadge: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  questionBadgeText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700' as const,
  },
  leaderBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 10,
  },
  leaderBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600' as const,
  },
  waitingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 12,
    marginBottom: 6,
    backgroundColor: 'rgba(245, 158, 11, 0.3)',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
  },
  waitingBannerText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600' as const,
  },
  answeredIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginHorizontal: 12,
    marginBottom: 6,
    paddingVertical: 6,
  },
  answeredText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 12,
    fontWeight: '500' as const,
  },
  revealBanner: {
    alignItems: 'center',
    marginHorizontal: 12,
    marginBottom: 6,
    backgroundColor: 'rgba(15, 23, 42, 0.34)',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    gap: 3,
  },
  revealBannerEyebrow: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 11,
    fontWeight: '800' as const,
    letterSpacing: 0.8,
    textTransform: 'uppercase' as const,
  },
  revealBannerText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700' as const,
    textAlign: 'center',
  },
  revealBannerSubtext: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 12,
    fontWeight: '500' as const,
    textAlign: 'center',
  },
  topStage: {
    paddingTop: 4,
    paddingBottom: 8,
    gap: 10,
  },
  assistantCard: {
    marginHorizontal: GRID_HORIZONTAL_MARGIN,
    borderRadius: 20,
    borderWidth: 1,
    minHeight: 86,
    paddingBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 14,
    elevation: 5,
  },
  assistantMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 14,
    marginBottom: 4,
  },
  assistantEyebrow: {
    fontSize: 11,
    fontWeight: '800' as const,
    color: 'rgba(255,255,255,0.92)',
    letterSpacing: 0.8,
  },
  assistantMode: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: 'rgba(255,255,255,0.72)',
  },
  dealerSection: {
    marginBottom: 0,
  },
  questionCard: {
    marginHorizontal: GRID_HORIZONTAL_MARGIN,
    marginBottom: 4,
    borderRadius: 22,
    paddingHorizontal: 20,
    paddingVertical: 18,
    minHeight: 154,
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.14,
    shadowRadius: 10,
    elevation: 6,
  },
  questionMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    gap: 10,
  },
  questionPill: {
    backgroundColor: 'rgba(245, 158, 11, 0.18)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    maxWidth: '82%',
  },
  questionPillText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: '#fbbf24',
  },
  inlineTimer: {
    marginBottom: 12,
    marginHorizontal: -4,
  },
  questionText: {
    fontSize: 20,
    fontWeight: '700' as const,
    textAlign: 'center',
    lineHeight: 27,
  },
  questionFooter: {
    marginTop: 12,
    alignItems: 'center',
  },
  questionFooterText: {
    fontSize: 12,
    fontWeight: '700' as const,
    letterSpacing: 0.2,
  },
  gameArea: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingBottom: 20,
  },
  tableSurface: {
    marginHorizontal: GRID_HORIZONTAL_MARGIN,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: CARD_PADDING,
    paddingVertical: CARD_PADDING + 2,
  },
  optionsGrid: {
    width: '100%',
  },
  optionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: CARD_GAP,
  },
  optionsRowLast: {
    marginBottom: 0,
  },
  answerCardSpacer: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    opacity: 0,
  },
  playerAnswers: {
    marginHorizontal: GRID_HORIZONTAL_MARGIN,
    marginTop: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderRadius: 14,
    padding: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  playerAnswersHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 2,
  },
  playerAnswersEyebrow: {
    fontSize: 11,
    fontWeight: '800' as const,
    color: 'rgba(255,255,255,0.68)',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  playerAnswersTitle: {
    fontSize: 18,
    fontWeight: '800' as const,
    color: '#fff',
  },
  playerAnswersOutcomeBadge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  playerAnswersOutcomeText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: '#fff',
  },
  pointsPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(16,185,129,0.22)',
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.34)',
  },
  pointsPillText: {
    fontSize: 12,
    fontWeight: '800' as const,
    color: '#6ee7b7',
  },
  playerAnswerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  playerAnswerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  playerAnswerName: {
    flex: 1,
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.85)',
    fontWeight: '500' as const,
  },
  playerAnswerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  playerAnswerPointsBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(16,185,129,0.18)',
  },
  playerAnswerPointsText: {
    fontSize: 11,
    fontWeight: '800' as const,
    color: '#6ee7b7',
  },
  playerAnswerStatus: {
    fontSize: 12,
    fontWeight: '600' as const,
  },
  compactScoreboard: {
    flexDirection: 'row',
    marginHorizontal: GRID_HORIZONTAL_MARGIN,
    marginTop: 10,
    gap: 6,
  },
  compactScoreItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 8,
    gap: 4,
  },
  compactScoreItemActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  compactRank: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  compactDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  compactName: {
    flex: 1,
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.85)',
    fontWeight: '500' as const,
  },
  compactDelta: {
    fontSize: 10,
    color: '#6ee7b7',
    fontWeight: '800' as const,
  },
  compactPoints: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '700' as const,
  },
});
