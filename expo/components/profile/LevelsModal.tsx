import { Check } from 'lucide-react-native';
import React, { useMemo } from 'react';
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

import StatsRankEmblem from '@/components/StatsRankEmblem';
import type { Theme } from '@/constants/colors';
import {
  formatLevelRankRange,
  getLevelBandPalette,
  getLevelRankBandInfo,
  isLevelRankBandStart,
  type LevelBandPalette,
} from '@/utils/levels';

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
  const activeRankInfo = useMemo(() => getLevelRankBandInfo(level), [level]);
  const rankedStyles = useMemo(() => createRankedStyles(theme, isDark), [theme, isDark]);
  const subtitle = showRankIdentity
    ? `Current rank: ${activeRankInfo.label} · Lv ${level} · ${levelEntry.title}`
    : `Current rank: Lv ${level} · ${levelEntry.title}`;

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

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.levelList}
          >
            {levels.map((item) => {
              const isCurrent = item.level === level;
              const isReached = level >= item.level;
              const itemPalette = getLevelBandPalette(item.level, isDark);
              const itemRankInfo = getLevelRankBandInfo(item.level);
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
              const shouldShowBandHeader = showRankIdentity && isLevelRankBandStart(item.level);

              return (
                <React.Fragment key={item.level}>
                  {shouldShowBandHeader ? (
                    <View
                      style={[
                        rankedStyles.sectionHeader,
                        {
                          borderColor: itemPalette.modalReachedBorder,
                          backgroundColor: itemPalette.modalBadgeBackground,
                        },
                      ]}
                      testID={`profile-levels-band-${itemRankInfo.band}`}
                    >
                      <Text style={[rankedStyles.sectionTitle, { color: itemPalette.modalBadgeText }]}>
                        {itemRankInfo.label}
                      </Text>
                      <Text style={rankedStyles.sectionMeta}>{formatLevelRankRange(itemRankInfo)}</Text>
                    </View>
                  ) : null}

                  <View
                    style={[
                      styles.levelRow,
                      isCurrent && styles.levelRowCurrent,
                      !isCurrent && isReached && styles.levelRowReached,
                      rowTone,
                    ]}
                    testID={`profile-level-row-${item.level}`}
                  >
                    {showRankIdentity ? (
                      <StatsRankEmblem
                        level={item.level}
                        palette={itemPalette}
                        isDark={isDark}
                        size="row"
                        style={rankedStyles.rowEmblem}
                        testID={`profile-level-emblem-${item.level}`}
                      />
                    ) : (
                      <View
                        style={[
                          styles.levelBadge,
                          !isCurrent && isReached && styles.levelBadgeReached,
                          badgeTone,
                        ]}
                      >
                        <Text style={[styles.levelBadgeText, badgeTextTone]}>Lv {item.level}</Text>
                      </View>
                    )}

                    <View style={styles.levelRowTextWrap}>
                      <View style={showRankIdentity ? rankedStyles.rowTitleLine : null}>
                        <Text
                          style={styles.levelRowTitle}
                          numberOfLines={2}
                          adjustsFontSizeToFit
                          minimumFontScale={0.9}
                        >
                          {item.title}
                        </Text>
                        {showRankIdentity && isCurrent ? (
                          <View
                            style={[
                              rankedStyles.currentPill,
                              {
                                borderColor: itemPalette.modalCurrentBorder,
                                backgroundColor: itemPalette.modalBadgeBackground,
                              },
                            ]}
                          >
                            <Text style={[rankedStyles.currentPillText, { color: itemPalette.modalBadgeText }]}>Current</Text>
                          </View>
                        ) : null}
                      </View>
                      <Text style={styles.levelRowSubtitle}>{item.subtitle}</Text>
                      <Text style={[styles.levelRowMeta, metaTone]}>
                        {showRankIdentity
                          ? `${itemRankInfo.label} · ${item.xpRequired.toLocaleString()} XP unlock`
                          : `${item.xpRequired.toLocaleString()} XP unlock`}
                      </Text>
                    </View>

                    {isReached && !isCurrent ? (
                      <View
                        style={[
                          styles.levelReachedPill,
                          showRankIdentity
                            ? {
                                backgroundColor: itemPalette.modalBadgeBackground,
                                borderColor: itemPalette.modalReachedBorder,
                                borderWidth: 1,
                              }
                            : null,
                        ]}
                      >
                        <Check
                          color={showRankIdentity ? itemPalette.modalBadgeText : '#fff'}
                          size={10}
                          strokeWidth={3}
                        />
                      </View>
                    ) : null}
                  </View>
                </React.Fragment>
              );
            })}
          </ScrollView>
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
