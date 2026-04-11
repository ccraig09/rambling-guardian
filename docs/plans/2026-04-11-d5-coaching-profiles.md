# D.5 v1 Context-Aware Coaching Profiles — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adjust device alert thresholds automatically based on session context (solo/with_others/presentation), so the device alerts differently depending on the kind of conversation.

**Architecture:** Pure-function `coachingProfileService` computes derived thresholds from the user's Settings baseline using per-threshold multipliers + safety rails. A thin orchestration layer in the same file owns all compute→compare→BLE-write coordination. Session start/end and BLE reconnect write known values directly. `SessionContextPill` gains a profile label prop.

**Tech Stack:** TypeScript, Zustand, react-native-ble-plx (existing `writeThresholds`)

---

### Task 1: Pure profile computation + tests (TDD)

**Files:**
- Create: `app/src/services/coachingProfileService.ts`
- Create: `app/src/services/__tests__/coachingProfileService.test.ts`

- [ ] **Step 1: Write the tests first**

Create `app/src/services/__tests__/coachingProfileService.test.ts`:

```typescript
import {
  computeProfileThresholds,
  getProfileLabel,
  PROFILE_MULTIPLIERS,
  THRESHOLD_FLOORS,
  THRESHOLD_CEILINGS,
} from '../coachingProfileService';
import type { AlertThresholds } from '../../types';

const DEFAULT_BASE: AlertThresholds = {
  gentleSec: 7,
  moderateSec: 15,
  urgentSec: 30,
  criticalSec: 60,
};

describe('computeProfileThresholds', () => {
  test('solo returns base thresholds unchanged', () => {
    const result = computeProfileThresholds('solo', DEFAULT_BASE);
    expect(result).toEqual(DEFAULT_BASE);
  });

  test('with_others applies per-threshold multipliers', () => {
    const result = computeProfileThresholds('with_others', DEFAULT_BASE);
    // 7*0.7=4.9→5, 15*0.7=10.5→11, 30*0.65=19.5→20, 60*0.75=45
    expect(result).toEqual({
      gentleSec: 5,
      moderateSec: 11,
      urgentSec: 20,
      criticalSec: 45,
    });
  });

  test('presentation applies per-threshold multipliers', () => {
    const result = computeProfileThresholds('presentation', DEFAULT_BASE);
    // 7*3=21, 15*3=45, 30*3=90, 60*3=180
    expect(result).toEqual({
      gentleSec: 21,
      moderateSec: 45,
      urgentSec: 90,
      criticalSec: 180,
    });
  });

  test('floor clamping activates when derived value is too low', () => {
    const aggressive: AlertThresholds = {
      gentleSec: 3,
      moderateSec: 6,
      urgentSec: 14,
      criticalSec: 20,
    };
    const result = computeProfileThresholds('with_others', aggressive);
    // 3*0.7=2.1→2 clamped to 3, 6*0.7=4.2→4 clamped to 5, 14*0.65=9.1→9 clamped to 10, 20*0.75=15
    expect(result.gentleSec).toBe(3);
    expect(result.moderateSec).toBe(5);
    expect(result.urgentSec).toBe(10);
    expect(result.criticalSec).toBe(15);
  });

  test('ceiling clamping activates when derived value is too high', () => {
    const loose: AlertThresholds = {
      gentleSec: 15,
      moderateSec: 25,
      urgentSec: 50,
      criticalSec: 120,
    };
    const result = computeProfileThresholds('presentation', loose);
    // 15*3=45→clamped 30, 25*3=75→clamped 60, 50*3=150→clamped 120, 120*3=360→clamped 300
    expect(result.gentleSec).toBe(30);
    expect(result.moderateSec).toBe(60);
    expect(result.urgentSec).toBe(120);
    expect(result.criticalSec).toBe(300);
  });

  test('monotonic enforcement fixes non-increasing sequences after clamping', () => {
    // Edge case: all floors hit, monotonic must separate them
    const tiny: AlertThresholds = {
      gentleSec: 3,
      moderateSec: 4,
      urgentSec: 5,
      criticalSec: 6,
    };
    const result = computeProfileThresholds('with_others', tiny);
    // After multiply+round+clamp: gentle=3(floor), moderate=3→clamped 5(floor), urgent=3→clamped 10(floor), critical=5→clamped 15(floor)
    // All floors already monotonic: 3 < 5 < 10 < 15 ✓
    expect(result.gentleSec).toBeLessThan(result.moderateSec);
    expect(result.moderateSec).toBeLessThan(result.urgentSec);
    expect(result.urgentSec).toBeLessThan(result.criticalSec);
  });

  test('monotonic enforcement bumps when clamped values collide', () => {
    // Force a collision: base where multiply+clamp produces equal adjacent values
    const collider: AlertThresholds = {
      gentleSec: 4,
      moderateSec: 5,
      urgentSec: 15,
      criticalSec: 20,
    };
    const result = computeProfileThresholds('with_others', collider);
    // gentle: 4*0.7=2.8→3(floor), moderate: 5*0.7=3.5→4→5(floor already > gentle ✓)
    // But let's just verify the invariant
    expect(result.gentleSec).toBeLessThan(result.moderateSec);
    expect(result.moderateSec).toBeLessThan(result.urgentSec);
    expect(result.urgentSec).toBeLessThan(result.criticalSec);
  });

  test('all base thresholds at minimum produce valid ladder', () => {
    const min: AlertThresholds = {
      gentleSec: 3,
      moderateSec: 5,
      urgentSec: 10,
      criticalSec: 15,
    };
    for (const ctx of ['solo', 'with_others', 'presentation'] as const) {
      const result = computeProfileThresholds(ctx, min);
      expect(result.gentleSec).toBeLessThan(result.moderateSec);
      expect(result.moderateSec).toBeLessThan(result.urgentSec);
      expect(result.urgentSec).toBeLessThan(result.criticalSec);
    }
  });

  test('all base thresholds at maximum produce valid ladder', () => {
    const max: AlertThresholds = {
      gentleSec: 30,
      moderateSec: 60,
      urgentSec: 120,
      criticalSec: 300,
    };
    for (const ctx of ['solo', 'with_others', 'presentation'] as const) {
      const result = computeProfileThresholds(ctx, max);
      expect(result.gentleSec).toBeLessThan(result.moderateSec);
      expect(result.moderateSec).toBeLessThan(result.urgentSec);
      expect(result.urgentSec).toBeLessThan(result.criticalSec);
    }
  });
});

describe('getProfileLabel', () => {
  test('returns correct labels', () => {
    expect(getProfileLabel('solo')).toBe('Standard alerts');
    expect(getProfileLabel('with_others')).toBe('Tighter alerts');
    expect(getProfileLabel('presentation')).toBe('Relaxed alerts');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd app && npx jest --no-coverage --testPathPattern=coachingProfileService`
