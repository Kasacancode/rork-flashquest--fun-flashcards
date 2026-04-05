import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { ArrowLeft, Users, X, Play, Settings, Clock, Target, AlertCircle, Wifi, Copy, Check, Swords, Share2 } from 'lucide-react-native';
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal, Alert, Animated, ActivityIndicator } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as QRCode from 'qrcode';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SvgXml } from 'react-native-svg';

import {
  ARENA_ROUND_OPTIONS,
  ARENA_TIMER_OPTIONS,
  type ArenaDeckSourceCard,
  type ArenaRoundOption,
  type ArenaTimerOption,
  type RoomSettings,
} from '@/backend/arena/types';
import ArenaLobbyDeckSelector from '@/components/arena/ArenaLobbyDeckSelector';
import ArenaLobbyPlayersList from '@/components/arena/ArenaLobbyPlayersList';
import { useArena } from '@/context/ArenaContext';
import { useFlashQuest } from '@/context/FlashQuestContext';
import { useTheme } from '@/context/ThemeContext';
import { logger } from '@/utils/logger';
import { createNormalizedFlashcard, getFlashcardContent } from '@/utils/flashcardContent';
import { shareTextWithFallback } from '@/utils/share';
import { ARENA_ROUTE, ARENA_SESSION_ROUTE } from '@/utils/routes';

const ARENA_ACCENT_LIGHT = '#f97316';
const ARENA_ACCENT_DARK = '#f59e0b';

const ROUND_OPTIONS: { value: ArenaRoundOption; label: string }[] = ARENA_ROUND_OPTIONS.map((value) => ({
  value,
  label: String(value),
}));

const TIMER_OPTIONS: { value: ArenaTimerOption; label: string }[] = ARENA_TIMER_OPTIONS.map((value) => ({
  value,
  label: value === 0 ? 'Off' : `${value}s`,
}));

const MAX_LOBBY_SLOTS = 6;
const ARENA_JOIN_BASE_URL = 'https://flashquest.net/join.html?code=';
const BATTLE_QUESTION_MAX = 100;
const BATTLE_ANSWER_MAX = 34;
const MIN_BATTLE_READY_CARDS = 4;
const MIN_DISTINCT_BATTLE_ANSWERS = 4;

function truncateBattleText(value: string, maxLength: number): string {
  const trimmedValue = value.trim();

  if (trimmedValue.length <= maxLength) {
    return trimmedValue;
  }

  if (maxLength <= 3) {
    return trimmedValue.slice(0, maxLength);
  }

  return `${trimmedValue.slice(0, maxLength - 3).trimEnd()}...`;
}

interface LobbyPlayer {
  id: string;
  name: string;
  color: string;
  identityKey: string;
  identityLabel: string;
  suit: string;
  isHost: boolean;
  connected: boolean;
}

