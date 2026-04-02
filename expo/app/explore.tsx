import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import {
  ArrowDownToLine,
  ArrowLeft,
  Compass,
  Download,
  Search,
  ThumbsDown,
  ThumbsUp,
  X,
} from 'lucide-react-native';
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import ResponsiveContainer from '@/components/ResponsiveContainer';
import { useAuth } from '@/context/AuthContext';
import { useFlashQuest } from '@/context/FlashQuestContext';
import { useTheme } from '@/context/ThemeContext';
import type { Deck } from '@/types/flashcard';
import { createNormalizedFlashcard, normalizeDeck } from '@/utils/flashcardContent';
import { logger } from '@/utils/logger';
import {
  downloadMarketplaceDeck,
  fetchDeckDetail,
  fetchMarketplaceDecks,
  getUserVotes,
  type MarketplaceDeck,
  type MarketplaceDeckDetail,
  type MarketplaceSortOption,
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
  const queryClient = useQueryClient();
  const { theme, isDark } = useTheme();
  const { isSignedIn, user } = useAuth();
  const { addDeck } = useFlashQuest();
  const [sort, setSort] = useState<MarketplaceSortOption>('popular');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedDeckId, setSelectedDeckId] = useState<string | null>(null);
  const [showDetail, setShowDetail] = useState<boolean>(false);

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
      };
      const normalizedDeck = normalizeDeck(localDeck, { source: 'import', trackDiagnostics: true });

      addDeck(normalizedDeck);
      await downloadMarketplaceDeck(deck.id);
      return { deck: normalizedDeck, cardCount: flashcards.length };
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

  const handleRefresh = useCallback(async () => {
    await Promise.all([
      decksQuery.refetch(),
      userVotesQuery.refetch(),
      selectedDeckId ? detailQuery.refetch() : Promise.resolve(),
    ]);
  }, [decksQuery, detailQuery, selectedDeckId, userVotesQuery]);

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
        </View>

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

        <View style={styles.sortRow}>
          {SORT_OPTIONS.map((option) => {
            const isActive = sort === option.value;
            return (
              <TouchableOpacity
                key={option.value}
                style={[styles.sortButton, { backgroundColor: isActive ? chipActiveBg : 'transparent' }]}
                onPress={() => setSort(option.value)}
                activeOpacity={0.82}
                accessibilityRole="button"
                accessibilityState={{ selected: isActive }}
                testID={`explore-sort-${option.value}`}
              >
                <Text style={[styles.sortText, { color: isActive ? (isDark ? '#818CF8' : '#6366F1') : theme.textSecondary }]}>{option.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

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
                    <TouchableOpacity
                      key={deck.id}
                      style={[styles.deckCard, { backgroundColor: cardBg, borderColor: cardBorder }]}
                      onPress={() => handleOpenDetail(deck)}
                      activeOpacity={0.86}
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
                        <Text style={[styles.publisherName, { color: theme.textTertiary }]} numberOfLines={1}>by {deck.publisherName}</Text>
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
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </ResponsiveContainer>
        </ScrollView>

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
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  searchInput: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 44,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
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
    fontWeight: '700',
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