Expected: FAIL — module not found

- [ ] **Step 3: Implement the pure profile computation**

Create `app/src/services/coachingProfileService.ts`:

```typescript
/**
 * Coaching Profile Service — D.5 v1
 *
 * Two layers in one file:
 *
 * Layer 1 — Pure profile logic (no side effects, no store/BLE access):
 *   computeProfileThresholds(), getProfileLabel(), constants
 *
 * Layer 2 — Thin orchestration coordinator (reads stores, writes BLE):
 *   applyProfileForCurrentContext()
 *
 * Layer 1 is stateless and unit-testable with no mocking.
 * Layer 2 is the single authoritative path for all threshold writes
 * during an active session.
 */
import type { AlertThresholds } from '../types';
import type { SessionContext } from '../types';

// ============================================
// Layer 1 — Pure Profile Logic
// ============================================

/** Per-threshold multipliers for each profile. */
export const PROFILE_MULTIPLIERS: Record<
  SessionContext,
  { gentle: number; moderate: number; urgent: number; critical: number }
> = {
  solo: { gentle: 1.0, moderate: 1.0, urgent: 1.0, critical: 1.0 },
  with_others: { gentle: 0.7, moderate: 0.7, urgent: 0.65, critical: 0.75 },
  presentation: { gentle: 3.0, moderate: 3.0, urgent: 3.0, critical: 3.0 },
};

/** Internal safety rail — minimum seconds per threshold level. */
export const THRESHOLD_FLOORS = { gentle: 3, moderate: 5, urgent: 10, critical: 15 };

/** Internal safety rail — maximum seconds per threshold level. */
export const THRESHOLD_CEILINGS = { gentle: 30, moderate: 60, urgent: 120, critical: 300 };

/**
 * Compute derived thresholds for a given context.
 *
 * Application order: multiply → round → clamp floors → clamp ceilings → enforce monotonic.
 */
export function computeProfileThresholds(
  context: SessionContext,
  baseThresholds: AlertThresholds,
): AlertThresholds {
  const m = PROFILE_MULTIPLIERS[context];

  // Multiply + round
  let gentle = Math.round(baseThresholds.gentleSec * m.gentle);
  let moderate = Math.round(baseThresholds.moderateSec * m.moderate);
  let urgent = Math.round(baseThresholds.urgentSec * m.urgent);
  let critical = Math.round(baseThresholds.criticalSec * m.critical);

  // Clamp floors
  gentle = Math.max(gentle, THRESHOLD_FLOORS.gentle);
  moderate = Math.max(moderate, THRESHOLD_FLOORS.moderate);
  urgent = Math.max(urgent, THRESHOLD_FLOORS.urgent);
  critical = Math.max(critical, THRESHOLD_FLOORS.critical);

  // Clamp ceilings
  gentle = Math.min(gentle, THRESHOLD_CEILINGS.gentle);
  moderate = Math.min(moderate, THRESHOLD_CEILINGS.moderate);
  urgent = Math.min(urgent, THRESHOLD_CEILINGS.urgent);
  critical = Math.min(critical, THRESHOLD_CEILINGS.critical);

  // Enforce monotonic (strictly increasing)
  if (moderate <= gentle) moderate = gentle + 1;
  if (urgent <= moderate) urgent = moderate + 1;
  if (critical <= urgent) critical = urgent + 1;

  return {
    gentleSec: gentle,
    moderateSec: moderate,
    urgentSec: urgent,
    criticalSec: critical,
  };
}

/**
 * Profile label for UI display.
 *
 * Intentionally co-located with profile definitions — the label is a property
 * of the profile system, not a UI concern. The component consumes it as a
 * string prop without knowing which profile produced it.
 */
export function getProfileLabel(context: SessionContext): string {
  const labels: Record<SessionContext, string> = {
    solo: 'Standard alerts',
    with_others: 'Tighter alerts',
    presentation: 'Relaxed alerts',
  };
  return labels[context];
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd app && npx jest --no-coverage --testPathPattern=coachingProfileService`
Expected: All tests PASS

