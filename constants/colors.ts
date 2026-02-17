// ============================================
// THEME COLOR DEFINITIONS
// ============================================
// This file contains all color schemes for the app
// We have two themes: light mode and dark mode
// Each theme has colors for backgrounds, text, buttons, etc.

// ============================================
// LIGHT THEME
// ============================================
// Colors used when the app is in light mode (default)
export const lightTheme = {
  // Main background color of the app
  background: '#E0E7FF',
  
  // Background color for cards (slightly transparent white)
  cardBackground: 'rgba(255, 255, 255, 0.95)',
  
  // Solid white background for certain cards
  card: '#fff',
  
  // Primary text color (dark, easy to read)
  text: '#1a1a1a',
  
  // Secondary text color (slightly lighter, for less important text)
  textSecondary: '#666',
  
  // Tertiary text color (even lighter, for hints or placeholders)
  textTertiary: '#999',
  
  // Main brand/accent color (purple-blue)
  primary: '#667eea',
  
  // Darker version of primary color
  primaryDark: '#764ba2',
  
  // Gradient colors (for smooth color transitions)
  gradientStart: '#667eea',
  gradientMid: '#764ba2',
  gradientEnd: '#f093fb',
  
  // Status colors
  success: '#10b981', // Green for correct/success
  warning: '#f59e0b', // Orange for warnings
  error: '#ef4444',   // Red for errors/incorrect
  
  // Border color for dividing elements
  border: '#e0e0e0',
  
  // Shadow color (for depth effects)
  shadow: '#000',
  
  // Semi-transparent overlay for modals
  modalOverlay: 'rgba(0, 0, 0, 0.6)',
  
  // Pure white (used for icons/text on colored backgrounds)
  white: '#fff',
  
  // Background for stats cards
  statsCard: 'rgba(255, 255, 255, 0.95)',
  
  // Gradient colors for profile cards (array of 3 colors)
  // "as const" tells TypeScript these are fixed values (readonly tuple)
  // This is required for LinearGradient component
  profileCard: ['#E0E7FF', '#F3E8FF', '#FFF1F2'] as const,
  
  // Gradient for score display (green shades)
  scoreGradient: ['#0d9668', '#047857'] as const,
  
  // Gradient for deck cards (deeper violet for contrast against purple bg)
  deckGradient: ['#a855f7', '#7e22ce'] as const,
  
  // Gradient for arena/battle mode (orange shades)
  arenaGradient: ['#f97316', '#dc2626'] as const,
  
  // Arena dark surface colors
  arenaSurface: 'rgba(255, 255, 255, 0.95)',
  arenaTableSurface: 'rgba(0, 50, 35, 0.3)',
  arenaOverlay: 'rgba(255, 255, 255, 0.18)',
  
  // Gradient for quest mode (indigo shades)
  questGradient: ['#4f46e5', '#4338ca'] as const,
  
  // Background for deck cards
  deckCardBg: 'rgba(255, 255, 255, 0.95)',
  
  // Background for deck selection options
  deckOption: '#e8eaf0',
  
  // Semi-transparent surface for profile stats
  profileStatSurface: 'rgba(255, 255, 255, 0.15)',
  
  // Background for profile tabs
  profileTabBackground: 'rgba(255, 255, 255, 0.65)',
  
  // Gradient for active profile tab
  profileTabActiveGradient: ['#667eea', '#764ba2'] as const,
  
  // Text color for inactive tabs
  profileTabInactiveText: '#666',
  
  // Text color for active tabs
  profileTabActiveText: '#fff',
  
  // Icon color for inactive tabs
  profileTabIconInactive: '#666',
  
  // Gradient for locked/incomplete achievements
  achievementBaseGradient: ['#E0E7FF', '#C7D2FE'] as const,
  
  // Gradient for unlocked/completed achievements
  achievementCompletedGradient: ['#D1FAE5', '#A7F3D0'] as const,
  
  // Color for bottom sheet handle indicator
  sheetHandle: 'rgba(15, 23, 42, 0.12)',
};

