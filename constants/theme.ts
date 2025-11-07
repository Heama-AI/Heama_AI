/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform } from 'react-native';

const tintColorLight = '#f7c948';
const tintColorDark = '#f7c948';

export const Colors = {
  light: {
    text: '#11181C',
    background: '#fdf8e4',
    tint: tintColorLight,
    icon: '#687076',
    tabIconDefault: '#687076',
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: '#ECEDEE',
    background: '#151718',
    tint: tintColorDark,
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: tintColorDark,
  },
};

export const BrandColors = {
  primary: '#f7c948',
  primaryDark: '#d6a21a',
  secondary: '#9fdb5c',
  accent: '#58b368',
  background: '#fdf8e4',
  surface: '#ffffff',
  surfaceSoft: '#fff3c4',
  textPrimary: '#2f2a19',
  textSecondary: '#6f6542',
  border: '#f0e2b6',
  success: '#55a630',
  danger: '#d95f5f',
  primarySoft: 'rgba(247, 201, 72, 0.18)',
  secondarySoft: 'rgba(159, 219, 92, 0.18)',
  accentSoft: 'rgba(88, 179, 104, 0.18)',
  highlightPrimary: 'rgba(247, 201, 72, 0.26)',
  highlightAccent: 'rgba(140, 193, 102, 0.22)',
  dangerSoft: 'rgba(217, 95, 95, 0.24)',
};

export const Shadows = {
  card: {
    shadowColor: '#b1943a',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 12 },
    shadowRadius: 24,
    elevation: 6,
  },
  floating: {
    shadowColor: '#b1943a',
    shadowOpacity: 0.18,
    shadowOffset: { width: 0, height: 18 },
    shadowRadius: 32,
    elevation: 12,
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