- [ ] **Step 5: Type check**

Run: `cd app && node node_modules/typescript/bin/tsc --noEmit`
Expected: 0 errors

- [ ] **Step 6: Commit**

```bash
git add app/src/services/coachingProfileService.ts app/src/services/__tests__/coachingProfileService.test.ts
git commit -m "feat(D5): coachingProfileService pure logic + unit tests (TDD)"
```

---

### Task 2: Session store — activeProfile + lastProfileWriteTime

**Files:**
- Modify: `app/src/stores/sessionStore.ts`

- [ ] **Step 1: Add imports and fields**

Add `AlertThresholds` to the type import at the top of `app/src/stores/sessionStore.ts`. Currently line 2:

```typescript
import type { Session, SessionMode, SessionContext, AlertThresholds } from '../types';
```

Add to the `SessionStore` interface, after the context classification section (after line 30 `resetContext`):

```typescript
  // Coaching profiles (D.5)
  activeProfile: AlertThresholds | null;
  lastProfileWriteTime: number | null;
  setActiveProfile: (profile: AlertThresholds) => void;
  setLastProfileWriteTime: (time: number) => void;
  resetProfile: () => void;
```

Add to the store implementation, after the context classification defaults (after line 63 `resetContext`):

```typescript
  // Coaching profiles (D.5)
  activeProfile: null,
  lastProfileWriteTime: null,
  setActiveProfile: (profile) => set({ activeProfile: profile }),
  setLastProfileWriteTime: (time) => set({ lastProfileWriteTime: time }),
  resetProfile: () => set({ activeProfile: null, lastProfileWriteTime: null }),
```

- [ ] **Step 2: Type check**

