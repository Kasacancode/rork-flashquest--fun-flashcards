import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { router, type Href } from 'expo-router';
import { BookOpen, Swords, Trophy } from 'lucide-react-native';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useArena } from '@/context/ArenaContext';
import { useTheme } from '@/context/ThemeContext';

const ONBOARDING_STORAGE_KEY = 'flashquest_onboarding_complete';

type SlideGradient = readonly [string, string] | readonly [string, string, string];

type SlideItem = {
  key: string;
  title: string;
  subtitle: string;
  colors: SlideGradient;
  Icon: typeof BookOpen;
  buttonLabel: string;
};

export default function OnboardingPage() {
  const scrollViewRef = useRef<ScrollView | null>(null);
  const { width } = useWindowDimensions();
  const { theme, isDark } = useTheme();
  const { playerName, updatePlayerName } = useArena();
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [name, setName] = useState<string>(playerName);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const slides = useMemo<SlideItem[]>(() => [
    {
      key: 'study-smarter',
      title: 'Study Smarter',
      subtitle: 'Turn your notes into flashcards and master any subject with smart repetition.',
      colors: [theme.gradientStart, theme.gradientMid, theme.gradientEnd] as const,
      Icon: BookOpen,
      buttonLabel: 'Next',
    },
    {
      key: 'challenge-friends',
      title: 'Challenge Friends',
      subtitle: 'Battle head-to-head in real-time arena matches. Fast answers win more points.',
      colors: theme.arenaGradient,
      Icon: Swords,
      buttonLabel: 'Next',
    },
    {
      key: 'track-growth',
      title: 'Track Your Growth',
      subtitle: 'Earn XP, unlock achievements, and climb the ranks as you learn.',
      colors: theme.scoreGradient,
      Icon: Trophy,
      buttonLabel: 'Get Started',
    },
  ], [theme.arenaGradient, theme.gradientEnd, theme.gradientMid, theme.gradientStart, theme.scoreGradient]);

  const totalSteps = slides.length + 1;

  const scrollToStep = useCallback((index: number) => {
    scrollViewRef.current?.scrollTo({ x: width * index, animated: true });
    setCurrentStep(index);
  }, [width]);

  const handleMomentumEnd = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const nextStep = Math.round(event.nativeEvent.contentOffset.x / Math.max(width, 1));
    setCurrentStep(nextStep);
  }, [width]);

  const handleNext = useCallback(() => {
    const nextStep = Math.min(currentStep + 1, totalSteps - 1);
    scrollToStep(nextStep);
  }, [currentStep, scrollToStep, totalSteps]);

  const handleCompleteOnboarding = useCallback(async () => {
    if (isSaving) {
      return;
    }

    setIsSaving(true);

    try {
      const trimmedName = name.trim();

      if (trimmedName.length > 0) {
        updatePlayerName(trimmedName);
      }

      await AsyncStorage.setItem(ONBOARDING_STORAGE_KEY, 'true');
      router.replace('/' as Href);
    } catch (error) {
      console.warn('[Onboarding] Failed to complete onboarding:', error);
      setIsSaving(false);
    }
  }, [isSaving, name, updatePlayerName]);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        bounces={false}
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleMomentumEnd}
        scrollEventThrottle={16}
        testID="onboarding-scroll"
      >
        {slides.map((slide, index) => {
          const Icon = slide.Icon;

          return (
            <LinearGradient
              key={slide.key}
              colors={slide.colors}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.page, { width }]}
            >
              <LinearGradient
                colors={isDark ? ['rgba(15, 23, 42, 0.08)', 'rgba(2, 6, 23, 0.45)'] : ['rgba(255,255,255,0.06)', 'rgba(255,255,255,0.24)']}
                start={{ x: 0.1, y: 0 }}
                end={{ x: 0.9, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
                <View style={styles.pageContent}>
                  <View style={styles.heroSection}>
                    <View style={styles.iconShell}>
                      <View style={styles.iconInnerShell}>
                        <Icon color="#fff" size={88} strokeWidth={2.2} />
                      </View>
                    </View>
                    <View style={styles.copyBlock}>
                      <Text style={styles.slideTitle}>{slide.title}</Text>
                      <Text style={styles.slideSubtitle}>{slide.subtitle}</Text>
                    </View>
                  </View>

                  <TouchableOpacity
                    style={styles.primaryButton}
                    onPress={handleNext}
                    activeOpacity={0.85}
                    testID={`onboarding-next-${index}`}
                  >
                    <Text style={styles.primaryButtonText}>{slide.buttonLabel}</Text>
                  </TouchableOpacity>
                </View>
              </SafeAreaView>
            </LinearGradient>
          );
        })}

        <LinearGradient
          colors={[...theme.deckGradient]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.page, { width }]}
        >
          <LinearGradient
            colors={isDark ? ['rgba(15, 23, 42, 0.08)', 'rgba(2, 6, 23, 0.45)'] : ['rgba(255,255,255,0.06)', 'rgba(255,255,255,0.24)']}
            start={{ x: 0.1, y: 0 }}
            end={{ x: 0.9, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
            <View style={styles.pageContent}>
              <View style={styles.nameCard}>
                <Text style={styles.nameTitle}>What should we call you?</Text>
                <Text style={styles.nameSubtitle}>
                  This is your battle name. You can change it later in your profile.
                </Text>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder="Enter your name"
                  placeholderTextColor="rgba(255,255,255,0.62)"
                  maxLength={20}
                  autoCapitalize="words"
                  autoCorrect={false}
                  returnKeyType="done"
                  onSubmitEditing={() => {
                    void handleCompleteOnboarding();
                  }}
                  style={styles.nameInput}
                  testID="onboarding-name-input"
                />
                <TouchableOpacity
                  style={[styles.primaryButton, isSaving ? styles.primaryButtonDisabled : null]}
                  onPress={() => {
                    void handleCompleteOnboarding();
                  }}
                  activeOpacity={0.85}
                  disabled={isSaving}
                  testID="onboarding-start-button"
                >
                  <Text style={styles.primaryButtonText}>{isSaving ? 'Starting...' : 'Start FlashQuest'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </SafeAreaView>
        </LinearGradient>
      </ScrollView>

      <View style={styles.pagination} pointerEvents="none">
        {Array.from({ length: totalSteps }).map((_, index) => (
          <View
            key={`dot-${index}`}
            style={[
              styles.dot,
              index === currentStep ? styles.dotActive : null,
            ]}
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
  page: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  pageContent: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 18,
    paddingBottom: 42,
    justifyContent: 'space-between',
  },
  heroSection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconShell: {
    width: 208,
    height: 208,
    borderRadius: 104,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.16,
    shadowRadius: 30,
    elevation: 10,
    marginBottom: 44,
  },
  iconInnerShell: {
    width: 152,
    height: 152,
    borderRadius: 76,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  copyBlock: {
    alignItems: 'center',
    paddingHorizontal: 10,
    gap: 18,
  },
  slideTitle: {
    fontSize: 38,
    lineHeight: 44,
    fontWeight: '800' as const,
    color: '#fff',
    textAlign: 'center' as const,
    letterSpacing: -1.2,
  },
  slideSubtitle: {
    maxWidth: 320,
    fontSize: 18,
    lineHeight: 28,
    fontWeight: '500' as const,
    color: 'rgba(255,255,255,0.92)',
    textAlign: 'center' as const,
  },
  nameCard: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  nameTitle: {
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '800' as const,
    color: '#fff',
    marginBottom: 14,
    letterSpacing: -1,
  },
  nameSubtitle: {
    fontSize: 17,
    lineHeight: 26,
    fontWeight: '500' as const,
    color: 'rgba(255,255,255,0.88)',
    marginBottom: 28,
    maxWidth: 320,
  },
  nameInput: {
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    color: '#fff',
    fontSize: 18,
    fontWeight: '700' as const,
    paddingHorizontal: 18,
    paddingVertical: 18,
    marginBottom: 22,
  },
  primaryButton: {
    minHeight: 60,
    borderRadius: 20,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.14,
    shadowRadius: 18,
    elevation: 8,
  },
  primaryButtonDisabled: {
    opacity: 0.7,
  },
  primaryButtonText: {
    fontSize: 17,
    fontWeight: '800' as const,
    color: '#111827',
    letterSpacing: -0.2,
  },
  pagination: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 20,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
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
    backgroundColor: '#fff',
  },
});
