# D.3 Speaker Library + Naming Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a persistent cross-session speaker library, proactive naming prompts in the live transcript, and library-enhanced speaker picker so users can consistently name and reuse speaker identities across sessions.

**Architecture:** A new `speakerLibraryService` owns cross-session identity (separate DB table, in-memory cache, normalized names). `speakerService` stays session-scoped as in D.2. Integration points: SpeakerPicker queries the library for name suggestions; `transcriptService` syncs confirmed names to the library at session end; a new presentational `NewSpeakerBanner` component (controlled by `LiveTranscript`) prompts naming when provisional speakers exist.

**Tech Stack:** Zustand, expo-sqlite, React Native, TypeScript

**Spec:** `docs/specs/2026-04-09-d3-speaker-library-naming-design.md`

---

## File Structure

| File | Responsibility |
|------|----------------|
| `app/src/types/index.ts` | Add `KnownSpeaker` interface |
| `app/src/db/schema.ts` | `migrateToV5` — `known_speakers` table |
| `app/src/db/database.ts` | Call `migrateToV5` in migration chain |
| `app/src/db/knownSpeakers.ts` | **New** — CRUD for `known_speakers` table |
| `app/src/services/speakerLibraryService.ts` | **New** — cross-session speaker identity, cache, normalization |
| `app/src/services/__tests__/speakerLibraryService.test.ts` | **New** — library service tests |
| `app/src/services/transcriptService.ts` | Wire library sync at session end |
| `app/src/components/SpeakerPicker.tsx` | Add library names to picker, call addSpeaker on confirm |
| `app/src/components/NewSpeakerBanner.tsx` | **New** — presentational pill for unnamed speaker prompt |
| `app/src/components/LiveTranscript.tsx` | Insert banner, derive unnamed count, banner tap handler |
| `app/app/_layout.tsx` | Call `speakerLibraryService.loadLibrary()` at startup |
| `CLAUDE.md` | D.3 architecture section |
| `PHASE_PLAN.md` | Update D.3 status |

---

### Task 1: KnownSpeaker Type + Schema Migration

**Files:**
- Modify: `app/src/types/index.ts`
- Modify: `app/src/db/schema.ts`
- Modify: `app/src/db/database.ts`

- [ ] **Step 1: Add `KnownSpeaker` to `app/src/types/index.ts`**

Find the end of the `VoiceProfile` interface (around line 254 — ends with `updatedAt: number;` then `}`). Insert after the closing `}`:

```typescript
/** A named speaker in the persistent speaker library. */
export interface KnownSpeaker {
  id: number;
  name: string;
  createdAt: number;
  updatedAt: number;
  lastSeenAt: number | null;
  sessionCount: number;
}
```

- [ ] **Step 2: Add `migrateToV5` to `app/src/db/schema.ts`**

Read the file, find `migrateToV4`. Add immediately after it:

```typescript
export async function migrateToV5(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS known_speakers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      last_seen_at INTEGER,
      session_count INTEGER NOT NULL DEFAULT 0
    );
  `);
}
```

- [ ] **Step 3: Call `migrateToV5` from `app/src/db/database.ts`**

Current file:
```typescript
import { initDatabase, migrateToV2, migrateToV3, migrateToV4 } from './schema';
```

Change to:
```typescript
import { initDatabase, migrateToV2, migrateToV3, migrateToV4, migrateToV5 } from './schema';
```

And add `await migrateToV5(db);` after `await migrateToV4(db);`:
```typescript
    await initDatabase(db);
    await migrateToV2(db);
    await migrateToV3(db);
    await migrateToV4(db);
    await migrateToV5(db);
```

- [ ] **Step 4: TypeScript check**

Run: `cd /Users/carlos/Workspace/rambling-guardian/app && node node_modules/typescript/bin/tsc --noEmit`
Expected: zero errors

- [ ] **Step 5: Commit**

```bash
git add app/src/types/index.ts app/src/db/schema.ts app/src/db/database.ts
git commit -m "feat(db): migrateToV5 — known_speakers table + KnownSpeaker type (D.3.1)"
```

---

### Task 2: Known Speakers DB Layer

**Files:**
- Create: `app/src/db/knownSpeakers.ts`

- [ ] **Step 1: Create `app/src/db/knownSpeakers.ts`**

```typescript
import { getDatabase } from './database';
import type { KnownSpeaker } from '../types';

