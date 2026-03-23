import { Check } from 'lucide-react-native';
import React from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import type { Theme } from '@/constants/colors';

type ViewStyles<K extends string> = { [P in K]: StyleProp<ViewStyle> };
type TextStyles<K extends string> = { [P in K]: StyleProp<TextStyle> };

interface LevelsModalProps {
  visible: boolean;
  level: number;
  levelEntry: { level: number; title: string };
  levels: readonly {
    level: number;
    title: string;
    subtitle: string;
    xpRequired: number;
  }[];
  onClose: () => void;
  styles: ViewStyles<
    | 'levelModalOverlay'
    | 'levelModalCard'
    | 'levelModalHeader'
    | 'levelModalTitleWrap'
    | 'settingsCloseButton'
    | 'levelRow'
    | 'levelRowCurrent'
    | 'levelRowReached'
    | 'levelBadge'
    | 'levelBadgeReached'
    | 'levelRowTextWrap'
    | 'levelReachedPill'
  > &
    TextStyles<
      | 'levelModalEyebrow'
      | 'levelModalTitle'
      | 'levelModalSubtitle'
      | 'settingsCloseText'
      | 'levelBadgeText'
      | 'levelBadgeTextCurrent'
      | 'levelRowTitle'
      | 'levelRowSubtitle'
      | 'levelRowMeta'
    > & {
      levelList: StyleProp<ViewStyle>;
    };
  theme: Theme;
}

export default function LevelsModal({
  visible,
  level,
  levelEntry,
  levels,
  onClose,
  styles,
  theme,
}: LevelsModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.levelModalOverlay}>
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={onClose}
          testID="profile-levels-overlay"
        />

        <View style={[styles.levelModalCard, { backgroundColor: theme.cardBackground }]} testID="profile-levels-modal">
          <View style={styles.levelModalHeader}>
            <View style={styles.levelModalTitleWrap}>
              <Text style={styles.levelModalEyebrow}>Rank progression</Text>
              <Text style={styles.levelModalTitle}>Levels & titles</Text>
              <Text style={styles.levelModalSubtitle}>Current rank: Lv {level} · {levelEntry.title}</Text>
            </View>
            <TouchableOpacity
              style={styles.settingsCloseButton}
              onPress={onClose}
              activeOpacity={0.8}
              testID="profile-close-levels"
            >
              <Text style={styles.settingsCloseText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.levelList}
          >
            {levels.map((item) => {
              const isCurrent = item.level === levelEntry.level;
              const isReached = level >= item.level;

              return (
                <View
                  key={item.level}
                  style={[
                    styles.levelRow,
                    isCurrent && styles.levelRowCurrent,
                    !isCurrent && isReached && styles.levelRowReached,
                  ]}
                >
                  <View
                    style={[
                      styles.levelBadge,
                      isCurrent && { backgroundColor: theme.primary },
                      !isCurrent && isReached && styles.levelBadgeReached,
                    ]}
                  >
                    <Text style={[styles.levelBadgeText, isCurrent && styles.levelBadgeTextCurrent]}>Lv {item.level}</Text>
                  </View>

                  <View style={styles.levelRowTextWrap}>
                    <Text style={styles.levelRowTitle}>{item.title}</Text>
                    <Text style={styles.levelRowSubtitle}>{item.subtitle}</Text>
                    <Text style={styles.levelRowMeta}>{item.xpRequired} XP unlock</Text>
                  </View>

                  {isReached && (
                    <View style={styles.levelReachedPill}>
                      <Check color="#fff" size={10} strokeWidth={3} />
                    </View>
                  )}
                </View>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
