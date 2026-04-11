# D.3 Speaker Library + Naming — Design Spec

> **Phase D.3** of Rambling Guardian companion app. Builds on D.2 (diarization + session-local speaker mapping) with persistent cross-session speaker identity.

## Scope

D.3 delivers:
- **Persistent speaker library** — named speakers survive across sessions
- **Live-session naming flow** — inline pill prompts the user to name new voices
- **Library-enhanced picker** — past speaker names appear in the naming picker
- **Session-end library sync** — confirmed names added to library, session_count incremented

D.3 does **not** deliver:
- Embedding-based voice matching (deferred — later phase)
- Post-session speaker editing UI (data foundation only)
- "Is this Sarah?" auto-suggestion (no system-initiated identity claims)
- Post-session unnamed-speaker notifications

**Product rule:** Speaker identity is user-driven and user-correctable. The system does not claim to recognize voices. The library is a manual name directory, not a biometric database.

## Architecture

### Boundary

| Service | Scope | Lifetime |
|---------|-------|----------|
| `speakerService` | Session-local diarized label → display name mappings | Resets per session |
| `speakerLibraryService` | Cross-session named speaker directory | App lifetime (cached) |

`speakerService` never reads/writes the library. `speakerLibraryService` never touches session mappings. Integration happens in `transcriptService` (session end) and `SpeakerPicker` (naming flow).

### Data Flow

```
During session:
  Deepgram → "Speaker 0" → speakerService (session mapping)
  User taps pill → SpeakerPicker (shows library names) → picks "Sarah"
    → speakerService.reassignSpeaker("Speaker 0", "Sarah")  [session]
    → speakerLibraryService.addSpeaker("Sarah")              [library]

Session end (stopTranscription):
  speakerService.persistToSession(sessionId)                  [existing D.2]
  For each unique user_confirmed name (excluding "Me"):
    speakerLibraryService.markSeenInSession(name)             [D.3]
```

## Section 1: Data + Persistence

### New table: `known_speakers` (migrateToV5)

```sql
CREATE TABLE IF NOT EXISTS known_speakers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  last_seen_at INTEGER,
  session_count INTEGER NOT NULL DEFAULT 0
);
```

- `name UNIQUE` — no duplicate names. Uniqueness enforced on normalized form.
- `last_seen_at` — updated once per session at finalization (not per segment).
- `session_count` — incremented once per session where this speaker is confirmed. If two diarized labels both map to "Sarah" in one session, that still counts as 1 increment (deduplicated via `Set` at finalization).
- "Me" is **not** stored in this table — it is a special case handled by `speakerService`.

### Name normalization

Single rule applied on every write path (`addSpeaker`, `renameSpeaker`):
- Trim leading/trailing whitespace
- Collapse internal runs of whitespace to a single space
- Preserve original casing ("Dr. Kim" stays "Dr. Kim")
- Function: `normalizeSpeakerName(raw: string): string`
- Empty string after normalization → rejected (no-op)

This prevents near-duplicate entries like "Sarah" / " Sarah" / "sarah " from coexisting. Casing is preserved for display but deduplication is on normalized form.

### DB layer: `app/src/db/knownSpeakers.ts`

- `getKnownSpeakers(): Promise<KnownSpeaker[]>` — all rows, ordered by `last_seen_at DESC NULLS LAST` (most recently seen first)
- `addKnownSpeaker(name: string): Promise<void>` — INSERT OR IGNORE after normalization. Sets `created_at`/`updated_at` to now.
- `touchKnownSpeaker(name: string): Promise<void>` — updates `last_seen_at` to now, increments `session_count` by 1, updates `updated_at`
- `renameKnownSpeaker(oldName: string, newName: string): Promise<void>` — UPDATE name after normalizing newName
- `deleteKnownSpeaker(name: string): Promise<void>` — DELETE by name

No changes to `sessions.speaker_map` — it continues to store session-level mappings as JSON.

### Type: `KnownSpeaker`

```typescript
export interface KnownSpeaker {
  id: number;
  name: string;
  createdAt: number;
  updatedAt: number;
  lastSeenAt: number | null;
  sessionCount: number;
}
```

## Section 2: Speaker Library Service

### `app/src/services/speakerLibraryService.ts`

Owns cross-session speaker identity. Thin layer over DB with in-memory cache.

**API:**
- `loadLibrary(): Promise<void>` — reads DB into cache. Best-effort, non-blocking (errors logged, not thrown). Called at app startup alongside `ensureProfileExists()`.
- `getLibraryNames(): string[]` — returns cached speaker names. Returns empty array if cache not loaded (safe fallback).
- `addSpeaker(rawName: string): Promise<void>` — normalizes name, writes to DB first, updates cache on DB success. No-op if name already exists or normalizes to empty.
- `markSeenInSession(rawName: string): Promise<void>` — normalizes, calls `touchKnownSpeaker`. DB-first, cache-update-on-success.
- `renameSpeaker(oldName: string, newName: string): Promise<void>` — normalizes newName, DB-first, cache-update-on-success.
- `removeSpeaker(name: string): Promise<void>` — DB-first, cache-update-on-success.

