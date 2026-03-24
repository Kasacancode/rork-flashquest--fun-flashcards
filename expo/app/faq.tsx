import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { ArrowLeft, ChevronDown, ChevronUp, BookOpen, Target, Swords, Zap, Trophy, Star, Flame, Sparkles } from 'lucide-react-native';
import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, LayoutAnimation, Platform, UIManager } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTheme } from '@/context/ThemeContext';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface FAQSection {
  id: string;
  icon: React.ReactNode;
  title: string;
  content: string[];
}

export default function FAQScreen() {
  const router = useRouter();
  const { theme, isDark } = useTheme();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const toggleSection = useCallback((id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedId(prev => prev === id ? null : id);
  }, []);

  const cardBg = isDark ? 'rgba(15,23,42,0.78)' : theme.cardBackground;
  const cardBorder = isDark ? 'rgba(148,163,184,0.14)' : 'transparent';
  const accentBg = isDark ? 'rgba(139,92,246,0.1)' : 'rgba(102,126,234,0.08)';

  const sections: FAQSection[] = [
    {
      id: 'creating-decks',
      icon: <Sparkles color={theme.primary} size={20} strokeWidth={2.2} />,
      title: 'Creating Your First Deck',
      content: [
        'Tap the Decks button on the home screen, then tap the + button in the top right to create a new deck.',
        'There are four ways to add cards:',
        '• Manual: Type questions and answers one by one. Use the "Paste" button to bulk-import from a list (one card per line, separated by | or ; or tab).',
        '• Scan Notes: Take a photo of handwritten or printed notes and AI will generate flashcards from the image.',
        '• Text to Deck: Paste any text (notes, articles, study guides) and AI will extract key concepts into flashcards.',
        '• Import: Copy a deck shared by a friend to your clipboard and use "Import from Clipboard."',
        'You can also start with one of the 5 built-in decks (World Capitals, Programming 101, Spanish Essentials, Space Facts, History Milestones) to see how things work.',
        'Cards can be reordered with the up/down arrows in the editor, and you can duplicate any deck from its hub screen.',
      ],
    },
    {
      id: 'deck-hub',
      icon: <BookOpen color={theme.primary} size={20} strokeWidth={2.2} />,
      title: 'Your Deck Hub',
      content: [
        'Tap a deck\'s name in your deck list to open its hub. This is your home base for each deck.',
        'The hub shows your mastery breakdown (how many cards are mastered, reviewing, learning, or new), your accuracy, cards due for review, and when you last studied.',
        'From here you can launch any study mode, drill weak cards, review due cards, or duplicate the deck.',
        'The Study button on the deck list still goes directly to study mode for quick access — the hub is for when you want the full picture.',
      ],
    },
    {
      id: 'study-mode',
      icon: <BookOpen color="#4ECDC4" size={20} strokeWidth={2.2} />,
      title: 'Study Mode',
      content: [
        'Study mode lets you flip through flashcards at your own pace. Tap the card to reveal the answer, then swipe up to move to the next card.',
        'Swipe left for a hint (if available). Swipe right after revealing to see an explanation.',
        'If a card doesn\'t have a hint or explanation, you can generate one with AI by tapping the button in the overlay.',
        'You earn 2 XP per card studied. Study mode doesn\'t quiz you — it\'s for reviewing and getting familiar with the material.',
      ],
    },
    {
      id: 'quest-mode',
      icon: <Target color={theme.primary} size={20} strokeWidth={2.2} />,
      title: 'Quest Mode',
      content: [
        'Quest is a multiple-choice quiz. You\'re shown a question with 4 answer cards — tap the correct one to earn points.',
        'There are two modes: Learn (hints on, no timer, lower points) and Test (no hints, timer on, higher points).',
        'You can set the number of cards per round (5, 10, or 20) and choose to focus on weak cards you\'ve gotten wrong before.',
        'Points are based on speed and accuracy. Your quest score is converted to XP at a 0.4x rate.',
        'After finishing, you can drill any cards you missed to reinforce what you got wrong.',
      ],
    },
    {
      id: 'practice-ai',
      icon: <Swords color={theme.primary} size={20} strokeWidth={2.2} />,
      title: 'Practice vs AI',
      content: [
        'Practice mode is a head-to-head match against an AI opponent. You both answer the same questions and the higher score wins.',
        'The AI adapts to your performance — if you\'re winning, it gets slightly harder. If you\'re losing, it eases up to keep matches competitive.',
        'You earn 30–70 XP for a win (based on accuracy) and 10–30 XP for a loss.',
        'Each match is 5 rounds. The AI has a random name each time you play.',
      ],
    },
    {
      id: 'battle-arena',
      icon: <Zap color="#F59E0B" size={20} strokeWidth={2.2} />,
      title: 'Battle Arena (Multiplayer)',
      content: [
        'Battle is a real-time multiplayer mode. One player creates a room and shares the room code; the other joins with that code.',
        'The host picks the deck, number of rounds, and timer settings in the lobby before starting.',
        'Both players see the same question simultaneously. Answer fast and accurately to score more points.',
        'Battle results can be saved to your leaderboard and shared with friends.',
        'XP is awarded based on your accuracy, the number of questions, and whether you won.',
      ],
    },
    {
      id: 'mastery',
      icon: <Star color="#10B981" size={20} strokeWidth={2.2} />,
      title: 'Card Mastery & Spaced Repetition',
      content: [
        'Every card has a mastery status based on your correct answer streak in Quest mode:',
        '• New: Never attempted',
        '• Learning: 1–2 correct answers in a row',
        '• Reviewing: 3–4 correct in a row',
        '• Mastered: 5+ correct in a row',
        'Getting a card wrong resets its streak to zero.',
        'FlashQuest uses spaced repetition to schedule reviews. After answering correctly, the next review is scheduled at increasing intervals: 1 day → 3 days → 7 days → 14 days → 30 days.',
        'Your deck hub shows how many cards are due for review. Studying due cards at the right time is the most effective way to retain information long-term.',
        'When you master every card in a deck, you\'ll get a special celebration and the deck gets a gold border.',
      ],
    },
    {
      id: 'xp-levels',
      icon: <Trophy color={theme.primary} size={20} strokeWidth={2.2} />,
      title: 'XP & Levels',
      content: [
        'Every mode earns XP: Study (2 per card), Quest (score × 0.4), Practice (30–70 for win, 10–30 for loss), Battle (varies by accuracy and rounds).',
        'XP goes toward your level. There are 20 levels from Rookie Explorer (Level 1) to Legend of the Deck (Level 20).',
        'Each level requires about 35% more XP than the last. You\'ll see a progress bar on your profile and the stats page.',
        'Leveling up triggers a gold celebration toast.',
      ],
    },
    {
      id: 'achievements',
      icon: <Trophy color="#F59E0B" size={20} strokeWidth={2.2} />,
      title: 'Achievements',
      content: [
        'There are 35 achievements across 8 categories: Study, Streaks, XP, Battle, Quest, Accuracy, Building, and Collection.',
        'Achievements unlock automatically as you hit milestones — study a certain number of cards, maintain a streak, create decks, win battles, and more.',
        'Each achievement awards bonus XP. Check your progress in the Awards tab on your profile.',
        'You\'ll see a toast notification the moment you unlock one.',
      ],
    },
    {
      id: 'streaks',
      icon: <Flame color="#FF6B6B" size={20} strokeWidth={2.2} />,
      title: 'Streaks & Daily Activity',
      content: [
        'Your streak counts how many days in a row you\'ve used FlashQuest. Any activity counts — Study, Quest, Practice, or Battle.',
        'Your current and longest streak are shown on the stats page and your profile.',
        'FlashQuest sends a daily reminder notification to help you keep your streak alive.',
        'Streak achievements unlock at 3, 7, 14, 30, and 60 days.',
      ],
    },
    {
      id: 'sharing',
      icon: <Sparkles color={theme.primary} size={20} strokeWidth={2.2} />,
      title: 'Sharing & Importing Decks',
      content: [
        'To share a deck: Open it in the editor (tap Edit on the deck card), then tap the share icon in the header. The deck is copied to your clipboard as a special code.',
        'To import: On the deck list, tap the + button and choose "Import from Clipboard." Paste the code a friend shared with you.',
        'Shared decks include all questions, answers, hints, and explanations.',
      ],
    },
    {
      id: 'stats',
      icon: <Target color={theme.primary} size={20} strokeWidth={2.2} />,
      title: 'Stats & Progress Tracking',
      content: [
        'The Stats screen (accessible from the home screen) shows your complete learning overview.',
        'It includes your level and XP progress, weekly activity summary, a 7-week study calendar, mastery overview across all decks, performance breakdown by mode, accuracy trends, and per-deck progress.',
        'The study calendar uses color intensity to show how active you were each day — darker squares mean more activity.',
        'All your data is stored locally on your device.',
      ],
    },
  ];

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[theme.gradientStart, theme.gradientMid, theme.gradientEnd]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {isDark && (
        <LinearGradient
          colors={['rgba(6,10,22,0.06)', 'rgba(6,10,22,0.34)', 'rgba(5,8,20,0.76)']}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.95, y: 1 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      )}
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <ArrowLeft color="#fff" size={24} strokeWidth={2.5} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Help & FAQ</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={[styles.intro, { color: theme.textSecondary }]}>
            Everything you need to know about FlashQuest.
          </Text>

          {sections.map((section) => {
            const isExpanded = expandedId === section.id;
            return (
              <View
                key={section.id}
                style={[
                  styles.section,
                  {
                    backgroundColor: cardBg,
                    borderColor: isExpanded ? theme.primary : cardBorder,
                    borderWidth: isExpanded ? 1.5 : (isDark ? 1 : 0),
                  },
                ]}
              >
                <TouchableOpacity
                  style={styles.sectionHeader}
                  onPress={() => toggleSection(section.id)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.sectionIconWrap, { backgroundColor: accentBg }]}>
                    {section.icon}
                  </View>
                  <Text style={[styles.sectionTitle, { color: theme.text }]}>{section.title}</Text>
                  {isExpanded
                    ? <ChevronUp color={theme.primary} size={20} strokeWidth={2.2} />
                    : <ChevronDown color={theme.textSecondary} size={20} strokeWidth={2.2} />
                  }
                </TouchableOpacity>

                {isExpanded && (
                  <View style={styles.sectionBody}>
                    {section.content.map((paragraph, i) => (
                      <Text
                        key={`${section.id}-${i}`}
                        style={[
                          styles.sectionText,
                          { color: theme.textSecondary },
                          paragraph.startsWith('•') && styles.bulletText,
                        ]}
                      >
                        {paragraph}
                      </Text>
                    ))}
                  </View>
                )}
              </View>
            );
          })}

          <View style={styles.footer}>
            <Text style={[styles.footerText, { color: theme.textTertiary }]}>
              FlashQuest v1.0
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16 },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 20, fontWeight: '700', color: '#fff' },
  content: { padding: 20, paddingBottom: 40, gap: 10 },
  intro: { fontSize: 14, fontWeight: '500', textAlign: 'center', marginBottom: 10 },
  section: { borderRadius: 16, overflow: 'hidden' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  sectionIconWrap: { width: 36, height: 36, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  sectionTitle: { flex: 1, fontSize: 16, fontWeight: '700' },
  sectionBody: { paddingHorizontal: 16, paddingBottom: 16, gap: 10 },
  sectionText: { fontSize: 14, fontWeight: '500', lineHeight: 21 },
  bulletText: { paddingLeft: 8 },
  footer: { alignItems: 'center', marginTop: 20 },
  footerText: { fontSize: 12, fontWeight: '500' },
});
