import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import {
  AlertCircle,
  ArrowLeft,
  Check,
  Clock,
  Copy,
  Play,
  Settings,
  Share2,
  Target,
  Users,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useArena } from '@/context/ArenaContext';
import { useFlashQuest } from '@/context/FlashQuestContext';
import { useTheme } from '@/context/ThemeContext';
import { buildBattleInviteUrl, buildBattleShareMessage } from '@/utils/arenaInvite';
import { logger } from '@/utils/logger';
import { generateOptions, shuffleArray } from '@/utils/questUtils';

const ARENA_ACCENT_LIGHT = '#f97316';
const ARENA_ACCENT_DARK = '#f59e0b';
const MAX_LOBBY_SLOTS = 6;

type RoundsOption = 5 | 10 | 20;
type TimerOption = 0 | 5 | 10;

type SettingKey = 'rounds' | 'timerSeconds' | 'showExplanationsAtEnd';

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

const ROUND_OPTIONS: { value: RoundsOption; label: string }[] = [
  { value: 5, label: '5' },
  { value: 10, label: '10' },
  { value: 20, label: '20' },
];

const TIMER_OPTIONS: { value: TimerOption; label: string }[] = [
  { value: 0, label: 'Off' },
  { value: 5, label: '5s' },
  { value: 10, label: '10s' },
];