export default function ArenaLobbyScreen() {
  const router = useRouter();
  const { theme, isDark } = useTheme();
  const arenaAccent = isDark ? ARENA_ACCENT_DARK : ARENA_ACCENT_LIGHT;
  const { decks } = useFlashQuest();
  const {
    room,
    roomCode,
    playerId,
    isHost,
    canStartGame,
    isSelectingDeck,
    isStartingGame,
    selectDeck,
    updateSettings,
    removePlayer,
    startGame,
    disconnect,
    connectionError,
    clearError,
  } = useArena();

  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);
  const [showLeaveModal, setShowLeaveModal] = useState<boolean>(false);
  const [codeCopied, setCodeCopied] = useState<boolean>(false);
  const [qrSvg, setQrSvg] = useState<string>('');
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const playerCountPulse = useRef(new Animated.Value(1)).current;
  const playerEntryAnimationsRef = useRef<Record<string, Animated.Value>>({});
  const previousPlayerIdsRef = useRef<string[]>([]);
  const prevStatus = useRef<string | null>(null);

  useEffect(() => {
    if (room?.status === 'playing' && prevStatus.current !== 'playing') {
      logger.log('[Lobby] Game started, navigating to session');
      router.replace(ARENA_SESSION_ROUTE);
    }
    prevStatus.current = room?.status ?? null;
  }, [room?.status, router]);

  useEffect(() => {
    if (connectionError) {
      return;
    }

    if (!roomCode && !room) {
      router.replace(ARENA_ROUTE);
    }
  }, [connectionError, roomCode, room, router]);

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
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.05, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulseAnim]);

  useEffect(() => {
    let cancelled = false;

    if (!room?.code) {
      setQrSvg('');
      return;
    }

    const joinUrl = `${ARENA_JOIN_BASE_URL}${room.code}`;
    logger.log('[Lobby] Generating QR invite for room:', room.code, joinUrl);

    void QRCode.toString(joinUrl, {
      type: 'svg',
      errorCorrectionLevel: 'M',
      margin: 1,
      color: { dark: '#000000', light: '#FFFFFF' },
    })
      .then((svg) => {
        if (!cancelled) {
          setQrSvg(svg);
        }
      })
      .catch((error: unknown) => {
        logger.warn('[Lobby] Failed to generate QR code:', error);
        if (!cancelled) {
          setQrSvg('');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [room?.code]);

  const handleCopyCode = useCallback(async () => {
    if (!roomCode) return;
    try {
      await Clipboard.setStringAsync(roomCode);
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    } catch {
      logger.log('[Lobby] Copy failed');
    }
  }, [roomCode]);

  const handleShareBattle = useCallback(async () => {
    if (!room?.code) {
      return;
    }

    const shareMessage = `Join my FlashQuest battle!\n\nRoom Code: ${room.code}\n${ARENA_JOIN_BASE_URL}${room.code}`;

    logger.log('[Lobby] Sharing battle invite for room:', room.code);

    const shareResult = await shareTextWithFallback({
      message: shareMessage,
      title: 'FlashQuest Battle Invite',
      fallbackTitle: 'Unable to share',
      fallbackMessage: 'Please try again in a moment.',
      copiedTitle: 'Invite copied',
      copiedMessage: 'Sharing is limited here, so the battle invite was copied to your clipboard.',
    });

    logger.log('[Lobby] Share battle result:', shareResult);
  }, [room?.code]);

  const handleRemovePlayer = useCallback((targetId: string) => {
    const player = room?.players.find((p: any) => p.id === targetId);
    if (!player || player.isHost) return;
    Alert.alert('Remove Player', `Remove ${player.name} from the lobby?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => removePlayer(targetId) },
    ]);
  }, [room?.players, removePlayer]);

  const handleSelectDeck = useCallback((deckId: string) => {
    const deck = decks.find((candidateDeck) => candidateDeck.id === deckId);
    if (!deck) {
      return;
    }

    if (!deck.isCustom) {
      const arenaCards: ArenaDeckSourceCard[] = deck.flashcards.map((card) => ({
        id: card.id,
        question: card.question,
        answer: card.answer,
      }));
      logger.log('[Lobby] Preparing built-in deck from lobby for backend battle generation:', deck.id, deck.name, 'cards:', arenaCards.length);
      selectDeck(deck.id, deck.name, arenaCards);
      return;
    }

    const preparedCards: ArenaDeckSourceCard[] = [];
    const seenAnswers = new Set<string>();
    let rejectedCount = 0;

    deck.flashcards.forEach((card) => {
      const currentContent = getFlashcardContent(card);
      const battleSeedQuestion = truncateBattleText(currentContent.canonicalQuestion, BATTLE_QUESTION_MAX);
      const battleSeedAnswer = truncateBattleText(currentContent.canonicalAnswer, BATTLE_ANSWER_MAX);

      if (!battleSeedQuestion || !battleSeedAnswer) {
        rejectedCount += 1;
        return;
      }

      if (battleSeedQuestion.length < 3 || battleSeedAnswer.length < 2) {
        rejectedCount += 1;
        return;
      }

      const preparedCard = createNormalizedFlashcard({
        id: card.id,
        question: battleSeedQuestion,
        answer: battleSeedAnswer,
        deckId: deck.id,
        difficulty: card.difficulty,
        createdAt: card.createdAt,
        imageUrl: card.imageUrl,
        tags: card.tags,
        hint1: card.hint1,
        hint2: card.hint2,
        explanation: card.explanation,
      });
      const preparedContent = getFlashcardContent(preparedCard);
      const battleQuestion = preparedContent.projections.battleQuestion.trim();
      const battleAnswer = preparedContent.projections.battleAnswer.trim();

      if (!battleQuestion || !battleAnswer) {
        rejectedCount += 1;
        return;
      }

      if (battleQuestion.length < 3 || battleAnswer.length < 2) {
        rejectedCount += 1;
        return;
      }

      if (preparedContent.quality.battleQuestion === 'reject' || preparedContent.quality.battleAnswer === 'reject') {
        rejectedCount += 1;
        return;
      }

      seenAnswers.add(preparedContent.normalizedAnswer);
      preparedCards.push({
        id: card.id,
        question: battleQuestion,
        answer: battleAnswer,
      });
    });

    const distinctAnswers = seenAnswers.size;

    if (preparedCards.length < MIN_BATTLE_READY_CARDS) {
      Alert.alert(
        'Not Enough Cards',
        `This deck only has ${preparedCards.length} usable cards for battle (need at least ${MIN_BATTLE_READY_CARDS}). ${rejectedCount > 0 ? `${rejectedCount} cards were empty, too short, or too long for battle.` : 'Add more cards to use this deck in battle.'}`,
      );
      return;
    }

    if (distinctAnswers < MIN_DISTINCT_BATTLE_ANSWERS) {
      Alert.alert(
        'Not Enough Unique Answers',
        'Battle mode needs at least 4 different answers to create multiple choice options. This deck has too many cards with the same answer.',
      );
      return;
    }

    logger.log(
      '[Lobby] Preparing custom deck for battle:',
      deck.id,
      deck.name,
      'usable cards:',
      preparedCards.length,
      'rejected:',
      rejectedCount,
      'distinct answers:',
      distinctAnswers,
    );
    selectDeck(deck.id, deck.name, preparedCards);
  }, [decks, selectDeck]);

  const handleStartGame = useCallback(() => {
    if (!canStartGame || !room?.deckId) return;
    logger.log('[Lobby] Requesting backend-generated battle start for room:', room.code, 'deck:', room.deckId);
    startGame();
  }, [canStartGame, room?.code, room?.deckId, startGame]);

  const handleBack = useCallback(() => {
    setShowLeaveModal(true);
  }, []);

  const handleCloseLeaveModal = useCallback(() => {
    setShowLeaveModal(false);
  }, []);

  const handleConfirmLeave = useCallback(() => {
    setShowLeaveModal(false);
    disconnect();
    router.replace(ARENA_ROUTE);
  }, [disconnect, router]);

  const handleRoundsChange = useCallback((rounds: ArenaRoundOption) => {
    updateSettings({ rounds });
  }, [updateSettings]);

  const handleTimerChange = useCallback((timerSeconds: ArenaTimerOption) => {
    updateSettings({ timerSeconds });
  }, [updateSettings]);

  const handleExplanationToggle = useCallback(() => {
    if (!room) {
      return;
    }

    const nextValue: RoomSettings['showExplanationsAtEnd'] = !room.settings.showExplanationsAtEnd;
    updateSettings({ showExplanationsAtEnd: nextValue });
  }, [room, updateSettings]);

  const getPlayerEntryAnimation = useCallback((id: string): Animated.Value => {
    if (!playerEntryAnimationsRef.current[id]) {
      playerEntryAnimationsRef.current[id] = new Animated.Value(1);
    }

    return playerEntryAnimationsRef.current[id]!;
  }, []);

  const selectedDeck = useMemo(() => {
    if (!room?.deckId) return null;
    return decks.find(d => d.id === room.deckId);
  }, [decks, room?.deckId]);

  const deckSelectionWarning = useMemo(() => {
    if (room?.deckId || decks.length === 0) {
      return null;
    }

    return isSelectingDeck ? 'Saving deck selection...' : 'Select a deck to continue';
  }, [decks.length, isSelectingDeck, room?.deckId]);

  const smallDeckWarning = selectedDeck && selectedDeck.flashcards.length < 8;
  const lobbyPlayers = (room?.players ?? []) as LobbyPlayer[];
  const lobbyPlayerIdsKey = lobbyPlayers.map((player) => player.id).join('|');
  const hasInviteSlot = lobbyPlayers.length < MAX_LOBBY_SLOTS;

  useEffect(() => {
    const nextIds = lobbyPlayerIdsKey.length > 0 ? lobbyPlayerIdsKey.split('|') : [];
    const previousIds = previousPlayerIdsRef.current;
    const joinedIds = nextIds.filter((id) => !previousIds.includes(id));

    nextIds.forEach((id) => {
      if (!playerEntryAnimationsRef.current[id]) {
        playerEntryAnimationsRef.current[id] = new Animated.Value(previousIds.length === 0 ? 1 : 0);
      }
    });

    if (joinedIds.length > 0 && previousIds.length > 0) {
      playerCountPulse.setValue(0.96);
      Animated.spring(playerCountPulse, {
        toValue: 1,
        friction: 5,
        tension: 80,
        useNativeDriver: true,
      }).start();
    }

    joinedIds.forEach((id, index) => {
      const animation = getPlayerEntryAnimation(id);
      animation.setValue(0);
      Animated.sequence([
        Animated.delay(index * 70),
        Animated.spring(animation, {
          toValue: 1,
          friction: 6,
          tension: 85,
          useNativeDriver: true,
        }),
      ]).start();
    });

    Object.keys(playerEntryAnimationsRef.current).forEach((id) => {
      if (!nextIds.includes(id)) {
        delete playerEntryAnimationsRef.current[id];
      }
    });

    previousPlayerIdsRef.current = nextIds;
  }, [getPlayerEntryAnimation, lobbyPlayerIdsKey, playerCountPulse]);

  if (!room) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <LinearGradient
          colors={[theme.arenaGradient[0], theme.arenaGradient[1]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <SafeAreaView style={styles.loadingContainer}>
          <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
            <Wifi color="rgba(255,255,255,0.6)" size={48} />
          </Animated.View>
          <Text style={styles.loadingText}>Connecting to room...</Text>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <LinearGradient
        colors={[theme.arenaGradient[0], theme.arenaGradient[1]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={handleBack} activeOpacity={0.7} accessibilityLabel="Go back" accessibilityRole="button" testID="battle-lobby-back-button">
            <ArrowLeft color="#fff" size={24} />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Swords color="#fff" size={24} />
            <Text style={styles.headerTitle}>{isHost ? 'Your Lobby' : 'Battle Lobby'}</Text>
          </View>
          {isHost ? (
            <TouchableOpacity
              style={styles.settingsButton}
              onPress={() => setShowSettingsModal(true)}
              activeOpacity={0.7}
              accessibilityLabel="Open battle settings"
              accessibilityRole="button"
              testID="battle-lobby-settings-button"
            >
              <Settings color="#fff" size={22} />
            </TouchableOpacity>
          ) : (
            <View style={styles.headerSpacer} />
          )}
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {room?.code ? (
            <View
              style={[
                styles.qrSection,
                styles.sectionSurface,
                {
                  backgroundColor: isDark ? 'rgba(15,23,42,0.8)' : 'rgba(255,255,255,0.95)',
                  borderColor: isDark ? 'rgba(148,163,184,0.12)' : 'rgba(0,0,0,0.06)',
                },
              ]}
              testID="battle-lobby-qr-section"
            >
              <Text style={[styles.qrTitle, { color: isDark ? '#F8FAFC' : '#0F172A' }]}>Scan to Join</Text>

              {qrSvg.length > 0 ? (
                <View style={styles.qrCodeWrap}>
                  <View style={styles.qrCodeBackground}>
                    <SvgXml xml={qrSvg} width={180} height={180} />
                  </View>
                </View>
              ) : (
                <View style={[styles.qrCodeWrap, { height: 212, justifyContent: 'center' }]}> 
                  <ActivityIndicator size="small" color={theme.primary} />
                </View>
              )}

              <View style={styles.roomCodeRow}>
                <Text style={[styles.roomCodeLabel, { color: isDark ? '#94A3B8' : '#64748B' }]}>Room Code</Text>
                <TouchableOpacity
                  onPress={handleCopyCode}
                  activeOpacity={0.7}
                  style={styles.roomCodePill}
                  accessibilityLabel={`Room code: ${room.code}. Tap to copy.`}
                  accessibilityRole="button"
                  testID="battle-lobby-room-code-card"
                >
                  <Text style={styles.roomCodeText}>{room.code}</Text>
                  {codeCopied ? (
                    <Check color="#10B981" size={16} strokeWidth={2.4} />
                  ) : (
                    <Copy color="rgba(255,255,255,0.6)" size={16} strokeWidth={2} />
                  )}
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[
                  styles.shareButton,
                  {
                    backgroundColor: isDark ? 'rgba(99,102,241,0.15)' : 'rgba(99,102,241,0.08)',
                    borderColor: isDark ? 'rgba(99,102,241,0.25)' : 'rgba(99,102,241,0.15)',
                  },
                ]}
                onPress={() => {
                  void handleShareBattle();
                }}
                activeOpacity={0.8}
                testID="battle-lobby-share-button"
              >
                <Share2 color={theme.primary} size={16} strokeWidth={2.2} />
                <Text style={[styles.shareButtonText, { color: theme.primary }]}>Share Invite Link</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          <View
            style={[
              styles.playersSection,
              styles.sectionSurface,
              {
                backgroundColor: isDark ? 'rgba(15, 23, 42, 0.84)' : 'rgba(255, 248, 240, 0.96)',
                borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.38)',
              },
            ]}
          >
            <View style={styles.playersSectionHeader}>
              <Animated.View style={[styles.playersHeaderLeft, { transform: [{ scale: playerCountPulse }] }]}> 
                <Users color={arenaAccent} size={20} />
                <Text style={[styles.sectionTitle, { color: theme.text }]} accessibilityRole="header">
                  Players ({lobbyPlayers.length} / {MAX_LOBBY_SLOTS})
                </Text>
              </Animated.View>
              <Animated.View style={[styles.liveBadge, { backgroundColor: '#10b981', transform: [{ scale: pulseAnim }] }]}> 
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>Live</Text>
              </Animated.View>
            </View>
            <Text style={[styles.playersSectionSubtext, { color: theme.textSecondary }]}> 
              {lobbyPlayers.length === 1 ? 'The table is open. Invite challengers to join.' : `${lobbyPlayers.length} players are seated and ready.`}
            </Text>

            <ArenaLobbyPlayersList
              players={lobbyPlayers}
              playerId={playerId}
              isHost={isHost}
              isDark={isDark}
              theme={theme}
              arenaAccent={arenaAccent}
              codeCopied={codeCopied}
              roomCode={room.code}
              hasInviteSlot={hasInviteSlot}
              onCopyCode={handleCopyCode}
              onRemovePlayer={handleRemovePlayer}
              getPlayerEntryAnimation={getPlayerEntryAnimation}
            />

            {lobbyPlayers.length < 2 && (
              <View style={[styles.warningBox, { backgroundColor: theme.warning + '20' }]}>
                <AlertCircle color={theme.warning} size={16} />
                <Text style={[styles.warningText, { color: theme.warning }]}>
                  Invite at least one more player to start a battle.
                </Text>
              </View>
            )}
          </View>

          {isHost ? (
            <View
              style={[
                styles.deckSection,
                styles.sectionSurface,
                {
                  backgroundColor: isDark ? 'rgba(15, 23, 42, 0.84)' : 'rgba(255, 248, 240, 0.96)',
                  borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.38)',
                },
              ]}
            >
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Select Deck</Text>
              {decks.length === 0 ? (
                <View style={styles.emptyDeckState}>
                  <Text style={[styles.emptyDeckStateTitle, { color: theme.text }]}>No decks on this device</Text>
                  <Text style={[styles.emptyDeckStateSubtitle, { color: theme.textSecondary }]}>The host needs at least one deck to start a battle.</Text>
                </View>
              ) : (
                <>
                  <ArenaLobbyDeckSelector
                    decks={decks}
                    selectedDeckId={room.deckId}
                    theme={theme}
                    isDark={isDark}
                    arenaAccent={arenaAccent}
                    onSelectDeck={handleSelectDeck}
                  />
                  {!!smallDeckWarning && (
                    <View style={[styles.warningBox, { backgroundColor: theme.warning + '20', marginTop: 12 }]}>
                      <AlertCircle color={theme.warning} size={16} />
                      <Text style={[styles.warningText, { color: theme.warning }]}>Best with 8+ cards for variety</Text>
                    </View>
                  )}
                  {!!deckSelectionWarning && (
                    <View style={[styles.warningBox, { backgroundColor: isSelectingDeck ? theme.primary + '20' : theme.error + '20', marginTop: 12 }]}>
                      <AlertCircle color={isSelectingDeck ? theme.primary : theme.error} size={16} />
                      <Text style={[styles.warningText, { color: isSelectingDeck ? theme.primary : theme.error }]}>{deckSelectionWarning}</Text>
                    </View>
                  )}
                </>
              )}
            </View>
          ) : (
            <View
              style={[
                styles.deckSection,
                styles.sectionSurface,
                {
                  backgroundColor: isDark ? 'rgba(15, 23, 42, 0.84)' : 'rgba(255, 248, 240, 0.96)',
                  borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.38)',
                },
              ]}
            >
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Selected Deck</Text>
              {room.deckName ? (
                <View style={[styles.selectedDeckCard, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : theme.background }]}>
                  <Text style={[styles.selectedDeckName, { color: theme.text }]}>{room.deckName}</Text>
                </View>
              ) : (
                <Text style={[styles.waitingText, { color: theme.textSecondary }]}>Waiting for host to select a deck...</Text>
              )}
            </View>
          )}

          <View
            style={[
              styles.settingsPreview,
              styles.sectionSurface,
              {
                backgroundColor: isDark ? 'rgba(15, 23, 42, 0.84)' : 'rgba(255, 248, 240, 0.96)',
                borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.38)',
              },
            ]}
          >
            <Text style={[styles.sectionTitle, { color: theme.text }]} accessibilityRole="header">Battle Settings</Text>
            <View style={styles.settingsGrid}>
              <View style={styles.settingItem}>
                <Target color={theme.textSecondary} size={16} />
                <Text style={[styles.settingLabel, { color: theme.textSecondary }]}>Questions</Text>
                <Text style={[styles.settingValue, { color: theme.text }]}>{room.settings.rounds}</Text>
              </View>
              <View style={styles.settingItem}>
                <Clock color={theme.textSecondary} size={16} />
                <Text style={[styles.settingLabel, { color: theme.textSecondary }]}>Answer Time</Text>
                <Text style={[styles.settingValue, { color: theme.text }]}>
                  {room.settings.timerSeconds === 0 ? 'Off' : `${room.settings.timerSeconds}s`}
                </Text>
              </View>
            </View>
            <View style={styles.settingSummaryRow}>
              <Text style={[styles.settingSummaryLabel, { color: theme.textSecondary }]}>Show explanations after match</Text>
              <Text style={[styles.settingSummaryValue, { color: room.settings.showExplanationsAtEnd ? arenaAccent : theme.textSecondary }]}>
                {room.settings.showExplanationsAtEnd ? 'On' : 'Off'}
              </Text>
            </View>
          </View>

          {isHost ? (
            <TouchableOpacity
              style={[styles.startButton, (!canStartGame || isStartingGame || isSelectingDeck) && styles.disabledButton]}
              onPress={handleStartGame}
              activeOpacity={0.85}
              disabled={!canStartGame || isStartingGame || isSelectingDeck}
              accessibilityLabel="Start battle"
              accessibilityRole="button"
            >
              <LinearGradient
                colors={canStartGame && !isStartingGame && !isSelectingDeck ? ['#10b981', '#059669'] : ['#9ca3af', '#6b7280']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.startButtonGradient}
              >
                <Play color="#fff" size={24} fill="#fff" />
                <Text style={styles.startButtonText}>
                  {isSelectingDeck ? 'Saving Deck...' : isStartingGame ? 'Starting...' : 'Start Game'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          ) : (
            <Animated.View style={[styles.waitingForHost, { transform: [{ scale: pulseAnim }] }]}>
              <Text style={styles.waitingForHostText}>Waiting for host to start...</Text>
            </Animated.View>
          )}
        </ScrollView>
      </SafeAreaView>

      <Modal
        visible={showLeaveModal}
        animationType="fade"
        transparent
        onRequestClose={handleCloseLeaveModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.leaveModalShell}>
            <LinearGradient
              colors={isDark ? ['#0f172a', '#111827'] : ['#102033', '#08111d']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.leaveModalContent}
            >
              <View style={styles.leaveModalHeader}>
                <Text style={styles.leaveModalTitle}>Leave Room</Text>
                <Text style={styles.leaveModalDescription}>
                  {isHost ? 'Leaving will close the room for everyone.' : 'Are you sure you want to leave this battle room?'}
                </Text>
              </View>

              <View style={styles.leaveModalDivider} />

              <View style={styles.leaveModalActions}>
                <TouchableOpacity
                  style={styles.leaveStayButton}
                  onPress={handleCloseLeaveModal}
                  activeOpacity={0.8}
                  testID="battle-lobby-stay-button"
                >
                  <LinearGradient
                    colors={['#60a5fa', '#3b82f6']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.leaveButtonGradient}
                  >
                    <Text style={styles.leaveStayButtonText}>Stay</Text>
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.leaveExitButton}
                  onPress={handleConfirmLeave}
                  activeOpacity={0.8}
                  testID="battle-lobby-leave-button"
                >
                  <LinearGradient
                    colors={['#fb7185', '#ef4444']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.leaveButtonGradient}
                  >
                    <Text style={styles.leaveExitButtonText}>Leave</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </LinearGradient>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showSettingsModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowSettingsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[styles.settingsModalContent, { backgroundColor: isDark ? '#1e293b' : '#ffffff' }]}
            testID="battle-settings-modal"
          >
            <View style={styles.settingsModalHeader}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>Battle Settings</Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setShowSettingsModal(false)}
                activeOpacity={0.7}
                accessibilityLabel="Close"
                accessibilityRole="button"
                testID="battle-settings-close-button"
              >
                <X color={theme.textSecondary} size={24} />
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.settingsScrollContent}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.settingRow}>
                <View style={styles.settingLabelRow}>
                  <Target color={theme.textSecondary} size={18} />
                  <Text style={[styles.settingRowLabel, { color: theme.text }]}>Questions</Text>
                </View>
                <View style={styles.optionGroup}>
                  {ROUND_OPTIONS.map((option) => (
                    <TouchableOpacity
                      key={option.value}
                      style={[
                        styles.optionButton,
                        { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : theme.background },
                        room.settings.rounds === option.value && { backgroundColor: arenaAccent },
                      ]}
                      onPress={() => handleRoundsChange(option.value)}
                      activeOpacity={0.7}
                      accessibilityLabel={`${option.value} questions per round`}
                      accessibilityRole="button"
                      accessibilityState={{ selected: room.settings.rounds === option.value }}
                      testID={`battle-settings-rounds-${option.value}`}
                    >
                      <Text style={[styles.optionText, { color: room.settings.rounds === option.value ? '#fff' : theme.text }]}> 
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.settingRow}>
                <View style={styles.settingLabelRow}>
                  <Clock color={theme.textSecondary} size={18} />
                  <Text style={[styles.settingRowLabel, { color: theme.text }]}>Answer Time</Text>
                </View>
                <View style={styles.optionGroup}>
                  {TIMER_OPTIONS.map((option) => (
                    <TouchableOpacity
                      key={option.value}
                      style={[
                        styles.optionButton,
                        { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : theme.background },
                        room.settings.timerSeconds === option.value && { backgroundColor: arenaAccent },
                      ]}
                      onPress={() => handleTimerChange(option.value)}
                      activeOpacity={0.7}
                      accessibilityLabel={option.value === 0 ? 'No timer' : `${option.value} second timer`}
                      accessibilityRole="button"
                      accessibilityState={{ selected: room.settings.timerSeconds === option.value }}
                      testID={`battle-settings-timer-${option.value}`}
                    >
                      <Text style={[styles.optionText, { color: room.settings.timerSeconds === option.value ? '#fff' : theme.text }]}>
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <TouchableOpacity
                style={styles.toggleRow}
                onPress={handleExplanationToggle}
                activeOpacity={0.7}
                testID="battle-settings-explanations-toggle"
              >
                <Text style={[styles.settingRowLabel, { color: theme.text }]}>Show explanations after match</Text>
                <View style={styles.toggleGroup}>
                  <Text style={[styles.toggleStateText, { color: room.settings.showExplanationsAtEnd ? arenaAccent : theme.textSecondary }]}>
                    {room.settings.showExplanationsAtEnd ? 'On' : 'Off'}
                  </Text>
                  <View style={[styles.toggle, { backgroundColor: room.settings.showExplanationsAtEnd ? arenaAccent : theme.border }]}>
                    <View style={[styles.toggleKnob, { transform: [{ translateX: room.settings.showExplanationsAtEnd ? 20 : 2 }] }]} />
                  </View>
                </View>
              </TouchableOpacity>
            </ScrollView>

            <TouchableOpacity
              style={[styles.doneButton, { backgroundColor: arenaAccent }]}
              onPress={() => setShowSettingsModal(false)}
              activeOpacity={0.8}
              accessibilityLabel="Done"
              accessibilityRole="button"
              testID="battle-settings-done-button"
            >
              <Text style={styles.doneButtonText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: 'rgba(255,255,255,0.8)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: '#fff',
  },
  settingsButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerSpacer: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  sectionSurface: {
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.16,
    shadowRadius: 22,
    elevation: 8,
  },
  qrSection: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
  },
  qrTitle: {
    fontSize: 17,
    fontWeight: '800' as const,
    letterSpacing: -0.2,
    marginBottom: 16,
  },
  qrCodeWrap: {
    alignItems: 'center',
    marginBottom: 16,
  },
  qrCodeBackground: {
    padding: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
  },
  roomCodeRow: {
    alignItems: 'center',
    marginBottom: 14,
  },
  roomCodeLabel: {
    fontSize: 11,
    fontWeight: '700' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 1,
    marginBottom: 6,
  },
  roomCodePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(99,102,241,0.9)',
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: 12,
  },
  roomCodeText: {
    fontSize: 22,
    fontWeight: '800' as const,
    color: '#FFFFFF',
    letterSpacing: 2,
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
  },
  shareButtonText: {
    fontSize: 14,
    fontWeight: '700' as const,
  },
  playersSection: {
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
  },
  playersSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  playersSectionSubtext: {
    fontSize: 13,
    fontWeight: '500' as const,
    marginBottom: 14,
  },
  playersHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#fff',
  },
  liveText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: '#fff',
  },
  playersList: {
    gap: 10,
  },
  playerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    position: 'relative',
    overflow: 'hidden',
  },
  playerAvatarGlow: {
    position: 'absolute',
    top: 6,
    left: 6,
    width: 48,
    height: 48,
    borderRadius: 16,
    borderWidth: 2,
  },
  playerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playerInitial: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#fff',
  },
  playerInfo: {
    flex: 1,
    marginLeft: 12,
  },
  playerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
    flexWrap: 'wrap' as const,
  },
  identityBadge: {
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  identityBadgeText: {
    fontSize: 11,
    fontWeight: '700' as const,
  },
  playerName: {
    fontSize: 15,
    fontWeight: '600' as const,
  },
  youBadge: {
    fontSize: 12,
    fontWeight: '600' as const,
  },
  playerMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 2,
  },
  hostBadge: {
    fontSize: 12,
    fontWeight: '600' as const,
  },
  connectionStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  removeButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptySlotCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  emptySlotAvatar: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptySlotPlus: {
    fontSize: 22,
    fontWeight: '700' as const,
    lineHeight: 22,
  },
  emptySlotTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
    marginBottom: 4,
  },
  emptySlotSubtitle: {
    fontSize: 12,
    fontWeight: '500' as const,
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 10,
    marginTop: 12,
  },
  warningText: {
    fontSize: 13,
    fontWeight: '500' as const,
    flex: 1,
  },
  deckSection: {
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
  },
  deckList: {
    gap: 12,
    paddingTop: 12,
    paddingRight: 4,
  },
  deckOption: {
    width: 120,
    padding: 12,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  deckColorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginBottom: 8,
  },
  deckName: {
    fontSize: 14,
    fontWeight: '600' as const,
    marginBottom: 4,
  },
  deckCardCount: {
    fontSize: 12,
  },
  emptyDeckState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 18,
    paddingBottom: 8,
  },
  emptyDeckStateTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    textAlign: 'center' as const,
    marginBottom: 10,
  },
  emptyDeckStateSubtitle: {
    maxWidth: 280,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '500' as const,
    textAlign: 'center' as const,
  },
  selectedDeckCard: {
    padding: 16,
    borderRadius: 14,
    marginTop: 12,
    alignItems: 'center',
  },
  selectedDeckName: {
    fontSize: 16,
    fontWeight: '600' as const,
  },
  waitingText: {
    fontSize: 14,
    marginTop: 12,
    fontStyle: 'italic' as const,
  },
  settingsPreview: {
    borderRadius: 24,
    padding: 20,
    marginBottom: 20,
  },
  settingsGrid: {
    flexDirection: 'row',
    gap: 20,
    marginTop: 12,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  settingLabel: {
    fontSize: 13,
  },
  settingValue: {
    fontSize: 15,
    fontWeight: '700' as const,
  },
  settingSummaryRow: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(148, 163, 184, 0.2)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  settingSummaryLabel: {
    fontSize: 13,
    fontWeight: '500' as const,
    flex: 1,
  },
  settingSummaryValue: {
    fontSize: 13,
    fontWeight: '700' as const,
  },
  startButton: {
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },
  disabledButton: {
    opacity: 0.7,
  },
  startButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 18,
  },
  startButtonText: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#fff',
  },
  waitingForHost: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 18,
    paddingVertical: 18,
    alignItems: 'center',
  },
  waitingForHostText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(6, 10, 18, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  leaveModalShell: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 26,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 22 },
    shadowOpacity: 0.28,
    shadowRadius: 32,
    elevation: 18,
  },
  leaveModalContent: {
    paddingTop: 26,
    paddingHorizontal: 22,
    paddingBottom: 22,
    borderWidth: 1,
    borderColor: 'rgba(251, 146, 60, 0.24)',
  },
  leaveModalHeader: {
    gap: 10,
  },
  leaveModalTitle: {
    fontSize: 18,
    fontWeight: '800' as const,
    color: '#f8fafc',
  },
  leaveModalDescription: {
    fontSize: 15,
    lineHeight: 22,
    color: 'rgba(226, 232, 240, 0.85)',
  },
  leaveModalDivider: {
    height: 1,
    backgroundColor: 'rgba(148, 163, 184, 0.22)',
    marginVertical: 18,
  },
  leaveModalActions: {
    gap: 14,
  },
  leaveStayButton: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  leaveExitButton: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  leaveButtonGradient: {
    minHeight: 58,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  leaveStayButtonText: {
    fontSize: 16,
    fontWeight: '800' as const,
    color: '#fff',
  },
  leaveExitButtonText: {
    fontSize: 16,
    fontWeight: '800' as const,
    color: '#fff',
  },
  settingsModalContent: {
    width: '100%',
    maxWidth: 400,
    maxHeight: '82%',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.16)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.22,
    shadowRadius: 28,
    elevation: 14,
  },
  settingsModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(148, 163, 184, 0.12)',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
  },
  settingsScrollContent: {
    gap: 12,
    paddingBottom: 8,
  },
  settingRow: {
    flexDirection: 'column',
    alignItems: 'stretch',
    justifyContent: 'flex-start',
    gap: 14,
    marginBottom: 0,
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.18)',
    backgroundColor: 'rgba(148, 163, 184, 0.08)',
  },
  settingLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  settingRowLabel: {
    fontSize: 16,
    fontWeight: '600' as const,
    flexShrink: 1,
  },
  optionGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap' as const,
    gap: 10,
  },
  optionButton: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    minWidth: 0,
    flexBasis: '47%' as const,
    flexGrow: 1,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.18)',
  },
  optionText: {
    fontSize: 15,
    fontWeight: '700' as const,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 0,
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.18)',
    backgroundColor: 'rgba(148, 163, 184, 0.08)',
    gap: 16,
  },
  toggleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexShrink: 0,
  },
  toggleStateText: {
    fontSize: 13,
    fontWeight: '700' as const,
  },
  toggle: {
    width: 48,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
  },
  toggleKnob: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  doneButton: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  doneButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#fff',
  },
});
