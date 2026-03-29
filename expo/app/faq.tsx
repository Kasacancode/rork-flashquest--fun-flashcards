import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { ArrowLeft, BookOpen, ChevronDown, ChevronUp, Mail, ShieldCheck, Sparkles, Target, Trophy } from 'lucide-react-native';
import React, { useCallback, useMemo, useState } from 'react';
import { LayoutAnimation, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, UIManager, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PRIVACY_LINKS } from '@/constants/privacy';
import { useTheme } from '@/context/ThemeContext';
import { logger } from '@/utils/logger';
import { DATA_PRIVACY_ROUTE } from '@/utils/routes';
import { openSupportContact } from '@/utils/support';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type FAQGroupId = 'getting-started' | 'study-modes' | 'progress-review';

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

const FAQ_GROUPS: readonly FAQGroup[] = [
  {
    id: 'getting-started',
    title: 'Getting Started',
    subtitle: 'Deck setup, your hub, and sharing basics.',
    items: [
      {
        id: 'creating-decks',
        title: 'Creating your first deck',
        summary: 'Start from scratch, paste notes, scan content, or import a shared deck.',
        content: [
          'Open Decks from the home screen, then tap the + button in the top right to create a deck.',
          'You can build cards four ways: Manual entry, Scan Notes, Text to Deck, or Import from Clipboard.',
          'Paste supports bulk import from lists using one card per line, separated by |, ;, or a tab.',
          'If you want a quick example, start with one of the built-in decks to see how FlashQuest is structured.',
          'Inside the editor you can reorder cards, clean up wording, and duplicate a deck later from its hub.',
        ],
      },
      {
        id: 'deck-hub',
        title: 'Understanding the deck hub',
        summary: 'Your deck hub is the control center for progress, review, and quick actions.',
        content: [
          'Tap a deck name from your deck list to open its hub. This is the main home base for that deck.',
          'The hub shows card status counts, accuracy, cards due for review, recent study activity, and your deck-level progress at a glance.',
          'From here you can jump into Study, Quest, Practice, Drill Weak Cards, or review cards that are actually due.',
          'The deck list still keeps a faster direct-study shortcut when you just want to start immediately.',
        ],
      },
      {
        id: 'sharing',
        title: 'Sharing and importing decks',
        summary: 'Move decks between friends without rebuilding them by hand.',
        content: [
          'To share a deck, open it in the editor and tap the share icon in the header. FlashQuest copies a shareable deck code to your clipboard.',
          'To import, tap the + button from the deck list and choose Import from Clipboard.',
          'Shared decks can include the full card set, including hints and explanations when those exist.',
        ],
      },
    ],
  },
  {
    id: 'study-modes',
    title: 'Study Modes',
    subtitle: 'How each mode works and when to use it.',
    items: [
      {
        id: 'study-mode',
        title: 'Study mode',
        summary: 'Best for calm review, familiarization, and confidence-based refreshers.',
        content: [
          'Study mode lets you flip through cards at your own pace. Tap to reveal the answer, swipe up for the next card, swipe left for a hint, and swipe right for an explanation.',
          'If a card is missing a hint or explanation, you can generate one with AI from the overlay action.',
          'After review, you can optionally rate how the card felt with Easy, Okay, Hard, or Forgot. If you ignore it, FlashQuest still keeps the session moving.',
          'Study mode is designed to feel lightweight, so it improves your review data without turning each card into a quiz ritual.',
        ],
      },
      {
        id: 'quest-mode',
        title: 'Quest mode',
        summary: 'Fast multiple-choice runs for speed, accuracy, and XP.',
        content: [
          'Quest is FlashQuest’s multiple-choice mode. Each question shows four answer cards and you tap the correct one as quickly as you can.',
          'Learn mode is more forgiving, while Test mode is tighter and more score-focused.',
          'You can choose round length, timer pressure, and whether to focus on weak cards.',
          'Quest stays fast on purpose, so confidence grading is mostly inferred behind the scenes instead of interrupting every answer.',
          'Your quest score converts into XP, and missed cards can be drilled afterward for recovery.',
        ],
      },
      {
        id: 'practice-ai',
        title: 'Practice vs AI',
        summary: 'Head-to-head pressure with a smarter review layer after each round.',
        content: [
          'Practice mode matches you against an AI opponent answering the same questions.',
          'The AI adapts to your performance to keep the match competitive rather than flat or predictable.',
          'After a correct answer, you can quickly mark Easy, Okay, or Hard to sharpen future review timing. Incorrect answers are treated as forgot automatically.',
          'Wins award more XP, but even losses still contribute progress and review data.',
        ],
      },
      {
        id: 'battle-arena',
        title: 'Battle Arena multiplayer',
        summary: 'Real-time deck battles with shared questions and room codes.',
        content: [
          'One player creates a room and shares the room code. The other joins using that code.',
          'The host controls the lobby setup, including deck choice, round count, and timer settings.',
          'Both players see the same question at the same time, so speed and accuracy both matter.',
          'Battle results can feed into leaderboard-style competition and award XP based on performance.',
        ],
      },
    ],
  },
  {
    id: 'progress-review',
    title: 'Progress & Review',
    subtitle: 'Mastery, due cards, XP, streaks, and long-term growth.',
    items: [
      {
        id: 'mastery',
        title: 'Card mastery and smart review',
        summary: 'FlashQuest tracks learning, forgetting, and review strength more intelligently now.',
        content: [
          'FlashQuest uses a lightweight memory model for each card instead of relying on a single simple streak.',
          'Cards can fall into five statuses: New, Learning, Reviewing, Mastered, and Lapsed.',
          'New means you have barely engaged with the card. Learning means the memory is still unstable. Reviewing means the card is in active spaced review. Mastered means it has held up across longer intervals. Lapsed means you used to know it, but it slipped and needs recovery.',
          'Review timing is based on memory strength and timing, not just raw streak count, so due cards and weak cards are more meaningful.',
          'Drill Weak Cards prioritizes genuinely vulnerable cards, especially lapsed cards, hard cards, low-recall cards, and repeated misses.',
        ],
      },
      {
        id: 'xp-levels',
        title: 'XP and levels',
        summary: 'Progression ties together all your study activity without getting in the way.',
        content: [
          'Every main mode earns XP, including Study, Quest, Practice, and Battle.',
          'XP builds toward your level, and the app uses level progression to make your stats and profile feel more rewarding over time.',
          'You can track level progress from the profile and stats areas without needing to manage anything manually.',
        ],
      },
      {
        id: 'achievements',
        title: 'Achievements',
        summary: 'Extra milestones for consistency, wins, deck building, and collection growth.',
        content: [
          'Achievements unlock automatically when you hit built-in milestones across study, streaks, XP, questing, battles, accuracy, deck creation, and collection growth.',
          'Each achievement awards bonus XP and appears in the Awards area on your profile.',
          'They are designed as passive rewards, so you do not need to opt in or micromanage them.',
        ],
      },
      {
        id: 'streaks',
        title: 'Streaks and daily activity',
        summary: 'Consistency matters, but FlashQuest keeps it lightweight.',
        content: [
          'Your streak counts how many days in a row you have used FlashQuest with any real activity, including Study, Quest, Practice, or Battle.',
          'Current and longest streaks appear in your profile and stats views.',
          'Daily reminders can help protect your streak without turning the app into a nagging system.',
        ],
      },
      {
        id: 'stats',
        title: 'Stats and progress tracking',
        summary: 'A cleaner big-picture view of how you are improving across decks and modes.',
        content: [
          'The Stats screen brings together your level progress, study history, activity calendar, mode performance, and deck-level progress in one place.',
          'Mastery counts and due-for-review sections are powered by the smarter card memory system, so they are meant to reflect real learning state rather than shallow streak math.',
          'Most deck data, progress, and settings stay on your device. Some features, including AI tools, multiplayer, and optional analytics, use remote services when you choose to use them.',
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
          <Text style={styles.headerTitle}>Help & FAQ</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
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
            <Text style={styles.heroTitle}>Everything you need to know about FlashQuest</Text>
            <Text style={styles.heroSubtitle}>
              Browse the main sections to understand decks, study modes, mastery, and progress at a glance.
            </Text>
          </LinearGradient>

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
            <Text style={[styles.supportTitle, { color: theme.text }]}>Need help?</Text>
            <Text style={[styles.supportBody, { color: theme.textSecondary }]}>Open the FlashQuest support page or head to Data & Privacy for privacy and legal details.</Text>

            <TouchableOpacity style={[styles.supportRow, { borderColor: nestedCardBorder, backgroundColor: nestedCardBg }]} onPress={() => void openSupportContact()} activeOpacity={0.82} testID="faq-open-support-contact">
              <View style={[styles.supportIconWrap, { backgroundColor: isDark ? 'rgba(59,130,246,0.16)' : 'rgba(59,130,246,0.1)' }]}>
                <Mail color="#3B82F6" size={18} strokeWidth={2.2} />
              </View>
              <View style={styles.supportCopy}>
                <Text style={[styles.supportRowTitle, { color: theme.text }]}>Support</Text>
                <Text style={[styles.supportRowSubtitle, { color: theme.textSecondary }]}>{`Support: ${PRIVACY_LINKS.supportEmail}`}</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.supportRow, { borderColor: nestedCardBorder, backgroundColor: nestedCardBg }]} onPress={() => router.push(DATA_PRIVACY_ROUTE)} activeOpacity={0.82} testID="faq-open-data-privacy">
              <View style={[styles.supportIconWrap, { backgroundColor: isDark ? 'rgba(16,185,129,0.16)' : 'rgba(16,185,129,0.1)' }]}>
                <ShieldCheck color="#10B981" size={18} strokeWidth={2.2} />
              </View>
              <View style={styles.supportCopy}>
                <Text style={[styles.supportRowTitle, { color: theme.text }]}>Data & Privacy</Text>
                <Text style={[styles.supportRowSubtitle, { color: theme.textSecondary }]}>{`Privacy: ${PRIVACY_LINKS.privacyEmail}`}</Text>
              </View>
            </TouchableOpacity>
          </View>

          <View style={styles.footer}>
            <Text style={[styles.footerText, { color: isDark ? 'rgba(226,232,240,0.72)' : 'rgba(255,255,255,0.86)' }]}>FlashQuest guide</Text>
          </View>
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
