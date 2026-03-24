export interface LevelItem {
  level: number;
  title: string;
  subtitle: string;
  xpRequired: number;
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
