# Phase D.2 — Voice Enrollment + Speaker Attribution Foundation

Enable Deepgram diarization for speaker segmentation, build voice profile infrastructure from onboarding samples, and add provisional speaker labels with manual correction in the transcript UI.

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Speaker matching | Deepgram diarization + provisional default + manual correction | Foundation phase — real embedding-based matching deferred to D.3 |
| Voice profile | Reference to samples + NULL embedding column | Schema ready for D.3 embeddings without premature processing |
| Default "Me" mapping | Conditional on speaker count (1-2 speakers only) | Avoid fragile assumptions in 3+ speaker meetings |
| Segment speaker field | Raw diarized label only (never mutated) | Display names come from speaker_map, not segment data |
| Speaker map persistence | Session-level JSON column | Simpler than a speakers table for D.2; D.3 can promote |

## Section 1: Deepgram Diarization

Add `diarize: 'true'` to `DEEPGRAM_DEFAULTS` in `config/deepgram.ts`.

Deepgram returns a `speaker` integer (0, 1, 2...) on each transcript result when diarization is enabled. Update `deepgramClient.ts` to parse this field and set `TranscriptSegment.speaker` to the raw diarized label string: `"Speaker 0"`, `"Speaker 1"`, etc.

**`TranscriptSegment.speaker` always holds the raw diarized label from Deepgram.** It is never overwritten with display names like "Me". Display names are resolved at render time via the speaker mapping. This keeps the canonical segment data immutable with respect to identity remapping.

## Section 2: Speaker Identity Model

### Types

```typescript
/** How confident we are in a speaker identity mapping. */
type SpeakerConfidence = 'provisional' | 'user_confirmed';

/** Maps a raw diarized label to a display identity. */
interface SpeakerMapping {
  diarizedLabel: string;         // "Speaker 0" — raw from Deepgram, never changes
  displayName: string;           // "Me", "Speaker 1", or user-assigned name
  confidence: SpeakerConfidence; // provisional until user confirms or corrects
}
```

### Default Mapping Rules (conditional, not universal)

When a new diarized speaker appears during a session:

| Speaker Count | Default Mapping | Rationale |
|--------------|----------------|-----------|
| 1 speaker total | Speaker 0 → "Me" (provisional) | Solo session — almost certainly Carlos |
| 2 speakers total | Speaker 0 → "Me" (provisional), Speaker 1 → "Speaker 1" (provisional) | Likely 1-on-1 — dominant/first speaker is a reasonable guess |
| 3+ speakers total | All speakers → "Speaker N" (provisional) | Meeting — too ambiguous for automatic "Me" assignment |

