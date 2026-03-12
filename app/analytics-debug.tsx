import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { AnalyticsSummary } from '@/backend/analytics/types';
import { useTheme } from '@/context/ThemeContext';
import { trpcClient } from '@/lib/trpc';

const ANALYTICS_QUERY_TIMEOUT_MS = 10000;

function formatValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '0';
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  return JSON.stringify(value);
}

function formatMetricPercentage(value: number | undefined): string {
  const normalizedValue = typeof value === 'number' && Number.isFinite(value) ? value : 0;
  return `${(normalizedValue * 100).toFixed(1)}%`;
}

async function fetchAnalyticsSummary(input: { day?: string } | undefined): Promise<AnalyticsSummary> {
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

  try {
    const timeoutPromise = new Promise<AnalyticsSummary>((_, reject) => {
      timeoutHandle = setTimeout(() => {
        reject(new Error('Analytics summary request timed out.'));
      }, ANALYTICS_QUERY_TIMEOUT_MS);
    });

    return await Promise.race([
      trpcClient.analytics.summary.query(input),
      timeoutPromise,
    ]);
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
}

export default function AnalyticsDebugScreen() {
  const { theme } = useTheme();
  const [dayInput, setDayInput] = useState<string>('');
  const [requestedDay, setRequestedDay] = useState<string | undefined>(undefined);

  const queryInput = useMemo<{ day?: string } | undefined>(() => {
    return requestedDay ? { day: requestedDay } : undefined;
  }, [requestedDay]);

  const summaryQuery = useQuery<AnalyticsSummary, Error>({
    queryKey: ['analytics-summary', requestedDay ?? 'today'],
    queryFn: () => fetchAnalyticsSummary(queryInput),
    enabled: __DEV__,
    networkMode: 'always',
    retry: 1,
    refetchOnMount: 'always',
    refetchOnReconnect: true,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (summaryQuery.data) {
      console.log('[AnalyticsDebug] summary loaded:', summaryQuery.data.day, summaryQuery.data);
    }
  }, [summaryQuery.data]);

  useEffect(() => {
    if (summaryQuery.error) {
      console.warn('[AnalyticsDebug] summary failed:', summaryQuery.error);
    }
  }, [summaryQuery.error]);

  const countEntries = useMemo(() => {
    return Object.entries(summaryQuery.data?.counts ?? {});
  }, [summaryQuery.data?.counts]);

  const deckCountEntries = useMemo(() => {
    return Object.entries(summaryQuery.data?.deckCounts ?? {}).sort((leftEntry, rightEntry) => {
      return rightEntry[1] - leftEntry[1];
    });
  }, [summaryQuery.data?.deckCounts]);

  const handleLoad = useCallback(() => {
    const trimmedDay = dayInput.trim();
    const nextRequestedDay = trimmedDay.length > 0 ? trimmedDay : undefined;

    console.log('[AnalyticsDebug] loading summary for day:', nextRequestedDay ?? '[today]');

    if (nextRequestedDay === requestedDay) {
      void summaryQuery.refetch();
      return;
    }

    setRequestedDay(nextRequestedDay);
  }, [dayInput, requestedDay, summaryQuery]);

  const handleClear = useCallback(() => {
    console.log('[AnalyticsDebug] clearing day filter');
    setDayInput('');

    if (requestedDay === undefined) {
      void summaryQuery.refetch();
      return;
    }

    setRequestedDay(undefined);
  }, [requestedDay, summaryQuery]);

  const handleClose = useCallback(() => {
    router.back();
  }, []);

  const containerStyle = [styles.container, { backgroundColor: theme.background }];
  const sectionStyle = [styles.section, { backgroundColor: theme.cardBackground, borderColor: theme.border }];
  const inputStyle = [
    styles.input,
    {
      backgroundColor: theme.card,
      borderColor: theme.border,
      color: theme.text,
    },
  ];
  const secondaryButtonStyle = [styles.secondaryButton, { borderColor: theme.border }];
  const closeButtonStyle = [styles.closeButton, { backgroundColor: theme.cardBackground, borderColor: theme.border }];

  if (!__DEV__) {
    return (
      <SafeAreaView style={containerStyle} edges={['top', 'bottom']}>
        <View style={styles.content}>
          <Pressable
            onPress={handleClose}
            style={({ pressed }) => [closeButtonStyle, { opacity: pressed ? 0.75 : 1 }]}
            testID="analytics-debug-close-button"
          >
            <Text style={[styles.closeButtonText, { color: theme.text }]}>×</Text>
          </Pressable>
        </View>
        <View style={styles.centeredState} testID="analytics-debug-unavailable">
          <Text style={[styles.message, { color: theme.textSecondary }]}>Not available.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={containerStyle} edges={['top', 'bottom']}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        testID="analytics-debug-screen"
      >
        <View style={styles.header}>
          <Pressable
            onPress={handleClose}
            style={({ pressed }) => [closeButtonStyle, { opacity: pressed ? 0.75 : 1 }]}
            testID="analytics-debug-close-button"
          >
            <Text style={[styles.closeButtonText, { color: theme.text }]}>×</Text>
          </Pressable>
          <Text style={[styles.devBadge, { color: theme.warning, borderColor: theme.warning }]}>DEV ONLY</Text>
          <Text style={[styles.title, { color: theme.text }]}>Analytics Debug</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>Loads trpc.analytics.summary for quick inspection.</Text>
        </View>

        <View style={sectionStyle}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Summary Query</Text>
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={theme.textTertiary}
            style={inputStyle}
            testID="analytics-debug-day-input"
            value={dayInput}
            onChangeText={setDayInput}
          />

          <View style={styles.actionsRow}>
            <Pressable
              onPress={handleLoad}
              style={({ pressed }) => [styles.primaryButton, { backgroundColor: theme.primary, opacity: pressed ? 0.85 : 1 }]}
              testID="analytics-debug-load-button"
            >
              <Text style={styles.primaryButtonText}>Load Summary</Text>
            </Pressable>
            <Pressable
              onPress={handleClear}
              style={({ pressed }) => [secondaryButtonStyle, { opacity: pressed ? 0.75 : 1 }]}
              testID="analytics-debug-clear-button"
            >
              <Text style={[styles.secondaryButtonText, { color: theme.text }]}>Today</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                console.log('[AnalyticsDebug] manual refetch');
                void summaryQuery.refetch();
              }}
              style={({ pressed }) => [secondaryButtonStyle, { opacity: pressed ? 0.75 : 1 }]}
              testID="analytics-debug-refetch-button"
            >
              <Text style={[styles.secondaryButtonText, { color: theme.text }]}>Refetch</Text>
            </Pressable>
          </View>

          <Text style={[styles.metaText, { color: theme.textSecondary }]}>Requested day: {requestedDay ?? 'today'}</Text>
        </View>

        <View style={sectionStyle}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Status</Text>
          {summaryQuery.fetchStatus === 'fetching' ? (
            <View style={styles.statusRow}>
              <ActivityIndicator color={theme.primary} />
              <Text style={[styles.metaText, { color: theme.textSecondary }]}>Loading analytics summary...</Text>
            </View>
          ) : null}
          <Text style={[styles.metaText, { color: theme.textSecondary }]}>Resolved day: {summaryQuery.data?.day ?? '--'}</Text>
          <Text style={[styles.metaText, { color: theme.textSecondary }]}>Query status: {summaryQuery.status} / {summaryQuery.fetchStatus}</Text>
          {summaryQuery.error ? (
            <Text style={[styles.errorText, { color: theme.error }]}>{summaryQuery.error.message}</Text>
          ) : null}
        </View>

        <View style={sectionStyle}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Arena Metrics</Text>
          <View style={[styles.row, { borderBottomColor: theme.border }]}>
            <Text style={[styles.rowLabel, { color: theme.text }]}>Battle Start Rate</Text>
            <Text style={[styles.rowValue, { color: theme.textSecondary }]}>
              {formatMetricPercentage(summaryQuery.data?.metrics?.battleStartRate)}
            </Text>
          </View>
          <View style={[styles.row, { borderBottomColor: theme.border }]}>
            <Text style={[styles.rowLabel, { color: theme.text }]}>Battle Completion Rate</Text>
            <Text style={[styles.rowValue, { color: theme.textSecondary }]}>
              {formatMetricPercentage(summaryQuery.data?.metrics?.battleCompletionRate)}
            </Text>
          </View>
          <View style={[styles.row, { borderBottomColor: theme.border }]}>
            <Text style={[styles.rowLabel, { color: theme.text }]}>Rematch Rate</Text>
            <Text style={[styles.rowValue, { color: theme.textSecondary }]}>
              {formatMetricPercentage(summaryQuery.data?.metrics?.rematchRate)}
            </Text>
          </View>
        </View>

        <View style={sectionStyle}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Counts</Text>
          {countEntries.length === 0 ? (
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No counts returned.</Text>
          ) : (
            countEntries.map(([key, value]) => (
              <View key={key} style={[styles.row, { borderBottomColor: theme.border }]}>
                <Text style={[styles.rowLabel, { color: theme.text }]}>{key}</Text>
                <Text style={[styles.rowValue, { color: theme.textSecondary }]}>{formatValue(value)}</Text>
              </View>
            ))
          )}
        </View>

        <View style={sectionStyle}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Deck Counts</Text>
          {deckCountEntries.length === 0 ? (
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No deck counts returned.</Text>
          ) : (
            deckCountEntries.map(([key, value]) => (
              <View key={key} style={[styles.row, { borderBottomColor: theme.border }]}>
                <Text style={[styles.rowLabel, { color: theme.text }]}>{key}</Text>
                <Text style={[styles.rowValue, { color: theme.textSecondary }]}>{formatValue(value)}</Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    gap: 12,
  },
  centeredState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  header: {
    gap: 8,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  closeButtonText: {
    fontSize: 24,
    lineHeight: 24,
    fontWeight: '500' as const,
  },
  devBadge: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    fontSize: 12,
    fontWeight: '800' as const,
    letterSpacing: 0.8,
  },
  title: {
    fontSize: 28,
    fontWeight: '800' as const,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  message: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center' as const,
  },
  section: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 16,
  },
  actionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  primaryButton: {
    minHeight: 44,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700' as const,
  },
  secondaryButton: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
  },
  metaText: {
    fontSize: 13,
    lineHeight: 18,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  errorText: {
    fontSize: 13,
    lineHeight: 18,
  },
  emptyText: {
    fontSize: 14,
    lineHeight: 20,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  rowLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600' as const,
  },
  rowValue: {
    fontSize: 14,
    fontWeight: '700' as const,
  },
});
