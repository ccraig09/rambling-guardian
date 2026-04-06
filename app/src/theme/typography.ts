/**
 * Typography tokens from DESIGN.md.
 * Typeface: Plus Jakarta Sans — geometric sans with rounded terminals.
 */
import {
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';

/** Pass this object to useFonts() in root layout. */
export const fonts = {
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
};

/** Font family names for use in styles. */
export const fontFamily = {
  medium: 'PlusJakartaSans_500Medium',
  semibold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
  extrabold: 'PlusJakartaSans_800ExtraBold',
} as const;

/**
 * Type scale from DESIGN.md.
 * Each entry is a complete React Native TextStyle-compatible object.
 * Usage: <Text style={typeScale.hero}>4.2s</Text>
 */
export const typeScale = {
  hero: {
    fontFamily: fontFamily.extrabold,
    fontSize: 44,
    letterSpacing: -2,
  },
  title: {
    fontFamily: fontFamily.extrabold,
    fontSize: 28,
    letterSpacing: -1,
  },
  heading: {
    fontFamily: fontFamily.bold,
    fontSize: 20,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontFamily: fontFamily.semibold,
    fontSize: 16,
    letterSpacing: 0,
  },
  body: {
    fontFamily: fontFamily.medium,
    fontSize: 15,
    letterSpacing: 0,
    lineHeight: 22.5, // 1.5x
  },
  small: {
    fontFamily: fontFamily.medium,
    fontSize: 13,
    letterSpacing: 0.1,
    lineHeight: 19.5, // 1.5x
  },
  caption: {
    fontFamily: fontFamily.medium,
    fontSize: 12,
    letterSpacing: 0.2,
  },
} as const;
