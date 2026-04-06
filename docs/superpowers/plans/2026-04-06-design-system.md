# RG-C.3.5 Design System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace placeholder theme tokens with the full DESIGN.md visual identity (indigo dark-first, Plus Jakarta Sans, 4pt grid) and create the Figma token library + component primitives + 6 feature designs.

**Architecture:** Theme tokens live in `src/theme/` as typed TypeScript objects. A `useTheme()` hook reads the user's theme preference from settingsStore and returns the resolved dark/light theme. Figma work creates the parallel visual source of truth using Figma variables + auto-layout components.

**Tech Stack:** TypeScript, React Native (Expo 54), expo-font, @expo-google-fonts/plus-jakarta-sans, Zustand, Figma Plugin API (via figma skills)

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Replace | `src/theme/colors.ts` | Full dark + light color tokens from DESIGN.md |
| Create | `src/theme/typography.ts` | Font family, size scale, weights, tracking |
| Create | `src/theme/spacing.ts` | 4pt grid, border radius, shadows |
| Create | `src/theme/theme.ts` | Dark/light theme composition + useTheme hook |
| Create | `src/theme/index.ts` | Re-export public API |
| Create | `src/theme/__tests__/theme.test.ts` | Theme parity + token completeness tests |
| Modify | `app/_layout.tsx` | Font loading via useFonts |
| Modify | `app/(tabs)/_layout.tsx` | Apply new theme tokens to tab bar |
| Modify | `app.json` | Splash background color update |

---

### Task 1: Color Tokens

Replace the placeholder `colors.ts` with the full DESIGN.md HSL color system for both dark and light modes.

**Files:**
- Replace: `app/src/theme/colors.ts`

- [ ] **Step 1: Replace colors.ts with full token system**

```typescript
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
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /Users/carlos/Workspace/rambling-guardian/app && npx tsc --noEmit 2>&1 | head -20`

Expected: Type errors in files that import old `colors.accent` etc. (fixed in Task 5). No errors in colors.ts itself.

- [ ] **Step 3: Commit**

```bash
git add app/src/theme/colors.ts
git commit -m "feat(theme): replace placeholder colors with DESIGN.md HSL tokens"
```

---

### Task 2: Typography Tokens + Font Installation

Install Plus Jakarta Sans and define the type scale from DESIGN.md.

**Files:**
- Create: `app/src/theme/typography.ts`

- [ ] **Step 1: Install Plus Jakarta Sans**

Run: `cd /Users/carlos/Workspace/rambling-guardian/app && npx expo install expo-font @expo-google-fonts/plus-jakarta-sans`

- [ ] **Step 2: Create typography.ts**

```typescript
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
```

- [ ] **Step 3: Commit**

```bash
git add app/src/theme/typography.ts app/package.json app/package-lock.json
git commit -m "feat(theme): add Plus Jakarta Sans font + type scale tokens"
```

---

### Task 3: Spacing, Radius, and Shadow Tokens

**Files:**
- Create: `app/src/theme/spacing.ts`

- [ ] **Step 1: Create spacing.ts**

```typescript
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
```

- [ ] **Step 2: Commit**

```bash
git add app/src/theme/spacing.ts
git commit -m "feat(theme): add spacing grid, radius, and shadow tokens"
```

---

### Task 4: Theme Composition + useTheme Hook

Compose all tokens into dark/light theme objects and expose a `useTheme()` hook that reads the user's preference from settingsStore.

