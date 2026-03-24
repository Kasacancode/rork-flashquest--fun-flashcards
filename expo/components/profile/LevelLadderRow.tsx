import { Check } from 'lucide-react-native';
import React, { memo } from 'react';
import { Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';

import StatsRankEmblem from '@/components/StatsRankEmblem';
import {
  formatLevelRankRange,
  getLevelBandPalette,
  getLevelRankBandInfo,
  isLevelRankBandStart,
} from '@/utils/levels';

type ViewStyles<K extends string> = { [P in K]: StyleProp<ViewStyle> };
type TextStyles<K extends string> = { [P in K]: StyleProp<TextStyle> };

interface LevelItem {
  level: number;
  title: string;
  subtitle: string;
  xpRequired: number;
}

interface LevelRowStyles extends ViewStyles<
  | 'levelRow'
  | 'levelRowCurrent'
  | 'levelRowReached'
  | 'levelBadge'
  | 'levelBadgeReached'
  | 'levelRowTextWrap'
  | 'levelReachedPill'
> , TextStyles<
  | 'levelBadgeText'
  | 'levelRowTitle'
  | 'levelRowSubtitle'
  | 'levelRowMeta'
> {}

interface RankedStyles extends ViewStyles<
  | 'sectionHeader'
  | 'rowEmblem'
  | 'rowTitleLine'
  | 'currentPill'
> , TextStyles<
  | 'sectionTitle'
  | 'sectionMeta'
  | 'currentPillText'
> {}

interface LevelLadderRowProps {
  item: LevelItem;
  level: number;
  isDark: boolean;
  showRankIdentity: boolean;
  styles: LevelRowStyles;
  rankedStyles: RankedStyles;
}

function LevelLadderRow({
  item,
  level,
  isDark,
  showRankIdentity,
  styles,
  rankedStyles,
}: LevelLadderRowProps) {
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
        elevation: 4,
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
    <>
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
            {`${item.xpRequired.toLocaleString()} XP unlock`}
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
    </>
  );
}

export default memo(LevelLadderRow);
