import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { ArrowLeft, Target, Zap, Clock, Focus, Lightbulb, BookOpen, RefreshCw, Play, ChevronRight, Settings, X } from 'lucide-react-native';
import React, { useState, useMemo, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal, Animated, Dimensions, Pressable, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useFlashQuest } from '@/context/FlashQuestContext';
import { usePerformance } from '@/context/PerformanceContext';
import { useTheme } from '@/context/ThemeContext';
import { QuestMode, QuestSettings } from '@/types/flashcard';

type RunLength = 5 | 10 | 20;
type TimerOption = 0 | 5 | 10;

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const SHEET_HEIGHT = SCREEN_HEIGHT * 0.65;

export default function QuestMenuScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { decks } = useFlashQuest();
  const { performance, getLastQuestSettings, getDeckAccuracy, getOverallQuestAccuracy, saveLastQuestSettings } = usePerformance();

  const lastSettings = getLastQuestSettings();

  const [selectedDeckId, setSelectedDeckId] = useState<string>(lastSettings?.deckId || decks[0]?.id || '');
  const [mode, setMode] = useState<QuestMode>(lastSettings?.mode || 'learn');
  const [runLength, setRunLength] = useState<RunLength>(lastSettings?.runLength || 10);
  const [timerSeconds, setTimerSeconds] = useState<TimerOption>(lastSettings?.timerSeconds || 0);
  const [focusWeakOnly, setFocusWeakOnly] = useState<boolean>(lastSettings?.focusWeakOnly || false);
  const [hintsEnabled, setHintsEnabled] = useState<boolean>(lastSettings?.hintsEnabled ?? (mode === 'learn'));
  const [explanationsEnabled, setExplanationsEnabled] = useState<boolean>(lastSettings?.explanationsEnabled ?? (mode === 'learn'));
  const [secondChanceEnabled, setSecondChanceEnabled] = useState<boolean>(lastSettings?.secondChanceEnabled || false);

  const [sheetVisible, setSheetVisible] = useState<boolean>(false);
  const slideAnim = useRef(new Animated.Value(SHEET_HEIGHT)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;

  const selectedDeck = useMemo(() => decks.find(d => d.id === selectedDeckId), [decks, selectedDeckId]);

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

  const handleStartQuest = () => {
    if (!selectedDeckId) return;

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

    saveLastQuestSettings(settings);

    router.push({
      pathname: '/quest-session' as any,
      params: { settings: JSON.stringify(settings) },
    });
  };

  const handleQuickResume = () => {
    if (!lastSettings) return;

    router.push({
      pathname: '/quest-session' as any,
      params: { settings: JSON.stringify(lastSettings) },
    });
  };

  const smallDeckWarning = selectedDeck && selectedDeck.flashcards.length < 8;

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
        colors={[theme.gradientStart, theme.gradientMid, theme.gradientEnd]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <ArrowLeft color="#fff" size={24} />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Target color="#fff" size={28} />
            <Text style={styles.headerTitle}>Quest Mode</Text>
          </View>
          <TouchableOpacity
            style={styles.settingsButton}
            onPress={openSheet}
            activeOpacity={0.7}
          >
            <Settings color="#fff" size={22} />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.statsCard, { backgroundColor: theme.cardBackground }]}>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: theme.primary }]}>
                {overallAccuracy !== null ? `${Math.round(overallAccuracy * 100)}%` : '--'}
              </Text>
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Quest Accuracy</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: theme.primary }]}>
                {performance.bestQuestStreak}
              </Text>
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Best Streak</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: theme.primary }]}>
                {deckAccuracy !== null ? `${Math.round(deckAccuracy * 100)}%` : '--'}
              </Text>
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Deck Accuracy</Text>
            </View>
          </View>

          <View style={[styles.section, { backgroundColor: theme.cardBackground }]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Select Deck</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.deckList}
            >
              {decks.map((deck) => (
                <TouchableOpacity
                  key={deck.id}
                  style={[
                    styles.deckOption,
                    { backgroundColor: theme.background },
                    selectedDeckId === deck.id && { borderColor: theme.primary, borderWidth: 2 },
                  ]}
                  onPress={() => setSelectedDeckId(deck.id)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.deckColorDot, { backgroundColor: deck.color }]} />
                  <Text
                    style={[styles.deckName, { color: theme.text }]}
                    numberOfLines={1}
                  >
                    {deck.name}
                  </Text>
                  <Text style={[styles.deckCardCount, { color: theme.textSecondary }]}>
                    {deck.flashcards.length} cards
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            {smallDeckWarning && (
              <Text style={[styles.warningText, { color: theme.warning }]}>
                For best experience, decks should have at least 8 cards.
              </Text>
            )}
          </View>

          <View style={[styles.section, { backgroundColor: theme.cardBackground }]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Mode</Text>
            <View style={styles.modeSelector}>
              <TouchableOpacity
                style={[
                  styles.modeButton,
                  { backgroundColor: theme.background },
                  mode === 'learn' && { backgroundColor: theme.primary },
                ]}
                onPress={() => handleModeChange('learn')}
                activeOpacity={0.7}
              >
                <BookOpen
                  color={mode === 'learn' ? '#fff' : theme.text}
                  size={20}
                />
                <Text style={[
                  styles.modeText,
                  { color: mode === 'learn' ? '#fff' : theme.text },
                ]}>
                  Learn
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modeButton,
                  { backgroundColor: theme.background },
                  mode === 'test' && { backgroundColor: theme.primary },
                ]}
                onPress={() => handleModeChange('test')}
                activeOpacity={0.7}
              >
                <Zap
                  color={mode === 'test' ? '#fff' : theme.text}
                  size={20}
                />
                <Text style={[
                  styles.modeText,
                  { color: mode === 'test' ? '#fff' : theme.text },
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
            style={[styles.settingsSummary, { backgroundColor: theme.cardBackground }]}
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

            {lastSettings && (
              <TouchableOpacity
                style={[styles.resumeButton, { borderColor: theme.primary }]}
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
              { backgroundColor: theme.cardBackground, transform: [{ translateY: slideAnim }] },
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

            <ScrollView
              style={styles.sheetScroll}
              contentContainerStyle={styles.sheetScrollContent}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.settingRow}>
                <View style={styles.settingLabel}>
                  <Target color={theme.textSecondary} size={18} />
                  <Text style={[styles.settingText, { color: theme.text }]}>Run Length</Text>
                </View>
                <View style={styles.optionGroup}>
                  {([5, 10, 20] as RunLength[]).map((val) => (
                    <TouchableOpacity
                      key={val}
                      style={[
                        styles.optionButton,
                        { backgroundColor: theme.background },
                        runLength === val && { backgroundColor: theme.primary },
                      ]}
                      onPress={() => setRunLength(val)}
                      activeOpacity={0.7}
                    >
                      <Text style={[
                        styles.optionText,
                        { color: runLength === val ? '#fff' : theme.text },
                      ]}>
                        {val}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.settingRow}>
                <View style={styles.settingLabel}>
                  <Clock color={theme.textSecondary} size={18} />
                  <Text style={[styles.settingText, { color: theme.text }]}>Timer (sec)</Text>
                </View>
                <View style={styles.optionGroup}>
                  {([0, 5, 10] as TimerOption[]).map((val) => (
                    <TouchableOpacity
                      key={val}
                      style={[
                        styles.optionButton,
                        { backgroundColor: theme.background },
                        timerSeconds === val && { backgroundColor: theme.primary },
                      ]}
                      onPress={() => setTimerSeconds(val)}
                      activeOpacity={0.7}
                    >
                      <Text style={[
                        styles.optionText,
                        { color: timerSeconds === val ? '#fff' : theme.text },
                      ]}>
                        {val === 0 ? 'Off' : val}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <TouchableOpacity
                style={styles.toggleRow}
                onPress={() => setFocusWeakOnly(!focusWeakOnly)}
                activeOpacity={0.7}
              >
                <View style={styles.settingLabel}>
                  <Focus color={theme.textSecondary} size={18} />
                  <Text style={[styles.settingText, { color: theme.text }]}>Focus Weak Cards</Text>
                </View>
                <View style={[
                  styles.toggle,
                  { backgroundColor: focusWeakOnly ? theme.primary : theme.border },
                ]}>
                  <View style={[
                    styles.toggleKnob,
                    { transform: [{ translateX: focusWeakOnly ? 20 : 2 }] },
                  ]} />
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.toggleRow}
                onPress={() => setHintsEnabled(!hintsEnabled)}
                activeOpacity={0.7}
              >
                <View style={styles.settingLabel}>
                  <Lightbulb color={theme.textSecondary} size={18} />
                  <Text style={[styles.settingText, { color: theme.text }]}>Hints</Text>
                </View>
                <View style={[
                  styles.toggle,
                  { backgroundColor: hintsEnabled ? theme.primary : theme.border },
                ]}>
                  <View style={[
                    styles.toggleKnob,
                    { transform: [{ translateX: hintsEnabled ? 20 : 2 }] },
                  ]} />
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.toggleRow}
                onPress={() => setExplanationsEnabled(!explanationsEnabled)}
                activeOpacity={0.7}
              >
                <View style={styles.settingLabel}>
                  <BookOpen color={theme.textSecondary} size={18} />
                  <Text style={[styles.settingText, { color: theme.text }]}>Explanations</Text>
                </View>
                <View style={[
                  styles.toggle,
                  { backgroundColor: explanationsEnabled ? theme.primary : theme.border },
                ]}>
                  <View style={[
                    styles.toggleKnob,
                    { transform: [{ translateX: explanationsEnabled ? 20 : 2 }] },
                  ]} />
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.toggleRow, { marginBottom: 0 }]}
                onPress={() => setSecondChanceEnabled(!secondChanceEnabled)}
                activeOpacity={0.7}
              >
                <View style={styles.settingLabel}>
                  <RefreshCw color={theme.textSecondary} size={18} />
                  <Text style={[styles.settingText, { color: theme.text }]}>Second Chance</Text>
                </View>
                <View style={[
                  styles.toggle,
                  { backgroundColor: secondChanceEnabled ? theme.primary : theme.border },
                ]}>
                  <View style={[
                    styles.toggleKnob,
                    { transform: [{ translateX: secondChanceEnabled ? 20 : 2 }] },
                  ]} />
                </View>
              </TouchableOpacity>
            </ScrollView>

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
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: '#fff',
  },
  settingsButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  statsCard: {
    borderRadius: 20,
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700' as const,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '500' as const,
  },
  statDivider: {
    width: 1,
    height: 40,
  },
  section: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
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
    width: 120,
    padding: 12,
    borderRadius: 14,
    borderWidth: 2,
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
    borderRadius: 14,
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
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
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
  buttonContainer: {
    marginTop: 8,
    gap: 12,
  },
  startButton: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
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
