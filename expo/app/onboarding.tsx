import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { router, type Href } from 'expo-router';
import {
  ArrowLeft,
  BookOpen,
  Bot,
  Camera,
  ShieldCheck,
  Swords,
  Target,
} from 'lucide-react-native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DEFAULT_AVATAR_IDENTITY, PLAYER_IDENTITIES } from '@/constants/avatar';
import type { Theme } from '@/constants/colors';
import { PRESET_DECK_CATEGORIES } from '@/constants/deckCategories';
import { useArena } from '@/context/ArenaContext';
import { useAvatar } from '@/context/AvatarContext';
import { usePrivacy } from '@/context/PrivacyContext';
import { useTheme } from '@/context/ThemeContext';
import { logger } from '@/utils/logger';
import { SCAN_NOTES_ROUTE } from '@/utils/routes';
import { getPlayerNameValidationError } from '@/utils/playerName';

const ONBOARDING_STORAGE_KEY = 'flashquest_onboarding_complete';
const DARK_OVERLAY = ['rgba(15, 23, 42, 0.10)', 'rgba(2, 6, 23, 0.42)'] as const;
const LIGHT_OVERLAY = ['rgba(255,255,255,0.06)', 'rgba(255,255,255,0.22)'] as const;

type TutorialPart = 'card-1' | 'card-2' | 'overview';
type TutorialCardKey = Extract<TutorialPart, 'card-1' | 'card-2'>;
type AnalyticsChoice = 'granted' | 'declined' | null;
type OnboardingGradient = readonly [string, string] | readonly [string, string, string];
type PresetCategory = (typeof PRESET_DECK_CATEGORIES)[number];
type LearningJourneyItem = {
  key: string;
  step: number;
  title: string;
  tagline: string;
  description: string;
  Icon: typeof BookOpen;
};
type CategoryTile = {
  name: PresetCategory;
  emoji: string;
};

const DEMO_TUTORIAL_CARDS: Record<TutorialCardKey, {
  question: string;
  answer: string;
  progressLabel: string;
  buttonLabel: string;
}> = {
  'card-1': {
    question: 'What is the capital of France?',
    answer: 'Paris',
    progressLabel: '1 / 2',
    buttonLabel: 'Next →',
  },
  'card-2': {
    question: 'H₂O is the chemical formula for ___',
    answer: 'Water',
    progressLabel: '2 / 2',
    buttonLabel: 'Got it! →',
  },
};

const LEARNING_JOURNEY: readonly LearningJourneyItem[] = [
  {
    key: 'study',
    step: 1,
    title: 'Study',
    tagline: 'Learn at your own pace',
    description: 'Flip through your cards, reveal answers, and rate how well you know each one. The app tracks what you remember and what needs work.',
    Icon: BookOpen,
  },
  {
    key: 'quest',
    step: 2,
    title: 'Quest',
    tagline: 'Test what you know',
    description: 'Multiple-choice rounds that score you on speed and accuracy. Choose Learn mode (hints on, no timer) or Test mode (no hints, timed).',
    Icon: Target,
  },
  {
    key: 'practice',
    step: 3,
    title: 'Practice',
    tagline: 'Challenge the AI',
    description: 'Go head-to-head against an AI opponent that adapts to your skill level. Five rounds, winner takes the higher score.',
    Icon: Bot,
  },
  {
    key: 'arena',
    step: 4,
    title: 'Arena',
    tagline: 'Compete with friends',
    description: 'Create a room, share the code, and battle a friend in real time. Same questions, same timer. Fastest and most accurate wins.',
    Icon: Swords,
  },
] as const;

const CATEGORY_TILES: readonly CategoryTile[] = [
  { name: 'Science', emoji: '🔬' },
  { name: 'History', emoji: '📜' },
  { name: 'Languages', emoji: '🌍' },
  { name: 'Math', emoji: '📐' },
  { name: 'Geography', emoji: '🗺️' },
  { name: 'Technology', emoji: '💻' },
  { name: 'Art', emoji: '🎨' },
  { name: 'Business', emoji: '💼' },
] as const;

function GradientScreen({
  colors,
  isDark,
  children,
  testID,
}: {
  colors: OnboardingGradient;
  isDark: boolean;
  children: React.ReactNode;
  testID: string;
}) {
  return (
    <LinearGradient
      colors={colors}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.screen}
      testID={testID}
    >
      <LinearGradient
        colors={isDark ? DARK_OVERLAY : LIGHT_OVERLAY}
        start={{ x: 0.08, y: 0 }}
        end={{ x: 0.92, y: 1 }}
        style={styles.screenOverlay}
      />
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        {children}
      </SafeAreaView>
    </LinearGradient>
  );
}

