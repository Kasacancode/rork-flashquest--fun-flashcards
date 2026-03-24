import type { StyleProp, TextStyle, ViewStyle } from 'react-native';

export type StatsViewStyles<K extends string> = { [P in K]: StyleProp<ViewStyle> };
export type StatsTextStyles<K extends string> = { [P in K]: StyleProp<TextStyle> };
