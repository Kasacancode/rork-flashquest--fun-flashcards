import { ArrowDown, ArrowUp, BookOpen, ChevronRight, Edit, Trash2 } from 'lucide-react-native';
import React, { memo, useCallback } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import type { Theme } from '@/constants/colors';
import type { DeckListSummary } from '@/utils/deckSelectors';

interface DeckCardProps {
  summary: DeckListSummary;
  theme: Theme;
  isDark: boolean;
  isEditMode: boolean;
  deckSurface: string;
  quietSurface: string;
  subtleBorderColor: string;
  surfaceBorderColor: string;
  onOpenDeckHub: (deckId: string) => void;
  onStudyDeck: (deckId: string) => void;
  onEditDeck: (deckId: string) => void;
  onDeleteDeck: (deckId: string) => void;
  onMoveDeckUp: (deckId: string) => void;
  onMoveDeckDown: (deckId: string) => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
}

function DeckCardComponent({
  summary,
  theme,
  isDark,
  isEditMode,
  deckSurface,
  quietSurface,
  subtleBorderColor,
  surfaceBorderColor,
  onOpenDeckHub,
  onStudyDeck,
  onEditDeck,
  onDeleteDeck,
  onMoveDeckUp,
  onMoveDeckDown,
  canMoveUp,
  canMoveDown,
}: DeckCardProps) {
  const { deck, mastery, dueCount, isFullyMastered, masteredPercent, reviewingPercent, learningPercent, lapsedPercent } = summary;
  const canEditDeck = deck.isCustom;

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
          {isEditMode ? (
            <View style={styles.deckInfo}>
              <View style={styles.deckNameRow}>
                <Text style={[styles.deckName, { color: theme.text }]} numberOfLines={1}>
                  {deck.name}
                </Text>
              </View>
              <Text style={[styles.deckDescription, { color: theme.textSecondary }]} numberOfLines={2}>
                {deck.description}
              </Text>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.deckInfo}
              onPress={() => onOpenDeckHub(deck.id)}
              activeOpacity={0.72}
              accessibilityLabel={`${deck.name}, ${deck.flashcards.length} cards, ${Math.round(masteredPercent)}% mastered. Open deck hub.`}
              accessibilityRole="button"
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
          )}

          {isEditMode ? (
            <View style={styles.editModeHeaderBadge}>
              <Text style={[styles.editModeHeaderBadgeText, { color: theme.textSecondary }]}>Manage</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.deckStats}>
          <View
            style={[styles.statBadge, { backgroundColor: quietSurface, borderColor: subtleBorderColor }]}
            accessible={true}
            accessibilityLabel={`${deck.flashcards.length} cards in this deck`}
          >
            <BookOpen color={theme.textSecondary} size={16} strokeWidth={2} />
            <Text style={[styles.statText, { color: theme.textSecondary }]}>
              {deck.flashcards.length} cards
            </Text>
          </View>
          <View
            style={[styles.categoryBadge, { backgroundColor: quietSurface, borderColor: subtleBorderColor }]}
            accessible={true}
            accessibilityLabel={`Category: ${deck.category}`}
          >
            <Text style={[styles.categoryText, { color: theme.text }]}>{deck.category}</Text>
          </View>
        </View>

        {mastery.total > 0 ? (
          <View
            style={styles.masterySection}
            accessible={true}
            accessibilityLabel={`${mastery.mastered} of ${mastery.total} cards mastered`}
          >
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
              <View
                style={[styles.statusPill, { backgroundColor: quietSurface, borderColor: subtleBorderColor }]}
                accessible={true}
                accessibilityLabel={`${dueCount} cards due for review`}
              >
                <View style={[styles.statusDot, { backgroundColor: '#3B82F6' }]} />
                <Text style={[styles.statusText, { color: '#3B82F6' }]}>
                  {dueCount} due for review
                </Text>
              </View>
            ) : null}

            {mastery.lapsed > 0 ? (
              <View
                style={[styles.statusPill, { backgroundColor: quietSurface, borderColor: subtleBorderColor }]}
                accessible={true}
                accessibilityLabel={`${mastery.lapsed} lapsed cards`}
              >
                <View style={[styles.statusDot, { backgroundColor: '#F43F5E' }]} />
                <Text style={[styles.statusText, { color: '#F43F5E' }]}>{mastery.lapsed} lapsed</Text>
              </View>
            ) : null}

            {isFullyMastered ? (
              <View
                style={[styles.statusPill, { backgroundColor: quietSurface, borderColor: subtleBorderColor }]}
                accessible={true}
                accessibilityLabel="Fully mastered deck"
              >
                <View style={[styles.statusDot, { backgroundColor: '#10B981' }]} />
                <Text style={[styles.statusText, { color: '#10B981' }]}>Fully Mastered</Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {isEditMode ? (
          <View style={[styles.manageBar, { backgroundColor: quietSurface, borderColor: subtleBorderColor }]}>
            <Text style={[styles.manageLabel, { color: theme.textSecondary }]}>
              Reorder or delete this deck
            </Text>
            <View style={styles.manageControls}>
              <TouchableOpacity
                style={[
                  styles.manageButton,
                  styles.moveButton,
                  {
                    backgroundColor: canMoveUp ? quietSurface : 'transparent',
                    borderColor: subtleBorderColor,
                    opacity: canMoveUp ? 1 : 0.42,
                  },
                ]}
                onPress={() => onMoveDeckUp(deck.id)}
                activeOpacity={0.8}
                disabled={!canMoveUp}
                accessibilityLabel={`Move ${deck.name} up`}
                accessibilityRole="button"
                testID={`deck-move-up-${deck.id}`}
              >
                <ArrowUp color={theme.text} size={18} strokeWidth={2.4} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.manageButton,
                  styles.moveButton,
                  {
                    backgroundColor: canMoveDown ? quietSurface : 'transparent',
                    borderColor: subtleBorderColor,
                    opacity: canMoveDown ? 1 : 0.42,
                  },
                ]}
                onPress={() => onMoveDeckDown(deck.id)}
                activeOpacity={0.8}
                disabled={!canMoveDown}
                accessibilityLabel={`Move ${deck.name} down`}
                accessibilityRole="button"
                testID={`deck-move-down-${deck.id}`}
              >
                <ArrowDown color={theme.text} size={18} strokeWidth={2.4} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.manageButton,
                  styles.deleteActionButton,
                  {
                    backgroundColor: isDark ? 'rgba(127, 29, 29, 0.28)' : 'rgba(254, 226, 226, 0.95)',
                    borderColor: isDark ? 'rgba(248, 113, 113, 0.22)' : 'rgba(248, 113, 113, 0.24)',
                  },
                ]}
                onPress={handleDeletePress}
                activeOpacity={0.8}
                accessibilityLabel={`Delete ${deck.name}`}
                accessibilityRole="button"
                testID={`deck-delete-button-${deck.id}`}
              >
                <Trash2 color="#EF4444" size={18} strokeWidth={2.35} />
              </TouchableOpacity>
            </View>
          </View>
        ) : (
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
              accessibilityLabel={`Study ${deck.name}`}
              accessibilityRole="button"
              testID={`deck-study-button-${deck.id}`}
            >
              <BookOpen color="#fff" size={20} strokeWidth={2.5} />
              <Text style={styles.studyButtonText}>Study</Text>
            </TouchableOpacity>

            {canEditDeck ? (
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: quietSurface, borderColor: subtleBorderColor }]}
                onPress={() => onEditDeck(deck.id)}
                activeOpacity={0.8}
                accessibilityLabel={`Edit ${deck.name}`}
                accessibilityRole="button"
                testID={`deck-edit-button-${deck.id}`}
              >
                <Edit color={theme.text} size={20} strokeWidth={2.5} />
              </TouchableOpacity>
            ) : null}
          </View>
        )}
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
  editModeHeaderBadge: {
    minWidth: 56,
    alignItems: 'flex-end',
  },
  editModeHeaderBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
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
  manageBar: {
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  manageLabel: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  manageControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  manageButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  moveButton: {
    backgroundColor: 'transparent',
  },
  deleteActionButton: {
    shadowColor: '#EF4444',
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
});

const DeckCard = memo(DeckCardComponent);

export default DeckCard;
