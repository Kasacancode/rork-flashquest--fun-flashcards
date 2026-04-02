export const EXPORT_KEYS = [
  'flashquest_decks',
  'flashquest_decks_backup',
  'flashquest_stats',
  'flashquest_stats_backup',
  'flashquest_performance',
  'flashquest_performance_backup',
  'flashquest_progress',
  'flashquest_progress_backup',
  'flashquest_categories',
  'flashquest_categories_backup',
  'flashquest_hidden_deck_ids',
  'flashquest_hidden_deck_ids_backup',
  'flashquest_arena_player_name',
  'flashquest_avatar_identity',
  'flashquest_user_interests',
  'flashquest_daily_goal_target',
  'flashquest_onboarding_complete',
] as const;

export type ExportKey = (typeof EXPORT_KEYS)[number];

export const EXPORT_KEY_SET = new Set<string>(EXPORT_KEYS);
