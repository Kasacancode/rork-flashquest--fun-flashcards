import React, { memo, useCallback, useMemo } from 'react';
import { Animated, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Wifi, WifiOff, X } from 'lucide-react-native';

import type { Theme } from '@/constants/colors';

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

interface ArenaLobbyPlayersListProps {
  players: LobbyPlayer[];
  playerId: string | null | undefined;
  isHost: boolean;
  isDark: boolean;
  theme: Theme;
  arenaAccent: string;
  codeCopied: boolean;
  roomCode: string;
  hasInviteSlot: boolean;
  onCopyCode: () => void;
  onRemovePlayer: (playerId: string) => void;
  getPlayerEntryAnimation: (playerId: string) => Animated.Value;
}

type LobbyListItem =
  | { type: 'player'; player: LobbyPlayer }
  | { type: 'invite'; id: string };

interface LobbyPlayerRowProps {
  player: LobbyPlayer;
  playerId: string | null | undefined;
  isHost: boolean;
  isDark: boolean;
  theme: Theme;
  onRemovePlayer: (playerId: string) => void;
  animation: Animated.Value;
}

const LobbyPlayerRow = memo(function LobbyPlayerRow({
  player,
  playerId,
  isHost,
  isDark,
  theme,
  onRemovePlayer,
  animation,
}: LobbyPlayerRowProps) {
  const recentlyJoinedGlow = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0],
  });

  const handleRemove = useCallback(() => {
    onRemovePlayer(player.id);
  }, [onRemovePlayer, player.id]);

  return (
    <Animated.View
      style={{
        opacity: animation,
        transform: [
          {
            translateY: animation.interpolate({
              inputRange: [0, 1],
              outputRange: [14, 0],
            }),
          },
          {
            scale: animation.interpolate({
              inputRange: [0, 1],
              outputRange: [0.98, 1],
            }),
          },
        ],
      }}
    >
      <View
        style={[
          styles.playerCard,
          {
            backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : theme.background,
            borderColor: `${player.color}33`,
          },
        ]}
        testID={`battle-lobby-player-row-${player.id}`}
      >
        <Animated.View style={[styles.playerAvatarGlow, { borderColor: player.color, opacity: recentlyJoinedGlow }]} />
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
            {player.id === playerId ? <Text style={[styles.youBadge, { color: theme.primary }]}>You</Text> : null}
          </View>
          <Text style={[styles.playerName, { color: theme.text }]} numberOfLines={1}>
            {player.name}
          </Text>
          <View style={styles.playerMeta}>
            {player.isHost ? <Text style={[styles.hostBadge, { color: theme.warning }]}>Host</Text> : null}
            <View style={styles.connectionStatus}>
              {player.connected ? <Wifi color="#10b981" size={12} /> : <WifiOff color="#ef4444" size={12} />}
              <Text style={[styles.connectionStatusText, { color: player.connected ? '#10b981' : '#ef4444' }]}>
                {player.connected ? 'Online' : 'Offline'}
              </Text>
            </View>
          </View>
        </View>
        {isHost && !player.isHost ? (
          <TouchableOpacity style={styles.removeButton} onPress={handleRemove} activeOpacity={0.7}>
            <X color={theme.textTertiary} size={18} />
          </TouchableOpacity>
        ) : null}
      </View>
    </Animated.View>
  );
});

interface InviteRowProps {
  theme: Theme;
  isDark: boolean;
  arenaAccent: string;
  codeCopied: boolean;
  roomCode: string;
  onCopyCode: () => void;
}

const InviteRow = memo(function InviteRow({ theme, isDark, arenaAccent, codeCopied, roomCode, onCopyCode }: InviteRowProps) {
  return (
    <TouchableOpacity
      style={[
        styles.emptySlotCard,
        {
          backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : theme.background,
          borderColor: isDark ? 'rgba(255,255,255,0.08)' : theme.border,
        },
      ]}
      onPress={onCopyCode}
      activeOpacity={0.8}
      testID="battle-lobby-empty-slot-0"
    >
      <View style={[styles.emptySlotAvatar, { borderColor: arenaAccent }]}>
        <Text style={[styles.emptySlotPlus, { color: arenaAccent }]}>+</Text>
      </View>
      <View style={styles.playerInfo}>
        <Text style={[styles.emptySlotTitle, { color: theme.text }]}>+ Invite</Text>
        <Text style={[styles.emptySlotSubtitle, { color: codeCopied ? '#10b981' : theme.textSecondary }]}>
          {codeCopied ? 'Room code copied' : `Tap to copy code ${roomCode}`}
        </Text>
      </View>
    </TouchableOpacity>
  );
});

