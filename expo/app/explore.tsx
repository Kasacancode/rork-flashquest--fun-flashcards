import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ArrowDownToLine,
  ArrowLeft,
  Compass,
  Download,
  Flag,
  Search,
  Share2,
  ThumbsDown,
  ThumbsUp,
  User,
  X,
} from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  Share as RNShare,
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
import type { Deck } from '@/types/flashcard';
import { createNormalizedFlashcard, normalizeDeck } from '@/utils/flashcardContent';
import { logger } from '@/utils/logger';
import {
  downloadMarketplaceDeck,
  fetchDeckDetail,
  fetchMarketplaceDecks,
  fetchMyPublishedDecks,
  getUserVotes,
  reportDeck,
  type MarketplaceDeck,
  type MarketplaceDeckDetail,
  type MarketplaceSortOption,
  type MyPublishedDeck,
  unpublishDeck,
  voteDeck,
} from '@/utils/marketplaceService';
import { generateUUID } from '@/utils/uuid';

const DEFAULT_CATEGORIES = ['All', 'Science', 'Math', 'Languages', 'History', 'Geography', 'Arts', 'Technology', 'Business', 'General'] as const;
const SORT_OPTIONS: { value: MarketplaceSortOption; label: string }[] = [
  { value: 'popular', label: 'Popular' },
  { value: 'top_rated', label: 'Top Rated' },
  { value: 'newest', label: 'Newest' },
];