/**
 * Get all known speakers, most recently seen first.
 * Speakers with no last_seen_at appear after those with a value
 * (SQLite-safe: ORDER BY CASE instead of NULLS LAST).
 */
export async function getKnownSpeakers(): Promise<KnownSpeaker[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<any>(
    `SELECT * FROM known_speakers
     ORDER BY
       CASE WHEN last_seen_at IS NULL THEN 1 ELSE 0 END ASC,
       last_seen_at DESC`,
  );
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    lastSeenAt: r.last_seen_at ?? null,
    sessionCount: r.session_count,
  }));
}

/**
 * Add a speaker to the library. INSERT OR IGNORE — idempotent on duplicate name.
 */
export async function addKnownSpeaker(name: string): Promise<void> {
  const db = await getDatabase();
  const now = Date.now();
  await db.runAsync(
    `INSERT OR IGNORE INTO known_speakers (name, created_at, updated_at, session_count)
     VALUES (?, ?, ?, 0)`,
    [name, now, now],
  );
}

/**
 * Update last_seen_at to now and increment session_count by 1.
 */
export async function touchKnownSpeaker(name: string): Promise<void> {
  const db = await getDatabase();
  const now = Date.now();
  await db.runAsync(
    `UPDATE known_speakers
     SET last_seen_at = ?, session_count = session_count + 1, updated_at = ?
     WHERE name = ?`,
    [now, now, name],
  );
}

/**
 * Rename a known speaker. Normalizing is the caller's responsibility.
 */
export async function renameKnownSpeaker(
  oldName: string,
  newName: string,
): Promise<void> {
  const db = await getDatabase();
  const now = Date.now();
  await db.runAsync(
    `UPDATE known_speakers SET name = ?, updated_at = ? WHERE name = ?`,
    [newName, now, oldName],
  );
}

/**
 * Remove a speaker from the library.
 */
export async function deleteKnownSpeaker(name: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(`DELETE FROM known_speakers WHERE name = ?`, [name]);
}
```

- [ ] **Step 2: TypeScript check**

Run: `cd /Users/carlos/Workspace/rambling-guardian/app && node node_modules/typescript/bin/tsc --noEmit`
Expected: zero errors

- [ ] **Step 3: Commit**

```bash
git add app/src/db/knownSpeakers.ts
git commit -m "feat(db): knownSpeakers CRUD — getKnownSpeakers, add, touch, rename, delete (D.3.2)"
```

---

### Task 3: Speaker Library Service + Tests

**Files:**
- Create: `app/src/services/speakerLibraryService.ts`
- Create: `app/src/services/__tests__/speakerLibraryService.test.ts`

- [ ] **Step 1: Write the test file first**

Create `app/src/services/__tests__/speakerLibraryService.test.ts`:

```typescript
import {
  speakerLibraryService,
  normalizeSpeakerName,
} from '../speakerLibraryService';

const mockSpeakers: any[] = [];

jest.mock('../../db/knownSpeakers', () => ({
  getKnownSpeakers: jest.fn(async () => mockSpeakers),
  addKnownSpeaker: jest.fn(async () => {}),
  touchKnownSpeaker: jest.fn(async () => {}),
  renameKnownSpeaker: jest.fn(async () => {}),
  deleteKnownSpeaker: jest.fn(async () => {}),
}));

beforeEach(() => {
  mockSpeakers.length = 0;
  speakerLibraryService.clearCache();
  jest.clearAllMocks();
});

describe('normalizeSpeakerName', () => {
  test('trims whitespace', () => {
    expect(normalizeSpeakerName('  Sarah  ')).toBe('Sarah');
  });

  test('collapses internal spaces', () => {
    expect(normalizeSpeakerName('Dr.  Kim')).toBe('Dr. Kim');
  });

  test('preserves casing', () => {
    expect(normalizeSpeakerName('Dr. Kim')).toBe('Dr. Kim');
  });

  test('returns empty string for whitespace-only input', () => {
    expect(normalizeSpeakerName('   ')).toBe('');
  });
});