**Files:**
- Create: `app/src/theme/theme.ts`
- Replace: `app/src/theme/index.ts` (create as barrel export)
- Create: `app/src/theme/__tests__/theme.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// app/src/theme/__tests__/theme.test.ts
import { darkTheme, lightTheme } from '../theme';

describe('Theme parity', () => {
  it('dark and light themes have identical top-level keys', () => {
    const darkKeys = Object.keys(darkTheme).sort();
    const lightKeys = Object.keys(lightTheme).sort();
    expect(darkKeys).toEqual(lightKeys);
  });

  it('dark and light color tokens have identical keys', () => {
    const darkColorKeys = Object.keys(darkTheme.colors).sort();
    const lightColorKeys = Object.keys(lightTheme.colors).sort();
    expect(darkColorKeys).toEqual(lightColorKeys);
  });

  it('dark and light text tokens have identical keys', () => {
    const darkTextKeys = Object.keys(darkTheme.text).sort();
    const lightTextKeys = Object.keys(lightTheme.text).sort();
    expect(darkTextKeys).toEqual(lightTextKeys);
  });

  it('dark and light shadow tokens have identical keys', () => {
    const darkShadowKeys = Object.keys(darkTheme.shadows).sort();
    const lightShadowKeys = Object.keys(lightTheme.shadows).sort();
    expect(darkShadowKeys).toEqual(lightShadowKeys);
  });

  it('all surface tokens are HSL strings', () => {
    const hslPattern = /^hsla?\(/;
    for (const [key, value] of Object.entries(darkTheme.colors)) {
      expect(value).toMatch(hslPattern);
    }
  });

  it('alert tokens match firmware levels', () => {
    expect(darkTheme.alert).toHaveProperty('safe');
    expect(darkTheme.alert).toHaveProperty('gentle');
    expect(darkTheme.alert).toHaveProperty('moderate');
    expect(darkTheme.alert).toHaveProperty('urgent');
    expect(darkTheme.alert).toHaveProperty('critical');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/carlos/Workspace/rambling-guardian/app && npx jest src/theme/__tests__/theme.test.ts --no-cache 2>&1 | tail -10`

Expected: FAIL — `Cannot find module '../theme'`

- [ ] **Step 3: Create theme.ts**

```typescript
// app/src/theme/theme.ts
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

export type Theme = typeof darkTheme;

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
```

- [ ] **Step 4: Create index.ts barrel export**

```typescript
// app/src/theme/index.ts
export { primary, alert, semantic } from './colors';
export { typeScale, fontFamily, fonts } from './typography';
export { spacing, radius } from './spacing';
export { darkTheme, lightTheme, useTheme } from './theme';
export type { Theme } from './theme';
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd /Users/carlos/Workspace/rambling-guardian/app && npx jest src/theme/__tests__/theme.test.ts --no-cache 2>&1 | tail -15`

Expected: All 6 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add app/src/theme/theme.ts app/src/theme/index.ts app/src/theme/__tests__/theme.test.ts
git commit -m "feat(theme): compose dark/light themes with useTheme hook"
```

---

### Task 5: Wire Up Font Loading + Update Layouts

Load fonts in root layout, update tab bar and error/loading screens to use new tokens.

**Files:**
- Modify: `app/app/_layout.tsx`
- Modify: `app/app/(tabs)/_layout.tsx`
- Modify: `app/app.json` (splash background)

- [ ] **Step 1: Update root layout with font loading**

Replace the full contents of `app/app/_layout.tsx` with:

```typescript
import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, Text, ActivityIndicator, Pressable } from 'react-native';
import { useFonts } from 'expo-font';
import { getDatabase } from '../src/db/database';
import { fonts } from '../src/theme/typography';
import { useTheme } from '../src/theme/theme';

export default function RootLayout() {
  const [dbReady, setDbReady] = useState(false);
  const [dbError, setDbError] = useState(false);
  const [fontsLoaded] = useFonts(fonts);
  const theme = useTheme();

  const initDb = () => {
    setDbError(false);
    getDatabase()
      .then(() => setDbReady(true))
      .catch((err) => {
        console.error('[DB] Init failed:', err);
        setDbError(true);
      });
  };

  useEffect(() => {
    initDb();
  }, []);

  if (dbError) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.bg, padding: theme.spacing.lg }}>
        <Text style={[theme.type.subtitle, { color: theme.semantic.error, marginBottom: theme.spacing.sm }]}>
          Database Error
        </Text>
        <Text style={[theme.type.small, { color: theme.text.secondary, textAlign: 'center', marginBottom: theme.spacing.lg }]}>
          Failed to initialize the database. Try again or restart the app.
        </Text>
        <Pressable
          onPress={initDb}
          style={{ backgroundColor: theme.primary[500], paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md, borderRadius: theme.radius.md }}
        >
          <Text style={[theme.type.subtitle, { color: theme.text.onColor }]}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  if (!dbReady || !fontsLoaded) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.bg }}>
        <ActivityIndicator size="large" color={theme.primary[500]} />
        <Text style={[theme.type.small, { color: theme.text.secondary, marginTop: theme.spacing.md }]}>Loading...</Text>
      </View>
    );
  }

  return (
    <>
      <StatusBar style={theme.dark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="onboarding" options={{ presentation: 'modal' }} />
      </Stack>
    </>
  );
}
```

- [ ] **Step 2: Update tab layout**

Replace the full contents of `app/app/(tabs)/_layout.tsx` with:

```typescript
import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { useTheme } from '../../src/theme/theme';

