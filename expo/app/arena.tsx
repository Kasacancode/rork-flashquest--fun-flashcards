import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { ArrowLeft, ChevronRight, Flame, Settings, Swords, Target, Trophy, Users, Wifi } from 'lucide-react-native';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useArena } from '@/context/ArenaContext';
import { useTheme } from '@/context/ThemeContext';
import type { ArenaLeaderboardEntry } from '@/types/arena';
import { PLAYER_NAME_MAX_LENGTH, sanitizePlayerName } from '@/utils/playerName';
import { ARENA_LOBBY_ROUTE, PROFILE_ROUTE } from '@/utils/routes';

const ARENA_ACCENT_LIGHT = '#eb6a1a';
const ARENA_ACCENT_DARK = '#fb923c';
const ROOM_CODE_LENGTH = 4;

type BattleStats = {
  wins: number;
  bestStreak: number;
  winRate: string;
};

function normalizeRoomCodeInput(text: string): string {
  return text.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, ROOM_CODE_LENGTH);
}

function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatTimerLabel(timerSeconds: number): string {
  return timerSeconds > 0 ? `${timerSeconds}s timer` : 'No timer';
}

function getBattleStats(entries: ArenaLeaderboardEntry[], savedPlayerName: string): BattleStats {
  if (!savedPlayerName) {
    return {
      wins: 0,
      bestStreak: 0,
      winRate: '--',
    };
  }

  const normalizedSavedName = savedPlayerName.toLowerCase();
  const wins = entries.filter((entry) => entry.winnerName.toLowerCase() === normalizedSavedName).length;

  let currentStreak = 0;
  let bestStreak = 0;

  for (const entry of entries) {
    const isWin = entry.winnerName.toLowerCase() === normalizedSavedName;
    if (isWin) {
      currentStreak += 1;
      if (currentStreak > bestStreak) {
        bestStreak = currentStreak;
      }
    } else {
      currentStreak = 0;
    }
  }

  const winRate = entries.length > 0 ? `${Math.round((wins / entries.length) * 100)}%` : '--';

  return {
    wins,
    bestStreak,
    winRate,
  };
}

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
    isPlayerNameReady,
  } = useArena();

  const arenaAccent = isDark ? ARENA_ACCENT_DARK : ARENA_ACCENT_LIGHT;
  const savedPlayerName = sanitizePlayerName(savedName);
  const hasSavedPlayerName = savedPlayerName.length > 0;

  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [showJoinModal, setShowJoinModal] = useState<boolean>(false);
  const [nameInput, setNameInput] = useState<string>('');
  const [codeInput, setCodeInput] = useState<string>('');
  const [pendingAction, setPendingAction] = useState<'create' | 'join' | null>(null);

  useEffect(() => {
    if (savedPlayerName) {
      setNameInput(savedPlayerName);
    }
  }, [savedPlayerName]);

  useEffect(() => {
    if (roomCode && pendingAction) {
      setPendingAction(null);
      setShowCreateModal(false);
      setShowJoinModal(false);
      router.push(ARENA_LOBBY_ROUTE);
    }
  }, [pendingAction, roomCode, router]);

  useEffect(() => {
    if (connectionError && pendingAction) {
      const nextMessage = connectionError;
      clearError();
      setPendingAction(null);
      setShowCreateModal(false);
      setShowJoinModal(false);
      Alert.alert('Connection Error', nextMessage);
    }
  }, [clearError, connectionError, pendingAction]);

  const recentBattles = useMemo(() => leaderboard.slice(0, 5), [leaderboard]);
  const battleStats = useMemo(() => getBattleStats(leaderboard, savedPlayerName), [leaderboard, savedPlayerName]);

  const backgroundGradient = useMemo(
    () => (
      isDark
        ? ['#172033', '#231820', '#0c1424'] as const
        : ['#fdf5ed', '#ffe3cf', '#ffca9f'] as const
    ),
    [isDark],
  );

  const overlayGlow = useMemo(
    () => (
      isDark
        ? ['rgba(251, 146, 60, 0.16)', 'rgba(251, 146, 60, 0.04)', 'rgba(15, 23, 42, 0)'] as const
        : ['rgba(255, 250, 245, 0.52)', 'rgba(255, 250, 245, 0.12)', 'rgba(255, 250, 245, 0)'] as const
    ),
    [isDark],
  );

  const lowerBlend = useMemo(
    () => (
      isDark
        ? ['rgba(59, 130, 246, 0)', 'rgba(59, 130, 246, 0.08)', 'rgba(15, 23, 42, 0.34)'] as const
        : ['rgba(255, 248, 241, 0)', 'rgba(255, 248, 241, 0.12)', 'rgba(255, 248, 241, 0.22)'] as const
    ),
    [isDark],
  );

  const statSurface = isDark ? 'rgba(12, 19, 33, 0.82)' : 'rgba(255, 250, 246, 0.8)';
  const primarySurface = isDark ? 'rgba(7, 13, 27, 0.9)' : 'rgba(255, 251, 247, 0.94)';
  const secondarySurface = isDark ? 'rgba(11, 18, 32, 0.88)' : 'rgba(255, 250, 246, 0.9)';
  const controlSurface = isDark ? 'rgba(17, 24, 39, 0.42)' : 'rgba(255, 251, 247, 0.42)';
  const insetSurface = isDark ? 'rgba(255, 255, 255, 0.065)' : 'rgba(235, 106, 26, 0.06)';
  const surfaceBorderColor = isDark ? 'rgba(148, 163, 184, 0.14)' : 'rgba(235, 106, 26, 0.08)';
  const subtleBorderColor = isDark ? 'rgba(148, 163, 184, 0.1)' : 'rgba(235, 106, 26, 0.065)';
  const startGradient = isDark ? ['#fb923c', '#ea580c'] as const : ['#f28a35', '#ec5f0f'] as const;
  const disabledGradient = isDark ? ['rgba(255, 255, 255, 0.08)', 'rgba(255, 255, 255, 0.04)'] as const : ['rgba(255, 251, 247, 0.4)', 'rgba(255, 251, 247, 0.26)'] as const;
  const modalSurface = isDark ? 'rgba(10, 17, 30, 0.98)' : 'rgba(255, 251, 247, 0.97)';
  const liveRoomSurface = isDark ? 'rgba(16, 185, 129, 0.12)' : 'rgba(236, 253, 245, 0.92)';
  const liveRoomBorder = isDark ? 'rgba(16, 185, 129, 0.26)' : 'rgba(16, 185, 129, 0.18)';
  const mutedTextColor = isDark ? 'rgba(241, 245, 249, 0.9)' : '#8c3412';
  const headerContentColor = isDark ? '#f8fafc' : '#7c2d12';
  const headerButtonBorder = isDark ? 'rgba(148, 163, 184, 0.18)' : 'rgba(235, 106, 26, 0.12)';
  const headerTitleSurface = isDark ? 'rgba(10, 17, 30, 0.42)' : 'rgba(255, 251, 247, 0.34)';
  const headerTitleBorder = isDark ? 'rgba(148, 163, 184, 0.14)' : 'rgba(235, 106, 26, 0.1)';

  const statItems = useMemo(
    () => [
      {
        key: 'wins',
        label: 'Wins',
        value: `${battleStats.wins}`,
        icon: <Trophy color={arenaAccent} size={18} strokeWidth={2.4} />,
      },
      {
        key: 'streak',
        label: 'Best Streak',
        value: `${battleStats.bestStreak}`,
        icon: <Flame color={arenaAccent} size={18} strokeWidth={2.4} />,
      },
      {
        key: 'winRate',
        label: 'Win Rate',
        value: battleStats.winRate,
        icon: <Target color={arenaAccent} size={18} strokeWidth={2.4} />,
      },
    ],
    [arenaAccent, battleStats.bestStreak, battleStats.winRate, battleStats.wins],
  );

  const valueProp = roomCode
    ? 'Your room is live — jump back in and keep control of the match.'
    : 'Head-to-head flashcard rounds for quick calls, clean wins, and real pressure.';

  const setupCopy = roomCode
    ? `Room ${roomCode} is live · deck, rounds, and timer stay with the room`
    : hasSavedPlayerName
      ? 'Host picks the deck, rounds, and timer after the room opens'
      : 'Set your battle profile once · host picks the deck, rounds, and timer';

  const startCardSubtitle = roomCode
    ? 'Jump back into your active room before opening another match.'
    : 'Create a room and invite a friend.';

  const joinCardSubtitle = roomCode
    ? 'Rejoin your current room or leave it before entering a new code.'
    : 'Enter a room code and join the match in seconds.';

  const startIdentityText = hasSavedPlayerName ? savedPlayerName : 'Choose your battle name';
  const joinCardFootnote = roomCode ? 'Your current room is still active' : '';

  const nextCreateName = sanitizePlayerName(nameInput);
  const nextJoinName = hasSavedPlayerName ? savedPlayerName : sanitizePlayerName(nameInput);
  const isArenaActionDisabled = !!roomCode || !isPlayerNameReady;

  const handleCreateRoom = () => {
    if (!isPlayerNameReady || isConnecting) {
      return;
    }

    if (hasSavedPlayerName) {
      setPendingAction('create');
      createRoom(savedPlayerName);
      return;
    }

    setNameInput('');
    setShowCreateModal(true);
  };

  const handleJoinRoom = () => {
    if (!isPlayerNameReady || isConnecting) {
      return;
    }

    setNameInput(savedPlayerName);
    setCodeInput('');
    setShowJoinModal(true);
  };

  const handleConfirmCreate = () => {
    const nextPlayerName = sanitizePlayerName(nameInput);
    if (!nextPlayerName || isConnecting) {
      return;
    }

    setPendingAction('create');
    createRoom(nextPlayerName);
  };

  const handleConfirmJoin = () => {
    const nextPlayerName = hasSavedPlayerName ? savedPlayerName : sanitizePlayerName(nameInput);
    if (!nextPlayerName || codeInput.length !== ROOM_CODE_LENGTH || isConnecting) {
      return;
    }

    setPendingAction('join');
    joinRoom(codeInput.trim().toUpperCase(), nextPlayerName);
  };

  const handleRejoin = () => {
    router.push(ARENA_LOBBY_ROUTE);
  };

  const handleDisconnect = () => {
    disconnect();
  };

  const handleOpenSettings = () => {
    router.push(PROFILE_ROUTE);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]} testID="battle-screen">
      <LinearGradient
        colors={backgroundGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={overlayGlow}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0.8 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <LinearGradient
        colors={lowerBlend}
        start={{ x: 0.2, y: 0.4 }}
        end={{ x: 0.95, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <TouchableOpacity
            style={[
              styles.headerButton,
              {
                backgroundColor: controlSurface,
                borderColor: headerButtonBorder,
                shadowOpacity: isDark ? 0.2 : 0.1,
                shadowRadius: isDark ? 14 : 10,
                elevation: isDark ? 6 : 3,
              },
            ]}
            onPress={() => router.back()}
            activeOpacity={0.7}
            testID="battle-back-button"
          >
            <ArrowLeft color={headerContentColor} size={24} />
          </TouchableOpacity>

          <View
            style={[
              styles.headerTitleContainer,
              {
                backgroundColor: headerTitleSurface,
                borderColor: headerTitleBorder,
              },
            ]}
          >
            <Swords color={headerContentColor} size={22} strokeWidth={2.4} />
            <Text style={[styles.headerTitle, { color: headerContentColor }]}>Battle</Text>
          </View>

          <TouchableOpacity
            style={[
              styles.headerButton,
              {
                backgroundColor: controlSurface,
                borderColor: headerButtonBorder,
                shadowOpacity: isDark ? 0.2 : 0.1,
                shadowRadius: isDark ? 14 : 10,
                elevation: isDark ? 6 : 3,
              },
            ]}
            onPress={handleOpenSettings}
            activeOpacity={0.7}
            accessibilityLabel="Open settings"
            testID="battle-settings-button"
          >
            <Settings color={headerContentColor} size={22} />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
        >
          <View
            style={[
              styles.statStrip,
              {
                backgroundColor: statSurface,
                borderColor: surfaceBorderColor,
                shadowOpacity: isDark ? 0.24 : 0.1,
                shadowRadius: isDark ? 16 : 10,
                elevation: isDark ? 8 : 4,
              },
            ]}
            testID="battle-stat-strip"
          >
            {statItems.map((item, index) => (
              <React.Fragment key={item.key}>
                <View style={styles.statItem}>
                  <View style={[styles.statIconShell, { backgroundColor: insetSurface }]}>{item.icon}</View>
                  <Text style={[styles.statValue, { color: theme.text }]}>{item.value}</Text>
                  <Text style={[styles.statLabel, { color: theme.textSecondary }]}>{item.label}</Text>
                </View>
                {index < statItems.length - 1 ? (
                  <View
                    style={[
                      styles.statDivider,
                      { backgroundColor: isDark ? 'rgba(148, 163, 184, 0.18)' : 'rgba(235, 106, 26, 0.1)' },
                    ]}
                  />
                ) : null}
              </React.Fragment>
            ))}
          </View>

          <Text style={[styles.valueProp, { color: mutedTextColor }]}>{valueProp}</Text>

          <TouchableOpacity
            style={[
              styles.primaryActionCard,
              {
                opacity: isArenaActionDisabled ? 0.74 : 1,
                shadowOpacity: isDark ? 0.28 : 0.18,
                shadowRadius: isDark ? 18 : 14,
                elevation: isDark ? 10 : 5,
              },
            ]}
            onPress={handleCreateRoom}
            activeOpacity={0.9}
            disabled={isArenaActionDisabled}
            testID="battle-start-card"
          >
            <LinearGradient
              colors={isArenaActionDisabled ? disabledGradient : startGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.primaryActionGradient}
            >
              <View style={styles.actionRow}>
                <View style={[styles.primaryActionIconShell, { backgroundColor: 'rgba(255, 248, 241, 0.14)' }]}>
                  <Users color="#fff" size={30} strokeWidth={2.2} />
                </View>
                <View style={styles.actionContent}>
                  <Text style={styles.actionEyebrow}>Create room</Text>
                  <Text style={styles.primaryActionTitle}>Start Battle</Text>
                  <Text style={styles.primaryActionSubtitle}>{startCardSubtitle}</Text>
                  <View style={styles.actionFooterRow}>
                    <View style={styles.primaryActionMeta}>
                      <Text style={styles.primaryActionMetaLabel}>Battle profile</Text>
                      <Text style={styles.primaryActionFootnote} numberOfLines={1}>
                        {startIdentityText}
                      </Text>
                    </View>
                    <ChevronRight color="#fff" size={18} />
                  </View>
                </View>
              </View>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.secondaryActionCard,
              {
                backgroundColor: secondarySurface,
                borderColor: surfaceBorderColor,
                opacity: isArenaActionDisabled ? 0.72 : 1,
                shadowOpacity: isDark ? 0.2 : 0.08,
                shadowRadius: isDark ? 12 : 8,
                elevation: isDark ? 6 : 2,
              },
            ]}
            onPress={handleJoinRoom}
            activeOpacity={0.85}
            disabled={isArenaActionDisabled}
            testID="battle-join-card"
          >
            <View style={[styles.secondaryAccentBar, { backgroundColor: arenaAccent }]} />
            <View style={styles.actionRow}>
              <View style={[styles.secondaryActionIconShell, { backgroundColor: insetSurface }]}>
                <Target color={arenaAccent} size={28} strokeWidth={2.3} />
              </View>
              <View style={styles.actionContent}>
                <Text style={[styles.secondaryActionEyebrow, { color: arenaAccent }]}>Use room code</Text>
                <Text style={[styles.secondaryActionTitle, { color: theme.text }]}>Join Battle</Text>
                <Text style={[styles.secondaryActionSubtitle, { color: theme.textSecondary }]}>{joinCardSubtitle}</Text>
                <View style={styles.actionFooterRow}>
                  <Text style={[styles.secondaryActionFootnote, { color: theme.textSecondary }]} numberOfLines={1}>
                    {joinCardFootnote}
                  </Text>
                  <ChevronRight color={arenaAccent} size={18} />
                </View>
              </View>
            </View>
          </TouchableOpacity>

          <View
            style={[
              styles.configStrip,
              {
                backgroundColor: statSurface,
                borderColor: subtleBorderColor,
              },
            ]}
            testID="battle-config-strip"
          >
            <View style={[styles.configIconShell, { backgroundColor: insetSurface }]}>
              {roomCode ? (
                <Wifi color="#10b981" size={16} strokeWidth={2.4} />
              ) : (
                <Swords color={arenaAccent} size={16} strokeWidth={2.4} />
              )}
            </View>
            <Text style={[styles.configText, { color: theme.textSecondary }]} numberOfLines={2}>
              {setupCopy}
            </Text>
          </View>

          {!!roomCode && (
            <View
              style={[
                styles.liveRoomCard,
                {
                  backgroundColor: liveRoomSurface,
                  borderColor: liveRoomBorder,
                },
              ]}
              testID="battle-active-room-card"
            >
              <View style={styles.liveRoomTopRow}>
                <View style={[styles.liveRoomIconShell, { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.18)' : 'rgba(255, 255, 255, 0.7)' }]}>
                  <Wifi color="#10b981" size={18} strokeWidth={2.4} />
                </View>
                <View style={styles.liveRoomInfo}>
                  <Text style={styles.liveRoomEyebrow}>Live room</Text>
                  <Text style={[styles.liveRoomCode, { color: theme.text }]}>{roomCode}</Text>
                  <Text style={[styles.liveRoomDescription, { color: theme.textSecondary }]}>Jump back in or leave this room before starting a new battle.</Text>
                </View>
              </View>
              <View style={styles.liveRoomActions}>
                <TouchableOpacity
                  style={[styles.liveRoomButton, { backgroundColor: '#10b981' }]}
                  onPress={handleRejoin}
                  activeOpacity={0.8}
                  testID="battle-rejoin-button"
                >
                  <Text style={styles.liveRoomButtonText}>Rejoin</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.liveRoomButton, { backgroundColor: 'rgba(239, 68, 68, 0.92)' }]}
                  onPress={handleDisconnect}
                  activeOpacity={0.8}
                  testID="battle-leave-button"
                >
                  <Text style={styles.liveRoomButtonText}>Leave</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          <View
            style={[
              styles.recentBattlesCard,
              {
                backgroundColor: primarySurface,
                borderColor: surfaceBorderColor,
                shadowOpacity: isDark ? 0.2 : 0.08,
                shadowRadius: isDark ? 14 : 10,
                elevation: isDark ? 6 : 2,
              },
            ]}
            testID="battle-recent-card"
          >
            <View style={styles.recentHeader}>
              <View style={styles.recentHeaderTitleRow}>
                <Trophy color={arenaAccent} size={20} strokeWidth={2.4} />
                <Text style={[styles.recentTitle, { color: theme.text }]}>Recent Battles</Text>
              </View>
              <Text style={[styles.recentHeaderCaption, { color: theme.textTertiary }]}>Latest saved matches</Text>
            </View>

            {recentBattles.length === 0 ? (
              <View style={styles.emptyState}>
                <View style={[styles.emptyStateIconShell, { backgroundColor: insetSurface }]}>
                  <Swords color={arenaAccent} size={22} strokeWidth={2.3} />
                </View>
                <Text style={[styles.emptyStateTitle, { color: theme.text }]}>No battles yet</Text>
                <Text style={[styles.emptyStateText, { color: theme.textSecondary }]}>Finish a match to start your battle record.</Text>
              </View>
            ) : (
              <View style={styles.recentBattlesList}>
                {recentBattles.map((entry) => {
                  const isPersonalWin = hasSavedPlayerName && entry.winnerName.toLowerCase() === savedPlayerName.toLowerCase();

                  return (
                    <View
                      key={entry.id}
                      style={[
                        styles.recentBattleItem,
                        {
                          backgroundColor: secondarySurface,
                          borderColor: subtleBorderColor,
                        },
                      ]}
                    >
                      <View style={styles.recentBattleMain}>
                        <View style={styles.recentBattleTitleRow}>
                          <Text style={[styles.recentBattleWinner, { color: theme.text }]} numberOfLines={1}>
                            {entry.winnerName}
                          </Text>
                          <View
                            style={[
                              styles.resultPill,
                              {
                                backgroundColor: isPersonalWin ? (isDark ? 'rgba(251, 146, 60, 0.16)' : 'rgba(235, 106, 26, 0.1)') : insetSurface,
                                borderColor: isPersonalWin ? (isDark ? 'rgba(251, 146, 60, 0.28)' : 'rgba(235, 106, 26, 0.15)') : subtleBorderColor,
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.resultPillText,
                                { color: isPersonalWin ? arenaAccent : theme.textSecondary },
                              ]}
                            >
                              {isPersonalWin ? 'You won' : 'Winner'}
                            </Text>
                          </View>
                        </View>
                        <Text style={[styles.recentBattleDeck, { color: theme.textSecondary }]} numberOfLines={1}>
                          {entry.deckName}
                        </Text>
                        <Text style={[styles.recentBattleMeta, { color: theme.textTertiary }]} numberOfLines={2}>
                          {`${entry.playerCount} players · ${entry.rounds} rounds · ${formatTimerLabel(entry.timerSeconds)} · ${formatDate(entry.completedAt)}`}
                        </Text>
                      </View>

                      <View style={styles.recentBattleScoreBlock}>
                        <Text style={[styles.recentBattlePoints, { color: theme.text }]}>{entry.winnerPoints}</Text>
                        <Text style={[styles.recentBattleScoreLabel, { color: theme.textSecondary }]}>
                          {`${Math.round(entry.winnerAccuracy * 100)}% acc`}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>

      <Modal
        visible={showCreateModal}
        animationType="fade"
        transparent
        onRequestClose={() => {
          if (!isConnecting) {
            setShowCreateModal(false);
          }
        }}
      >
        <View style={[styles.modalOverlay, { backgroundColor: theme.modalOverlay }]}>
          <View
            style={[
              styles.modalContent,
              {
                backgroundColor: modalSurface,
                borderColor: surfaceBorderColor,
              },
            ]}
          >
            <Text style={[styles.modalTitle, { color: theme.text }]}>Start Battle</Text>
            <Text style={[styles.modalDescription, { color: theme.textSecondary }]}>Choose the name other players will see. FlashQuest saves it for your next battle.</Text>
            <TextInput
              style={[
                styles.modalInput,
                {
                  backgroundColor: secondarySurface,
                  color: theme.text,
                  borderColor: subtleBorderColor,
                },
              ]}
              placeholder="Enter your name"
              placeholderTextColor={theme.textTertiary}
              value={nameInput}
              onChangeText={setNameInput}
              autoFocus
              maxLength={PLAYER_NAME_MAX_LENGTH}
              editable={!isConnecting}
              testID="battle-name-input"
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[
                  styles.modalButton,
                  {
                    backgroundColor: secondarySurface,
                    borderColor: subtleBorderColor,
                  },
                ]}
                onPress={() => setShowCreateModal(false)}
                disabled={isConnecting}
                testID="battle-create-cancel-button"
              >
                <Text style={[styles.modalButtonText, { color: theme.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonPrimary]}
                onPress={handleConfirmCreate}
                disabled={!nextCreateName || isConnecting}
                testID="battle-create-confirm-button"
              >
                <LinearGradient
                  colors={startGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.modalButtonGradient}
                >
                  {isConnecting ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.modalButtonTextPrimary}>Continue</Text>
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
        onRequestClose={() => {
          if (!isConnecting) {
            setShowJoinModal(false);
          }
        }}
      >
        <View style={[styles.modalOverlay, { backgroundColor: theme.modalOverlay }]}>
          <View
            style={[
              styles.modalContent,
              {
                backgroundColor: modalSurface,
                borderColor: surfaceBorderColor,
              },
            ]}
          >
            <Text style={[styles.modalTitle, { color: theme.text }]}>Join Battle</Text>
            <Text style={[styles.modalDescription, { color: theme.textSecondary }]}>Enter a room code to join a live match with your battle profile.</Text>
            {hasSavedPlayerName ? (
              <View
                style={[
                  styles.savedNameCard,
                  {
                    backgroundColor: secondarySurface,
                    borderColor: subtleBorderColor,
                  },
                ]}
                testID="battle-saved-name-card"
              >
                <Text style={[styles.savedNameLabel, { color: theme.textSecondary }]}>Battle profile</Text>
                <Text style={[styles.savedNameValue, { color: theme.text }]} numberOfLines={1}>{savedPlayerName}</Text>
              </View>
            ) : (
              <TextInput
                style={[
                  styles.modalInput,
                  {
                    backgroundColor: secondarySurface,
                    color: theme.text,
                    borderColor: subtleBorderColor,
                  },
                ]}
                placeholder="Your name"
                placeholderTextColor={theme.textTertiary}
                value={nameInput}
                onChangeText={setNameInput}
                maxLength={PLAYER_NAME_MAX_LENGTH}
                editable={!isConnecting}
                autoFocus
                testID="battle-join-name-input"
              />
            )}
            <TextInput
              style={[
                styles.modalInput,
                styles.codeInput,
                {
                  backgroundColor: secondarySurface,
                  color: theme.text,
                  borderColor: subtleBorderColor,
                },
              ]}
              placeholder="M4X9"
              placeholderTextColor={theme.textTertiary}
              value={codeInput}
              onChangeText={(text) => setCodeInput(normalizeRoomCodeInput(text))}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={ROOM_CODE_LENGTH}
              editable={!isConnecting}
              autoFocus={hasSavedPlayerName}
              testID="battle-room-code-input"
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[
                  styles.modalButton,
                  {
                    backgroundColor: secondarySurface,
                    borderColor: subtleBorderColor,
                  },
                ]}
                onPress={() => setShowJoinModal(false)}
                disabled={isConnecting}
                testID="battle-join-cancel-button"
              >
                <Text style={[styles.modalButtonText, { color: theme.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonPrimary]}
                onPress={handleConfirmJoin}
                disabled={!nextJoinName || codeInput.length !== ROOM_CODE_LENGTH || isConnecting}
                testID="battle-join-confirm-button"
              >
                <LinearGradient
                  colors={startGradient}
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
    paddingTop: 8,
    paddingBottom: 12,
  },
  headerButton: {
    width: 46,
    height: 46,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 18,
    borderWidth: 1,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800' as const,
    color: '#fff',
    letterSpacing: -0.5,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  statStrip: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderRadius: 24,
    borderWidth: 1,
    paddingVertical: 16,
    paddingHorizontal: 10,
    marginTop: 8,
    marginBottom: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    gap: 6,
  },
  statIconShell: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: {
    fontSize: 28,
    fontWeight: '800' as const,
    letterSpacing: -0.8,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '600' as const,
    textAlign: 'center',
  },
  statDivider: {
    width: 1,
    marginVertical: 8,
  },
  valueProp: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600' as const,
    marginBottom: 18,
    paddingHorizontal: 2,
  },
  primaryActionCard: {
    borderRadius: 28,
    overflow: 'hidden',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
  },
  primaryActionGradient: {
    padding: 22,
  },
  secondaryActionCard: {
    borderRadius: 24,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 18,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    overflow: 'hidden',
  },
  secondaryAccentBar: {
    position: 'absolute',
    top: 18,
    left: 0,
    bottom: 18,
    width: 4,
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  actionContent: {
    flex: 1,
  },
  primaryActionIconShell: {
    width: 62,
    height: 62,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryActionIconShell: {
    width: 52,
    height: 52,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionEyebrow: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: 'rgba(255, 255, 255, 0.78)',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  secondaryActionEyebrow: {
    fontSize: 12,
    fontWeight: '700' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  primaryActionTitle: {
    fontSize: 26,
    fontWeight: '800' as const,
    color: '#fff',
    letterSpacing: -0.8,
    marginBottom: 6,
  },
  secondaryActionTitle: {
    fontSize: 22,
    fontWeight: '800' as const,
    letterSpacing: -0.6,
    marginBottom: 6,
  },
  primaryActionSubtitle: {
    fontSize: 15,
    lineHeight: 21,
    color: 'rgba(255, 255, 255, 0.92)',
    marginBottom: 12,
  },
  secondaryActionSubtitle: {
    fontSize: 15,
    lineHeight: 21,
    marginBottom: 10,
  },
  actionFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  primaryActionMeta: {
    flex: 1,
    gap: 3,
  },
  primaryActionMetaLabel: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.68)',
    fontWeight: '700' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.7,
  },
  primaryActionFootnote: {
    flex: 1,
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.94)',
    fontWeight: '700' as const,
  },
  secondaryActionFootnote: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600' as const,
  },
  configStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
    gap: 12,
  },
  configIconShell: {
    width: 32,
    height: 32,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  configText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600' as const,
  },
  liveRoomCard: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 18,
    marginBottom: 12,
  },
  liveRoomTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 16,
  },
  liveRoomIconShell: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  liveRoomInfo: {
    flex: 1,
  },
  liveRoomEyebrow: {
    fontSize: 12,
    fontWeight: '800' as const,
    color: '#10b981',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  liveRoomCode: {
    fontSize: 24,
    fontWeight: '800' as const,
    letterSpacing: 3,
    marginBottom: 6,
  },
  liveRoomDescription: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500' as const,
  },
  liveRoomActions: {
    flexDirection: 'row',
    gap: 10,
  },
  liveRoomButton: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  liveRoomButtonText: {
    fontSize: 15,
    fontWeight: '800' as const,
    color: '#fff',
  },
  recentBattlesCard: {
    borderRadius: 28,
    borderWidth: 1,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
  },
  recentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    gap: 12,
  },
  recentHeaderTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  recentTitle: {
    fontSize: 20,
    fontWeight: '800' as const,
    letterSpacing: -0.4,
  },
  recentHeaderCaption: {
    fontSize: 12,
    fontWeight: '600' as const,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 28,
    paddingHorizontal: 12,
  },
  emptyStateIconShell: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '800' as const,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    maxWidth: 260,
    fontWeight: '500' as const,
  },
  recentBattlesList: {
    gap: 10,
  },
  recentBattleItem: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  recentBattleMain: {
    flex: 1,
  },
  recentBattleTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  recentBattleWinner: {
    flex: 1,
    fontSize: 16,
    fontWeight: '800' as const,
    letterSpacing: -0.3,
  },
  resultPill: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  resultPillText: {
    fontSize: 11,
    fontWeight: '700' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  recentBattleDeck: {
    fontSize: 14,
    fontWeight: '600' as const,
    marginBottom: 6,
  },
  recentBattleMeta: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '500' as const,
  },
  recentBattleScoreBlock: {
    alignItems: 'flex-end',
    minWidth: 72,
  },
  recentBattlePoints: {
    fontSize: 24,
    fontWeight: '800' as const,
    letterSpacing: -0.6,
    marginBottom: 2,
  },
  recentBattleScoreLabel: {
    fontSize: 12,
    fontWeight: '600' as const,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 28,
    padding: 24,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.22,
    shadowRadius: 20,
    elevation: 12,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '800' as const,
    textAlign: 'center',
    letterSpacing: -0.6,
    marginBottom: 8,
  },
  modalDescription: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    fontWeight: '500' as const,
    marginBottom: 18,
  },
  savedNameCard: {
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 12,
  },
  savedNameLabel: {
    fontSize: 12,
    fontWeight: '700' as const,
    marginBottom: 4,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.6,
  },
  savedNameValue: {
    fontSize: 22,
    fontWeight: '800' as const,
    letterSpacing: -0.5,
  },
  modalInput: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 15,
    fontSize: 16,
    marginBottom: 12,
    fontWeight: '600' as const,
  },
  codeInput: {
    textAlign: 'center',
    fontSize: 24,
    letterSpacing: 8,
    fontWeight: '800' as const,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  modalButton: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
  },
  modalButtonPrimary: {
    borderWidth: 0,
  },
  modalButtonGradient: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    textAlign: 'center',
    paddingVertical: 15,
  },
  modalButtonTextPrimary: {
    fontSize: 16,
    fontWeight: '800' as const,
    color: '#fff',
  },
});