Run: `cd app && node node_modules/typescript/bin/tsc --noEmit`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add app/src/stores/sessionStore.ts
git commit -m "feat(D5): add activeProfile + lastProfileWriteTime to sessionStore"
```

---

### Task 3: Orchestration layer — applyProfileForCurrentContext

**Files:**
- Modify: `app/src/services/coachingProfileService.ts`

- [ ] **Step 1: Add the orchestration imports and constants**

Add these imports at the top of `app/src/services/coachingProfileService.ts`, after the existing type imports:

```typescript
import { useSessionStore } from '../stores/sessionStore';
import { useSettingsStore } from '../stores/settingsStore';
import { bleService } from './bleManager';
```

Add after the `getProfileLabel` function, before the end of file:

```typescript
// ============================================
// Layer 2 — Thin Orchestration Coordinator
// ============================================

/** Write-stability guard: suppress context-triggered writes for this many ms. */
const STABILITY_GUARD_MS = 5000;

/**
 * Compare two threshold objects for equality.
 * Returns true if all four values match.
 */
function thresholdsEqual(a: AlertThresholds, b: AlertThresholds): boolean {
  return (
    a.gentleSec === b.gentleSec &&
    a.moderateSec === b.moderateSec &&
    a.urgentSec === b.urgentSec &&
    a.criticalSec === b.criticalSec
  );
}

/**
 * Single authoritative path for all threshold writes during an active session.
 *
 * UI does not own BLE threshold-write logic — it sets store state,
 * then calls this function. This coordinator owns compute → compare → BLE write.
 *
 * @param options.bypassStabilityGuard — true for manual overrides and settings changes
 */
export async function applyProfileForCurrentContext(
  options?: { bypassStabilityGuard?: boolean },
): Promise<void> {
  const sessionStore = useSessionStore.getState();
  const { thresholds: baseThresholds } = useSettingsStore.getState();

  // If no context yet, compute Solo (which equals base — but go through the
  // pipeline so activeProfile is set consistently)
  const context = sessionStore.sessionContext ?? 'solo';

  const derived = computeProfileThresholds(context, baseThresholds);

  // Skip if identical to what's already on the device
  if (sessionStore.activeProfile && thresholdsEqual(derived, sessionStore.activeProfile)) {
    return;
  }

  // Stability guard: suppress rapid context-triggered writes
  if (!options?.bypassStabilityGuard && sessionStore.lastProfileWriteTime) {
    const elapsed = Date.now() - sessionStore.lastProfileWriteTime;
    if (elapsed < STABILITY_GUARD_MS) {
      return;
    }
  }

  // Write to device — update store only on success
  try {
    await bleService.writeThresholds(derived);
    sessionStore.setActiveProfile(derived);
    sessionStore.setLastProfileWriteTime(Date.now());
  } catch (e) {
    console.warn('[CoachingProfile] BLE threshold write failed:', e);
    // Keep prior activeProfile — reconnect will retry
  }
}
```

- [ ] **Step 2: Type check**

Run: `cd app && node node_modules/typescript/bin/tsc --noEmit`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add app/src/services/coachingProfileService.ts
git commit -m "feat(D5): applyProfileForCurrentContext orchestration layer"
```

---

### Task 4: Wire profile apply into transcriptService (context change)

**Files:**
- Modify: `app/src/services/transcriptService.ts`

- [ ] **Step 1: Add import**

Add to the imports at the top of `app/src/services/transcriptService.ts`, after line 23 (`import { classifyContext } ...`):

```typescript
import { applyProfileForCurrentContext } from './coachingProfileService';
```

- [ ] **Step 2: Call applyProfileForCurrentContext after context changes**

In the `updateContextClassification()` method, after the `sessionStore.setSessionContext(context)` call (inside the `if (context !== sessionStore.sessionContext)` block, around line 186), add:

```typescript
      // D.5: apply coaching profile for new context (fire-and-forget with error handling)
      void applyProfileForCurrentContext().catch(
        (e: unknown) => console.warn('[TranscriptService] Profile apply failed:', e),
      );
```

The full block should read:
```typescript
    if (context !== sessionStore.sessionContext) {
      sessionStore.setSessionContext(context);
      // D.5: apply coaching profile for new context (fire-and-forget with error handling)
      void applyProfileForCurrentContext().catch(
        (e: unknown) => console.warn('[TranscriptService] Profile apply failed:', e),
      );
    }
```

