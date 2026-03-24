import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { ArrowLeft, BookOpen, Target, Swords, AlertTriangle, Copy } from 'lucide-react-native';
import React, { useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useFlashQuest } from '@/context/FlashQuestContext';
import { usePerformance } from '@/context/PerformanceContext';
import { useTheme } from '@/context/ThemeContext';
import { generateUUID } from '@/utils/uuid';

export default function DeckHubScreen() {
  const router = useRouter();
  const { deckId } = useLocalSearchParams<{ deckId: string }>();
  const { decks, addDeck } = useFlashQuest();
  const { performance, getDeckAccuracy, getWeakCards, getCardsDueForReview } = usePerformance();
  const { theme, isDark } = useTheme();

  const deck = useMemo(() => decks.find(d => d.id === deckId), [decks, deckId]);

  const mastery = useMemo(() => {
    if (!deck) return { mastered: 0, reviewing: 0, learning: 0, newCards: 0, total: 0 };
    let mastered = 0, reviewing = 0, learning = 0, newCards = 0;
    for (const card of deck.flashcards) {
      const stats = performance.cardStatsById[card.id];
      if (!stats || stats.attempts === 0) { newCards++; continue; }
      if (stats.streakCorrect >= 5) { mastered++; continue; }
      if (stats.streakCorrect >= 3) { reviewing++; continue; }
      learning++;
    }
    return { mastered, reviewing, learning, newCards, total: deck.flashcards.length };
  }, [deck, performance.cardStatsById]);

  const accuracy = useMemo(() => deckId ? getDeckAccuracy(deckId) : null, [deckId, getDeckAccuracy]);

  const weakCardCount = useMemo(() => {
    if (!deck) return 0;
    return getWeakCards(deck.id, deck.flashcards, 50).length;
  }, [deck, getWeakCards]);

  const dueForReviewCount = useMemo(() => {
    if (!deck) return 0;
    return getCardsDueForReview(deck.id, deck.flashcards).length;
  }, [deck, getCardsDueForReview]);

  const lastStudied = useMemo(() => {
    if (!deckId) return null;
    const ds = performance.deckStatsById[deckId];
    if (!ds?.lastAttemptAt) return null;
    const days = Math.floor((Date.now() - ds.lastAttemptAt) / 86400000);
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    return `${days} days ago`;
  }, [deckId, performance.deckStatsById]);

  const handleDuplicateDeck = useCallback(() => {
    if (!deck) {
      return;
    }

    const newDeckId = `deck_${generateUUID()}`;
    const now = Date.now();
    const flashcards = deck.flashcards.map((card) => ({
      id: `dup_${generateUUID()}`,
      question: card.question,
      answer: card.answer,
      deckId: newDeckId,
      difficulty: card.difficulty,
      createdAt: now,
      hint1: card.hint1,
      hint2: card.hint2,
      explanation: card.explanation,
      tags: card.tags,
    }));

    addDeck({
      id: newDeckId,
      name: `${deck.name} (Copy)`,
      description: deck.description,
      color: deck.color,
      icon: deck.icon,
      category: deck.category,
      flashcards,
      isCustom: true,
      createdAt: now,
    });

    Alert.alert('Deck Duplicated', `"${deck.name} (Copy)" has been created with ${flashcards.length} cards.`);
  }, [addDeck, deck]);

  if (!deck) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <ArrowLeft color="#fff" size={24} strokeWidth={2.5} />
          </TouchableOpacity>
          <View style={styles.errorWrap}>
            <Text style={[styles.errorText, { color: theme.text }]}>Deck not found</Text>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  const pctMastered = mastery.total > 0 ? Math.round((mastery.mastered / mastery.total) * 100) : 0;
  const cardBg = isDark ? 'rgba(15,23,42,0.78)' : theme.cardBackground;
  const cardBorder = isDark ? 'rgba(148,163,184,0.16)' : 'transparent';

  return (
    <View style={styles.container}>
      <LinearGradient colors={[theme.gradientStart, theme.gradientMid, theme.gradientEnd]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      {isDark && <LinearGradient colors={['rgba(6,10,22,0.06)', 'rgba(6,10,22,0.34)', 'rgba(5,8,20,0.76)']} start={{ x: 0.1, y: 0 }} end={{ x: 0.95, y: 1 }} style={StyleSheet.absoluteFill} pointerEvents="none" />}

      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <ArrowLeft color="#fff" size={24} strokeWidth={2.5} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: deck.color }} />
              <Text style={styles.headerTitle} numberOfLines={1}>{deck.name}</Text>
            </View>
            <Text style={styles.headerSub}>{deck.flashcards.length} cards · {deck.category}</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>

        <View style={[styles.accentBar, { backgroundColor: deck.color }]} />

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

          <View style={[styles.card, { backgroundColor: cardBg, borderColor: cardBorder, borderWidth: isDark ? 1 : 0, borderTopColor: deck.color, borderTopWidth: 3 }]}>

            <Text style={[styles.cardLabel, { color: theme.textSecondary }]}>MASTERY</Text>
            <Text style={[styles.bigPct, { color: theme.primary }]}>{pctMastered}%</Text>
            <Text style={[styles.cardSub, { color: theme.textSecondary }]}>{mastery.mastered}/{mastery.total} cards mastered</Text>
            <View style={[styles.barBg, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }]}>
              {mastery.mastered > 0 && <View style={{ width: `${(mastery.mastered / mastery.total) * 100}%`, height: '100%', backgroundColor: '#10B981' }} />}
              {mastery.reviewing > 0 && <View style={{ width: `${(mastery.reviewing / mastery.total) * 100}%`, height: '100%', backgroundColor: '#3B82F6' }} />}
              {mastery.learning > 0 && <View style={{ width: `${(mastery.learning / mastery.total) * 100}%`, height: '100%', backgroundColor: '#F59E0B' }} />}
            </View>
            <View style={styles.legend}>
              <View style={styles.legendItem}><View style={[styles.dot, { backgroundColor: '#10B981' }]} /><Text style={[styles.legendText, { color: theme.textSecondary }]}>Mastered ({mastery.mastered})</Text></View>
              <View style={styles.legendItem}><View style={[styles.dot, { backgroundColor: '#3B82F6' }]} /><Text style={[styles.legendText, { color: theme.textSecondary }]}>Reviewing ({mastery.reviewing})</Text></View>
              <View style={styles.legendItem}><View style={[styles.dot, { backgroundColor: '#F59E0B' }]} /><Text style={[styles.legendText, { color: theme.textSecondary }]}>Learning ({mastery.learning})</Text></View>
              <View style={styles.legendItem}><View style={[styles.dot, { backgroundColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)' }]} /><Text style={[styles.legendText, { color: theme.textSecondary }]}>New ({mastery.newCards})</Text></View>
            </View>
          </View>

          <View style={styles.statsRow}>
            <View style={[styles.statBox, { backgroundColor: cardBg, borderColor: cardBorder, borderWidth: isDark ? 1 : 0 }]}>
              <Text style={[styles.statVal, { color: theme.primary }]}>{accuracy !== null ? `${Math.round(accuracy * 100)}%` : '—'}</Text>
              <Text style={[styles.statLbl, { color: theme.textSecondary }]}>Accuracy</Text>
            </View>
            <View style={[styles.statBox, { backgroundColor: cardBg, borderColor: cardBorder, borderWidth: isDark ? 1 : 0 }]}>
              <Text style={[styles.statVal, { color: dueForReviewCount > 0 ? '#F59E0B' : theme.primary }]}>{dueForReviewCount}</Text>
              <Text style={[styles.statLbl, { color: theme.textSecondary }]}>Due for Review</Text>
            </View>
            <View style={[styles.statBox, { backgroundColor: cardBg, borderColor: cardBorder, borderWidth: isDark ? 1 : 0 }]}>
              <Text style={[styles.statVal, { color: theme.primary }]}>{lastStudied ?? 'Never'}</Text>
              <Text style={[styles.statLbl, { color: theme.textSecondary }]}>Last Studied</Text>
            </View>
          </View>

          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: theme.primary, borderLeftWidth: 4, borderLeftColor: deck.color }]} onPress={() => router.push({ pathname: '/study', params: { deckId: deck.id } } as Href)} activeOpacity={0.85}>
            <BookOpen color="#fff" size={22} strokeWidth={2.2} />
            <View style={styles.actionText}>
              <Text style={styles.actionTitle}>Study</Text>
              <Text style={styles.actionDesc}>Flip through all cards</Text>
            </View>
          </TouchableOpacity>

          {dueForReviewCount > 0 && (
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: 'rgba(59,130,246,0.12)', borderWidth: 1, borderColor: 'rgba(59,130,246,0.3)' }]}
              onPress={() => router.push({ pathname: '/quest', params: { deckId: deck.id, focusWeak: 'true' } } as Href)}
              activeOpacity={0.85}
            >
              <Target color="#3B82F6" size={22} strokeWidth={2.2} />
              <View style={styles.actionText}>
                <Text style={[styles.actionTitle, { color: '#3B82F6' }]}>Review Due Cards</Text>
                <Text style={[styles.actionDesc, { color: theme.textSecondary }]}>{dueForReviewCount} cards ready for review</Text>
              </View>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: cardBg, borderWidth: 1, borderColor: isDark ? 'rgba(148,163,184,0.16)' : theme.border }]} onPress={() => router.push({ pathname: '/quest', params: { deckId: deck.id } } as Href)} activeOpacity={0.85}>
            <Target color={theme.primary} size={22} strokeWidth={2.2} />
            <View style={styles.actionText}>
              <Text style={[styles.actionTitle, { color: theme.text }]}>Quest</Text>
              <Text style={[styles.actionDesc, { color: theme.textSecondary }]}>Test your knowledge</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: cardBg, borderWidth: 1, borderColor: isDark ? 'rgba(148,163,184,0.16)' : theme.border }]} onPress={() => router.push({ pathname: '/practice', params: { deckId: deck.id } } as Href)} activeOpacity={0.85}>
            <Swords color={theme.primary} size={22} strokeWidth={2.2} />
            <View style={styles.actionText}>
              <Text style={[styles.actionTitle, { color: theme.text }]}>Practice vs AI</Text>
              <Text style={[styles.actionDesc, { color: theme.textSecondary }]}>Choose a mode, then battle</Text>
            </View>
          </TouchableOpacity>

          {weakCardCount >= 1 && (
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: 'rgba(245,158,11,0.12)', borderWidth: 1, borderColor: 'rgba(245,158,11,0.3)' }]} onPress={() => router.push({ pathname: '/quest', params: { deckId: deck.id, focusWeak: 'true' } } as Href)} activeOpacity={0.85}>
              <AlertTriangle color="#F59E0B" size={22} strokeWidth={2.2} />
              <View style={styles.actionText}>
                <Text style={[styles.actionTitle, { color: '#F59E0B' }]}>Drill Weak Cards</Text>
                <Text style={[styles.actionDesc, { color: theme.textSecondary }]}>{weakCardCount} cards need more practice</Text>
              </View>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: cardBg, borderWidth: 1, borderColor: isDark ? 'rgba(148,163,184,0.16)' : theme.border }]}
            onPress={handleDuplicateDeck}
            activeOpacity={0.85}
            testID="duplicateDeckButton"
          >
            <Copy color={theme.textSecondary} size={22} strokeWidth={2.2} />
            <View style={styles.actionText}>
              <Text style={[styles.actionTitle, { color: theme.text }]}>Duplicate Deck</Text>
              <Text style={[styles.actionDesc, { color: theme.textSecondary }]}>Create a copy to customize</Text>
            </View>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16 },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#fff' },
  headerSub: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.6)', marginTop: 2 },
  accentBar: { height: 4, borderRadius: 2, marginHorizontal: 20, marginBottom: 4 },
  content: { padding: 20, paddingBottom: 40, gap: 14 },
  errorWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { fontSize: 16 },
  card: { borderRadius: 20, padding: 20, alignItems: 'center' },
  cardLabel: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },
  bigPct: { fontSize: 44, fontWeight: '800' },
  cardSub: { fontSize: 14, fontWeight: '600', marginTop: 4, marginBottom: 16 },
  barBg: { height: 8, borderRadius: 4, flexDirection: 'row', overflow: 'hidden', width: '100%', marginBottom: 16 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center', paddingHorizontal: 4 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 11, fontWeight: '600' },
  statsRow: { flexDirection: 'row', gap: 10 },
  statBox: { flex: 1, borderRadius: 16, padding: 14, alignItems: 'center' },
  statVal: { fontSize: 18, fontWeight: '800' },
  statLbl: { fontSize: 11, fontWeight: '600', marginTop: 4, textAlign: 'center' },
  actionBtn: { flexDirection: 'row', alignItems: 'center', borderRadius: 16, padding: 16, gap: 14 },
  actionText: { flex: 1 },
  actionTitle: { fontSize: 16, fontWeight: '700', color: '#fff' },
  actionDesc: { fontSize: 12, fontWeight: '500', color: 'rgba(255,255,255,0.7)', marginTop: 2 },
});
