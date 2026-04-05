import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useRouter } from 'expo-router';
import { ArrowLeft, Check, Flame, Search, Share2, Swords, Trash2, UserPlus, Users, X } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import ResponsiveContainer from '@/components/ResponsiveContainer';
import { useAuth } from '@/context/AuthContext';
import { useDeckContext } from '@/context/DeckContext';
import { useTheme } from '@/context/ThemeContext';
import { supabase } from '@/lib/supabase';
import type { QuestSettings } from '@/types/performance';
import { getLevelBand } from '@/utils/levels';
import { logger } from '@/utils/logger';
import { serializeQuestSettings } from '@/utils/questParams';
import { AUTH_ROUTE, questSessionHref } from '@/utils/routes';
import {
  acceptFriendRequest,
  declineFriendRequest,
  fetchFriends,
  fetchPendingRequests,
  removeFriend,
  searchUsers,
  sendFriendRequest,
  type FriendProfile,
  type FriendRequest,
  type Friendship,
} from '@/utils/friendsService';

function getLevelColor(level: number): string {
  const band = getLevelBand(level);

  switch (band) {
    case 'elite':
      return '#8B5CF6';
    case 'high':
      return '#F59E0B';
    case 'mid':
      return '#10B981';
    default:
      return '#3B82F6';
  }
}

function formatLastActive(isoDate: string | null): string {
  if (!isoDate) {
    return '';
  }

  const now = Date.now();
  const then = new Date(isoDate).getTime();
  const diffMs = now - then;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 5) {
    return 'Active now';
  }

  if (diffMins < 60) {
    return `${diffMins}m ago`;
  }

  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }

  if (diffDays < 7) {
    return `${diffDays}d ago`;
  }

  return '';
}