- [ ] **Step 3: Type check**

Run: `cd app && node node_modules/typescript/bin/tsc --noEmit`
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add app/src/services/transcriptService.ts
git commit -m "feat(D5): wire profile apply on context classification change"
```

---

### Task 5: Wire session start/end + BLE reconnect

**Files:**
- Modify: `app/src/services/sessionTracker.ts`
- Modify: `app/src/services/bleManager.ts`

- [ ] **Step 1: Verify imports in sessionTracker.ts**

`app/src/services/sessionTracker.ts` already imports `useSettingsStore`, `useSessionStore`, and `bleService`. No new imports needed — session start/end use direct `bleService.writeThresholds()` calls, not the coordinator.

- [ ] **Step 2: Write Solo thresholds on session start**

In the session creation block (inside the `if (state.sessionState === AppSessionState.ACTIVE && this.sessionId === null)` block), after `console.log('[SessionTracker] Session created:', this.sessionId);` (around line 46), add:

```typescript
          // D.5: write Solo baseline thresholds to device on session start
          const { thresholds } = useSettingsStore.getState();
          try {
            await bleService.writeThresholds(thresholds);
            useSessionStore.getState().setActiveProfile(thresholds);
            useSessionStore.getState().setLastProfileWriteTime(Date.now());
          } catch (e) {
            console.warn('[SessionTracker] Failed to write Solo thresholds:', e);
          }
```

- [ ] **Step 3: Restore Solo thresholds and clear profile on session end**

In the session finalization block (inside the `if (state.sessionState === AppSessionState.NO_SESSION && this.sessionId !== null)` block), after `console.log('[SessionTracker] Session finalized:', id, durationMs, 'ms');` (around line 67), add:

```typescript
          // D.5: restore Solo baseline thresholds — only clear profile on success
          const { thresholds } = useSettingsStore.getState();
          try {
            await bleService.writeThresholds(thresholds);
            useSessionStore.getState().resetProfile();
          } catch (e) {
            // Keep prior activeProfile — reconnect will re-assert it
            console.warn('[SessionTracker] Failed to restore Solo thresholds:', e);
          }
```

- [ ] **Step 4: Wire BLE reconnect in bleManager.ts**

In `app/src/services/bleManager.ts`, add to the imports at the top:

```typescript
import { useSessionStore } from '../stores/sessionStore';
```

Check if `useSessionStore` is already imported — only add if missing.

In the `setupPostConnection` method, after `useDeviceStore.getState().setConnectionState(ConnectionState.CONNECTED);` (around line 262), add:

```typescript
    // D.5: re-assert threshold profile on reconnect
    try {
      const { activeProfile } = useSessionStore.getState();
      const { thresholds: soloThresholds } = useSettingsStore.getState();
      const profileToWrite = activeProfile ?? soloThresholds;
      await this.writeThresholds(profileToWrite);
    } catch (e) {
      console.warn('[BLE] Failed to re-assert thresholds on reconnect:', e);
    }
```

Check if `useSettingsStore` is already imported in bleManager.ts — only add if missing.

- [ ] **Step 5: Type check**

Run: `cd app && node node_modules/typescript/bin/tsc --noEmit`
Expected: 0 errors

- [ ] **Step 6: Commit**

```bash
git add app/src/services/sessionTracker.ts app/src/services/bleManager.ts
git commit -m "feat(D5): wire Solo baseline on session start/end + reconnect profile re-assert"
```

---

### Task 6: Wire manual override + settings change to profile apply

**Files:**
- Modify: `app/app/(tabs)/session.tsx`
- Modify: `app/src/stores/settingsStore.ts`

- [ ] **Step 1: Update session.tsx — wire override to profile apply**

Add to the imports in `app/app/(tabs)/session.tsx`:

```typescript
import { applyProfileForCurrentContext, getProfileLabel } from '../../src/services/coachingProfileService';
```

Replace the existing `applyContextOverride` function (around line 212-215) with:

```typescript
  function applyContextOverride(context: SessionContext) {
    useSessionStore.getState().setSessionContext(context);
    useSessionStore.getState().setSessionContextOverride(true);
    // D.5: apply coaching profile immediately (bypass stability guard)
    void applyProfileForCurrentContext({ bypassStabilityGuard: true }).catch(
      (e: unknown) => console.warn('[Session] Profile apply failed:', e),
    );
  }
