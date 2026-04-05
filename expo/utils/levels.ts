export interface LevelItem {
  level: number;
  title: string;
  subtitle: string;
  xpRequired: number;
}

export type LevelBand = 'early' | 'mid' | 'high' | 'elite';

export interface LevelBandPalette {
  band: LevelBand;
  badgeGradient: readonly [string, string];
  badgeBorder: string;
  badgeShadow: string;
  badgeText: string;
  haloColor: string;
  heroGradient: readonly [string, string, string];
  heroEdgeTint: string;
  progressGradient: readonly [string, string];
  progressTrack: string;
  progressGlow: string;
  modalCurrentBorder: string;
  modalCurrentBackground: string;
  modalReachedBorder: string;
  modalReachedBackground: string;
  modalBadgeBackground: string;
  modalBadgeText: string;
}

export type LevelRankBand = 'foundation' | 'momentum' | 'skilled' | 'advanced' | 'prestige';

export interface LevelRankBandInfo {
  band: LevelRankBand;
  label: string;
  minLevel: number;
  maxLevel: number | null;
}

export const LEVEL_RANK_BANDS: readonly LevelRankBandInfo[] = [
  { band: 'foundation', label: 'Foundation', minLevel: 1, maxLevel: 3 },
  { band: 'momentum', label: 'Momentum', minLevel: 4, maxLevel: 7 },
  { band: 'skilled', label: 'Established', minLevel: 8, maxLevel: 12 },
  { band: 'advanced', label: 'Advanced', minLevel: 13, maxLevel: 17 },
  { band: 'prestige', label: 'Prestige', minLevel: 18, maxLevel: null },
];

export function getLevelRankBandInfo(level: number): LevelRankBandInfo {
  return LEVEL_RANK_BANDS.find(
    (item) => level >= item.minLevel && (item.maxLevel === null || level <= item.maxLevel),
  ) ?? LEVEL_RANK_BANDS[0]!;
}

export function formatLevelRankRange(rankInfo: LevelRankBandInfo): string {
  return rankInfo.maxLevel === null
    ? `Lv ${rankInfo.minLevel}+`
    : `Lv ${rankInfo.minLevel}–${rankInfo.maxLevel}`;
}

export function isLevelRankBandStart(level: number): boolean {
  const rankInfo = getLevelRankBandInfo(level);
  return rankInfo.minLevel === level;
}


export const LEVELS: readonly LevelItem[] = [
  { level: 1, title: 'Rookie Explorer', subtitle: 'Your first steps into FlashQuest.', xpRequired: 0 },
  { level: 2, title: 'Card Scout', subtitle: 'Starting to build a rhythm.', xpRequired: 200 },
  { level: 3, title: 'Deck Runner', subtitle: 'Moving fast across decks.', xpRequired: 470 },
  { level: 4, title: 'Quick Learner', subtitle: 'Answers are getting sharper.', xpRequired: 834 },
  { level: 5, title: 'Combo Builder', subtitle: 'Streaks are becoming natural.', xpRequired: 1325 },
  { level: 6, title: 'Quest Challenger', subtitle: 'Ready for tougher rounds.', xpRequired: 1987 },
  { level: 7, title: 'Memory Smith', subtitle: 'Recall is becoming a real skill.', xpRequired: 2880 },
  { level: 8, title: 'Arena Contender', subtitle: 'Holding ground under pressure.', xpRequired: 4085 },
  { level: 9, title: 'Deck Strategist', subtitle: 'Playing every mode with purpose.', xpRequired: 5711 },
  { level: 10, title: 'Ranked Scholar', subtitle: 'A reliable force in every session.', xpRequired: 7906 },
  { level: 11, title: 'Elite Thinker', subtitle: 'Outpacing most players.', xpRequired: 10869 },
  { level: 12, title: 'Flash Veteran', subtitle: 'Deep knowledge, fast hands.', xpRequired: 14869 },
  { level: 13, title: 'Grand Quester', subtitle: 'Quests feel like second nature.', xpRequired: 20269 },
  { level: 14, title: 'Mythic Scholar', subtitle: 'Study habits turning into mastery.', xpRequired: 27559 },
  { level: 15, title: 'Arena Champion', subtitle: 'A name others recognize.', xpRequired: 37400 },
  { level: 16, title: 'Deck Sage', subtitle: 'Wisdom across every category.', xpRequired: 50685 },
  { level: 17, title: 'Apex Learner', subtitle: 'Almost untouchable in speed and accuracy.', xpRequired: 68619 },
  { level: 18, title: 'Titan of Recall', subtitle: 'Memory and focus at peak form.', xpRequired: 92829 },
  { level: 19, title: 'Grandmaster', subtitle: 'One of the best to ever study.', xpRequired: 125512 },
  { level: 20, title: 'Legend of the Deck', subtitle: 'The pinnacle. True mastery.', xpRequired: 169634 },
];

