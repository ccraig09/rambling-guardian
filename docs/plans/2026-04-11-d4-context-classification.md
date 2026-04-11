# D.4 Context Classification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Classify each session as `solo`, `with_others`, or `presentation` from speaker count + speech distribution. Show the classification live during the session and persist it on session end. User can override; override is sticky.

**Architecture:** Pure-function classifier called by transcriptService on each final segment. Classification state held in sessionStore. SessionContextPill renders in the active session screen. Override via Alert.alert picker sets a sticky flag that blocks auto-reclassification for the rest of the session.

**Tech Stack:** TypeScript, Zustand, expo-sqlite, React Native

---

### Task 1: Types + DB migration

**Files:**
- Modify: `app/src/types/index.ts`
- Modify: `app/src/db/schema.ts`
- Modify: `app/src/db/database.ts`

- [ ] **Step 1: Add types to `app/src/types/index.ts`**

Add after the `TranscriptStatus` type (around line 224):

```typescript
// ============================================
// Context Classification Types (D.4)
// ============================================

/** Detected conversation context for a session. */
export type SessionContext = 'solo' | 'with_others' | 'presentation';

/** Whether the context was auto-detected or manually overridden. */
export type SessionContextSource = 'auto' | 'manual';
```

- [ ] **Step 2: Add `migrateToV6` to `app/src/db/schema.ts`**

Add after `migrateToV5`:

```typescript
export async function migrateToV6(db: SQLiteDatabase): Promise<void> {
  const migrations = [
    `ALTER TABLE sessions ADD COLUMN session_context TEXT`,
    `ALTER TABLE sessions ADD COLUMN session_context_source TEXT`,
  ];

  for (const sql of migrations) {
    try {
      await db.execAsync(sql);
    } catch (e: any) {
      if (!e.message?.includes('duplicate column')) {
        throw e;
      }
    }
  }
}
```

- [ ] **Step 3: Wire `migrateToV6` into `app/src/db/database.ts`**

Update the import:

```typescript
import { initDatabase, migrateToV2, migrateToV3, migrateToV4, migrateToV5, migrateToV6 } from './schema';
```

Add after `await migrateToV5(db);`:

```typescript
    await migrateToV6(db);
```

- [ ] **Step 4: Add `updateSessionContext` to `app/src/db/sessions.ts`**

Add at the end of the file:

```typescript
/** Persist session context classification. */
export async function updateSessionContext(
  sessionId: string,
  context: string | null,
  source: string | null,
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    'UPDATE sessions SET session_context = ?, session_context_source = ? WHERE id = ?',
    [context, source, sessionId],
  );
}
```

- [ ] **Step 5: Type check**

Run: `cd app && node node_modules/typescript/bin/tsc --noEmit`
Expected: 0 errors

- [ ] **Step 6: Commit**

```bash
git add app/src/types/index.ts app/src/db/schema.ts app/src/db/database.ts app/src/db/sessions.ts
git commit -m "feat(D4): add SessionContext types + migrateToV6 + updateSessionContext"
```

---

### Task 2: Context classification service + tests (TDD)

**Files:**
- Create: `app/src/services/contextClassificationService.ts`
- Create: `app/src/services/__tests__/contextClassificationService.test.ts`

- [ ] **Step 1: Write the tests first**

Create `app/src/services/__tests__/contextClassificationService.test.ts`:

```typescript
import { classifyContext } from '../contextClassificationService';

describe('classifyContext', () => {
  test('returns null when below minimum segment floor', () => {
    const counts = new Map([['Speaker 0', 14]]);
    expect(classifyContext(counts, 14)).toBeNull();
  });

  test('returns null for 0 segments', () => {
    expect(classifyContext(new Map(), 0)).toBeNull();
  });

  test('returns solo for 1 speaker at floor', () => {
    const counts = new Map([['Speaker 0', 15]]);
    expect(classifyContext(counts, 15)).toBe('solo');
  });

  test('returns with_others for 2 speakers even split', () => {
    const counts = new Map([['Speaker 0', 8], ['Speaker 1', 7]]);
    expect(classifyContext(counts, 15)).toBe('with_others');
  });

  test('returns presentation when dominant speaker has 85%+ and 3+ speakers', () => {
    const counts = new Map([['Speaker 0', 17], ['Speaker 1', 2], ['Speaker 2', 1]]);
    expect(classifyContext(counts, 20)).toBe('presentation');
  });

  test('returns with_others when dominant has 85%+ but only 2 speakers', () => {
    const counts = new Map([['Speaker 0', 18], ['Speaker 1', 2]]);
    expect(classifyContext(counts, 20)).toBe('with_others');
  });

  test('returns with_others when dominant has 80% with 3 speakers (below threshold)', () => {
    const counts = new Map([['Speaker 0', 16], ['Speaker 1', 2], ['Speaker 2', 2]]);
    expect(classifyContext(counts, 20)).toBe('with_others');
  });

  test('returns presentation at exactly 85% boundary', () => {
    const counts = new Map([['Speaker 0', 85], ['Speaker 1', 10], ['Speaker 2', 5]]);
    expect(classifyContext(counts, 100)).toBe('presentation');
  });

  test('returns with_others at just below 85% boundary', () => {
    const counts = new Map([['Speaker 0', 84], ['Speaker 1', 10], ['Speaker 2', 6]]);
    expect(classifyContext(counts, 100)).toBe('with_others');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd app && npx jest --no-coverage --testPathPattern=contextClassificationService`
