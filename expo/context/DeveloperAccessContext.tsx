import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';

const STORAGE_KEY = 'flashquest_developer_access';

export const [DeveloperAccessProvider, useDeveloperAccess] = createContextHook(() => {
  const queryClient = useQueryClient();

  const developerAccessQuery = useQuery({
    queryKey: ['developer-access'],
    queryFn: async () => {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      return stored === 'enabled';
    },
  });

  const saveDeveloperAccessMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      if (enabled) {
        await AsyncStorage.setItem(STORAGE_KEY, 'enabled');
      } else {
        await AsyncStorage.removeItem(STORAGE_KEY);
      }

      return enabled;
    },
    onSuccess: (enabled: boolean) => {
      queryClient.setQueryData(['developer-access'], enabled);
    },
  });

  const isDeveloperAccessEnabled = developerAccessQuery.data ?? false;
  const canAccessDeveloperTools = isDeveloperAccessEnabled;

  const enableDeveloperAccess = useCallback(() => {
    saveDeveloperAccessMutation.mutate(true);
  }, [saveDeveloperAccessMutation]);

  const disableDeveloperAccess = useCallback(() => {
    saveDeveloperAccessMutation.mutate(false);
  }, [saveDeveloperAccessMutation]);

  const toggleDeveloperAccess = useCallback(() => {
    saveDeveloperAccessMutation.mutate(!isDeveloperAccessEnabled);
  }, [isDeveloperAccessEnabled, saveDeveloperAccessMutation]);

  return useMemo(() => ({
    isDeveloperAccessEnabled,
    canAccessDeveloperTools,
    enableDeveloperAccess,
    disableDeveloperAccess,
    toggleDeveloperAccess,
    isReady: !developerAccessQuery.isLoading,
    isSaving: saveDeveloperAccessMutation.isPending,
  }), [
    isDeveloperAccessEnabled,
    canAccessDeveloperTools,
    enableDeveloperAccess,
    disableDeveloperAccess,
    toggleDeveloperAccess,
    developerAccessQuery.isLoading,
    saveDeveloperAccessMutation.isPending,
  ]);
});