// Placeholder tab icon — will be replaced with proper icons in UI tickets
function TabIcon({ label, focused }: { label: string; focused: boolean }) {
  const theme = useTheme();
  return (
    <Text style={{ fontSize: 20, color: focused ? theme.primary[500] : theme.text.muted }}>
      {label}
    </Text>
  );
}

export default function TabLayout() {
  const theme = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: 'transparent',
          borderTopWidth: 0,
        },
        tabBarActiveTintColor: theme.primary[500],
        tabBarInactiveTintColor: theme.text.muted,
        tabBarLabelStyle: {
          fontFamily: theme.fontFamily.medium,
          fontSize: 11,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ focused }) => <TabIcon label="&#x2302;" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="session"
        options={{
          title: 'Session',
          tabBarIcon: ({ focused }) => <TabIcon label="&#x25CF;" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="exercises"
        options={{
          title: 'Exercises',
          tabBarIcon: ({ focused }) => <TabIcon label="&#x266A;" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
          tabBarIcon: ({ focused }) => <TabIcon label="&#x2630;" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ focused }) => <TabIcon label="&#x2699;" focused={focused} />,
        }}
      />
    </Tabs>
  );
}
```

- [ ] **Step 3: Update app.json splash background**

Change the splash background from `#0F172A` to the dark mode `bg` equivalent. HSL(260, 18%, 8%) converts to approximately `#161220`.

In `app/app.json`, change:
```json
"backgroundColor": "#0F172A"
```
to:
```json
"backgroundColor": "#161220"
```

- [ ] **Step 4: Run TypeScript check**

Run: `cd /Users/carlos/Workspace/rambling-guardian/app && npx tsc --noEmit 2>&1 | head -20`

Expected: No errors (or only pre-existing ones unrelated to theme).

- [ ] **Step 5: Run all tests**

Run: `cd /Users/carlos/Workspace/rambling-guardian/app && npx jest --no-cache 2>&1 | tail -15`

Expected: All tests pass (theme parity tests + existing BLE tests).

- [ ] **Step 6: Commit**

```bash
git add app/app/_layout.tsx app/app/\(tabs\)/_layout.tsx app/app.json
git commit -m "feat(theme): wire up font loading + apply indigo theme to layouts"
```

---

### Task 6: Figma Token Library

Create Figma variables matching every token in DESIGN.md — colors, spacing, typography, radius. Both dark and light mode collections.

**Skill required:** `figma:figma-generate-library`

**Files:**
- Reference: `DESIGN.md` (all token values)

- [ ] **Step 1: Create a new Figma file named "Rambling Guardian — Design System"**

Use the figma:figma-generate-library skill to build the variable library. The skill handles Figma Plugin API calls.

- [ ] **Step 2: Create color variable collections**

Two modes: "Dark" (default) and "Light".

**Variables to create (with dark/light mode values):**

Primary scale: `primary/50` through `primary/950` (11 variables) — same in both modes.

Surfaces: `surface/bg`, `surface/surface`, `surface/card`, `surface/elevated`, `surface/overlay` — dark values from `darkSurfaces`, light values from `lightSurfaces` in DESIGN.md.

Text: `text/primary`, `text/secondary`, `text/tertiary`, `text/muted`, `text/onColor`, `text/brand` — dark values from `darkText`, light from `lightText`.

Alert: `alert/safe`, `alert/gentle`, `alert/moderate`, `alert/urgent`, `alert/critical` — same in both modes.

Semantic: `semantic/success`, `semantic/warning`, `semantic/error` — same in both modes.

Semantic surfaces: `semantic-surface/success`, `semantic-surface/warning`, `semantic-surface/error` — dark uses alpha, light uses solid (from DESIGN.md).

- [ ] **Step 3: Create spacing variable collection**

Number variables: `spacing/xs` (4), `spacing/sm` (8), `spacing/md` (12), `spacing/base` (16), `spacing/lg` (24), `spacing/xl` (32), `spacing/2xl` (48), `spacing/3xl` (64).