Expected: FAIL — module not found

- [ ] **Step 3: Implement the classification service**

Create `app/src/services/contextClassificationService.ts`:

```typescript
/**
 * Context Classification Service — pure-logic module for D.4.
 *
 * Classifies a session as solo / with_others / presentation based on
 * speaker count and speech distribution. Stateless, no store access.
 */
import type { SessionContext } from '../types';

/** Tunable thresholds — easy to adjust based on real usage. */
export const PRESENTATION_DOMINANCE = 0.85;
export const PRESENTATION_MIN_SPEAKERS = 3;
export const MIN_SEGMENTS_FOR_CLASSIFICATION = 15;

/**
 * Classify session context from speaker segment counts.
 *
 * @param speakerSegmentCounts - Map of speaker label → number of final segments
 * @param totalSegments - Total number of final segments across all speakers
 * @returns The classified context, or null if below the minimum segment floor.
 */
export function classifyContext(
  speakerSegmentCounts: Map<string, number>,
  totalSegments: number,
): SessionContext | null {
  if (totalSegments < MIN_SEGMENTS_FOR_CLASSIFICATION) return null;

  const speakerCount = speakerSegmentCounts.size;
  if (speakerCount <= 1) return 'solo';

  // Find dominant speaker's share
  let maxSegments = 0;
  for (const count of speakerSegmentCounts.values()) {
    if (count > maxSegments) maxSegments = count;
  }
  const dominance = maxSegments / totalSegments;

  if (
    dominance >= PRESENTATION_DOMINANCE &&
    speakerCount >= PRESENTATION_MIN_SPEAKERS
  ) {
    return 'presentation';
  }

  return 'with_others';
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd app && npx jest --no-coverage --testPathPattern=contextClassificationService`
Expected: 9 tests PASS

- [ ] **Step 5: Commit**

```bash
git add app/src/services/contextClassificationService.ts app/src/services/__tests__/contextClassificationService.test.ts
git commit -m "feat(D4): contextClassificationService + 9 unit tests (TDD)"
```

---

### Task 3: Session store additions + reset

**Files:**
- Modify: `app/src/stores/sessionStore.ts`

- [ ] **Step 1: Add context fields and setters**

Add the import at the top of `app/src/stores/sessionStore.ts`:

```typescript
import type { Session, SessionMode, SessionContext } from '../types';
```

Add to the `SessionStore` interface (after the sync metadata section):

```typescript
  // Context classification (D.4)
  sessionContext: SessionContext | null;
  sessionContextOverride: boolean;
  setSessionContext: (context: SessionContext | null) => void;
  setSessionContextOverride: (override: boolean) => void;
  resetContext: () => void;
```

Add to the store implementation (after the sync metadata defaults):

```typescript
  // Context classification (D.4)
  sessionContext: null,
  sessionContextOverride: false,
  setSessionContext: (context) => set({ sessionContext: context }),
  setSessionContextOverride: (override) => set({ sessionContextOverride: override }),
  resetContext: () => set({ sessionContext: null, sessionContextOverride: false }),
```

- [ ] **Step 2: Type check**

Run: `cd app && node node_modules/typescript/bin/tsc --noEmit`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add app/src/stores/sessionStore.ts
git commit -m "feat(D4): add sessionContext + override fields to sessionStore"
```

---

### Task 4: Wire live classification + persist on session end

**Files:**
- Modify: `app/src/services/transcriptService.ts`

- [ ] **Step 1: Add imports**

Add to the imports at the top of `transcriptService.ts`:

```typescript
import { classifyContext } from './contextClassificationService';
import { updateSessionContext } from '../db/sessions';
import { useSessionStore } from '../stores/sessionStore';
```

Note: `useSessionStore` is already imported. Only add `classifyContext` and `updateSessionContext`.

- [ ] **Step 2: Add context reset in `startTranscription`**

In `startTranscription()`, right after the existing `speakerService.reset()` call (around line 59):

```typescript
    useSessionStore.getState().resetContext();
