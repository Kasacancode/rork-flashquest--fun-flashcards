import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Swords } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useArena } from '@/context/ArenaContext';
import { useTheme } from '@/context/ThemeContext';
import { logger } from '@/utils/logger';

const ARENA_ACCENT_LIGHT = '#f97316';
const ARENA_ACCENT_DARK = '#f59e0b';

function normalizeCode(codeParam: string | string[] | undefined): string {
  const rawCode = Array.isArray(codeParam) ? codeParam[0] : codeParam;
  return decodeURIComponent(rawCode ?? '').trim().toUpperCase();
}

export default function JoinBattleFromLinkScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ code?: string | string[] }>();
  const { theme, isDark } = useTheme();
  const arenaAccent = isDark ? ARENA_ACCENT_DARK : ARENA_ACCENT_LIGHT;
  const {
    roomCode,
    playerName,
    isPlayerNameReady,
    isConnecting,
    connectionError,
    joinRoom,
    clearError,
    disconnect,
  } = useArena();

  const inviteCode = useMemo(() => normalizeCode(params.code), [params.code]);
  const [nicknameInput, setNicknameInput] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [manualJoinStarted, setManualJoinStarted] = useState<boolean>(false);
  const leavingExistingRoomRef = useRef<boolean>(false);
  const joinRequestedRef = useRef<boolean>(false);

  useEffect(() => {
    clearError();
    if (!inviteCode) {
      setErrorMessage('Could not join battle');
    }

    return () => {
      clearError();
    };
  }, [clearError, inviteCode]);

  useEffect(() => {
    if (playerName) {
      setNicknameInput(playerName);
    }
  }, [playerName]);

  useEffect(() => {
    if (!inviteCode || errorMessage) {
      return;
    }

    if (roomCode === inviteCode) {
      router.replace('/arena-lobby' as any);
      return;
    }

    if (roomCode && roomCode !== inviteCode && !leavingExistingRoomRef.current) {
      leavingExistingRoomRef.current = true;
      logger.log('[JoinLink] Leaving existing room before joining:', roomCode);
      disconnect();
      return;
    }

    if (!roomCode) {
      leavingExistingRoomRef.current = false;
    }
  }, [disconnect, errorMessage, inviteCode, roomCode, router]);

  useEffect(() => {
    if (!inviteCode || !isPlayerNameReady || !playerName.trim() || errorMessage) {
      return;
    }

    if (roomCode || joinRequestedRef.current) {
      return;
    }

    joinRequestedRef.current = true;
    logger.log('[JoinLink] Auto-joining room:', inviteCode);
    joinRoom(inviteCode, playerName.trim());
  }, [errorMessage, inviteCode, isPlayerNameReady, joinRoom, playerName, roomCode]);

  useEffect(() => {
    if (!connectionError || !joinRequestedRef.current) {
      return;
    }

    logger.log('[JoinLink] Join failed:', connectionError);
    joinRequestedRef.current = false;
    setManualJoinStarted(false);
    clearError();

    if (connectionError.toLowerCase().includes('not found')) {
      setErrorMessage('Battle not found');
      return;
    }

    setErrorMessage('Could not join battle');
  }, [clearError, connectionError]);

  const handleBackToArena = useCallback(() => {
    router.replace('/arena' as any);
  }, [router]);

  const handleSubmitNickname = useCallback(() => {
    const trimmedName = nicknameInput.trim();
    if (!inviteCode || !trimmedName || isConnecting) {
      return;
    }

    logger.log('[JoinLink] Joining with provided nickname:', inviteCode);
    setErrorMessage(null);
    setManualJoinStarted(true);
    joinRequestedRef.current = true;
    clearError();
    joinRoom(inviteCode, trimmedName);
  }, [clearError, inviteCode, isConnecting, joinRoom, nicknameInput]);

  const isLoading = !isPlayerNameReady
    || (!!roomCode && roomCode !== inviteCode)
    || (joinRequestedRef.current && (!!playerName.trim() || manualJoinStarted))
    || isConnecting;
  const needsNickname = isPlayerNameReady && !playerName.trim() && !errorMessage && !isLoading;

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
            onPress={handleBackToArena}
            activeOpacity={0.75}
            testID="join-link-back-button"
          >
            <ArrowLeft color="#fff" size={22} />
          </TouchableOpacity>
          <View style={styles.headerTitleWrap}>
            <Swords color="#fff" size={22} />
            <Text style={styles.headerTitle}>Battle Invite</Text>
          </View>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.content}>
          <View style={[styles.card, { backgroundColor: isDark ? 'rgba(15, 23, 42, 0.88)' : 'rgba(255,255,255,0.96)' }]}> 
            <Text style={[styles.eyebrow, { color: arenaAccent }]}>FlashQuest Arena</Text>
            <Text style={[styles.title, { color: theme.text }]}>
              {errorMessage ? errorMessage : 'Joining FlashQuest battle…'}
            </Text>
            <Text style={[styles.roomLabel, { color: theme.textSecondary }]}>Room: {inviteCode || '—'}</Text>

            {errorMessage ? (
              <>
                <Text style={[styles.supportingText, { color: theme.textSecondary }]}>Check the invite link and try again.</Text>
                <TouchableOpacity
                  style={[styles.primaryButton, { backgroundColor: arenaAccent }]}
                  onPress={handleBackToArena}
                  activeOpacity={0.85}
                  testID="join-link-error-back-button"
                >
                  <Text style={styles.primaryButtonText}>Back to Battle</Text>
                </TouchableOpacity>
              </>
            ) : needsNickname ? (
              <>
                <Text style={[styles.supportingText, { color: theme.textSecondary }]}>Enter your nickname to join instantly.</Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : theme.background,
                      borderColor: theme.border,
                      color: theme.text,
                    },
                  ]}
                  value={nicknameInput}
                  onChangeText={setNicknameInput}
                  placeholder="Your nickname"
                  placeholderTextColor={theme.textTertiary}
                  maxLength={20}
                  autoFocus
                  autoCapitalize="words"
                  editable={!isConnecting}
                  testID="join-link-name-input"
                />
                <TouchableOpacity
                  style={[styles.primaryButton, { backgroundColor: arenaAccent, opacity: nicknameInput.trim() ? 1 : 0.6 }]}
                  onPress={handleSubmitNickname}
                  activeOpacity={0.85}
                  disabled={!nicknameInput.trim() || isConnecting}
                  testID="join-link-submit-button"
                >
                  <Text style={styles.primaryButtonText}>{isConnecting ? 'Joining…' : 'Join Battle'}</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <ActivityIndicator color={arenaAccent} size="large" />
                <Text style={[styles.supportingText, { color: theme.textSecondary }]}>
                  {playerName.trim() ? `Joining as ${playerName.trim()}...` : 'Preparing your invite...'}
                </Text>
              </>
            )}
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
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700' as const,
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  card: {
    borderRadius: 28,
    paddingHorizontal: 24,
    paddingVertical: 28,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 10,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '800' as const,
    letterSpacing: 1,
    textTransform: 'uppercase' as const,
    marginBottom: 10,
  },
  title: {
    fontSize: 26,
    fontWeight: '800' as const,
    textAlign: 'center' as const,
  },
  roomLabel: {
    marginTop: 10,
    fontSize: 15,
    fontWeight: '600' as const,
    marginBottom: 24,
  },
  supportingText: {
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center' as const,
    marginTop: 14,
    marginBottom: 18,
  },
  input: {
    width: '100%',
    minHeight: 54,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 16,
    fontSize: 16,
    fontWeight: '600' as const,
    marginBottom: 14,
  },
  primaryButton: {
    width: '100%',
    minHeight: 54,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800' as const,
  },
});
