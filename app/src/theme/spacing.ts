/**
 * Layout tokens from DESIGN.md — 4pt grid, border radius, shadows.
 */

/** 4-point spacing grid. All spacing uses multiples of 4. */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 24,
  xl: 32,
  '2xl': 48,
  '3xl': 64,
} as const;

/** Border radius tokens. Nothing should have sharp corners. */
export const radius = {
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  full: 9999,
} as const;

/** Dark mode shadows — subtle reinforcement, not primary separation. */
export const darkShadows = {
  sm: {
    shadowColor: 'hsl(260, 40%, 4%)',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 2,
  },
  md: {
    shadowColor: 'hsl(260, 40%, 4%)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 4,
  },
  lg: {
    shadowColor: 'hsl(260, 40%, 4%)',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 8,
  },
} as const;

/** Light mode shadows — lighter, warmer. */
export const lightShadows = {
  sm: {
    shadowColor: 'hsl(255, 30%, 30%)',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  md: {
    shadowColor: 'hsl(255, 30%, 30%)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 4,
  },
  lg: {
    shadowColor: 'hsl(255, 30%, 30%)',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 24,
    elevation: 8,
  },
} as const;