export default function FriendsScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { theme, isDark } = useTheme();
  const { isSignedIn, user } = useAuth();
  const { decks } = useDeckContext();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchRequestIdRef = useRef<number>(0);
  const [friends, setFriends] = useState<Friendship[]>([]);
  const [pendingRequests, setPendingRequests] = useState<FriendRequest[]>([]);
  const [searchResults, setSearchResults] = useState<FriendProfile[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [sentRequestIds, setSentRequestIds] = useState<Set<string>>(new Set());
  const [challengeTarget, setChallengeTarget] = useState<Friendship | null>(null);

  const loadData = useCallback(async () => {
    if (!user?.id) {
      setFriends([]);
      setPendingRequests([]);
      setIsLoading(false);
      setIsRefreshing(false);
      return;
    }

    logger.log('[FriendsScreen] Loading friends data for user', user.id);

    const [friendsData, requestsData] = await Promise.all([
      fetchFriends(user.id),
      fetchPendingRequests(user.id),
    ]);

    setFriends(friendsData);
    setPendingRequests(requestsData);
    setIsLoading(false);
    setIsRefreshing(false);
  }, [user?.id]);

  useEffect(() => {
    if (isSignedIn && user?.id) {
      setIsLoading(true);
      void loadData();
      return;
    }

    setFriends([]);
    setPendingRequests([]);
    setSearchResults([]);
    setSentRequestIds(new Set());
    setChallengeTarget(null);
    setIsLoading(false);
    setIsRefreshing(false);
  }, [isSignedIn, loadData, user?.id]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      if (user?.id && !isLoading) {
        void loadData();
      }
    });

    return unsubscribe;
  }, [navigation, user?.id, isLoading, loadData]);

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (query.trim().length < 2) {
      searchRequestIdRef.current += 1;
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const requestId = searchRequestIdRef.current + 1;
    searchRequestIdRef.current = requestId;

    debounceRef.current = setTimeout(async () => {
      if (!user?.id) {
        setIsSearching(false);
        return;
      }

      logger.log('[FriendsScreen] Searching for users', { query });
      const results = await searchUsers(query, user.id);

      if (searchRequestIdRef.current !== requestId) {
        return;
      }

      setSearchResults(results);
      setIsSearching(false);
    }, 400);
  }, [user?.id]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  const handleSendRequest = useCallback(async (friendId: string) => {
    if (!user?.id) {
      return;
    }

    logger.log('[FriendsScreen] Sending friend request', { from: user.id, to: friendId });
    const result = await sendFriendRequest(user.id, friendId);

    if (result.success) {
      setSentRequestIds((previous) => {
        const next = new Set(previous);
        next.add(friendId);
        return next;
      });
      return;
    }

    Alert.alert('Request Failed', result.error ?? 'Could not send request.');
  }, [user?.id]);

  const handleAccept = useCallback(async (requestId: string) => {
    logger.log('[FriendsScreen] Accepting request', requestId);
    const success = await acceptFriendRequest(requestId);

    if (!success) {
      Alert.alert('Could Not Accept', 'Please try again.');
      return;
    }

    await loadData();
  }, [loadData]);

  const handleDecline = useCallback(async (requestId: string) => {
    logger.log('[FriendsScreen] Declining request', requestId);
    const success = await declineFriendRequest(requestId);

    if (!success) {
      Alert.alert('Could Not Decline', 'Please try again.');
      return;
    }

    setPendingRequests((previous) => previous.filter((request) => request.id !== requestId));
  }, []);

  const handleRemoveFriend = useCallback((friendship: Friendship) => {
    Alert.alert(
      'Remove Friend',
      `Remove @${friendship.friend.username} from your friends?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            logger.log('[FriendsScreen] Removing friend', friendship.id);
            const success = await removeFriend(friendship.id);

            if (!success) {
              Alert.alert('Could Not Remove Friend', 'Please try again.');
              return;
            }

            setFriends((previous) => previous.filter((item) => item.id !== friendship.id));
          },
        },
      ],
    );
  }, []);

  const handleStartChallenge = useCallback((deckId: string) => {
    if (!challengeTarget) {
      return;
    }

    const deck = decks.find((item) => item.id === deckId);
    if (!deck) {
      return;
    }

    const cardIds = deck.flashcards.map((card) => card.id);
    if (cardIds.length < 4) {
      Alert.alert('Not Enough Cards', 'You need a deck with at least 4 cards to challenge a friend.');
      return;
    }

    const settings: QuestSettings = {
      deckId: deck.id,
      mode: 'learn',
      runLength: cardIds.length >= 10 ? 10 : 5,
      timerSeconds: 0,
      focusWeakOnly: false,
      hintsEnabled: true,
      explanationsEnabled: true,
      secondChanceEnabled: false,
    };

    logger.log('[FriendsScreen] Starting challenge', {
      opponentId: challengeTarget.friend.userId,
      deckId: deck.id,
      cardCount: cardIds.length,
    });

    setChallengeTarget(null);
    router.push(questSessionHref({
      settings: serializeQuestSettings(settings),
      challengeOpponentId: challengeTarget.friend.userId,
      challengeCardIds: cardIds.join(','),
    }));
  }, [challengeTarget, decks, router]);

  const handleShareProfile = useCallback(async () => {
    if (!user?.id) {
      return;
    }

    logger.log('[FriendsScreen] Sharing profile', user.id);
    const { data, error } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', user.id)
      .maybeSingle();

    if (error) {
      logger.warn('[FriendsScreen] Failed to load username for sharing:', error.message);
      Alert.alert('Could Not Share', 'Please try again.');
      return;
    }

    const username = typeof data?.username === 'string' ? data.username.trim() : '';
    if (!username) {
      Alert.alert('No Username', 'Set a username in your account settings first.');
      return;
    }

    try {
      await Share.share({
        message: `Add me on FlashQuest! My username is @${username}\n\nDownload: flashquest.net`,
      });
    } catch (error) {
      logger.log('[FriendsScreen] Share dismissed or failed', error);
    }
  }, [user?.id]);

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    void loadData();
  }, [loadData]);

  const friendIds = useMemo(() => new Set(friends.map((friendship) => friendship.friend.userId)), [friends]);
  const incomingRequestIds = useMemo(() => new Set(pendingRequests.map((request) => request.user.userId)), [pendingRequests]);
  const challengeDecks = useMemo(() => decks.filter((deck) => deck.flashcards.length >= 4), [decks]);
  const cardBg = isDark ? 'rgba(11, 20, 37, 0.84)' : 'rgba(255, 255, 255, 0.9)';
  const cardBorder = isDark ? 'rgba(148, 163, 184, 0.12)' : 'rgba(148, 163, 184, 0.18)';
  const headerText = isDark ? '#F8FAFC' : '#173A71';
  const inputBg = isDark ? 'rgba(15, 23, 42, 0.6)' : 'rgba(255, 255, 255, 0.7)';
  const rowBorder = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)';

  if (!isSignedIn) {
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={isDark ? ['#09111f', '#11203a', '#0a1323'] : ['#f7fbff', '#e6efff', '#eef0ff']}
          style={StyleSheet.absoluteFill}
        />
        <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
          <View style={styles.header}>
            <TouchableOpacity
              style={[
                styles.backButton,
                {
                  backgroundColor: isDark ? 'rgba(10,17,34,0.46)' : 'rgba(255,255,255,0.58)',
                  borderColor: cardBorder,
                },
              ]}
              onPress={() => router.back()}
              accessibilityLabel="Go back"
              testID="friends-back-button-signed-out"
            >
              <ArrowLeft color={headerText} size={22} strokeWidth={2.5} />
            </TouchableOpacity>
            <View
              style={[
                styles.headerPill,
                {
                  backgroundColor: isDark ? 'rgba(10,17,34,0.42)' : 'rgba(255,255,255,0.5)',
                  borderColor: cardBorder,
                },
              ]}
            >
              <Users color={isDark ? '#818CF8' : '#6366F1'} size={20} strokeWidth={2.35} />
              <Text style={[styles.headerTitle, { color: headerText }]}>Friends</Text>
            </View>
            <View style={styles.placeholder} />
          </View>

          <View style={styles.emptyContainer}>
            <Users color={theme.textTertiary} size={48} strokeWidth={1.5} />
            <Text style={[styles.emptyTitle, { color: theme.text }]}>Sign in to add friends</Text>
            <TouchableOpacity
              style={styles.signInButton}
              onPress={() => router.push(AUTH_ROUTE)}
              activeOpacity={0.85}
              testID="friends-sign-in-button"
            >
              <Text style={styles.signInButtonText}>Sign In</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={isDark ? ['#09111f', '#11203a', '#0a1323'] : ['#f7fbff', '#e6efff', '#eef0ff']}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <TouchableOpacity
            style={[
              styles.backButton,
              {
                backgroundColor: isDark ? 'rgba(10,17,34,0.46)' : 'rgba(255,255,255,0.58)',
                borderColor: cardBorder,
              },
            ]}
            onPress={() => router.back()}
            accessibilityLabel="Go back"
            testID="friends-back-button"
          >
            <ArrowLeft color={headerText} size={22} strokeWidth={2.5} />
          </TouchableOpacity>
          <View
            style={[
              styles.headerPill,
              {
                backgroundColor: isDark ? 'rgba(10,17,34,0.42)' : 'rgba(255,255,255,0.5)',
                borderColor: cardBorder,
              },
            ]}
          >
            <Users color={isDark ? '#818CF8' : '#6366F1'} size={20} strokeWidth={2.35} />
            <Text style={[styles.headerTitle, { color: headerText }]}>Friends</Text>
          </View>
          <View style={styles.placeholder} />
        </View>

        <View style={styles.searchRow}>
          <View style={[styles.searchInput, { backgroundColor: inputBg, borderColor: cardBorder }]}>
            <Search color={theme.textTertiary} size={16} strokeWidth={2.2} />
            <TextInput
              style={[styles.searchText, { color: theme.text }]}
              placeholder="Search by username..."
              placeholderTextColor={theme.textTertiary}
              value={searchQuery}
              onChangeText={handleSearch}
              autoCapitalize="none"
              autoCorrect={false}
              testID="friends-search-input"
            />
            {searchQuery.length > 0 ? (
              <TouchableOpacity
                onPress={() => {
                  searchRequestIdRef.current += 1;
                  setSearchQuery('');
                  setSearchResults([]);
                  setIsSearching(false);
                }}
                hitSlop={8}
                testID="friends-search-clear-button"
              >
                <X color={theme.textTertiary} size={16} strokeWidth={2.2} />
              </TouchableOpacity>
            ) : null}
          </View>

          <TouchableOpacity
            style={[
              styles.shareProfileButton,
              {
                backgroundColor: isDark ? 'rgba(99,102,241,0.12)' : 'rgba(99,102,241,0.08)',
                borderColor: isDark ? 'rgba(99,102,241,0.25)' : 'rgba(99,102,241,0.15)',
              },
            ]}
            onPress={() => {
              void handleShareProfile();
            }}
            activeOpacity={0.8}
            accessibilityLabel="Share your username"
            testID="friends-share-profile-button"
          >
            <Share2 color={theme.primary} size={15} strokeWidth={2.2} />
            <Text style={[styles.shareProfileText, { color: theme.primary }]}>Share My Username</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={(
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor={theme.primary}
            />
          )}
          showsVerticalScrollIndicator={false}
        >
          <ResponsiveContainer>
            {searchQuery.trim().length >= 2 ? (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Search Results</Text>
                {isSearching ? (
                  <ActivityIndicator color={theme.primary} style={styles.loader} />
                ) : searchResults.length === 0 ? (
                  <Text style={[styles.emptyText, { color: theme.textTertiary }]}>No users found</Text>
                ) : (
                  <View style={[styles.listCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
                    {searchResults.map((profile, index) => {
                      const isFriend = friendIds.has(profile.userId);
                      const isSent = sentRequestIds.has(profile.userId);
                      const hasIncomingRequest = incomingRequestIds.has(profile.userId);

                      return (
                        <View
                          key={profile.userId}
                          style={[
                            styles.row,
                            index < searchResults.length - 1 ? [styles.rowBorder, { borderBottomColor: rowBorder }] : null,
                          ]}
                        >
                          <View style={[styles.levelBadge, { backgroundColor: `${getLevelColor(profile.level)}18` }]}>
                            <Text style={[styles.levelText, { color: getLevelColor(profile.level) }]}>{profile.level}</Text>
                          </View>
                          <View style={styles.nameColumn}>
                            <Text style={[styles.username, { color: theme.text }]} numberOfLines={1}>@{profile.username}</Text>
                            <Text style={[styles.subtitle, { color: theme.textTertiary }]} numberOfLines={1}>
                              {profile.totalScore.toLocaleString()} XP
                            </Text>
                          </View>
                          {isFriend ? (
                            <Text style={[styles.statusText, { color: '#10B981' }]}>Friends</Text>
                          ) : isSent ? (
                            <Text style={[styles.statusText, { color: theme.textTertiary }]}>Sent</Text>
                          ) : hasIncomingRequest ? (
                            <Text style={[styles.statusText, { color: '#F59E0B' }]}>Pending</Text>
                          ) : (
                            <TouchableOpacity
                              style={styles.addButton}
                              onPress={() => handleSendRequest(profile.userId)}
                              activeOpacity={0.8}
                              testID={`friends-add-button-${profile.userId}`}
                            >
                              <UserPlus color="#6366F1" size={18} strokeWidth={2.2} />
                            </TouchableOpacity>
                          )}
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            ) : null}

            {pendingRequests.length > 0 ? (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>
                  Pending Requests ({pendingRequests.length})
                </Text>
                <View style={[styles.listCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
                  {pendingRequests.map((request, index) => (
                    <View
                      key={request.id}
                      style={[
                        styles.row,
                        index < pendingRequests.length - 1 ? [styles.rowBorder, { borderBottomColor: rowBorder }] : null,
                      ]}
                    >
                      <View style={[styles.levelBadge, { backgroundColor: `${getLevelColor(request.user.level)}18` }]}>
                        <Text style={[styles.levelText, { color: getLevelColor(request.user.level) }]}>{request.user.level}</Text>
                      </View>
                      <View style={styles.nameColumn}>
                        <Text style={[styles.username, { color: theme.text }]} numberOfLines={1}>@{request.user.username}</Text>
                        <Text style={[styles.subtitle, { color: theme.textTertiary }]} numberOfLines={1}>
                          {request.user.totalScore.toLocaleString()} XP
                        </Text>
                      </View>
                      <View style={styles.requestActions}>
                        <TouchableOpacity
                          style={[styles.actionButton, styles.acceptButton]}
                          onPress={() => handleAccept(request.id)}
                          activeOpacity={0.8}
                          testID={`friends-accept-button-${request.id}`}
                        >
                          <Check color="#FFFFFF" size={16} strokeWidth={2.5} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.actionButton, styles.declineButton, { borderColor: cardBorder }]}
                          onPress={() => handleDecline(request.id)}
                          activeOpacity={0.8}
                          testID={`friends-decline-button-${request.id}`}
                        >
                          <X color={theme.textSecondary} size={16} strokeWidth={2.5} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}

            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Your Friends ({friends.length})</Text>
              {isLoading ? (
                <ActivityIndicator color={theme.primary} style={styles.loader} />
              ) : friends.length === 0 ? (
                <View style={[styles.emptyCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
                  <Users color={theme.textTertiary} size={32} strokeWidth={1.5} />
                  <Text style={[styles.emptyCardTitle, { color: theme.text }]}>No friends yet</Text>
                  <Text style={[styles.emptyCardSubtitle, { color: theme.textSecondary }]}>Search by username above to add friends and compete together</Text>
                </View>
              ) : (
                <View style={[styles.listCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
                  {friends.map((friendship, index) => {
                    const friend = friendship.friend;
                    const lastActiveLabel = formatLastActive(friend.lastActive);

                    return (
                      <View
                        key={friendship.id}
                        style={[
                          styles.row,
                          index < friends.length - 1 ? [styles.rowBorder, { borderBottomColor: rowBorder }] : null,
                        ]}
                      >
                        <View style={[styles.levelBadge, { backgroundColor: `${getLevelColor(friend.level)}18` }]}>
                          <Text style={[styles.levelText, { color: getLevelColor(friend.level) }]}>{friend.level}</Text>
                        </View>
                        <View style={styles.nameColumn}>
                          <Text style={[styles.username, { color: theme.text }]} numberOfLines={1}>@{friend.username}</Text>
                          <View style={styles.statsRow}>
                            <Text style={[styles.statText, { color: theme.textTertiary }]}>{friend.totalScore.toLocaleString()} XP</Text>
                            {friend.currentStreak > 0 ? (
                              <View style={styles.streakRow}>
                                <Flame color="#F59E0B" size={11} strokeWidth={2.5} />
                                <Text style={[styles.statText, { color: '#F59E0B' }]}>{friend.currentStreak}d</Text>
                              </View>
                            ) : null}
                          </View>
                          {lastActiveLabel ? (
                            <Text
                              style={[
                                styles.lastActiveText,
                                {
                                  color: lastActiveLabel === 'Active now'
                                    ? (isDark ? '#34D399' : '#059669')
                                    : theme.textTertiary,
                                },
                              ]}
                            >
                              {lastActiveLabel}
                            </Text>
                          ) : null}
                        </View>
                        <View style={styles.friendActions}>
                          <TouchableOpacity
                            style={[
                              styles.challengeButton,
                              { backgroundColor: isDark ? 'rgba(245,158,11,0.12)' : 'rgba(245,158,11,0.08)' },
                            ]}
                            onPress={() => setChallengeTarget(friendship)}
                            activeOpacity={0.8}
                            accessibilityLabel={`Challenge ${friend.username}`}
                            testID={`friends-challenge-button-${friendship.id}`}
                          >
                            <Swords color={isDark ? '#FBBF24' : '#D97706'} size={16} strokeWidth={2.2} />
                            <Text style={[styles.challengeButtonText, { color: isDark ? '#FBBF24' : '#D97706' }]}>Challenge</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => handleRemoveFriend(friendship)}
                            hitSlop={8}
                            accessibilityLabel={`Remove ${friend.username}`}
                            testID={`friends-remove-button-${friendship.id}`}
                          >
                            <Trash2 color={theme.textTertiary} size={16} strokeWidth={2.2} />
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          </ResponsiveContainer>
        </ScrollView>

        <Modal
          visible={challengeTarget !== null}
          transparent
          animationType="slide"
          onRequestClose={() => setChallengeTarget(null)}
        >
          <View style={styles.deckPickerBackdrop}>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setChallengeTarget(null)} />
            <View style={[styles.deckPickerSheet, { backgroundColor: isDark ? 'rgba(10,17,34,0.98)' : theme.cardBackground }]}>
              <View style={[styles.menuHandle, { backgroundColor: theme.sheetHandle }]} />
              <Text style={[styles.deckPickerTitle, { color: theme.text }]}>
                Pick a deck to challenge @{challengeTarget?.friend.username}
              </Text>
              <ScrollView style={styles.deckPickerScroll} showsVerticalScrollIndicator={false}>
                {challengeDecks.map((deck) => (
                  <TouchableOpacity
                    key={deck.id}
                    style={[
                      styles.deckPickerItem,
                      {
                        backgroundColor: isDark ? 'rgba(148,163,184,0.06)' : 'rgba(0,0,0,0.03)',
                        borderColor: isDark ? 'rgba(148,163,184,0.1)' : 'rgba(0,0,0,0.06)',
                      },
                    ]}
                    onPress={() => handleStartChallenge(deck.id)}
                    activeOpacity={0.8}
                    testID={`friends-challenge-deck-${deck.id}`}
                  >
                    <Text style={[styles.deckPickerDeckName, { color: theme.text }]} numberOfLines={1}>{deck.name}</Text>
                    <Text style={[styles.deckPickerCardCount, { color: theme.textSecondary }]}>{deck.flashcards.length} cards</Text>
                  </TouchableOpacity>
                ))}
                {challengeDecks.length === 0 ? (
                  <Text style={[styles.deckPickerEmpty, { color: theme.textSecondary }]}>
                    You need a deck with at least 4 cards to challenge a friend.
                  </Text>
                ) : null}
              </ScrollView>
              <TouchableOpacity
                style={[styles.deckPickerCancel, { backgroundColor: isDark ? 'rgba(148,163,184,0.1)' : 'rgba(0,0,0,0.04)' }]}
                onPress={() => setChallengeTarget(null)}
                activeOpacity={0.8}
                testID="friends-challenge-cancel"
              >
                <Text style={[styles.deckPickerCancelText, { color: theme.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
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
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  headerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
  },
  placeholder: {
    width: 40,
  },
  searchRow: {
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  shareProfileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 12,
  },
  shareProfileText: {
    fontSize: 13,
    fontWeight: '700',
  },
  searchInput: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 42,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
  },
  searchText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
    marginLeft: 4,
  },
  listCard: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 10,
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  levelBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  levelText: {
    fontSize: 12,
    fontWeight: '800',
  },
  nameColumn: {
    flex: 1,
    minWidth: 0,
  },
  username: {
    fontSize: 15,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 1,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 2,
  },
  streakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  statText: {
    fontSize: 12,
    fontWeight: '600',
  },
  lastActiveText: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  friendActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  challengeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  challengeButtonText: {
    fontSize: 12,
    fontWeight: '700',
  },
  statusText: {
    fontSize: 13,
    fontWeight: '700',
  },
  addButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(99,102,241,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  requestActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  acceptButton: {
    backgroundColor: '#10B981',
  },
  declineButton: {
    borderWidth: 1,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  emptyCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
    gap: 8,
  },
  emptyCardTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  emptyCardSubtitle: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 260,
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    paddingVertical: 16,
  },
  signInButton: {
    backgroundColor: '#6366F1',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 14,
  },
  signInButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  loader: {
    paddingVertical: 20,
  },
  deckPickerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  deckPickerSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    paddingHorizontal: 20,
    paddingBottom: 34,
    maxHeight: '70%',
  },
  menuHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  deckPickerTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 16,
    textAlign: 'center',
  },
  deckPickerScroll: {
    maxHeight: 300,
  },
  deckPickerItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  deckPickerDeckName: {
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
  },
  deckPickerCardCount: {
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 12,
  },
  deckPickerEmpty: {
    fontSize: 14,
    textAlign: 'center',
    padding: 20,
    lineHeight: 20,
  },
  deckPickerCancel: {
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 8,
  },
  deckPickerCancelText: {
    fontSize: 15,
    fontWeight: '700',
  },
});
