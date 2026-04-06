/**
 * Color tokens from DESIGN.md — Rambling Guardian visual identity.
 * All values are HSL strings (React Native supports hsl() natively).
 * Dark mode is primary. Light mode is the adaptation.
 */

// --- Primary: Warm Indigo ---
export const primary = {
  50: 'hsl(255, 30%, 96%)',
  100: 'hsl(255, 35%, 90%)',
  200: 'hsl(255, 38%, 82%)',
  300: 'hsl(255, 42%, 75%)',
  400: 'hsl(255, 45%, 65%)',
  500: 'hsl(255, 45%, 55%)',  // Base — buttons, active tab, brand accents
  600: 'hsl(255, 45%, 48%)',
  700: 'hsl(255, 45%, 42%)',
  800: 'hsl(255, 46%, 35%)',
  900: 'hsl(255, 48%, 28%)',
  950: 'hsl(255, 50%, 22%)',
} as const;

// --- Alert levels (maps 1:1 to firmware) ---
export const alert = {
  safe: 'hsl(142, 52%, 45%)',       // ALERT_NONE  < 7s
  gentle: 'hsl(45, 85%, 52%)',      // ALERT_GENTLE  7s
  moderate: 'hsl(25, 80%, 52%)',    // ALERT_MODERATE 15s
  urgent: 'hsl(0, 68%, 52%)',       // ALERT_URGENT  30s
  critical: 'hsl(0, 68%, 42%)',     // ALERT_CRITICAL 60s+
} as const;

// --- Semantic ---
export const semantic = {
  success: 'hsl(152, 45%, 45%)',
  warning: 'hsl(38, 80%, 52%)',
  error: 'hsl(0, 65%, 55%)',
} as const;

// --- Dark mode surfaces (primary theme) ---
export const darkSurfaces = {
  bg: 'hsl(260, 18%, 8%)',
  surface: 'hsl(260, 16%, 11%)',
  card: 'hsl(260, 14%, 15%)',
  elevated: 'hsl(260, 12%, 20%)',
  overlay: 'hsl(260, 10%, 26%)',
} as const;

// --- Light mode surfaces ---
export const lightSurfaces = {
  bg: 'hsl(255, 20%, 97%)',
  surface: 'hsl(255, 22%, 95%)',
  card: 'hsl(255, 25%, 99%)',
  elevated: 'hsl(0, 0%, 100%)',
  overlay: 'hsl(0, 0%, 100%)',
} as const;

// --- Dark mode text ---
export const darkText = {
  primary: 'hsl(0, 0%, 95%)',
  secondary: 'hsl(0, 0%, 78%)',
  tertiary: 'hsl(255, 15%, 58%)',
  muted: 'hsl(255, 12%, 42%)',
  onColor: 'hsl(0, 0%, 100%)',
  brand: 'hsl(255, 80%, 78%)',
} as const;

// --- Light mode text ---
export const lightText = {
  primary: 'hsl(260, 25%, 12%)',
  secondary: 'hsl(255, 15%, 35%)',
  tertiary: 'hsl(255, 12%, 50%)',
  muted: 'hsl(255, 10%, 65%)',
  onColor: 'hsl(0, 0%, 100%)',
  brand: 'hsl(255, 55%, 48%)',
} as const;

// --- Semantic surfaces (dark mode uses alpha, light uses solid) ---
export const darkSemanticSurfaces = {
  success: 'hsla(152, 45%, 45%, 0.12)',
  warning: 'hsla(38, 80%, 52%, 0.12)',
  error: 'hsla(0, 65%, 55%, 0.12)',
} as const;

export const lightSemanticSurfaces = {
  success: 'hsl(152, 40%, 95%)',
  warning: 'hsl(38, 70%, 95%)',
  error: 'hsl(0, 60%, 96%)',
} as const;
