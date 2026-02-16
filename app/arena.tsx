import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { ArrowLeft, Swords, Users, Trophy, Target } from 'lucide-react-native';
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useArena } from '@/context/ArenaContext';
import { useTheme } from '@/context/ThemeContext';

const ARENA_ACCENT_LIGHT = '#f97316';
const ARENA_ACCENT_DARK = '#f59e0b';

export default function ArenaMenuScreen() {
  const router = useRouter();
  const { theme, isDark } = useTheme();
  const { leaderboard, createRoom } = useArena();
  const arenaAccent = isDark ? ARENA_ACCENT_DARK : ARENA_ACCENT_LIGHT;

  const [showNameModal, setShowNameModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [playerName, setPlayerName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  

  const handleCreateRoom = () => {
    
    setPlayerName('');
    setShowNameModal(true);
  };

  const handleJoinRoom = () => {
    
    setPlayerName('');
    setRoomCode('');
    setShowJoinModal(true);
  };

  const handleConfirmCreate = () => {
    if (!playerName.trim()) return;
    createRoom(playerName.trim());
    setShowNameModal(false);
    router.push('/arena-lobby' as any);
  };

  const handleConfirmJoin = () => {
    if (!playerName.trim()) return;
    setShowJoinModal(false);
    router.push({
      pathname: '/arena-lobby' as any,
      params: { joinMode: 'true', playerName: playerName.trim(), roomCode: roomCode.trim() },
    });
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
            <Text style={styles.headerTitle}>Arena</Text>
          </View>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.heroSection}>
            <Text style={styles.heroTitle}>Multiplayer Challenge</Text>
            <Text style={styles.heroSubtitle}>
              Compete with friends on the same device in a quiz battle!
            </Text>
          </View>

          <View style={styles.buttonsContainer}>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleCreateRoom}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={['rgba(255,255,255,0.25)', 'rgba(255,255,255,0.1)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.buttonGradient}
              >
                <Users color="#fff" size={28} />
                <View style={styles.buttonTextContainer}>
                  <Text style={styles.buttonTitle}>Create Room</Text>
                  <Text style={styles.buttonSubtitle}>Host a new game session</Text>
                </View>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={handleJoinRoom}
              activeOpacity={0.85}
            >
              <View style={[styles.buttonGradient, { backgroundColor: 'rgba(255,255,255,0.15)' }]}>
                <Target color="#fff" size={28} />
                <View style={styles.buttonTextContainer}>
                  <Text style={styles.buttonTitle}>Join Room</Text>
                  <Text style={styles.buttonSubtitle}>Enter a room code</Text>
                </View>
              </View>
            </TouchableOpacity>
          </View>

          <View style={[styles.leaderboardSection, { backgroundColor: isDark ? 'rgba(30, 41, 59, 0.95)' : theme.cardBackground }]}>
            <View style={styles.leaderboardHeader}>
              <Trophy color={arenaAccent} size={22} />
              <Text style={[styles.leaderboardTitle, { color: theme.text }]}>Recent Games</Text>
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
                1. Create a room and share the code with friends
              </Text>
              <Text style={[styles.infoItem, { color: theme.textSecondary }]}>
                2. Add players using the &quot;Add Player&quot; button
              </Text>
              <Text style={[styles.infoItem, { color: theme.textSecondary }]}>
                3. Select a deck and customize game settings
              </Text>
              <Text style={[styles.infoItem, { color: theme.textSecondary }]}>
                4. Take turns answering questions on the same device
              </Text>
              <Text style={[styles.infoItem, { color: theme.textSecondary }]}>
                5. Compete for the highest score!
              </Text>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>

      <Modal
        visible={showNameModal}
        animationType="fade"
        transparent
        onRequestClose={() => setShowNameModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: isDark ? '#1e293b' : theme.cardBackground }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Enter Your Name</Text>
            <TextInput
              style={[styles.modalInput, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
              placeholder="Your name"
              placeholderTextColor={theme.textTertiary}
              value={playerName}
              onChangeText={setPlayerName}
              autoFocus
              maxLength={20}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: theme.background }]}
                onPress={() => setShowNameModal(false)}
              >
                <Text style={[styles.modalButtonText, { color: theme.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonPrimary]}
                onPress={handleConfirmCreate}
                disabled={!playerName.trim()}
              >
                <LinearGradient
                  colors={[theme.arenaGradient[0], theme.arenaGradient[1]]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.modalButtonGradient}
                >
                  <Text style={styles.modalButtonTextPrimary}>Create</Text>
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
        onRequestClose={() => setShowJoinModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: isDark ? '#1e293b' : theme.cardBackground }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Join a Room</Text>
            <TextInput
              style={[styles.modalInput, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
              placeholder="Your name"
              placeholderTextColor={theme.textTertiary}
              value={playerName}
              onChangeText={setPlayerName}
              maxLength={20}
            />
            <TextInput
              style={[styles.modalInput, styles.codeInput, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
              placeholder="Room code (6 digits)"
              placeholderTextColor={theme.textTertiary}
              value={roomCode}
              onChangeText={(text) => setRoomCode(text.replace(/[^0-9]/g, '').slice(0, 6))}
              keyboardType="number-pad"
              maxLength={6}
            />
            <Text style={[styles.joinNote, { color: theme.textTertiary }]}>
              Offline demo: Any code will join the local lobby
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: theme.background }]}
                onPress={() => setShowJoinModal(false)}
              >
                <Text style={[styles.modalButtonText, { color: theme.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonPrimary]}
                onPress={handleConfirmJoin}
                disabled={!playerName.trim()}
              >
                <LinearGradient
                  colors={[theme.arenaGradient[0], theme.arenaGradient[1]]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.modalButtonGradient}
                >
                  <Text style={styles.modalButtonTextPrimary}>Join</Text>
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
    marginLeft: 'auto',
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
  joinNote: {
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 12,
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