When speaker count crosses the 3-speaker threshold mid-session:
- If "Me" was already assigned provisionally, **keep it** (don't yank the label mid-session)
- New speakers beyond 2 get generic "Speaker N" labels
- User can always correct any label manually

### Lifecycle

`speakerService` maintains a `Map<string, SpeakerMapping>` per session:
1. On first diarized segment: create mapping for Speaker 0 per rules above
2. On new speaker detected: add mapping per rules above
3. On user correction: update `displayName`, set confidence to `user_confirmed`
4. On session end: persist final mappings to `speaker_map` column

## Section 3: Voice Profile Schema

### Migration (migrateToV4)

```sql
CREATE TABLE IF NOT EXISTS voice_profiles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  label TEXT NOT NULL DEFAULT 'Me',
  status TEXT NOT NULL DEFAULT 'enrolled',
  enrolled_sample_ids TEXT NOT NULL,
  embedding_data BLOB,
  embedding_model TEXT,
  embedding_version TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

ALTER TABLE sessions ADD COLUMN speaker_map TEXT;
```

### Voice Profile Fields

| Field | D.2 Value | Future |
|-------|-----------|--------|
| `label` | `'Me'` | Could support multiple profiles |
| `status` | `'enrolled'` | `'needs_embedding'` → `'ready'` in D.3 |
| `enrolled_sample_ids` | JSON array of voice_samples IDs | Updated when samples added/replaced |
| `embedding_data` | `NULL` | D.3 populates with real embedding |
| `embedding_model` | `NULL` | D.3 sets (e.g., `'pyannote-v3'`) |
| `embedding_version` | `NULL` | D.3 sets for retraining tracking |

### Profile Creation Rule

Create a voice profile when:
1. Valid confirmed enrollment samples exist in `voice_samples` table (`confirmed = 1`)
2. No profile row exists yet

**Triggers** (checked in order of likelihood):
- Onboarding completion (primary)
- App startup (fallback — covers case where onboarding completed but profile creation failed)
- First relevant session start (secondary fallback)

Profile creation is idempotent — if a profile already exists, skip.

### Retraining Readiness

The schema supports future retraining without migration:
- Adding samples: update `enrolled_sample_ids` + `updated_at`
- Marking stale: set status to `'needs_embedding'`
- Resetting: delete profile row, recreate from current samples
- D.2 does not implement retraining UI (post-launch follow-up)

## Section 4: Session Speaker Map Persistence

Add `speaker_map TEXT` column to sessions table. On session end, persist the final mappings as JSON:

```json
{
  "Speaker 0": { "diarizedLabel": "Speaker 0", "displayName": "Me", "confidence": "provisional" },
  "Speaker 1": { "diarizedLabel": "Speaker 1", "displayName": "Speaker 1", "confidence": "provisional" }
}
```

The JSON is keyed by diarized label for fast lookup. Each entry explicitly preserves the raw label, display name, and confidence — the association is durable even if the JSON structure is refactored later.

`TranscriptSegment.speaker` in `transcript_timestamps` always contains the raw diarized label (`"Speaker 0"`). To resolve display names, consumers read `speaker_map` and look up the segment's speaker field.

## Section 5: Transcript UI — Speaker Labels + Manual Correction

### LiveTranscript Changes

Each segment displays its resolved speaker name before the text:

```
Me: Hey team, I wanted to talk about the project timeline.
Speaker 1: Sounds good, what are you thinking?
Me: So basically what I'm thinking is...
```

Speaker name resolution: `speakerService.getDisplayName(segment.speaker)` → looks up the mapping → returns display name.

**Provisional indicators:** Provisional labels (not user-confirmed) render with slightly muted opacity to communicate "this is a guess." User-confirmed labels render at full opacity.

**Tap to correct:** Tapping a speaker label opens `SpeakerPicker` — a simple bottom-sheet or modal with:
- "Me" option
- Existing speaker names from this session
- "New name..." text entry
- Reassignment applies to all segments with that diarized label (past and future in session)

### SpeakerPicker Component

Minimal modal:
- List of identity options (Me, existing names, custom entry)
- Selecting an option calls `speakerService.reassignSpeaker(diarizedLabel, newDisplayName)`
- Updates the mapping, sets confidence to `user_confirmed`
- All rendered segments with that diarized label immediately reflect the new name (reactive via store)

## Section 6: New Modules

### `speakerService.ts`

Manages speaker mappings per session.

```typescript
// API surface
getSpeakerMap(): Map<string, SpeakerMapping>
getDisplayName(diarizedLabel: string): string
handleNewSpeaker(diarizedLabel: string): void  // applies default rules
reassignSpeaker(diarizedLabel: string, newDisplayName: string): void
reset(): void  // on new session
persistToSession(sessionId: string): Promise<void>
```

Holds the mapping in a Zustand store (or reactive Map) so LiveTranscript re-renders when mappings change.

### `voiceProfileService.ts`

Creates/reads voice profiles from enrollment samples.

```typescript
// API surface
ensureProfileExists(): Promise<void>  // idempotent — create if samples exist + no profile
getProfile(): Promise<VoiceProfile | null>
getProfileStatus(): Promise<'none' | 'enrolled' | 'needs_embedding' | 'ready'>
```

Called at app startup and after onboarding. D.2 implementation is simple — just creates the profile row. D.3 extends with embedding generation.

### No changes to transcriptStore

Speaker labels flow through `TranscriptSegment.speaker` (raw diarized label). Display name resolution happens at render time in `LiveTranscript`. The store doesn't need to know about speaker mappings.

## Section 7: Integration Points

### deepgramClient.ts Changes

Parse the `speaker` field from Deepgram results. Current code sets `speaker: null`. Change to:

```typescript
speaker: data.channel?.alternatives?.[0]?.words?.[0]?.speaker != null
  ? `Speaker ${data.channel.alternatives[0].words[0].speaker}`
  : null,
```

Deepgram puts the speaker integer on each word. Use the first word's speaker as the segment-level speaker.

### transcriptService.ts Changes

When a new segment arrives with a speaker label:
1. Call `speakerService.handleNewSpeaker(segment.speaker)` if not already mapped
2. Segment goes to transcriptStore as-is (raw diarized label)

On session end:
1. Call `speakerService.persistToSession(sessionId)` alongside transcript persistence
2. Speaker map and transcript are written in the same session finalization flow

### LiveTranscript.tsx Changes

Resolve display names at render time:
```typescript
const displayName = speakerService.getDisplayName(segment.speaker);
```

Add tap handler on speaker label → open SpeakerPicker.

## Section 8: Files to Create/Modify

| File | Action |
|------|--------|
| `app/src/config/deepgram.ts` | Add `diarize: 'true'` to defaults |
| `app/src/services/deepgramClient.ts` | Parse speaker field from Deepgram results |
| `app/src/types/index.ts` | Add SpeakerMapping, SpeakerConfidence, VoiceProfile, VoiceProfileStatus types |
| `app/src/db/schema.ts` | Add migrateToV4: voice_profiles table + speaker_map column |
| `app/src/db/voiceProfiles.ts` | **New** — CRUD for voice profiles |
| `app/src/db/sessions.ts` | Add updateSpeakerMap query |
| `app/src/services/speakerService.ts` | **New** — session speaker mapping with conditional defaults |
| `app/src/services/voiceProfileService.ts` | **New** — voice profile creation from samples |
| `app/src/services/transcriptService.ts` | Wire speakerService into segment handling + session finalization |
| `app/src/components/LiveTranscript.tsx` | Show speaker labels, provisional indicator, tap to correct |
| `app/src/components/SpeakerPicker.tsx` | **New** — modal for reassigning speaker identity |
| `app/app/_layout.tsx` | Call voiceProfileService.ensureProfileExists() at startup |

## Section 9: Testing

- **speakerService:** Default mapping rules (1/2/3+ speakers), reassignment, persistence serialization
- **voiceProfileService:** Profile creation from samples, idempotent re-creation, getProfileStatus
- **deepgramClient:** Speaker field parsing (speaker present, speaker absent, speaker changes mid-segment)
- **LiveTranscript:** Speaker label rendering, provisional vs confirmed visual distinction
- **Integration:** Full flow: Deepgram segment with speaker → mapping → display → persist

## Section 10: What D.2 Does NOT Do

- No embedding computation (D.3)
- No automatic voice matching beyond default rules (D.3)
- No return-visitor recognition (D.3)
- No "New voice detected" prompts (D.3)
- No retraining UI (post-launch follow-up)
- No speaker library across sessions (D.3)