describe('speakerLibraryService', () => {
  test('getLibraryNames returns empty array before loadLibrary', () => {
    expect(speakerLibraryService.getLibraryNames()).toEqual([]);
  });

  test('loadLibrary populates cache from DB', async () => {
    mockSpeakers.push(
      { id: 1, name: 'Sarah', createdAt: 1000, updatedAt: 1000, lastSeenAt: 2000, sessionCount: 3 },
      { id: 2, name: 'Dr. Kim', createdAt: 900, updatedAt: 900, lastSeenAt: 1500, sessionCount: 1 },
    );
    await speakerLibraryService.loadLibrary();
    expect(speakerLibraryService.getLibraryNames()).toEqual(['Sarah', 'Dr. Kim']);
  });

  test('addSpeaker normalizes, writes to DB, updates cache', async () => {
    await speakerLibraryService.loadLibrary();
    await speakerLibraryService.addSpeaker('  Carlos  ');
    const { addKnownSpeaker } = require('../../db/knownSpeakers');
    expect(addKnownSpeaker).toHaveBeenCalledWith('Carlos');
    expect(speakerLibraryService.getLibraryNames()).toContain('Carlos');
  });

  test('addSpeaker with whitespace-only name is no-op', async () => {
    await speakerLibraryService.loadLibrary();
    await speakerLibraryService.addSpeaker('   ');
    const { addKnownSpeaker } = require('../../db/knownSpeakers');
    expect(addKnownSpeaker).not.toHaveBeenCalled();
  });

  test('addSpeaker with duplicate name does not add to cache twice', async () => {
    mockSpeakers.push({ id: 1, name: 'Sarah', createdAt: 1000, updatedAt: 1000, lastSeenAt: null, sessionCount: 0 });
    await speakerLibraryService.loadLibrary();
    await speakerLibraryService.addSpeaker('Sarah');
    expect(speakerLibraryService.getLibraryNames().filter((n) => n === 'Sarah')).toHaveLength(1);
  });

  test('markSeenInSession calls touchKnownSpeaker with normalized name', async () => {
    await speakerLibraryService.loadLibrary();
    await speakerLibraryService.markSeenInSession('  Sarah  ');
    const { touchKnownSpeaker } = require('../../db/knownSpeakers');
    expect(touchKnownSpeaker).toHaveBeenCalledWith('Sarah');
  });

  test('loadLibrary failure leaves cache empty (best-effort)', async () => {
    const { getKnownSpeakers } = require('../../db/knownSpeakers');
    getKnownSpeakers.mockRejectedValueOnce(new Error('DB error'));
    await speakerLibraryService.loadLibrary(); // should not throw
    expect(speakerLibraryService.getLibraryNames()).toEqual([]);
  });

  test('addSpeaker DB failure leaves cache unchanged', async () => {
    await speakerLibraryService.loadLibrary();
    const { addKnownSpeaker } = require('../../db/knownSpeakers');
    addKnownSpeaker.mockRejectedValueOnce(new Error('DB error'));
    await speakerLibraryService.addSpeaker('Sarah');
    expect(speakerLibraryService.getLibraryNames()).not.toContain('Sarah');
  });
});
```

- [ ] **Step 2: Run test to verify it FAILS**

Run: `cd /Users/carlos/Workspace/rambling-guardian/app && npx jest src/services/__tests__/speakerLibraryService.test.ts --no-coverage 2>&1 | tail -10`
Expected: FAIL — module not found

- [ ] **Step 3: Create `app/src/services/speakerLibraryService.ts`**

```typescript
/**
 * Speaker Library Service — cross-session speaker identity directory.
 *
 * Owns the persistent `known_speakers` table via in-memory cache.
 * Separate from speakerService (session-scoped) — this service survives
 * across sessions and is loaded once at app startup.
 *
 * Product rule: names are user-assigned. No voice matching or biometric claims.
 */
import {
  getKnownSpeakers,
  addKnownSpeaker,
  touchKnownSpeaker,
  renameKnownSpeaker,
  deleteKnownSpeaker,
} from '../db/knownSpeakers';
import type { KnownSpeaker } from '../types';

/** Normalize a raw display name for storage. Trims, collapses spaces, preserves casing. */
export function normalizeSpeakerName(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ');
}

class SpeakerLibraryService {
  private cache: KnownSpeaker[] = [];
  private loaded = false;

  /**
   * Load library from DB into cache. Best-effort — errors are logged, not thrown.
   * Must be called after DB initialization (after getDatabase() is ready).
   */
  async loadLibrary(): Promise<void> {
    try {
      this.cache = await getKnownSpeakers();
      this.loaded = true;
    } catch (error) {
      console.warn('[SpeakerLibrary] Failed to load:', error);
      // Leave cache empty — reads return [], writes still attempt DB
    }
  }