// ============================================
// DARK THEME
// ============================================
// Colors used when the app is in dark mode
export const darkTheme = {
  // Main background color (very dark blue)
  background: '#0f172a',
  
  // Background color for cards (lighter dark blue)
  cardBackground: '#1e293b',
  
  // Solid card background
  card: '#1e293b',
  
  // Primary text color (light, easy to read on dark)
  text: '#f1f5f9',
  
  // Secondary text color (slightly darker)
  textSecondary: '#cbd5e1',
  
  // Tertiary text color (even darker)
  textTertiary: '#94a3b8',
  
  // Main brand/accent color (brighter purple for dark mode)
  primary: '#8b5cf6',
  
  // Darker version of primary color
  primaryDark: '#7c3aed',
  
  // Gradient colors for dark mode (darker transitions)
  gradientStart: '#1e293b',
  gradientMid: '#334155',
  gradientEnd: '#0f172a',
  
  // Status colors (same as light mode for consistency)
  success: '#10b981',
  warning: '#f59e0b',
  error: '#ef4444',
  
  // Border color (lighter than background for visibility)
  border: '#334155',
  
  // Shadow color
  shadow: '#000',
  
  // Semi-transparent overlay (darker for dark mode)
  modalOverlay: 'rgba(0, 0, 0, 0.8)',
  
  // Pure white
  white: '#fff',
  
  // Background for stats cards
  statsCard: '#1e293b',
  
  // Gradient colors for profile cards (dark shades)
  profileCard: ['#111827', '#1f2937', '#312e81'] as const,
  
  // Gradient for score display (muted green, secondary)
  scoreGradient: ['#0d9668', '#047857'] as const,
  
  // Gradient for deck cards (deeper violet for contrast)
  deckGradient: ['#a855f7', '#7e22ce'] as const,
  
  // Gradient for arena/battle mode (darker amber for dark mode)
  arenaGradient: ['#78350f', '#451a03'] as const,
  
  // Arena dark surface colors
  arenaSurface: '#1e293b',
  arenaTableSurface: 'rgba(0, 30, 20, 0.6)',
  arenaOverlay: 'rgba(255, 255, 255, 0.08)',
  
  // Gradient for quest mode
  questGradient: ['#8b5cf6', '#7c3aed'] as const,
  
  // Background for deck cards
  deckCardBg: '#1e293b',
  
  // Background for deck selection options
  deckOption: '#2d3748',
  
  // Semi-transparent surface for profile stats
  profileStatSurface: 'rgba(148, 163, 184, 0.14)',
  
  // Background for profile tabs
  profileTabBackground: 'rgba(15, 23, 42, 0.75)',
  
  // Gradient for active profile tab
  profileTabActiveGradient: ['#6366f1', '#7c3aed'] as const,
  
  // Text color for inactive tabs
  profileTabInactiveText: '#94a3b8',
  
  // Text color for active tabs
  profileTabActiveText: '#e0e7ff',
  
  // Icon color for inactive tabs
  profileTabIconInactive: '#94a3b8',
  
  // Gradient for locked/incomplete achievements
  achievementBaseGradient: ['#1f2937', '#111827'] as const,
  
  // Gradient for unlocked/completed achievements
  achievementCompletedGradient: ['#134e4a', '#0f766e'] as const,
  
  // Color for bottom sheet handle indicator
  sheetHandle: 'rgba(148, 163, 184, 0.35)',
};

// ============================================
// THEME TYPE
// ============================================
// TypeScript type that ensures both themes have the same structure
// This prevents typos and ensures consistency between light and dark themes
// We use a flexible type for arrays to allow different values in light/dark
export type Theme = {
  background: string;
  cardBackground: string;
  card: string;
  text: string;
  textSecondary: string;
  textTertiary: string;
  primary: string;
  primaryDark: string;
  gradientStart: string;
  gradientMid: string;
  gradientEnd: string;
  success: string;
  warning: string;
  error: string;
  border: string;
  shadow: string;
  modalOverlay: string;
  white: string;
  statsCard: string;
  profileCard: readonly [string, string, string];
  scoreGradient: readonly [string, string];
  deckGradient: readonly [string, string];
  arenaGradient: readonly [string, string];
  questGradient: readonly [string, string];
  deckCardBg: string;
  deckOption: string;
  profileStatSurface: string;
  profileTabBackground: string;
  profileTabActiveGradient: readonly [string, string];
  profileTabInactiveText: string;
  profileTabActiveText: string;
  profileTabIconInactive: string;
  achievementBaseGradient: readonly [string, string];
  achievementCompletedGradient: readonly [string, string];
  sheetHandle: string;
  arenaSurface: string;
  arenaTableSurface: string;
  arenaOverlay: string;
};
