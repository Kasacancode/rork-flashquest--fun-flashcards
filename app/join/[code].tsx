import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Link2, Swords } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useArena } from '@/context/ArenaContext';
import { useTheme } from '@/context/ThemeContext';
import { isRoomCodeValid, normalizeRoomCode } from '@/utils/arenaInvite';
import { logger } from '@/utils/logger';

export default function JoinBattleByLinkScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ code?: string | string[] }>();
  const { theme, isDark } = useTheme();
  const {
    roomCode,
    playerName: savedName,
    joinRoom,
    disconnect,
    isConnecting,
    connectionError,
    clearError,
  } = useArena();

  const joinCode = useMemo(() => {
    const rawCode = Array.isArray(params.code) ? params.code[0] ?? '' : params.code ?? '';
    return normalizeRoomCode(rawCode);
  }, [params.code]);

  const [nameInput, setNameInput] = useState<string>('');
  const [pendingJoin, setPendingJoin] = useState<boolean>(false);

  useEffect(() => {
    if (savedName) {
      setNameInput(savedName);
    }
  }, [savedName]);

  useEffect(() => {
    if (roomCode && roomCode === joinCode) {
      router.replace('/arena-lobby' as any);
    }
  }, [joinCode, roomCode, router]);

  useEffect(() => {
    if (!pendingJoin || !roomCode || roomCode !== joinCode) return;
    setPendingJoin(false);
    router.replace('/arena-lobby' as any);
  }, [joinCode, pendingJoin, roomCode, router]);

  useEffect(() => {
    if (!pendingJoin || !connectionError) return;

    const message = connectionError;
    clearError();
    setPendingJoin(false);
    Alert.alert('Unable to join battle', message);
  }, [clearError, connectionError, pendingJoin]);

  const handleBack = useCallback(() => {
    router.replace('/arena' as any);
  }, [router]);

  const handleJoinBattle = useCallback(() => {
    if (!isRoomCodeValid(joinCode)) {
      Alert.alert('Invalid invite', 'This battle link is not valid.');
      return;
    }

    const trimmedName = nameInput.trim();
    if (!trimmedName || isConnecting) return;

    logger.log('[JoinLink] Joining room from link:', joinCode);

    if (roomCode && roomCode !== joinCode) {
      disconnect();
    }

    setPendingJoin(true);
    void joinRoom(joinCode, trimmedName);
  }, [disconnect, isConnecting, joinCode, joinRoom, nameInput, roomCode]);

  const showInvalidLink = !isRoomCodeValid(joinCode);

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
          <View style={styles.headerTitleWrap}>
            <Swords color="#fff" size={22} />
            <Text style={styles.headerTitle}>Battle Invite</Text>
          </View>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.content}>
          <View style={[styles.card, { backgroundColor: isDark ? 'rgba(30, 41, 59, 0.95)' : theme.cardBackground }]}> 
            <View style={[styles.codeChip, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : theme.background }]}>
              <Link2 color={theme.textSecondary} size={16} />
              <Text style={[styles.codeChipText, { color: theme.textSecondary }]}>{joinCode || 'BATTLE'}</Text>
            </View>

            <Text style={[styles.title, { color: theme.text }]}>Joining Battle {joinCode || '----'}</Text>
            <Text style={[styles.label, { color: theme.textSecondary }]}>Enter name</Text>

            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : theme.background,
                  borderColor: theme.border,
                  color: theme.text,
                },
              ]}
              value={nameInput}
              onChangeText={setNameInput}
              placeholder="Your name"
              placeholderTextColor={theme.textTertiary}
              maxLength={20}
              editable={!isConnecting}
              autoFocus={!showInvalidLink}
              autoCapitalize="words"
              autoCorrect={false}
              testID="battle-link-name-input"
            />

            {showInvalidLink ? (
              <Text style={[styles.helperText, { color: theme.error }]}>This invite link is not valid.</Text>
            ) : (
              <Text style={[styles.helperText, { color: theme.textSecondary }]}>You’ll go straight into the lobby after joining.</Text>
            )}

            <TouchableOpacity
              style={[
                styles.primaryButton,
                { backgroundColor: showInvalidLink || !nameInput.trim() || isConnecting ? 'rgba(148, 163, 184, 0.45)' : '#10b981' },
              ]}
              onPress={handleJoinBattle}
              activeOpacity={0.85}
              disabled={showInvalidLink || !nameInput.trim() || isConnecting}
              testID="battle-link-join-button"
            >
              <Text style={styles.primaryButtonText}>{isConnecting ? 'Joining...' : 'Join Battle'}</Text>
            </TouchableOpacity>
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
  headerTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#fff',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  card: {
    borderRadius: 28,
    padding: 24,
  },
  codeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 18,
  },
  codeChipText: {
    fontSize: 13,
    fontWeight: '700' as const,
    letterSpacing: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: '800' as const,
    marginBottom: 18,
    lineHeight: 34,
  },
  label: {
    fontSize: 14,
    fontWeight: '600' as const,
    marginBottom: 10,
  },
  input: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 15,
    fontSize: 16,
    marginBottom: 12,
  },
  helperText: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 20,
  },
  primaryButton: {
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '800' as const,
    color: '#fff',
  },
});
