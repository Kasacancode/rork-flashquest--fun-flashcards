import AsyncStorage from '@react-native-async-storage/async-storage';

import { supabase } from '@/lib/supabase';
import { logger } from '@/utils/logger';

const DOWNLOAD_COUNTS_KEY = 'flashquest_published_deck_downloads';

export type MarketplaceSortOption = 'popular' | 'top_rated' | 'newest';

export interface MarketplaceDeckCardData {
  question: string;
  answer: string;
  hint1?: string;
  hint2?: string;
  explanation?: string;
}

export interface MarketplaceDeck {
  id: string;
  userId: string;
  publisherName: string;
  name: string;
  description: string;
  category: string;
  color: string;
  icon: string;
  cardCount: number;
  downloads: number;
  upVotes: number;
  downVotes: number;
  createdAt: string;
}

export interface MarketplaceDeckDetail extends MarketplaceDeck {
  deckData: MarketplaceDeckCardData[];
}

interface PublicDeckRow {
  id: string;
  user_id: string;
  publisher_name: string | null;
  name: string;
  description: string | null;
  category: string | null;
  color: string | null;
  icon: string | null;
  card_count: number | null;
  downloads: number | null;
  up_votes: number | null;
  down_votes: number | null;
  created_at: string | null;
  deck_data?: unknown;
}

interface DeckVoteRow {
  deck_id: string;
  vote: number;
}

interface PublishedDeckDownloadRow {
  id: string;
  name: string;
  downloads: number | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function mapMarketplaceRow(row: PublicDeckRow): MarketplaceDeck {
  return {
    id: row.id,
    userId: row.user_id,
    publisherName: row.publisher_name?.trim() || 'Anonymous',
    name: row.name,
    description: row.description?.trim() ?? '',
    category: row.category?.trim() || 'General',
    color: row.color?.trim() || '#6366F1',
    icon: row.icon?.trim() || 'book-open',
    cardCount: row.card_count ?? 0,
    downloads: row.downloads ?? 0,
    upVotes: row.up_votes ?? 0,
    downVotes: row.down_votes ?? 0,
    createdAt: row.created_at ?? '',
  };
}

function parseDeckData(rawDeckData: unknown): MarketplaceDeckCardData[] {
  if (!Array.isArray(rawDeckData)) {
    return [];
  }

  return rawDeckData
    .filter((card): card is Record<string, unknown> => isRecord(card))
    .map((card) => ({
      question: typeof card.question === 'string' ? card.question.trim() : '',
      answer: typeof card.answer === 'string' ? card.answer.trim() : '',
      hint1: typeof card.hint1 === 'string' && card.hint1.trim().length > 0 ? card.hint1.trim() : undefined,
      hint2: typeof card.hint2 === 'string' && card.hint2.trim().length > 0 ? card.hint2.trim() : undefined,
      explanation: typeof card.explanation === 'string' && card.explanation.trim().length > 0 ? card.explanation.trim() : undefined,
    }))
    .filter((card) => card.question.length > 0 && card.answer.length > 0);
}

export async function fetchMarketplaceDecks(options: {
  sort: MarketplaceSortOption;
  category?: string;
  limit?: number;
}): Promise<MarketplaceDeck[]> {
  try {
    const { sort, category, limit = 50 } = options;

    let query = supabase
      .from('public_decks')
      .select('id, user_id, publisher_name, name, description, category, color, icon, card_count, downloads, up_votes, down_votes, created_at');

    if (category && category.trim().length > 0) {
      query = query.eq('category', category);
    }

    switch (sort) {
      case 'top_rated':
        query = query.order('up_votes', { ascending: false }).order('downloads', { ascending: false });
        break;
      case 'newest':
        query = query.order('created_at', { ascending: false });
        break;
      case 'popular':
      default:
        query = query.order('downloads', { ascending: false }).order('up_votes', { ascending: false });
        break;
    }

    const { data, error } = await query.limit(limit);

    if (error) {
      logger.warn('[Marketplace] Failed to fetch deck list:', error.message);
      return [];
    }

    return ((data ?? []) as PublicDeckRow[]).map((row) => mapMarketplaceRow(row));
  } catch (error) {
    logger.warn('[Marketplace] Unexpected deck list error:', error);
    return [];
  }
}

export async function fetchDeckDetail(deckId: string): Promise<MarketplaceDeckDetail | null> {
  try {
    const { data, error } = await supabase
      .from('public_decks')
      .select('*')
      .eq('id', deckId)
      .maybeSingle();

    if (error || !data) {
      logger.warn('[Marketplace] Failed to fetch deck detail:', error?.message ?? 'missing row');
      return null;
    }

    const row = data as PublicDeckRow;
    return {
      ...mapMarketplaceRow(row),
      deckData: parseDeckData(row.deck_data),
    };
  } catch (error) {
    logger.warn('[Marketplace] Unexpected deck detail error:', error);
    return null;
  }
}

export async function downloadMarketplaceDeck(deckId: string): Promise<void> {
  try {
    const { error } = await supabase.rpc('increment_deck_downloads', { target_deck_id: deckId });

    if (error) {
      logger.warn('[Marketplace] Failed to increment download count:', error.message);
    }
  } catch (error) {
    logger.warn('[Marketplace] Unexpected download count error:', error);
  }
}

export async function voteDeck(userId: string, deckId: string, vote: 1 | -1): Promise<boolean> {
  try {
    const { error } = await supabase.rpc('cast_deck_vote', {
      p_user_id: userId,
      p_deck_id: deckId,
      p_vote: vote,
    });

    if (error) {
      logger.warn('[Marketplace] Failed to cast vote:', error.message);
      return false;
    }

    return true;
  } catch (error) {
    logger.warn('[Marketplace] Unexpected vote error:', error);
    return false;
  }
}

export async function getUserVotes(userId: string): Promise<Record<string, 1 | -1>> {
  try {
    const { data, error } = await supabase
      .from('deck_votes')
      .select('deck_id, vote')
      .eq('user_id', userId);

    if (error) {
      logger.warn('[Marketplace] Failed to fetch user votes:', error.message);
      return {};
    }

    const votes: Record<string, 1 | -1> = {};
    for (const row of (data ?? []) as DeckVoteRow[]) {
      if (row.vote === 1 || row.vote === -1) {
        votes[row.deck_id] = row.vote;
      }
    }

    return votes;
  } catch (error) {
    logger.warn('[Marketplace] Unexpected user vote error:', error);
    return {};
  }
}

export async function publishDeck(
  userId: string,
  publisherName: string,
  deck: {
    name: string;
    description: string;
    category: string;
    color: string;
    icon: string;
    flashcards: { question: string; answer: string; hint1?: string; hint2?: string; explanation?: string; difficulty?: string }[];
  },
): Promise<{ success: boolean; error?: string; isUpdate?: boolean }> {
  try {
    const deckData = deck.flashcards.map((card) => ({
      question: card.question,
      answer: card.answer,
      hint1: card.hint1 || undefined,
      hint2: card.hint2 || undefined,
      explanation: card.explanation || undefined,
    }));

    const { data: existing } = await supabase
      .from('public_decks')
      .select('id')
      .eq('user_id', userId)
      .eq('name', deck.name)
      .maybeSingle();

    if (existing) {
      const { error } = await supabase
        .from('public_decks')
        .update({
          description: deck.description,
          category: deck.category,
          color: deck.color,
          icon: deck.icon,
          card_count: deckData.length,
          deck_data: deckData,
          publisher_name: publisherName,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id);

      if (error) {
        logger.warn('[Marketplace] Update failed:', error.message);
        return { success: false, error: error.message };
      }

      logger.log('[Marketplace] Updated existing published deck:', deck.name);
      return { success: true, isUpdate: true };
    }

    const { error } = await supabase
      .from('public_decks')
      .insert({
        user_id: userId,
        publisher_name: publisherName,
        name: deck.name,
        description: deck.description,
        category: deck.category,
        color: deck.color,
        icon: deck.icon,
        card_count: deckData.length,
        deck_data: deckData,
      });

    if (error) {
      logger.warn('[Marketplace] Publish failed:', error.message);
      return { success: false, error: error.message };
    }

    logger.log('[Marketplace] Published deck:', deck.name);
    return { success: true, isUpdate: false };
  } catch (error) {
    logger.warn('[Marketplace] Publish error:', error);
    return { success: false, error: 'An unexpected error occurred.' };
  }
}

export async function checkDeckPublished(userId: string, deckName: string): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('public_decks')
      .select('id')
      .eq('user_id', userId)
      .eq('name', deckName)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    return data.id;
  } catch {
    return null;
  }
}

