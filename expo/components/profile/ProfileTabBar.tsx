import { LinearGradient } from 'expo-linear-gradient';
import React, { memo } from 'react';
import { Text, TouchableOpacity, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';

import type { Theme } from '@/constants/colors';
import { PROFILE_TABS } from '@/components/profile/profileScreen.constants';
import type { TabType } from '@/components/profile/profileScreen.types';

type ViewStyles<K extends string> = { [P in K]: StyleProp<ViewStyle> };
type TextStyles<K extends string> = { [P in K]: StyleProp<TextStyle> };

interface ProfileTabBarProps {
  activeTab: TabType;
  onSelectTab: (tab: TabType) => void;
  tabActiveGradient: [string, string];
  styles: ViewStyles<'tabs' | 'tab' | 'tabActiveBackground' | 'tabContentWrap'> &
    TextStyles<'tabText' | 'tabTextActive'>;
  theme: Theme;
}

function ProfileTabBarComponent({ activeTab, onSelectTab, tabActiveGradient, styles, theme }: ProfileTabBarProps) {
  return (
    <View style={styles.tabs}>
      {PROFILE_TABS.map((tab) => {
        const isActive = activeTab === tab.id;
        const Icon = tab.icon;

        return (
          <TouchableOpacity
            key={tab.id}
            style={styles.tab}
            onPress={() => onSelectTab(tab.id)}
            activeOpacity={0.84}
            accessibilityLabel={tab.label}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            testID={`profile-tab-${tab.id}`}
          >
            {isActive ? (
              <LinearGradient
                colors={tabActiveGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.tabActiveBackground}
              />
            ) : null}
            <View style={styles.tabContentWrap}>
              <Icon
                color={isActive ? theme.profileTabActiveText : theme.profileTabIconInactive}
                size={15}
                strokeWidth={2.3}
              />
              <Text style={[styles.tabText, isActive ? styles.tabTextActive : null]} numberOfLines={1}>
                {tab.label}
              </Text>
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export default memo(ProfileTabBarComponent);
