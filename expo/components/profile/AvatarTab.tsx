import { LinearGradient } from 'expo-linear-gradient';
import { Check } from 'lucide-react-native';
import React from 'react';
import { Pressable, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';

import { AVATAR_COLORS, AVATAR_SUITS } from '@/constants/avatar';
import type { AvatarColorId, AvatarColorOption, AvatarSuitId, AvatarSuitOption } from '@/types/avatar';

type ViewStyles<K extends string> = { [P in K]: StyleProp<ViewStyle> };
type TextStyles<K extends string> = { [P in K]: StyleProp<TextStyle> };

interface AvatarOptionVisual {
  cardStyle: StyleProp<ViewStyle>;
  symbolStyle?: StyleProp<TextStyle>;
  titleStyle: StyleProp<TextStyle>;
  checkStyle: StyleProp<ViewStyle>;
  swatchStyle?: StyleProp<ViewStyle>;
}

interface AvatarTabProps {
  selectedSuit: AvatarSuitId;
  selectedColor: AvatarColorId;
  selectedSuitData: AvatarSuitOption;
  selectedColorData: AvatarColorOption;
  suitOptionVisuals: Record<AvatarSuitId, AvatarOptionVisual>;
  colorOptionVisuals: Record<AvatarColorId, AvatarOptionVisual>;
  avatarShowcaseGradient: readonly [string, string, string];
  onSelectSuit: (suitId: AvatarSuitId) => void;
  onSelectColor: (colorId: AvatarColorId) => void;
  styles: ViewStyles<
    | 'tabContent'
    | 'avatarShowcaseCard'
    | 'avatarShowcaseGradient'
    | 'avatarShowcaseBody'
    | 'avatarShowcaseTile'
    | 'avatarShowcaseTextBlock'
    | 'optionSection'
    | 'sectionHeader'
    | 'optionGrid'
    | 'optionPressable'
    | 'optionCardPressed'
    | 'optionCardContent'
  > &
    TextStyles<
      | 'avatarShowcaseSymbol'
      | 'avatarShowcaseTitle'
      | 'avatarShowcaseDescription'
      | 'sectionTitle'
      | 'sectionSubtitle'
      | 'optionDescription'
    >;
}

export default function AvatarTab({
  selectedSuit,
  selectedColor,
  selectedSuitData,
  selectedColorData,
  suitOptionVisuals,
  colorOptionVisuals,
  avatarShowcaseGradient,
  onSelectSuit,
  onSelectColor,
  styles,
}: AvatarTabProps) {
  return (
    <View style={styles.tabContent}>
      <View style={styles.avatarShowcaseCard}>
        <LinearGradient
          colors={avatarShowcaseGradient}
          start={{ x: 0, y: 0.1 }}
          end={{ x: 1, y: 0.9 }}
          style={styles.avatarShowcaseGradient}
        >
          <View style={styles.avatarShowcaseBody}>
            <View style={styles.avatarShowcaseTile}>
              <Text style={styles.avatarShowcaseSymbol}>{selectedSuitData.symbol}</Text>
            </View>
            <View style={styles.avatarShowcaseTextBlock}>
              <Text style={styles.avatarShowcaseTitle} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.88}>
                {selectedColorData.name} {selectedSuitData.name}
              </Text>
              <Text style={styles.avatarShowcaseDescription}>
                Pick the badge that follows you through study, quests, and arena rooms.
              </Text>
            </View>
          </View>
        </LinearGradient>
      </View>

      <View style={styles.optionSection}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle} accessibilityRole="header">
            Choose a suit
          </Text>
          <Text style={styles.sectionSubtitle}>Select the symbol shown on your player badge.</Text>
        </View>
        <View style={styles.optionGrid}>
          {AVATAR_SUITS.map((suit) => {
            const isSelected = selectedSuit === suit.id;
            const optionVisual = suitOptionVisuals[suit.id];

            return (
              <Pressable
                key={suit.id}
                style={styles.optionPressable}
                onPress={() => onSelectSuit(suit.id)}
                accessibilityLabel={`${suit.name} card identity`}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                testID={`profile-avatar-suit-${suit.id}`}
              >
                {({ pressed }) => (
                  <View style={[optionVisual.cardStyle, pressed ? styles.optionCardPressed : null]}>
                    <View style={styles.optionCardContent}>
                      <Text style={optionVisual.symbolStyle}>{suit.symbol}</Text>
                      <Text style={optionVisual.titleStyle} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.92}>
                        {suit.name}
                      </Text>
                      <Text style={styles.optionDescription}>Tap to equip</Text>
                    </View>
                    {isSelected ? (
                      <View style={optionVisual.checkStyle}>
                        <Check color="#fff" size={18} strokeWidth={3} />
                      </View>
                    ) : null}
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.optionSection}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle} accessibilityRole="header">
            Choose a color
          </Text>
          <Text style={styles.sectionSubtitle}>Your hero card adapts to the color you equip.</Text>
        </View>
        <View style={styles.optionGrid}>
          {AVATAR_COLORS.map((color) => {
            const isSelected = selectedColor === color.id;
            const optionVisual = colorOptionVisuals[color.id];

            return (
              <Pressable
                key={color.id}
                style={styles.optionPressable}
                onPress={() => onSelectColor(color.id)}
                accessibilityLabel={`${color.name} color theme`}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                testID={`profile-avatar-color-${color.id}`}
              >
                {({ pressed }) => (
                  <View style={[optionVisual.cardStyle, pressed ? styles.optionCardPressed : null]}>
                    <View style={styles.optionCardContent}>
                      <View style={optionVisual.swatchStyle} />
                      <Text style={optionVisual.titleStyle} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.92}>
                        {color.name}
                      </Text>
                      <Text style={styles.optionDescription}>Tap to equip</Text>
                    </View>
                    {isSelected ? (
                      <View style={optionVisual.checkStyle}>
                        <Check color="#fff" size={18} strokeWidth={3} />
                      </View>
                    ) : null}
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}
