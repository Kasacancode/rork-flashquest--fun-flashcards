import { describe, it, expect, mock } from 'bun:test';

mock.module('lucide-react-native', () => ({
  Award: () => null,
  BookOpen: () => null,
  Crown: () => null,
  Flame: () => null,
  Zap: () => null,
}));

const { computeAchievements, ACHIEVEMENT_CATEGORIES } = await import('../achievements');
import type { UserStats } from '@/types/flashcard';

const DEFAULT_STATS: UserStats = {
  totalScore: 0,
  currentStreak: 0,
  longestStreak: 0,
  totalCardsStudied: 0,
  totalDecksCompleted: 0,
  achievements: [],
  lastActiveDate: '',
  totalCorrectAnswers: 0,
  totalQuestionsAttempted: 0,
  studyDates: [],
  totalStudySessions: 0,
  totalQuestSessions: 0,
  totalPracticeSessions: 0,
  totalArenaSessions: 0,
  totalArenaBattles: 0,
  totalStudyTimeMs: 0,
  weeklyAccuracy: [],
};

function makeInputs(
  overrides: Partial<UserStats> = {},
  extra: {
    leaderboardCount?: number;
    bestQuestStreak?: number;
    customDeckCount?: number;
    totalCardsOwned?: number;
  } = {},
) {
  return {
    stats: { ...DEFAULT_STATS, ...overrides },
    leaderboardCount: extra.leaderboardCount ?? 0,
    totalArenaBattles: extra.leaderboardCount ?? 0,
    bestQuestStreak: extra.bestQuestStreak ?? 0,
    customDeckCount: extra.customDeckCount ?? 0,
    totalCardsOwned: extra.totalCardsOwned ?? 0,
  };
}

describe('computeAchievements', () => {
  it('returns an array of achievements', () => {
    const achievements = computeAchievements(makeInputs());
    expect(achievements.length).toBeGreaterThan(0);
  });

  it('has 8 achievement categories', () => {
    expect(ACHIEVEMENT_CATEGORIES).toHaveLength(8);
  });

  it('marks First Steps as complete when 1 card studied', () => {
    const achievements = computeAchievements(makeInputs({ totalCardsStudied: 1 }));
    const firstSteps = achievements.find((achievement) => achievement.id === 'first_steps');
    expect(firstSteps).toBeDefined();
    expect(firstSteps!.progress).toBe(1);
    expect(firstSteps!.total).toBe(1);
  });

  it('shows partial progress for Study Machine', () => {
    const achievements = computeAchievements(makeInputs({ totalCardsStudied: 500 }));
    const studyMachine = achievements.find((achievement) => achievement.id === 'study_machine');
    expect(studyMachine).toBeDefined();
    expect(studyMachine!.progress).toBe(500);
    expect(studyMachine!.total).toBe(1000);
  });

  it('caps progress at total', () => {
    const achievements = computeAchievements(makeInputs({ totalCardsStudied: 99999 }));
    const firstSteps = achievements.find((achievement) => achievement.id === 'first_steps');
    expect(firstSteps!.progress).toBe(1);
  });

  it('tracks streak achievements from longestStreak', () => {
    const achievements = computeAchievements(makeInputs({ longestStreak: 7 }));
    const onFire = achievements.find((achievement) => achievement.id === 'on_fire');
    expect(onFire).toBeDefined();
    expect(onFire!.progress).toBe(7);
    expect(onFire!.total).toBe(7);
  });

  it('tracks arena achievements from battle count', () => {
    const achievements = computeAchievements(makeInputs({}, { leaderboardCount: 5 }));
    const arenaRegular = achievements.find((achievement) => achievement.id === 'arena_regular');
    expect(arenaRegular).toBeDefined();
    expect(arenaRegular!.progress).toBe(5);
  });

  it('tracks quest streak achievements', () => {
    const achievements = computeAchievements(makeInputs({}, { bestQuestStreak: 3 }));
    const sharpEye = achievements.find((achievement) => achievement.id === 'sharp_eye');
    expect(sharpEye).toBeDefined();
    expect(sharpEye!.progress).toBe(3);
  });

  it('tracks accuracy achievements from totalCorrectAnswers', () => {
    const achievements = computeAchievements(makeInputs({ totalCorrectAnswers: 100 }));
    const sharpshooter = achievements.find((achievement) => achievement.id === 'sharpshooter');
    expect(sharpshooter).toBeDefined();
    expect(sharpshooter!.progress).toBe(50);
  });

  it('returns 0 progress for all achievements with zero stats', () => {
    const achievements = computeAchievements(makeInputs());
    const allZero = achievements.every((achievement) => achievement.progress === 0);
    expect(allZero).toBe(true);
  });

  it('every achievement has a category from the valid list', () => {
    const achievements = computeAchievements(makeInputs());
    const validCategories = ACHIEVEMENT_CATEGORIES.map((category) => category.id);
    for (const achievement of achievements) {
      expect(validCategories).toContain(achievement.category);
    }
  });

  it('every achievement has positive XP', () => {
    const achievements = computeAchievements(makeInputs());
    for (const achievement of achievements) {
      expect(achievement.xp).toBeGreaterThan(0);
    }
  });
});