- [ ] **Step 4: Create radius variable collection**

Number variables: `radius/sm` (6), `radius/md` (8), `radius/lg` (12), `radius/xl` (16), `radius/full` (9999).

- [ ] **Step 5: Create typography reference frame**

Since Figma variables don't support composite text styles, create a reference frame showing the type scale with Plus Jakarta Sans:
- Each row: token name, size, weight, tracking, sample text
- Font: Plus Jakarta Sans (available in Figma from Google Fonts)

- [ ] **Step 6: Verify all variables are bound to both modes**

Switch between Dark and Light modes in Figma. Every surface, text, and semantic surface variable should change values. Primary, alert, and semantic colors stay the same in both modes.

- [ ] **Step 7: Commit Figma URL to project**

Add the Figma file URL to DESIGN.md under a new "Figma" section at the top.

```bash
git add DESIGN.md
git commit -m "feat(design): add Figma token library with dark/light mode variables"
```

---

### Task 7: Figma Component Primitives

Build 7 atomic components in Figma using auto-layout and bound to the token variables from Task 6. Each component must work in both dark and light modes by switching the variable mode.

**Skill required:** `figma:figma-use`

- [ ] **Step 1: Button component**

4 variants (primary, secondary, destructive, ghost) x 2 states (default, pressed).
- Auto-layout: horizontal, padding 12/24, gap 8
- Height: 48dp minimum
- Radius: `radius/md` (8)
- Typography: `subtitle` (16sp semibold)
- Primary: `primary/500` fill, `text/onColor` text
- Secondary: `surface/elevated` fill, `text/secondary` text
- Destructive: `semantic/error` at 15% opacity fill, `semantic/error` text
- Ghost: no fill, `text/tertiary` text

- [ ] **Step 2: Card component**

Base card container with auto-layout.
- Fill: `surface/card`
- Radius: `radius/xl` (16)
- Padding: `spacing/base` (16) all sides
- No stroke — surface stepping handles separation
- Variant: default (no shadow), interactive (shadow/sm)

- [ ] **Step 3: Badge component**

3 variants: alert badge, streak badge, status dot.
- Alert badge: alert color fill at 15% opacity, alert color text, radius/sm, padding 4/8
- Streak badge: `primary/500` fill, white text, radius/sm, padding 4/8
- Status dot: 8x8 circle, semantic color fill

- [ ] **Step 4: Input component**

Filled input field.
- Fill: `surface/elevated`
- Height: 48dp
- Radius: `radius/md` (8)
- Padding: `spacing/md` horizontal
- Placeholder text: `text/muted`, body size
- Value text: `text/primary`, body size
- Variant: default, focused (2dp bottom border in `primary/500`)

- [ ] **Step 5: Toggle/Switch component**

- Track off: `surface/overlay` fill
- Track on: `primary/500` fill
- Thumb: white circle
- Size: 48w x 28h

- [ ] **Step 6: TimerDisplay component**

The hero number display.
- Text: `hero` scale (44sp extrabold, -2 tracking)
- Color: `text/primary`
- Sub-label below: `caption` scale, `text/tertiary`
- Auto-layout: vertical, center-aligned, gap 4

- [ ] **Step 7: ProgressRing component**

Circular arc indicator for alert level.
- Circle: 160x160
- Stroke: 10dp
- Background track: `surface/elevated`
- Active arc: alert color (variants for each level)
- Center: TimerDisplay component (nested)
- Glow variants: none (safe), faint ambient (gentle/moderate), pulsing (urgent/critical)

- [ ] **Step 8: Verify both modes**

Switch the page to Light mode. Every component should adapt automatically via variable bindings. Screenshot dark, screenshot light, compare.

- [ ] **Step 9: Commit**

```bash
git add DESIGN.md
git commit -m "feat(design): add 7 Figma component primitives with dark/light modes"
```

---

### Task 8: Feature Design — Exercise Card with Step Timer

The core daily interaction. User sees this card, taps to start, follows timed steps.

**Skill required:** `figma:figma-use`

- [ ] **Step 1: Design the exercise card**

Compose from primitives (Card, Badge, Button, TimerDisplay).

