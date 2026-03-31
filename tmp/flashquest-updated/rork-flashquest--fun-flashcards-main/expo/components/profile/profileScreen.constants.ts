import { Award, User, Zap } from 'lucide-react-native';

import type { HeroGradientMap, ProfileTabItem } from '@/components/profile/profileScreen.types';

export const PROFILE_TABS: readonly ProfileTabItem[] = [
  { id: 'overview', label: 'Overview', icon: User },
  { id: 'avatar', label: 'Avatar', icon: Zap },
  { id: 'awards', label: 'Awards', icon: Award },
] as const;

export const HERO_GRADIENTS: HeroGradientMap = {
  red: {
    light: ['#4F46E5', '#E53E3E', '#F97316'],
    dark: ['#312E81', '#991B1B', '#C2410C'],
  },
  blue: {
    light: ['#4338CA', '#3B82F6', '#38BDF8'],
    dark: ['#1E3A8A', '#1D4ED8', '#0F766E'],
  },
  orange: {
    light: ['#7C3AED', '#F97316', '#F59E0B'],
    dark: ['#4C1D95', '#C2410C', '#92400E'],
  },
  green: {
    light: ['#0F766E', '#22C55E', '#14B8A6'],
    dark: ['#064E3B', '#15803D', '#0F766E'],
  },
} as const;
