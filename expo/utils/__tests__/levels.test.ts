import { describe, it, expect } from 'bun:test';

import {
  computeLevel,
  computeLevelProgress,
  getLevelBand,
  getLevelEntry,
  getLevelRankBandInfo,
  getLevelRankBandLabel,
  getLevelRankBandProgress,
  isLevelRankBandStart,
  formatLevelRankRange,
  LEVEL_RANK_BANDS,
} from '../levels';

describe('computeLevel', () => {
  it('returns level 1 for 0 XP', () => {
    expect(computeLevel(0)).toBe(1);
  });

  it('returns level 1 for XP just below first threshold', () => {
    expect(computeLevel(199)).toBe(1);
  });

  it('returns level 2 at exactly 200 XP', () => {
    expect(computeLevel(200)).toBe(2);
  });

  it('returns level 3 at 470 XP', () => {
    expect(computeLevel(470)).toBe(3);
  });

  it('returns level 5 at 1325 XP', () => {
    expect(computeLevel(1325)).toBe(5);
  });

  it('returns level 10 at 7906 XP', () => {
    expect(computeLevel(7906)).toBe(10);
  });

  it('caps at level 20 for very high XP', () => {
    expect(computeLevel(999999)).toBe(20);
  });

  it('returns level 20 at the exact threshold', () => {
    expect(computeLevel(169634)).toBe(20);
  });

  it('never returns below 1', () => {
    expect(computeLevel(-100)).toBe(1);
  });

  it('is monotonically increasing', () => {
    let previousLevel = 0;
    for (let xp = 0; xp <= 200000; xp += 50) {
      const level = computeLevel(xp);
      expect(level).toBeGreaterThanOrEqual(previousLevel);
      previousLevel = level;
    }
  });
});

describe('computeLevelProgress', () => {
  it('shows 0 current XP at level 1 start', () => {
    const progress = computeLevelProgress(0);
    expect(progress.current).toBe(0);
    expect(progress.required).toBe(200);
    expect(progress.percent).toBe(0);
  });

  it('shows partial progress within a level', () => {
    const progress = computeLevelProgress(100);
    expect(progress.current).toBe(100);
    expect(progress.required).toBe(200);
  });

  it('returns 100% at max level', () => {
    const progress = computeLevelProgress(999999);
    expect(progress.percent).toBe(1);
  });
});

describe('getLevelEntry', () => {
  it('returns Rookie Explorer for level 1', () => {
    expect(getLevelEntry(1).title).toBe('Rookie Explorer');
  });

  it('returns Legend of the Deck for level 20', () => {
    expect(getLevelEntry(20).title).toBe('Legend of the Deck');
  });

  it('returns correct entry for mid-range level', () => {
    expect(getLevelEntry(10).title).toBe('Ranked Scholar');
  });

  it('does not crash for level 0', () => {
    const entry = getLevelEntry(0);
    expect(entry).toBeDefined();
  });
});

describe('getLevelBand', () => {
  it('returns early for low levels', () => {
    expect(getLevelBand(1)).toBe('early');
  });

  it('returns elite for high levels', () => {
    expect(getLevelBand(20)).toBe('elite');
  });
});

describe('rank bands', () => {
  it('has exactly 5 rank bands', () => {
    expect(LEVEL_RANK_BANDS).toHaveLength(5);
  });

  it('assigns level 1 to Foundation band', () => {
    expect(getLevelRankBandLabel(1)).toBe('Foundation');
  });

  it('assigns level 5 to Momentum band', () => {
    expect(getLevelRankBandLabel(5)).toBe('Momentum');
  });

  it('assigns level 10 to Established band', () => {
    expect(getLevelRankBandLabel(10)).toBe('Established');
  });

  it('assigns level 15 to Advanced band', () => {
    expect(getLevelRankBandLabel(15)).toBe('Advanced');
  });

  it('assigns level 20 to Prestige band', () => {
    expect(getLevelRankBandLabel(20)).toBe('Prestige');
  });

  it('marks level 1 as a band start', () => {
    expect(isLevelRankBandStart(1)).toBe(true);
  });

  it('marks level 4 as a band start', () => {
    expect(isLevelRankBandStart(4)).toBe(true);
  });

  it('does not mark level 5 as a band start', () => {
    expect(isLevelRankBandStart(5)).toBe(false);
  });

  it('computes progress within a band', () => {
    const progress = getLevelRankBandProgress(1);
    expect(progress).toBe(0);
  });

  it('returns 1 for max level in Prestige band', () => {
    const progress = getLevelRankBandProgress(20);
    expect(progress).toBe(1);
  });

  it('formats range correctly for bounded bands', () => {
    const info = getLevelRankBandInfo(1);
    expect(formatLevelRankRange(info)).toBe('Lv 1–3');
  });

  it('formats range correctly for open-ended Prestige band', () => {
    const info = getLevelRankBandInfo(20);
    expect(formatLevelRankRange(info)).toBe('Lv 18+');
  });
});