  /** Returns cached speaker names in recency order. Safe to call before loadLibrary. */
  getLibraryNames(): string[] {
    return this.cache.map((s) => s.name);
  }

  /**
   * Add a speaker to the library. Normalizes name. No-op if empty after normalization.
   * DB-first: cache updated only on DB success to prevent divergence.
   */
  async addSpeaker(rawName: string): Promise<void> {
    const name = normalizeSpeakerName(rawName);
    if (!name) return;
    // Skip if already in cache (avoid unnecessary DB round-trip)
    if (this.cache.some((s) => s.name === name)) return;
    try {
      await addKnownSpeaker(name);
      const now = Date.now();
      this.cache.push({
        id: -1, // placeholder — real ID assigned by DB
        name,
        createdAt: now,
        updatedAt: now,
        lastSeenAt: null,
        sessionCount: 0,
      });
    } catch (error) {
      console.warn('[SpeakerLibrary] Failed to add speaker:', error);
      // Cache stays unchanged on failure
    }
  }

  /**
   * Update last_seen_at and increment session_count.
   * Called once per confirmed speaker per session at finalization.
   */
  async markSeenInSession(rawName: string): Promise<void> {
    const name = normalizeSpeakerName(rawName);
    if (!name) return;
    try {
      await touchKnownSpeaker(name);
      const now = Date.now();
      const entry = this.cache.find((s) => s.name === name);
      if (entry) {
        entry.lastSeenAt = now;
        entry.sessionCount += 1;
        entry.updatedAt = now;
      }
    } catch (error) {
      console.warn('[SpeakerLibrary] Failed to mark seen:', error);
    }
  }

  /** Rename a speaker in library. DB-first. */
  async renameSpeaker(oldName: string, newRawName: string): Promise<void> {
    const newName = normalizeSpeakerName(newRawName);
    if (!newName) return;
    try {
      await renameKnownSpeaker(oldName, newName);
      const entry = this.cache.find((s) => s.name === oldName);
      if (entry) {
        entry.name = newName;
        entry.updatedAt = Date.now();
      }
    } catch (error) {
      console.warn('[SpeakerLibrary] Failed to rename speaker:', error);
    }
  }

  /** Remove a speaker from library. DB-first. */
  async removeSpeaker(name: string): Promise<void> {
    try {
      await deleteKnownSpeaker(name);
      this.cache = this.cache.filter((s) => s.name !== name);
    } catch (error) {
      console.warn('[SpeakerLibrary] Failed to remove speaker:', error);
    }
  }

  /** Clear cache — used in tests and between sessions if needed. */
  clearCache(): void {
    this.cache = [];
    this.loaded = false;
  }
}

export const speakerLibraryService = new SpeakerLibraryService();
```

- [ ] **Step 4: Run tests to verify PASS**

Run: `cd /Users/carlos/Workspace/rambling-guardian/app && npx jest src/services/__tests__/speakerLibraryService.test.ts --no-coverage`
Expected: all tests pass

- [ ] **Step 5: TypeScript check**

Run: `cd /Users/carlos/Workspace/rambling-guardian/app && node node_modules/typescript/bin/tsc --noEmit`
Expected: zero errors

- [ ] **Step 6: Commit**

```bash
git add app/src/services/speakerLibraryService.ts app/src/services/__tests__/speakerLibraryService.test.ts
git commit -m "feat(app): speakerLibraryService + normalization — cross-session speaker identity (D.3.3)"
```

---

### Task 4: Wire Library at App Startup

**Files:**
- Modify: `app/app/_layout.tsx`

- [ ] **Step 1: Add import and startup call**

In `app/app/_layout.tsx`, add the import after the `ensureProfileExists` import line:

```typescript
import { speakerLibraryService } from '../src/services/speakerLibraryService';
```

Then in the `initDb` `.then()` chain, add after `ensureProfileExists().catch(console.warn);`:

```typescript
speakerLibraryService.loadLibrary().catch(console.warn); // best-effort, non-blocking
```

The section should look like:
```typescript
        sessionTracker.start();
        transcriptService.start();
        ensureProfileExists().catch(console.warn);
        speakerLibraryService.loadLibrary().catch(console.warn); // best-effort, non-blocking