**Cache failure behavior:**
- All writes are DB-first: update DB, then update cache on success
- If DB write fails, cache stays unchanged — no silent divergence
- `loadLibrary()` failure results in empty cache — reads return `[]`, writes still attempt DB

**Same-name collision within a session:**
- Allowed: two diarized labels can both map to "Sarah"
- At session finalization, confirmed display names are collected into a `Set` before calling `markSeenInSession` — "Sarah" increments session_count by 1, not 2

### Test file: `app/src/services/__tests__/speakerLibraryService.test.ts`

Tests for:
- `loadLibrary` populates cache from DB mock
- `getLibraryNames` returns cached names (empty if not loaded)
- `addSpeaker` normalizes name, writes to DB, updates cache
- `addSpeaker` with duplicate name is idempotent
- `addSpeaker` with whitespace-only name is no-op
- `markSeenInSession` updates last_seen_at and session_count
- Name normalization: trim, collapse spaces, preserve case
- DB failure: cache stays unchanged

## Section 3: Integration Points

### App startup (`_layout.tsx`)

After `ensureProfileExists()`:
```typescript
speakerLibraryService.loadLibrary().catch(console.warn);
```

### Mid-session naming (SpeakerPicker flow)

When user confirms a name in `SpeakerPicker`:
1. `speakerService.reassignSpeaker(label, name)` — session mapping (existing D.2)
2. `speakerLibraryService.addSpeaker(name)` — library persistence (D.3)

This happens inside `SpeakerPicker.handleSelect` / `handleCustomSubmit`.

### Session end (`transcriptService.stopTranscription`)

After `speakerService.persistToSession(sessionId)`:
```typescript
// D.3: sync confirmed speaker names to library
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
```

## Section 4: SpeakerPicker Enhancement

**Current (D.2):** Shows "Me" + display names from current session mappings + custom input.

**D.3 change:** Add library names between "Me" and custom input.

**Display order:**
1. "Me" (always first)
2. Library names from `speakerLibraryService.getLibraryNames()` — ordered by recency (most recently seen first, matching DB query order)
3. Custom name input (always last)

**Deduplication:** Library names that already appear in current session mappings are filtered out — no duplicates in the list.

**New behavior on select/submit:**
- After calling `speakerService.reassignSpeaker()`, also call `speakerLibraryService.addSpeaker(name)` to persist to library (idempotent for existing names).

## Section 5: New Speaker Banner

### Component: `NewSpeakerBanner` (presentational)

**Props:**
```typescript
interface NewSpeakerBannerProps {
  unnamedCount: number;
  onPress: () => void;
}
```

Pure presentational component. All logic (counting unnamed speakers, selecting which label to open the picker for, safe fallback) lives outside — in `LiveTranscript` or a helper.

**Renders:**
- `unnamedCount === 0` → returns null
- `unnamedCount === 1` → pill text: "New voice detected — tap to name"
- `unnamedCount >= 2` → pill text: "N new voices detected — review names"

**Styling:**
- `theme.primary[500]` background at ~15% opacity, `theme.primary[500]` text
- Single line, rounded (`theme.radius.lg`), compact padding
- Positioned between header row and ScrollView — does not scroll

### Logic in `LiveTranscript`

**Unnamed count derivation:**
```typescript
const unnamedCount = Object.values(mappings).filter(
  (m) => m.confidence === 'provisional' && m.displayName !== 'Me'
).length;
```

**Tap handler:**
```typescript
function handleBannerPress() {
  // Find first unnamed label
  const firstUnnamed = Object.entries(mappings).find(
    ([_, m]) => m.confidence === 'provisional' && m.displayName !== 'Me'
  );
  if (firstUnnamed) {
    setPickerLabel(firstUnnamed[0]); // opens SpeakerPicker for this label
  }
  // Safe fallback: if mappings changed and no unnamed left, no-op
}
```

After the user names one speaker, `unnamedCount` decreases and the banner updates automatically (reactive via Zustand subscription). User can tap again for the next unnamed speaker.

## Section 6: File Inventory

### New files

| File | Responsibility |
|------|----------------|
| `app/src/db/knownSpeakers.ts` | CRUD for `known_speakers` table |
| `app/src/services/speakerLibraryService.ts` | Cross-session speaker identity, cache, normalization |
| `app/src/services/__tests__/speakerLibraryService.test.ts` | Library service tests |
| `app/src/components/NewSpeakerBanner.tsx` | Presentational pill for unnamed speaker notification |

### Modified files

| File | Change |
|------|--------|
| `app/src/types/index.ts` | Add `KnownSpeaker` interface |
| `app/src/db/schema.ts` | `migrateToV5` — `known_speakers` table |
| `app/src/db/database.ts` | Call `migrateToV5` |
| `app/src/services/transcriptService.ts` | Session end: deduplicate confirmed names, call `markSeenInSession` |
| `app/src/components/SpeakerPicker.tsx` | Add library names to picker, deduplicate, call `addSpeaker` on confirm |
| `app/src/components/LiveTranscript.tsx` | Insert `NewSpeakerBanner`, derive unnamed count, banner tap handler |
| `app/app/_layout.tsx` | Call `speakerLibraryService.loadLibrary()` at startup |
| `CLAUDE.md` | D.3 architecture section |
| `PHASE_PLAN.md` | Update D.3 status after implementation |