**Layout (auto-layout, vertical):**
- Category badge top-left (e.g., "Breathing" in alert.safe tint)
- Title: `subtitle` (16sp semibold), `text/primary`
- Description: `small` (13sp), `text/secondary`, 2 lines max
- Duration + difficulty row: `caption`, `text/tertiary` (e.g., "3 min · Beginner")
- Divider: 1px `surface/overlay`
- Step timer section (expanded state):
  - Current step instruction: `body` (15sp), `text/primary`
  - Step progress: "Step 2 of 4" in `caption`, `text/tertiary`
  - Circular timer: ProgressRing at small size (80x80), counting down
  - Next/Skip button: ghost variant

**States:** collapsed (list view), expanded (active exercise), completed (checkmark + rating prompt)

- [ ] **Step 2: Design both dark and light mode**

Switch variable mode. Verify readability, hierarchy, contrast.

- [ ] **Step 3: Self-critique**

Take screenshot. Check against DESIGN.md:
- One hero element? (the timer)
- Clear hierarchy? (title > description > metadata)
- 44dp touch targets?
- No visible borders?
- Alert colors used only for category badge, not decoration?

Fix any issues.

---

### Task 9: Feature Design — Alert Level Indicator

The real-time feedback element. The hero of the dashboard screen.

**Skill required:** `figma:figma-use`

- [ ] **Step 1: Design the alert indicator**

**Layout:**
- ProgressRing component: 200x200, centered
- Inner: speech duration as `hero` text (e.g., "12.4s")
- Below ring: alert level label in `small`, current alert color (e.g., "Gentle" in yellow)
- Below label: session duration in `caption`, `text/muted` (e.g., "Session: 4m 32s")
- Background glow: large blurred circle behind ring in alert color at 8% opacity

**Variants:** 5 states matching alert levels:
- Safe: green ring, no glow
- Gentle: yellow ring, faint yellow glow
- Moderate: orange ring, faint orange glow
- Urgent: red ring, red glow (note: slow pulse in implementation)
- Critical: deep red ring, strong red glow (note: fast pulse in implementation)

- [ ] **Step 2: Design both modes + all 5 alert states**

10 variants total (5 alerts x 2 themes).

- [ ] **Step 3: Self-critique**

Is the ring the clear hero? Does the glow add urgency without being jarring? Does the transition from safe→critical feel like escalation?

---

### Task 10: Feature Design — Session Stats Card

The history list item. Shows one completed session at a glance.

**Skill required:** `figma:figma-use`

- [ ] **Step 1: Design the session stats card**

**Layout (Card component, horizontal sections):**
- Left column:
  - Date: `caption`, `text/tertiary` (e.g., "Apr 6, 2026")
  - Duration: `heading` (20sp bold), `text/primary` (e.g., "14m 32s")
  - Mode badge: "Solo" or "With Others" — `caption` text in badge
- Right column:
  - Alert breakdown mini-bar: 4 colored segments proportional to time at each level
  - Max alert reached: badge in corresponding alert color
  - Speech segments count: `small`, `text/secondary`

**States:** default, empty (first use — encouraging CTA)

- [ ] **Step 2: Design both modes**

- [ ] **Step 3: Self-critique**

Is the duration the hero of the card? Does the alert mini-bar communicate quickly without needing labels? Is the information density right for scanning a list?

---

### Task 11: Feature Design — Streak Calendar Heat Map

The motivation element. Shows daily consistency.

**Skill required:** `figma:figma-use`

- [ ] **Step 1: Design the streak calendar**

**Layout (Card component):**
- Header row: month/year in `subtitle`, chevron arrows for navigation
- Day grid: 7 columns (S M T W T F S) x 5-6 rows
  - Each cell: 36x36, radius/sm
  - No activity: `surface/elevated` fill
  - Exercises only: `primary/200` fill (light activity)
  - Exercises + session: `primary/500` fill (full activity)
  - Today (no activity yet): `primary/500` border, no fill
- Below grid:
  - Current streak: `heading` (20sp bold), `text/primary` (e.g., "7 days")
  - "Keep it up!" or milestone text: `small`, `text/brand`
  - Legend: 3 small squares with labels

**Milestone states:** Day 3 (getting started), Day 7 (one week), Day 14, Day 30 — each has a subtle accent treatment (e.g., the current streak number uses `text/brand` at milestones).

- [ ] **Step 2: Design both modes**

- [ ] **Step 3: Self-critique**

