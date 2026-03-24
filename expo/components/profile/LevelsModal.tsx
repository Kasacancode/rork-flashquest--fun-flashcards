import React, { useCallback, useMemo } from 'react';
import {
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import LevelLadderRow from '@/components/profile/LevelLadderRow';
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
  showRankIdentity?: boolean;
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
  showRankIdentity = false,
}: LevelsModalProps) {
  const activePalette = levelPalette ?? getLevelBandPalette(level, isDark);
  const rankedStyles = useMemo(() => createRankedStyles(theme, isDark), [theme, isDark]);
  const subtitle = `Current rank: Lv ${level} · ${levelEntry.title}`;
  const renderLevelRow = useCallback(
    ({ item }: { item: LevelsModalProps['levels'][number] }) => (
      <LevelLadderRow
        item={item}
        level={level}
        isDark={isDark}
        showRankIdentity={showRankIdentity}
        styles={styles}
        rankedStyles={rankedStyles}
      />
    ),
    [isDark, level, rankedStyles, showRankIdentity, styles],
  );
  const keyExtractor = useCallback((item: LevelsModalProps['levels'][number]) => `${item.level}`, []);

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
                {subtitle}
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

          <FlatList
            data={levels}
            renderItem={renderLevelRow}
            keyExtractor={keyExtractor}
            contentContainerStyle={styles.levelList}
            showsVerticalScrollIndicator={false}
            initialNumToRender={10}
            maxToRenderPerBatch={12}
            windowSize={8}
            removeClippedSubviews
          />
        </View>
      </View>
    </Modal>
  );
}

const createRankedStyles = (theme: Theme, isDark: boolean) => {
  const secondaryTextColor = isDark ? theme.textSecondary : '#4F6284';

  return StyleSheet.create({
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 16,
      borderWidth: 1,
      marginTop: 2,
      marginBottom: 2,
    },
    sectionTitle: {
      fontSize: 12,
      fontWeight: '800' as const,
      letterSpacing: 0.8,
      textTransform: 'uppercase' as const,
    },
    sectionMeta: {
      fontSize: 11,
      fontWeight: '700' as const,
      color: secondaryTextColor,
      textTransform: 'uppercase' as const,
      letterSpacing: 0.4,
    },
    rowEmblem: {
      marginLeft: -2,
      marginRight: 2,
    },
    rowTitleLine: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
    },
    currentPill: {
      paddingHorizontal: 9,
      paddingVertical: 5,
      borderRadius: 999,
      borderWidth: 1,
      alignSelf: 'flex-start',
    },
    currentPillText: {
      fontSize: 10,
      fontWeight: '800' as const,
      textTransform: 'uppercase' as const,
      letterSpacing: 0.5,
    },
  });
};
