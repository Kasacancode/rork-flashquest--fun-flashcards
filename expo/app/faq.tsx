import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { ArrowLeft, BookOpen, ChevronDown, ChevronUp, Mail, Settings, Sparkles, Target, Trophy, UserRound } from 'lucide-react-native';
import React, { useCallback, useMemo, useState } from 'react';
import { LayoutAnimation, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, UIManager, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import ResponsiveContainer from '@/components/ResponsiveContainer';
import { PRIVACY_LINKS } from '@/constants/privacy';
import { useTheme } from '@/context/ThemeContext';
import { SETTINGS_ROUTE } from '@/utils/routes';
import { logger } from '@/utils/logger';
import { openSupportContact } from '@/utils/support';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type FAQGroupId = 'getting-started' | 'study-modes' | 'progress-review' | 'profile-settings';

interface FAQItem {
  id: string;
  title: string;
  summary: string;
  content: string[];
}

interface FAQGroup {
  id: FAQGroupId;
  title: string;
  subtitle: string;
  items: FAQItem[];
}

interface FAQGroupVisuals {
  accent: string;
  softAccent: string;
  gradient: readonly [string, string];
  icon: React.ReactNode;
}

interface QuickStartStep {
  id: string;
  title: string;
  description: string;
}

const QUICK_START_STEPS: readonly QuickStartStep[] = [
  {
    id: 'build',
    title: 'Build or import a deck',
    description: 'Create cards manually, paste notes, scan text, or import a shared deck code.',
  },
  {
    id: 'study',
    title: 'Pick the right mode',
    description: 'Use Study for calm review, Quest for speed, Practice for AI pressure, or Arena for live battles.',
  },
  {
    id: 'review',
    title: 'Keep up with review',
    description: 'Return to due cards and weak cards so FlashQuest can move your deck toward real mastery.',
  },
  {
    id: 'track',
    title: 'Track growth and tune settings',
    description: 'Use profile, awards, stats, leaderboards, and settings to guide your routine and progress.',
  },
] as const;

const FAQ_GROUPS: readonly FAQGroup[] = [
  {
    id: 'getting-started',
    title: 'Getting Started',
    subtitle: 'Deck creation, editing, your deck hub, and sharing basics.',
    items: [
      {
        id: 'creating-decks',
        title: 'Creating your first deck',
        summary: 'Start from scratch, paste notes, scan content, or import a shared deck in a few taps.',
        content: [
          'Open Decks from the home screen, then tap the + button in the top right to create a deck.',
          'You can build cards in multiple ways: Manual entry, Scan Notes, Text to Deck, or Import from Clipboard.',
          'Bulk paste works best with one card per line using separators like |, ;, or a tab between front and back.',
          'If you want a quick example before building your own, open one of the built-in decks to see how a clean deck is structured.',
        ],
      },
      {
        id: 'editing-organizing',
        title: 'Editing and organizing cards',
        summary: 'Clean up wording, reorder cards, and keep decks easy to study later.',
        content: [
          'Open a deck in the editor when you want to revise card wording, fix mistakes, or add missing explanations.',
          'Short, direct prompts usually study better than long paragraphs. Aim for one clear idea per card whenever possible.',
          'You can reorder cards, duplicate content, and keep related material grouped so review feels more predictable.',
          'If a card needs extra help, hints and explanations can make difficult material much easier to revisit later.',
        ],
      },
      {
        id: 'deck-hub',
        title: 'Understanding the deck hub',
        summary: 'The deck hub is the main control center for a single deck.',
        content: [
          'Tap a deck from your deck list to open its hub. This is where you check progress, due cards, weak cards, and recent activity for that deck.',
          'The hub gives you quick actions for starting study sessions, running quests, practicing, or drilling weak cards without digging through menus.',
          'When you are not sure what to do next, the hub is usually the best place to start because it surfaces the most important actions first.',
        ],
      },
      {
        id: 'sharing',
        title: 'Sharing and importing decks',
        summary: 'Move decks between friends without rebuilding them by hand.',
        content: [
          'To share a deck, open it in the editor and use the share action to copy a deck code.',
          'To import one, return to the deck list, tap +, and choose the import option that reads from your clipboard.',
          'Shared decks can carry the full study structure, which makes collaboration and class sharing much faster.',
        ],
      },
    ],
  },
  {
    id: 'study-modes',
    title: 'Study Modes',
    subtitle: 'When to use each mode and what happens inside a session.',
    items: [
      {
        id: 'study-mode',
        title: 'Study mode',
        summary: 'Best for calm review, familiarization, and lightweight repetition.',
        content: [
          'Study mode lets you move through cards at your own pace. Reveal the answer, move forward, and explore hints or explanations when you need them.',
          'It is the best choice when you are learning fresh material, refreshing before class, or reviewing without time pressure.',
          'After a card, you can mark how it felt with ratings like Easy, Okay, Hard, or Forgot, which helps FlashQuest understand your memory strength.',
        ],
      },
      {
        id: 'quest-mode',
        title: 'Quest mode',
        summary: 'Fast multiple-choice runs built for speed, accuracy, and XP.',
        content: [
          'Quest gives you rapid multiple-choice questions with four answers on screen at once.',
          'Use Learn mode for lower pressure and Test mode when you want a more score-focused run.',
          'Quest is excellent when you want to warm up quickly, test recall speed, or earn XP in short bursts.',
          'Missed cards can be drilled afterward so mistakes become targeted review instead of wasted runs.',
        ],
      },
      {
        id: 'practice-ai',
        title: 'Practice vs AI',
        summary: 'Head-to-head sessions against an adaptive opponent.',
        content: [
          'Practice mode matches you against an AI opponent answering the same questions.',
          'It adds pressure without needing another real player, so it is a great middle ground between solo study and multiplayer.',
          'Correct answers still help your review model, and faster, stronger runs usually earn better XP outcomes.',
        ],
      },
      {
        id: 'battle-arena',
        title: 'Battle Arena multiplayer',
        summary: 'Real-time deck battles with room codes, shared questions, and live pressure.',
        content: [
          'One player hosts a room and shares the room code. The other player joins with that code.',
          'Both players get the same questions, so Arena rewards fast recall and accuracy rather than luck.',
          'Arena is the right choice when you want competition, bragging rights, or a fun way to study with friends.',
          'Strong Arena results can feed into your profile growth and the wider competitive feel of FlashQuest.',
        ],
      },
    ],
  },
  {
    id: 'progress-review',
    title: 'Progress & Competition',
    subtitle: 'Mastery, due cards, XP, streaks, stats, awards, and leaderboards.',
    items: [
      {
        id: 'mastery',
        title: 'Card mastery and smart review',
        summary: 'FlashQuest tracks learning strength, not just shallow streaks.',
        content: [
          'Each card moves through learning states such as New, Learning, Reviewing, Mastered, and Lapsed.',
          'Due cards are cards FlashQuest believes are ready for another review. Weak cards are the ones most likely to slip if ignored.',
          'If you are not sure what to study, review due cards first and then use weak-card drills to patch the gaps that matter most.',
        ],
      },
      {
        id: 'xp-levels-awards',
        title: 'XP, levels, and awards',
        summary: 'Your progress turns study activity into visible growth across the app.',
        content: [
          'Study, Quest, Practice, and Arena all contribute XP, so almost every real study session moves your account forward.',
          'XP increases your level, and your current level is shown clearly on your profile card.',
          'Awards unlock automatically when you hit milestones for consistency, deck creation, wins, collection growth, and other achievements.',
          'If you want a motivating overview of how far you have come, check the Awards tab on your profile.',
        ],
      },
      {
        id: 'streaks-stats',
        title: 'Streaks and stats',
        summary: 'Use stats to understand consistency, not just single-session performance.',
        content: [
          'Your streak counts active study days in a row, so even a short session can help keep momentum alive.',
          'The Stats areas pull together level progress, mode performance, activity history, and deck-level progress.',
          'If something feels harder than expected, stats can help you spot weak patterns like low accuracy or missed review days.',
        ],
      },
      {
        id: 'leaderboards',
        title: 'Leaderboards and ranking',
        summary: 'See how you compare globally and check whether your habits are paying off.',
        content: [
          'The leaderboard screen shows global rankings with filters like all time and weekly performance.',
          'Sign in if you want your account to appear in global ranking lists and to track your personal rank directly.',
          'Leaderboard progress is driven by real XP and study activity, so the fastest way up is consistent studying across your main modes.',
          'If you are not ranked yet, keep studying and refreshing the screen later to see when you break into the visible list.',
        ],
      },
    ],
  },
  {
    id: 'profile-settings',
    title: 'Profile, Settings & Support',
    subtitle: 'Profile tabs, appearance, goals, reminders, privacy, backups, and help.',
    items: [
      {
        id: 'profile-tabs',
        title: 'Profile overview, avatar, and awards',
        summary: 'Your profile is the main home for identity, milestones, and quick utilities.',
        content: [
          'Overview holds quick entry points like Leaderboard, Settings, FAQ, and Support.',
          'Avatar lets you customize your profile look so your account feels personal and recognizable.',
          'Awards shows milestone progress and completed achievement badges in one organized place.',
        ],
      },
      {
        id: 'appearance-goals',
        title: 'Dark mode and study goals',
        summary: 'Tune the app to your routine without overcomplicating things.',
        content: [
          'Open Settings when you want to toggle dark mode for a lower-glare study experience.',
          'Your daily study goal also lives in Settings, where you can set a realistic target for how many cards you want to review each day.',
          'If you are building a habit, pick a goal you can hit consistently before raising it.',
        ],
      },
      {
        id: 'feedback-controls',
        title: 'Reminders, sound, and haptics',
        summary: 'Control how much feedback FlashQuest gives you during daily use.',
        content: [
          'Settings includes streak reminders if you want a daily nudge to keep your study habit alive.',
          'You can also turn sound effects and haptic feedback on or off depending on how quiet or tactile you want sessions to feel.',
          'These controls are optional, so the app can stay simple if you prefer a cleaner experience.',
        ],
      },
      {
        id: 'privacy-backup',
        title: 'Privacy, backup, and restore',
        summary: 'Know what stays local, what syncs, and how to protect your data.',
        content: [
          'Privacy & Data is where you review policies and control privacy-related settings.',
          'Backup tools in Settings let you export your decks, progress, and stats, then restore them later if needed.',
          'Restore will replace current local data with the backup file, so it is best used carefully when moving devices or recovering progress.',
        ],
      },
      {
        id: 'faq-support',
        title: 'FAQ and support',
        summary: 'Use the right help channel depending on whether you need guidance or direct assistance.',
        content: [
          'Use Help Center when you want to learn how a feature works, compare modes, or understand what a screen is for.',
          'Use Support when something seems broken, you cannot access something important, or you need direct account or deck help.',
          `Support contact currently routes to ${PRIVACY_LINKS.supportEmail}.`,
        ],
      },
    ],
  },
] as const;

export default function FAQScreen() {
  const router = useRouter();
  const { theme, isDark } = useTheme();
  const [expandedGroupId, setExpandedGroupId] = useState<FAQGroupId | null>('getting-started');
  const [expandedItemId, setExpandedItemId] = useState<string | null>('creating-decks');

  const animateLayout = useCallback(() => {
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    }
  }, []);

  const groupVisuals = useMemo<Record<FAQGroupId, FAQGroupVisuals>>(() => ({
    'getting-started': {
      accent: '#60A5FA',
      softAccent: 'rgba(96,165,250,0.14)',
      gradient: ['rgba(96,165,250,0.18)', 'rgba(59,130,246,0.04)'],
      icon: <BookOpen color="#60A5FA" size={20} strokeWidth={2.2} />,
    },
    'study-modes': {
      accent: '#818CF8',
      softAccent: 'rgba(129,140,248,0.14)',
      gradient: ['rgba(129,140,248,0.18)', 'rgba(99,102,241,0.04)'],
      icon: <Target color="#818CF8" size={20} strokeWidth={2.2} />,
    },
    'progress-review': {
      accent: '#A78BFA',
      softAccent: 'rgba(167,139,250,0.14)',
      gradient: ['rgba(167,139,250,0.18)', 'rgba(139,92,246,0.04)'],
      icon: <Trophy color="#A78BFA" size={20} strokeWidth={2.2} />,
    },
    'profile-settings': {
      accent: '#34D399',
      softAccent: 'rgba(52,211,153,0.14)',
      gradient: ['rgba(52,211,153,0.18)', 'rgba(16,185,129,0.04)'],
      icon: <UserRound color="#34D399" size={20} strokeWidth={2.2} />,
    },
  }), []);

  const cardBg = isDark ? 'rgba(15,23,42,0.76)' : 'rgba(255,255,255,0.94)';
  const cardBorder = isDark ? 'rgba(148,163,184,0.18)' : 'rgba(99,102,241,0.08)';
  const nestedCardBg = isDark ? 'rgba(8,15,30,0.62)' : 'rgba(248,250,252,0.94)';
  const nestedCardBorder = isDark ? 'rgba(148,163,184,0.14)' : 'rgba(148,163,184,0.16)';
  const heroBorder = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.18)';

  const toggleGroup = useCallback((group: FAQGroup) => {
    const isClosing = expandedGroupId === group.id;
    animateLayout();
    logger.log('[FAQ] Toggling group:', group.id, 'expanded:', !isClosing);
    setExpandedGroupId(isClosing ? null : group.id);
    setExpandedItemId(isClosing ? null : (group.items[0]?.id ?? null));
  }, [animateLayout, expandedGroupId]);

  const toggleItem = useCallback((itemId: string) => {
    const nextItemId = expandedItemId === itemId ? null : itemId;
    animateLayout();
    logger.log('[FAQ] Toggling item:', itemId, 'expanded:', nextItemId === itemId);
    setExpandedItemId(nextItemId);
  }, [animateLayout, expandedItemId]);

  const handleOpenSettings = useCallback(() => {
    logger.log('[FAQ] Opening settings from help center');
    router.push(SETTINGS_ROUTE);
  }, [router]);

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[theme.gradientStart, theme.gradientMid, theme.gradientEnd]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {isDark ? (
        <LinearGradient
          colors={['rgba(6,10,22,0.08)', 'rgba(6,10,22,0.36)', 'rgba(5,8,20,0.78)']}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.95, y: 1 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      ) : (
        <LinearGradient
          colors={['rgba(255,255,255,0.04)', 'rgba(255,255,255,0)', 'rgba(255,255,255,0.08)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      )}
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.8} testID="faq-back-button">
            <ArrowLeft color="#fff" size={24} strokeWidth={2.5} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Help Center</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <ResponsiveContainer>
            <LinearGradient
              colors={isDark ? ['rgba(15,23,42,0.56)', 'rgba(15,23,42,0.82)'] : ['rgba(67,56,202,0.34)', 'rgba(79,70,229,0.44)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.heroCard, { borderColor: heroBorder }]}
            >
              <View style={styles.heroBadge}>
                <Sparkles color="#FFFFFF" size={15} strokeWidth={2.4} />
                <Text style={styles.heroBadgeText}>FlashQuest Guide</Text>
              </View>
              <Text style={styles.heroTitle}>How FlashQuest works</Text>
              <Text style={styles.heroSubtitle}>
                Start here if you are new, confused, or just want a full refresher. This guide covers decks, study modes,
                review, profile tools, settings, leaderboards, and where to go when you need help.
              </Text>
            </LinearGradient>

            <View style={[styles.quickStartCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
              <View style={styles.quickStartHeader}>
                <Text style={[styles.quickStartTitle, { color: theme.text }]}>New here? Start with these 4 steps</Text>
                <Text style={[styles.quickStartSubtitle, { color: theme.textSecondary }]}>A simple path that works well for most beginners.</Text>
              </View>
              <View style={styles.quickStartList}>
                {QUICK_START_STEPS.map((step, index) => (
                  <View key={step.id} style={[styles.quickStartRow, { borderColor: nestedCardBorder, backgroundColor: nestedCardBg }]}>
                    <View style={[styles.quickStartIndexWrap, { backgroundColor: index === 0 ? 'rgba(96,165,250,0.14)' : index === 1 ? 'rgba(129,140,248,0.14)' : index === 2 ? 'rgba(167,139,250,0.14)' : 'rgba(52,211,153,0.14)' }]}>
                      <Text
                        style={[
                          styles.quickStartIndexText,
                          { color: index === 0 ? '#60A5FA' : index === 1 ? '#818CF8' : index === 2 ? '#A78BFA' : '#34D399' },
                        ]}
                      >
                        {index + 1}
                      </Text>
                    </View>
                    <View style={styles.quickStartCopy}>
                      <Text style={[styles.quickStartStepTitle, { color: theme.text }]}>{step.title}</Text>
                      <Text style={[styles.quickStartStepDescription, { color: theme.textSecondary }]}>{step.description}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>

            <View style={styles.groupList}>
              {FAQ_GROUPS.map((group) => {
                const visuals = groupVisuals[group.id];
                const isGroupExpanded = expandedGroupId === group.id;
                return (
                  <View
                    key={group.id}
                    style={[
                      styles.groupCard,
                      {
                        backgroundColor: cardBg,
                        borderColor: isGroupExpanded ? visuals.accent : cardBorder,
                      },
                    ]}
                  >
                    <LinearGradient
                      colors={visuals.gradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.groupAccentBar}
                    />
                    <TouchableOpacity
                      style={styles.groupHeader}
                      onPress={() => toggleGroup(group)}
                      activeOpacity={0.82}
                      testID={`faq-group-${group.id}`}
                    >
                      <View style={[styles.groupIconWrap, { backgroundColor: visuals.softAccent }]}>
                        {visuals.icon}
                      </View>
                      <View style={styles.groupTextWrap}>
                        <Text style={[styles.groupTitle, { color: theme.text }]}>{group.title}</Text>
                        <Text style={[styles.groupSubtitle, { color: theme.textSecondary }]}>{group.subtitle}</Text>
                      </View>
                      <View style={styles.groupMeta}>
                        <View style={[styles.countPill, { backgroundColor: visuals.softAccent }]}>
                          <Text style={[styles.countPillText, { color: visuals.accent }]}>{group.items.length} topics</Text>
                        </View>
                        {isGroupExpanded ? (
                          <ChevronUp color={visuals.accent} size={18} strokeWidth={2.4} />
                        ) : (
                          <ChevronDown color={theme.textSecondary} size={18} strokeWidth={2.4} />
                        )}
                      </View>
                    </TouchableOpacity>

                    {isGroupExpanded ? (
                      <View style={styles.itemList}>
                        {group.items.map((item, index) => {
                          const isItemExpanded = expandedItemId === item.id;
                          return (
                            <View
                              key={item.id}
                              style={[
                                styles.itemCard,
                                {
                                  backgroundColor: nestedCardBg,
                                  borderColor: isItemExpanded ? visuals.accent : nestedCardBorder,
                                },
                              ]}
                            >
                              <TouchableOpacity
                                style={styles.itemHeader}
                                onPress={() => toggleItem(item.id)}
                                activeOpacity={0.82}
                                testID={`faq-item-${item.id}`}
                              >
                                <View style={[styles.itemIndexWrap, { backgroundColor: visuals.softAccent }]}>
                                  <Text style={[styles.itemIndexText, { color: visuals.accent }]}>{String(index + 1).padStart(2, '0')}</Text>
                                </View>
                                <View style={styles.itemTextWrap}>
                                  <Text style={[styles.itemTitle, { color: theme.text }]}>{item.title}</Text>
                                  <Text style={[styles.itemSummary, { color: theme.textSecondary }]}>{item.summary}</Text>
                                </View>
                                {isItemExpanded ? (
                                  <ChevronUp color={visuals.accent} size={18} strokeWidth={2.4} />
                                ) : (
                                  <ChevronDown color={theme.textSecondary} size={18} strokeWidth={2.4} />
                                )}
                              </TouchableOpacity>

                              {isItemExpanded ? (
                                <View style={styles.itemBody}>
                                  {item.content.map((line, lineIndex) => {
                                    const isBullet = line.startsWith('• ');
                                    const contentText = isBullet ? line.slice(2) : line;
                                    return (
                                      <View key={`${item.id}-${lineIndex}`} style={styles.bodyRow}>
                                        {isBullet ? <View style={[styles.bodyBullet, { backgroundColor: visuals.accent }]} /> : null}
                                        <Text style={[styles.bodyText, { color: theme.textSecondary }]}>{contentText}</Text>
                                      </View>
                                    );
                                  })}
                                </View>
                              ) : null}
                            </View>
                          );
                        })}
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </View>

            <View style={[styles.supportCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
              <Text style={[styles.supportTitle, { color: theme.text }]}>Still need help?</Text>
              <Text style={[styles.supportBody, { color: theme.textSecondary }]}>
                Use Settings for appearance, goals, reminders, privacy, and backups. Use support when you need direct help with your account,
                decks, or something that is not behaving correctly.
              </Text>

              <View style={styles.supportRows}>
                <TouchableOpacity
                  style={[styles.supportRow, { borderColor: nestedCardBorder, backgroundColor: nestedCardBg }]}
                  onPress={handleOpenSettings}
                  activeOpacity={0.82}
                  testID="faq-open-settings"
                >
                  <View style={[styles.supportIconWrap, { backgroundColor: isDark ? 'rgba(52,211,153,0.16)' : 'rgba(52,211,153,0.1)' }]}>
                    <Settings color="#34D399" size={18} strokeWidth={2.2} />
                  </View>
                  <View style={styles.supportCopy}>
                    <Text style={[styles.supportRowTitle, { color: theme.text }]}>Open settings</Text>
                    <Text style={[styles.supportRowSubtitle, { color: theme.textSecondary }]}>Appearance, study goals, reminders, privacy, and backup tools.</Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.supportRow, { borderColor: nestedCardBorder, backgroundColor: nestedCardBg }]}
                  onPress={() => void openSupportContact()}
                  activeOpacity={0.82}
                  testID="faq-open-support-contact"
                >
                  <View style={[styles.supportIconWrap, { backgroundColor: isDark ? 'rgba(59,130,246,0.16)' : 'rgba(59,130,246,0.1)' }]}>
                    <Mail color="#3B82F6" size={18} strokeWidth={2.2} />
                  </View>
                  <View style={styles.supportCopy}>
                    <Text style={[styles.supportRowTitle, { color: theme.text }]}>Contact support</Text>
                    <Text style={[styles.supportRowSubtitle, { color: theme.textSecondary }]}>{`Support: ${PRIVACY_LINKS.supportEmail}`}</Text>
                  </View>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.footer}>
              <Text style={[styles.footerText, { color: isDark ? 'rgba(226,232,240,0.72)' : 'rgba(255,255,255,0.86)' }]}>FlashQuest help guide</Text>
            </View>
          </ResponsiveContainer>
        </ScrollView>
      </SafeAreaView>
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
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  headerSpacer: {
    width: 40,
    height: 40,
  },
  content: {
    paddingHorizontal: 18,
    paddingBottom: 40,
    gap: 14,
  },
  heroCard: {
    borderRadius: 24,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 18,
    overflow: 'hidden',
    gap: 12,
  },
  heroBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  heroBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700' as const,
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 26,
    lineHeight: 31,
    fontWeight: '800' as const,
  },
  heroSubtitle: {
    color: 'rgba(241,245,249,0.92)',
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '500' as const,
  },
  quickStartCard: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 16,
    gap: 14,
  },
  quickStartHeader: {
    gap: 4,
  },
  quickStartTitle: {
    fontSize: 18,
    fontWeight: '800' as const,
    letterSpacing: -0.3,
  },
  quickStartSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500' as const,
  },
  quickStartList: {
    gap: 10,
  },
  quickStartRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  quickStartIndexWrap: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickStartIndexText: {
    fontSize: 13,
    fontWeight: '800' as const,
  },
  quickStartCopy: {
    flex: 1,
    gap: 3,
  },
  quickStartStepTitle: {
    fontSize: 15,
    fontWeight: '700' as const,
  },
  quickStartStepDescription: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500' as const,
  },
  groupList: {
    gap: 12,
  },
  groupCard: {
    borderRadius: 22,
    borderWidth: 1,
    overflow: 'hidden',
  },
  groupAccentBar: {
    height: 6,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  groupIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  groupTextWrap: {
    flex: 1,
    gap: 2,
  },
  groupTitle: {
    fontSize: 18,
    fontWeight: '800' as const,
  },
  groupSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500' as const,
  },
  groupMeta: {
    alignItems: 'flex-end',
    gap: 10,
  },
  countPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  countPillText: {
    fontSize: 11,
    fontWeight: '800' as const,
  },
  itemList: {
    paddingHorizontal: 12,
    paddingBottom: 12,
    gap: 10,
  },
  itemCard: {
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  itemIndexWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemIndexText: {
    fontSize: 12,
    fontWeight: '800' as const,
  },
  itemTextWrap: {
    flex: 1,
    gap: 3,
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: '700' as const,
  },
  itemSummary: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500' as const,
  },
  itemBody: {
    gap: 10,
    paddingHorizontal: 14,
    paddingBottom: 14,
  },
  bodyRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  bodyBullet: {
    width: 6,
    height: 6,
    borderRadius: 999,
    marginTop: 8,
  },
  bodyText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '500' as const,
  },
  supportCard: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  supportTitle: {
    fontSize: 18,
    fontWeight: '800' as const,
    letterSpacing: -0.3,
  },
  supportBody: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500' as const,
  },
  supportRows: {
    gap: 10,
  },
  supportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
  },
  supportIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  supportCopy: {
    flex: 1,
    gap: 3,
  },
  supportRowTitle: {
    fontSize: 15,
    fontWeight: '800' as const,
  },
  supportRowSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500' as const,
  },
  footer: {
    alignItems: 'center',
    marginTop: 6,
  },
  footerText: {
    fontSize: 12,
    fontWeight: '700' as const,
  },
});
