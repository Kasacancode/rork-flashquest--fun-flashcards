import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { ArrowLeft, Swords, Users, Trophy, Target, Wifi, WifiOff } from 'lucide-react-native';
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal, TextInput, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useArena } from '@/context/ArenaContext';
import { useTheme } from '@/context/ThemeContext';

const ARENA_ACCENT_LIGHT = '#f97316';
const ARENA_ACCENT_DARK = '#f59e0b';

export default function ArenaMenuScreen() {
  const router = useRouter();
  const { theme, isDark } = useTheme();
  const {
    leaderboard,
    createRoom,
    joinRoom,
    roomCode,
    isConnecting,
    connectionError,
    clearError,
    disconnect,
    playerName: savedName,
  } = useArena();
  const arenaAccent = isDark ? ARENA_ACCENT_DARK : ARENA_ACCENT_LIGHT;

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [codeInput, setCodeInput] = useState('');
  const [pendingAction, setPendingAction] = useState<'create' | 'join' | null>(null);

  useEffect(() => {
    if (savedName) setNameInput(savedName);
  }, [savedName]);

  useEffect(() => {
    if (roomCode && pendingAction) {
      setPendingAction(null);
      setShowCreateModal(false);
      setShowJoinModal(false);
      router.push('/arena-lobby' as any);
    }
  }, [roomCode, pendingAction]);

  useEffect(() => {
    if (connectionError && pendingAction) {
      Alert.alert('Connection Error', connectionError);
      clearError();
      setPendingAction(null);
    }
  }, [connectionError, pendingAction]);

  const handleCreateRoom = () => {
    setNameInput(savedName || '');
    setShowCreateModal(true);
  };

  const handleJoinRoom = () => {
    setNameInput(savedName || '');
    setCodeInput('');
    setShowJoinModal(true);
  };

  const handleConfirmCreate = () => {
    if (!nameInput.trim() || isConnecting) return;
    setPendingAction('create');
    createRoom(nameInput.trim());
  };

  const handleConfirmJoin = () => {
    if (!nameInput.trim() || codeInput.length !== 6 || isConnecting) return;
    setPendingAction('join');
    joinRoom(codeInput.trim(), nameInput.trim());
  };

  const handleRejoin = () => {
    router.push('/arena-lobby' as any);
  };

  const handleDisconnect = () => {
    disconnect();
  };

  const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

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
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <ArrowLeft color="#fff" size={24} />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Swords color="#fff" size={28} />
            <Text style={styles.headerTitle}>Battle</Text>
          </View>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.heroSection}>
            <Text style={styles.heroTitle}>Online Battle</Text>
            <Text style={styles.heroSubtitle}>
              Challenge friends in real-time multiplayer quiz battles!
            </Text>
          </View>

          {roomCode && (
            <View style={[styles.activeRoomBanner, { backgroundColor: 'rgba(16, 185, 129, 0.25)' }]}>
              <Wifi color="#10b981" size={20} />
              <View style={styles.activeRoomInfo}>
                <Text style={styles.activeRoomLabel}>Active Room</Text>
                <Text style={styles.activeRoomCode}>{roomCode}</Text>
              </View>
              <View style={styles.activeRoomActions}>
                <TouchableOpacity
                  style={[styles.activeRoomButton, { backgroundColor: '#10b981' }]}
                  onPress={handleRejoin}
                  activeOpacity={0.8}
                >
                  <Text style={styles.activeRoomButtonText}>Rejoin</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.activeRoomButton, { backgroundColor: 'rgba(239, 68, 68, 0.8)' }]}
                  onPress={handleDisconnect}
                  activeOpacity={0.8}
                >
                  <Text style={styles.activeRoomButtonText}>Leave</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          <View style={styles.buttonsContainer}>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleCreateRoom}
              activeOpacity={0.85}
              disabled={!!roomCode}
            >
              <LinearGradient
                colors={roomCode ? ['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.05)'] : ['rgba(255,255,255,0.25)', 'rgba(255,255,255,0.1)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.buttonGradient}
              >
                <Users color="#fff" size={28} />
                <View style={styles.buttonTextContainer}>
                  <Text style={[styles.buttonTitle, roomCode && { opacity: 0.5 }]}>Create Room</Text>
                  <Text style={[styles.buttonSubtitle, roomCode && { opacity: 0.5 }]}>Host a new multiplayer game</Text>
                </View>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={handleJoinRoom}
              activeOpacity={0.85}
              disabled={!!roomCode}
            >
              <View style={[styles.buttonGradient, { backgroundColor: roomCode ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.15)' }]}>
                <Target color="#fff" size={28} />
                <View style={styles.buttonTextContainer}>
                  <Text style={[styles.buttonTitle, roomCode && { opacity: 0.5 }]}>Join Room</Text>
                  <Text style={[styles.buttonSubtitle, roomCode && { opacity: 0.5 }]}>Enter a 6-digit room code</Text>
                </View>
              </View>
            </TouchableOpacity>
          </View>

          <View style={[styles.leaderboardSection, { backgroundColor: isDark ? 'rgba(30, 41, 59, 0.95)' : theme.cardBackground }]}>
            <View style={styles.leaderboardHeader}>
              <Trophy color={arenaAccent} size={22} />
              <Text style={[styles.leaderboardTitle, { color: theme.text }]}>Battle History</Text>
            </View>

            {leaderboard.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                  No games played yet. Start a match to see results here!
                </Text>
              </View>
            ) : (
              <View style={styles.leaderboardList}>
                {leaderboard.slice(0, 5).map((entry) => (
                  <View
                    key={entry.id}
                    style={[styles.leaderboardEntry, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : theme.background }]}
                  >
                    <View style={styles.entryMain}>
                      <Text style={[styles.entryWinner, { color: theme.text }]} numberOfLines={1}>
                        🏆 {entry.winnerName}
                      </Text>
                      <Text style={[styles.entryDeck, { color: theme.textSecondary }]} numberOfLines={1}>
                        {entry.deckName}
                      </Text>
                    </View>
                    <View style={styles.entryStats}>
                      <View style={styles.entryStat}>
                        <Users color={theme.textTertiary} size={12} />
                        <Text style={[styles.entryStatText, { color: theme.textSecondary }]}>
                          {entry.playerCount}
                        </Text>
                      </View>
                      <View style={styles.entryStat}>
                        <Target color={theme.textTertiary} size={12} />
                        <Text style={[styles.entryStatText, { color: theme.textSecondary }]}>
                          {Math.round(entry.winnerAccuracy * 100)}%
                        </Text>
                      </View>
                      <Text style={[styles.entryDate, { color: theme.textTertiary }]}>
                        {formatDate(entry.completedAt)}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>

          <View style={[styles.infoCard, { backgroundColor: isDark ? 'rgba(30, 41, 59, 0.95)' : theme.cardBackground }]}>
            <Text style={[styles.infoTitle, { color: theme.text }]}>How to Play</Text>
            <View style={styles.infoList}>
              <Text style={[styles.infoItem, { color: theme.textSecondary }]}>
                1. Create a room and share the 6-digit code
              </Text>
              <Text style={[styles.infoItem, { color: theme.textSecondary }]}>
                2. Friends join using the code on their device
              </Text>
              <Text style={[styles.infoItem, { color: theme.textSecondary }]}>
                3. Host selects a deck and starts the game
              </Text>
              <Text style={[styles.infoItem, { color: theme.textSecondary }]}>
                4. Everyone answers simultaneously in real-time
              </Text>
              <Text style={[styles.infoItem, { color: theme.textSecondary }]}>
                5. Compete for the highest score!
              </Text>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>

      <Modal
        visible={showCreateModal}
        animationType="fade"
        transparent
        onRequestClose={() => { if (!isConnecting) setShowCreateModal(false); }}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: isDark ? '#1e293b' : theme.cardBackground }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Your Name</Text>
            <TextInput
              style={[styles.modalInput, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
              placeholder="Enter your name"
              placeholderTextColor={theme.textTertiary}
              value={nameInput}
              onChangeText={setNameInput}
              autoFocus
              maxLength={20}
              editable={!isConnecting}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: theme.background }]}
                onPress={() => setShowCreateModal(false)}
                disabled={isConnecting}
              >
                <Text style={[styles.modalButtonText, { color: theme.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonPrimary]}
                onPress={handleConfirmCreate}
                disabled={!nameInput.trim() || isConnecting}
              >
                <LinearGradient
                  colors={[theme.arenaGradient[0], theme.arenaGradient[1]]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.modalButtonGradient}
                >
                  {isConnecting ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.modalButtonTextPrimary}>Create</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showJoinModal}
        animationType="fade"
        transparent
        onRequestClose={() => { if (!isConnecting) setShowJoinModal(false); }}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: isDark ? '#1e293b' : theme.cardBackground }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Join Room</Text>
            <TextInput
              style={[styles.modalInput, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
              placeholder="Your name"
              placeholderTextColor={theme.textTertiary}
              value={nameInput}
              onChangeText={setNameInput}
              maxLength={20}
              editable={!isConnecting}
            />
            <TextInput
              style={[styles.modalInput, styles.codeInput, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
              placeholder="000000"
              placeholderTextColor={theme.textTertiary}
              value={codeInput}
              onChangeText={(text) => setCodeInput(text.replace(/[^0-9]/g, '').slice(0, 6))}
              keyboardType="number-pad"
              maxLength={6}
              editable={!isConnecting}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: theme.background }]}
                onPress={() => setShowJoinModal(false)}
                disabled={isConnecting}
              >
                <Text style={[styles.modalButtonText, { color: theme.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonPrimary]}
                onPress={handleConfirmJoin}
                disabled={!nameInput.trim() || codeInput.length !== 6 || isConnecting}
              >
                <LinearGradient
                  colors={[theme.arenaGradient[0], theme.arenaGradient[1]]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.modalButtonGradient}
                >
                  {isConnecting ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.modalButtonTextPrimary}>Join</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
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
    fontSize: 24,
    fontWeight: '700' as const,
    color: '#fff',
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
  heroSection: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '800' as const,
    color: '#fff',
    marginBottom: 8,
    textAlign: 'center',
  },
  heroSubtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    lineHeight: 22,
  },
  activeRoomBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
    gap: 12,
  },
  activeRoomInfo: {
    flex: 1,
  },
  activeRoomLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    fontWeight: '500' as const,
  },
  activeRoomCode: {
    fontSize: 20,
    fontWeight: '800' as const,
    color: '#fff',
    letterSpacing: 4,
  },
  activeRoomActions: {
    flexDirection: 'row',
    gap: 8,
  },
  activeRoomButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  activeRoomButtonText: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: '#fff',
  },
  buttonsContainer: {
    gap: 12,
    marginBottom: 24,
  },
  primaryButton: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  secondaryButton: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  buttonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    gap: 16,
  },
  buttonTextContainer: {
    flex: 1,
  },
  buttonTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#fff',
    marginBottom: 2,
  },
  buttonSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  leaderboardSection: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
  },
  leaderboardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  leaderboardTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
  },
  emptyState: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  leaderboardList: {
    gap: 10,
  },
  leaderboardEntry: {
    borderRadius: 12,
    padding: 14,
  },
  entryMain: {
    marginBottom: 8,
  },
  entryWinner: {
    fontSize: 15,
    fontWeight: '600' as const,
    marginBottom: 2,
  },
  entryDeck: {
    fontSize: 13,
  },
  entryStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  entryStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  entryStatText: {
    fontSize: 12,
  },
  entryDate: {
    fontSize: 12,
    marginLeft: 'auto' as const,
  },
  infoCard: {
    borderRadius: 20,
    padding: 20,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    marginBottom: 12,
  },
  infoList: {
    gap: 8,
  },
  infoItem: {
    fontSize: 14,
    lineHeight: 20,
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
    textAlign: 'center',
    marginBottom: 20,
  },
  modalInput: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    fontSize: 16,
    marginBottom: 12,
  },
  codeInput: {
    textAlign: 'center',
    fontSize: 24,
    letterSpacing: 8,
    fontWeight: '700' as const,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
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
    justifyContent: 'center',
    minHeight: 48,
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
});