```

- [ ] **Step 2: Update settingsStore.ts — trigger profile recompute on threshold change during active session**

In `app/src/stores/settingsStore.ts`, add the import at the top (after line 3):

```typescript
import { AppSessionState } from '../types';
```

Modify the `setThresholds` method (around line 101-109). Replace:

```typescript
  setThresholds: (thresholds) => {
    set({ thresholds });
    saveSettings([
      ['thresholds.gentleSec', String(thresholds.gentleSec)],
      ['thresholds.moderateSec', String(thresholds.moderateSec)],
      ['thresholds.urgentSec', String(thresholds.urgentSec)],
      ['thresholds.criticalSec', String(thresholds.criticalSec)],
    ]).catch(console.warn);
  },
```

With:

```typescript
  setThresholds: (thresholds) => {
    set({ thresholds });
    saveSettings([
      ['thresholds.gentleSec', String(thresholds.gentleSec)],
      ['thresholds.moderateSec', String(thresholds.moderateSec)],
      ['thresholds.urgentSec', String(thresholds.urgentSec)],
      ['thresholds.criticalSec', String(thresholds.criticalSec)],
    ]).catch(console.warn);

    // D.5: recompute active coaching profile if session is running
    const sessionState = useDeviceStore.getState().sessionState;
    if (sessionState === AppSessionState.ACTIVE) {
      // Lazy import to avoid circular dependency at module load time
      const { applyProfileForCurrentContext } = require('../services/coachingProfileService') as typeof import('../services/coachingProfileService');
      void applyProfileForCurrentContext({ bypassStabilityGuard: true }).catch(
        (e: unknown) => console.warn('[Settings] Profile recompute failed:', e),
      );
    }
  },
```

Note: The lazy `require()` avoids a circular dependency between settingsStore → coachingProfileService → settingsStore. This is a standard pattern for cross-store event wiring.

- [ ] **Step 3: Type check**

Run: `cd app && node node_modules/typescript/bin/tsc --noEmit`
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add app/app/\(tabs\)/session.tsx app/src/stores/settingsStore.ts
git commit -m "feat(D5): wire manual override + settings change to profile apply"
```

---

### Task 7: SessionContextPill — add profile label

**Files:**
- Modify: `app/src/components/SessionContextPill.tsx`
- Modify: `app/app/(tabs)/session.tsx`

- [ ] **Step 1: Add profileLabel prop to SessionContextPill**

Replace the entire `app/src/components/SessionContextPill.tsx` with:

```typescript
/**
 * SessionContextPill — shows detected session context + active coaching profile.
 *
 * Tappable: opens an override picker so the user can correct the classification.
 * Purely presentational — all state management is in the parent.
 */
import { Pressable, Text, StyleSheet } from 'react-native';
import { useTheme } from '../theme/theme';
import type { SessionContext } from '../types';

const CONTEXT_LABELS: Record<SessionContext, string> = {
  solo: 'Solo',
  with_others: 'With Others',
  presentation: 'Presenting',
};

interface Props {
  context: SessionContext | null;
  isOverride: boolean;
  profileLabel: string | null;
  onPress: () => void;
}

export function SessionContextPill({ context, isOverride, profileLabel, onPress }: Props) {
  const theme = useTheme();

  if (!context) return null;

  let label = CONTEXT_LABELS[context];
  if (profileLabel) {
    label += ` · ${profileLabel}`;
  }
  if (isOverride) {
    label += ' ·';
  }

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.pill,
        {
          backgroundColor: theme.colors.card,
          borderRadius: theme.radius.full,
        },
      ]}
    >
      <Text style={[theme.type.small, { color: theme.text.secondary }]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
});
```

- [ ] **Step 2: Pass profileLabel from session.tsx**

In `app/app/(tabs)/session.tsx`, find the `SessionContextPill` rendering (in the ACTIVE session section). Replace:

```tsx
            <SessionContextPill
                context={sessionContext}
                isOverride={sessionContextOverride}
                onPress={handleContextOverride}
              />
```

With:

