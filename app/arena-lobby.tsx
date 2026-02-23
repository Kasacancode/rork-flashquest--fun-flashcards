import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { ArrowLeft, Users, X, Play, Settings, Clock, Target, AlertCircle, Wifi, WifiOff, Copy, Check } from 'lucide-react-native';
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal, Alert, Platform, Animated } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useArena } from '@/context/ArenaContext';
import { useFlashQuest } from '@/context/FlashQuestContext';
import { useTheme } from '@/context/ThemeContext';
import { generateOptions, shuffleArray } from '@/utils/questUtils';
import { logger } from '@/utils/logger';

const ARENA_ACCENT_LIGHT = '#f97316';
const ARENA_ACCENT_DARK = '#f59e0b';

type RoundsOption = 5 | 10 | 20;
type TimerOption = 0 | 5 | 10;

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
    isStartingGame,
    selectDeck,
    updateSettings,
    removePlayer,
    startGame,
    disconnect,
    connectionError,
    clearError,
  } = useArena();

  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const prevStatus = useRef<string | null>(null);

  useEffect(() => {
    if (room?.status === 'playing' && prevStatus.current !== 'playing') {
      logger.log('[Lobby] Game started, navigating to session');
      router.replace('/arena-session' as any);
    }
    prevStatus.current = room?.status ?? null;
  }, [room?.status]);

  useEffect(() => {
    if (!roomCode && !room) {
      router.replace('/arena' as any);
    }
  }, [roomCode, room]);

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
  }, [connectionError, clearError]);

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
    Alert.alert(
      'Leave Room',
      'Are you sure you want to leave?',
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
      ]
    );
  }, [isHost, disconnect, router]);

  const handleSettingsUpdate = useCallback((key: string, value: number | boolean) => {
    updateSettings({ [key]: value });
  }, [updateSettings]);

  const selectedDeck = useMemo(() => {
    if (!room?.deckId) return null;
    return decks.find(d => d.id === room.deckId);
  }, [decks, room?.deckId]);

  const smallDeckWarning = selectedDeck && selectedDeck.flashcards.length < 8;

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
          <TouchableOpacity style={styles.backButton} onPress={handleBack} activeOpacity={0.7}>
            <ArrowLeft color="#fff" size={24} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{isHost ? 'Your Lobby' : 'Battle Lobby'}</Text>
          {isHost ? (
            <TouchableOpacity style={styles.settingsButton} onPress={() => setShowSettingsModal(true)} activeOpacity={0.7}>
              <Settings color="#fff" size={22} />
            </TouchableOpacity>
          ) : (
            <View style={styles.headerSpacer} />
          )}
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <TouchableOpacity
            style={[styles.codeSection, { backgroundColor: isDark ? 'rgba(30, 41, 59, 0.95)' : theme.cardBackground }]}
            onPress={handleCopyCode}
            activeOpacity={0.7}
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
              Share this code with friends to join
            </Text>
          </TouchableOpacity>

          <View style={[styles.playersSection, { backgroundColor: isDark ? 'rgba(30, 41, 59, 0.95)' : theme.cardBackground }]}>
            <View style={styles.playersSectionHeader}>
              <View style={styles.playersHeaderLeft}>
                <Users color={arenaAccent} size={20} />
                <Text style={[styles.sectionTitle, { color: theme.text }]}>
                  Players ({room.players.length})
                </Text>
              </View>
              <View style={[styles.liveBadge, { backgroundColor: '#10b981' }]}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>Live</Text>
              </View>
            </View>

            <View style={styles.playersList}>
              {room.players.map((player: any) => (
                <View
                  key={player.id}
                  style={[styles.playerCard, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : theme.background }]}
                >
                  <View style={[styles.playerAvatar, { backgroundColor: player.color }]}>
                    <Text style={styles.playerInitial}>
                      {player.name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.playerInfo}>
                    <View style={styles.playerNameRow}>
                      <Text style={[styles.playerName, { color: theme.text }]} numberOfLines={1}>
                        {player.name}
                      </Text>
                      {player.id === playerId && (
                        <Text style={[styles.youBadge, { color: theme.primary }]}>(You)</Text>
                      )}
                    </View>
                    <View style={styles.playerMeta}>
                      {player.isHost && (
                        <Text style={[styles.hostBadge, { color: theme.warning }]}>Host</Text>
                      )}
                      {player.role === 'spectator' && (
                        <Text style={[styles.hostBadge, { color: '#8b5cf6' }]}>Spectator</Text>
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
            </View>

            {room.players.length < 2 && (
              <View style={[styles.warningBox, { backgroundColor: theme.warning + '20' }]}>
                <AlertCircle color={theme.warning} size={16} />
                <Text style={[styles.warningText, { color: theme.warning }]}>
                  Waiting for more players to join...
                </Text>
              </View>
            )}
          </View>

          {isHost ? (
            <View style={[styles.deckSection, { backgroundColor: isDark ? 'rgba(30, 41, 59, 0.95)' : theme.cardBackground }]}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Select Deck</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.deckList}>
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
              {!room.deckId && (
                <View style={[styles.warningBox, { backgroundColor: theme.error + '20', marginTop: 12 }]}>
                  <AlertCircle color={theme.error} size={16} />
                  <Text style={[styles.warningText, { color: theme.error }]}>Select a deck to continue</Text>
                </View>
              )}
            </View>
          ) : (
            <View style={[styles.deckSection, { backgroundColor: isDark ? 'rgba(30, 41, 59, 0.95)' : theme.cardBackground }]}>
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

          <View style={[styles.settingsPreview, { backgroundColor: isDark ? 'rgba(30, 41, 59, 0.95)' : theme.cardBackground }]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Game Settings</Text>
            <View style={styles.settingsGrid}>
              <View style={styles.settingItem}>
                <Target color={theme.textSecondary} size={16} />
                <Text style={[styles.settingLabel, { color: theme.textSecondary }]}>Rounds</Text>
                <Text style={[styles.settingValue, { color: theme.text }]}>{room.settings.rounds}</Text>
              </View>
              <View style={styles.settingItem}>
                <Clock color={theme.textSecondary} size={16} />
                <Text style={[styles.settingLabel, { color: theme.textSecondary }]}>Timer</Text>
                <Text style={[styles.settingValue, { color: theme.text }]}>
                  {room.settings.timerSeconds === 0 ? 'Off' : `${room.settings.timerSeconds}s`}
                </Text>
              </View>
            </View>
          </View>

          {isHost ? (
            <TouchableOpacity
              style={[styles.startButton, (!canStartGame || isStartingGame) && styles.disabledButton]}
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
                <Play color="#fff" size={24} fill="#fff" />
                <Text style={styles.startButtonText}>
                  {isStartingGame ? 'Starting...' : 'Start Game'}
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
        visible={showSettingsModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowSettingsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.settingsModalContent, { backgroundColor: isDark ? '#1e293b' : theme.cardBackground }]}>
            <View style={styles.settingsModalHeader}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>Game Settings</Text>
              <TouchableOpacity onPress={() => setShowSettingsModal(false)}>
                <X color={theme.textSecondary} size={24} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.settingRow}>
                <View style={styles.settingLabelRow}>
                  <Target color={theme.textSecondary} size={18} />
                  <Text style={[styles.settingRowLabel, { color: theme.text }]}>Rounds</Text>
                </View>
                <View style={styles.optionGroup}>
                  {([5, 10, 20] as RoundsOption[]).map((val) => (
                    <TouchableOpacity
                      key={val}
                      style={[
                        styles.optionButton,
                        { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : theme.background },
                        room.settings.rounds === val && { backgroundColor: arenaAccent },
                      ]}
                      onPress={() => handleSettingsUpdate('rounds', val)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.optionText, { color: room.settings.rounds === val ? '#fff' : theme.text }]}>
                        {val}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.settingRow}>
                <View style={styles.settingLabelRow}>
                  <Clock color={theme.textSecondary} size={18} />
                  <Text style={[styles.settingRowLabel, { color: theme.text }]}>Timer (sec)</Text>
                </View>
                <View style={styles.optionGroup}>
                  {([0, 5, 10] as TimerOption[]).map((val) => (
                    <TouchableOpacity
                      key={val}
                      style={[
                        styles.optionButton,
                        { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : theme.background },
                        room.settings.timerSeconds === val && { backgroundColor: arenaAccent },
                      ]}
                      onPress={() => handleSettingsUpdate('timerSeconds', val)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.optionText, { color: room.settings.timerSeconds === val ? '#fff' : theme.text }]}>
                        {val === 0 ? 'Off' : val}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <TouchableOpacity
                style={styles.toggleRow}
                onPress={() => handleSettingsUpdate('showExplanationsAtEnd', !room.settings.showExplanationsAtEnd)}
                activeOpacity={0.7}
              >
                <Text style={[styles.settingRowLabel, { color: theme.text }]}>Show Explanations at End</Text>
                <View style={[styles.toggle, { backgroundColor: room.settings.showExplanationsAtEnd ? arenaAccent : theme.border }]}>
                  <View style={[styles.toggleKnob, { transform: [{ translateX: room.settings.showExplanationsAtEnd ? 20 : 2 }] }]} />
                </View>
              </TouchableOpacity>
            </ScrollView>

            <TouchableOpacity
              style={[styles.doneButton, { backgroundColor: arenaAccent }]}
              onPress={() => setShowSettingsModal(false)}
              activeOpacity={0.8}
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
  headerTitle: {
    fontSize: 20,
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
  codeSection: {
    borderRadius: 20,
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
  playersSection: {
    borderRadius: 20,
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
    fontSize: 18,
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
    gap: 6,
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
    borderRadius: 20,
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
    borderRadius: 20,
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
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  settingsModalContent: {
    width: '100%',
    maxWidth: 400,
    maxHeight: '80%',
    borderRadius: 24,
    padding: 24,
  },
  settingsModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  settingLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  settingRowLabel: {
    fontSize: 15,
    fontWeight: '500' as const,
  },
  optionGroup: {
    flexDirection: 'row',
    gap: 8,
  },
  optionButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    minWidth: 50,
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