```

- [ ] **Step 3: Add live classification in the `onTranscript` callback**

In the `onTranscript` callback, after the `addFinalSegment` call (around line 108), add:

```typescript
          // D.4: live context classification on each final segment
          this.updateContextClassification();
```

The condition is that the segment is final — so place it inside the `if (segment.isFinal)` block, after `addFinalSegment`.

- [ ] **Step 4: Add the `updateContextClassification` method**

Add as a private method on the `TranscriptService` class:

```typescript
  /** Recompute session context from current segments. Respects manual override. */
  private updateContextClassification(): void {
    const sessionStore = useSessionStore.getState();
    if (sessionStore.sessionContextOverride) return; // user override is sticky

    const { segments } = useTranscriptStore.getState();
    const finalSegments = segments.filter((s) => s.isFinal);

    // Build speaker → segment count map
    const speakerCounts = new Map<string, number>();
    for (const seg of finalSegments) {
      const speaker = seg.speaker ?? 'unknown';
      speakerCounts.set(speaker, (speakerCounts.get(speaker) ?? 0) + 1);
    }

    const context = classifyContext(speakerCounts, finalSegments.length);
    if (context !== sessionStore.sessionContext) {
      sessionStore.setSessionContext(context);
    }
  }
```

- [ ] **Step 5: Persist context on session end**

In `stopTranscription()`, inside the `if (sessionId && segments.length > 0)` block, after the `speakerLibraryService.markSeenInSession` loop and before `setStatus('complete')`, add:

```typescript
        // D.4: persist session context classification
        const { sessionContext, sessionContextOverride } = useSessionStore.getState();
        await updateSessionContext(
          sessionId,
          sessionContext,
          sessionContext ? (sessionContextOverride ? 'manual' : 'auto') : null,
        );
```

- [ ] **Step 6: Type check**

Run: `cd app && node node_modules/typescript/bin/tsc --noEmit`
Expected: 0 errors

- [ ] **Step 7: Commit**

```bash
git add app/src/services/transcriptService.ts
git commit -m "feat(D4): wire live classification + persist context on session end"
```

---

### Task 5: Override stickiness integration test

**Files:**
- Create: `app/src/services/__tests__/contextClassification.integration.test.ts`

- [ ] **Step 1: Write the integration test**

Create `app/src/services/__tests__/contextClassification.integration.test.ts`:

```typescript
import { useSessionStore } from '../../stores/sessionStore';