```

Both run after `getDatabase()` resolves (inside the `.then()` chain), so DB is ready.

- [ ] **Step 2: TypeScript check**

Run: `cd /Users/carlos/Workspace/rambling-guardian/app && node node_modules/typescript/bin/tsc --noEmit`
Expected: zero errors

- [ ] **Step 3: Commit**

```bash
git add app/app/_layout.tsx
git commit -m "feat(app): load speakerLibrary at startup after DB init (D.3.4)"
```

---

### Task 5: Wire Library Sync at Session End

**Files:**
- Modify: `app/src/services/transcriptService.ts`

- [ ] **Step 1: Add import**

In `app/src/services/transcriptService.ts`, add after the `speakerService` import:

```typescript
import { speakerLibraryService } from './speakerLibraryService';
```

- [ ] **Step 2: Add library sync in `stopTranscription`**

Find this block in `stopTranscription` (around line 191):
```typescript
        await speakerService.persistToSession(sessionId);
        useTranscriptStore.getState().setStatus('complete');
```

Replace with:
```typescript
        await speakerService.persistToSession(sessionId);

        // D.3: sync confirmed speaker names to library (once per unique name per session)
        const { mappings } = useSpeakerStore.getState();
        const confirmedNames = new Set<string>();
        for (const m of Object.values(mappings)) {
          if (m.confidence === 'user_confirmed' && m.displayName !== 'Me') {
            confirmedNames.add(m.displayName);
          }
        }
        for (const name of confirmedNames) {
          await speakerLibraryService.markSeenInSession(name);
        }

        useTranscriptStore.getState().setStatus('complete');
```

Note: `useSpeakerStore` is already imported (it's used in the store subscription).

- [ ] **Step 3: TypeScript check**

Run: `cd /Users/carlos/Workspace/rambling-guardian/app && node node_modules/typescript/bin/tsc --noEmit`
Expected: zero errors

- [ ] **Step 4: Run all tests**

Run: `cd /Users/carlos/Workspace/rambling-guardian/app && npx jest --no-coverage 2>&1 | tail -8`
Expected: all tests pass

- [ ] **Step 5: Commit**

```bash
git add app/src/services/transcriptService.ts
git commit -m "feat(app): sync confirmed speaker names to library at session end (D.3.5)"
```

---

### Task 6: Enhance SpeakerPicker with Library Names

**Files:**
- Modify: `app/src/components/SpeakerPicker.tsx`

- [ ] **Step 1: Rewrite `SpeakerPicker.tsx`**

Replace the entire file with:

```typescript
/**
 * SpeakerPicker — bottom-sheet modal for assigning a speaker identity.
 *
 * Shows: "Me" | library names (past sessions, recency order) | custom input.
 * Library names already used in this session are deduplicated.
 * Saves confirmed names to the cross-session speaker library.
 */
import { useState } from 'react';
import { View, Text, Pressable, TextInput, Modal, StyleSheet } from 'react-native';
import { useTheme } from '../theme/theme';
import { speakerService } from '../services/speakerService';
import { speakerLibraryService } from '../services/speakerLibraryService';
import { useSpeakerStore } from '../stores/speakerStore';

interface Props {
  diarizedLabel: string;
  visible: boolean;
  onClose: () => void;
}

