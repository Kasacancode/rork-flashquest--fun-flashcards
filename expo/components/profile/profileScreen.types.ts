import type { ComponentType } from 'react';
import type { StyleProp, TextStyle, ViewStyle } from 'react-native';

import type { AvatarColorId } from '@/types/avatar';

export type TabType = 'overview' | 'avatar' | 'awards';

export type GradientTriplet = readonly [string, string, string];

export type IconComponent = ComponentType<{
  color?: string;
  size?: number;
  strokeWidth?: number;
}>;

export interface AvatarOptionVisual {
  cardStyle: StyleProp<ViewStyle>;
  symbolStyle?: StyleProp<TextStyle>;
  titleStyle: StyleProp<TextStyle>;
  checkStyle: StyleProp<ViewStyle>;
  swatchStyle?: StyleProp<ViewStyle>;
}

export interface HeroGradientMapEntry {
  light: GradientTriplet;
  dark: GradientTriplet;
}

export type HeroGradientMap = Record<AvatarColorId, HeroGradientMapEntry>;

export interface ProfileTabItem {
  id: TabType;
  label: string;
  icon: IconComponent;
}
