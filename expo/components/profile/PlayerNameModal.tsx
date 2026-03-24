import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import type { Theme } from '@/constants/colors';
import { PLAYER_NAME_MAX_LENGTH } from '@/utils/playerName';

type ViewStyles<K extends string> = { [P in K]: StyleProp<ViewStyle> };
type TextStyles<K extends string> = { [P in K]: StyleProp<TextStyle> };

interface PlayerNameModalProps {
  visible: boolean;
  playerNameInput: string;
  playerNameError: string | null;
  isPlayerNameReady: boolean;
  onChangeInput: (value: string) => void;
  onSave: () => void;
  onCancel: () => void;
  tabActiveGradient: readonly [string, string];
  styles: ViewStyles<
    | 'modalOverlay'
    | 'playerNameModalCard'
    | 'playerNameEditor'
    | 'playerNameActions'
    | 'playerNameSecondaryButton'
    | 'playerNamePrimaryButton'
    | 'playerNamePrimaryGradient'
  > &
    TextStyles<
      | 'playerNameModalEyebrow'
      | 'playerNameModalTitle'
      | 'playerNameModalSubtitle'
      | 'playerNameInput'
      | 'playerNameHelper'
      | 'playerNameErrorText'
      | 'playerNameSecondaryButtonText'
      | 'playerNamePrimaryButtonText'
    >;
  theme: Theme;
}

export default function PlayerNameModal({
  visible,
  playerNameInput,
  playerNameError,
  isPlayerNameReady,
  onChangeInput,
  onSave,
  onCancel,
  tabActiveGradient,
  styles,
  theme,
}: PlayerNameModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={styles.modalOverlay}>
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={onCancel}
          testID="profile-player-name-overlay"
        />

        <View style={[styles.playerNameModalCard, { backgroundColor: theme.cardBackground }]} testID="profile-player-name-modal">
          <Text style={styles.playerNameModalEyebrow}>FlashQuest Profile</Text>
          <Text style={styles.playerNameModalTitle}>Edit player name</Text>
          <Text style={styles.playerNameModalSubtitle}>Arena reuses this automatically when you host or join a battle.</Text>

          <View style={styles.playerNameEditor}>
            <TextInput
              style={styles.playerNameInput}
              value={playerNameInput}
              onChangeText={onChangeInput}
              placeholder="Enter your player name"
              placeholderTextColor={theme.textTertiary}
              maxLength={PLAYER_NAME_MAX_LENGTH}
              autoFocus
              autoCapitalize="words"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={onSave}
              editable={isPlayerNameReady}
              testID="profile-player-name-input"
            />
            <Text style={[styles.playerNameHelper, playerNameError ? styles.playerNameErrorText : null]}>
              {playerNameError ?? `Max ${PLAYER_NAME_MAX_LENGTH} characters.`}
            </Text>
            <View style={styles.playerNameActions}>
              <TouchableOpacity
                style={styles.playerNameSecondaryButton}
                onPress={onCancel}
                activeOpacity={0.84}
                testID="profile-player-name-cancel"
              >
                <Text style={styles.playerNameSecondaryButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.playerNamePrimaryButton}
                onPress={onSave}
                activeOpacity={0.84}
                testID="profile-player-name-save"
              >
                <LinearGradient
                  colors={tabActiveGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.playerNamePrimaryGradient}
                >
                  <Text style={styles.playerNamePrimaryButtonText}>Save</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}
