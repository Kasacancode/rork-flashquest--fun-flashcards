import type { ComponentType } from 'react';

import { Award, BookOpen, Crown, Flame, Zap } from 'lucide-react-native';

import type { UserStats } from '@/types/flashcard';

export const ACHIEVEMENT_CATEGORIES = [
  { id: 'study', label: '📚 Study' },
  { id: 'streaks', label: '🔥 Streaks' },
  { id: 'xp', label: '⭐ XP' },
  { id: 'battle', label: '⚔️ Battle' },
  { id: 'quest', label: '🎯 Quest' },
  { id: 'accuracy', label: '✅ Accuracy' },
  { id: 'building', label: '🛠️ Building' },
  { id: 'collection', label: '📦 Collection' },
] as const;

export type AchievementCategoryId = (typeof ACHIEVEMENT_CATEGORIES)[number]['id'];
export type AchievementCategory = (typeof ACHIEVEMENT_CATEGORIES)[number];

type IconComponent = ComponentType<{
  color?: string;
  size?: number;
  strokeWidth?: number;
}>;

export interface AchievementItem {
  id: string;
  name: string;
  description: string;
  xp: number;
  progress: number;
  total: number;
  color: string;
  icon: IconComponent;
  category: AchievementCategoryId;
}

export interface AchievementInputs {
  stats: UserStats;
  leaderboardCount: number;
  totalArenaBattles: number;
  bestQuestStreak: number;
  customDeckCount: number;
  totalCardsOwned: number;
}

