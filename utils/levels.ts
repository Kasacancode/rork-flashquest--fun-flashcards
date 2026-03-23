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
  { level: 4, title: 'Quick Learner', subtitle: 'Answers are getting sharper.', xpRequired: 835 },
  { level: 5, title: 'Combo Builder', subtitle: 'Streaks are becoming natural.', xpRequired: 1328 },
  { level: 6, title: 'Quest Challenger', subtitle: 'Ready for tougher rounds.', xpRequired: 1993 },
  { level: 7, title: 'Memory Smith', subtitle: 'Recall is becoming a real skill.', xpRequired: 2891 },
  { level: 8, title: 'Arena Contender', subtitle: 'Holding ground under pressure.', xpRequired: 4103 },
  { level: 9, title: 'Deck Strategist', subtitle: 'Playing every mode with purpose.', xpRequired: 5739 },
  { level: 10, title: 'Ranked Scholar', subtitle: 'A reliable force in every session.', xpRequired: 7948 },
  { level: 11, title: 'Elite Thinker', subtitle: 'Outpacing most players.', xpRequired: 10930 },
  { level: 12, title: 'Flash Veteran', subtitle: 'Deep knowledge, fast hands.', xpRequired: 14956 },
  { level: 13, title: 'Grand Quester', subtitle: 'Quests feel like second nature.', xpRequired: 20391 },
  { level: 14, title: 'Mythic Scholar', subtitle: 'Study habits turning into mastery.', xpRequired: 27728 },
  { level: 15, title: 'Arena Champion', subtitle: 'A name others recognize.', xpRequired: 37633 },
  { level: 16, title: 'Deck Sage', subtitle: 'Wisdom across every category.', xpRequired: 50905 },
  { level: 17, title: 'Apex Learner', subtitle: 'Almost untouchable in speed and accuracy.', xpRequired: 68722 },
  { level: 18, title: 'Titan of Recall', subtitle: 'Memory and focus at peak form.', xpRequired: 92775 },
  { level: 19, title: 'Grandmaster', subtitle: 'One of the best to ever study.', xpRequired: 125247 },
  { level: 20, title: 'Legend of the Deck', subtitle: 'The pinnacle. True mastery.', xpRequired: 169084 },
];

export function computeLevel(totalXp: number): number {
  let level = 1;
  let threshold = 0;
  let cost = 200;
  while (totalXp >= threshold + cost) {
    threshold += cost;
    level++;
    cost = Math.floor(cost * 1.35);
  }
  return level;
}

export function computeLevelProgress(totalXp: number): { current: number; required: number; percent: number } {
  let threshold = 0;
  let cost = 200;
  while (totalXp >= threshold + cost) {
    threshold += cost;
    cost = Math.floor(cost * 1.35);
  }
  const current = totalXp - threshold;
  return { current, required: cost, percent: Math.min(current / cost, 1) };
}

export function getLevelEntry(level: number): LevelItem {
  return [...LEVELS].reverse().find((item) => level >= item.level) ?? LEVELS[0]!;
}