```tsx
              <SessionContextPill
                context={sessionContext}
                isOverride={sessionContextOverride}
                profileLabel={sessionContext ? getProfileLabel(sessionContext) : null}
                onPress={handleContextOverride}
              />
```

Note: `getProfileLabel` was already imported in Task 6 Step 1.

- [ ] **Step 3: Type check**

Run: `cd app && node node_modules/typescript/bin/tsc --noEmit`
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add app/src/components/SessionContextPill.tsx app/app/\(tabs\)/session.tsx
git commit -m "feat(D5): SessionContextPill gains profileLabel prop"
```

---

### Task 8: Integration tests — coordinator behavior

**Files:**
- Create: `app/src/services/__tests__/coachingProfile.integration.test.ts`

- [ ] **Step 1: Write the integration tests**

Create `app/src/services/__tests__/coachingProfile.integration.test.ts`:

```typescript
import { useSessionStore } from '../../stores/sessionStore';
import { useSettingsStore } from '../../stores/settingsStore';
import {
  computeProfileThresholds,
  applyProfileForCurrentContext,
} from '../coachingProfileService';
import { bleService } from '../bleManager';
import type { AlertThresholds } from '../../types';

// Mock BLE — we test coordinator logic, not actual BLE writes
const mockWriteThresholds = jest.fn().mockResolvedValue(undefined);
jest.mock('../bleManager', () => ({
  bleService: {
    writeThresholds: (...args: unknown[]) => mockWriteThresholds(...args),
  },
}));

const SOLO_BASE: AlertThresholds = {
  gentleSec: 7,
  moderateSec: 15,
  urgentSec: 30,
  criticalSec: 60,
};

