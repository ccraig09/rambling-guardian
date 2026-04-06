import { useColorScheme } from 'react-native';
import {
  primary, alert, semantic,
  darkSurfaces, lightSurfaces,
  darkText, lightText,
  darkSemanticSurfaces, lightSemanticSurfaces,
} from './colors';
import { typeScale, fontFamily } from './typography';
import { spacing, radius, darkShadows, lightShadows } from './spacing';
import { useSettingsStore } from '../stores/settingsStore';

/** Composed dark theme — primary design target. */
export const darkTheme = {
  dark: true as const,
  colors: darkSurfaces,
  text: darkText,
  primary,
  alert,
  semantic,
  semanticSurfaces: darkSemanticSurfaces,
  type: typeScale,
  fontFamily,
  spacing,
  radius,
  shadows: darkShadows,
} as const;

/** Composed light theme — adaptation of dark. */
export const lightTheme = {
  dark: false as const,
  colors: lightSurfaces,
  text: lightText,
  primary,
  alert,
  semantic,
  semanticSurfaces: lightSemanticSurfaces,
  type: typeScale,
  fontFamily,
  spacing,
  radius,
  shadows: lightShadows,
} as const;

export type Theme = typeof darkTheme | typeof lightTheme;

/**
 * Returns the resolved theme based on user preference.
 * Reads from settingsStore ('dark' | 'light' | 'system').
 * When 'system', uses device color scheme. Falls back to dark.
 */
export function useTheme(): Theme {
  const preference = useSettingsStore((s) => s.theme);
  const systemScheme = useColorScheme();

  if (preference === 'dark') return darkTheme;
  if (preference === 'light') return lightTheme;
  // 'system' — respect device setting, default dark
  return systemScheme === 'light' ? lightTheme : darkTheme;
}
