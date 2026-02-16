import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Users, Plus, X, Play, Settings, Clock, Target, AlertCircle } from 'lucide-react-native';
import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal, TextInput, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import QRCodeDisplay from '@/components/QRCodeDisplay';
import { useArena } from '@/context/ArenaContext';
import { useFlashQuest } from '@/context/FlashQuestContext';
import { useTheme } from '@/context/ThemeContext';
import { ArenaSettings } from '@/types/flashcard';

const ARENA_ACCENT_LIGHT = '#f97316';
const ARENA_ACCENT_DARK = '#f59e0b';

type RoundsOption = 5 | 10 | 20;
type TimerOption = 0 | 5 | 10;

export default function ArenaLobbyScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ joinMode?: string; playerName?: string; roomCode?: string }>();
  const { theme, isDark } = useTheme();
  const arenaAccent = isDark ? ARENA_ACCENT_DARK : ARENA_ACCENT_LIGHT;
  const { decks } = useFlashQuest();
  const {
    lobby,
    canStartGame,
    createRoom,
    addPlayer,
    removePlayer,
    selectDeck,
    updateSettings,
    saveLastSettings,
    clearLobby,
  } = useArena();

  const [showAddPlayerModal, setShowAddPlayerModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [newPlayerName, setNewPlayerName] = useState('');

  useEffect(() => {
    if (params.joinMode === 'true' && params.playerName) {
      if (!lobby) {
        createRoom(params.playerName);
      } else {
        addPlayer(params.playerName);
      }
    }
  }, []);

  const selectedDeck = useMemo(() => {
    if (!lobby?.deckId) return null;
    return decks.find(d => d.id === lobby.deckId);
  }, [decks, lobby?.deckId]);

  const qrData = useMemo(() => {
    if (!lobby) return '';
    return JSON.stringify({
      app: 'flashquest',
      type: 'arena',
      roomCode: lobby.roomCode,
    });
  }, [lobby]);

  const handleAddPlayer = () => {
    if (!newPlayerName.trim()) return;
    addPlayer(newPlayerName.trim());
    setNewPlayerName('');
    setShowAddPlayerModal(false);
  };

  const handleRemovePlayer = (playerId: string) => {
    const player = lobby?.players.find(p => p.id === playerId);
    if (player?.isHost) {
      Alert.alert('Cannot Remove', 'The host cannot be removed from the lobby.');
      return;
    }
    removePlayer(playerId);
  };

  const handleStartGame = () => {
    if (!canStartGame || !lobby?.deckId) return;
    saveLastSettings(lobby.deckId, lobby.settings);
    router.push({
      pathname: '/arena-session' as any,
      params: { lobbyState: JSON.stringify(lobby) },
    });
  };

  const handleBack = () => {
    Alert.alert(
      'Leave Lobby',
      'Are you sure you want to leave? The lobby will be closed.',
      [
        { text: 'Stay', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: () => {
            clearLobby();
            router.back();
          },
        },
      ]
    );
  };

  const handleSettingsUpdate = (key: keyof ArenaSettings, value: number | boolean) => {
    updateSettings({ [key]: value });
  };

  if (!lobby) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <SafeAreaView style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: theme.text }]}>Loading lobby...</Text>
        </SafeAreaView>
      </View>
    );
  }

  const smallDeckWarning = selectedDeck && selectedDeck.flashcards.length < 8;

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
          <TouchableOpacity
            style={styles.backButton}
            onPress={handleBack}
            activeOpacity={0.7}
          >
            <ArrowLeft color="#fff" size={24} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Arena Lobby</Text>
          <TouchableOpacity
            style={styles.settingsButton}
            onPress={() => setShowSettingsModal(true)}
            activeOpacity={0.7}
          >
            <Settings color="#fff" size={22} />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.codeSection, { backgroundColor: isDark ? 'rgba(30, 41, 59, 0.95)' : theme.cardBackground }]}>
            <Text style={[styles.codeLabel, { color: theme.textSecondary }]}>Room Code</Text>
            <Text style={[styles.roomCode, { color: theme.text }]}>{lobby.roomCode}</Text>
            <View style={styles.qrContainer}>
              <QRCodeDisplay data={qrData} size={140} />
            </View>
            <Text style={[styles.qrNote, { color: theme.textTertiary }]}>
              QR code (display only) • Offline lobby
            </Text>
          </View>

          <View style={[styles.playersSection, { backgroundColor: isDark ? 'rgba(30, 41, 59, 0.95)' : theme.cardBackground }]}>
            <View style={styles.playersSectionHeader}>
              <View style={styles.playersHeaderLeft}>
                <Users color={arenaAccent} size={20} />
                <Text style={[styles.sectionTitle, { color: theme.text }]}>
                  Players ({lobby.players.length})
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.addPlayerButton, { backgroundColor: arenaAccent }]}
                onPress={() => setShowAddPlayerModal(true)}
                activeOpacity={0.7}
              >
                <Plus color="#fff" size={18} />
                <Text style={styles.addPlayerText}>Add</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.playersList}>
              {lobby.players.map((player, index) => (
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
                    <Text style={[styles.playerName, { color: theme.text }]} numberOfLines={1}>
                      {player.name}
                    </Text>
                    {player.isHost && (
                      <Text style={[styles.hostBadge, { color: theme.warning }]}>Host</Text>
                    )}
                  </View>
                  {!player.isHost && (
                    <TouchableOpacity
                      style={styles.removeButton}
                      onPress={() => handleRemovePlayer(player.id)}
                      activeOpacity={0.7}
                    >
                      <X color={theme.textTertiary} size={18} />
                    </TouchableOpacity>
                  )}
                </View>
              ))}
            </View>

            {lobby.players.length < 2 && (
              <View style={[styles.warningBox, { backgroundColor: theme.warning + '20' }]}>
                <AlertCircle color={theme.warning} size={16} />
                <Text style={[styles.warningText, { color: theme.warning }]}>
                  Add at least 2 players to start
                </Text>
              </View>
            )}
          </View>

          <View style={[styles.deckSection, { backgroundColor: isDark ? 'rgba(30, 41, 59, 0.95)' : theme.cardBackground }]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Select Deck</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.deckList}
            >
              {decks.map((deck) => (
                <TouchableOpacity
                  key={deck.id}
                  style={[
                    styles.deckOption,
                    { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : theme.background },
                    lobby.deckId === deck.id && { borderColor: arenaAccent, borderWidth: 2 },
                  ]}
                  onPress={() => selectDeck(deck.id)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.deckColorDot, { backgroundColor: deck.color }]} />
                  <Text style={[styles.deckName, { color: theme.text }]} numberOfLines={1}>
                    {deck.name}
                  </Text>
                  <Text style={[styles.deckCardCount, { color: theme.textSecondary }]}>
                    {deck.flashcards.length} cards
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            {smallDeckWarning && (
              <View style={[styles.warningBox, { backgroundColor: theme.warning + '20', marginTop: 12 }]}>
                <AlertCircle color={theme.warning} size={16} />
                <Text style={[styles.warningText, { color: theme.warning }]}>
                  Best with 8+ cards for variety
                </Text>
              </View>
            )}
            {!lobby.deckId && (
              <View style={[styles.warningBox, { backgroundColor: theme.error + '20', marginTop: 12 }]}>
                <AlertCircle color={theme.error} size={16} />
                <Text style={[styles.warningText, { color: theme.error }]}>
                  Select a deck to continue
                </Text>
              </View>
            )}
          </View>

          <View style={[styles.settingsPreview, { backgroundColor: isDark ? 'rgba(30, 41, 59, 0.95)' : theme.cardBackground }]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Game Settings</Text>
            <View style={styles.settingsGrid}>
              <View style={styles.settingItem}>
                <Target color={theme.textSecondary} size={16} />
                <Text style={[styles.settingLabel, { color: theme.textSecondary }]}>Rounds</Text>
                <Text style={[styles.settingValue, { color: theme.text }]}>{lobby.settings.rounds}</Text>
              </View>
              <View style={styles.settingItem}>
                <Clock color={theme.textSecondary} size={16} />
                <Text style={[styles.settingLabel, { color: theme.textSecondary }]}>Timer</Text>
                <Text style={[styles.settingValue, { color: theme.text }]}>
                  {lobby.settings.timerSeconds === 0 ? 'Off' : `${lobby.settings.timerSeconds}s`}
                </Text>
              </View>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.startButton, !canStartGame && styles.disabledButton]}
            onPress={handleStartGame}
            activeOpacity={0.85}
            disabled={!canStartGame}
          >
            <LinearGradient
              colors={canStartGame ? ['#10b981', '#059669'] : ['#9ca3af', '#6b7280']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.startButtonGradient}
            >
              <Play color="#fff" size={24} fill="#fff" />
              <Text style={styles.startButtonText}>Start Game</Text>
            </LinearGradient>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>

      <Modal
        visible={showAddPlayerModal}
        animationType="fade"
        transparent
        onRequestClose={() => setShowAddPlayerModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: isDark ? '#1e293b' : theme.cardBackground }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Add Player</Text>
            <TextInput
              style={[styles.modalInput, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
              placeholder="Player name"
              placeholderTextColor={theme.textTertiary}
              value={newPlayerName}
              onChangeText={setNewPlayerName}
              autoFocus
              maxLength={20}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: theme.background }]}
                onPress={() => {
                  setNewPlayerName('');
                  setShowAddPlayerModal(false);
                }}
              >
                <Text style={[styles.modalButtonText, { color: theme.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonPrimary]}
                onPress={handleAddPlayer}
                disabled={!newPlayerName.trim()}
              >
                <LinearGradient
                  colors={[theme.arenaGradient[0], theme.arenaGradient[1]]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.modalButtonGradient}
                >
                  <Text style={styles.modalButtonTextPrimary}>Add</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
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
                        lobby.settings.rounds === val && { backgroundColor: arenaAccent },
                      ]}
                      onPress={() => handleSettingsUpdate('rounds', val)}
                      activeOpacity={0.7}
                    >
                      <Text style={[
                        styles.optionText,
                        { color: lobby.settings.rounds === val ? '#fff' : theme.text },
                      ]}>
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
                        lobby.settings.timerSeconds === val && { backgroundColor: arenaAccent },
                      ]}
                      onPress={() => handleSettingsUpdate('timerSeconds', val)}
                      activeOpacity={0.7}
                    >
                      <Text style={[
                        styles.optionText,
                        { color: lobby.settings.timerSeconds === val ? '#fff' : theme.text },
                      ]}>
                        {val === 0 ? 'Off' : val}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <TouchableOpacity
                style={styles.toggleRow}
                onPress={() => handleSettingsUpdate('showExplanationsAtEnd', !lobby.settings.showExplanationsAtEnd)}
                activeOpacity={0.7}
              >
                <Text style={[styles.settingRowLabel, { color: theme.text }]}>
                  Show Explanations at End
                </Text>
                <View style={[
                  styles.toggle,
                  { backgroundColor: lobby.settings.showExplanationsAtEnd ? arenaAccent : theme.border },
                ]}>
                  <View style={[
                    styles.toggleKnob,
                    { transform: [{ translateX: lobby.settings.showExplanationsAtEnd ? 20 : 2 }] },
                  ]} />
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
  },
  loadingText: {
    fontSize: 16,
    fontWeight: '500' as const,
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
    marginBottom: 20,
  },
  qrContainer: {
    marginBottom: 12,
  },
  qrNote: {
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
  addPlayerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  addPlayerText: {
    fontSize: 14,
    fontWeight: '600' as const,
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
  playerName: {
    fontSize: 15,
    fontWeight: '600' as const,
  },
  hostBadge: {
    fontSize: 12,
    fontWeight: '600' as const,
    marginTop: 2,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 24,
    padding: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    marginBottom: 20,
  },
  modalInput: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    fontSize: 16,
    marginBottom: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    borderRadius: 14,
    overflow: 'hidden',
  },
  modalButtonPrimary: {
    overflow: 'hidden',
  },
  modalButtonGradient: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    textAlign: 'center',
    paddingVertical: 14,
  },
  modalButtonTextPrimary: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#fff',
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
