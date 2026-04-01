import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { ArrowLeft, BookOpen, Target, Swords, AlertTriangle, Copy, MoreHorizontal, Pencil, RotateCcw, Trash2 } from 'lucide-react-native';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useFlashQuest } from '@/context/FlashQuestContext';
import { usePerformance } from '@/context/PerformanceContext';
import { useTheme } from '@/context/ThemeContext';
import { computeDeckMastery } from '@/utils/mastery';
import { DECKS_ROUTE, editDeckHref, focusedQuestSessionHref } from '@/utils/routes';
import { generateUUID } from '@/utils/uuid';

function withAlpha(color: string, alpha: number): string {
  const normalized = color.replace('#', '');

  if (normalized.length === 3) {
    const r = parseInt(normalized[0]! + normalized[0]!, 16);
    const g = parseInt(normalized[1]! + normalized[1]!, 16);
    const b = parseInt(normalized[2]! + normalized[2]!, 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  if (normalized.length === 6) {
    const r = parseInt(normalized.slice(0, 2), 16);
    const g = parseInt(normalized.slice(2, 4), 16);
    const b = parseInt(normalized.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  return color;
}

function blendColors(baseColor: string, accentColor: string, accentStrength: number, alpha = 1): string {
  const parseColor = (color: string): { r: number; g: number; b: number } | null => {
    const normalized = color.replace('#', '').trim();

    if (normalized.length === 3) {
      return {
        r: parseInt(normalized[0]! + normalized[0]!, 16),
        g: parseInt(normalized[1]! + normalized[1]!, 16),
        b: parseInt(normalized[2]! + normalized[2]!, 16),
      };
    }

    if (normalized.length === 6) {
      return {
        r: parseInt(normalized.slice(0, 2), 16),
        g: parseInt(normalized.slice(2, 4), 16),
        b: parseInt(normalized.slice(4, 6), 16),
      };
    }

    return null;
  };

  const base = parseColor(baseColor);
  const accent = parseColor(accentColor);

  if (!base || !accent) {
    return alpha >= 1 ? accentColor : withAlpha(accentColor, alpha);
  }

  const strength = Math.max(0, Math.min(1, accentStrength));
  const r = Math.round(base.r + (accent.r - base.r) * strength);
  const g = Math.round(base.g + (accent.g - base.g) * strength);
  const b = Math.round(base.b + (accent.b - base.b) * strength);

  return alpha >= 1 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export default function DeckHubScreen() {
  const router = useRouter();
  const { deckId } = useLocalSearchParams<{ deckId: string }>();
  const { decks, addDeck, deleteDeck } = useFlashQuest();
  const { performance, getDeckAccuracy, getWeakCards, getCardsDueForReview, getLapsedCards, cleanupDeck } = usePerformance();
  const { theme, isDark } = useTheme();
  const [menuVisible, setMenuVisible] = useState<boolean>(false);
  const menuBtnRef = useRef<View>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; right: number }>({ top: 0, right: 0 });

  const deck = useMemo(() => decks.find((item) => item.id === deckId), [decks, deckId]);

  const mastery = useMemo(() => {
    if (!deck) {
      return { mastered: 0, reviewing: 0, learning: 0, lapsed: 0, newCards: 0, total: 0 };
    }

    return computeDeckMastery(deck.flashcards, performance.cardStatsById);
  }, [deck, performance.cardStatsById]);

  const accuracy = useMemo(() => (deckId ? getDeckAccuracy(deckId) : null), [deckId, getDeckAccuracy]);

  const weakCardCount = useMemo(() => {
    if (!deck) {
      return 0;
    }

    const weakIds = getWeakCards(deck.id, deck.flashcards, 50);
    return weakIds.filter((id) => {
      const stats = performance.cardStatsById[id];
      return Boolean(stats && stats.attempts > 0);
    }).length;
  }, [deck, getWeakCards, performance.cardStatsById]);

  const dueForReviewCount = useMemo(() => {
    if (!deck) {
      return 0;
    }

    return getCardsDueForReview(deck.id, deck.flashcards).length;
  }, [deck, getCardsDueForReview]);

  const lapsedCardIds = useMemo(() => {
    if (!deck) {
      return [] as string[];
    }

    return getLapsedCards(deck.id, deck.flashcards);
  }, [deck, getLapsedCards]);

  const lastStudied = useMemo(() => {
    if (!deckId) {
      return null;
    }

    const deckStats = performance.deckStatsById[deckId];
    if (!deckStats?.lastAttemptAt) {
      return null;
    }

    const days = Math.floor((Date.now() - deckStats.lastAttemptAt) / 86400000);
    if (days === 0) {
      return 'Today';
    }
    if (days === 1) {
      return 'Yesterday';
    }
    return `${days} days ago`;
  }, [deckId, performance.deckStatsById]);

  const openMenu = useCallback(() => {
    menuBtnRef.current?.measure((_x, _y, _w, height, _px, py) => {
      setMenuPos({ top: py + height + 6, right: 16 });
    });
    setMenuVisible(true);
  }, []);

  const handleEditDeck = useCallback(() => {
    if (!deck) {
      return;
    }

    setMenuVisible(false);
    router.push(editDeckHref(deck.id));
  }, [deck, router]);

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

    setMenuVisible(false);
    Alert.alert('Deck Duplicated', `"${deck.name} (Copy)" has been created with ${flashcards.length} cards.`);
  }, [addDeck, deck]);

  const handleResetProgress = useCallback(() => {
    if (!deck) {
      return;
    }

    setMenuVisible(false);

    Alert.alert(
      'Reset Progress',
      `This will erase all study history, mastery data, and spaced repetition schedules for "${deck.name}". The cards themselves won't change.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => {
            cleanupDeck(deck.id, deck.flashcards.map((card) => card.id));
          },
        },
      ],
    );
  }, [deck, cleanupDeck]);

  const handleDeleteDeck = useCallback(() => {
    if (!deck) {
      return;
    }

    setMenuVisible(false);

    const isBuiltIn = !deck.isCustom;

    Alert.alert(
      isBuiltIn ? 'Remove Deck' : 'Delete Deck',
      isBuiltIn
        ? `This will remove "${deck.name}" from your library.`
        : `This will permanently delete "${deck.name}" and all of its cards. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: isBuiltIn ? 'Remove' : 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteDeck(deck.id);
            router.back();
          },
        },
      ],
    );
  }, [deck, deleteDeck, router]);

  if (!deck) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <LinearGradient
          colors={[theme.gradientStart, theme.gradientMid, theme.gradientEnd]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
          <TouchableOpacity onPress={() => router.back()} style={styles.fallbackBackBtn}>
            <ArrowLeft color="#fff" size={24} strokeWidth={2.5} />
          </TouchableOpacity>
          <View style={styles.errorWrap}>
            <Text style={styles.errorTitle}>Deck not found</Text>
            <Text style={styles.errorSubtitle}>This deck may have been deleted.</Text>
            <TouchableOpacity
              onPress={() => router.replace(DECKS_ROUTE)}
              style={styles.errorAction}
              testID="deck-hub-go-to-decks-button"
            >
              <Text style={styles.errorActionText}>Go to Decks</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  const pctMastered = mastery.total > 0 ? Math.round((mastery.mastered / mastery.total) * 100) : 0;
  const deckActionStart = isDark ? blendColors(theme.primary, deck.color, 0.24) : blendColors('#A7B8FF', deck.color, 0.34);
  const deckActionMid = isDark ? blendColors(theme.primaryDark, deck.color, 0.22) : blendColors(theme.primary, deck.color, 0.28);
  const deckActionEnd = isDark ? blendColors('#463AAE', deck.color, 0.28) : blendColors('#8B5CF6', deck.color, 0.32);
  const deckActionShadow = blendColors(theme.primaryDark, deck.color, isDark ? 0.34 : 0.44);
  const deckActionBorder = isDark ? withAlpha(deck.color, 0.26) : blendColors('#C7D2FE', deck.color, 0.34, 0.96);
  const deckActionHighlight = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.34)';
  const deckActionGlow = withAlpha(deck.color, isDark ? 0.24 : 0.2);
  const actionIconSurface = isDark ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.18)';
  const actionIconBorder = isDark ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.28)';
  const secondaryActionAccent = blendColors(theme.primary, deck.color, isDark ? 0.14 : 0.18);
  const screenGradient = isDark
    ? ['#0a1427', '#12203a', '#091222'] as const
    : ['#f8fbff', '#eef4ff', '#fbf7ff'] as const;
  const cardBg = isDark ? 'rgba(10, 18, 34, 0.82)' : 'rgba(255, 255, 255, 0.84)';
  const statBg = isDark ? 'rgba(8, 15, 28, 0.88)' : blendColors('#F8FAFF', deck.color, 0.04, 0.94);
  const cardBorder = isDark ? 'rgba(148, 163, 184, 0.14)' : 'rgba(148, 163, 184, 0.16)';
  const heroBorderColor = isDark ? 'rgba(148, 163, 184, 0.16)' : blendColors('#D9E2F5', deck.color, 0.16, 0.9);
  const actionBorder = isDark ? 'rgba(148, 163, 184, 0.18)' : blendColors('#DCE4FF', deck.color, 0.18, 0.92);
  const headerControlSurface = isDark ? 'rgba(10, 17, 34, 0.44)' : 'rgba(255, 255, 255, 0.48)';
  const headerControlBorder = isDark ? 'rgba(148, 163, 184, 0.18)' : 'rgba(148, 163, 184, 0.18)';
  const headerContentColor = isDark ? '#F8FAFC' : '#2D2A61';
  const deckTint = withAlpha(deck.color, isDark ? 0.18 : 0.16);
  const deckGlow = withAlpha(deck.color, isDark ? 0.32 : 0.22);
  const topGlowColor = withAlpha(deck.color, isDark ? 0.16 : 0.1);
  const bottomGlowColor = isDark ? 'rgba(56, 189, 248, 0.08)' : blendColors('#D7E7FF', deck.color, 0.16, 0.28);
  const pageDeckFieldStart = isDark ? withAlpha(deck.color, 0.08) : blendColors('#FFFFFF', deck.color, 0.14, 0.28);
  const pageDeckFieldMid = isDark ? 'rgba(59, 130, 246, 0.04)' : blendColors('#EEF4FF', deck.color, 0.1, 0.12);
  const pageDeckFieldEnd = isDark ? 'rgba(14, 165, 233, 0.05)' : blendColors('#F5F3FF', deck.color, 0.16, 0.18);
  const menuSurface = isDark ? 'rgba(11, 18, 34, 0.98)' : 'rgba(255, 255, 255, 0.98)';
  const inactiveTrack = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.06)';

  return (
    <View style={styles.container} testID="deck-hub-screen">
      <LinearGradient
        colors={screenGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={
          isDark
            ? ['rgba(6,10,22,0.04)', 'rgba(6,10,22,0.26)', 'rgba(5,8,20,0.72)']
            : ['rgba(255,255,255,0.22)', 'rgba(241,245,255,0.12)', 'rgba(248,250,252,0.58)']
        }
        start={{ x: 0.08, y: 0 }}
        end={{ x: 0.95, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <LinearGradient
        colors={[pageDeckFieldStart, pageDeckFieldMid, pageDeckFieldEnd]}
        start={{ x: 0.04, y: 0.02 }}
        end={{ x: 0.96, y: 0.98 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <View pointerEvents="none" style={[styles.topGlow, { backgroundColor: topGlowColor }]} />
      <View pointerEvents="none" style={[styles.bottomGlow, { backgroundColor: bottomGlowColor }]} />

      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={[
              styles.backBtn,
              {
                backgroundColor: headerControlSurface,
                borderColor: headerControlBorder,
                shadowOpacity: isDark ? 0.22 : 0.1,
                shadowRadius: isDark ? 14 : 10,
                elevation: isDark ? 6 : 3,
              },
            ]}
            activeOpacity={0.78}
          >
            <ArrowLeft color={headerContentColor} size={24} strokeWidth={2.5} />
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            <View style={styles.headerTitleRow}>
              <View style={[styles.headerDot, { backgroundColor: deck.color }]} />
              <Text style={[styles.headerTitle, { color: headerContentColor }]} numberOfLines={1}>{deck.name}</Text>
            </View>
            <Text style={[styles.headerSub, { color: isDark ? 'rgba(248,255,252,0.68)' : 'rgba(45,42,97,0.68)' }]}>{deck.flashcards.length} cards · {deck.category}</Text>
          </View>

          <View ref={menuBtnRef} collapsable={false}>
            <TouchableOpacity
              onPress={openMenu}
              style={[
                styles.menuBtn,
                {
                  backgroundColor: headerControlSurface,
                  borderColor: headerControlBorder,
                  shadowOpacity: isDark ? 0.22 : 0.1,
                  shadowRadius: isDark ? 14 : 10,
                  elevation: isDark ? 6 : 3,
                },
              ]}
              activeOpacity={0.7}
              testID="deckHubMenuButton"
            >
              <MoreHorizontal color={headerContentColor} size={22} strokeWidth={2.2} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={[styles.accentBar, { backgroundColor: deck.color }]} />

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View
            style={[
              styles.card,
              {
                backgroundColor: cardBg,
                borderColor: heroBorderColor,
                shadowColor: deckGlow,
                shadowOpacity: isDark ? 0.24 : 0.14,
                shadowRadius: isDark ? 22 : 16,
                elevation: isDark ? 10 : 4,
              },
            ]}
          >
            <LinearGradient
              colors={[deckTint, withAlpha(deck.color, isDark ? 0.1 : 0.04), 'transparent']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            />
            <Text style={[styles.cardLabel, { color: theme.textSecondary }]}>MASTERY</Text>
            <Text style={[styles.bigPct, { color: deck.color }]}>{pctMastered}%</Text>
            <Text style={[styles.cardSub, { color: theme.textSecondary }]}>{mastery.mastered}/{mastery.total} cards mastered</Text>
            <View style={[styles.barBg, { backgroundColor: inactiveTrack }]}> 
              {mastery.mastered > 0 ? <View style={{ width: `${(mastery.mastered / mastery.total) * 100}%`, height: '100%', backgroundColor: '#10B981' }} /> : null}
              {mastery.reviewing > 0 ? <View style={{ width: `${(mastery.reviewing / mastery.total) * 100}%`, height: '100%', backgroundColor: '#3B82F6' }} /> : null}
              {mastery.learning > 0 ? <View style={{ width: `${(mastery.learning / mastery.total) * 100}%`, height: '100%', backgroundColor: '#F59E0B' }} /> : null}
              {mastery.lapsed > 0 ? <View style={{ width: `${(mastery.lapsed / mastery.total) * 100}%`, height: '100%', backgroundColor: '#F43F5E' }} /> : null}
            </View>
            <View style={styles.legend}>
              <View style={styles.legendItem}><View style={[styles.dot, { backgroundColor: '#10B981' }]} /><Text style={[styles.legendText, { color: theme.textSecondary }]}>Mastered ({mastery.mastered})</Text></View>
              <View style={styles.legendItem}><View style={[styles.dot, { backgroundColor: '#3B82F6' }]} /><Text style={[styles.legendText, { color: theme.textSecondary }]}>Reviewing ({mastery.reviewing})</Text></View>
              <View style={styles.legendItem}><View style={[styles.dot, { backgroundColor: '#F59E0B' }]} /><Text style={[styles.legendText, { color: theme.textSecondary }]}>Learning ({mastery.learning})</Text></View>
              <View style={styles.legendItem}><View style={[styles.dot, { backgroundColor: '#F43F5E' }]} /><Text style={[styles.legendText, { color: theme.textSecondary }]}>Lapsed ({mastery.lapsed})</Text></View>
              <View style={styles.legendItem}><View style={[styles.dot, { backgroundColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)' }]} /><Text style={[styles.legendText, { color: theme.textSecondary }]}>New ({mastery.newCards})</Text></View>
            </View>
            {lapsedCardIds.length > 0 ? (
              <TouchableOpacity
                style={[
                  styles.recoverLapsedButton,
                  {
                    backgroundColor: isDark ? 'rgba(244,63,94,0.14)' : 'rgba(244,63,94,0.08)',
                    borderColor: isDark ? 'rgba(244,63,94,0.26)' : 'rgba(244,63,94,0.18)',
                  },
                ]}
                onPress={() => router.push(focusedQuestSessionHref({ deckId: deck.id, cardIds: lapsedCardIds }))}
                activeOpacity={0.82}
                testID="deckHubRecoverLapsedButton"
              >
                <AlertTriangle color="#F43F5E" size={16} strokeWidth={2.2} />
                <Text style={styles.recoverLapsedButtonText}>Recover Lapsed ({lapsedCardIds.length})</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          <View style={styles.statsRow}>
            <View style={[styles.statBox, { backgroundColor: statBg, borderColor: cardBorder }]}> 
              <Text style={[styles.statVal, { color: accuracy !== null ? deck.color : theme.textTertiary }]}>{accuracy !== null ? `${Math.round(accuracy * 100)}%` : '0%'}</Text>
              <Text style={[styles.statLbl, { color: theme.textSecondary }]}>Accuracy</Text>
            </View>
            <View style={[styles.statBox, { backgroundColor: statBg, borderColor: cardBorder }]}> 
              <Text style={[styles.statVal, { color: dueForReviewCount > 0 ? '#F59E0B' : theme.text }]}>{dueForReviewCount}</Text>
              <Text style={[styles.statLbl, { color: theme.textSecondary }]}>Due for Review</Text>
            </View>
            <View style={[styles.statBox, { backgroundColor: statBg, borderColor: cardBorder }]}> 
              <Text style={[styles.statVal, { color: theme.text }]}>{lastStudied ?? 'Never'}</Text>
              <Text style={[styles.statLbl, { color: theme.textSecondary }]}>Last Studied</Text>
            </View>
          </View>

          <TouchableOpacity
            style={[
              styles.actionBtn,
              styles.primaryActionBtn,
              {
                backgroundColor: 'transparent',
                borderColor: deckActionBorder,
                shadowColor: deckActionShadow,
                shadowOpacity: isDark ? 0.32 : 0.24,
                shadowRadius: isDark ? 22 : 16,
                elevation: isDark ? 10 : 7,
              },
            ]}
            onPress={() => router.push({ pathname: '/practice', params: { deckId: deck.id } } as Href)}
            activeOpacity={0.85}
            testID="deckHubPracticeButton"
          >
            <View pointerEvents="none" style={styles.primaryActionSurface}>
              <LinearGradient
                colors={[deckActionStart, deckActionMid, deckActionEnd]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.actionGradientFill}
              />
              <LinearGradient
                colors={[deckActionHighlight, 'rgba(255,255,255,0.02)']}
                start={{ x: 0.15, y: 0 }}
                end={{ x: 0.85, y: 1 }}
                style={styles.actionHighlightOverlay}
              />
              <View style={[styles.actionAccentGlow, { backgroundColor: deckActionGlow }]} />
            </View>
            <View style={[styles.actionIconWrap, { backgroundColor: actionIconSurface, borderColor: actionIconBorder }]}>
              <Swords color="#fff" size={20} strokeWidth={2.35} />
            </View>
            <View style={styles.actionText}>
              <Text style={styles.actionTitle}>Practice vs AI</Text>
              <Text style={styles.actionDesc}>Battle an AI opponent</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.actionBtn,
              styles.secondaryActionBtn,
              {
                backgroundColor: statBg,
                borderColor: actionBorder,
                shadowColor: isDark ? '#000' : deckActionShadow,
                shadowOpacity: isDark ? 0.08 : 0.07,
              },
            ]}
            onPress={() => router.push({ pathname: '/study', params: { deckId: deck.id } } as Href)}
            activeOpacity={0.85}
          >
            <BookOpen color={secondaryActionAccent} size={22} strokeWidth={2.2} />
            <View style={styles.actionText}>
              <Text style={[styles.actionTitle, { color: theme.text }]}>Study</Text>
              <Text style={[styles.secondaryActionDesc, { color: theme.textSecondary }]}>Flip through all cards</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.actionBtn,
              styles.secondaryActionBtn,
              {
                backgroundColor: statBg,
                borderColor: actionBorder,
                shadowColor: isDark ? '#000' : deckActionShadow,
                shadowOpacity: isDark ? 0.08 : 0.07,
              },
            ]}
            onPress={() => router.push({ pathname: '/quest', params: { deckId: deck.id } } as Href)}
            activeOpacity={0.85}
          >
            <Target color={secondaryActionAccent} size={22} strokeWidth={2.2} />
            <View style={styles.actionText}>
              <Text style={[styles.actionTitle, { color: theme.text }]}>Quest</Text>
              <Text style={[styles.secondaryActionDesc, { color: theme.textSecondary }]}>Test your knowledge</Text>
            </View>
          </TouchableOpacity>

          {weakCardCount >= 1 ? (
            <TouchableOpacity
              style={[
                styles.actionBtn,
                styles.secondaryActionBtn,
                {
                  backgroundColor: isDark ? 'rgba(245,158,11,0.12)' : 'rgba(245,158,11,0.08)',
                  borderColor: 'rgba(245,158,11,0.24)',
                },
              ]}
              onPress={() => router.push({ pathname: '/quest', params: { deckId: deck.id, focusWeak: 'true' } } as Href)}
              activeOpacity={0.85}
            >
              <AlertTriangle color="#F59E0B" size={22} strokeWidth={2.2} />
              <View style={styles.actionText}>
                <Text style={[styles.actionTitle, { color: '#F59E0B' }]}>Drill Weak Cards</Text>
                <Text style={[styles.secondaryActionDesc, { color: theme.textSecondary }]}>{weakCardCount} cards need more practice</Text>
              </View>
            </TouchableOpacity>
          ) : null}
        </ScrollView>

        <Modal visible={menuVisible} transparent animationType="fade" onRequestClose={() => setMenuVisible(false)}>
          <Pressable style={styles.menuOverlay} onPress={() => setMenuVisible(false)}>
            <View style={[styles.menuDropdown, { top: menuPos.top, right: menuPos.right, backgroundColor: menuSurface, borderColor: cardBorder }]}>
              <TouchableOpacity
                style={styles.menuItem}
                onPress={handleEditDeck}
                activeOpacity={0.75}
                testID="editDeckButton"
              >
                <Pencil color={theme.primary} size={18} strokeWidth={2.2} />
                <Text style={[styles.menuItemText, { color: theme.text }]}>Edit Deck</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.menuItem}
                onPress={handleDuplicateDeck}
                activeOpacity={0.75}
                testID="duplicateDeckButton"
              >
                <Copy color={theme.primary} size={18} strokeWidth={2.2} />
                <Text style={[styles.menuItemText, { color: theme.text }]}>Duplicate Deck</Text>
              </TouchableOpacity>
              <View style={[styles.menuDivider, { backgroundColor: theme.border }]} />
              <TouchableOpacity
                style={styles.menuItem}
                onPress={handleResetProgress}
                activeOpacity={0.75}
                testID="resetProgressButton"
              >
                <RotateCcw color={theme.textSecondary} size={18} strokeWidth={2.2} />
                <Text style={[styles.menuItemText, { color: theme.text }]}>Reset Progress</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.menuItem}
                onPress={handleDeleteDeck}
                activeOpacity={0.75}
                testID="deleteDeckButton"
              >
                <Trash2 color={theme.error} size={18} strokeWidth={2.2} />
                <Text style={[styles.menuItemText, { color: theme.error }]}>Delete Deck</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Modal>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  topGlow: {
    position: 'absolute',
    top: -90,
    right: -54,
    width: 220,
    height: 220,
    borderRadius: 110,
  },
  bottomGlow: {
    position: 'absolute',
    bottom: 120,
    left: -60,
    width: 220,
    height: 220,
    borderRadius: 110,
  },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14 },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
  },
  fallbackBackBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  menuBtn: {
    width: 44,
    height: 44,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
  },
  menuOverlay: { flex: 1 },
  menuDropdown: {
    position: 'absolute',
    borderRadius: 16,
    paddingVertical: 6,
    minWidth: 190,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 12,
  },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  menuDivider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 12,
  },
  menuItemText: { fontSize: 15, fontWeight: '600' as const },
  headerCenter: { flex: 1, alignItems: 'center', paddingHorizontal: 12 },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'center' },
  headerDot: { width: 10, height: 10, borderRadius: 5 },
  headerTitle: { fontSize: 22, fontWeight: '800' as const, color: '#fff' },
  headerSub: { fontSize: 13, fontWeight: '600' as const, color: 'rgba(255,255,255,0.64)', marginTop: 3 },
  accentBar: { height: 5, borderRadius: 3, marginHorizontal: 20, marginBottom: 10 },
  content: { padding: 20, paddingBottom: 40, gap: 14 },
  errorWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  errorTitle: { fontSize: 18, fontWeight: '700' as const, color: '#fff', marginBottom: 8 },
  errorSubtitle: { fontSize: 14, color: 'rgba(255,255,255,0.6)', marginBottom: 24, textAlign: 'center' as const },
  errorAction: { backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 16, paddingVertical: 14, paddingHorizontal: 24 },
  errorActionText: { fontSize: 16, fontWeight: '700' as const, color: '#fff' },
  card: {
    borderRadius: 26,
    padding: 22,
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    shadowOffset: { width: 0, height: 12 },
  },
  cardLabel: { fontSize: 12, fontWeight: '700' as const, textTransform: 'uppercase' as const, letterSpacing: 0.8, marginBottom: 8 },
  bigPct: { fontSize: 44, fontWeight: '800' as const },
  cardSub: { fontSize: 14, fontWeight: '600' as const, marginTop: 4, marginBottom: 16 },
  barBg: { height: 8, borderRadius: 4, flexDirection: 'row', overflow: 'hidden', width: '100%', marginBottom: 16 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center', paddingHorizontal: 4 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 11, fontWeight: '600' as const },
  recoverLapsedButton: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    alignSelf: 'center',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  recoverLapsedButtonText: {
    color: '#F43F5E',
    fontSize: 12,
    fontWeight: '800' as const,
  },
  statsRow: { flexDirection: 'row', gap: 12 },
  statBox: {
    flex: 1,
    borderRadius: 20,
    padding: 15,
    alignItems: 'center',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 3,
  },
  statVal: { fontSize: 18, fontWeight: '800' as const, textAlign: 'center' as const },
  statLbl: { fontSize: 11, fontWeight: '600' as const, marginTop: 4, textAlign: 'center' as const },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    padding: 17,
    gap: 14,
  },
  primaryActionBtn: {
    position: 'relative',
    borderWidth: 1,
    shadowOffset: { width: 0, height: 10 },
  },
  primaryActionSurface: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 20,
    overflow: 'hidden',
  },
  secondaryActionBtn: {
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 3,
  },
  actionGradientFill: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 20,
  },
  actionHighlightOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 20,
  },
  actionAccentGlow: {
    position: 'absolute',
    top: -40,
    right: -18,
    width: 138,
    height: 138,
    borderRadius: 69,
  },
  actionIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  actionText: { flex: 1 },
  actionTitle: { fontSize: 16, fontWeight: '700' as const, color: '#fff' },
  actionDesc: { fontSize: 12, fontWeight: '600' as const, color: 'rgba(255,255,255,0.82)', marginTop: 2 },
  secondaryActionDesc: { fontSize: 12, fontWeight: '500' as const, marginTop: 2 },
});
