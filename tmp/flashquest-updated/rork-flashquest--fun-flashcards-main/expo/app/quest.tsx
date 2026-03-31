import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Target, Zap, BookOpen, Play, ChevronRight, Settings, X, Flame, Award } from 'lucide-react-native';
import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal, Animated, Dimensions, Pressable, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import ConsentSheet from '@/components/privacy/ConsentSheet';
import QuestDeckSelector from '@/components/quest/QuestDeckSelector';
import QuestSettingsOptions from '@/components/quest/QuestSettingsOptions';
import { useFlashQuest } from '@/context/FlashQuestContext';
import { usePerformance } from '@/context/PerformanceContext';
import { usePrivacy } from '@/context/PrivacyContext';
import { useTheme } from '@/context/ThemeContext';
import type { QuestMode, QuestSettings } from '@/types/performance';
import { serializeQuestSettings } from '@/utils/questParams';
import { DATA_PRIVACY_ROUTE, DECKS_ROUTE, questSessionHref } from '@/utils/routes';
import { getFirstRouteParam } from '@/utils/safeJson';

type RunLength = 5 | 10 | 20;
type TimerOption = 0 | 5 | 10;

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const SHEET_HEIGHT = SCREEN_HEIGHT * 0.65;

export default function QuestMenuScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ deckId?: string | string[]; focusWeak?: string | string[] }>();
  const { theme, isDark } = useTheme();
  const { decks } = useFlashQuest();
  const { performance, getLastQuestSettings, getDeckAccuracy, getOverallQuestAccuracy, saveLastQuestSettings } = usePerformance();
  const { hasAcknowledgedAIDisclosure, acknowledgeAIDisclosure } = usePrivacy();

  const lastSettings = getLastQuestSettings();

  const requestedDeckId = getFirstRouteParam(params.deckId);
  const focusWeakParam = getFirstRouteParam(params.focusWeak);

  const [selectedDeckId, setSelectedDeckId] = useState<string>(requestedDeckId || lastSettings?.deckId || decks[0]?.id || '');
  const [mode, setMode] = useState<QuestMode>(lastSettings?.mode || 'learn');
  const [runLength, setRunLength] = useState<RunLength>(lastSettings?.runLength || 10);
  const [timerSeconds, setTimerSeconds] = useState<TimerOption>(lastSettings?.timerSeconds || 0);
  const [focusWeakOnly, setFocusWeakOnly] = useState<boolean>(focusWeakParam === 'true' || lastSettings?.focusWeakOnly || false);
  const [hintsEnabled, setHintsEnabled] = useState<boolean>(lastSettings?.hintsEnabled ?? (mode === 'learn'));
  const [explanationsEnabled, setExplanationsEnabled] = useState<boolean>(lastSettings?.explanationsEnabled ?? (mode === 'learn'));
  const [secondChanceEnabled, setSecondChanceEnabled] = useState<boolean>(lastSettings?.secondChanceEnabled || false);

  const [sheetVisible, setSheetVisible] = useState<boolean>(false);
  const [pendingQuestSettings, setPendingQuestSettings] = useState<QuestSettings | null>(null);
  const slideAnim = useRef(new Animated.Value(SHEET_HEIGHT)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;

  const selectedDeck = useMemo(() => decks.find(d => d.id === selectedDeckId), [decks, selectedDeckId]);
  const hasDecks = decks.length > 0;

  useEffect(() => {
    if (requestedDeckId && decks.some((deck) => deck.id === requestedDeckId)) {
      setSelectedDeckId(requestedDeckId);
    }
    if (focusWeakParam === 'true') {
      setFocusWeakOnly(true);
    }
  }, [decks, focusWeakParam, requestedDeckId]);

  const overallAccuracy = getOverallQuestAccuracy();
  const deckAccuracy = selectedDeckId ? getDeckAccuracy(selectedDeckId) : null;

  const openSheet = useCallback(() => {
    setSheetVisible(true);
    Animated.parallel([
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        damping: 20,
        stiffness: 200,
      }),
      Animated.timing(backdropAnim, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start();
  }, [slideAnim, backdropAnim]);

  const closeSheet = useCallback(() => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: SHEET_HEIGHT,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(backdropAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setSheetVisible(false);
    });
  }, [slideAnim, backdropAnim]);

  const handleModeChange = (newMode: QuestMode) => {
    setMode(newMode);
    if (newMode === 'learn') {
      setHintsEnabled(true);
      setExplanationsEnabled(true);
      setTimerSeconds(0);
    } else {
      setHintsEnabled(false);
      setExplanationsEnabled(false);
    }
  };

  const launchQuest = useCallback((settings: QuestSettings) => {
    saveLastQuestSettings(settings);
    router.push(questSessionHref({ settings: serializeQuestSettings(settings) }));
  }, [router, saveLastQuestSettings]);

  const handleStartQuest = useCallback(() => {
    if (!selectedDeckId) {
      return;
    }

    const settings: QuestSettings = {
      deckId: selectedDeckId,
      mode,
      runLength,
      timerSeconds,
      focusWeakOnly,
      hintsEnabled,
      explanationsEnabled,
      secondChanceEnabled,
    };

    if (!hasAcknowledgedAIDisclosure('gameplayAssist')) {
      setPendingQuestSettings(settings);
      return;
    }

    launchQuest(settings);
  }, [
    explanationsEnabled,
    focusWeakOnly,
    hasAcknowledgedAIDisclosure,
    hintsEnabled,
    launchQuest,
    mode,
    runLength,
    secondChanceEnabled,
    selectedDeckId,
    timerSeconds,
  ]);

  const handleQuickResume = useCallback(() => {
    if (!lastSettings) {
      return;
    }

    if (!hasAcknowledgedAIDisclosure('gameplayAssist')) {
      setPendingQuestSettings(lastSettings);
      return;
    }

    launchQuest(lastSettings);
  }, [hasAcknowledgedAIDisclosure, lastSettings, launchQuest]);

  const handleAcceptGameplayDisclosure = useCallback(() => {
    if (!pendingQuestSettings) {
      return;
    }

    const nextSettings = pendingQuestSettings;
    setPendingQuestSettings(null);
    acknowledgeAIDisclosure('gameplayAssist');
    launchQuest(nextSettings);
  }, [acknowledgeAIDisclosure, launchQuest, pendingQuestSettings]);

  const handleDismissGameplayDisclosure = useCallback(() => {
    setPendingQuestSettings(null);
  }, []);

  const smallDeckWarning = selectedDeck && selectedDeck.flashcards.length < 8;
  const screenGradient = isDark
    ? ['#0b1324', '#13203a', '#0a1224'] as const
    : ['#eaf0ff', '#e5ecff', '#ece9ff', '#f4eeff'] as const;
  const upperAtmosphereGradient = isDark
    ? ['rgba(8, 15, 29, 0)', 'rgba(66, 86, 168, 0.08)', 'rgba(14, 20, 36, 0)'] as const
    : ['rgba(102, 137, 255, 0.28)', 'rgba(123, 113, 244, 0.16)', 'rgba(255, 255, 255, 0)'] as const;
  const lowerAtmosphereGradient = isDark
    ? ['rgba(16, 24, 39, 0)', 'rgba(78, 64, 172, 0.05)', 'rgba(20, 28, 46, 0.08)'] as const
    : ['rgba(255, 255, 255, 0)', 'rgba(188, 170, 244, 0.12)', 'rgba(214, 187, 244, 0.2)'] as const;
  const shellOverlayGradient = isDark
    ? ['rgba(10, 16, 29, 0)', 'rgba(9, 16, 29, 0.1)', 'rgba(4, 8, 18, 0.2)'] as const
    : ['rgba(255, 255, 255, 0.08)', 'rgba(117, 132, 240, 0.08)', 'rgba(198, 177, 238, 0.12)'] as const;
  const surfaceBorderColor = isDark ? 'rgba(148, 163, 184, 0.13)' : 'rgba(148, 163, 184, 0.16)';
  const subtleBorderColor = isDark ? 'rgba(148, 163, 184, 0.1)' : 'rgba(129, 140, 248, 0.12)';
  const statSurface = isDark ? 'rgba(9, 17, 33, 0.78)' : 'rgba(255, 255, 255, 0.82)';
  const sectionSurface = isDark ? 'rgba(10, 18, 34, 0.84)' : 'rgba(255, 255, 255, 0.86)';
  const insetSurface = isDark ? 'rgba(16, 26, 44, 0.92)' : 'rgba(246, 247, 255, 0.96)';
  const selectedSurface = isDark ? 'rgba(99, 102, 241, 0.14)' : 'rgba(79, 70, 229, 0.1)';
  const controlSurface = isDark ? 'rgba(10, 17, 34, 0.46)' : 'rgba(255, 255, 255, 0.62)';
  const headerSurface = isDark ? 'rgba(10, 17, 34, 0.42)' : 'rgba(255, 255, 255, 0.56)';
  const sheetSurface = isDark ? 'rgba(10, 17, 34, 0.98)' : 'rgba(255, 255, 255, 0.96)';
  const inactiveToggleSurface = isDark ? 'rgba(71, 85, 105, 0.58)' : 'rgba(203, 213, 225, 0.9)';
  const questAccent = isDark ? '#A5B4FC' : '#4F46E5';
  const headerContentColor = isDark ? '#F8FAFC' : '#2E2A60';
  const topGlowColor = isDark ? 'rgba(99, 102, 241, 0.16)' : 'rgba(99, 121, 255, 0.22)';
  const midGlowColor = isDark ? 'rgba(45, 212, 191, 0.08)' : 'rgba(128, 109, 241, 0.1)';
  const bottomGlowColor = isDark ? 'rgba(45, 212, 191, 0.1)' : 'rgba(204, 168, 240, 0.18)';

  const settingsLabel = useMemo(() => {
    const parts: string[] = [];
    parts.push(`${runLength} cards`);
    if (timerSeconds > 0) parts.push(`${timerSeconds}s timer`);
    if (focusWeakOnly) parts.push('weak focus');
    if (hintsEnabled) parts.push('hints');
    if (secondChanceEnabled) parts.push('2nd chance');
    return parts.join(' · ');
  }, [runLength, timerSeconds, focusWeakOnly, hintsEnabled, secondChanceEnabled]);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <LinearGradient
        colors={screenGradient}
        start={{ x: 0.04, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={upperAtmosphereGradient}
        start={{ x: 0.02, y: 0 }}
        end={{ x: 0.82, y: 0.42 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <LinearGradient
        colors={lowerAtmosphereGradient}
        start={{ x: 0.2, y: 0.5 }}
        end={{ x: 0.94, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <LinearGradient
        colors={shellOverlayGradient}
        start={{ x: 0.08, y: 0 }}
        end={{ x: 0.95, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <View pointerEvents="none" style={[styles.topGlow, { backgroundColor: topGlowColor }]} />
      <View pointerEvents="none" style={[styles.midGlow, { backgroundColor: midGlowColor }]} />
      <View pointerEvents="none" style={[styles.bottomGlow, { backgroundColor: bottomGlowColor }]} />

      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <TouchableOpacity
            style={[
              styles.backButton,
              {
                backgroundColor: controlSurface,
                borderWidth: 1,
                borderColor: subtleBorderColor,
                shadowOpacity: isDark ? 0.22 : 0.08,
                shadowRadius: isDark ? 14 : 10,
                elevation: isDark ? 6 : 3,
              },
            ]}
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <ArrowLeft color={headerContentColor} size={24} />
          </TouchableOpacity>
          <View style={[styles.headerTitleContainer, { backgroundColor: headerSurface, borderColor: subtleBorderColor }]}>
            <Target color={headerContentColor} size={24} strokeWidth={2.4} />
            <Text style={[styles.headerTitle, { color: headerContentColor }]}>Quest</Text>
          </View>
          <TouchableOpacity
            style={[
              styles.settingsButton,
              {
                backgroundColor: controlSurface,
                borderWidth: 1,
                borderColor: subtleBorderColor,
                shadowOpacity: isDark ? 0.22 : 0.08,
                shadowRadius: isDark ? 14 : 10,
                elevation: isDark ? 6 : 3,
              },
            ]}
            onPress={openSheet}
            activeOpacity={0.7}
          >
            <Settings color={headerContentColor} size={22} />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {!hasDecks ? (
            <View style={[styles.emptyState, { backgroundColor: sectionSurface, borderColor: surfaceBorderColor }]}> 
              <Target color={theme.textTertiary} size={48} strokeWidth={2.2} />
              <Text style={[styles.emptyStateTitle, { color: theme.text }]}>No decks available</Text>
              <Text style={[styles.emptyStateSubtitle, { color: theme.textSecondary }]}>Create a deck first, then come back to start a quest.</Text>
              <TouchableOpacity
                style={[styles.emptyStateButton, { backgroundColor: theme.primary }]}
                onPress={() => router.push(DECKS_ROUTE)}
                activeOpacity={0.85}
                testID="quest-empty-go-to-decks"
              >
                <Text style={styles.emptyStateButtonText}>Go to Decks</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <View
                style={[
                  styles.statsCard,
                  {
                    backgroundColor: statSurface,
                    borderWidth: isDark ? 1 : 0,
                    borderColor: surfaceBorderColor,
                    shadowOpacity: isDark ? 0.22 : 0.1,
                    shadowRadius: isDark ? 14 : 8,
                    elevation: isDark ? 7 : 4,
                  },
                ]}
              >
            <View style={styles.statItem}>
              <View style={[styles.statIconShell, { backgroundColor: insetSurface }]}> 
                <Target color={questAccent} size={18} strokeWidth={2.2} />
              </View>
              <Text style={[styles.statValue, { color: theme.text }]}>
                {overallAccuracy !== null ? `${Math.round(overallAccuracy * 100)}%` : '--'}
              </Text>
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Quest Accuracy</Text>
            </View>
            <View
              style={[
                styles.statDivider,
                { backgroundColor: isDark ? 'rgba(148, 163, 184, 0.18)' : 'rgba(0,0,0,0.08)' },
              ]}
            />
            <View style={styles.statItem}>
              <View style={[styles.statIconShell, { backgroundColor: insetSurface }]}> 
                <Flame color={questAccent} size={18} strokeWidth={2.2} />
              </View>
              <Text style={[styles.statValue, { color: theme.text }]}>
                {performance.bestQuestStreak}
              </Text>
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Best Streak</Text>
            </View>
            <View
              style={[
                styles.statDivider,
                { backgroundColor: isDark ? 'rgba(148, 163, 184, 0.18)' : 'rgba(0,0,0,0.08)' },
              ]}
            />
            <View style={styles.statItem}>
              <View style={[styles.statIconShell, { backgroundColor: insetSurface }]}> 
                <Award color={questAccent} size={18} strokeWidth={2.2} />
              </View>
              <Text style={[styles.statValue, { color: theme.text }]}>
                {deckAccuracy !== null ? `${Math.round(deckAccuracy * 100)}%` : '--'}
              </Text>
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Deck Accuracy</Text>
            </View>
          </View>

          <View
            style={[
              styles.section,
              {
                backgroundColor: sectionSurface,
                borderWidth: isDark ? 1 : 0,
                borderColor: surfaceBorderColor,
                shadowOpacity: isDark ? 0.18 : 0.08,
                shadowRadius: isDark ? 12 : 4,
                elevation: isDark ? 5 : 2,
              },
            ]}
          >
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Select Deck</Text>
            <QuestDeckSelector
              decks={decks}
              selectedDeckId={selectedDeckId}
              onSelectDeck={setSelectedDeckId}
              theme={theme}
              isDark={isDark}
              selectedSurface={selectedSurface}
              insetSurface={insetSurface}
              surfaceBorderColor={surfaceBorderColor}
            />
            {!!smallDeckWarning && (
              <Text style={[styles.warningText, { color: theme.warning }]}>
                For best experience, decks should have at least 8 cards.
              </Text>
            )}
          </View>

          <View
            style={[
              styles.section,
              {
                backgroundColor: sectionSurface,
                borderWidth: isDark ? 1 : 0,
                borderColor: surfaceBorderColor,
                shadowOpacity: isDark ? 0.18 : 0.08,
                shadowRadius: isDark ? 12 : 4,
                elevation: isDark ? 5 : 2,
              },
            ]}
          >
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Mode</Text>
            <View style={styles.modeSelector}>
              <TouchableOpacity
                style={[
                  styles.modeButton,
                  {
                    backgroundColor: mode === 'learn' ? selectedSurface : insetSurface,
                    borderColor: mode === 'learn' ? theme.primary : subtleBorderColor,
                    shadowColor: theme.primary,
                    shadowOpacity: mode === 'learn' ? (isDark ? 0.18 : 0.06) : 0,
                    shadowRadius: mode === 'learn' ? 12 : 0,
                    elevation: mode === 'learn' ? 3 : 0,
                  },
                ]}
                onPress={() => handleModeChange('learn')}
                activeOpacity={0.7}
              >
                <BookOpen
                  color={mode === 'learn' ? theme.primary : theme.textSecondary}
                  size={20}
                />
                <Text style={[
                  styles.modeText,
                  { color: mode === 'learn' ? theme.text : theme.textSecondary },
                ]}>
                  Learn
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modeButton,
                  {
                    backgroundColor: mode === 'test' ? selectedSurface : insetSurface,
                    borderColor: mode === 'test' ? theme.primary : subtleBorderColor,
                    shadowColor: theme.primary,
                    shadowOpacity: mode === 'test' ? (isDark ? 0.18 : 0.06) : 0,
                    shadowRadius: mode === 'test' ? 12 : 0,
                    elevation: mode === 'test' ? 3 : 0,
                  },
                ]}
                onPress={() => handleModeChange('test')}
                activeOpacity={0.7}
              >
                <Zap
                  color={mode === 'test' ? theme.primary : theme.textSecondary}
                  size={20}
                />
                <Text style={[
                  styles.modeText,
                  { color: mode === 'test' ? theme.text : theme.textSecondary },
                ]}>
                  Test
                </Text>
              </TouchableOpacity>
            </View>
            <Text style={[styles.modeDescription, { color: theme.textSecondary }]}>
              {mode === 'learn'
                ? 'Hints ON, explanations ON, no timer, lower points'
                : 'Hints OFF, explanations at end only, optional timer, higher points'
              }
            </Text>
          </View>

          {/* Settings summary pill */}
          <TouchableOpacity
            style={[
              styles.settingsSummary,
              {
                backgroundColor: statSurface,
                borderWidth: isDark ? 1 : 0,
                borderColor: surfaceBorderColor,
                shadowOpacity: isDark ? 0.16 : 0.06,
                shadowRadius: isDark ? 10 : 4,
                elevation: isDark ? 4 : 1,
              },
            ]}
            onPress={openSheet}
            activeOpacity={0.7}
          >
            <View style={styles.settingsSummaryLeft}>
              <Settings color={theme.textSecondary} size={16} />
              <Text style={[styles.settingsSummaryText, { color: theme.textSecondary }]}>
                {settingsLabel}
              </Text>
            </View>
            <Text style={[styles.settingsSummaryAction, { color: theme.primary }]}>Edit</Text>
          </TouchableOpacity>

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.startButton, !selectedDeckId && styles.disabledButton]}
              onPress={handleStartQuest}
              activeOpacity={0.8}
              disabled={!selectedDeckId}
            >
              <LinearGradient
                colors={theme.questGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.startButtonGradient}
              >
                <Play color="#fff" size={24} fill="#fff" />
                <Text style={styles.startButtonText}>Start Quest</Text>
              </LinearGradient>
            </TouchableOpacity>

            {lastSettings != null && (
              <TouchableOpacity
                style={[
                  styles.resumeButton,
                  {
                    borderColor: theme.primary,
                    backgroundColor: isDark ? 'rgba(15, 23, 42, 0.68)' : 'transparent',
                  },
                ]}
                onPress={handleQuickResume}
                activeOpacity={0.7}
              >
                <ChevronRight color={theme.primary} size={20} />
                <Text style={[styles.resumeButtonText, { color: theme.primary }]}>
                  Quick Resume
                </Text>
              </TouchableOpacity>
            )}
          </View>
            </>
          )}
        </ScrollView>
      </SafeAreaView>

      {/* Settings Bottom Sheet Modal */}
      <Modal
        visible={sheetVisible}
        transparent
        animationType="none"
        statusBarTranslucent
        onRequestClose={closeSheet}
      >
        <View style={styles.modalContainer}>
          <Animated.View
            style={[
              styles.backdrop,
              { opacity: backdropAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.5] }) },
            ]}
          >
            <Pressable style={StyleSheet.absoluteFill} onPress={closeSheet} />
          </Animated.View>

          <Animated.View
            style={[
              styles.sheet,
              {
                backgroundColor: sheetSurface,
                borderTopWidth: isDark ? 1 : 0,
                borderColor: surfaceBorderColor,
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >
            <View style={styles.sheetHandle}>
              <View style={[styles.handleBar, { backgroundColor: theme.border }]} />
            </View>

            <View style={styles.sheetHeader}>
              <Text style={[styles.sheetTitle, { color: theme.text }]}>Settings</Text>
              <TouchableOpacity onPress={closeSheet} activeOpacity={0.7} style={styles.sheetClose}>
                <X color={theme.textSecondary} size={22} />
              </TouchableOpacity>
            </View>

            <QuestSettingsOptions
              theme={theme}
              insetSurface={insetSurface}
              inactiveToggleSurface={inactiveToggleSurface}
              runLength={runLength}
              timerSeconds={timerSeconds}
              focusWeakOnly={focusWeakOnly}
              hintsEnabled={hintsEnabled}
              explanationsEnabled={explanationsEnabled}
              secondChanceEnabled={secondChanceEnabled}
              setRunLength={setRunLength}
              setTimerSeconds={setTimerSeconds}
              setFocusWeakOnly={setFocusWeakOnly}
              setHintsEnabled={setHintsEnabled}
              setExplanationsEnabled={setExplanationsEnabled}
              setSecondChanceEnabled={setSecondChanceEnabled}
            />

            <View style={styles.sheetFooter}>
              <TouchableOpacity
                style={[styles.doneButton, { backgroundColor: theme.primary }]}
                onPress={closeSheet}
                activeOpacity={0.8}
              >
                <Text style={styles.doneButtonText}>Done</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      </Modal>
      <ConsentSheet
        visible={pendingQuestSettings !== null}
        title="Use AI-assisted question mode?"
        description="Quest sends the active question and answer to an AI processing service to generate stronger distractors and keep rounds feeling sharp."
        bullets={[
          'Only the card content needed for the current session is sent for this feature.',
          'This improves answer choices in Quest and AI-powered practice sessions.',
          'You can review this again in Privacy & Data anytime.',
        ]}
        primaryLabel="Continue"
        secondaryLabel="Cancel"
        onPrimaryPress={handleAcceptGameplayDisclosure}
        onSecondaryPress={handleDismissGameplayDisclosure}
        footerActionLabel="Open Privacy & Data"
        onFooterActionPress={() => router.push(DATA_PRIVACY_ROUTE)}
        testID="quest-ai-disclosure"
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
    top: -104,
    right: -56,
    width: 260,
    height: 260,
    borderRadius: 130,
  },
  midGlow: {
    position: 'absolute',
    top: '34%',
    left: -88,
    width: 240,
    height: 240,
    borderRadius: 120,
  },
  bottomGlow: {
    position: 'absolute',
    bottom: 78,
    left: -72,
    width: 288,
    height: 288,
    borderRadius: 144,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  backButton: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 18,
    borderWidth: 1,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800' as const,
    color: '#fff',
    letterSpacing: -0.4,
  },
  settingsButton: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  statsCard: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderRadius: 26,
    borderWidth: 1,
    paddingVertical: 18,
    paddingHorizontal: 12,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    gap: 6,
  },
  statValue: {
    fontSize: 28,
    fontWeight: '800' as const,
    letterSpacing: -0.8,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '600' as const,
    textAlign: 'center',
  },
  statIconShell: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statDivider: {
    width: 1,
    marginVertical: 8,
  },
  section: {
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    marginBottom: 16,
  },
  deckList: {
    gap: 12,
    paddingRight: 4,
  },
  deckOption: {
    width: 128,
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  deckColorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginBottom: 8,
  },
  deckName: {
    fontSize: 14,
    fontWeight: '600' as const,
    marginBottom: 4,
  },
  deckCardCount: {
    fontSize: 12,
  },
  warningText: {
    fontSize: 12,
    marginTop: 12,
    fontStyle: 'italic' as const,
  },
  modeSelector: {
    flexDirection: 'row',
    gap: 12,
  },
  modeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  modeText: {
    fontSize: 16,
    fontWeight: '600' as const,
  },
  modeDescription: {
    fontSize: 13,
    marginTop: 12,
    lineHeight: 18,
  },
  settingsSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 1,
  },
  settingsSummaryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  settingsSummaryText: {
    fontSize: 13,
    fontWeight: '500' as const,
    flex: 1,
  },
  settingsSummaryAction: {
    fontSize: 14,
    fontWeight: '600' as const,
    marginLeft: 8,
  },
  emptyState: {
    minHeight: 420,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 24,
    borderRadius: 28,
    borderWidth: 1,
    marginTop: 4,
  },
  emptyStateTitle: {
    marginTop: 20,
    marginBottom: 10,
    fontSize: 18,
    fontWeight: '700' as const,
    textAlign: 'center' as const,
  },
  emptyStateSubtitle: {
    maxWidth: 280,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '500' as const,
    textAlign: 'center' as const,
  },
  emptyStateButton: {
    marginTop: 20,
    minWidth: 148,
    borderRadius: 14,
    paddingHorizontal: 22,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyStateButtonText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#fff',
  },
  buttonContainer: {
    marginTop: 8,
    gap: 12,
  },
  startButton: {
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.22,
    shadowRadius: 16,
    elevation: 6,
  },
  disabledButton: {
    opacity: 0.5,
  },
  startButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 18,
  },
  startButtonText: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#fff',
  },
  resumeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 2,
  },
  resumeButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
  },
  sheet: {
    height: SHEET_HEIGHT,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 10,
  },
  sheetHandle: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 4,
  },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
  },
  sheetClose: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sheetScroll: {
    flex: 1,
  },
  sheetScrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  settingLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  settingText: {
    fontSize: 15,
    fontWeight: '500' as const,
  },
  optionGroup: {
    flexDirection: 'row',
    gap: 8,
  },
  optionButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    minWidth: 50,
    alignItems: 'center',
  },
  optionText: {
    fontSize: 14,
    fontWeight: '600' as const,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  toggle: {
    width: 48,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
  },
  toggleKnob: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  sheetFooter: {
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    paddingTop: 8,
  },
  doneButton: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#fff',
  },
});