function TutorialStep({
  theme,
  isDark,
  tutorialPart,
  isFlipped,
  onFlip,
  onAdvance,
  onSkip,
  cardScale,
  hintOpacity,
}: {
  theme: Theme;
  isDark: boolean;
  tutorialPart: TutorialPart;
  isFlipped: boolean;
  onFlip: () => void;
  onAdvance: () => void;
  onSkip: () => void;
  cardScale: Animated.Value;
  hintOpacity: Animated.Value;
}) {
  const tutorialColors = [theme.gradientStart, theme.gradientMid, theme.gradientEnd] as const;

  if (tutorialPart === 'overview') {
    return (
      <GradientScreen colors={tutorialColors} isDark={isDark} testID="onboarding-step-tutorial-overview">
        <View style={styles.screenContent}>
          <View style={styles.topRow}>
            <Text style={styles.wordmark}>FlashQuest</Text>
            <View />
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.overviewScrollContent}>
            <Text style={styles.overviewTitle} accessibilityRole="header">Your learning journey</Text>
            <Text style={styles.overviewSubtitle}>
              Four modes, one goal: actually remember what you study.
            </Text>

            {LEARNING_JOURNEY.map((item, index) => {
              const Icon = item.Icon;
              const isLast = index === LEARNING_JOURNEY.length - 1;

              return (
                <View key={item.key} style={styles.journeyRow} accessible={true} accessibilityLabel={`Step ${item.step}: ${item.title}. ${item.tagline}. ${item.description}`}>
                  <View style={styles.journeyTimeline}>
                    <View style={styles.journeyDot}>
                      <Text style={styles.journeyStepNumber}>{item.step}</Text>
                    </View>
                    {!isLast ? <View style={styles.journeyLine} /> : null}
                  </View>

                  <View style={styles.journeyCard}>
                    <View style={styles.journeyCardHeader}>
                      <Icon color="#FFFFFF" size={20} strokeWidth={2.2} />
                      <Text style={styles.journeyCardTitle}>{item.title}</Text>
                      <Text style={styles.journeyCardTagline}>{item.tagline}</Text>
                    </View>
                    <Text style={styles.journeyCardDescription}>{item.description}</Text>
                  </View>
                </View>
              );
            })}

            <TouchableOpacity style={styles.primaryButton} onPress={onAdvance} activeOpacity={0.86} accessibilityLabel="Continue" accessibilityRole="button" testID="onboarding-overview-continue">
              <Text style={styles.primaryButtonText}>Continue</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </GradientScreen>
    );
  }

  const currentCard = DEMO_TUTORIAL_CARDS[tutorialPart];
  const cardTextColor = isDark ? '#F8FAFC' : '#0F172A';
  const progressWidth = tutorialPart === 'card-1' ? '50%' : '100%';

  return (
    <GradientScreen colors={tutorialColors} isDark={isDark} testID="onboarding-step-tutorial">
      <View style={[styles.screenContent, styles.tutorialScreenContent]}>
        <View style={styles.topRow}>
          <Text style={styles.wordmark}>FlashQuest</Text>
          <TouchableOpacity onPress={onSkip} activeOpacity={0.8} accessibilityLabel="Skip introduction" accessibilityRole="button" testID="onboarding-skip-intro">
            <Text style={styles.topTextButton}>Skip intro</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.tutorialStage}>
          <View style={styles.tutorialProgressWrap} accessibilityLabel={`Step ${tutorialPart === 'card-1' ? 1 : 2} of 4`} testID="onboarding-tutorial-progress">
            <Text style={styles.progressText}>{currentCard.progressLabel}</Text>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: progressWidth }]} />
            </View>
          </View>

          <View style={styles.tutorialCardArea}>
            <Animated.View style={[styles.demoCardOuter, { transform: [{ scale: cardScale }] }]}>
              <TouchableOpacity
                style={[
                  styles.demoCard,
                  {
                    backgroundColor: isDark ? theme.card : '#FFFFFF',
                    shadowColor: theme.shadow,
                  },
                ]}
                onPress={onFlip}
                activeOpacity={1}
                disabled={isFlipped}
                accessibilityLabel={isFlipped ? `Answer: ${currentCard.answer}` : `Question: ${currentCard.question}. Tap to flip.`}
                accessibilityRole="button"
                testID={`onboarding-demo-card-${tutorialPart}`}
              >
                {isFlipped ? (
                  <View style={styles.answerContent}>
                    <Text style={[styles.answerLabel, { color: theme.success }]}>ANSWER</Text>
                    <Text style={[styles.demoCardText, { color: cardTextColor }]}>{currentCard.answer}</Text>
                  </View>
                ) : (
                  <Text style={[styles.demoCardText, { color: cardTextColor }]}>{currentCard.question}</Text>
                )}
              </TouchableOpacity>
            </Animated.View>

            {!isFlipped && tutorialPart === 'card-1' ? (
              <Animated.Text style={[styles.flipHint, { opacity: hintOpacity }]}>👆 Tap the card to flip it</Animated.Text>
            ) : null}

            <View style={styles.tutorialActionSlot}>
              {isFlipped ? (
                <TouchableOpacity style={styles.primaryButton} onPress={onAdvance} activeOpacity={0.86} accessibilityLabel={currentCard.buttonLabel} accessibilityRole="button" testID="onboarding-tutorial-next">
                  <Text style={styles.primaryButtonText}>{currentCard.buttonLabel}</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        </View>
      </View>
    </GradientScreen>
  );
}