export function SpeakerPicker({ diarizedLabel, visible, onClose }: Props) {
  const theme = useTheme();
  const mappings = useSpeakerStore((s) => s.mappings);
  const [customName, setCustomName] = useState('');

  // Display names already used in this session (excluding "Me")
  const sessionNames = new Set<string>(
    Object.values(mappings)
      .map((m) => m.displayName)
      .filter((n) => n !== 'Me'),
  );

  // Library names ordered by recency, deduped against session names
  const libraryNames = speakerLibraryService
    .getLibraryNames()
    .filter((n) => !sessionNames.has(n));

  function confirmName(name: string) {
    speakerService.reassignSpeaker(diarizedLabel, name);
    speakerLibraryService.addSpeaker(name).catch(console.warn); // persist to library
    onClose();
  }

  function handleCustomSubmit() {
    const trimmed = customName.trim();
    if (trimmed) {
      confirmName(trimmed);
      setCustomName('');
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={[styles.sheet, { backgroundColor: theme.colors.card, borderRadius: theme.radius.xl }]}>
          <Text style={[theme.type.subtitle, { color: theme.text.primary, marginBottom: theme.spacing.md }]}>
            Who is {diarizedLabel}?
          </Text>

          {/* Always-first: Me */}
          <Pressable
            onPress={() => confirmName('Me')}
            style={[styles.option, { borderColor: theme.colors.elevated, borderRadius: theme.radius.lg }]}
          >
            <Text style={[theme.type.body, { color: theme.text.primary }]}>Me</Text>
          </Pressable>

          {/* Library names: past speakers, most recently seen first */}
          {libraryNames.map((name) => (
            <Pressable
              key={name}
              onPress={() => confirmName(name)}
              style={[styles.option, { borderColor: theme.colors.elevated, borderRadius: theme.radius.lg }]}
            >
              <Text style={[theme.type.body, { color: theme.text.primary }]}>{name}</Text>
            </Pressable>
          ))}

          {/* Custom name input */}
          <View style={[styles.customRow, { marginTop: theme.spacing.md }]}>
            <TextInput
              value={customName}
              onChangeText={setCustomName}
              placeholder="Custom name..."
              placeholderTextColor={theme.text.muted}
              style={[
                styles.input,
                {
                  color: theme.text.primary,
                  borderColor: theme.colors.elevated,
                  borderRadius: theme.radius.lg,
                },
              ]}
              onSubmitEditing={handleCustomSubmit}
              returnKeyType="done"
            />
          </View>

          <Pressable
            onPress={onClose}
            style={[styles.cancelButton, { marginTop: theme.spacing.md }]}
          >
            <Text style={[theme.type.body, { color: theme.text.muted }]}>Cancel</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    padding: 20,
    paddingBottom: 40,
  },
  option: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    marginBottom: 8,
  },
  customRow: {
    flexDirection: 'row',
  },
  input: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    fontSize: 16,
  },
  cancelButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
});
```

- [ ] **Step 2: TypeScript check**

Run: `cd /Users/carlos/Workspace/rambling-guardian/app && node node_modules/typescript/bin/tsc --noEmit`
Expected: zero errors

- [ ] **Step 3: Commit**

```bash
git add app/src/components/SpeakerPicker.tsx
git commit -m "feat(app): SpeakerPicker shows library names + persists to library on confirm (D.3.6)"
```

---

### Task 7: NewSpeakerBanner Component

**Files:**
- Create: `app/src/components/NewSpeakerBanner.tsx`

- [ ] **Step 1: Create `app/src/components/NewSpeakerBanner.tsx`**

```typescript
/**
 * NewSpeakerBanner — presentational pill shown when unnamed speakers exist.
 *
 * Pure UI component: no state, no store access, no logic.
 * All count derivation and tap handling lives in LiveTranscript.
 */
import { Pressable, Text, StyleSheet } from 'react-native';
import { useTheme } from '../theme/theme';

interface Props {
  unnamedCount: number;
  onPress: () => void;
}

export function NewSpeakerBanner({ unnamedCount, onPress }: Props) {
  const theme = useTheme();

  if (unnamedCount === 0) return null;

  const label =
    unnamedCount === 1
      ? 'New voice detected — tap to name'
      : `${unnamedCount} new voices detected — review names`;

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.pill,
        {
          backgroundColor: theme.primary[500] + '26', // ~15% opacity
          borderRadius: theme.radius.lg,
          marginBottom: theme.spacing.sm,
        },
      ]}
    >
      <Text style={[theme.type.caption, { color: theme.primary[500], fontWeight: '600' }]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignSelf: 'flex-start',
  },
});
```

- [ ] **Step 2: TypeScript check**

Run: `cd /Users/carlos/Workspace/rambling-guardian/app && node node_modules/typescript/bin/tsc --noEmit`
Expected: zero errors

- [ ] **Step 3: Commit**

```bash
git add app/src/components/NewSpeakerBanner.tsx
git commit -m "feat(app): NewSpeakerBanner — presentational pill for unnamed speaker prompt (D.3.7)"
```

---

### Task 8: Wire Banner into LiveTranscript

**Files:**
- Modify: `app/src/components/LiveTranscript.tsx`

- [ ] **Step 1: Add import**

In `app/src/components/LiveTranscript.tsx`, add after the `SpeakerPicker` import:

```typescript
import { NewSpeakerBanner } from './NewSpeakerBanner';
```

- [ ] **Step 2: Add unnamed count derivation and banner tap handler**

After the existing `handleSpeakerTap` callback, add:

```typescript
  // Count provisional speakers that aren't "Me" — these need naming
  const unnamedCount = Object.values(mappings).filter(
    (m) => m.confidence === 'provisional' && m.displayName !== 'Me',
  ).length;

  // Open SpeakerPicker for the first unnamed label (safe: no-op if none left)
  const handleBannerPress = useCallback(() => {
    const firstUnnamed = Object.entries(mappings).find(
      ([, m]) => m.confidence === 'provisional' && m.displayName !== 'Me',
    );
    if (firstUnnamed) {
      setPickerLabel(firstUnnamed[0]);
    }
  }, [mappings]);
