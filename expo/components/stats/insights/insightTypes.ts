import type { StyleProp, TextStyle, ViewStyle } from 'react-native';

export interface InsightStyles {
  insightSection: StyleProp<ViewStyle>;
  insightDivider: StyleProp<ViewStyle>;
  insightRow: StyleProp<ViewStyle>;
  insightText: StyleProp<TextStyle>;
  insightAction: StyleProp<ViewStyle>;
  insightActionText: StyleProp<TextStyle>;
}

export interface InsightThemeColors {
  border: string;
  text: string;
  textSecondary: string;
  textTertiary: string;
  success: string;
  warning: string;
  error: string;
  primary: string;
  statsAccent: string;
}