export default function ArenaLobbyScreen() {
  const router = useRouter();
  const { theme, isDark } = useTheme();
  const { decks } = useFlashQuest();
  const {
    room,
    roomCode,
    playerId,
    isHost,
    canStartGame,
    isStartingGame,
    selectDeck,
    updateSettings,
    removePlayer,
    startGame,
    disconnect,
    connectionError,
    clearError,
  } = useArena();

  const arenaAccent = isDark ? ARENA_ACCENT_DARK : ARENA_ACCENT_LIGHT;
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);
  const [codeCopied, setCodeCopied] = useState<boolean>(false);

  useEffect(() => {
    if (room?.status === 'playing') {
      logger.log('[Lobby] Game started, navigating to session');
      router.replace('/arena-session' as any);
    }
  }, [room?.status, router]);

  useEffect(() => {
    if (!roomCode && !room) {
      router.replace('/arena' as any);
    }
  }, [roomCode, room, router]);

  useEffect(() => {
    if (!connectionError) return;

    Alert.alert('Connection Lost', connectionError, [
      {
        text: 'OK',
        onPress: () => {
          clearError();
          router.replace('/arena' as any);
        },
      },
    ]);
  }, [clearError, connectionError, router]);

  const shareRoomCode = room?.code ?? roomCode ?? '';

  const handleCopyCode = useCallback(async () => {
    if (!shareRoomCode) return;

    try {
      await Clipboard.setStringAsync(shareRoomCode);
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    } catch (error) {
      logger.log('[Lobby] Copy failed:', error);
    }
  }, [shareRoomCode]);

  const handleShareBattle = useCallback(async () => {
    if (!shareRoomCode) return;

    try {
      logger.log('[Lobby] Opening share sheet for room:', shareRoomCode);
      await Share.share({
        title: 'FlashQuest Battle',
        message: buildBattleShareMessage(shareRoomCode),
      });
    } catch (error) {
      logger.log('[Lobby] Share failed:', error);
      Alert.alert('Share unavailable', 'Could not open the share sheet right now.');
    }
  }, [shareRoomCode]);

  const handleRemovePlayer = useCallback(
    (targetPlayerId: string) => {
      const player = room?.players.find((item: LobbyPlayer) => item.id === targetPlayerId);
      if (!player || player.isHost) return;

      Alert.alert('Remove Player', `Remove ${player.name} from the lobby?`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => removePlayer(targetPlayerId),
        },
      ]);
    },
    [removePlayer, room?.players],
  );

  const handleSelectDeck = useCallback(
    (deckId: string) => {
      const deck = decks.find((item) => item.id === deckId);
      if (!deck) return;
      selectDeck(deck.id, deck.name);
    },
    [decks, selectDeck],
  );

  const handleSettingsUpdate = useCallback(
    (key: SettingKey, value: number | boolean) => {
      updateSettings({ [key]: value });
    },
    [updateSettings],
  );

  const handleStartGame = useCallback(() => {
    if (!canStartGame || !room?.deckId) return;

    const deck = decks.find((item) => item.id === room.deckId);
    if (!deck) {
      Alert.alert('Error', 'Selected deck not found on this device.');
      return;
    }

    const allCards = decks.flatMap((item) => item.flashcards);
    const questionCount = Math.min(room.settings.rounds, deck.flashcards.length);
    const selectedCards = shuffleArray([...deck.flashcards]).slice(0, questionCount);

    const questions = selectedCards.map((card) => ({
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
  }, [canStartGame, decks, room, startGame]);

  const handleBack = useCallback(() => {
    Alert.alert(
      'Leave Room',
      isHost ? 'Leaving will close the room for everyone.' : 'Are you sure you want to leave?',
      [
        { text: 'Stay', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: () => {
            disconnect();
            router.replace('/arena' as any);
          },
        },
      ],
    );
  }, [disconnect, isHost, router]);

  const lobbyPlayers = (room?.players ?? []) as LobbyPlayer[];
  const inviteSlots = useMemo(
    () => Array.from({ length: Math.max(0, MAX_LOBBY_SLOTS - lobbyPlayers.length) }, (_, index) => index),
    [lobbyPlayers.length],
  );

  const selectedDeck = useMemo(() => {
    if (!room?.deckId) return null;
    return decks.find((item) => item.id === room.deckId) ?? null;
  }, [decks, room?.deckId]);

  const showDeckWarning = (selectedDeck?.flashcards.length ?? 0) > 0 && (selectedDeck?.flashcards.length ?? 0) < 8;

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
          <Wifi color="rgba(255,255,255,0.8)" size={44} />
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
          <TouchableOpacity style={styles.headerButton} onPress={handleBack} activeOpacity={0.8}>
            <ArrowLeft color="#fff" size={22} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{isHost ? 'Your Lobby' : 'Battle Lobby'}</Text>
          {isHost ? (
            <TouchableOpacity
              style={styles.headerButton}
              onPress={() => setShowSettingsModal(true)}
              activeOpacity={0.8}
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
        >
          <View style={[styles.inviteCard, { backgroundColor: isDark ? 'rgba(30, 41, 59, 0.95)' : theme.cardBackground }]}>
            <Text style={[styles.inviteEyebrow, { color: arenaAccent }]}>Battle Created</Text>
            <Text style={[styles.inviteCodeLabel, { color: theme.textSecondary }]}>ROOM CODE: {room.code}</Text>
            <Text style={[styles.inviteCode, { color: theme.text }]}>{room.code}</Text>

            <View style={styles.inviteActionsRow}>
              <TouchableOpacity
                style={[
                  styles.copyButton,
                  {
                    backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : theme.background,
                    borderColor: theme.border,
                  },
                ]}
                onPress={handleCopyCode}
                activeOpacity={0.8}
                testID="battle-copy-code-button"
              >
                {codeCopied ? <Check color="#10b981" size={16} /> : <Copy color={theme.textSecondary} size={16} />}
                <Text style={[styles.copyButtonText, { color: codeCopied ? '#10b981' : theme.textSecondary }]}>
                  {codeCopied ? 'Code Copied' : 'Copy Code'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.shareButton, { backgroundColor: arenaAccent }]}
                onPress={handleShareBattle}
                activeOpacity={0.85}
                testID="battle-share-button"
              >
                <Share2 color="#fff" size={18} />
                <Text style={styles.shareButtonText}>Share Battle</Text>
              </TouchableOpacity>
            </View>

            <Text style={[styles.inviteLink, { color: theme.textTertiary }]} numberOfLines={1}>
              {buildBattleInviteUrl(room.code)}
            </Text>
          </View>

          <View style={[styles.sectionCard, { backgroundColor: isDark ? 'rgba(30, 41, 59, 0.95)' : theme.cardBackground }]}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <Users color={arenaAccent} size={20} />
                <Text style={[styles.sectionTitle, { color: theme.text }]}>Players ({lobbyPlayers.length} / {MAX_LOBBY_SLOTS})</Text>
              </View>
              <View style={styles.liveBadge}>
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
                    <Text style={styles.playerAvatarText}>{player.suit}</Text>
                  </View>

                  <View style={styles.playerInfo}>
                    <View style={styles.playerTopRow}>
                      <View
                        style={[
                          styles.identityBadge,
                          {
                            borderColor: player.color,
                            backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : theme.cardBackground,
                          },
                        ]}
                      >
                        <Text style={[styles.identityBadgeText, { color: player.color }]}>{player.identityLabel}</Text>
                      </View>
                      {player.id === playerId ? <Text style={[styles.youText, { color: theme.primary }]}>You</Text> : null}
                    </View>

                    <Text style={[styles.playerName, { color: theme.text }]} numberOfLines={1}>
                      {player.name}
                    </Text>

                    <View style={styles.playerMetaRow}>
                      {player.isHost ? <Text style={[styles.metaText, { color: theme.warning }]}>Host</Text> : null}
                      <View style={styles.connectionRow}>
                        {player.connected ? <Wifi color="#10b981" size={12} /> : <WifiOff color="#ef4444" size={12} />}
                        <Text style={[styles.connectionText, { color: player.connected ? '#10b981' : '#ef4444' }]}>
                          {player.connected ? 'Online' : 'Offline'}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {isHost && !player.isHost ? (
                    <TouchableOpacity
                      style={styles.removeButton}
                      onPress={() => handleRemovePlayer(player.id)}
                      activeOpacity={0.8}
                    >
                      <X color={theme.textTertiary} size={18} />
                    </TouchableOpacity>
                  ) : null}
                </View>
              ))}

              {inviteSlots.map((slotIndex) => (
                <TouchableOpacity
                  key={`invite-${slotIndex}`}
                  style={[
                    styles.emptySlotCard,
                    {
                      backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : theme.background,
                      borderColor: isDark ? 'rgba(255,255,255,0.08)' : theme.border,
                    },
                  ]}
                  onPress={handleShareBattle}
                  activeOpacity={0.85}
                  testID={`battle-lobby-empty-slot-${slotIndex}`}
                >
                  <View style={[styles.emptySlotAvatar, { borderColor: arenaAccent }]}> 
                    <Text style={[styles.emptySlotPlus, { color: arenaAccent }]}>+</Text>
                  </View>
                  <View style={styles.playerInfo}>
                    <Text style={[styles.emptySlotTitle, { color: theme.text }]}>+ Invite</Text>
                    <Text style={[styles.emptySlotSubtitle, { color: theme.textSecondary }]}>Tap to share invite for {room.code}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>

            {lobbyPlayers.length < 2 ? (
              <View style={[styles.warningRow, { backgroundColor: theme.warning + '20' }]}>
                <AlertCircle color={theme.warning} size={16} />
                <Text style={[styles.warningText, { color: theme.warning }]}>Fill an invite slot to start a battle.</Text>
              </View>
            ) : null}
          </View>

          {isHost ? (
            <View style={[styles.sectionCard, { backgroundColor: isDark ? 'rgba(30, 41, 59, 0.95)' : theme.cardBackground }]}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Select Deck</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.deckList}>
                {decks.map((deck) => (
                  <TouchableOpacity
                    key={deck.id}
                    style={[
                      styles.deckOption,
                      { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : theme.background },
                      room.deckId === deck.id && { borderColor: arenaAccent },
                    ]}
                    onPress={() => handleSelectDeck(deck.id)}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.deckDot, { backgroundColor: deck.color }]} />
                    <Text style={[styles.deckName, { color: theme.text }]} numberOfLines={1}>
                      {deck.name}
                    </Text>
                    <Text style={[styles.deckMeta, { color: theme.textSecondary }]}>{deck.flashcards.length} cards</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {showDeckWarning ? (
                <View style={[styles.warningRow, { backgroundColor: theme.warning + '20' }]}>
                  <AlertCircle color={theme.warning} size={16} />
                  <Text style={[styles.warningText, { color: theme.warning }]}>Best with 8+ cards for variety.</Text>
                </View>
              ) : null}

              {!room.deckId ? (
                <View style={[styles.warningRow, { backgroundColor: theme.error + '20' }]}>
                  <AlertCircle color={theme.error} size={16} />
                  <Text style={[styles.warningText, { color: theme.error }]}>Select a deck to continue.</Text>
                </View>
              ) : null}
            </View>
          ) : (
            <View style={[styles.sectionCard, { backgroundColor: isDark ? 'rgba(30, 41, 59, 0.95)' : theme.cardBackground }]}>
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

          <View style={[styles.sectionCard, { backgroundColor: isDark ? 'rgba(30, 41, 59, 0.95)' : theme.cardBackground }]}>
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
              <Text
                style={[
                  styles.settingSummaryValue,
                  { color: room.settings.showExplanationsAtEnd ? arenaAccent : theme.textSecondary },
                ]}
              >
                {room.settings.showExplanationsAtEnd ? 'On' : 'Off'}
              </Text>
            </View>
          </View>

          {isHost ? (
            <TouchableOpacity
              style={[styles.startButton, (!canStartGame || isStartingGame) && styles.startButtonDisabled]}
              onPress={handleStartGame}
              activeOpacity={0.85}
              disabled={!canStartGame || isStartingGame}
            >
              <LinearGradient
                colors={canStartGame && !isStartingGame ? ['#10b981', '#059669'] : ['#9ca3af', '#6b7280']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.startButtonGradient}
              >
                <Play color="#fff" size={22} fill="#fff" />
                <Text style={styles.startButtonText}>{isStartingGame ? 'Starting...' : 'Start Game'}</Text>
              </LinearGradient>
            </TouchableOpacity>
          ) : (
            <View style={styles.waitingBanner}>
              <Text style={styles.waitingBannerText}>Waiting for host to start...</Text>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>

      <Modal
        visible={showSettingsModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowSettingsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[styles.modalContent, { backgroundColor: isDark ? '#1e293b' : theme.cardBackground }]}
            testID="battle-settings-modal"
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>Battle Settings</Text>
              <TouchableOpacity onPress={() => setShowSettingsModal(false)} activeOpacity={0.8}>
                <X color={theme.textSecondary} size={24} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.modalRow}>
                <View style={styles.modalLabelRow}>
                  <Target color={theme.textSecondary} size={18} />
                  <Text style={[styles.modalLabel, { color: theme.text }]}>Questions</Text>
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
                      onPress={() => handleSettingsUpdate('rounds', option.value)}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.optionText, { color: room.settings.rounds === option.value ? '#fff' : theme.text }]}>
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.modalRow}>
                <View style={styles.modalLabelRow}>
                  <Clock color={theme.textSecondary} size={18} />
                  <Text style={[styles.modalLabel, { color: theme.text }]}>Answer Time</Text>
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
                      onPress={() => handleSettingsUpdate('timerSeconds', option.value)}
                      activeOpacity={0.8}
                    >
                      <Text
                        style={[
                          styles.optionText,
                          { color: room.settings.timerSeconds === option.value ? '#fff' : theme.text },
                        ]}
                      >
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <TouchableOpacity
                style={styles.toggleRow}
                onPress={() => handleSettingsUpdate('showExplanationsAtEnd', !room.settings.showExplanationsAtEnd)}
                activeOpacity={0.8}
              >
                <Text style={[styles.modalLabel, { color: theme.text }]}>Show explanations after match</Text>
                <View style={styles.toggleMeta}>
                  <Text
                    style={[
                      styles.toggleState,
                      { color: room.settings.showExplanationsAtEnd ? arenaAccent : theme.textSecondary },
                    ]}
                  >
                    {room.settings.showExplanationsAtEnd ? 'On' : 'Off'}
                  </Text>
                  <View
                    style={[
                      styles.toggleTrack,
                      { backgroundColor: room.settings.showExplanationsAtEnd ? arenaAccent : theme.border },
                    ]}
                  >
                    <View
                      style={[
                        styles.toggleThumb,
                        { transform: [{ translateX: room.settings.showExplanationsAtEnd ? 20 : 2 }] },
                      ]}
                    />
                  </View>
                </View>
              </TouchableOpacity>
            </ScrollView>

            <TouchableOpacity
              style={[styles.doneButton, { backgroundColor: arenaAccent }]}
              onPress={() => setShowSettingsModal(false)}
              activeOpacity={0.85}
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
    gap: 14,
  },
  loadingText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: 'rgba(255,255,255,0.85)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerSpacer: {
    width: 40,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#fff',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  inviteCard: {
    borderRadius: 22,
    padding: 24,
    marginBottom: 16,
    alignItems: 'center',
  },
  inviteEyebrow: {
    fontSize: 13,
    fontWeight: '800' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 1,
    marginBottom: 10,
  },
  inviteCodeLabel: {
    fontSize: 14,
    fontWeight: '700' as const,
    marginBottom: 8,
  },
  inviteCode: {
    fontSize: 42,
    fontWeight: '800' as const,
    letterSpacing: 6,
    marginBottom: 16,
  },
  inviteActionsRow: {
    width: '100%',
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  shareButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderRadius: 16,
    paddingVertical: 16,
  },
  shareButtonText: {
    fontSize: 16,
    fontWeight: '800' as const,
    color: '#fff',
  },
  copyButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 12,
  },
  copyButtonText: {
    fontSize: 14,
    fontWeight: '700' as const,
  },
  inviteLink: {
    fontSize: 12,
    fontWeight: '500' as const,
  },
  sectionCard: {
    borderRadius: 22,
    padding: 20,
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  sectionTitleRow: {
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
    borderRadius: 999,
    backgroundColor: '#10b981',
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
  playerAvatarText: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#fff',
  },
  playerInfo: {
    flex: 1,
    marginLeft: 12,
  },
  playerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap' as const,
    gap: 8,
    marginBottom: 4,
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
  youText: {
    fontSize: 12,
    fontWeight: '600' as const,
  },
  playerName: {
    fontSize: 15,
    fontWeight: '600' as const,
  },
  playerMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 2,
  },
  metaText: {
    fontSize: 12,
    fontWeight: '600' as const,
  },
  connectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  connectionText: {
    fontSize: 11,
    fontWeight: '500' as const,
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
  warningRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
  },
  warningText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500' as const,
  },
  deckList: {
    gap: 12,
    paddingTop: 12,
    paddingRight: 4,
  },
  deckOption: {
    width: 124,
    padding: 12,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  deckDot: {
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
  deckMeta: {
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
    flex: 1,
    fontSize: 13,
    fontWeight: '500' as const,
  },
  settingSummaryValue: {
    fontSize: 13,
    fontWeight: '700' as const,
  },
  startButton: {
    borderRadius: 18,
    overflow: 'hidden',
  },
  startButtonDisabled: {
    opacity: 0.75,
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
  waitingBanner: {
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingVertical: 18,
    alignItems: 'center',
  },
  waitingBannerText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: 'rgba(255,255,255,0.92)',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    maxHeight: '80%',
    borderRadius: 24,
    padding: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
  },
  modalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  modalLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  modalLabel: {
    fontSize: 15,
    fontWeight: '500' as const,
  },
  optionGroup: {
    flexDirection: 'row',
    gap: 8,
  },
  optionButton: {
    minWidth: 50,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
  },
  optionText: {
    fontSize: 14,
    fontWeight: '600' as const,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  toggleMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  toggleState: {
    fontSize: 13,
    fontWeight: '700' as const,
  },
  toggleTrack: {
    width: 48,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
  },
  toggleThumb: {
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
    alignItems: 'center',
    paddingVertical: 14,
    marginTop: 12,
  },
  doneButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#fff',
  },
});
