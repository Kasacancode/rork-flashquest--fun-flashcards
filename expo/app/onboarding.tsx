import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { router, type Href } from 'expo-router';
import {
  ArrowLeft,
  BookOpen,
  Bot,
  Camera,
  ChartNoAxesCombined,
  ShieldCheck,
  Sparkles,
  Swords,
  Target,
  Trophy,
  Zap,
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
type FeatureTile = {
  key: string;
  title: string;
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

const LEARNING_TILES: readonly FeatureTile[] = [
  {
    key: 'study',
    title: 'Study',
    description: 'Flip cards at your own pace and rate your recall',
    Icon: BookOpen,
  },
  {
    key: 'quest',
    title: 'Quest',
    description: 'Timed multiple-choice rounds to test yourself',
    Icon: Target,
  },
  {
    key: 'arena',
    title: 'Arena',
    description: 'Challenge friends in real-time battles',
    Icon: Swords,
  },
  {
    key: 'practice',
    title: 'Practice',
    description: 'Warm up against an AI opponent',
    Icon: Bot,
  },
] as const;

const TOOLKIT_TILES: readonly FeatureTile[] = [
  {
    key: 'ai-builder',
    title: 'AI Deck Builder',
    description: 'Paste notes or snap a photo — AI makes the cards',
    Icon: Sparkles,
  },
  {
    key: 'stats',
    title: 'Stats & Streaks',
    description: 'Track accuracy, streaks, and weekly progress',
    Icon: ChartNoAxesCombined,
  },
  {
    key: 'xp',
    title: 'XP & Levels',
    description: 'Earn points, unlock achievements, level up',
    Icon: Trophy,
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
            <TouchableOpacity onPress={onSkip} activeOpacity={0.8} testID="onboarding-skip-intro">
              <Text style={styles.topTextButton}>Skip intro</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.overviewScrollContent}>
            <Text style={styles.overviewTitle}>Here&apos;s how it works</Text>
            <Text style={styles.overviewSubtitle}>Four ways to learn, plus tools to build your decks.</Text>

            <View style={styles.sectionBlock}>
              <Text style={styles.sectionLabel}>Ways to learn</Text>
              <View style={styles.featureGrid}>
                {LEARNING_TILES.map((tile) => {
                  const Icon = tile.Icon;

                  return (
                    <View key={tile.key} style={styles.featureGridTile}>
                      <Icon color="#FFFFFF" size={24} strokeWidth={2.2} />
                      <Text style={styles.featureTileTitle}>{tile.title}</Text>
                      <Text style={styles.featureTileDescription}>{tile.description}</Text>
                    </View>
                  );
                })}
              </View>
            </View>

            <View style={styles.sectionBlock}>
              <Text style={styles.sectionLabel}>Your toolkit</Text>
              <View style={styles.toolkitColumn}>
                {TOOLKIT_TILES.map((tile) => {
                  const Icon = tile.Icon;

                  return (
                    <View key={tile.key} style={styles.toolkitTile}>
                      <View style={styles.toolkitIconShell}>
                        <Icon color="#FFFFFF" size={22} strokeWidth={2.1} />
                      </View>
                      <View style={styles.toolkitCopy}>
                        <Text style={styles.featureTileTitle}>{tile.title}</Text>
                        <Text style={styles.featureTileDescription}>{tile.description}</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>

            <TouchableOpacity style={styles.primaryButton} onPress={onAdvance} activeOpacity={0.86} testID="onboarding-overview-continue">
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
          <TouchableOpacity onPress={onSkip} activeOpacity={0.8} testID="onboarding-skip-intro">
            <Text style={styles.topTextButton}>Skip intro</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.tutorialStage}>
          <View style={styles.tutorialProgressWrap} testID="onboarding-tutorial-progress">
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
                <TouchableOpacity style={styles.primaryButton} onPress={onAdvance} activeOpacity={0.86} testID="onboarding-tutorial-next">
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
          <TouchableOpacity onPress={onGoBack} activeOpacity={0.8} testID="onboarding-back">
            <ArrowLeft color="rgba(255,255,255,0.7)" size={22} strokeWidth={2.2} />
          </TouchableOpacity>
          <TouchableOpacity onPress={onSkip} activeOpacity={0.8} testID="onboarding-categories-skip">
            <Text style={styles.topTextButton}>Skip →</Text>
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollStepContent}>
          <Text style={styles.stepTitle}>What do you study?</Text>
          <Text style={styles.stepSubtitle}>
            Pick your interests to see the right decks first. You can change this anytime.
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
                  testID={`onboarding-category-${tile.name}`}
                >
                  <Text style={styles.categoryEmoji}>{tile.emoji}</Text>
                  <Text style={styles.categoryName}>{tile.name}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity style={styles.scanNotesCard} onPress={onScanNotes} activeOpacity={0.86} testID="onboarding-scan-notes">
            <View style={styles.scanNotesIconShell}>
              <Camera color="#FFFFFF" size={18} strokeWidth={2.1} />
            </View>
            <Text style={styles.scanNotesText}>Scan your notes to make a deck</Text>
          </TouchableOpacity>
        </ScrollView>

        <View style={styles.bottomActionWrap}>
          <TouchableOpacity style={styles.primaryButton} onPress={onContinue} activeOpacity={0.86} testID="onboarding-categories-continue">
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

  return (
    <GradientScreen colors={theme.arenaGradient} isDark={isDark} testID="onboarding-step-profile">
      <View style={styles.screenContent}>
        <View style={styles.topRow}>
          <TouchableOpacity onPress={onGoBack} activeOpacity={0.8} testID="onboarding-back">
            <ArrowLeft color="rgba(255,255,255,0.7)" size={22} strokeWidth={2.2} />
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollStepContent}>
          <Text style={styles.stepTitle}>Set up your profile</Text>
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
            testID="onboarding-name-input"
          />
          {shouldShowNameError ? <Text style={styles.nameError}>Name is required</Text> : <View style={styles.nameErrorSpacer} />}

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
                  testID={`onboarding-identity-${identity.key}`}
                >
                  {isSelected ? <Text style={styles.identityCheck}>✓</Text> : null}
                  <Text style={[styles.identitySuit, { color: identity.color }]}>{identity.suit}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

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
                  testID="onboarding-decline-analytics"
                >
                  <Text style={styles.analyticsPillText}>Not now</Text>
                </TouchableOpacity>
              </View>
            </View>

            <Text style={styles.analyticsHint}>Anonymous usage data only · change anytime in Settings</Text>
          </View>
        </ScrollView>

        <View style={styles.bottomActionWrap}>
          {errorMessage ? <Text style={styles.bottomErrorText}>{errorMessage}</Text> : null}
          <TouchableOpacity
            style={[styles.primaryButton, !canContinue ? styles.primaryButtonDisabled : null]}
            onPress={onContinue}
            activeOpacity={0.86}
            disabled={!canContinue}
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

  return (
    <GradientScreen colors={theme.scoreGradient} isDark={isDark} testID="onboarding-step-celebration">
      <View style={[styles.screenContent, styles.celebrationScreenContent]}>
        <View style={styles.topRow}>
          <TouchableOpacity onPress={onGoBack} activeOpacity={0.8} testID="onboarding-back">
            <ArrowLeft color="rgba(255,255,255,0.7)" size={22} strokeWidth={2.2} />
          </TouchableOpacity>
        </View>

        <View style={styles.celebrationCenter}>
          <View style={styles.iconShell}>
            <View style={styles.iconInnerShell}>
              <Text style={[styles.celebrationSuit, { color: selectedIdentity.color }]}>{selectedIdentity.suit}</Text>
            </View>
          </View>

          <Text style={styles.celebrationTitle}>You&apos;re all set!</Text>
          <Text style={styles.celebrationSubtitle}>Welcome, {playerName.trim() || 'Player'}!</Text>

          <View style={styles.xpPill}>
            <Zap color="#FFFFFF" size={14} strokeWidth={2.2} />
            <Text style={styles.xpPillText}>+4 XP from your first cards</Text>
          </View>
        </View>

        <View style={styles.bottomActionWrap}>
          {errorMessage ? <Text style={styles.bottomErrorText}>{errorMessage}</Text> : null}
          <TouchableOpacity
            style={[styles.primaryButton, isSaving ? styles.primaryButtonDisabled : null]}
            onPress={onComplete}
            activeOpacity={0.86}
            disabled={isSaving}
            testID="onboarding-start-button"
          >
            <Text style={styles.primaryButtonText}>{isSaving ? 'Starting...' : 'Start FlashQuest'}</Text>
          </TouchableOpacity>
        </View>
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
      console.log('[Onboarding] Syncing saved player name into onboarding state');
      setPlayerName(savedPlayerName);
    }
  }, [playerName, savedPlayerName]);

  useEffect(() => {
    if ((analyticsConsent === 'granted' || analyticsConsent === 'declined') && analyticsChoice === null) {
      console.log('[Onboarding] Syncing saved analytics preference into onboarding state:', analyticsConsent);
      setAnalyticsChoice(analyticsConsent);
    }
  }, [analyticsChoice, analyticsConsent]);

  useEffect(() => {
    console.log('[Onboarding] Transitioning view:', { step, tutorialPart });
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
    console.log('[Onboarding] Advancing step:', { from: step, to: nextStep });
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

    console.log('[Onboarding] Flipping tutorial card:', tutorialPart);

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
    console.log('[Onboarding] Advancing tutorial:', tutorialPart);
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
    console.log('[Onboarding] Skipping tutorial intro');
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

      console.log('[Onboarding] Updating selected categories:', nextSelection);
      return nextSelection;
    });
  }, []);

  const handleOpenScanNotes = useCallback(() => {
    console.log('[Onboarding] Opening scan notes from onboarding');
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
    console.log('[Onboarding] Name input blurred');
    setNameBlurred(true);
  }, []);

  const handleSelectIdentity = useCallback((identityKey: string) => {
    console.log('[Onboarding] Selecting avatar identity:', identityKey);
    setSelectedIdentityKey(identityKey);
    if (saveError) {
      setSaveError(null);
    }
  }, [saveError]);

  const handleSelectAnalytics = useCallback((choice: Exclude<AnalyticsChoice, null>) => {
    console.log('[Onboarding] Selecting analytics preference:', choice);
    setAnalyticsChoice(choice);
    if (saveError) {
      setSaveError(null);
    }
  }, [saveError]);

  const handleContinueProfile = useCallback(() => {
    console.log('[Onboarding] Attempting to continue from profile step');

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
      console.log('[Onboarding] Completion blocked because required profile values are missing');
      setStep(2);
      setNameBlurred(true);
      return;
    }

    const validationError = getPlayerNameValidationError(trimmedName);
    if (validationError) {
      console.warn('[Onboarding] Player name validation failed:', validationError);
      setSaveError(validationError);
      setNameBlurred(true);
      setStep(2);
      return;
    }

    console.log('[Onboarding] Completing onboarding', {
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

      await AsyncStorage.setItem(ONBOARDING_STORAGE_KEY, 'true');
      router.replace('/' as Href);
    } catch (error) {
      console.warn('[Onboarding] Failed to complete onboarding:', error);
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
  sectionBlock: {
    marginBottom: 20,
  },
  sectionLabel: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    fontWeight: '800' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 1.4,
    marginBottom: 12,
  },
  featureGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap' as const,
    justifyContent: 'space-between',
  },
  featureGridTile: {
    width: '48%',
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    padding: 14,
    marginBottom: 12,
    minHeight: 132,
  },
  featureTileTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800' as const,
    marginTop: 12,
    marginBottom: 6,
  },
  featureTileDescription: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500' as const,
  },
  toolkitColumn: {
    gap: 12,
  },
  toolkitTile: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    padding: 14,
    gap: 12,
  },
  toolkitIconShell: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  toolkitCopy: {
    flex: 1,
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
  xpPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginBottom: 16,
  },
  xpPillText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700' as const,
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
