export const PRIVACY_SETTINGS_STORAGE_KEY = 'flashquest_privacy_settings';

export type AnalyticsConsentState = 'unknown' | 'granted' | 'declined';

export const AI_DISCLOSURE_FEATURES = {
  deckGeneration: 'deckGeneration',
  studyAssist: 'studyAssist',
  gameplayAssist: 'gameplayAssist',
} as const;

export type AIDisclosureFeature = (typeof AI_DISCLOSURE_FEATURES)[keyof typeof AI_DISCLOSURE_FEATURES];

export interface PrivacySettings {
  analyticsConsent: AnalyticsConsentState;
  aiDisclosures: Record<AIDisclosureFeature, boolean>;
}

export const DEFAULT_PRIVACY_SETTINGS: PrivacySettings = {
  analyticsConsent: 'unknown',
  aiDisclosures: {
    deckGeneration: false,
    studyAssist: false,
    gameplayAssist: false,
  },
};

export const PRIVACY_LINKS = {
  privacyPolicyUrl: 'https://flashquest.net/privacy.html',
  termsUrl: 'https://flashquest.net/terms.html',
  supportUrl: 'https://flashquest.net/support.html',
  supportEmail: 'support@flashquest.net',
  privacyEmail: 'privacy@flashquest.net',
} as const;

export const PRIVACY_COPY = {
  analyticsTitle: 'Optional analytics',
  analyticsDescription: 'If you allow analytics, FlashQuest sends usage events such as app opens, deck creation, study session activity, and battle flow events to help improve reliability and product quality. Some events can include app-generated session, deck, room, or player identifiers when needed to understand how features are performing.',
  onDeviceDescription: 'Most decks, study progress, streaks, settings, and performance history stay on your device.',
  remoteServicesDescription: 'Multiplayer battles use remote services to create rooms, keep players in sync, and process or store live match state. That can include room codes, player display names, selected deck labels, and the deck content used in the match such as questions, answer options, correct answers, player answers, and scores where the battle needs them.',
  aiDescription: 'When you use AI features, FlashQuest sends the notes, images, questions, or answers needed for that feature to an AI processing service so it can generate flashcards, hints, explanations, or answer choices.',
} as const;
