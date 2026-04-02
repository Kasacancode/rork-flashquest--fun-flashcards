import type { ArenaLeaderboardEntry } from '@/types/arena';
import type { Deck, UserStats } from '@/types/flashcard';
import type { CardStats } from '@/types/performance';
import { getDeckMasteryOverview, getDeckProgressSummaries, type DeckProgressSummary } from '@/utils/deckSelectors';

export interface CalendarDayData {
  date: string;
  count: number;
  dayOfWeek: number;
  monthLabel?: string;
}

export interface WeeklySummary {
  thisWeekDays: number;
  comparison: string;
  currentWeekAccuracy: number | null;
}

export interface AccuracyTrendEntry {
  week: string;
  accuracy: number | null;
}

export interface ArenaStatsSummary {
  wins: number;
  total: number;
  winRate: number;
}

export interface WeeklyRecap {
  cardsStudied: number;
  accuracy: number | null;
  daysActive: number;
  sessionsCompleted: number;
  comparedToLastWeek: 'better' | 'same' | 'worse' | 'first_week';
  lastWeekCards: number;
}

export function getIsoWeekString(date: Date): string {
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  normalized.setDate(normalized.getDate() + 3 - ((normalized.getDay() + 6) % 7));
  const week1 = new Date(normalized.getFullYear(), 0, 4);
  const weekNum = 1 + Math.round(
    ((normalized.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7,
  );

  return `${normalized.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

function getRecentWeekKeys(count: number): string[] {
  const keys: string[] = [];
  const today = new Date();

  for (let index = count - 1; index >= 0; index -= 1) {
    const date = new Date(today);
    date.setDate(date.getDate() - index * 7);
    keys.push(getIsoWeekString(date));
  }

  return keys;
}

export function getStatsCalendarDays(studyDates: string[], lookbackDays: number = 49): CalendarDayData[] {
  const today = new Date();
  const dateCount: Record<string, number> = {};

  for (const date of studyDates) {
    dateCount[date] = (dateCount[date] ?? 0) + 1;
  }

  const days: CalendarDayData[] = [];

  for (let index = lookbackDays - 1; index >= 0; index -= 1) {
    const date = new Date(today);
    date.setDate(date.getDate() - index);
    const dateKey = date.toISOString().slice(0, 10);
    const dayOfWeek = date.getDay() === 0 ? 6 : date.getDay() - 1;
    const isFirstOfMonth = date.getDate() <= 7 && dayOfWeek === 0;

    days.push({
      date: dateKey,
      count: dateCount[dateKey] ?? 0,
      dayOfWeek,
      monthLabel: isFirstOfMonth ? date.toLocaleDateString('en-US', { month: 'short' }) : undefined,
    });
  }

  return days;
}

export function getStatsCalendarColumns(days: CalendarDayData[]): CalendarDayData[][] {
  return Array.from({ length: Math.ceil(days.length / 7) }, (_, weekIndex) => {
    return days.slice(weekIndex * 7, weekIndex * 7 + 7);
  });
}

export function getWeeklySummary(stats: UserStats): WeeklySummary {
  const studySet = new Set(stats.studyDates ?? []);
  const today = new Date();
  const todayKey = today.toISOString().slice(0, 10);

  if (stats.lastActiveDate === todayKey) {
    studySet.add(todayKey);
  }

  const dayOfWeek = today.getDay();
  const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

  let thisWeekDays = 0;
  for (let index = 0; index <= mondayOffset; index += 1) {
    const date = new Date(today);
    date.setDate(date.getDate() - index);
    if (studySet.has(date.toISOString().slice(0, 10))) {
      thisWeekDays += 1;
    }
  }

  if (stats.currentStreak > 0 && thisWeekDays === 0) {
    thisWeekDays = 1;
  }

  let lastWeekDays = 0;
  for (let index = mondayOffset + 1; index <= mondayOffset + 7; index += 1) {
    const date = new Date(today);
    date.setDate(date.getDate() - index);
    if (studySet.has(date.toISOString().slice(0, 10))) {
      lastWeekDays += 1;
    }
  }

  const comparison = thisWeekDays > lastWeekDays
    ? `${thisWeekDays - lastWeekDays} more than last week`
    : thisWeekDays < lastWeekDays
      ? `${lastWeekDays - thisWeekDays} fewer than last week`
      : lastWeekDays === 0
        ? 'Start your week strong!'
        : 'Same as last week';

  const weeklyMap = new Map((stats.weeklyAccuracy ?? []).map((entry) => [entry.week, entry]));
  const currentWeekEntry = weeklyMap.get(getIsoWeekString(today));
  const currentWeekAccuracy = currentWeekEntry && currentWeekEntry.attempted > 0
    ? Math.round((currentWeekEntry.correct / currentWeekEntry.attempted) * 100)
    : null;

  return { thisWeekDays, comparison, currentWeekAccuracy };
}

export function getWeeklyRecap(stats: UserStats, cardStatsById: Record<string, unknown>): WeeklyRecap {
  void cardStatsById;

  const today = new Date();
  const todayKey = today.toISOString().slice(0, 10);
  const currentWeek = getIsoWeekString(today);
  const lastWeekDate = new Date(today);
  lastWeekDate.setDate(lastWeekDate.getDate() - 7);
  const lastWeek = getIsoWeekString(lastWeekDate);

  const weeklyEntries = stats.weeklyAccuracy ?? [];
  const currentEntry = weeklyEntries.find((entry) => entry.week === currentWeek);
  const lastEntry = weeklyEntries.find((entry) => entry.week === lastWeek);

  const cardsStudied = currentEntry?.attempted ?? 0;
  const accuracy = currentEntry && currentEntry.attempted > 0
    ? currentEntry.correct / currentEntry.attempted
    : null;

  const studySet = new Set(stats.studyDates ?? []);
  if (stats.lastActiveDate === todayKey) {
    studySet.add(todayKey);
  }

  const dayOfWeek = today.getDay();
  const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  let daysActive = 0;
  for (let index = 0; index <= mondayOffset; index += 1) {
    const date = new Date(today);
    date.setDate(date.getDate() - index);
    if (studySet.has(date.toISOString().slice(0, 10))) {
      daysActive += 1;
    }
  }

  const sessionsCompleted =
    (stats.totalStudySessions ?? 0)
    + (stats.totalQuestSessions ?? 0)
    + (stats.totalPracticeSessions ?? 0)
    + (stats.totalArenaSessions ?? 0);

  const lastWeekCards = lastEntry?.attempted ?? 0;
  let comparedToLastWeek: WeeklyRecap['comparedToLastWeek'];
  if (!lastEntry) {
    comparedToLastWeek = 'first_week';
  } else if (cardsStudied > lastWeekCards) {
    comparedToLastWeek = 'better';
  } else if (cardsStudied === lastWeekCards) {
    comparedToLastWeek = 'same';
  } else {
    comparedToLastWeek = 'worse';
  }

  return {
    cardsStudied,
    accuracy,
    daysActive,
    sessionsCompleted,
    comparedToLastWeek,
    lastWeekCards,
  };
}

export function getLifetimeAccuracy(stats: UserStats): number | null {
  const attempted = stats.totalQuestionsAttempted ?? 0;
  const correct = stats.totalCorrectAnswers ?? 0;
  return attempted > 0 ? Math.round((correct / attempted) * 100) : null;
}

export function getDisplaySessions(stats: UserStats): {
  study: number;
  quest: number;
  practice: number;
  arena: number;
  estimated: boolean;
} {
  const study = stats.totalStudySessions ?? 0;
  const quest = stats.totalQuestSessions ?? 0;
  const practice = stats.totalPracticeSessions ?? 0;
  const arena = stats.totalArenaSessions ?? 0;

  const hasPreTrackingData = (study + quest + practice + arena) === 0 && stats.totalCardsStudied > 0;

  if (!hasPreTrackingData) {
    return { study, quest, practice, arena, estimated: false };
  }

  return {
    study: stats.studyDates?.length ?? 0,
    quest: (stats.totalQuestionsAttempted ?? 0) > 0 ? Math.max(1, Math.round((stats.totalQuestionsAttempted ?? 0) / 10)) : 0,
    practice: 0,
    arena: 0,
    estimated: true,
  };
}

export function formatStudyTime(totalStudyTimeMs: number | undefined): string {
  const ms = totalStudyTimeMs ?? 0;
  if (ms < 30000) {
    return '';
  }

  const minutes = Math.floor(ms / 60000);
  if (minutes < 60) {
    return `${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
}

export function getAccuracyTrend(stats: UserStats, count: number = 4): AccuracyTrendEntry[] {
  const weeklyMap = new Map((stats.weeklyAccuracy ?? []).map((entry) => [entry.week, entry]));

  return getRecentWeekKeys(count).map((week) => {
    const entry = weeklyMap.get(week);
    return {
      week,
      accuracy: entry && entry.attempted > 0 ? Math.round((entry.correct / entry.attempted) * 100) : null,
    } satisfies AccuracyTrendEntry;
  });
}

export function getArenaStatsSummary(
  leaderboard: ArenaLeaderboardEntry[],
  savedPlayerName: string,
): ArenaStatsSummary | null {
  const normalizedName = savedPlayerName.trim().toLowerCase();
  if (!normalizedName || leaderboard.length === 0) {
    return null;
  }

  const wins = leaderboard.filter((entry) => entry.winnerName.trim().toLowerCase() === normalizedName).length;
  const total = leaderboard.length;
  const winRate = total > 0 ? Math.round((wins / total) * 100) : 0;

  return { wins, total, winRate };
}

export function getDeckProgressStats(decks: Deck[], cardStatsById: Record<string, CardStats>): {
  masteryOverview: ReturnType<typeof getDeckMasteryOverview>;
  deckProgressSummaries: DeckProgressSummary[];
} {
  return {
    masteryOverview: getDeckMasteryOverview(decks, cardStatsById),
    deckProgressSummaries: getDeckProgressSummaries(decks, cardStatsById),
  };
}
