export type FlashcardAnswerType =
  | 'term'
  | 'definition'
  | 'formula'
  | 'numeric'
  | 'comparison'
  | 'process'
  | 'binary'
  | 'concept_label'
  | 'phrase';

export type FlashcardFitStatus = 'safe' | 'compress' | 'reject';
export type FlashcardOptionSurface = 'tile' | 'battle' | 'study';

export type FlashcardNormalizationReasonCode =
  | 'trimmed_whitespace'
  | 'stripped_markdown_artifacts'
  | 'removed_list_prefix'
  | 'removed_question_prefix'
  | 'removed_answer_prefix'
  | 'removed_leading_filler'
  | 'removed_wrapping_quotes'
  | 'normalized_sentence_case'
  | 'normalized_question_punctuation'
  | 'trimmed_question_length'
  | 'trimmed_answer_length'
  | 'trimmed_explanation_length'
  | 'extracted_explanation'
  | 'compressed_study_question'
  | 'compressed_study_answer'
  | 'compressed_gameplay_question'
  | 'compressed_tile_answer'
  | 'compressed_battle_question'
  | 'compressed_battle_answer'
  | 'normalized_binary'
  | 'normalized_numeric'
  | 'normalized_formula'
  | 'legacy_card_upgraded'
  | 'rejected_low_fit'
  | 'rejected_display_hostile'
  | 'rejected_duplicate'
  | 'option_display_collision'
  | 'option_display_fallback';

export type FlashcardNormalizationSource =
  | 'text_to_deck'
  | 'scan_notes'
  | 'import'
  | 'manual_create'
  | 'retry_regenerate'
  | 'legacy_load_normalization'
  | 'deck_update'
  | 'arena_prepare'
  | 'option_generation'
  | 'unknown';

export interface FlashcardProjectionSet {
  studyQuestion: string;
  studyAnswer: string;
  gameplayQuestion: string;
  tileAnswer: string;
  battleQuestion: string;
  battleAnswer: string;
}

export interface FlashcardProjectionQuality {
  studyQuestion: FlashcardFitStatus;
  studyAnswer: FlashcardFitStatus;
  gameplayQuestion: FlashcardFitStatus;
  tileAnswer: FlashcardFitStatus;
  battleQuestion: FlashcardFitStatus;
  battleAnswer: FlashcardFitStatus;
}

export interface FlashcardNormalizationMeta {
  rawQuestion: string;
  rawAnswer: string;
  rawExplanation?: string;
  reasonCodes: FlashcardNormalizationReasonCode[];
  explanationExtracted: boolean;
  wasCompressed: boolean;
  wasLegacyMigrated: boolean;
  unchanged: boolean;
  fitScore: number;
}

export interface FlashcardContentModel {
  version: number;
  canonicalQuestion: string;
  canonicalAnswer: string;
  normalizedAnswer: string;
  answerType: FlashcardAnswerType;
  explanation?: string;
  projections: FlashcardProjectionSet;
  quality: FlashcardProjectionQuality;
  qualityFlags: string[];
  normalization: FlashcardNormalizationMeta;
}

export interface FlashcardOption {
  id: string;
  displayText: string;
  canonicalValue: string;
  normalizedValue: string;
  answerType: FlashcardAnswerType;
  sourceCardId?: string;
}

export interface Flashcard {
  id: string;
  question: string;
  answer: string;
  deckId: string;
  imageUrl?: string;
  difficulty: 'easy' | 'medium' | 'hard';
  tags?: string[];
  createdAt: number;
  hint1?: string;
  hint2?: string;
  explanation?: string;
  content?: FlashcardContentModel;
}

export interface Deck {
  id: string;
  name: string;
  description: string;
  color: string;
  icon: string;
  flashcards: Flashcard[];
  category: string;
  createdAt: number;
  isCustom: boolean;
  communitySourceId?: string;
}

export interface FlashcardDeckCardSummary {
  cardId: string;
  answerType: FlashcardAnswerType;
  reasonCodes: FlashcardNormalizationReasonCode[];
  qualityFlags: string[];
  rawAnswerLength: number;
  canonicalAnswerLength: number;
  fitScore: number;
  wasCompressed: boolean;
  wasLegacyMigrated: boolean;
  unchanged: boolean;
}

export interface FlashcardDeckNormalizationSummary {
  deckId: string;
  source: FlashcardNormalizationSource;
  processedCount: number;
  acceptedCount: number;
  acceptedUnchangedCount: number;
  acceptedCompressedCount: number;
  explanationExtractedCount: number;
  rejectedCount: number;
  duplicatePairsRemoved: number;
  legacyCardsUpgraded: number;
  affectedCardCount: number;
  answerTypeDistribution: Partial<Record<FlashcardAnswerType, number>>;
  reasonCodeCounts: Partial<Record<FlashcardNormalizationReasonCode, number>>;
  qualityFlagCounts: Record<string, number>;
  averageRawAnswerLength: number;
  averageCanonicalAnswerLength: number;
  battleSafe: boolean;
  cards: FlashcardDeckCardSummary[];
  createdAt: number;
}

export interface FlashcardOptionCollisionEntry {
  displayText: string;
  normalizedDisplayText: string;
  optionIds: string[];
  canonicalValues: string[];
}

export interface FlashcardOptionCollisionResult {
  options: FlashcardOption[];
  collisions: FlashcardOptionCollisionEntry[];
  fallbackCount: number;
}

export interface FlashcardDebugOptionSnapshot {
  id: string;
  displayText: string;
  canonicalValue: string;
  normalizedValue: string;
  answerType: FlashcardAnswerType;
  sourceCardId?: string;
}

export interface FlashcardDebugSnapshot {
  cardId: string;
  deckId: string;
  version: number;
  raw: {
    question: string;
    answer: string;
    explanation?: string;
  };
  canonical: {
    question: string;
    answer: string;
    normalizedAnswer: string;
    explanation?: string;
    answerType: FlashcardAnswerType;
    fitScore: number;
    qualityFlags: string[];
    reasonCodes: FlashcardNormalizationReasonCode[];
  };
  projections: FlashcardProjectionSet;
  quality: FlashcardProjectionQuality;
  options: FlashcardDebugOptionSnapshot[];
  meta: {
    wasLegacyMigrated: boolean;
    wasCompressed: boolean;
    explanationExtracted: boolean;
    unchanged: boolean;
    preservation: 'preserved' | 'rejected';
    duplicateCountInDeck: number;
    duplicateCardIds: string[];
  };
}

export interface UserProgress {
  deckId: string;
  cardsReviewed: number;
  lastStudied: number;
  masteredCards: string[];
}

export interface UserStats {
  totalScore: number;
  currentStreak: number;
  longestStreak: number;
  totalCardsStudied: number;
  totalDecksCompleted: number;
  achievements: Achievement[];
  lastActiveDate: string;
  totalCorrectAnswers: number;
  totalQuestionsAttempted: number;
  studyDates: string[];
  totalStudySessions: number;
  totalQuestSessions: number;
  totalPracticeSessions: number;
  totalArenaSessions: number;
  totalArenaBattles: number;
  totalStudyTimeMs: number;
  weeklyAccuracy: { week: string; correct: number; attempted: number }[];
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  unlockedAt?: number;
  progress: number;
  maxProgress: number;
}
