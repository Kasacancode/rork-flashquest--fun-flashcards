import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, BookOpen, Bot, ChevronRight, Play, Settings, Users } from 'lucide-react-native';
import React, { useCallback, useMemo, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import FirstVisitCard from '@/components/FirstVisitCard';
import ConsentSheet from '@/components/privacy/ConsentSheet';
import { useFlashQuest } from '@/context/FlashQuestContext';
import { usePrivacy } from '@/context/PrivacyContext';
import { useTheme } from '@/context/ThemeContext';
import { trackEvent } from '@/lib/analytics';
import { GAME_MODE } from '@/types/game';
import type { PracticeMode } from '@/types/practice';
import { DATA_PRIVACY_ROUTE, DECKS_ROUTE, practiceSessionHref } from '@/utils/routes';
import { getFirstRouteParam } from '@/utils/safeJson';

export default function PracticePage() {
  const router = useRouter();
  const params = useLocalSearchParams<{ deckId?: string | string[] }>();
  const { decks } = useFlashQuest();
  const { hasAcknowledgedAIDisclosure, acknowledgeAIDisclosure } = usePrivacy();
  const { theme, isDark } = useTheme();
  const [selectedMode, setSelectedMode] = useState<PracticeMode | null>(null);
  const [showDeckSelector, setShowDeckSelector] = useState<boolean>(false);
  const [pendingAiDeckId, setPendingAiDeckId] = useState<string | null>(null);

  const requestedDeckId = getFirstRouteParam(params.deckId);
  const preselectedDeck = decks.find((deck) => deck.id === requestedDeckId);

  const startPracticeSession = useCallback((deckId: string, mode: PracticeMode) => {
    const selectedDeck = decks.find((deck) => deck.id === deckId);
    trackEvent({
      event: 'deck_played',
      deckId,
      properties: {
        deck_name: selectedDeck?.name ?? null,
        mode: GAME_MODE.PRACTICE,
        player_count: mode === 'multiplayer' ? 2 : 1,
      },
    });
    router.push(practiceSessionHref(deckId, mode));
  }, [decks, router]);

  const handleModeSelect = useCallback((mode: PracticeMode) => {
    setSelectedMode(mode);
    if (preselectedDeck) {
      if (mode === 'ai' && !hasAcknowledgedAIDisclosure('gameplayAssist')) {
        setPendingAiDeckId(preselectedDeck.id);
        return;
      }

      startPracticeSession(preselectedDeck.id, mode);
      return;
    }
    setShowDeckSelector(true);
  }, [hasAcknowledgedAIDisclosure, preselectedDeck, startPracticeSession]);

  const handleDeckSelect = useCallback((deckId: string) => {
    if (!selectedMode) {
      return;
    }

    setShowDeckSelector(false);

    if (selectedMode === 'ai' && !hasAcknowledgedAIDisclosure('gameplayAssist')) {
      setPendingAiDeckId(deckId);
      return;
    }

    startPracticeSession(deckId, selectedMode);
  }, [hasAcknowledgedAIDisclosure, selectedMode, startPracticeSession]);

  const handleAcceptGameplayDisclosure = useCallback(() => {
    if (!pendingAiDeckId) {
      return;
    }

    const nextDeckId = pendingAiDeckId;
    setPendingAiDeckId(null);
    acknowledgeAIDisclosure('gameplayAssist');
    startPracticeSession(nextDeckId, 'ai');
  }, [acknowledgeAIDisclosure, pendingAiDeckId, startPracticeSession]);

  const handleDismissGameplayDisclosure = useCallback(() => {
    setPendingAiDeckId(null);
  }, []);

  const backgroundGradient = useMemo(
    () => (
      isDark
        ? ['#101827', '#1b1d32', '#0b1322'] as const
        : ['#faf7ff', '#f1f5ff', '#fff7fb'] as const
    ),
    [isDark],
  );

  const topGlow = isDark ? 'rgba(96, 165, 250, 0.14)' : 'rgba(99, 102, 241, 0.12)';
  const bottomGlow = isDark ? 'rgba(244, 114, 182, 0.1)' : 'rgba(236, 72, 153, 0.08)';
  const heroSurface = isDark ? 'rgba(10, 16, 29, 0.8)' : 'rgba(255, 255, 255, 0.8)';
  const secondarySurface = isDark ? 'rgba(10, 17, 30, 0.84)' : 'rgba(255, 255, 255, 0.86)';
  const headerSurface = isDark ? 'rgba(10, 17, 30, 0.4)' : 'rgba(255, 255, 255, 0.5)';
  const headerBorder = isDark ? 'rgba(148, 163, 184, 0.14)' : 'rgba(99, 102, 241, 0.12)';
  const headerButtonBorder = isDark ? 'rgba(148, 163, 184, 0.18)' : 'rgba(99, 102, 241, 0.14)';
  const controlSurface = isDark ? 'rgba(17, 24, 39, 0.44)' : 'rgba(255, 255, 255, 0.62)';
  const surfaceBorderColor = isDark ? 'rgba(148, 163, 184, 0.14)' : 'rgba(99, 102, 241, 0.1)';
  const subtleBorderColor = isDark ? 'rgba(148, 163, 184, 0.1)' : 'rgba(99, 102, 241, 0.08)';
  const insetSurface = isDark ? 'rgba(255, 255, 255, 0.065)' : 'rgba(99, 102, 241, 0.08)';
  const mutedTextColor = isDark ? 'rgba(226, 232, 240, 0.84)' : '#5b618d';
  const headerContentColor = isDark ? '#f8fafc' : '#2f2b5d';
  const aiGradient = isDark ? ['#4f7cff', '#6158f3'] as const : ['#5f7cff', '#7264ff'] as const;
  const localAccent = isDark ? '#f472b6' : '#ec4899';
  const modalSurface = isDark ? 'rgba(10, 16, 28, 0.98)' : 'rgba(255, 255, 255, 0.98)';
  const summaryAccent = isDark ? '#93c5fd' : '#4f46e5';

  const summaryTitle = preselectedDeck ? preselectedDeck.name : `${decks.length} decks ready`;
  const summarySubtitle = preselectedDeck
    ? `${preselectedDeck.flashcards.length} cards loaded for your next match`
    : 'Pick a mode first, then choose the deck you want to practice';

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]} testID="practice-screen">
      <LinearGradient
        colors={backgroundGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.topGlow, { backgroundColor: topGlow }]} pointerEvents="none" />
      <View style={[styles.bottomGlow, { backgroundColor: bottomGlow }]} pointerEvents="none" />

      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={[
              styles.headerButton,
              {
                backgroundColor: controlSurface,
                borderColor: headerButtonBorder,
                shadowOpacity: isDark ? 0.22 : 0.08,
                shadowRadius: isDark ? 14 : 9,
                elevation: isDark ? 6 : 3,
              },
            ]}
            activeOpacity={0.75}
            testID="practice-back-button"
          >
            <ArrowLeft color={headerContentColor} size={24} strokeWidth={2.4} />
          </TouchableOpacity>

          <View style={[styles.headerTitleContainer, { backgroundColor: headerSurface, borderColor: headerBorder }]}>
            <Bot color={headerContentColor} size={20} strokeWidth={2.3} />
            <Text style={[styles.headerTitle, { color: headerContentColor }]}>Practice</Text>
          </View>

          <View style={styles.headerPlaceholder} />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.titleSection}>
            <Text style={[styles.title, { color: isDark ? '#F8FAFC' : '#2D2A61' }]}>Choose Your Practice</Text>
            <Text style={[styles.subtitle, { color: mutedTextColor }]}>
              {preselectedDeck
                ? `Using ${preselectedDeck.name} — pick solo or local versus.`
                : 'Quick head-to-head rounds with a sharper, cleaner setup.'}
            </Text>
          </View>

          <FirstVisitCard
            screen="practice"
            title="How Practice works"
            lines={[
              'Pick a deck and go head-to-head against an AI opponent over 5 rounds.',
              'The AI adapts to your level, so matches stay competitive.',
              'You both answer the same questions. Fastest and most accurate wins.',
            ]}
            accentColor={theme.primary}
          />

          {decks.length === 0 ? (
            <View
              style={[
                styles.emptyState,
                {
                  backgroundColor: heroSurface,
                  borderColor: surfaceBorderColor,
                },
              ]}
            >
              <View style={[styles.emptyStateIconShell, { backgroundColor: insetSurface }]}>
                <BookOpen color={theme.textTertiary} size={28} strokeWidth={2.2} />
              </View>
              <Text style={[styles.emptyStateTitle, { color: theme.text }]}>No decks available</Text>
              <Text style={[styles.emptyStateSubtitle, { color: theme.textSecondary }]}>Create a deck to start practicing.</Text>
              <TouchableOpacity
                style={[styles.emptyStateButton, { backgroundColor: theme.primary }]}
                onPress={() => router.push(DECKS_ROUTE)}
                activeOpacity={0.85}
                testID="practice-empty-go-to-decks"
              >
                <Text style={styles.emptyStateButtonText}>Go to Decks</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <View
                style={[
                  styles.summaryStrip,
                  {
                    backgroundColor: heroSurface,
                    borderColor: surfaceBorderColor,
                    shadowOpacity: isDark ? 0.2 : 0.08,
                    shadowRadius: isDark ? 16 : 10,
                    elevation: isDark ? 7 : 3,
                  },
                ]}
              >
                <View style={styles.summaryRow}>
                  <View style={[styles.summaryIconShell, { backgroundColor: insetSurface }]}>
                    <BookOpen color={summaryAccent} size={20} strokeWidth={2.3} />
                  </View>
                  <View style={styles.summaryCopy}>
                    <Text style={[styles.summaryEyebrow, { color: summaryAccent }]}>
                      {preselectedDeck ? 'Selected deck' : 'Deck lineup'}
                    </Text>
                    <Text style={[styles.summaryTitle, { color: theme.text }]} numberOfLines={1}>{summaryTitle}</Text>
                    <Text style={[styles.summarySubtitle, { color: theme.textSecondary }]} numberOfLines={2}>{summarySubtitle}</Text>
                  </View>
                  <View style={[styles.summaryPill, { backgroundColor: insetSurface, borderColor: subtleBorderColor }]}>
                    <Text style={[styles.summaryPillText, { color: summaryAccent }]}>5 rounds</Text>
                  </View>
                </View>
              </View>

              <TouchableOpacity
                style={[
                  styles.primaryActionCard,
                  {
                    shadowOpacity: isDark ? 0.26 : 0.14,
                    shadowRadius: isDark ? 18 : 12,
                    elevation: isDark ? 10 : 4,
                  },
                ]}
                onPress={() => handleModeSelect('ai')}
                activeOpacity={0.9}
                testID="practice-ai-card"
              >
                <LinearGradient
                  colors={aiGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.primaryActionGradient}
                >
                  <View style={styles.actionTopRow}>
                    <Text style={styles.primaryEyebrow}>Smart AI match</Text>
                    <View style={styles.settingsChip}>
                      <Settings color="#fff" size={16} strokeWidth={2.2} />
                    </View>
                  </View>
                  <View style={styles.actionRow}>
                    <View style={styles.primaryIconShell}>
                      <Bot color="#fff" size={30} strokeWidth={2.2} />
                    </View>
                    <View style={styles.actionContent}>
                      <Text style={styles.primaryActionTitle}>Solo Practice</Text>
                      <Text style={styles.primaryActionSubtitle}>
                        Face the adaptive AI in a fast five-round match with clean pacing.
                      </Text>
                      <View style={styles.actionFooterRow}>
                        <Text style={styles.primaryActionFootnote} numberOfLines={1}>
                          {preselectedDeck ? `Using ${preselectedDeck.name}` : 'Choose a deck after tapping'}
                        </Text>
                        <View style={styles.primaryStartPill}>
                          <Play color="#fff" size={16} strokeWidth={2.4} fill="#fff" />
                          <Text style={styles.primaryStartText}>Start</Text>
                        </View>
                      </View>
                    </View>
                  </View>
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.secondaryActionCard,
                  {
                    backgroundColor: secondarySurface,
                    borderColor: surfaceBorderColor,
                    shadowOpacity: isDark ? 0.2 : 0.08,
                    shadowRadius: isDark ? 14 : 8,
                    elevation: isDark ? 6 : 2,
                  },
                ]}
                onPress={() => handleModeSelect('multiplayer')}
                activeOpacity={0.85}
                testID="practice-local-card"
              >
                <View style={[styles.secondaryAccentBar, { backgroundColor: localAccent }]} />
                <View style={styles.secondaryCardContent}>
                  <View style={styles.actionTopRow}>
                    <Text style={[styles.secondaryEyebrow, { color: localAccent }]}>Pass-and-play</Text>
                    <View style={[styles.secondarySettingsChip, { backgroundColor: insetSurface, borderColor: subtleBorderColor }]}>
                      <Settings color={localAccent} size={16} strokeWidth={2.2} />
                    </View>
                  </View>
                  <View style={styles.actionRow}>
                    <View style={[styles.secondaryIconShell, { backgroundColor: insetSurface }]}>
                      <Users color={localAccent} size={28} strokeWidth={2.2} />
                    </View>
                    <View style={styles.actionContent}>
                      <Text style={[styles.secondaryActionTitle, { color: theme.text }]}>Local Versus</Text>
                      <Text style={[styles.secondaryActionSubtitle, { color: theme.textSecondary }]}>Pass the device between two players for a quick local battle.</Text>
                      <View style={styles.actionFooterRow}>
                        <Text style={[styles.secondaryActionFootnote, { color: theme.textSecondary }]} numberOfLines={1}>
                          {preselectedDeck ? `${preselectedDeck.flashcards.length} cards ready` : 'Choose a deck after tapping'}
                        </Text>
                        <View
                          style={[
                            styles.secondaryStartPill,
                            {
                              backgroundColor: isDark ? 'rgba(244, 114, 182, 0.14)' : 'rgba(236, 72, 153, 0.1)',
                              borderColor: isDark ? 'rgba(244, 114, 182, 0.26)' : 'rgba(236, 72, 153, 0.16)',
                            },
                          ]}
                        >
                          <Play color={localAccent} size={16} strokeWidth={2.4} fill={localAccent} />
                          <Text style={[styles.secondaryStartText, { color: localAccent }]}>Start</Text>
                        </View>
                      </View>
                    </View>
                  </View>
                </View>
              </TouchableOpacity>

              <View
                style={[
                  styles.infoCard,
                  {
                    backgroundColor: secondarySurface,
                    borderColor: surfaceBorderColor,
                  },
                ]}
              >
                <Text style={[styles.infoTitle, { color: theme.text }]}>How It Works</Text>
                <View style={styles.infoList}>
                  <View style={styles.infoRow}>
                    <View style={[styles.infoDot, { backgroundColor: summaryAccent }]} />
                    <Text style={[styles.infoText, { color: theme.textSecondary }]}>5 flashcard rounds with fast scoring and quick resets.</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <View style={[styles.infoDot, { backgroundColor: summaryAccent }]} />
                    <Text style={[styles.infoText, { color: theme.textSecondary }]}>Solo uses the AI opponent. Local passes the device between two players.</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <View style={[styles.infoDot, { backgroundColor: summaryAccent }]} />
                    <Text style={[styles.infoText, { color: theme.textSecondary }]}>Win clean rounds, learn faster, then jump back in for another set.</Text>
                  </View>
                </View>
              </View>
            </>
          )}
        </ScrollView>
      </SafeAreaView>

      <Modal
        visible={showDeckSelector}
        animationType="slide"
        transparent
        onRequestClose={() => setShowDeckSelector(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: modalSurface, borderColor: surfaceBorderColor }]}>
            <View style={[styles.modalHandle, { backgroundColor: isDark ? 'rgba(148, 163, 184, 0.35)' : 'rgba(99, 102, 241, 0.18)' }]} />
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderCopy}>
                <Text style={[styles.modalTitle, { color: theme.text }]}>Choose a deck</Text>
                <Text style={[styles.modalSubtitle, { color: theme.textSecondary }]}>
                  {selectedMode === 'multiplayer' ? 'Local Versus' : 'Solo Practice'}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowDeckSelector(false)}
                style={[styles.modalCloseButton, { backgroundColor: insetSurface, borderColor: subtleBorderColor }]}
                activeOpacity={0.75}
                testID="practice-close-deck-selector"
              >
                <Text style={[styles.modalCloseText, { color: theme.textSecondary }]}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.deckList} showsVerticalScrollIndicator={false}>
              {decks.length === 0 ? (
                <View style={styles.modalEmptyState}>
                  <Text style={[styles.modalEmptyTitle, { color: theme.text }]}>No Decks Yet</Text>
                  <Text style={[styles.modalEmptySubtitle, { color: theme.textSecondary }]}>Create your first deck to start practicing.</Text>
                  <TouchableOpacity
                    onPress={() => {
                      setShowDeckSelector(false);
                      router.push(DECKS_ROUTE);
                    }}
                    style={[styles.modalEmptyButton, { backgroundColor: theme.primary }]}
                  >
                    <Text style={styles.modalEmptyButtonText}>Go to Decks</Text>
                  </TouchableOpacity>
                </View>
              ) : decks.map((deck) => (
                <TouchableOpacity
                  key={deck.id}
                  style={[styles.deckOption, { backgroundColor: secondarySurface, borderColor: surfaceBorderColor }]}
                  onPress={() => handleDeckSelect(deck.id)}
                  activeOpacity={0.8}
                  testID={`practice-deck-option-${deck.id}`}
                >
                  <View style={[styles.deckAccent, { backgroundColor: deck.color }]} />
                  <View style={[styles.deckOptionIconShell, { backgroundColor: insetSurface }]}>
                    <BookOpen color={deck.color} size={18} strokeWidth={2.3} />
                  </View>
                  <View style={styles.deckOptionInfo}>
                    <Text style={[styles.deckOptionName, { color: theme.text }]} numberOfLines={1}>{deck.name}</Text>
                    <Text style={[styles.deckOptionCards, { color: theme.textSecondary }]} numberOfLines={1}>
                      {deck.flashcards.length} cards · {deck.category}
                    </Text>
                  </View>
                  <ChevronRight color={theme.textTertiary} size={18} strokeWidth={2.4} />
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
      <ConsentSheet
        visible={pendingAiDeckId !== null}
        title="Use AI-assisted practice?"
        description="Solo Practice sends the current question and answer to an AI processing service to generate stronger answer choices for the match."
        bullets={[
          'Only the flashcard content needed for the current round is sent for this feature.',
          'Local pass-and-play does not use this AI processing flow.',
          'You can revisit this anytime in Privacy & Data.',
        ]}
        primaryLabel="Continue"
        secondaryLabel="Cancel"
        onPrimaryPress={handleAcceptGameplayDisclosure}
        onSecondaryPress={handleDismissGameplayDisclosure}
        footerActionLabel="Open Privacy & Data"
        onFooterActionPress={() => router.push(DATA_PRIVACY_ROUTE)}
        testID="practice-ai-disclosure"
      />
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
  topGlow: {
    position: 'absolute',
    top: -98,
    right: -56,
    width: 220,
    height: 220,
    borderRadius: 110,
  },
  bottomGlow: {
    position: 'absolute',
    bottom: 90,
    left: -62,
    width: 230,
    height: 230,
    borderRadius: 115,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  headerButton: {
    width: 52,
    height: 52,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 20,
    borderWidth: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800' as const,
  },
  headerPlaceholder: {
    width: 52,
    height: 52,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    gap: 14,
  },
  titleSection: {
    marginTop: 8,
    marginBottom: 2,
  },
  title: {
    fontSize: 42,
    lineHeight: 46,
    fontWeight: '900' as const,
    color: '#fff',
    letterSpacing: -1.1,
    maxWidth: 280,
  },
  subtitle: {
    marginTop: 12,
    fontSize: 17,
    lineHeight: 24,
    fontWeight: '600' as const,
    maxWidth: 340,
  },
  summaryStrip: {
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  summaryIconShell: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  summaryCopy: {
    flex: 1,
    marginRight: 12,
  },
  summaryEyebrow: {
    fontSize: 12,
    fontWeight: '800' as const,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  summaryTitle: {
    fontSize: 20,
    fontWeight: '800' as const,
  },
  summarySubtitle: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600' as const,
  },
  summaryPill: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  summaryPillText: {
    fontSize: 12,
    fontWeight: '800' as const,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  primaryActionCard: {
    borderRadius: 28,
    overflow: 'hidden',
    shadowColor: '#1d4ed8',
    shadowOffset: { width: 0, height: 12 },
  },
  primaryActionGradient: {
    padding: 20,
    minHeight: 222,
    justifyContent: 'space-between',
  },
  actionTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  primaryEyebrow: {
    fontSize: 13,
    fontWeight: '800' as const,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: 'rgba(255, 255, 255, 0.86)',
  },
  settingsChip: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  primaryIconShell: {
    width: 72,
    height: 72,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    marginRight: 16,
  },
  actionContent: {
    flex: 1,
  },
  primaryActionTitle: {
    fontSize: 32,
    lineHeight: 34,
    fontWeight: '900' as const,
    color: '#fff',
    letterSpacing: -0.8,
  },
  primaryActionSubtitle: {
    marginTop: 10,
    fontSize: 16,
    lineHeight: 23,
    fontWeight: '600' as const,
    color: 'rgba(255, 255, 255, 0.88)',
    maxWidth: 240,
  },
  actionFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 18,
    gap: 12,
  },
  primaryActionFootnote: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700' as const,
    color: 'rgba(255, 255, 255, 0.82)',
  },
  primaryStartPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
  },
  primaryStartText: {
    fontSize: 14,
    fontWeight: '800' as const,
    color: '#fff',
  },
  secondaryActionCard: {
    position: 'relative',
    borderRadius: 26,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
  },
  secondaryAccentBar: {
    position: 'absolute',
    top: 18,
    bottom: 18,
    left: 0,
    width: 5,
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
  },
  secondaryCardContent: {
    padding: 20,
    paddingLeft: 22,
  },
  secondaryEyebrow: {
    fontSize: 13,
    fontWeight: '800' as const,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  secondarySettingsChip: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  secondaryIconShell: {
    width: 68,
    height: 68,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  secondaryActionTitle: {
    fontSize: 30,
    lineHeight: 32,
    fontWeight: '900' as const,
    letterSpacing: -0.7,
  },
  secondaryActionSubtitle: {
    marginTop: 10,
    fontSize: 16,
    lineHeight: 23,
    fontWeight: '600' as const,
    maxWidth: 240,
  },
  secondaryActionFootnote: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700' as const,
  },
  secondaryStartPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
  },
  secondaryStartText: {
    fontSize: 14,
    fontWeight: '800' as const,
  },
  infoCard: {
    marginTop: 2,
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
  },
  infoTitle: {
    fontSize: 24,
    fontWeight: '800' as const,
    marginBottom: 14,
    letterSpacing: -0.4,
  },
  infoList: {
    gap: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  infoDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 7,
  },
  infoText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600' as const,
  },
  emptyState: {
    minHeight: 360,
    marginTop: 8,
    borderRadius: 28,
    paddingHorizontal: 24,
    paddingVertical: 28,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyStateIconShell: {
    width: 64,
    height: 64,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyStateTitle: {
    marginTop: 18,
    fontSize: 20,
    fontWeight: '800' as const,
    textAlign: 'center',
  },
  emptyStateSubtitle: {
    marginTop: 8,
    maxWidth: 280,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600' as const,
    textAlign: 'center',
  },
  emptyStateButton: {
    marginTop: 20,
    minWidth: 148,
    borderRadius: 16,
    paddingHorizontal: 22,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyStateButtonText: {
    fontSize: 15,
    fontWeight: '800' as const,
    color: '#fff',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.56)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    borderWidth: 1,
    paddingTop: 10,
    paddingBottom: 36,
    maxHeight: '78%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 12,
  },
  modalHandle: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    borderRadius: 3,
    marginBottom: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 18,
  },
  modalHeaderCopy: {
    flex: 1,
    marginRight: 12,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '800' as const,
    letterSpacing: -0.5,
  },
  modalSubtitle: {
    marginTop: 4,
    fontSize: 14,
    fontWeight: '600' as const,
  },
  modalCloseButton: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  modalCloseText: {
    fontSize: 20,
    fontWeight: '600' as const,
  },
  deckList: {
    paddingHorizontal: 20,
  },
  deckOption: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
  },
  modalEmptyState: {
    alignItems: 'center',
    paddingVertical: 28,
    paddingHorizontal: 20,
  },
  modalEmptyTitle: {
    fontSize: 18,
    fontWeight: '800' as const,
    marginBottom: 8,
  },
  modalEmptySubtitle: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500' as const,
    textAlign: 'center',
    marginBottom: 18,
  },
  modalEmptyButton: {
    borderRadius: 16,
    paddingHorizontal: 22,
    paddingVertical: 14,
  },
  modalEmptyButtonText: {
    fontSize: 15,
    fontWeight: '800' as const,
    color: '#fff',
  },
  deckAccent: {
    width: 4,
    alignSelf: 'stretch',
    borderRadius: 4,
    marginRight: 12,
  },
  deckOptionIconShell: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  deckOptionInfo: {
    flex: 1,
    marginRight: 12,
  },
  deckOptionName: {
    fontSize: 16,
    fontWeight: '800' as const,
  },
  deckOptionCards: {
    marginTop: 3,
    fontSize: 13,
    fontWeight: '600' as const,
  },
});