function ArenaLobbyPlayersList({
  players,
  playerId,
  isHost,
  isDark,
  theme,
  arenaAccent,
  codeCopied,
  roomCode,
  hasInviteSlot,
  onCopyCode,
  onRemovePlayer,
  getPlayerEntryAnimation,
}: ArenaLobbyPlayersListProps) {
  const data = useMemo<LobbyListItem[]>(() => {
    const items: LobbyListItem[] = players.map((player) => ({ type: 'player', player }));
    if (hasInviteSlot) {
      items.push({ type: 'invite', id: 'invite-slot' });
    }
    return items;
  }, [hasInviteSlot, players]);

  const renderItem = useCallback(
    ({ item }: { item: LobbyListItem }) => {
      if (item.type === 'invite') {
        return (
          <InviteRow
            theme={theme}
            isDark={isDark}
            arenaAccent={arenaAccent}
            codeCopied={codeCopied}
            roomCode={roomCode}
            onCopyCode={onCopyCode}
          />
        );
      }

      return (
        <LobbyPlayerRow
          player={item.player}
          playerId={playerId}
          isHost={isHost}
          isDark={isDark}
          theme={theme}
          onRemovePlayer={onRemovePlayer}
          animation={getPlayerEntryAnimation(item.player.id)}
        />
      );
    },
    [arenaAccent, codeCopied, getPlayerEntryAnimation, isDark, isHost, onCopyCode, onRemovePlayer, playerId, roomCode, theme],
  );

  const keyExtractor = useCallback((item: LobbyListItem) => (item.type === 'invite' ? item.id : item.player.id), []);

  return (
    <FlatList
      data={data}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      scrollEnabled={false}
      ItemSeparatorComponent={ItemSeparator}
      removeClippedSubviews={false}
      initialNumToRender={8}
      maxToRenderPerBatch={8}
      windowSize={5}
      testID="battle-lobby-players-list"
    />
  );
}

function ItemSeparator() {
  return <View style={styles.separator} />;
}

export default memo(ArenaLobbyPlayersList);

const styles = StyleSheet.create({
  separator: {
    height: 10,
  },
  playerCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  playerAvatarGlow: {
    position: 'absolute',
    top: 8,
    bottom: 8,
    left: 8,
    right: 8,
    borderRadius: 16,
    borderWidth: 1,
  },
  playerAvatar: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  playerInitial: {
    fontSize: 22,
    fontWeight: '800' as const,
    color: '#fff',
  },
  playerInfo: {
    flex: 1,
    minWidth: 0,
  },
  playerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
    flexWrap: 'wrap',
  },
  identityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    maxWidth: '62%',
  },
  identityBadgeText: {
    fontSize: 11,
    fontWeight: '700' as const,
  },
  youBadge: {
    fontSize: 12,
    fontWeight: '700' as const,
  },
  playerName: {
    fontSize: 16,
    fontWeight: '800' as const,
    marginBottom: 4,
  },
  playerMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  hostBadge: {
    fontSize: 12,
    fontWeight: '700' as const,
  },
  connectionStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  connectionStatusText: {
    fontSize: 11,
    fontWeight: '500' as const,
  },
  removeButton: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
  },
  emptySlotCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  emptySlotAvatar: {
    width: 52,
    height: 52,
    borderRadius: 16,
    borderWidth: 2,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  emptySlotPlus: {
    fontSize: 26,
    fontWeight: '700' as const,
    lineHeight: 26,
  },
  emptySlotTitle: {
    fontSize: 16,
    fontWeight: '800' as const,
    marginBottom: 4,
  },
  emptySlotSubtitle: {
    fontSize: 13,
    fontWeight: '600' as const,
  },
});