Does the heat map communicate at a glance? Is the streak number the hero? Is the grid scannable without being overwhelming? Do the activity levels read clearly in both themes?

---

### Task 12: Feature Design — Device Connection Card

The BLE status element. Shows whether the wearable is connected.

**Skill required:** `figma:figma-use`

- [ ] **Step 1: Design the device connection card**

**Layout (Card component):**
- Connected state:
  - Status dot (8dp, `semantic/success`) + "Connected" in `small`, `semantic/success`
  - Device name: `subtitle`, `text/primary` (e.g., "RamblingGuard")
  - Battery: icon + percentage in `small`, `text/secondary` (e.g., "82%")
  - Signal strength indicator: 3 bars
  - "Disconnect" ghost button

- Disconnected state:
  - Status dot (8dp, `text/muted`) + "Not connected" in `small`, `text/muted`
  - "Looking for device..." or "Tap to connect" in `body`, `text/secondary`
  - Primary button: "Connect"
  - Last seen: `caption`, `text/muted` (e.g., "Last seen 5 min ago")

- Connecting state:
  - Spinner + "Connecting..." in `small`, `text/tertiary`
  - Device name below
  - "Cancel" ghost button

- [ ] **Step 2: Design both modes + all 3 connection states**

6 variants total.

- [ ] **Step 3: Self-critique**

Is the connection status immediately obvious? Does connected feel reassuring (not loud)? Does disconnected feel like a gentle nudge (not an error)?

---

### Task 13: Feature Design — Voice Recording Prompt Card

The onboarding voice enrollment element. User records speech samples.

**Skill required:** `figma:figma-use`

- [ ] **Step 1: Design the voice recording card**

**Layout (Card component, spacious padding):**
- Prompt text: `body` (15sp), `text/primary` — the sentence to read aloud
  - e.g., "Read this aloud: 'The quick brown fox jumps over the lazy dog.'"
- Waveform visualization area: 200h, `surface/elevated` bg, centered
  - Idle: flat line in `text/muted`
  - Recording: animated waveform bars in `primary/500`
  - Complete: static waveform in `semantic/success`
- Record button: large circle (64x64), `primary/500` fill, microphone icon
  - Recording state: pulsing red circle, stop icon
- Progress: "Sample 2 of 5" in `caption`, `text/tertiary`
- Bottom: "Skip for now" ghost button (ADHD-friendly — never trap the user)

**States:** idle, recording, complete, all-done (celebratory)

- [ ] **Step 2: Design both modes**

- [ ] **Step 3: Self-critique**

Is the prompt text the focus (not the button)? Is the recording state unmistakable? Does "Skip for now" feel safe to use (not like giving up)? Is the waveform area large enough to feel like something is happening?

---

### Task 14: Design Self-Review Pass

Screenshot every component and feature design. Critique each against DESIGN.md principles. Fix issues.

**Skill required:** `figma:figma-use`

- [ ] **Step 1: Screenshot all dark mode components**

Use `get_screenshot` for each component and feature design in dark mode. Save screenshots for comparison.

- [ ] **Step 2: Critique checklist (dark mode)**

For each design, verify:
- [ ] One hero element per composition?
- [ ] Clear visual hierarchy (title > body > metadata)?
- [ ] Surface stepping for depth, no visible borders?
- [ ] 44dp minimum touch targets?
- [ ] Alert colors used only for alerts, not decoration?
- [ ] Text weights 500+ for text below 14sp?
- [ ] Spacing feels generous (too much > too little)?
- [ ] Primary.500 used for at most one CTA?
- [ ] Plus Jakarta Sans applied everywhere?
- [ ] No pure black or pure white backgrounds?

- [ ] **Step 3: Fix any issues found**

Apply fixes directly in Figma.

- [ ] **Step 4: Switch to Light mode, screenshot all**

- [ ] **Step 5: Critique light mode**

Same checklist plus:
- [ ] Does it feel like the same app?
- [ ] Indigo tint visible in surfaces?
- [ ] Text contrast sufficient on lighter backgrounds?

- [ ] **Step 6: Fix any light mode issues**

- [ ] **Step 7: Final commit**

Update DESIGN.md with any adjustments discovered during review.

```bash
git add DESIGN.md
git commit -m "feat(design): complete Figma feature designs with self-review pass"
```

- [ ] **Step 8: Push to GitHub**

```bash
git push
```