export function computeLevel(totalXp: number): number {
  let level = 1;
  let threshold = 0;
  let cost = 200;
  while (totalXp >= threshold + cost && level < 20) {
    threshold += cost;
    level++;
    cost = Math.floor(cost * 1.35);
  }
  return level;
}

export function computeLevelProgress(totalXp: number): { current: number; required: number; percent: number } {
  let level = 1;
  let threshold = 0;
  let cost = 200;
  while (totalXp >= threshold + cost && level < 20) {
    threshold += cost;
    level++;
    cost = Math.floor(cost * 1.35);
  }
  if (level >= 20) {
    return { current: cost, required: cost, percent: 1 };
  }
  const current = totalXp - threshold;
  return { current, required: cost, percent: Math.min(current / cost, 1) };
}

export function getLevelEntry(level: number): LevelItem {
  return [...LEVELS].reverse().find((item) => level >= item.level) ?? LEVELS[0]!;
}

export function getLevelBand(level: number): LevelBand {
  if (level >= 15) {
    return 'elite';
  }

  if (level >= 10) {
    return 'high';
  }

  if (level >= 5) {
    return 'mid';
  }

  return 'early';
}

export function getLevelBandPalette(level: number, isDark: boolean): LevelBandPalette {
  const band = getLevelBand(level);

  if (isDark) {
    switch (band) {
      case 'early':
        return {
          band,
          badgeGradient: ['#38BDF8', '#2563EB'],
          badgeBorder: 'rgba(125, 211, 252, 0.4)',
          badgeShadow: '#38BDF8',
          badgeText: '#F8FAFC',
          haloColor: 'rgba(56, 189, 248, 0.22)',
          heroGradient: ['rgba(56, 189, 248, 0.16)', 'rgba(9, 17, 33, 0.96)', 'rgba(7, 15, 31, 0.98)'],
          heroEdgeTint: 'rgba(37, 99, 235, 0.12)',
          progressGradient: ['#67E8F9', '#2563EB'],
          progressTrack: 'rgba(96, 165, 250, 0.16)',
          progressGlow: '#38BDF8',
          modalCurrentBorder: 'rgba(56, 189, 248, 0.32)',
          modalCurrentBackground: 'rgba(37, 99, 235, 0.16)',
          modalReachedBorder: 'rgba(56, 189, 248, 0.2)',
          modalReachedBackground: 'rgba(14, 116, 144, 0.12)',
          modalBadgeBackground: 'rgba(37, 99, 235, 0.22)',
          modalBadgeText: '#CFE8FF',
        };
      case 'mid':
        return {
          band,
          badgeGradient: ['#60A5FA', '#6366F1'],
          badgeBorder: 'rgba(165, 180, 252, 0.42)',
          badgeShadow: '#6366F1',
          badgeText: '#F8FAFC',
          haloColor: 'rgba(99, 102, 241, 0.24)',
          heroGradient: ['rgba(99, 102, 241, 0.18)', 'rgba(11, 18, 37, 0.96)', 'rgba(8, 14, 30, 0.98)'],
          heroEdgeTint: 'rgba(96, 165, 250, 0.1)',
          progressGradient: ['#7DD3FC', '#6366F1'],
          progressTrack: 'rgba(129, 140, 248, 0.16)',
          progressGlow: '#6366F1',
          modalCurrentBorder: 'rgba(99, 102, 241, 0.34)',
          modalCurrentBackground: 'rgba(79, 70, 229, 0.16)',
          modalReachedBorder: 'rgba(129, 140, 248, 0.22)',
          modalReachedBackground: 'rgba(67, 56, 202, 0.12)',
          modalBadgeBackground: 'rgba(79, 70, 229, 0.22)',
          modalBadgeText: '#DDD9FF',
        };
      case 'high':
        return {
          band,
          badgeGradient: ['#818CF8', '#7C3AED'],
          badgeBorder: 'rgba(167, 139, 250, 0.42)',
          badgeShadow: '#7C3AED',
          badgeText: '#FAF5FF',
          haloColor: 'rgba(124, 58, 237, 0.24)',
          heroGradient: ['rgba(99, 102, 241, 0.16)', 'rgba(15, 20, 40, 0.96)', 'rgba(13, 12, 33, 0.98)'],
          heroEdgeTint: 'rgba(139, 92, 246, 0.12)',
          progressGradient: ['#A5B4FC', '#7C3AED'],
          progressTrack: 'rgba(139, 92, 246, 0.16)',
          progressGlow: '#8B5CF6',
          modalCurrentBorder: 'rgba(129, 140, 248, 0.34)',
          modalCurrentBackground: 'rgba(99, 102, 241, 0.16)',
          modalReachedBorder: 'rgba(139, 92, 246, 0.24)',
          modalReachedBackground: 'rgba(91, 33, 182, 0.12)',
          modalBadgeBackground: 'rgba(91, 33, 182, 0.24)',
          modalBadgeText: '#E9DDFF',
        };
      case 'elite':
        return {
          band,
          badgeGradient: ['#93C5FD', '#8B5CF6'],
          badgeBorder: 'rgba(196, 181, 253, 0.48)',
          badgeShadow: '#8B5CF6',
          badgeText: '#FFFFFF',
          haloColor: 'rgba(139, 92, 246, 0.28)',
          heroGradient: ['rgba(147, 197, 253, 0.14)', 'rgba(16, 20, 44, 0.96)', 'rgba(21, 14, 40, 0.98)'],
          heroEdgeTint: 'rgba(167, 139, 250, 0.14)',
          progressGradient: ['#BFDBFE', '#8B5CF6'],
          progressTrack: 'rgba(167, 139, 250, 0.18)',
          progressGlow: '#A78BFA',
          modalCurrentBorder: 'rgba(147, 197, 253, 0.34)',
          modalCurrentBackground: 'rgba(99, 102, 241, 0.18)',
          modalReachedBorder: 'rgba(167, 139, 250, 0.24)',
          modalReachedBackground: 'rgba(76, 29, 149, 0.14)',
          modalBadgeBackground: 'rgba(109, 40, 217, 0.24)',
          modalBadgeText: '#F0E7FF',
        };
    }
  }

  switch (band) {
    case 'early':
      return {
        band,
        badgeGradient: ['#4A8CFF', '#6CAFFF'],
        badgeBorder: 'rgba(96, 165, 250, 0.42)',
        badgeShadow: '#5D9BFF',
        badgeText: '#FFFFFF',
        haloColor: 'rgba(96, 165, 250, 0.3)',
        heroGradient: ['rgba(255, 255, 255, 0.97)', 'rgba(235, 244, 255, 0.985)', 'rgba(222, 234, 255, 0.995)'],
        heroEdgeTint: 'rgba(74, 140, 255, 0.1)',
        progressGradient: ['#7BB6FF', '#3B82F6'],
        progressTrack: 'rgba(96, 165, 250, 0.18)',
        progressGlow: '#60A5FA',
        modalCurrentBorder: 'rgba(74, 140, 255, 0.34)',
        modalCurrentBackground: 'rgba(218, 230, 255, 0.92)',
        modalReachedBorder: 'rgba(96, 165, 250, 0.22)',
        modalReachedBackground: 'rgba(239, 245, 255, 0.96)',
        modalBadgeBackground: 'rgba(228, 238, 255, 0.96)',
        modalBadgeText: '#2F5AA2',
      };
    case 'mid':
      return {
        band,
        badgeGradient: ['#5C7FFF', '#6B69F7'],
        badgeBorder: 'rgba(107, 114, 255, 0.36)',
        badgeShadow: '#6B69F7',
        badgeText: '#FFFFFF',
        haloColor: 'rgba(99, 102, 241, 0.28)',
        heroGradient: ['rgba(255, 255, 255, 0.968)', 'rgba(235, 240, 255, 0.986)', 'rgba(226, 231, 255, 0.995)'],
        heroEdgeTint: 'rgba(99, 102, 241, 0.1)',
        progressGradient: ['#72A7FF', '#6668F6'],
        progressTrack: 'rgba(99, 102, 241, 0.18)',
        progressGlow: '#6366F1',
        modalCurrentBorder: 'rgba(99, 102, 241, 0.3)',
        modalCurrentBackground: 'rgba(229, 233, 255, 0.92)',
        modalReachedBorder: 'rgba(107, 114, 255, 0.22)',
        modalReachedBackground: 'rgba(239, 241, 255, 0.95)',
        modalBadgeBackground: 'rgba(231, 235, 255, 0.95)',
        modalBadgeText: '#4D54CC',
      };
    case 'high':
      return {
        band,
        badgeGradient: ['#6D65FE', '#8B54F7'],
        badgeBorder: 'rgba(139, 92, 246, 0.38)',
        badgeShadow: '#8354F8',
        badgeText: '#FFFFFF',
        haloColor: 'rgba(124, 58, 237, 0.26)',
        heroGradient: ['rgba(255, 255, 255, 0.968)', 'rgba(239, 238, 255, 0.988)', 'rgba(232, 226, 255, 0.996)'],
        heroEdgeTint: 'rgba(124, 58, 237, 0.11)',
        progressGradient: ['#8EA0FF', '#8B54F7'],
        progressTrack: 'rgba(139, 92, 246, 0.18)',
        progressGlow: '#8B5CF6',
        modalCurrentBorder: 'rgba(131, 84, 248, 0.3)',
        modalCurrentBackground: 'rgba(237, 231, 255, 0.92)',
        modalReachedBorder: 'rgba(139, 92, 246, 0.22)',
        modalReachedBackground: 'rgba(245, 241, 255, 0.95)',
        modalBadgeBackground: 'rgba(241, 233, 255, 0.95)',
        modalBadgeText: '#6D3BE0',
      };
    case 'elite':
      return {
        band,
        badgeGradient: ['#6E83FF', '#A55CFA'],
        badgeBorder: 'rgba(167, 139, 250, 0.4)',
        badgeShadow: '#9C63FA',
        badgeText: '#FFFFFF',
        haloColor: 'rgba(147, 102, 255, 0.28)',
        heroGradient: ['rgba(255, 255, 255, 0.965)', 'rgba(241, 239, 255, 0.988)', 'rgba(238, 229, 255, 0.997)'],
        heroEdgeTint: 'rgba(167, 139, 250, 0.12)',
        progressGradient: ['#A0BEFF', '#A55CFA'],
        progressTrack: 'rgba(167, 139, 250, 0.2)',
        progressGlow: '#A78BFA',
        modalCurrentBorder: 'rgba(137, 116, 255, 0.28)',
        modalCurrentBackground: 'rgba(240, 234, 255, 0.94)',
        modalReachedBorder: 'rgba(167, 139, 250, 0.22)',
        modalReachedBackground: 'rgba(248, 244, 255, 0.96)',
        modalBadgeBackground: 'rgba(243, 236, 255, 0.96)',
        modalBadgeText: '#7447DE',
      };
  }
}