export default function ExploreScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ deckId?: string }>();
  const queryClient = useQueryClient();
  const { theme, isDark } = useTheme();
  const { displayName, isSignedIn, user, username } = useAuth();
  const { addDeck } = useDeckContext();
  const [sort, setSort] = useState<MarketplaceSortOption>('popular');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedDeckId, setSelectedDeckId] = useState<string | null>(null);
  const [showDetail, setShowDetail] = useState<boolean>(false);
  const [showMyDecks, setShowMyDecks] = useState<boolean>(false);

  const decksQuery = useQuery({
    queryKey: ['marketplace-decks', sort, selectedCategory],
    queryFn: () => fetchMarketplaceDecks({
      sort,
      category: selectedCategory === 'All' ? undefined : selectedCategory,
      limit: 100,
    }),
  });

  const userVotesQuery = useQuery({
    queryKey: ['marketplace-votes', user?.id ?? 'guest'],
    queryFn: () => getUserVotes(user?.id ?? ''),
    enabled: Boolean(isSignedIn && user?.id),
  });

  const detailQuery = useQuery({
    queryKey: ['marketplace-deck-detail', selectedDeckId],
    queryFn: () => fetchDeckDetail(selectedDeckId ?? ''),
    enabled: Boolean(selectedDeckId),
  });

  const myDecksQuery = useQuery({
    queryKey: ['my-published-decks', user?.id],
    queryFn: () => {
      if (!user?.id) {
        return Promise.resolve([] as MyPublishedDeck[]);
      }

      return fetchMyPublishedDecks(user.id);
    },
    enabled: showMyDecks && Boolean(user?.id),
  });

  const voteMutation = useMutation({
    mutationFn: async (params: { deckId: string; vote: 1 | -1 }) => {
      if (!user?.id) {
        return false;
      }

      return voteDeck(user.id, params.deckId, params.vote);
    },
    onSuccess: async (success, variables) => {
      if (!success || !user?.id) {
        return;
      }

      queryClient.setQueryData<Record<string, 1 | -1>>(
        ['marketplace-votes', user.id],
        (current) => ({ ...(current ?? {}), [variables.deckId]: variables.vote }),
      );
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['marketplace-decks'] }),
        queryClient.invalidateQueries({ queryKey: ['marketplace-deck-detail', variables.deckId] }),
      ]);
    },
  });

  const downloadMutation = useMutation({
    mutationFn: async (deck: MarketplaceDeckDetail) => {
      const createdAt = Date.now();
      const newDeckId = `community_${generateUUID()}`;
      const flashcards = deck.deckData.map((card, index) => createNormalizedFlashcard({
        id: `community_card_${generateUUID()}_${index}`,
        question: card.question.slice(0, 500),
        answer: card.answer.slice(0, 200),
        deckId: newDeckId,
        difficulty: 'medium',
        tags: [],
        createdAt: createdAt + index,
        imageUrl: undefined,
        hint1: card.hint1,
        hint2: card.hint2,
        explanation: card.explanation,
      }));
      const downloadedAt = new Date().toISOString();
      const localDeck: Deck = {
        id: newDeckId,
        name: deck.name.slice(0, 100),
        description: deck.description.trim().length > 0 ? deck.description.trim().slice(0, 240) : `By ${deck.publisherName}`,
        color: deck.color,
        icon: deck.icon,
        flashcards,
        category: deck.category,
        createdAt,
        isCustom: true,
        communitySourceId: deck.id,
        communityDownloadedAt: downloadedAt,
      };
      const normalizedDeck = normalizeDeck(localDeck, { source: 'import', trackDiagnostics: true });
      const localDeckWithSource: Deck = {
        ...normalizedDeck,
        communitySourceId: deck.id,
        communityDownloadedAt: downloadedAt,
      };

      addDeck(localDeckWithSource);
      await downloadMarketplaceDeck(deck.id);
      return { deck: localDeckWithSource, cardCount: flashcards.length };
    },
    onSuccess: async (result) => {
      setShowDetail(false);
      setSelectedDeckId(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['marketplace-decks'] }),
        queryClient.invalidateQueries({ queryKey: ['marketplace-deck-detail'] }),
      ]);
      Alert.alert('Deck Downloaded!', `"${result.deck.name}" with ${result.cardCount} cards has been added to your decks.`);
    },
    onError: (error) => {
      logger.warn('[Explore] Marketplace download failed:', error);
      Alert.alert('Download Failed', 'Could not download this deck. Please try again.');
    },
  });

  const marketDecks = useMemo<MarketplaceDeck[]>(() => decksQuery.data ?? [], [decksQuery.data]);
  const userVotes = useMemo<Record<string, 1 | -1>>(() => userVotesQuery.data ?? {}, [userVotesQuery.data]);
  const selectedDeck = useMemo<MarketplaceDeckDetail | null>(() => detailQuery.data ?? null, [detailQuery.data]);
  const currentPublisherName = useMemo<string>(() => {
    return username?.trim() || displayName.trim() || user?.email?.split('@')[0] || 'Anonymous';
  }, [displayName, user?.email, username]);
  const currentPublisherLabel = useMemo<string>(() => {
    const trimmedUsername = username?.trim();
    return trimmedUsername ? `@${trimmedUsername}` : currentPublisherName;
  }, [currentPublisherName, username]);

  const categories = useMemo<string[]>(() => {
    const merged = new Set<string>(DEFAULT_CATEGORIES);
    for (const deck of marketDecks) {
      if (deck.category.trim().length > 0) {
        merged.add(deck.category);
      }
    }

    return Array.from(merged);
  }, [marketDecks]);

  const filteredDecks = useMemo<MarketplaceDeck[]>(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    if (!normalizedQuery) {
      return marketDecks;
    }

    return marketDecks.filter((deck) => {
      return deck.name.toLowerCase().includes(normalizedQuery)
        || deck.description.toLowerCase().includes(normalizedQuery)
        || deck.publisherName.toLowerCase().includes(normalizedQuery);
    });
  }, [marketDecks, searchQuery]);

  useEffect(() => {
    if (params.deckId && typeof params.deckId === 'string') {
      setSelectedDeckId(params.deckId);
      setShowDetail(true);
    }
  }, [params.deckId]);

  const handleRefresh = useCallback(async () => {
    await Promise.all([
      decksQuery.refetch(),
      userVotesQuery.refetch(),
      selectedDeckId ? detailQuery.refetch() : Promise.resolve(),
      showMyDecks ? myDecksQuery.refetch() : Promise.resolve(),
    ]);
  }, [decksQuery, detailQuery, myDecksQuery, selectedDeckId, showMyDecks, userVotesQuery]);

  const handleOpenDetail = useCallback((deck: MarketplaceDeck) => {
    setSelectedDeckId(deck.id);
    setShowDetail(true);
  }, []);

  const handleCloseDetail = useCallback(() => {
    setShowDetail(false);
    setSelectedDeckId(null);
  }, []);

  const handleVote = useCallback((deckId: string, vote: 1 | -1) => {
    if (!isSignedIn || !user?.id) {
      Alert.alert('Sign In Required', 'You need to sign in to vote on decks.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign In', onPress: () => router.push('/auth') },
      ]);
      return;
    }

    voteMutation.mutate({ deckId, vote });
  }, [isSignedIn, router, user?.id, voteMutation]);

  const handleDownload = useCallback(() => {
    if (!selectedDeck) {
      return;
    }

    downloadMutation.mutate(selectedDeck);
  }, [downloadMutation, selectedDeck]);

  const handleReport = useCallback((deckId: string) => {
    if (!isSignedIn || !user?.id) {
      Alert.alert('Sign In Required', 'You need to sign in to report a deck.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign In', onPress: () => router.push('/auth') },
      ]);
      return;
    }

    Alert.alert(
      'Report Deck',
      'Why are you reporting this deck?',
      [
        {
          text: 'Inappropriate Content',
          onPress: async () => {
            const result = await reportDeck(user.id, deckId, 'inappropriate', '');
            Alert.alert(
              result.success ? 'Report Submitted' : 'Report Failed',
              result.success
                ? 'Thanks for keeping the community safe. We will review this deck.'
                : result.error ?? 'Please try again.',
            );
          },
        },
        {
          text: 'Spam or Low Quality',
          onPress: async () => {
            const result = await reportDeck(user.id, deckId, 'spam', '');
            Alert.alert(
              result.success ? 'Report Submitted' : 'Report Failed',
              result.success
                ? 'Thanks for the feedback. We will review this deck.'
                : result.error ?? 'Please try again.',
            );
          },
        },
        {
          text: 'Copied or Stolen Content',
          onPress: async () => {
            const result = await reportDeck(user.id, deckId, 'copied_content', '');
            Alert.alert(
              result.success ? 'Report Submitted' : 'Report Failed',
              result.success
                ? 'Thanks for the feedback. We will review this deck.'
                : result.error ?? 'Please try again.',
            );
          },
        },
        {
          text: 'Wrong or Misleading Answers',
          onPress: async () => {
            const result = await reportDeck(user.id, deckId, 'inaccurate', '');
            Alert.alert(
              result.success ? 'Report Submitted' : 'Report Failed',
              result.success
                ? 'Thanks for the feedback. We will review this deck.'
                : result.error ?? 'Please try again.',
            );
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ],
    );
  }, [isSignedIn, router, user?.id]);

  const handleShareDeck = useCallback(async () => {
    if (!selectedDeck) {
      return;
    }

    const message = `Check out "${selectedDeck.name}" on FlashQuest!\n${selectedDeck.cardCount} cards by ${selectedDeck.publisherName}\n\nflashquest://explore?deckId=${selectedDeck.id}`;

    try {
      await RNShare.share({
        message,
        title: `FlashQuest: ${selectedDeck.name}`,
      });
    } catch {
    }
  }, [selectedDeck]);

  const cardBg = isDark ? 'rgba(11, 20, 37, 0.84)' : 'rgba(255, 255, 255, 0.9)';
  const cardBorder = isDark ? 'rgba(148, 163, 184, 0.12)' : 'rgba(148, 163, 184, 0.18)';
  const headerTextColor = isDark ? '#F8FAFC' : '#173A71';
  const chipActiveBg = isDark ? 'rgba(99,102,241,0.2)' : 'rgba(99,102,241,0.12)';
  const chipInactiveBg = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.04)';
  const inputBg = isDark ? 'rgba(15, 23, 42, 0.64)' : 'rgba(255, 255, 255, 0.72)';
  const selectedVote = selectedDeckId ? userVotes[selectedDeckId] : undefined;
  const detailNetVotes = selectedDeck ? selectedDeck.upVotes - selectedDeck.downVotes : 0;
  const isRefreshing = decksQuery.isRefetching && !decksQuery.isLoading;

  return (
    <View style={styles.container} testID="explore-screen">
      <LinearGradient
        colors={isDark ? ['#09111f', '#11203a', '#0a1323'] : ['#f7fbff', '#e6efff', '#eef0ff']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
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
            accessibilityRole="button"
            testID="explore-back-button"
          >
            <ArrowLeft color={headerTextColor} size={22} strokeWidth={2.5} />
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
            <Compass color={isDark ? '#818CF8' : '#6366F1'} size={20} strokeWidth={2.35} />
            <Text style={[styles.headerTitle, { color: headerTextColor }]}>Explore</Text>
          </View>

          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.searchRow}>
          <View style={[styles.searchInput, { backgroundColor: inputBg, borderColor: cardBorder }]}> 
            <Search color={theme.textTertiary} size={16} strokeWidth={2.2} />
            <TextInput
              style={[styles.searchText, { color: theme.text }]}
              placeholder="Search community decks..."
              placeholderTextColor={theme.textTertiary}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              autoCorrect={false}
              testID="explore-search-input"
            />
            {searchQuery.length > 0 ? (
              <TouchableOpacity
                onPress={() => setSearchQuery('')}
                accessibilityRole="button"
                accessibilityLabel="Clear search"
                testID="explore-clear-search-button"
              >
                <X color={theme.textTertiary} size={16} strokeWidth={2.2} />
              </TouchableOpacity>
            ) : null}
          </View>

          {isSignedIn ? (
            <TouchableOpacity
              style={[
                styles.myDecksButton,
                {
                  backgroundColor: isDark ? 'rgba(99,102,241,0.12)' : 'rgba(99,102,241,0.08)',
                  borderColor: isDark ? 'rgba(99,102,241,0.25)' : 'rgba(99,102,241,0.15)',
                },
              ]}
              onPress={() => setShowMyDecks(true)}
              activeOpacity={0.8}
              testID="explore-my-decks-button"
            >
              <User color={theme.primary} size={15} strokeWidth={2.2} />
              <Text style={[styles.myDecksButtonText, { color: theme.primary }]}>My Decks</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={styles.filtersWrap}>
          <Text style={[styles.filterSectionLabel, { color: theme.textTertiary }]}>BROWSE BY TOPIC</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryRow}
            style={styles.categoryScroll}
          >
            {categories.map((category) => {
              const isActive = selectedCategory === category;
              return (
                <TouchableOpacity
                  key={category}
                  style={[
                    styles.categoryChip,
                    {
                      backgroundColor: isActive ? chipActiveBg : chipInactiveBg,
                      borderColor: isActive ? 'rgba(99,102,241,0.3)' : 'transparent',
                    },
                  ]}
                  onPress={() => setSelectedCategory(category)}
                  activeOpacity={0.82}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isActive }}
                  testID={`explore-category-${category.replace(/\s+/g, '-').toLowerCase()}`}
                >
                  <Text style={[styles.categoryChipText, { color: isActive ? (isDark ? '#818CF8' : '#6366F1') : theme.textSecondary }]}>{category}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <View style={[styles.filterDivider, { backgroundColor: theme.border }]} />
          <Text style={[styles.filterSectionLabel, { color: theme.textTertiary }]}>SORT BY</Text>
          <View
            style={[
              styles.sortGroup,
              {
                backgroundColor: isDark ? 'rgba(148,163,184,0.06)' : 'rgba(0,0,0,0.03)',
                borderColor: isDark ? 'rgba(148,163,184,0.1)' : 'rgba(0,0,0,0.06)',
              },
            ]}
          >
            {SORT_OPTIONS.map((option) => {
              const isActive = sort === option.value;
              return (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.sortOption,
                    isActive
                      ? { backgroundColor: isDark ? 'rgba(99,102,241,0.15)' : 'rgba(99,102,241,0.1)' }
                      : null,
                  ]}
                  onPress={() => setSort(option.value)}
                  activeOpacity={0.82}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isActive }}
                  testID={`explore-sort-${option.value}`}
                >
                  <Text
                    style={[
                      styles.sortOptionText,
                      {
                        color: isActive ? theme.primary : theme.textSecondary,
                        fontWeight: isActive ? '700' : '600',
                      },
                    ]}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <Text style={[styles.resultCount, { color: theme.textTertiary }]}> 
          {filteredDecks.length} {filteredDecks.length === 1 ? 'deck' : 'decks'}
          {selectedCategory !== 'All' ? ` in ${selectedCategory}` : ''}
        </Text>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={(
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor={theme.primary}
              colors={[theme.primary]}
            />
          )}
          showsVerticalScrollIndicator={false}
          testID="explore-scroll-view"
        >
          <ResponsiveContainer maxWidth={760}>
            {decksQuery.isLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator color={theme.primary} size="large" />
              </View>
            ) : filteredDecks.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Compass color={theme.textTertiary} size={48} strokeWidth={1.6} />
                <Text style={[styles.emptyTitle, { color: theme.text }]}>No decks found</Text>
                <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
                  {searchQuery.trim().length > 0
                    ? 'Try a different search term.'
                    : 'Be the first to publish a deck in this category!'}
                </Text>
              </View>
            ) : (
              <View style={styles.deckList}>
                {filteredDecks.map((deck) => {
                  const netVotes = deck.upVotes - deck.downVotes;
                  const currentVote = userVotes[deck.id];
                  const isDetailLoading = showDetail && selectedDeckId === deck.id && detailQuery.isFetching;

                  return (
                    <Pressable
                      key={deck.id}
                      style={({ pressed }) => [
                        styles.deckCard,
                        { backgroundColor: cardBg, borderColor: cardBorder },
                        pressed ? styles.deckCardPressed : null,
                      ]}
                      onPress={() => handleOpenDetail(deck)}
                      accessibilityRole="button"
                      testID={`explore-deck-${deck.id}`}
                    >
                      <View style={[styles.deckColorStripe, { backgroundColor: deck.color }]} />
                      <View style={styles.deckCardContent}>
                        <View style={styles.deckCardHeader}>
                          <Text style={[styles.deckName, { color: theme.text }]} numberOfLines={1}>{deck.name}</Text>
                          <View style={[styles.categoryBadge, { backgroundColor: `${deck.color}18` }]}>
                            <Text style={[styles.categoryBadgeText, { color: deck.color }]}>{deck.category}</Text>
                          </View>
                        </View>
                        <Pressable
                          onPress={(event) => {
                            event.stopPropagation();
                            setSelectedCategory('All');
                            setSearchQuery(deck.publisherName);
                          }}
                          accessibilityRole="button"
                          testID={`explore-author-${deck.id}`}
                        >
                          <Text style={[styles.publisherName, { color: theme.textSecondary }]} numberOfLines={1}>by {deck.publisherName}</Text>
                        </Pressable>
                        {deck.description.length > 0 ? (
                          <Text style={[styles.deckDescription, { color: theme.textSecondary }]} numberOfLines={2}>{deck.description}</Text>
                        ) : null}
                        <View style={styles.deckMeta}>
                          <Text style={[styles.metaText, { color: theme.textTertiary }]}>{deck.cardCount} cards</Text>
                          <View style={styles.metaItem}>
                            <ArrowDownToLine color={theme.textTertiary} size={12} strokeWidth={2.2} />
                            <Text style={[styles.metaText, { color: theme.textTertiary }]}>{deck.downloads}</Text>
                          </View>
                          <View style={styles.metaItem}>
                            <ThumbsUp
                              color={netVotes > 0 ? '#10B981' : theme.textTertiary}
                              size={12}
                              strokeWidth={2.2}
                              fill={currentVote === 1 ? '#10B981' : 'none'}
                            />
                            <Text
                              style={[
                                styles.metaText,
                                { color: netVotes > 0 ? '#10B981' : netVotes < 0 ? '#EF4444' : theme.textTertiary },
                              ]}
                            >
                              {netVotes > 0 ? `+${netVotes}` : String(netVotes)}
                            </Text>
                          </View>
                        </View>
                      </View>
                      {isDetailLoading ? <ActivityIndicator color={theme.primary} size="small" style={styles.cardSpinner} /> : null}
                    </Pressable>
                  );
                })}
              </View>
            )}
          </ResponsiveContainer>
        </ScrollView>

        <Modal visible={showMyDecks} transparent animationType="slide" onRequestClose={() => setShowMyDecks(false)}>
          <View style={styles.myDecksBackdrop}>
            <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setShowMyDecks(false)} />
            <View style={[styles.myDecksSheet, { backgroundColor: isDark ? 'rgba(10,17,34,0.98)' : theme.cardBackground }]}> 
              <View style={[styles.myDecksHandle, { backgroundColor: theme.sheetHandle }]} />
              <Text style={[styles.myDecksTitle, { color: theme.text }]}>My Published Decks</Text>

              {myDecksQuery.isLoading ? (
                <ActivityIndicator color={theme.primary} size="large" style={styles.myDecksLoading} />
              ) : !myDecksQuery.data?.length ? (
                <View style={styles.myDecksEmpty}>
                  <Text style={[styles.myDecksEmptyText, { color: theme.textSecondary }]}> 
                    You haven't published any decks yet.{"\n"}Open a deck and tap Publish to share it with the community.
                  </Text>
                </View>
              ) : (
                <ScrollView style={styles.myDecksList} showsVerticalScrollIndicator={false}>
                  {myDecksQuery.data.map((deck) => (
                    <View
                      key={deck.id}
                      style={[
                        styles.myDeckCard,
                        {
                          backgroundColor: isDark ? 'rgba(148,163,184,0.06)' : 'rgba(0,0,0,0.02)',
                          borderColor: isDark ? 'rgba(148,163,184,0.1)' : 'rgba(0,0,0,0.06)',
                        },
                      ]}
                    >
                      {deck.status === 'hidden' ? (
                        <View
                          style={[
                            styles.hiddenBadge,
                            { backgroundColor: isDark ? 'rgba(239,68,68,0.12)' : 'rgba(239,68,68,0.08)' },
                          ]}
                        >
                          <Text style={[styles.hiddenBadgeText, { color: theme.error }]}>Hidden - reported by community</Text>
                        </View>
                      ) : null}
                      {deck.publisherName !== currentPublisherName && currentPublisherName.trim().length > 0 ? (
                        <TouchableOpacity
                          style={[
                            styles.fixNameButton,
                            { backgroundColor: isDark ? 'rgba(245,158,11,0.1)' : 'rgba(245,158,11,0.06)' },
                          ]}
                          onPress={async () => {
                            if (!user?.id) {
                              return;
                            }

                            const { error } = await supabase
                              .from('public_decks')
                              .update({ publisher_name: currentPublisherName, updated_at: new Date().toISOString() })
                              .eq('id', deck.id);

                            if (error) {
                              logger.warn('[Explore] Failed to update stale publisher name:', error.message);
                              Alert.alert('Update Failed', 'Could not refresh the publisher name right now.');
                              return;
                            }

                            await Promise.all([
                              myDecksQuery.refetch(),
                              queryClient.invalidateQueries({ queryKey: ['marketplace-decks'] }),
                              queryClient.invalidateQueries({ queryKey: ['marketplace-deck-detail', deck.id] }),
                            ]);
                          }}
                          activeOpacity={0.8}
                          testID={`my-deck-fix-name-${deck.id}`}
                        >
                          <Text style={[styles.fixNameText, { color: theme.warning }]}>Showing as "{deck.publisherName}" - tap to update to {currentPublisherLabel}</Text>
                        </TouchableOpacity>
                      ) : null}
                      <Text style={[styles.myDeckName, { color: theme.text }]} numberOfLines={1}>{deck.name}</Text>
                      <Text style={[styles.myDeckMeta, { color: theme.textSecondary }]}>
                        {deck.cardCount} cards · {deck.downloads} downloads · {deck.upVotes - deck.downVotes} votes
                      </Text>
                      <Text style={[styles.myDeckCategory, { color: theme.textTertiary }]}>

                        {deck.category} · Published {new Date(deck.createdAt).toLocaleDateString()}
                      </Text>

                      <View style={styles.myDeckActions}>
                        <TouchableOpacity
                          style={[styles.myDeckActionButton, { backgroundColor: isDark ? 'rgba(99,102,241,0.1)' : 'rgba(99,102,241,0.06)' }]}
                          onPress={() => {
                            setShowMyDecks(false);
                            setSelectedDeckId(deck.id);
                            setShowDetail(true);
                          }}
                          activeOpacity={0.8}
                          testID={`my-deck-view-${deck.id}`}
                        >
                          <Text style={[styles.myDeckActionText, { color: theme.primary }]}>View</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.myDeckActionButton, { backgroundColor: isDark ? 'rgba(239,68,68,0.08)' : 'rgba(239,68,68,0.05)' }]}
                          onPress={() => {
                            Alert.alert('Unpublish Deck', `Remove "${deck.name}" from the community?`, [
                              { text: 'Cancel', style: 'cancel' },
                              {
                                text: 'Unpublish',
                                style: 'destructive',
                                onPress: async () => {
                                  if (!user?.id) {
                                    return;
                                  }

                                  const result = await unpublishDeck(user.id, deck.name);
                                  if (result.success) {
                                    await Promise.all([
                                      myDecksQuery.refetch(),
                                      queryClient.invalidateQueries({ queryKey: ['marketplace-decks'] }),
                                      queryClient.invalidateQueries({ queryKey: ['marketplace-deck-detail', deck.id] }),
                                    ]);
                                  } else {
                                    Alert.alert('Unpublish Failed', result.error ?? 'Could not unpublish this deck.');
                                  }
                                },
                              },
                            ]);
                          }}
                          activeOpacity={0.8}
                          testID={`my-deck-unpublish-${deck.id}`}
                        >
                          <Text style={[styles.myDeckActionText, { color: theme.error }]}>Unpublish</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </ScrollView>
              )}
            </View>
          </View>
        </Modal>

        <Modal visible={showDetail} transparent animationType="slide" onRequestClose={handleCloseDetail}>
          <View style={styles.detailBackdrop}>
            <Pressable style={StyleSheet.absoluteFillObject} onPress={handleCloseDetail} />
            <View style={[styles.detailSheet, { backgroundColor: isDark ? '#0F172A' : '#FFFFFF' }]}>
              {detailQuery.isLoading || detailQuery.isFetching && !selectedDeck ? (
                <View style={styles.detailLoadingState}>
                  <ActivityIndicator color={theme.primary} size="large" />
                </View>
              ) : selectedDeck ? (
                <>
                  <View style={styles.detailHeader}>
                    <View style={[styles.detailColorDot, { backgroundColor: selectedDeck.color }]} />
                    <View style={styles.detailHeaderText}>
                      <Text style={[styles.detailTitle, { color: theme.text }]} numberOfLines={2}>{selectedDeck.name}</Text>
                      <Text style={[styles.detailPublisher, { color: theme.textSecondary }]}>by {selectedDeck.publisherName}</Text>
                    </View>
                    <TouchableOpacity
                      onPress={handleCloseDetail}
                      accessibilityRole="button"
                      accessibilityLabel="Close details"
                      testID="explore-close-detail-button"
                    >
                      <X color={theme.textSecondary} size={22} strokeWidth={2.2} />
                    </TouchableOpacity>
                  </View>

                  {selectedDeck.description.length > 0 ? (
                    <Text style={[styles.detailDescription, { color: theme.textSecondary }]}>{selectedDeck.description}</Text>
                  ) : null}

                  <View style={styles.detailStats}>
                    <View style={styles.detailStat}>
                      <Text style={[styles.detailStatValue, { color: theme.text }]}>{selectedDeck.cardCount}</Text>
                      <Text style={[styles.detailStatLabel, { color: theme.textTertiary }]}>Cards</Text>
                    </View>
                    <View style={styles.detailStat}>
                      <Text style={[styles.detailStatValue, { color: theme.text }]}>{selectedDeck.downloads}</Text>
                      <Text style={[styles.detailStatLabel, { color: theme.textTertiary }]}>Downloads</Text>
                    </View>
                    <View style={styles.detailStat}>
                      <Text style={[styles.detailStatValue, { color: detailNetVotes >= 0 ? '#10B981' : '#EF4444' }]}>
                        {detailNetVotes > 0 ? `+${detailNetVotes}` : String(detailNetVotes)}
                      </Text>
                      <Text style={[styles.detailStatLabel, { color: theme.textTertiary }]}>Rating</Text>
                    </View>
                  </View>

                  {selectedDeck.deckData.length > 0 ? (
                    <View style={[styles.previewSection, { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.03)' }]}>
                      <Text style={[styles.previewLabel, { color: theme.textSecondary }]}>Preview</Text>
                      {selectedDeck.deckData.slice(0, 3).map((card, index) => (
                        <View
                          key={`${selectedDeck.id}_preview_${index}`}
                          style={[
                            styles.previewCard,
                            {
                              borderBottomColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.06)',
                              borderBottomWidth: index < Math.min(selectedDeck.deckData.length, 3) - 1 ? StyleSheet.hairlineWidth : 0,
                            },
                          ]}
                        >
                          <Text style={[styles.previewQuestion, { color: theme.text }]} numberOfLines={1}>{card.question}</Text>
                          <Text style={[styles.previewAnswer, { color: theme.textSecondary }]} numberOfLines={1}>{card.answer}</Text>
                        </View>
                      ))}
                    </View>
                  ) : null}

                  <View style={styles.detailActions}>
                    <TouchableOpacity
                      style={[styles.downloadButton, { opacity: downloadMutation.isPending ? 0.6 : 1 }]}
                      onPress={handleDownload}
                      disabled={downloadMutation.isPending}
                      activeOpacity={0.86}
                      testID="explore-download-button"
                    >
                      <Download color="#FFFFFF" size={18} strokeWidth={2.5} />
                      <Text style={styles.downloadButtonText}>{downloadMutation.isPending ? 'Downloading...' : 'Download Deck'}</Text>
                    </TouchableOpacity>

                    <View style={styles.voteRow}>
                      <TouchableOpacity
                        style={[styles.voteButton, { borderColor: cardBorder }]}
                        onPress={handleShareDeck}
                        activeOpacity={0.8}
                        accessibilityLabel="Share this deck"
                        testID="explore-share-button"
                      >
                        <Share2 color={theme.textSecondary} size={18} strokeWidth={2.2} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.voteButton,
                          { borderColor: cardBorder },
                          selectedVote === 1 ? styles.voteButtonActive : null,
                        ]}
                        onPress={() => handleVote(selectedDeck.id, 1)}
                        activeOpacity={0.82}
                        testID="explore-vote-up-button"
                      >
                        <ThumbsUp
                          color={selectedVote === 1 ? '#10B981' : theme.textSecondary}
                          size={18}
                          strokeWidth={2.2}
                          fill={selectedVote === 1 ? '#10B981' : 'none'}
                        />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.voteButton,
                          { borderColor: cardBorder },
                          selectedVote === -1 ? styles.voteButtonActive : null,
                        ]}
                        onPress={() => handleVote(selectedDeck.id, -1)}
                        activeOpacity={0.82}
                        testID="explore-vote-down-button"
                      >
                        <ThumbsDown
                          color={selectedVote === -1 ? '#EF4444' : theme.textSecondary}
                          size={18}
                          strokeWidth={2.2}
                          fill={selectedVote === -1 ? '#EF4444' : 'none'}
                        />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.voteButton, { borderColor: cardBorder }]}
                        onPress={() => selectedDeckId && handleReport(selectedDeckId)}
                        activeOpacity={0.8}
                        accessibilityLabel="Report this deck"
                        testID="explore-report-button"
                      >
                        <Flag color={theme.textSecondary} size={18} strokeWidth={2.2} />
                      </TouchableOpacity>
                    </View>
                  </View>
                </>
              ) : (
                <View style={styles.detailLoadingState}>
                  <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>Could not load deck details.</Text>
                </View>
              )}
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
  headerSpacer: {
    width: 40,
    height: 40,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 44,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
  },
  myDecksButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
  },
  myDecksButtonText: {
    fontSize: 13,
    fontWeight: '700' as const,
  },
  filtersWrap: {
    paddingHorizontal: 16,
  },
  filterSectionLabel: {
    fontSize: 10,
    fontWeight: '800' as const,
    letterSpacing: 1.5,
    marginBottom: 8,
    marginTop: 4,
  },
  filterDivider: {
    height: 1,
    marginVertical: 12,
    opacity: 0.3,
  },
  searchText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
  },
  categoryScroll: {
    maxHeight: 42,
    marginBottom: 8,
  },
  categoryRow: {
    paddingHorizontal: 16,
    gap: 8,
  },
  categoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  categoryChipText: {
    fontSize: 13,
    fontWeight: '700',
  },
  sortRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 6,
    marginBottom: 10,
  },
  sortButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  sortText: {
    fontSize: 12,
    fontWeight: '700' as const,
  },
  sortGroup: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: 1,
    padding: 3,
    marginBottom: 16,
  },
  sortOption: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 10,
  },
  sortOptionText: {
    fontSize: 13,
  },
  resultCount: {
    paddingHorizontal: 16,
    marginBottom: 10,
    fontSize: 12,
    fontWeight: '600' as const,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  loadingContainer: {
    paddingVertical: 80,
    alignItems: 'center',
  },
  emptyContainer: {
    paddingVertical: 72,
    alignItems: 'center',
    gap: 10,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  emptySubtitle: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 280,
  },
  deckList: {
    gap: 10,
  },
  deckCard: {
    flexDirection: 'row',
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
  },
  deckCardPressed: {
    opacity: 0.9,
  },
  deckColorStripe: {
    width: 5,
  },
  deckCardContent: {
    flex: 1,
    padding: 14,
  },
  deckCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 3,
  },
  deckName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '800',
  },
  categoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  categoryBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  publisherName: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 4,
  },
  deckDescription: {
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
    marginBottom: 8,
  },
  deckMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    flexWrap: 'wrap',
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    fontWeight: '600',
  },
  cardSpinner: {
    marginRight: 14,
    alignSelf: 'center',
  },
  myDecksBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  myDecksSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    paddingHorizontal: 20,
    paddingBottom: 34,
    maxHeight: '80%',
  },
  myDecksHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  myDecksTitle: {
    fontSize: 18,
    fontWeight: '800' as const,
    marginBottom: 16,
  },
  myDecksLoading: {
    marginVertical: 40,
  },
  myDecksList: {
    maxHeight: 400,
  },
  myDecksEmpty: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  myDecksEmptyText: {
    fontSize: 14,
    textAlign: 'center' as const,
    lineHeight: 20,
  },
  myDeckCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    marginBottom: 10,
  },
  myDeckName: {
    fontSize: 16,
    fontWeight: '700' as const,
    marginBottom: 4,
  },
  myDeckMeta: {
    fontSize: 13,
    fontWeight: '600' as const,
    marginBottom: 2,
  },
  myDeckCategory: {
    fontSize: 12,
    fontWeight: '600' as const,
    marginBottom: 12,
  },
  myDeckActions: {
    flexDirection: 'row',
    gap: 8,
  },
  myDeckActionButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 10,
  },
  myDeckActionText: {
    fontSize: 13,
    fontWeight: '700' as const,
  },
  hiddenBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    marginBottom: 8,
    alignSelf: 'flex-start',
  },
  hiddenBadgeText: {
    fontSize: 11,
    fontWeight: '700' as const,
  },
  fixNameButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  fixNameText: {
    fontSize: 11,
    fontWeight: '600' as const,
  },
  detailBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  detailSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 32,
    maxHeight: '86%',
  },
  detailLoadingState: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 16,
  },
  detailColorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: 6,
  },
  detailHeaderText: {
    flex: 1,
  },
  detailTitle: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 4,
  },
  detailPublisher: {
    fontSize: 14,
    fontWeight: '500',
  },
  detailDescription: {
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
    marginBottom: 16,
  },
  detailStats: {
    flexDirection: 'row',
    gap: 20,
    marginBottom: 16,
  },
  detailStat: {
    alignItems: 'center',
  },
  detailStatValue: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 2,
  },
  detailStatLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  previewSection: {
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
  },
  previewLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  previewCard: {
    paddingVertical: 8,
  },
  previewQuestion: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  previewAnswer: {
    fontSize: 13,
    fontWeight: '500',
  },
  detailActions: {
    gap: 12,
  },
  downloadButton: {
    backgroundColor: '#6366F1',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    height: 52,
    borderRadius: 16,
  },
  downloadButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  voteRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
  },
  voteButton: {
    width: 48,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  voteButtonActive: {
    backgroundColor: 'rgba(99,102,241,0.08)',
  },
});