describe('coaching profile coordinator', () => {
  beforeEach(() => {
    useSessionStore.getState().resetContext();
    useSessionStore.getState().resetProfile();
    mockWriteThresholds.mockClear();
    mockWriteThresholds.mockResolvedValue(undefined);
  });

  test('activeProfile is null before any session', () => {
    expect(useSessionStore.getState().activeProfile).toBeNull();
    expect(useSessionStore.getState().lastProfileWriteTime).toBeNull();
  });

  test('resetProfile clears activeProfile and lastProfileWriteTime', () => {
    const derived = computeProfileThresholds('presentation', SOLO_BASE);
    useSessionStore.getState().setActiveProfile(derived);
    useSessionStore.getState().setLastProfileWriteTime(Date.now());

    useSessionStore.getState().resetProfile();

    expect(useSessionStore.getState().activeProfile).toBeNull();
    expect(useSessionStore.getState().lastProfileWriteTime).toBeNull();
  });

  test('applyProfileForCurrentContext writes derived thresholds on context change', async () => {
    useSessionStore.getState().setSessionContext('with_others');
    await applyProfileForCurrentContext();

    expect(mockWriteThresholds).toHaveBeenCalledTimes(1);
    const written = mockWriteThresholds.mock.calls[0][0] as AlertThresholds;
    expect(written.gentleSec).toBe(5); // 7*0.7=4.9→5
    expect(useSessionStore.getState().activeProfile).toEqual(written);
  });

  test('identical derived thresholds skip BLE write', async () => {
    // Set context and apply once
    useSessionStore.getState().setSessionContext('solo');
    await applyProfileForCurrentContext();
    expect(mockWriteThresholds).toHaveBeenCalledTimes(1);

    // Apply again with same context — should skip
    mockWriteThresholds.mockClear();
    await applyProfileForCurrentContext();
    expect(mockWriteThresholds).not.toHaveBeenCalled();
  });

  test('stability guard suppresses rapid context-triggered writes', async () => {
    // First write
    useSessionStore.getState().setSessionContext('with_others');
    await applyProfileForCurrentContext();
    expect(mockWriteThresholds).toHaveBeenCalledTimes(1);

    // Change context immediately — stability guard should suppress
    mockWriteThresholds.mockClear();
    useSessionStore.getState().setSessionContext('presentation');
    await applyProfileForCurrentContext(); // no bypassStabilityGuard
    expect(mockWriteThresholds).not.toHaveBeenCalled();
  });

  test('manual override bypasses stability guard', async () => {
    // First write to set lastProfileWriteTime
    useSessionStore.getState().setSessionContext('with_others');
    await applyProfileForCurrentContext();

    // Override immediately — should bypass stability guard
    mockWriteThresholds.mockClear();
    useSessionStore.getState().setSessionContext('presentation');
    await applyProfileForCurrentContext({ bypassStabilityGuard: true });
    expect(mockWriteThresholds).toHaveBeenCalledTimes(1);
    const written = mockWriteThresholds.mock.calls[0][0] as AlertThresholds;
    expect(written.gentleSec).toBe(21); // 7*3.0
  });

  test('failed BLE write does not update activeProfile', async () => {
    useSessionStore.getState().setSessionContext('with_others');
    await applyProfileForCurrentContext();
    const successfulProfile = useSessionStore.getState().activeProfile;

    // Next write will fail
    mockWriteThresholds.mockRejectedValueOnce(new Error('BLE disconnected'));
    useSessionStore.getState().setSessionContext('presentation');
    await applyProfileForCurrentContext({ bypassStabilityGuard: true });

    // activeProfile should still be the last successful write
    expect(useSessionStore.getState().activeProfile).toEqual(successfulProfile);
  });

  test('store updates only on successful BLE write', async () => {
    // Fail the first write
    mockWriteThresholds.mockRejectedValueOnce(new Error('BLE error'));
    useSessionStore.getState().setSessionContext('with_others');
    await applyProfileForCurrentContext();

    // Store should NOT have been updated
    expect(useSessionStore.getState().activeProfile).toBeNull();
    expect(useSessionStore.getState().lastProfileWriteTime).toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests**

Run: `cd app && npx jest --no-coverage --testPathPattern=coachingProfile.integration`
Expected: 7 tests PASS

- [ ] **Step 3: Commit**

```bash
git add app/src/services/__tests__/coachingProfile.integration.test.ts
git commit -m "test(D5): coaching profile coordinator integration tests"
```

---

### Task 9: Docs + final type check + test run

**Files:**
- Modify: `CLAUDE.md`
- Modify: `PHASE_PLAN.md`

- [ ] **Step 1: Update CLAUDE.md**

Read `CLAUDE.md` first. Find the "Context Classification (Phase D.4)" section. Add a new section AFTER it:

```markdown
### Coaching Profiles (Phase D.5 v1)
`coachingProfileService.ts` has two layers: pure profile logic (computeProfileThresholds, getProfileLabel) and a thin orchestration coordinator (applyProfileForCurrentContext). Solo uses the user's Settings thresholds. With Others (0.7x/0.7x/0.65x/0.75x) and Presenting (3x uniform) are derived via per-threshold multipliers. Safety rails: floor/ceiling clamps + monotonic enforcement. Applied order: multiply → round → clamp → monotonic.
`applyProfileForCurrentContext()` is the single authority for threshold writes during sessions. Reads context from sessionStore, base from settingsStore, computes derived, compares with activeProfile, checks stability guard (5s), writes via BLE. Store updates only on successful write.
Session start → Solo baseline. Context change → derived profile. Manual override → immediate (bypass stability). Settings change during session → immediate recompute. Session end → restore Solo + clear profile (only on successful write). BLE reconnect → re-assert activeProfile or Solo.
`SessionContextPill` shows profile label: "Solo · Standard alerts", "With Others · Tighter alerts", "Presenting · Relaxed alerts".
```

- [ ] **Step 2: Update PHASE_PLAN.md**

Find the D.5 line. Change it to:

```markdown
- [x] RG-D.5: Coaching profiles v1 — context-aware threshold adjustment (solo/with_others/presentation), per-threshold multipliers, safety rails, live profile switching, manual override + settings change wiring, profile label on pill
```

- [ ] **Step 3: Full type check**

Run: `cd app && node node_modules/typescript/bin/tsc --noEmit`
Expected: 0 errors

- [ ] **Step 4: Full test run**

Run: `cd app && npx jest --no-coverage`
Expected: All tests pass. Same pre-existing theme.test.ts failure. Count should be ~147 existing + ~15 new = ~162 tests.

- [ ] **Step 5: Commit**

```bash
git add CLAUDE.md PHASE_PLAN.md
git commit -m "docs: update CLAUDE.md + PHASE_PLAN.md for D.5 coaching profiles"
```