```

- [ ] **Step 3: Insert `NewSpeakerBanner` between header row and ScrollView**

Find this block in the main return:
```typescript
      </View>

      <ScrollView ref={scrollRef}
```

Replace with:
```typescript
      </View>

      <NewSpeakerBanner unnamedCount={unnamedCount} onPress={handleBannerPress} />

      <ScrollView ref={scrollRef}
```

- [ ] **Step 4: TypeScript check**

Run: `cd /Users/carlos/Workspace/rambling-guardian/app && node node_modules/typescript/bin/tsc --noEmit`
Expected: zero errors

- [ ] **Step 5: Run all tests**

Run: `cd /Users/carlos/Workspace/rambling-guardian/app && npx jest --no-coverage 2>&1 | tail -8`
Expected: all tests pass

- [ ] **Step 6: Commit**

```bash
git add app/src/components/LiveTranscript.tsx
git commit -m "feat(app): wire NewSpeakerBanner into LiveTranscript — unnamed count + tap handler (D.3.8)"
```

---

### Task 9: Docs Update + Final Verification

**Files:**
- Modify: `CLAUDE.md`
- Modify: `PHASE_PLAN.md`

- [ ] **Step 1: Update `CLAUDE.md`**

Read `CLAUDE.md`. Find the "Speaker Attribution (Phase D.2)" section. Add a new section immediately after it:

```markdown
### Speaker Library (Phase D.3)
`speakerLibraryService.ts` owns cross-session speaker identity — separate from `speakerService` (session-scoped). `known_speakers` table (migrateToV5): `id`, `name UNIQUE`, `created_at`, `updated_at`, `last_seen_at`, `session_count`.
Name normalization: trim + collapse internal spaces + preserve casing. Applied on all writes. "Me" is never stored in the library.
`loadLibrary()` runs at app startup (non-blocking, after DB init). All writes are DB-first — cache updates only on DB success to prevent divergence.
`session_count` increments once per session at finalization (not per segment). Deduplicated via `Set` if multiple diarized labels map to the same name.
`SpeakerPicker` shows library names (recency order) between "Me" and custom input. On confirm, calls both `speakerService.reassignSpeaker()` and `speakerLibraryService.addSpeaker()`.
`NewSpeakerBanner` (presentational) shows inline pill in `LiveTranscript` when provisional non-"Me" speakers exist. Logic (unnamed count, tap target) lives in `LiveTranscript`. Unresolved speakers stay provisional in `speaker_map` if ignored during session — data ready for future post-session editing.
```

- [ ] **Step 2: Update `PHASE_PLAN.md`**

Read `PHASE_PLAN.md`. Find the D.3 line. Update it to reflect what was built (do not pre-mark complete — verification step follows):

```markdown
- [ ] RG-D.3: Speaker library + naming — `known_speakers` table, `speakerLibraryService`, NewSpeakerBanner inline prompt, library-enhanced SpeakerPicker, session-end library sync *(implemented, pending verification)*
```

- [ ] **Step 3: Full TypeScript check**

Run: `cd /Users/carlos/Workspace/rambling-guardian/app && node node_modules/typescript/bin/tsc --noEmit`
Expected: zero errors

- [ ] **Step 4: Full test suite**

Run: `cd /Users/carlos/Workspace/rambling-guardian/app && npx jest --no-coverage 2>&1 | tail -8`
Expected: all tests pass (including the pre-existing theme.test.ts suite failure which is unrelated to D.3)

- [ ] **Step 5: Push**

```bash
git push
```

- [ ] **Step 6: Commit docs**

```bash
git add CLAUDE.md PHASE_PLAN.md
git commit -m "docs: update CLAUDE.md + PHASE_PLAN.md for D.3 speaker library"
```
