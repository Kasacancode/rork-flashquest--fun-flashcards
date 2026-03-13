import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { ArrowLeft, Users, X, Play, Settings, Clock, Target, AlertCircle, Wifi, WifiOff, Copy, Check, Swords, Share2 } from 'lucide-react-native';
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal, Alert, Animated } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  ARENA_ROUND_OPTIONS,
  ARENA_TIMER_OPTIONS,
  type ArenaRoundOption,
  type ArenaTimerOption,
  type RoomSettings,
} from '@/backend/arena/types';
import { useArena } from '@/context/ArenaContext';
import { useFlashQuest } from '@/context/FlashQuestContext';
import { useTheme } from '@/context/ThemeContext';
import { generateOptions, shuffleArray } from '@/utils/questUtils';
import { logger } from '@/utils/logger';
import { shareTextWithFallback } from '@/utils/share';

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
const ARENA_JOIN_BASE_URL = 'https://flashquest.net/join';

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
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const prevStatus = useRef<string | null>(null);

  useEffect(() => {
    if (room?.status === 'playing' && prevStatus.current !== 'playing') {
      logger.log('[Lobby] Game started, navigating to session');
      router.replace('/arena-session' as any);
    }
    prevStatus.current = room?.status ?? null;
  }, [room?.status, router]);

  useEffect(() => {
    if (!roomCode && !room) {
      router.replace('/arena' as any);
    }
  }, [roomCode, room, router]);

  useEffect(() => {
    if (connectionError) {
      Alert.alert('Connection Lost', connectionError, [
        {
          text: 'OK',
          onPress: () => {
            clearError();
            router.replace('/arena' as any);
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

    const shareMessage = `⚔️ Join my FlashQuest battle!\n\nRoom Code: ${room.code}\n${ARENA_JOIN_BASE_URL}/${room.code}`;

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
    const deck = decks.find(d => d.id === deckId);
    if (deck) {
      logger.log('[Lobby] Selecting deck from lobby:', deck.id, deck.name);
      selectDeck(deck.id, deck.name);
    }
  }, [decks, selectDeck]);

  const handleStartGame = useCallback(() => {
    if (!canStartGame || !room?.deckId) return;
    const deck = decks.find(d => d.id === room.deckId);
    if (!deck) {
      Alert.alert('Error', 'Selected deck not found on this device.');
      return;
    }

    const allCards = decks.flatMap(d => d.flashcards);
    const numQuestions = Math.min(room.settings.rounds, deck.flashcards.length);
    const shuffled = shuffleArray([...deck.flashcards]);
    const selectedCards = shuffled.slice(0, numQuestions);

    const questions = selectedCards.map(card => ({
      cardId: card.id,
      question: card.question,
      correctAnswer: card.answer,
      options: generateOptions({
        correctAnswer: card.answer,
        deckCards: deck.flashcards,
        allCards,
        currentCardId: card.id,
      }),
    }));

    logger.log('[Lobby] Starting game with', questions.length, 'questions');
    startGame(questions);
  }, [canStartGame, room, decks, startGame]);

  const handleBack = useCallback(() => {
    setShowLeaveModal(true);
  }, []);

  const handleCloseLeaveModal = useCallback(() => {
    setShowLeaveModal(false);
  }, []);

  const handleConfirmLeave = useCallback(() => {
    setShowLeaveModal(false);
    disconnect();
    router.replace('/arena' as any);
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

  const selectedDeck = useMemo(() => {
    if (!room?.deckId) return null;
    return decks.find(d => d.id === room.deckId);
  }, [decks, room?.deckId]);

  const deckSelectionWarning = useMemo(() => {
    if (room?.deckId) {
      return null;
    }

    return isSelectingDeck ? 'Saving deck selection...' : 'Select a deck to continue';
  }, [isSelectingDeck, room?.deckId]);

  const smallDeckWarning = selectedDeck && selectedDeck.flashcards.length < 8;
  const lobbyPlayers = (room?.players ?? []) as LobbyPlayer[];
  const hasInviteSlot = lobbyPlayers.length < MAX_LOBBY_SLOTS;
  const joinLink = room?.code ? `${ARENA_JOIN_BASE_URL}/${room.code}` : '';

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
          <TouchableOpacity style={styles.backButton} onPress={handleBack} activeOpacity={0.7} testID="battle-lobby-back-button">
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
          <TouchableOpacity
            style={[
              styles.codeSection,
              styles.sectionSurface,
              {
                backgroundColor: isDark ? 'rgba(15, 23, 42, 0.84)' : 'rgba(255, 248, 240, 0.96)',
                borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.38)',
              },
            ]}
            onPress={handleCopyCode}
            activeOpacity={0.7}
            testID="battle-lobby-room-code-card"
          >
            <Text style={[styles.codeLabel, { color: theme.textSecondary }]}>Room Code</Text>
            <Text style={[styles.roomCode, { color: theme.text }]}>{room.code}</Text>
            <View style={styles.copyRow}>
              {codeCopied ? (
                <>
                  <Check color="#10b981" size={16} />
                  <Text style={[styles.copyText, { color: '#10b981' }]}>Copied!</Text>
                </>
              ) : (
                <>
                  <Copy color={theme.textTertiary} size={16} />
                  <Text style={[styles.copyText, { color: theme.textTertiary }]}>Tap to copy</Text>
                </>
              )}
            </View>
            <Text style={[styles.shareNote, { color: theme.textTertiary }]}> 
              Share this code or instant join link with friends
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.shareBattleButton,
              styles.sectionSurface,
              {
                backgroundColor: isDark ? 'rgba(15, 23, 42, 0.72)' : 'rgba(255, 248, 240, 0.92)',
                borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.38)',
              },
            ]}
            onPress={() => {
              void handleShareBattle();
            }}
            activeOpacity={0.82}
            testID="battle-lobby-share-button"
          >
            <View style={styles.shareBattleIconWrap}>
              <Share2 color={arenaAccent} size={18} />
            </View>
            <View style={styles.shareBattleTextWrap}>
              <Text style={[styles.shareBattleTitle, { color: theme.text }]}>Share Battle</Text>
              <Text style={[styles.shareBattleSubtitle, { color: theme.textSecondary }]} numberOfLines={1}>
                {joinLink}
              </Text>
            </View>
          </TouchableOpacity>

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
              <View style={styles.playersHeaderLeft}>
                <Users color={arenaAccent} size={20} />
                <Text style={[styles.sectionTitle, { color: theme.text }]}>
                  Players ({lobbyPlayers.length} / {MAX_LOBBY_SLOTS})
                </Text>
              </View>
              <View style={[styles.liveBadge, { backgroundColor: '#10b981' }]}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>Live</Text>
              </View>
            </View>

            <View style={styles.playersList}>
              {lobbyPlayers.map((player) => (
                <View
                  key={player.id}
                  style={[styles.playerCard, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : theme.background }]}
                >
                  <View style={[styles.playerAvatar, { backgroundColor: player.color }]}>
                    <Text style={styles.playerInitial}>{player.suit}</Text>
                  </View>
                  <View style={styles.playerInfo}>
                    <View style={styles.playerNameRow}>
                      <View style={[styles.identityBadge, { borderColor: player.color, backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : theme.cardBackground }]}> 
                        <Text style={[styles.identityBadgeText, { color: player.color }]} numberOfLines={1}>
                          {player.identityLabel}
                        </Text>
                      </View>
                      {player.id === playerId && (
                        <Text style={[styles.youBadge, { color: theme.primary }]}>You</Text>
                      )}
                    </View>
                    <Text style={[styles.playerName, { color: theme.text }]} numberOfLines={1}>
                      {player.name}
                    </Text>
                    <View style={styles.playerMeta}>
                      {player.isHost && (
                        <Text style={[styles.hostBadge, { color: theme.warning }]}>Host</Text>
                      )}
                      <View style={styles.connectionStatus}>
                        {player.connected ? (
                          <Wifi color="#10b981" size={12} />
                        ) : (
                          <WifiOff color="#ef4444" size={12} />
                        )}
                        <Text style={{ fontSize: 11, color: player.connected ? '#10b981' : '#ef4444', fontWeight: '500' as const }}>
                          {player.connected ? 'Online' : 'Offline'}
                        </Text>
                      </View>
                    </View>
                  </View>
                  {isHost && !player.isHost && (
                    <TouchableOpacity style={styles.removeButton} onPress={() => handleRemovePlayer(player.id)} activeOpacity={0.7}>
                      <X color={theme.textTertiary} size={18} />
                    </TouchableOpacity>
                  )}
                </View>
              ))}
              {hasInviteSlot && (
                <TouchableOpacity
                  key="invite-slot"
                  style={[
                    styles.emptySlotCard,
                    {
                      backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : theme.background,
                      borderColor: isDark ? 'rgba(255,255,255,0.08)' : theme.border,
                    },
                  ]}
                  onPress={handleCopyCode}
                  activeOpacity={0.8}
                  testID="battle-lobby-empty-slot-0"
                >
                  <View style={[styles.emptySlotAvatar, { borderColor: arenaAccent }]}> 
                    <Text style={[styles.emptySlotPlus, { color: arenaAccent }]}>+</Text>
                  </View>
                  <View style={styles.playerInfo}>
                    <Text style={[styles.emptySlotTitle, { color: theme.text }]}>+ Invite</Text>
                    <Text style={[styles.emptySlotSubtitle, { color: codeCopied ? '#10b981' : theme.textSecondary }]}> 
                      {codeCopied ? 'Room code copied' : `Tap to copy code ${room.code}`}
                    </Text>
                  </View>
                </TouchableOpacity>
              )}
            </View>

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
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.deckList}
                keyboardShouldPersistTaps="handled"
                nestedScrollEnabled
              >
                {decks.map((deck) => (
                  <TouchableOpacity
                    key={deck.id}
                    style={[
                      styles.deckOption,
                      { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : theme.background },
                      room.deckId === deck.id && { borderColor: arenaAccent, borderWidth: 2 },
                    ]}
                    onPress={() => handleSelectDeck(deck.id)}
                    activeOpacity={0.7}
                    testID={`battle-lobby-deck-option-${deck.id}`}
                  >
                    <View style={[styles.deckColorDot, { backgroundColor: deck.color }]} />
                    <Text style={[styles.deckName, { color: theme.text }]} numberOfLines={1}>{deck.name}</Text>
                    <Text style={[styles.deckCardCount, { color: theme.textSecondary }]}>{deck.flashcards.length} cards</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
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
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Battle Settings</Text>
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
  codeSection: {
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
  },
  codeLabel: {
    fontSize: 14,
    fontWeight: '500' as const,
    marginBottom: 8,
  },
  roomCode: {
    fontSize: 42,
    fontWeight: '800' as const,
    letterSpacing: 8,
    marginBottom: 12,
  },
  copyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  copyText: {
    fontSize: 13,
    fontWeight: '500' as const,
  },
  shareNote: {
    fontSize: 12,
    fontStyle: 'italic' as const,
  },
  shareBattleButton: {
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  shareBattleIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(249, 115, 22, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  shareBattleTextWrap: {
    flex: 1,
  },
  shareBattleTitle: {
    fontSize: 15,
    fontWeight: '700' as const,
    marginBottom: 2,
  },
  shareBattleSubtitle: {
    fontSize: 12,
    fontWeight: '500' as const,
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
    marginBottom: 16,
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