export function computeAchievements(inputs: AchievementInputs): AchievementItem[] {
  const { stats, leaderboardCount, totalArenaBattles, bestQuestStreak, customDeckCount, totalCardsOwned } = inputs;
  const arenaBattleCount = totalArenaBattles || leaderboardCount;

  return [
    { id: 'first_steps', name: 'First Steps', description: 'Study your first flashcard', xp: 25, progress: Math.min(stats.totalCardsStudied, 1), total: 1, color: '#4ECDC4', icon: BookOpen, category: 'study' },
    { id: 'getting_the_hang', name: 'Getting the Hang of It', description: 'Study 50 flashcards', xp: 75, progress: Math.min(stats.totalCardsStudied, 50), total: 50, color: '#4ECDC4', icon: BookOpen, category: 'study' },
    { id: 'card_cruncher', name: 'Card Cruncher', description: 'Study 250 flashcards', xp: 150, progress: Math.min(stats.totalCardsStudied, 250), total: 250, color: '#4ECDC4', icon: BookOpen, category: 'study' },
    { id: 'study_machine', name: 'Study Machine', description: 'Study 1,000 flashcards', xp: 400, progress: Math.min(stats.totalCardsStudied, 1000), total: 1000, color: '#4ECDC4', icon: BookOpen, category: 'study' },
    { id: 'knowledge_titan', name: 'Knowledge Titan', description: 'Study 5,000 flashcards', xp: 1000, progress: Math.min(stats.totalCardsStudied, 5000), total: 5000, color: '#4ECDC4', icon: BookOpen, category: 'study' },

    { id: 'warming_up', name: 'Warming Up', description: 'Maintain a 3-day study streak', xp: 50, progress: Math.min(stats.longestStreak, 3), total: 3, color: '#FF6B6B', icon: Flame, category: 'streaks' },
    { id: 'on_fire', name: 'On Fire', description: 'Maintain a 7-day study streak', xp: 150, progress: Math.min(stats.longestStreak, 7), total: 7, color: '#F97316', icon: Flame, category: 'streaks' },
    { id: 'unstoppable', name: 'Unstoppable', description: 'Maintain a 14-day study streak', xp: 400, progress: Math.min(stats.longestStreak, 14), total: 14, color: '#EF4444', icon: Flame, category: 'streaks' },
    { id: 'iron_discipline', name: 'Iron Discipline', description: 'Maintain a 30-day study streak', xp: 800, progress: Math.min(stats.longestStreak, 30), total: 30, color: '#DC2626', icon: Flame, category: 'streaks' },
    { id: 'streak_legend', name: 'Streak Legend', description: 'Maintain a 60-day study streak', xp: 2000, progress: Math.min(stats.longestStreak, 60), total: 60, color: '#B91C1C', icon: Flame, category: 'streaks' },

    { id: 'rising_star', name: 'Rising Star', description: 'Earn 500 total XP', xp: 50, progress: Math.min(stats.totalScore, 500), total: 500, color: '#F093FB', icon: Crown, category: 'xp' },
    { id: 'xp_hunter', name: 'XP Hunter', description: 'Earn 2,500 total XP', xp: 150, progress: Math.min(stats.totalScore, 2500), total: 2500, color: '#D946EF', icon: Crown, category: 'xp' },
    { id: 'point_machine', name: 'Point Machine', description: 'Earn 10,000 total XP', xp: 400, progress: Math.min(stats.totalScore, 10000), total: 10000, color: '#A855F7', icon: Crown, category: 'xp' },
    { id: 'xp_legend', name: 'XP Legend', description: 'Earn 50,000 total XP', xp: 1000, progress: Math.min(stats.totalScore, 50000), total: 50000, color: '#7C3AED', icon: Crown, category: 'xp' },

    { id: 'battle_ready', name: 'Battle Ready', description: 'Complete your first arena battle', xp: 50, progress: Math.min(arenaBattleCount, 1), total: 1, color: '#F59E0B', icon: Award, category: 'battle' },
    { id: 'arena_regular', name: 'Arena Regular', description: 'Complete 5 arena battles', xp: 100, progress: Math.min(arenaBattleCount, 5), total: 5, color: '#F59E0B', icon: Award, category: 'battle' },
    { id: 'battle_hardened', name: 'Battle Hardened', description: 'Complete 25 arena battles', xp: 300, progress: Math.min(arenaBattleCount, 25), total: 25, color: '#D97706', icon: Award, category: 'battle' },
    { id: 'arena_veteran', name: 'Arena Veteran', description: 'Complete 50 arena battles', xp: 750, progress: Math.min(arenaBattleCount, 50), total: 50, color: '#B45309', icon: Award, category: 'battle' },

    { id: 'sharp_eye', name: 'Sharp Eye', description: 'Get a 3-answer streak in Quest mode', xp: 50, progress: Math.min(bestQuestStreak, 3), total: 3, color: '#6366F1', icon: Zap, category: 'quest' },
    { id: 'hot_hands', name: 'Hot Hands', description: 'Get a 7-answer streak in Quest mode', xp: 150, progress: Math.min(bestQuestStreak, 7), total: 7, color: '#6366F1', icon: Zap, category: 'quest' },
    { id: 'flawless_run', name: 'Flawless Run', description: 'Get a 12-answer streak in Quest mode', xp: 400, progress: Math.min(bestQuestStreak, 12), total: 12, color: '#4F46E5', icon: Zap, category: 'quest' },
    { id: 'perfect_mind', name: 'Perfect Mind', description: 'Get a 20-answer streak in Quest mode', xp: 1000, progress: Math.min(bestQuestStreak, 20), total: 20, color: '#4338CA', icon: Zap, category: 'quest' },

    { id: 'sharpshooter', name: 'Sharpshooter', description: 'Answer 50 questions correctly', xp: 50, progress: Math.min(stats.totalCorrectAnswers ?? 0, 50), total: 50, color: '#10B981', icon: Zap, category: 'accuracy' },
    { id: 'precision_player', name: 'Precision Player', description: 'Answer 250 questions correctly', xp: 150, progress: Math.min(stats.totalCorrectAnswers ?? 0, 250), total: 250, color: '#059669', icon: Zap, category: 'accuracy' },
    { id: 'eagle_eye', name: 'Eagle Eye', description: 'Answer 1,000 questions correctly', xp: 400, progress: Math.min(stats.totalCorrectAnswers ?? 0, 1000), total: 1000, color: '#047857', icon: Zap, category: 'accuracy' },
    { id: 'answer_machine', name: 'Answer Machine', description: 'Attempt 500 questions', xp: 100, progress: Math.min(stats.totalQuestionsAttempted ?? 0, 500), total: 500, color: '#0EA5E9', icon: Award, category: 'accuracy' },
    { id: 'quiz_marathon', name: 'Quiz Marathon', description: 'Attempt 2,000 questions', xp: 500, progress: Math.min(stats.totalQuestionsAttempted ?? 0, 2000), total: 2000, color: '#0284C7', icon: Award, category: 'accuracy' },

    { id: 'deck_creator', name: 'Deck Creator', description: 'Create your first custom deck', xp: 50, progress: Math.min(customDeckCount, 1), total: 1, color: '#14B8A6', icon: BookOpen, category: 'building' },
    { id: 'deck_architect', name: 'Deck Architect', description: 'Create 3 custom decks', xp: 100, progress: Math.min(customDeckCount, 3), total: 3, color: '#0D9488', icon: BookOpen, category: 'building' },
    { id: 'deck_factory', name: 'Deck Factory', description: 'Create 10 custom decks', xp: 300, progress: Math.min(customDeckCount, 10), total: 10, color: '#0F766E', icon: BookOpen, category: 'building' },

    { id: 'starter_pack', name: 'Starter Pack', description: 'Own 25 flashcards across all decks', xp: 25, progress: Math.min(totalCardsOwned, 25), total: 25, color: '#667EEA', icon: BookOpen, category: 'collection' },
    { id: 'growing_library', name: 'Growing Library', description: 'Own 100 flashcards', xp: 75, progress: Math.min(totalCardsOwned, 100), total: 100, color: '#667EEA', icon: BookOpen, category: 'collection' },
    { id: 'card_hoarder', name: 'Card Hoarder', description: 'Own 250 flashcards', xp: 200, progress: Math.min(totalCardsOwned, 250), total: 250, color: '#4F46E5', icon: BookOpen, category: 'collection' },
    { id: 'master_collector', name: 'Master Collector', description: 'Own 500 flashcards', xp: 400, progress: Math.min(totalCardsOwned, 500), total: 500, color: '#4338CA', icon: BookOpen, category: 'collection' },
    { id: 'living_encyclopedia', name: 'Living Encyclopedia', description: 'Own 1,000 flashcards', xp: 1000, progress: Math.min(totalCardsOwned, 1000), total: 1000, color: '#3730A3', icon: BookOpen, category: 'collection' },
  ];
}