export async function unpublishDeck(userId: string, deckName: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('public_decks')
      .delete()
      .eq('user_id', userId)
      .eq('name', deckName);

    if (error) {
      logger.warn('[Marketplace] Unpublish failed:', error.message);
      return { success: false, error: error.message };
    }

    logger.log('[Marketplace] Unpublished deck:', deckName);
    return { success: true };
  } catch (error) {
    logger.warn('[Marketplace] Unpublish error:', error);
    return { success: false, error: 'An unexpected error occurred.' };
  }
}

export async function reportDeck(
  userId: string,
  deckId: string,
  reason: string,
  details: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('reports')
      .insert({
        reporter_id: userId,
        deck_id: deckId,
        reason,
        details: details.trim(),
      });

    if (error) {
      if (error.code === '23505') {
        return { success: false, error: 'You have already reported this deck.' };
      }
      logger.warn('[Marketplace] Report failed:', error.message);
      return { success: false, error: 'Could not submit report. Please try again.' };
    }

    logger.log('[Marketplace] Deck reported:', deckId);
    return { success: true };
  } catch (error) {
    logger.warn('[Marketplace] Report error:', error);
    return { success: false, error: 'An unexpected error occurred.' };
  }
}

export async function checkNewDownloads(userId: string): Promise<{ deckName: string; newDownloads: number } | null> {
  try {
    const { data, error } = await supabase
      .from('public_decks')
      .select('id, name, downloads')
      .eq('user_id', userId);

    if (error || !data || data.length === 0) {
      return null;
    }

    const storedRaw = await AsyncStorage.getItem(DOWNLOAD_COUNTS_KEY);
    const stored = storedRaw ? JSON.parse(storedRaw) as Record<string, number> : {};

    let bestDeck: { deckName: string; newDownloads: number } | null = null;

    const updated: Record<string, number> = {};
    for (const deck of data as PublishedDeckDownloadRow[]) {
      const previous = stored[deck.id] ?? 0;
      const current = deck.downloads ?? 0;
      updated[deck.id] = current;

      if (current > previous && previous > 0) {
        const diff = current - previous;
        if (!bestDeck || diff > bestDeck.newDownloads) {
          bestDeck = { deckName: deck.name, newDownloads: diff };
        }
      }

      if (previous === 0 && current > 0) {
        updated[deck.id] = current;
      }
    }

    await AsyncStorage.setItem(DOWNLOAD_COUNTS_KEY, JSON.stringify(updated));
    return bestDeck;
  } catch {
    return null;
  }
}
