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
  privacyPolicyUrl: '',
  termsUrl: '',
  supportUrl: '',
  supportEmail: 'support@flashquest.net',
  privacyEmail: 'privacy@flashquest.net',
} as const;

export const PRIVACY_COPY = {
  analyticsTitle: 'Anonymous analytics',
  analyticsDescription: 'If you allow analytics, FlashQuest sends anonymous usage events like app opens, deck creation, and session starts so we can improve stability and product quality.',
  onDeviceDescription: 'Most decks, study progress, streaks, settings, and performance history stay on your device.',
  remoteServicesDescription: 'Multiplayer battles use remote services for rooms, player presence, deck labels, and live match state. Analytics are only sent after you opt in.',
  aiDescription: 'When you use AI features, the notes, images, questions, or answers needed for that feature are sent to an AI processing service to generate flashcards, hints, explanations, or answer choices.',
} as const;