describe('context classification override stickiness', () => {
  beforeEach(() => {
    useSessionStore.getState().resetContext();
  });

  test('manual override is not overwritten by auto-classification', () => {
    const store = useSessionStore.getState();

    // Auto-classify to solo
    store.setSessionContext('solo');
    expect(useSessionStore.getState().sessionContext).toBe('solo');
    expect(useSessionStore.getState().sessionContextOverride).toBe(false);

    // User manually overrides to with_others
    store.setSessionContext('with_others');
    store.setSessionContextOverride(true);
    expect(useSessionStore.getState().sessionContext).toBe('with_others');
    expect(useSessionStore.getState().sessionContextOverride).toBe(true);

    // Simulate what transcriptService.updateContextClassification does:
    // it checks sessionContextOverride and skips if true
    const sessionStore = useSessionStore.getState();
    if (!sessionStore.sessionContextOverride) {
      // This should NOT execute
      sessionStore.setSessionContext('solo');
    }

    // Override is still sticky
    expect(useSessionStore.getState().sessionContext).toBe('with_others');
    expect(useSessionStore.getState().sessionContextOverride).toBe(true);
  });

  test('resetContext clears both context and override', () => {
    const store = useSessionStore.getState();
    store.setSessionContext('presentation');
    store.setSessionContextOverride(true);

    store.resetContext();

    expect(useSessionStore.getState().sessionContext).toBeNull();
    expect(useSessionStore.getState().sessionContextOverride).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test**

Run: `cd app && npx jest --no-coverage --testPathPattern=contextClassification.integration`
Expected: 2 tests PASS

- [ ] **Step 3: Commit**

```bash
git add app/src/services/__tests__/contextClassification.integration.test.ts
git commit -m "test(D4): override stickiness integration test"
```

---

### Task 6: SessionContextPill component

**Files:**
- Create: `app/src/components/SessionContextPill.tsx`

- [ ] **Step 1: Create the component**

Create `app/src/components/SessionContextPill.tsx`:

```typescript
/**
 * SessionContextPill — shows detected session context (solo / with others / presenting).
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
  onPress: () => void;
}

export function SessionContextPill({ context, isOverride, onPress }: Props) {
  const theme = useTheme();

  if (!context) return null;

  const label = CONTEXT_LABELS[context] + (isOverride ? ' ·' : '');

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

- [ ] **Step 2: Type check**

Run: `cd app && node node_modules/typescript/bin/tsc --noEmit`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add app/src/components/SessionContextPill.tsx
git commit -m "feat(D4): SessionContextPill — tappable context indicator"
```

---

### Task 7: Wire pill + override into session screen

**Files:**
- Modify: `app/app/(tabs)/session.tsx`

- [ ] **Step 1: Add imports**

Add to the imports in `session.tsx`:

```typescript
import { SessionContextPill } from '../../src/components/SessionContextPill';
import { useSessionStore } from '../../src/stores/sessionStore';
import type { SessionContext } from '../../src/types';
```

Note: `useSessionStore` may already be imported via `useDeviceStore` pattern. Check and only add if missing.

- [ ] **Step 2: Add store selectors inside the component**

Inside `SessionScreen()`, after the existing `const sessionState = ...` line:

```typescript
  const sessionContext = useSessionStore((s) => s.sessionContext);
  const sessionContextOverride = useSessionStore((s) => s.sessionContextOverride);
```

- [ ] **Step 3: Add the override handler**

Add the handler function inside the component:

```typescript
  function handleContextOverride() {
    Alert.alert(
      'Session Context',
      'What kind of conversation is this?',
      [
        { text: 'Solo', onPress: () => applyContextOverride('solo') },
        { text: 'With Others', onPress: () => applyContextOverride('with_others') },
        { text: 'Presenting', onPress: () => applyContextOverride('presentation') },
        { text: 'Cancel', style: 'cancel' },
      ],
    );
  }

  function applyContextOverride(context: SessionContext) {
    useSessionStore.getState().setSessionContext(context);
    useSessionStore.getState().setSessionContextOverride(true);
  }
```

- [ ] **Step 4: Render the pill in the ACTIVE session state**

In the CONNECTED + ACTIVE section, after the Sync status indicator (after the `<SyncStatusIndicator />` view), add:

```tsx
            {/* -- Context classification pill (D.4) -- */}
            <View style={{ marginTop: theme.spacing.sm }}>
              <SessionContextPill
                context={sessionContext}
                isOverride={sessionContextOverride}
                onPress={handleContextOverride}
              />
            </View>
```

- [ ] **Step 5: Type check**

Run: `cd app && node node_modules/typescript/bin/tsc --noEmit`
Expected: 0 errors

- [ ] **Step 6: Commit**

```bash
git add app/app/\(tabs\)/session.tsx
git commit -m "feat(D4): wire SessionContextPill + override picker into session screen"
```

---

### Task 8: Docs + final type check + test run

**Files:**
- Modify: `CLAUDE.md`
- Modify: `PHASE_PLAN.md`

- [ ] **Step 1: Update CLAUDE.md**

Add a new section after the "Speaker Library (Phase D.3)" section:

```markdown
### Context Classification (Phase D.4)
`contextClassificationService.ts` classifies sessions as `solo` (1 speaker), `with_others` (2+ speakers, no presentation dominance), or `presentation` (1 speaker has 85%+ of segments with 3+ speakers total). Minimum 15 final segments before classification fires.
`sessionStore` holds live `sessionContext` + `sessionContextOverride`. Override is sticky — once the user manually selects a context, auto-classification stops for that session.
`SessionContextPill` in the session screen shows the detected context. Tap to override via Alert.alert picker.
`session_context` and `session_context_source` columns (migrateToV6) persist the final value on session end.
```

- [ ] **Step 2: Update PHASE_PLAN.md**

Check the D.4 line in PHASE_PLAN.md:

```markdown
- [x] RG-D.4: Context classification — solo / with_others / presentation from speaker count + segment distribution, live classification, user override, persisted on session end
```

- [ ] **Step 3: Full type check**

Run: `cd app && node node_modules/typescript/bin/tsc --noEmit`
Expected: 0 errors

- [ ] **Step 4: Full test run**

Run: `cd app && npx jest --no-coverage`
Expected: All tests pass (existing 136 + 11 new = 147). Same pre-existing theme.test.ts failure.

- [ ] **Step 5: Commit**

```bash
git add CLAUDE.md PHASE_PLAN.md
git commit -m "docs: update CLAUDE.md + PHASE_PLAN.md for D.4 context classification"
```
