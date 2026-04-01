import { BookOpen, ChevronRight, Edit, Trash2 } from 'lucide-react-native';
import React, { memo, useCallback } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import type { Theme } from '@/constants/colors';
import type { DeckListSummary } from '@/utils/deckSelectors';

interface DeckCardProps {
  summary: DeckListSummary;
  theme: Theme;
  isDark: boolean;
  deckSurface: string;
  quietSurface: string;
  subtleBorderColor: string;
  surfaceBorderColor: string;
  onOpenDeckHub: (deckId: string) => void;
  onStudyDeck: (deckId: string) => void;
  onEditDeck: (deckId: string) => void;
  onDeleteDeck: (deckId: string) => void;
}

function DeckCardComponent({
  summary,
  theme,
  isDark,
  deckSurface,
  quietSurface,
  subtleBorderColor,
  surfaceBorderColor,
  onOpenDeckHub,
  onStudyDeck,
  onEditDeck,
  onDeleteDeck,
}: DeckCardProps) {
  const { deck, mastery, dueCount, isFullyMastered, masteredPercent, reviewingPercent, learningPercent, lapsedPercent } = summary;
  const canManageDeck = deck.isCustom;

  const handleDeletePress = useCallback(() => {
    onDeleteDeck(deck.id);
  }, [deck.id, onDeleteDeck]);

  return (
    <View
      style={[
        styles.deckCard,
        {
          backgroundColor: deckSurface,
          borderWidth: 1,
          borderColor: isFullyMastered ? '#10B981' : surfaceBorderColor,
          shadowColor: isDark ? '#000' : '#8f7ae8',
          shadowOpacity: isDark ? 0.24 : 0.12,
          shadowRadius: isDark ? 18 : 14,
          elevation: isDark ? 8 : 6,
        },
        isFullyMastered ? styles.masteredCard : null,
      ]}
      testID={`deck-card-${deck.id}`}
    >
      <View style={[styles.deckColorBar, { backgroundColor: deck.color }]} />
      <View style={[styles.deckAura, { backgroundColor: deck.color }]} />

      <View style={styles.deckContent}>
        <View style={styles.deckHeader}>
          <TouchableOpacity
            style={styles.deckInfo}
            onPress={() => onOpenDeckHub(deck.id)}
            activeOpacity={0.72}
            testID={`deck-hub-open-${deck.id}`}
          >
            <View style={styles.deckNameRow}>
              <Text style={[styles.deckName, { color: theme.text }]} numberOfLines={1}>
                {deck.name}
              </Text>
              <ChevronRight color={theme.textTertiary} size={14} strokeWidth={2.4} />
            </View>
            <Text style={[styles.deckDescription, { color: theme.textSecondary }]} numberOfLines={2}>
              {deck.description}
            </Text>
          </TouchableOpacity>

          {canManageDeck ? (
            <TouchableOpacity
              style={[
                styles.deleteButton,
                {
                  backgroundColor: quietSurface,
                  borderColor: subtleBorderColor,
                },
              ]}
              onPress={handleDeletePress}
              activeOpacity={0.8}
              testID={`deck-delete-button-${deck.id}`}
            >
              <Trash2 color={theme.textSecondary} size={16} strokeWidth={2.3} />
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={styles.deckStats}>
          <View style={[styles.statBadge, { backgroundColor: quietSurface, borderColor: subtleBorderColor }]}> 
            <BookOpen color={theme.textSecondary} size={16} strokeWidth={2} />
            <Text style={[styles.statText, { color: theme.textSecondary }]}> 
              {deck.flashcards.length} cards
            </Text>
          </View>
          <View style={[styles.categoryBadge, { backgroundColor: quietSurface, borderColor: subtleBorderColor }]}> 
            <Text style={[styles.categoryText, { color: theme.text }]}>{deck.category}</Text>
          </View>
        </View>

        {mastery.total > 0 ? (
          <View style={styles.masterySection}>
            <View style={styles.masteryHeaderRow}>
              <Text style={[styles.masteryLabel, { color: theme.textSecondary }]}> 
                {mastery.mastered}/{mastery.total} mastered
              </Text>
              <Text style={[styles.masteryPercent, { color: theme.textTertiary }]}>
                {Math.round(masteredPercent)}%
              </Text>
            </View>
            <View style={[styles.masteryTrack, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }]}>
              {masteredPercent > 0 ? <View style={[styles.masterySegment, { width: `${masteredPercent}%`, backgroundColor: '#10B981' }]} /> : null}
              {reviewingPercent > 0 ? <View style={[styles.masterySegment, { width: `${reviewingPercent}%`, backgroundColor: '#3B82F6' }]} /> : null}
              {learningPercent > 0 ? <View style={[styles.masterySegment, { width: `${learningPercent}%`, backgroundColor: '#F59E0B' }]} /> : null}
              {lapsedPercent > 0 ? <View style={[styles.masterySegment, { width: `${lapsedPercent}%`, backgroundColor: '#F43F5E' }]} /> : null}
            </View>
          </View>
        ) : null}

        {dueCount > 0 || mastery.lapsed > 0 || isFullyMastered ? (
          <View style={styles.deckStatusRow}>
            {dueCount > 0 ? (
              <View style={[styles.statusPill, { backgroundColor: quietSurface, borderColor: subtleBorderColor }]}> 
                <View style={[styles.statusDot, { backgroundColor: '#3B82F6' }]} />
                <Text style={[styles.statusText, { color: '#3B82F6' }]}>
                  {dueCount} due for review
                </Text>
              </View>
            ) : null}

            {mastery.lapsed > 0 ? (
              <View style={[styles.statusPill, { backgroundColor: quietSurface, borderColor: subtleBorderColor }]}> 
                <View style={[styles.statusDot, { backgroundColor: '#F43F5E' }]} />
                <Text style={[styles.statusText, { color: '#F43F5E' }]}>{mastery.lapsed} lapsed</Text>
              </View>
            ) : null}

            {isFullyMastered ? (
              <View style={[styles.statusPill, { backgroundColor: quietSurface, borderColor: subtleBorderColor }]}> 
                <View style={[styles.statusDot, { backgroundColor: '#10B981' }]} />
                <Text style={[styles.statusText, { color: '#10B981' }]}>Fully Mastered</Text>
              </View>
            ) : null}
          </View>
        ) : null}

        <View style={styles.deckActions}>
          <TouchableOpacity
            style={[
              styles.studyButton,
              {
                backgroundColor: theme.primary,
                shadowColor: theme.primary,
                shadowOpacity: isDark ? 0.24 : 0.14,
                shadowRadius: isDark ? 16 : 10,
                elevation: isDark ? 7 : 4,
              },
            ]}
            onPress={() => onStudyDeck(deck.id)}
            activeOpacity={0.8}
            testID={`deck-study-button-${deck.id}`}
          >
            <BookOpen color="#fff" size={20} strokeWidth={2.5} />
            <Text style={styles.studyButtonText}>Study</Text>
          </TouchableOpacity>

          {canManageDeck ? (
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: quietSurface, borderColor: subtleBorderColor }]}
              onPress={() => onEditDeck(deck.id)}
              activeOpacity={0.8}
              testID={`deck-edit-button-${deck.id}`}
            >
              <Edit color={theme.text} size={20} strokeWidth={2.5} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  deckCard: {
    borderRadius: 28,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 10 },
  },
  masteredCard: {
    borderWidth: 2,
  },
  deckColorBar: {
    height: 6,
    width: '100%',
  },
  deckAura: {
    position: 'absolute',
    top: -34,
    right: -10,
    width: 132,
    height: 132,
    borderRadius: 66,
    opacity: 0.12,
  },
  deckContent: {
    paddingHorizontal: 18,
    paddingVertical: 18,
    gap: 14,
  },
  deckHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  deckInfo: {
    flex: 1,
    gap: 6,
  },
  deckNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  deckName: {
    flex: 1,
    fontSize: 21,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  deckDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  deleteButton: {
    width: 38,
    height: 38,
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deckStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  statBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  statText: {
    fontSize: 13,
    fontWeight: '700',
  },
  categoryBadge: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  categoryText: {
    fontSize: 13,
    fontWeight: '700',
  },
  masterySection: {
    gap: 8,
  },
  masteryHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  masteryLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  masteryPercent: {
    fontSize: 12,
    fontWeight: '700',
  },
  masteryTrack: {
    height: 8,
    borderRadius: 999,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  masterySegment: {
    height: '100%',
  },
  deckStatusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
  },
  deckActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  studyButton: {
    flex: 1,
    minHeight: 50,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    shadowOffset: { width: 0, height: 8 },
  },
  studyButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  actionButton: {
    width: 50,
    height: 50,
    borderRadius: 18,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

const DeckCard = memo(DeckCardComponent);

export default DeckCard;