function CategoriesStep({
  theme,
  isDark,
  selectedCategories,
  onToggleCategory,
  onScanNotes,
  onSkip,
  onContinue,
  onGoBack,
}: {
  theme: Theme;
  isDark: boolean;
  selectedCategories: string[];
  onToggleCategory: (category: PresetCategory) => void;
  onScanNotes: () => void;
  onSkip: () => void;
  onContinue: () => void;
  onGoBack?: () => void;
}) {
  return (
    <GradientScreen colors={theme.deckGradient} isDark={isDark} testID="onboarding-step-categories">
      <View style={styles.screenContent}>
        <View style={styles.topRow}>
          <TouchableOpacity onPress={onGoBack} activeOpacity={0.8} accessibilityLabel="Go back" accessibilityRole="button" testID="onboarding-back">
            <ArrowLeft color="rgba(255,255,255,0.7)" size={22} strokeWidth={2.2} />
          </TouchableOpacity>
          <TouchableOpacity onPress={onSkip} activeOpacity={0.8} testID="onboarding-categories-skip">
            <Text style={styles.topTextButton}>Skip →</Text>
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollStepContent}>
          <Text style={styles.stepTitle} accessibilityRole="header">What do you study?</Text>
          <Text style={styles.stepSubtitle}>
            Pick what interests you. You can always change this later.
          </Text>

          <View style={styles.categoryGrid}>
            {CATEGORY_TILES.map((tile) => {
              const isSelected = selectedCategories.includes(tile.name);

              return (
                <TouchableOpacity
                  key={tile.name}
                  style={[styles.categoryTile, isSelected ? styles.categoryTileSelected : null]}
                  onPress={() => onToggleCategory(tile.name)}
                  activeOpacity={0.86}
                  accessibilityLabel={`${tile.name} category`}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  testID={`onboarding-category-${tile.name}`}
                >
                  <Text style={styles.categoryEmoji}>{tile.emoji}</Text>
                  <Text style={styles.categoryName}>{tile.name}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity style={styles.scanNotesCard} onPress={onScanNotes} activeOpacity={0.86} accessibilityLabel="Take a photo of your notes" accessibilityRole="button" testID="onboarding-scan-notes">
            <View style={styles.scanNotesIconShell}>
              <Camera color="#FFFFFF" size={18} strokeWidth={2.1} />
            </View>
            <Text style={styles.scanNotesText}>Scan your notes to make a deck</Text>
          </TouchableOpacity>
        </ScrollView>

        <View style={styles.bottomActionWrap}>
          <TouchableOpacity style={styles.primaryButton} onPress={onContinue} activeOpacity={0.86} accessibilityLabel="Continue" accessibilityRole="button" testID="onboarding-categories-continue">
            <Text style={styles.primaryButtonText}>Continue</Text>
          </TouchableOpacity>
        </View>
      </View>
    </GradientScreen>
  );
}

function ProfileStep({
  theme,
  isDark,
  playerName,
  nameBlurred,
  selectedIdentityKey,
  analyticsChoice,
  errorMessage,
  onChangeName,
  onBlurName,
  onSelectIdentity,
  onSelectAnalytics,
  onContinue,
  onGoBack,
}: {
  theme: Theme;
  isDark: boolean;
  playerName: string;
  nameBlurred: boolean;
  selectedIdentityKey: string;
  analyticsChoice: AnalyticsChoice;
  errorMessage: string | null;
  onChangeName: (value: string) => void;
  onBlurName: () => void;
  onSelectIdentity: (identityKey: string) => void;
  onSelectAnalytics: (choice: Exclude<AnalyticsChoice, null>) => void;
  onContinue: () => void;
  onGoBack?: () => void;
}) {
  const shouldShowNameError = nameBlurred && playerName.trim().length === 0;
  const canContinue = playerName.trim().length > 0 && analyticsChoice !== null;
  const missingFieldsHint = !canContinue
    ? playerName.trim().length === 0 && analyticsChoice === null
      ? 'Enter your name and choose an analytics preference'
      : playerName.trim().length === 0
        ? 'Enter your name to continue'
        : 'Choose an analytics preference to continue'
    : null;

  return (
    <GradientScreen colors={theme.arenaGradient} isDark={isDark} testID="onboarding-step-profile">
      <View style={styles.screenContent}>
        <View style={styles.topRow}>
          <TouchableOpacity onPress={onGoBack} activeOpacity={0.8} accessibilityLabel="Go back" accessibilityRole="button" testID="onboarding-back">
            <ArrowLeft color="rgba(255,255,255,0.7)" size={22} strokeWidth={2.2} />
          </TouchableOpacity>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollStepContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          <Text style={styles.stepTitle} accessibilityRole="header">Set up your profile</Text>
          <Text style={styles.stepSubtitle}>Choose your name and card identity.</Text>

          <Text style={styles.fieldLabel}>Your name</Text>
          <TextInput
            value={playerName}
            onChangeText={onChangeName}
            onBlur={onBlurName}
            placeholder="Enter your name"
            placeholderTextColor="rgba(255,255,255,0.45)"
            maxLength={20}
            autoCapitalize="words"
            autoCorrect={false}
            returnKeyType="done"
            onSubmitEditing={onContinue}
            style={styles.nameInput}
            accessibilityLabel="Enter your name"
            testID="onboarding-name-input"
          />
          {shouldShowNameError ? <Text style={styles.nameError}>Name is required</Text> : <View style={styles.nameErrorSpacer} />}

          <View style={styles.analyticsCard}>
            <View style={styles.analyticsHeaderRow}>
              <View style={styles.analyticsInfoRow}>
                <View style={styles.analyticsIconShell}>
                  <ShieldCheck color="#FFFFFF" size={16} strokeWidth={2.2} />
                </View>
                <Text style={styles.analyticsTitle}>Help improve FlashQuest?</Text>
              </View>

              <View style={styles.analyticsPills}>
                <TouchableOpacity
                  style={[
                    styles.analyticsPill,
                    analyticsChoice === 'granted' ? styles.analyticsPillSelected : null,
                  ]}
                  onPress={() => onSelectAnalytics('granted')}
                  activeOpacity={0.86}
                  accessibilityLabel="Allow analytics"
                  accessibilityRole="button"
                  accessibilityState={{ selected: analyticsChoice === 'granted' }}
                  testID="onboarding-allow-analytics"
                >
                  <Text style={styles.analyticsPillText}>Allow</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.analyticsPill,
                    analyticsChoice === 'declined' ? styles.analyticsPillSelected : null,
                  ]}
                  onPress={() => onSelectAnalytics('declined')}
                  activeOpacity={0.86}
                  accessibilityLabel="Decline analytics"
                  accessibilityRole="button"
                  accessibilityState={{ selected: analyticsChoice === 'declined' }}
                  testID="onboarding-decline-analytics"
                >
                  <Text style={styles.analyticsPillText}>Not now</Text>
                </TouchableOpacity>
              </View>
            </View>

            <Text style={styles.analyticsHint}>Anonymous usage data only · change anytime in Settings</Text>
          </View>

          <Text style={styles.fieldLabel}>Your card identity</Text>
          <View style={styles.identityGrid}>
            {PLAYER_IDENTITIES.map((identity) => {
              const isSelected = identity.key === selectedIdentityKey;

              return (
                <TouchableOpacity
                  key={identity.key}
                  style={[
                    styles.identityTile,
                    isSelected
                      ? {
                          backgroundColor: `${identity.color}38`,
                          borderColor: `${identity.color}80`,
                        }
                      : null,
                  ]}
                  onPress={() => onSelectIdentity(identity.key)}
                  activeOpacity={0.86}
                  accessibilityLabel={`${identity.suitName} card suit`}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  testID={`onboarding-identity-${identity.key}`}
                >
                  {isSelected ? <Text style={styles.identityCheck}>✓</Text> : null}
                  <Text style={[styles.identitySuit, { color: identity.color }]}>{identity.suit}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>

        <View style={styles.bottomActionWrap}>
          {errorMessage ? <Text style={styles.bottomErrorText}>{errorMessage}</Text> : null}
          {!errorMessage && missingFieldsHint ? (
            <Text style={styles.bottomHintText}>{missingFieldsHint}</Text>
          ) : null}
          <TouchableOpacity
            style={[styles.primaryButton, !canContinue ? styles.primaryButtonDisabled : null]}
            onPress={onContinue}
            activeOpacity={0.86}
            disabled={!canContinue}
            accessibilityLabel="Continue"
            accessibilityRole="button"
            testID="onboarding-profile-continue"
          >
            <Text style={styles.primaryButtonText}>Continue</Text>
          </TouchableOpacity>
        </View>
      </View>
    </GradientScreen>
  );
}

function CelebrationStep({
  theme,
  isDark,
  selectedIdentityKey,
  playerName,
  isSaving,
  errorMessage,
  onComplete,
  onGoBack,
}: {
  theme: Theme;
  isDark: boolean;
  selectedIdentityKey: string;
  playerName: string;
  isSaving: boolean;
  errorMessage: string | null;
  onComplete: () => void;
  onGoBack?: () => void;
}) {
  const selectedIdentity = PLAYER_IDENTITIES.find((identity) => identity.key === selectedIdentityKey) ?? DEFAULT_AVATAR_IDENTITY;
  const avatarScale = useRef(new Animated.Value(0.7)).current;
  const avatarOpacity = useRef(new Animated.Value(0)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;
  const buttonOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(avatarScale, {
        toValue: 1,
        speed: 8,
        bounciness: 8,
        useNativeDriver: true,
      }),
      Animated.timing(avatarOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();

    const contentTimer = setTimeout(() => {
      Animated.timing(contentOpacity, {
        toValue: 1,
        duration: 280,
        useNativeDriver: true,
      }).start();
    }, 200);

    const buttonTimer = setTimeout(() => {
      Animated.timing(buttonOpacity, {
        toValue: 1,
        duration: 280,
        useNativeDriver: true,
      }).start();
    }, 500);

    return () => {
      clearTimeout(contentTimer);
      clearTimeout(buttonTimer);
    };
  }, [avatarOpacity, avatarScale, buttonOpacity, contentOpacity]);

  return (
    <GradientScreen colors={theme.scoreGradient} isDark={isDark} testID="onboarding-step-celebration">
      <View style={[styles.screenContent, styles.celebrationScreenContent]}>
        <View style={styles.topRow}>
          <TouchableOpacity onPress={onGoBack} activeOpacity={0.8} accessibilityLabel="Go back" accessibilityRole="button" testID="onboarding-back">
            <ArrowLeft color="rgba(255,255,255,0.7)" size={22} strokeWidth={2.2} />
          </TouchableOpacity>
        </View>

        <View style={styles.celebrationCenter}>
          <Animated.View
            style={[
              styles.iconShell,
              {
                opacity: avatarOpacity,
                transform: [{ scale: avatarScale }],
              },
            ]}
          >
            <View style={styles.iconInnerShell}>
              <Text style={[styles.celebrationSuit, { color: selectedIdentity.color }]}>{selectedIdentity.suit}</Text>
            </View>
          </Animated.View>

          <Animated.View style={{ opacity: contentOpacity }}>
            <Text style={styles.celebrationTitle}>You&apos;re all set!</Text>
            <Text style={styles.celebrationSubtitle}>Welcome, {playerName.trim() || 'Player'}!</Text>
          </Animated.View>
        </View>

        <Animated.View style={[styles.bottomActionWrap, { opacity: buttonOpacity }]}>
          {errorMessage ? <Text style={styles.bottomErrorText}>{errorMessage}</Text> : null}
          <TouchableOpacity
            style={[styles.primaryButton, isSaving ? styles.primaryButtonDisabled : null]}
            onPress={onComplete}
            activeOpacity={0.86}
            disabled={isSaving}
            accessibilityLabel={isSaving ? 'Starting...' : 'Start FlashQuest'}
            accessibilityRole="button"
            testID="onboarding-start-button"
          >
            <Text style={styles.primaryButtonText}>{isSaving ? 'Starting...' : 'Start FlashQuest'}</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </GradientScreen>
  );
}

export default function OnboardingPage() {
  const { theme, isDark } = useTheme();
  const { playerName: savedPlayerName, updatePlayerName } = useArena();
  const { analyticsConsent, setAnalyticsConsent } = usePrivacy();
  const { setAvatarIdentity } = useAvatar();

  const [step, setStep] = useState<number>(0);
  const [tutorialPart, setTutorialPart] = useState<TutorialPart>('card-1');
  const [isFlipped, setIsFlipped] = useState<boolean>(false);
  const [hasShownFlipHint, setHasShownFlipHint] = useState<boolean>(true);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [playerName, setPlayerName] = useState<string>(savedPlayerName);
  const [selectedIdentityKey, setSelectedIdentityKey] = useState<string>(DEFAULT_AVATAR_IDENTITY.key);
  const [analyticsChoice, setAnalyticsChoice] = useState<AnalyticsChoice>(
    analyticsConsent === 'granted' || analyticsConsent === 'declined' ? analyticsConsent : null,
  );
  const [nameBlurred, setNameBlurred] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const transitionOpacity = useRef(new Animated.Value(1)).current;
  const cardScale = useRef(new Animated.Value(1)).current;
  const hintOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (savedPlayerName.trim().length > 0 && playerName.trim().length === 0) {
      logger.debug('[Onboarding] Syncing saved player name into onboarding state');
      setPlayerName(savedPlayerName);
    }
  }, [playerName, savedPlayerName]);

  useEffect(() => {
    if ((analyticsConsent === 'granted' || analyticsConsent === 'declined') && analyticsChoice === null) {
      logger.debug('[Onboarding] Syncing saved analytics preference into onboarding state:', analyticsConsent);
      setAnalyticsChoice(analyticsConsent);
    }
  }, [analyticsChoice, analyticsConsent]);

  useEffect(() => {
    logger.debug('[Onboarding] Transitioning view:', { step, tutorialPart });
    transitionOpacity.setValue(0);
    Animated.timing(transitionOpacity, {
      toValue: 1,
      duration: 120,
      useNativeDriver: true,
    }).start();
  }, [step, transitionOpacity, tutorialPart]);

  useEffect(() => {
    if (!hasShownFlipHint || tutorialPart !== 'card-1' || isFlipped) {
      hintOpacity.setValue(1);
      return undefined;
    }

    const hintLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(hintOpacity, {
          toValue: 0.45,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(hintOpacity, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
      ]),
    );

    hintLoop.start();

    return () => {
      hintLoop.stop();
    };
  }, [hasShownFlipHint, hintOpacity, isFlipped, tutorialPart]);

  const handleAdvanceStep = useCallback((nextStep: number) => {
    logger.debug('[Onboarding] Advancing step:', { from: step, to: nextStep });
    setSaveError(null);
    setStep(nextStep);
  }, [step]);

  const handleGoBack = useCallback(() => {
    setSaveError(null);
    if (step === 1) {
      setStep(0);
      setTutorialPart('overview');
    } else if (step > 1) {
      setStep(step - 1);
    }
  }, [step]);

  const handleFlipCard = useCallback(() => {
    if (tutorialPart === 'overview' || isFlipped) {
      return;
    }

    logger.debug('[Onboarding] Flipping tutorial card:', tutorialPart);

    Animated.timing(cardScale, {
      toValue: 0.96,
      duration: 75,
      useNativeDriver: true,
    }).start(() => {
      setIsFlipped(true);

      if (hasShownFlipHint) {
        setHasShownFlipHint(false);
        Animated.timing(hintOpacity, {
          toValue: 0,
          duration: 120,
          useNativeDriver: true,
        }).start();
      }

      Animated.spring(cardScale, {
        toValue: 1,
        speed: 18,
        bounciness: 4,
        useNativeDriver: true,
      }).start();
    });
  }, [cardScale, hasShownFlipHint, hintOpacity, isFlipped, tutorialPart]);

  const handleAdvanceTutorial = useCallback(() => {
    logger.debug('[Onboarding] Advancing tutorial:', tutorialPart);
    setSaveError(null);

    if (tutorialPart === 'card-1') {
      setTutorialPart('card-2');
      setIsFlipped(false);
      cardScale.setValue(1);
      return;
    }

    if (tutorialPart === 'card-2') {
      setTutorialPart('overview');
      setIsFlipped(false);
      cardScale.setValue(1);
      return;
    }

    handleAdvanceStep(1);
  }, [cardScale, handleAdvanceStep, tutorialPart]);

  const handleSkipIntro = useCallback(() => {
    logger.debug('[Onboarding] Skipping tutorial intro');
    setSaveError(null);
    setStep(1);
  }, []);

  const handleToggleCategory = useCallback((category: PresetCategory) => {
    setSelectedCategories((current) => {
      const nextSelection = current.includes(category)
        ? current.filter((item) => item !== category)
        : CATEGORY_TILES
            .map((item) => item.name)
            .filter((item) => current.includes(item) || item === category);

      logger.debug('[Onboarding] Updating selected categories:', nextSelection);
      return nextSelection;
    });
  }, []);

  const handleOpenScanNotes = useCallback(() => {
    logger.debug('[Onboarding] Opening scan notes from onboarding');
    router.push(SCAN_NOTES_ROUTE);
  }, []);

  const handleContinueCategories = useCallback(() => {
    handleAdvanceStep(2);
  }, [handleAdvanceStep]);

  const handleChangeName = useCallback((value: string) => {
    setPlayerName(value);
    if (saveError) {
      setSaveError(null);
    }
  }, [saveError]);

  const handleBlurName = useCallback(() => {
    logger.debug('[Onboarding] Name input blurred');
    setNameBlurred(true);
  }, []);

  const handleSelectIdentity = useCallback((identityKey: string) => {
    logger.debug('[Onboarding] Selecting avatar identity:', identityKey);
    setSelectedIdentityKey(identityKey);
    if (saveError) {
      setSaveError(null);
    }
  }, [saveError]);

  const handleSelectAnalytics = useCallback((choice: Exclude<AnalyticsChoice, null>) => {
    logger.debug('[Onboarding] Selecting analytics preference:', choice);
    setAnalyticsChoice(choice);
    if (saveError) {
      setSaveError(null);
    }
  }, [saveError]);

  const handleContinueProfile = useCallback(() => {
    logger.debug('[Onboarding] Attempting to continue from profile step');

    if (playerName.trim().length === 0) {
      setNameBlurred(true);
    }

    if (playerName.trim().length > 0 && analyticsChoice !== null) {
      handleAdvanceStep(3);
    }
  }, [analyticsChoice, handleAdvanceStep, playerName]);

  const handleCompleteOnboarding = useCallback(async () => {
    if (isSaving) {
      return;
    }

    const trimmedName = playerName.trim();

    if (!trimmedName || analyticsChoice === null) {
      logger.debug('[Onboarding] Completion blocked because required profile values are missing');
      setStep(2);
      setNameBlurred(true);
      return;
    }

    const validationError = getPlayerNameValidationError(trimmedName);
    if (validationError) {
      logger.warn('[Onboarding] Player name validation failed:', validationError);
      setSaveError(validationError);
      setNameBlurred(true);
      setStep(2);
      return;
    }

    logger.debug('[Onboarding] Completing onboarding', {
      selectedIdentityKey,
      analyticsChoice,
      playerName: trimmedName,
    });

    setIsSaving(true);
    setSaveError(null);

    try {
      setAnalyticsConsent(analyticsChoice);
      setAvatarIdentity(selectedIdentityKey);

      const savedName = updatePlayerName(trimmedName);
      if (!savedName) {
        throw new Error('Choose a respectful player name.');
      }

      if (selectedCategories.length > 0) {
        await AsyncStorage.setItem('flashquest_user_interests', JSON.stringify(selectedCategories));
      }

      await AsyncStorage.setItem(ONBOARDING_STORAGE_KEY, 'true');
      router.replace('/' as Href);
    } catch (error) {
      logger.warn('[Onboarding] Failed to complete onboarding:', error);
      const message = error instanceof Error && error.message
        ? error.message
        : 'Could not finish setup. Please try again.';
      setSaveError(message);
      setIsSaving(false);
    }
  }, [
    analyticsChoice,
    isSaving,
    playerName,
    selectedCategories,
    selectedIdentityKey,
    setAnalyticsConsent,
    setAvatarIdentity,
    updatePlayerName,
  ]);

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.stage, { opacity: transitionOpacity }]}>
        {step === 0 ? (
          <TutorialStep
            theme={theme}
            isDark={isDark}
            tutorialPart={tutorialPart}
            isFlipped={isFlipped}
            onFlip={handleFlipCard}
            onAdvance={handleAdvanceTutorial}
            onSkip={handleSkipIntro}
            cardScale={cardScale}
            hintOpacity={hintOpacity}
          />
        ) : null}

        {step === 1 ? (
          <CategoriesStep
            theme={theme}
            isDark={isDark}
            selectedCategories={selectedCategories}
            onToggleCategory={handleToggleCategory}
            onScanNotes={handleOpenScanNotes}
            onSkip={() => handleAdvanceStep(2)}
            onContinue={handleContinueCategories}
            onGoBack={handleGoBack}
          />
        ) : null}

        {step === 2 ? (
          <ProfileStep
            theme={theme}
            isDark={isDark}
            playerName={playerName}
            nameBlurred={nameBlurred}
            selectedIdentityKey={selectedIdentityKey}
            analyticsChoice={analyticsChoice}
            errorMessage={saveError}
            onChangeName={handleChangeName}
            onBlurName={handleBlurName}
            onSelectIdentity={handleSelectIdentity}
            onSelectAnalytics={handleSelectAnalytics}
            onContinue={handleContinueProfile}
            onGoBack={handleGoBack}
          />
        ) : null}

        {step === 3 ? (
          <CelebrationStep
            theme={theme}
            isDark={isDark}
            selectedIdentityKey={selectedIdentityKey}
            playerName={playerName}
            isSaving={isSaving}
            errorMessage={saveError}
            onComplete={() => {
              void handleCompleteOnboarding();
            }}
            onGoBack={handleGoBack}
          />
        ) : null}
      </Animated.View>

      <View style={styles.pagination} pointerEvents="none" testID="onboarding-pagination">
        {Array.from({ length: 4 }).map((_, index) => (
          <View
            key={`dot-${index}`}
            style={[styles.dot, index === step ? styles.dotActive : null]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  stage: {
    flex: 1,
  },
  screen: {
    flex: 1,
  },
  screenOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  safeArea: {
    flex: 1,
  },
  screenContent: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 10,
  },
  tutorialScreenContent: {
    paddingBottom: 72,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  topRowRight: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginBottom: 8,
  },
  wordmark: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
    fontWeight: '800' as const,
    letterSpacing: 0.2,
  },
  topTextButton: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
    fontWeight: '700' as const,
  },
  tutorialStage: {
    flex: 1,
    justifyContent: 'center',
  },
  tutorialProgressWrap: {
    alignItems: 'center',
    marginBottom: 20,
  },
  progressText: {
    color: 'rgba(255,255,255,0.74)',
    fontSize: 14,
    fontWeight: '700' as const,
    marginBottom: 10,
  },
  progressTrack: {
    width: 120,
    height: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.18)',
    overflow: 'hidden' as const,
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
  },
  tutorialCardArea: {
    alignItems: 'center',
  },
  demoCardOuter: {
    width: '100%',
  },
  demoCard: {
    minHeight: 280,
    borderRadius: 28,
    paddingHorizontal: 26,
    paddingVertical: 30,
    justifyContent: 'center',
    alignItems: 'center',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.18,
    shadowRadius: 34,
    elevation: 14,
  },
  demoCardText: {
    fontSize: 22,
    lineHeight: 30,
    fontWeight: '800' as const,
    textAlign: 'center' as const,
    letterSpacing: -0.3,
  },
  answerContent: {
    alignItems: 'center',
    gap: 12,
  },
  answerLabel: {
    fontSize: 12,
    fontWeight: '900' as const,
    letterSpacing: 1.4,
  },
  flipHint: {
    marginTop: 18,
    fontSize: 15,
    fontWeight: '600' as const,
    color: 'rgba(255,255,255,0.65)',
    textAlign: 'center' as const,
  },
  tutorialActionSlot: {
    minHeight: 76,
    width: '100%',
    justifyContent: 'center',
    marginTop: 16,
  },
  overviewScrollContent: {
    paddingTop: 12,
    paddingBottom: 56,
  },
  overviewTitle: {
    color: '#FFFFFF',
    fontSize: 28,
    lineHeight: 32,
    fontWeight: '800' as const,
    letterSpacing: -0.7,
    marginBottom: 10,
  },
  overviewSubtitle: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '500' as const,
    marginBottom: 24,
    maxWidth: 340,
  },
  journeyRow: {
    flexDirection: 'row',
    marginBottom: 0,
  },
  journeyTimeline: {
    width: 36,
    alignItems: 'center',
    paddingTop: 2,
  },
  journeyDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  journeyStepNumber: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800' as const,
  },
  journeyLine: {
    width: 2,
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.15)',
    marginVertical: 4,
  },
  journeyCard: {
    flex: 1,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.09)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    padding: 14,
    marginLeft: 10,
    marginBottom: 12,
  },
  journeyCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  journeyCardTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800' as const,
  },
  journeyCardTagline: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 13,
    fontWeight: '600' as const,
    marginLeft: 'auto',
  },
  journeyCardDescription: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '500' as const,
  },
  scrollStepContent: {
    paddingTop: 8,
    paddingBottom: 24,
  },
  stepTitle: {
    color: '#FFFFFF',
    fontSize: 30,
    lineHeight: 34,
    fontWeight: '800' as const,
    letterSpacing: -0.8,
    marginBottom: 12,
  },
  stepSubtitle: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '500' as const,
    marginBottom: 24,
    maxWidth: 360,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap' as const,
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  categoryTile: {
    width: '48%',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    padding: 14,
    minHeight: 110,
    marginBottom: 12,
  },
  categoryTileSelected: {
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderColor: 'rgba(255,255,255,0.4)',
  },
  categoryEmoji: {
    fontSize: 26,
    marginBottom: 10,
  },
  categoryName: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800' as const,
    textAlign: 'center' as const,
  },
  scanNotesCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    padding: 16,
    gap: 12,
  },
  scanNotesIconShell: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  scanNotesText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700' as const,
    flex: 1,
  },
  bottomActionWrap: {
    paddingTop: 12,
    paddingBottom: 52,
  },
  fieldLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
    fontWeight: '800' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 1.2,
    marginBottom: 10,
  },
  nameInput: {
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700' as const,
    paddingHorizontal: 18,
    paddingVertical: 18,
  },
  nameError: {
    color: 'rgba(239, 68, 68, 0.8)',
    fontSize: 12,
    fontWeight: '600' as const,
    marginTop: 8,
    marginBottom: 18,
  },
  nameErrorSpacer: {
    height: 30,
  },
  identityGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap' as const,
    justifyContent: 'space-between',
    marginBottom: 22,
  },
  identityTile: {
    width: '22.5%',
    aspectRatio: 1,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    position: 'relative' as const,
  },
  identitySuit: {
    fontSize: 28,
    fontWeight: '800' as const,
  },
  identityCheck: {
    position: 'absolute',
    top: 5,
    right: 7,
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900' as const,
  },
  analyticsCard: {
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    padding: 14,
  },
  analyticsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  analyticsInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 10,
  },
  analyticsIconShell: {
    width: 28,
    height: 28,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  analyticsTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800' as const,
    flexShrink: 1,
  },
  analyticsPills: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  analyticsPill: {
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderColor: 'transparent',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  analyticsPillSelected: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderColor: 'rgba(255,255,255,0.42)',
  },
  analyticsPillText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700' as const,
  },
  analyticsHint: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '500' as const,
    marginTop: 10,
  },
  celebrationScreenContent: {
    paddingBottom: 0,
    justifyContent: 'space-between',
  },
  celebrationCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 12,
  },
  iconShell: {
    width: 176,
    height: 176,
    borderRadius: 88,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.18,
    shadowRadius: 30,
    elevation: 12,
    marginBottom: 30,
  },
  iconInnerShell: {
    width: 128,
    height: 128,
    borderRadius: 64,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  celebrationSuit: {
    fontSize: 72,
    lineHeight: 76,
    fontWeight: '800' as const,
  },
  celebrationTitle: {
    color: '#FFFFFF',
    fontSize: 36,
    lineHeight: 40,
    fontWeight: '800' as const,
    letterSpacing: -1,
    textAlign: 'center' as const,
    marginBottom: 10,
  },
  celebrationSubtitle: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '600' as const,
    textAlign: 'center' as const,
    marginBottom: 18,
  },
  primaryButton: {
    minHeight: 60,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.14,
    shadowRadius: 20,
    elevation: 10,
  },
  primaryButtonDisabled: {
    opacity: 0.5,
  },
  primaryButtonText: {
    color: '#111827',
    fontSize: 17,
    fontWeight: '800' as const,
    letterSpacing: -0.2,
  },
  bottomHintText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    fontWeight: '500' as const,
    textAlign: 'center' as const,
    marginBottom: 10,
  },
  bottomErrorText: {
    color: 'rgba(255,235,238,0.96)',
    fontSize: 13,
    fontWeight: '600' as const,
    textAlign: 'center' as const,
    marginBottom: 10,
  },
  pagination: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  dot: {
    width: 9,
    height: 9,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.34)',
  },
  dotActive: {
    width: 28,
    backgroundColor: '#FFFFFF',
  },
});
