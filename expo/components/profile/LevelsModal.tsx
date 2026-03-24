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
import { getLevelBandPalette, type LevelBandPalette } from '@/utils/levels';

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
  isDark?: boolean;
  levelPalette?: LevelBandPalette;
}

export default function LevelsModal({
  visible,
  level,
  levelEntry,
  levels,
  onClose,
  styles,
  theme,
  isDark = false,
  levelPalette,
}: LevelsModalProps) {
  const activePalette = levelPalette ?? getLevelBandPalette(level, isDark);

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
              <Text
                style={[styles.levelModalSubtitle, { color: activePalette.modalBadgeText }]}
                numberOfLines={2}
                adjustsFontSizeToFit
                minimumFontScale={0.88}
              >
                Current rank: Lv {level} · {levelEntry.title}
              </Text>
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
              const isCurrent = item.level === level;
              const isReached = level >= item.level;
              const itemPalette = getLevelBandPalette(item.level, isDark);
              const rowTone = isCurrent
                ? {
                    borderColor: itemPalette.modalCurrentBorder,
                    backgroundColor: itemPalette.modalCurrentBackground,
                    shadowColor: itemPalette.badgeShadow,
                    shadowOpacity: isDark ? 0.24 : 0.08,
                    shadowRadius: isDark ? 14 : 10,
                    shadowOffset: { width: 0, height: 6 },
                    elevation: isCurrent ? 4 : 0,
                  }
                : {
                    borderColor: itemPalette.modalReachedBorder,
                    backgroundColor: itemPalette.modalReachedBackground,
                  };
              const badgeTone = {
                backgroundColor: itemPalette.modalBadgeBackground,
                borderColor: isCurrent ? itemPalette.modalCurrentBorder : itemPalette.modalReachedBorder,
                borderWidth: 1,
              };
              const badgeTextTone = { color: itemPalette.modalBadgeText };
              const metaTone = {
                color: itemPalette.modalBadgeText,
                opacity: isCurrent ? 1 : isReached ? 0.88 : 0.76,
              };

              return (
                <View
                  key={item.level}
                  style={[
                    styles.levelRow,
                    isCurrent && styles.levelRowCurrent,
                    !isCurrent && isReached && styles.levelRowReached,
                    rowTone,
                  ]}
                >
                  <View
                    style={[
                      styles.levelBadge,
                      !isCurrent && isReached && styles.levelBadgeReached,
                      badgeTone,
                    ]}
                  >
                    <Text style={[styles.levelBadgeText, badgeTextTone]}>Lv {item.level}</Text>
                  </View>

                  <View style={styles.levelRowTextWrap}>
                    <Text
                      style={styles.levelRowTitle}
                      numberOfLines={2}
                      adjustsFontSizeToFit
                      minimumFontScale={0.9}
                    >
                      {item.title}
                    </Text>
                    <Text style={styles.levelRowSubtitle}>{item.subtitle}</Text>
                    <Text style={[styles.levelRowMeta, metaTone]}>{item.xpRequired.toLocaleString()} XP unlock</Text>
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
