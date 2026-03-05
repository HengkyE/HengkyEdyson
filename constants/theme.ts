/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform } from 'react-native';

// POS System Color Scheme - Clean Blue theme
const tintColorLight = '#2563EB'; // Modern blue primary
const tintColorDark = '#3B82F6'; // Lighter blue for dark mode

export const Colors = {
  light: {
    text: '#1E293B', // Dark slate for text
    background: '#F8FAFC', // Clean light gray background
    tint: tintColorLight,
    icon: '#64748B',
    tabIconDefault: '#64748B',
    tabIconSelected: tintColorLight,
    // POS specific colors - Clean Blue palette
    primary: '#2563EB', // Modern blue (#2563EB)
    primaryLight: '#60A5FA', // Light blue
    primaryDark: '#1D4ED8', // Darker blue
    secondary: '#0EA5E9', // Sky blue for secondary actions
    accent: '#F59E0B', // Amber for accents
    success: '#10B981', // Green for success
    warning: '#F59E0B', // Amber for warnings
    error: '#EF4444', // Red for errors
    cardBackground: '#FFFFFF',
    gradientStart: '#1D4ED8', // Gradient start (darker blue)
    gradientEnd: '#3B82F6', // Gradient end (lighter blue)
  },
  dark: {
    text: '#F1F5F9',
    background: '#0F172A', // Dark slate background
    tint: tintColorDark,
    icon: '#94A3B8',
    tabIconDefault: '#94A3B8',
    tabIconSelected: tintColorDark,
    // POS specific colors - Clean Blue palette (dark mode)
    primary: '#3B82F6',
    primaryLight: '#60A5FA',
    primaryDark: '#2563EB',
    secondary: '#38BDF8',
    accent: '#FBBF24',
    success: '#34D399',
    warning: '#FBBF24',
    error: '#F87171',
    cardBackground: '#1E293B',
    gradientStart: '#1E40AF',
    gradientEnd: '#2563EB',
  },
};

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
