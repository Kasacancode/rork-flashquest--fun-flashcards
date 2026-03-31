import createContextHook from '@nkzw/create-context-hook';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';

import {
  AI_DISCLOSURE_FEATURES,
  type AIDisclosureFeature,
  DEFAULT_PRIVACY_SETTINGS,
  PRIVACY_SETTINGS_STORAGE_KEY,
  type AnalyticsConsentState,
  type PrivacySettings,
} from '@/constants/privacy';
import { logger } from '@/utils/logger';
import { persistStorageSnapshot, readStorageSnapshot } from '@/utils/storage';

const PRIVACY_SETTINGS_BACKUP_KEY = 'flashquest_privacy_settings_backup';

function normalizePrivacySettings(value: unknown): PrivacySettings | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }

  const candidate = value as Partial<PrivacySettings>;
  const analyticsConsent = candidate.analyticsConsent;
  const analyticsValue: AnalyticsConsentState = analyticsConsent === 'granted' || analyticsConsent === 'declined' || analyticsConsent === 'unknown'
    ? analyticsConsent
    : DEFAULT_PRIVACY_SETTINGS.analyticsConsent;

  const sourceDisclosures = candidate.aiDisclosures;
  const aiDisclosures: Record<AIDisclosureFeature, boolean> = {
    [AI_DISCLOSURE_FEATURES.deckGeneration]: Boolean(sourceDisclosures?.[AI_DISCLOSURE_FEATURES.deckGeneration]),
    [AI_DISCLOSURE_FEATURES.studyAssist]: Boolean(sourceDisclosures?.[AI_DISCLOSURE_FEATURES.studyAssist]),
    [AI_DISCLOSURE_FEATURES.gameplayAssist]: Boolean(sourceDisclosures?.[AI_DISCLOSURE_FEATURES.gameplayAssist]),
  };

  return {
    analyticsConsent: analyticsValue,
    aiDisclosures,
  };
}

export const [PrivacyProvider, usePrivacy] = createContextHook(() => {
  const queryClient = useQueryClient();

  const privacyQuery = useQuery({
    queryKey: ['privacy-settings'],
    queryFn: async () => readStorageSnapshot<PrivacySettings>({
      primaryKey: PRIVACY_SETTINGS_STORAGE_KEY,
      backupKey: PRIVACY_SETTINGS_BACKUP_KEY,
      label: 'privacy settings',
      fallback: DEFAULT_PRIVACY_SETTINGS,
      normalize: normalizePrivacySettings,
    }),
  });

  const savePrivacyMutation = useMutation({
    mutationFn: async (settings: PrivacySettings) => persistStorageSnapshot({
      primaryKey: PRIVACY_SETTINGS_STORAGE_KEY,
      backupKey: PRIVACY_SETTINGS_BACKUP_KEY,
      value: settings,
      label: 'privacy settings',
    }),
    onSuccess: (settings: PrivacySettings) => {
      queryClient.setQueryData(['privacy-settings'], settings);
    },
    onError: (error: unknown) => {
      logger.warn('[Privacy] Failed to persist settings:', error);
    },
  });

  const settings = privacyQuery.data ?? DEFAULT_PRIVACY_SETTINGS;

  const persistSettings = useCallback((updater: (current: PrivacySettings) => PrivacySettings) => {
    const current = queryClient.getQueryData<PrivacySettings>(['privacy-settings']) ?? settings;
    const next = updater(current);
    queryClient.setQueryData(['privacy-settings'], next);
    savePrivacyMutation.mutate(next);
  }, [queryClient, savePrivacyMutation, settings]);

  const setAnalyticsConsent = useCallback((consent: Exclude<AnalyticsConsentState, 'unknown'>) => {
    persistSettings((current) => ({
      ...current,
      analyticsConsent: consent,
    }));
  }, [persistSettings]);

  const acknowledgeAIDisclosure = useCallback((feature: AIDisclosureFeature) => {
    persistSettings((current) => ({
      ...current,
      aiDisclosures: {
        ...current.aiDisclosures,
        [feature]: true,
      },
    }));
  }, [persistSettings]);

  const resetAnalyticsConsent = useCallback(() => {
    persistSettings((current) => ({
      ...current,
      analyticsConsent: 'unknown',
    }));
  }, [persistSettings]);

  const hasAcknowledgedAIDisclosure = useCallback((feature: AIDisclosureFeature) => {
    return Boolean(settings.aiDisclosures[feature]);
  }, [settings.aiDisclosures]);

  return useMemo(() => ({
    analyticsConsent: settings.analyticsConsent,
    analyticsEnabled: settings.analyticsConsent === 'granted',
    shouldAskForAnalyticsConsent: settings.analyticsConsent === 'unknown',
    aiDisclosures: settings.aiDisclosures,
    hasAcknowledgedAIDisclosure,
    setAnalyticsConsent,
    resetAnalyticsConsent,
    acknowledgeAIDisclosure,
    isReady: !privacyQuery.isLoading,
  }), [
    privacyQuery.isLoading,
    settings.aiDisclosures,
    settings.analyticsConsent,
    hasAcknowledgedAIDisclosure,
    setAnalyticsConsent,
    resetAnalyticsConsent,
    acknowledgeAIDisclosure,
  ]);
});
