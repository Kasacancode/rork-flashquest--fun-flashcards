import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';

import {
  DEFAULT_AVATAR_IDENTITY,
  getAvatarIdentityByKey,
  getAvatarIdentityBySelection,
  type AvatarColorId,
  type AvatarSuitId,
} from '@/constants/avatar';

const STORAGE_KEY = 'flashquest_avatar_identity';

export const [AvatarProvider, useAvatar] = createContextHook(() => {
  const queryClient = useQueryClient();

  const avatarQuery = useQuery({
    queryKey: ['avatar-identity'],
    queryFn: async () => {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      return getAvatarIdentityByKey(stored)?.key ?? DEFAULT_AVATAR_IDENTITY.key;
    },
  });

  const saveAvatarMutation = useMutation({
    mutationFn: async (identityKey: string) => {
      await AsyncStorage.setItem(STORAGE_KEY, identityKey);
      return identityKey;
    },
    onSuccess: (identityKey: string) => {
      queryClient.setQueryData(['avatar-identity'], identityKey);
    },
  });

  const selectedIdentityKey = avatarQuery.data ?? DEFAULT_AVATAR_IDENTITY.key;
  const avatarIdentity = getAvatarIdentityByKey(selectedIdentityKey) ?? DEFAULT_AVATAR_IDENTITY;

  const setAvatarIdentity = useCallback((identityKey: string) => {
    const nextIdentityKey = getAvatarIdentityByKey(identityKey)?.key ?? DEFAULT_AVATAR_IDENTITY.key;
    queryClient.setQueryData(['avatar-identity'], nextIdentityKey);
    saveAvatarMutation.mutate(nextIdentityKey);
  }, [queryClient, saveAvatarMutation]);

  const setSelectedSuit = useCallback((suitId: AvatarSuitId) => {
    const nextIdentity = getAvatarIdentityBySelection(avatarIdentity.colorId, suitId);
    setAvatarIdentity(nextIdentity.key);
  }, [avatarIdentity.colorId, setAvatarIdentity]);

  const setSelectedColor = useCallback((colorId: AvatarColorId) => {
    const nextIdentity = getAvatarIdentityBySelection(colorId, avatarIdentity.suitId);
    setAvatarIdentity(nextIdentity.key);
  }, [avatarIdentity.suitId, setAvatarIdentity]);

  return useMemo(() => ({
    avatarIdentity,
    selectedIdentityKey: avatarIdentity.key,
    selectedSuit: avatarIdentity.suitId,
    selectedColor: avatarIdentity.colorId,
    setAvatarIdentity,
    setSelectedSuit,
    setSelectedColor,
    isLoading: avatarQuery.isLoading,
    isSaving: saveAvatarMutation.isPending,
  }), [
    avatarIdentity,
    setAvatarIdentity,
    setSelectedSuit,
    setSelectedColor,
    avatarQuery.isLoading,
    saveAvatarMutation.isPending,
  ]);
});
