# D.7 v1 Session Detail & Transcript Review Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Session Detail modal screen accessible from every expanded history card. The screen shows the full session transcript (speaker-attributed flat list), AI summary (reusing D.6 logic), and a collapsible alert timeline — making history a real session review surface.

**Architecture:** Pure UI ticket. One new screen (`app/session/[id].tsx`), one Stack.Screen registration, one "View Details →" entry point in the history card. No new services, no new DB functions, no new types.

**Tech Stack:** TypeScript, React Native, expo-router (Stack modal), expo-sqlite (existing `getSessionById` + `getAlertEvents`), existing D.6 summary service

**Spec:** `docs/specs/2026-04-12-d7-session-detail-transcript-review-design.md`

---

### Task 1: Route registration + "View Details →" entry point

**Files:**
- Modify: `app/app/_layout.tsx`
- Modify: `app/app/(tabs)/history.tsx`

This task wires up navigation before the detail screen exists. The link will be visible but navigating to it will show a blank/404 screen until Task 2 is complete — that's fine.

- [ ] **Step 1: Register modal route in root layout**

Open `app/app/_layout.tsx`. Inside the `<Stack>` block (currently has `(tabs)` and `onboarding`), add:

```tsx
<Stack.Screen name="session/[id]" options={{ presentation: 'modal' }} />
```

Full Stack block after the change:
```tsx
<Stack screenOptions={{ headerShown: false }}>
  <Stack.Screen name="(tabs)" />
  <Stack.Screen name="onboarding" options={{ presentation: 'modal' }} />
  <Stack.Screen name="session/[id]" options={{ presentation: 'modal' }} />
</Stack>
```

- [ ] **Step 2: Add "View Details →" link to expanded history card**

Open `app/app/(tabs)/history.tsx`.

Add `useRouter` import:
```tsx
import { useRouter } from 'expo-router';
```

Inside `SessionCard`, add the router and handler:
```tsx
const router = useRouter();

function handleViewDetails() {
  router.push(`/session/${session.id}`);
}
```

At the bottom of the expanded card content (after the AI Summary / failed state blocks, before the closing `</View>`), add:

```tsx
<Pressable onPress={handleViewDetails} style={{ marginTop: theme.spacing.md, alignSelf: 'flex-end' }}>
  <Text style={[theme.type.small, { color: theme.primary[400], fontFamily: theme.fontFamily.semibold }]}>
    View Details →
  </Text>
</Pressable>
```

- [ ] **Step 3: Type check**

```bash
cd app && node node_modules/typescript/bin/tsc --noEmit
```
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add app/app/_layout.tsx app/app/(tabs)/history.tsx
git commit -m "feat(D7): register session/[id] modal route + View Details entry point"
```

---

### Task 2: Session Detail screen — scaffold + header

**Files:**
- Create: `app/app/session/[id].tsx`

Build the screen skeleton with data loading and the non-scrolling header. No content sections yet — just the shell, loading state, and error state.

- [ ] **Step 1: Create the file with data loading**

Create `app/app/session/[id].tsx`:

```tsx
/**
 * Session Detail Screen — D.7 v1
 *
 * Modal screen showing full session review: transcript (dominant),
 * AI summary (secondary), and alert timeline (accordion).
 */
import { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTheme } from '../../src/theme/theme';
import { getSessionById, getAlertEvents } from '../../src/db/sessions';
import type { Session, AlertEvent } from '../../src/types';
import { formatSessionDate, formatDuration, formatOffset } from '../../src/utils/timeFormat';

export default function SessionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const theme = useTheme();

  const [session, setSession] = useState<Session | null>(null);
  const [events, setEvents] = useState<AlertEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!id) return;
    Promise.all([getSessionById(id), getAlertEvents(id)])
      .then(([s, evts]) => {
        setSession(s ?? null);
        setEvents(evts);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <SafeAreaView style={[styles.root, { backgroundColor: theme.colors.bg }]}>
        <ActivityIndicator color={theme.primary[400]} style={{ flex: 1 }} />
      </SafeAreaView>
    );
  }

  if (error || !session) {
    return (
      <SafeAreaView style={[styles.root, { backgroundColor: theme.colors.bg }]}>
        <View style={styles.errorContainer}>
          <Text style={[theme.type.body, { color: theme.text.secondary }]}>
            Session not found.
          </Text>
          <Pressable onPress={() => router.back()} style={{ marginTop: 16 }}>
            <Text style={[theme.type.small, { color: theme.primary[400] }]}>← Back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: theme.colors.bg }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.colors.elevated }]}>
        <Pressable onPress={() => router.back()}>
          <Text style={[theme.type.small, { color: theme.primary[400], fontFamily: theme.fontFamily.semibold }]}>
            ← Back
          </Text>
        </Pressable>
        <Text style={[theme.type.label, { color: theme.text.primary, fontFamily: theme.fontFamily.semibold, marginTop: 8 }]}>
          {formatSessionDate(session.startedAt)}
        </Text>
        <View style={styles.headerMeta}>
          <Text style={[theme.type.small, { color: theme.text.secondary }]}>
            {formatDuration(session.durationMs)}
          </Text>
          {session.sessionContext && (
            <View style={[styles.contextBadge, { backgroundColor: theme.primary[900] }]}>
              <Text style={[theme.type.tiny ?? theme.type.small, { color: theme.primary[300], fontFamily: theme.fontFamily.semibold, fontSize: 11 }]}>
                {session.sessionContext.replace('_', ' ')}
              </Text>
            </View>
          )}
          {session.alertCount > 0 && (
            <View style={[styles.alertBadge, { backgroundColor: theme.alert.urgentBg ?? theme.colors.elevated }]}>
              <Text style={[theme.type.small, { color: theme.alert.urgent, fontFamily: theme.fontFamily.semibold, fontSize: 11 }]}>
                {session.alertCount} {session.alertCount === 1 ? 'alert' : 'alerts'}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Scrollable content — filled in Tasks 3–5 */}
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={[theme.type.small, { color: theme.text.tertiary }]}>
          {/* Placeholder — replaced in Tasks 3–5 */}
          Session detail content coming soon.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  contextBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  alertBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
});
```

- [ ] **Step 2: Type check**

```bash
cd app && node node_modules/typescript/bin/tsc --noEmit
```
Expected: 0 errors. Fix any theme token references that don't exist (e.g. `theme.type.tiny`, `theme.alert.urgentBg`) by substituting with known tokens.

- [ ] **Step 3: Verify navigation works**

Run Metro (`npx expo start --clear`), reload app, expand a history card, tap "View Details →". The modal should slide up and show the header with session date/duration. Back button and swipe-down should dismiss. If it navigates but shows an error, check the `id` param via `console.log`.

- [ ] **Step 4: Commit**

```bash
git add app/app/session/[id].tsx
git commit -m "feat(D7): session detail screen scaffold with header and data loading"
```

---

### Task 3: Transcript section

**Files:**
- Modify: `app/app/session/[id].tsx`

Replace the placeholder content in the ScrollView with the transcript section. This is the dominant content — it appears first and takes up most of the screen.

- [ ] **Step 1: Add transcript parsing helpers inside the file**

Add these pure functions near the top of the file (below imports, above the component):

```typescript
import type { TranscriptSegment, SpeakerMapping } from '../../src/types';

/** Safely parse transcriptTimestamps JSON. Returns null on any failure. */
function parseSegments(raw: string | null): TranscriptSegment[] | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/** Safely parse speakerMap JSON. Returns empty array on any failure. */
function parseSpeakerMap(raw: string | null): SpeakerMapping[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Resolve a diarized label to a display name. */
function resolveName(label: string | null, mappings: SpeakerMapping[]): string {
  if (!label) return 'Unknown';
  return mappings.find((m) => m.diarizedLabel === label)?.displayName ?? label;
}

interface Turn {
  displayName: string;
  startMs: number;
  text: string;
}

/** Group consecutive isFinal segments from the same speaker into turns. */
function buildTurns(segments: TranscriptSegment[], mappings: SpeakerMapping[]): Turn[] {
  const turns: Turn[] = [];
  for (const seg of segments) {
    if (!seg.isFinal) continue;
    const name = resolveName(seg.speaker, mappings);
    const last = turns[turns.length - 1];
    if (last && last.displayName === name) {
      last.text += ' ' + seg.text;
    } else {
      turns.push({ displayName: name, startMs: seg.start, text: seg.text });
    }
  }
  return turns;
}
```

- [ ] **Step 2: Replace ScrollView placeholder with transcript section**

Inside the component, compute transcript data before the return:
```typescript
const segments = parseSegments(session.transcriptTimestamps);
const speakerMappings = parseSpeakerMap(session.speakerMap);
const turns = segments ? buildTurns(segments, speakerMappings) : null;
```

Replace the ScrollView placeholder content with:
```tsx
{/* ── Transcript ── */}
<View style={styles.section}>
  <Text style={[styles.sectionLabel, { color: theme.text.tertiary, fontFamily: theme.fontFamily.semibold }]}>
    Transcript
  </Text>

  {turns && turns.length > 0 ? (
    turns.map((turn, i) => (
      <View key={i} style={styles.turn}>
        <View style={styles.turnHeader}>
          <Text style={[theme.type.small, { color: theme.primary[400], fontFamily: theme.fontFamily.semibold }]}>
            {turn.displayName}
          </Text>
          <Text style={[theme.type.small, { color: theme.text.tertiary }]}>
            {' · '}{formatOffset(turn.startMs)}
          </Text>
        </View>
        <Text style={[theme.type.small, { color: theme.text.secondary, lineHeight: 22, marginTop: 2 }]}>
          {turn.text}
        </Text>
      </View>
    ))
  ) : session.transcript ? (
    <Text style={[theme.type.small, { color: theme.text.secondary, lineHeight: 22 }]}>
      {session.transcript}
    </Text>
  ) : (
    <Text style={[theme.type.small, { color: theme.text.tertiary, fontStyle: 'italic' }]}>
      No transcript was recorded for this session.
    </Text>
  )}
</View>
```

Add to StyleSheet:
```typescript
section: {
  marginBottom: 28,
},
sectionLabel: {
  fontSize: 11,
  textTransform: 'uppercase',
  letterSpacing: 0.8,
  marginBottom: 12,
},
turn: {
  marginBottom: 16,
},
turnHeader: {
  flexDirection: 'row',
  alignItems: 'center',
},
```

- [ ] **Step 3: Type check**

```bash
cd app && node node_modules/typescript/bin/tsc --noEmit
```
Expected: 0 errors

- [ ] **Step 4: Verify on device**

Reload app. Open a session with a captured transcript. Verify:
- Speaker turns appear with names and timestamps
- Consecutive same-speaker segments are merged into one turn block
- Sessions without transcript show "No transcript was recorded…"

- [ ] **Step 5: Commit**

```bash
git add app/app/session/[id].tsx
git commit -m "feat(D7): transcript section with speaker turns and fallbacks"
```

---

### Task 4: AI Summary section

**Files:**
- Modify: `app/app/session/[id].tsx`

Add the AI Summary section below the transcript. Reuse D.6 logic exactly — same `generateSummary()`, `summaryEligibilityReason()`, `updateSummaryStatus()`, and 4-state UI pattern as the history card.

- [ ] **Step 1: Add summary imports and state**

Add imports at the top of the file:
```typescript
import { generateSummary, summaryEligibilityReason } from '../../src/services/summaryService';
import { updateSummaryStatus } from '../../src/db/sessions';
import { ANTHROPIC_API_KEY } from '../../src/config/anthropic';
```

Add state inside the component (after existing state declarations):
```typescript
const [localSummary, setLocalSummary] = useState<string | null>(session?.summary ?? null);
const [localStatus, setLocalStatus] = useState(session?.summaryStatus ?? null);
const [generating, setGenerating] = useState(false);
```

Add stale-state recovery effect (same pattern as history card):
```typescript
useEffect(() => {
  if (session?.summaryStatus === 'generating') {
    setLocalStatus(null);
    updateSummaryStatus(session.id, null).catch((e) =>
      console.warn('[SessionDetail] Failed to clear stale generating status:', e),
    );
  }
// eslint-disable-next-line react-hooks/exhaustive-deps
}, []); // run once on mount
```

Add generate handler:
```typescript
async function handleGenerateSummary() {
  if (!session || generating) return;
  setGenerating(true);
  setLocalStatus('generating');
  try {
    await generateSummary(session.id);
    const updated = await getSessionById(session.id);
    if (updated) {
      setLocalSummary(updated.summary);
      setLocalStatus(updated.summaryStatus);
    }
  } catch (e) {
    console.warn('[SessionDetail] Summary generation failed:', e);
    setLocalStatus('failed');
  } finally {
    setGenerating(false);
  }
}
```

- [ ] **Step 2: Add summary section below transcript in ScrollView**

```tsx
{/* ── AI Summary ── */}
{ANTHROPIC_API_KEY && (
  <View style={styles.section}>
    <Text style={[styles.sectionLabel, { color: theme.text.tertiary, fontFamily: theme.fontFamily.semibold }]}>
      AI Summary
    </Text>

    {/* Generating */}
    {(generating || localStatus === 'generating') && (
      <View style={[styles.summaryPill, { backgroundColor: theme.colors.elevated, opacity: 0.7 }]}>
        <Text style={[theme.type.small, { color: theme.text.secondary, fontFamily: theme.fontFamily.semibold }]}>
          Generating summary…
        </Text>
      </View>
    )}

    {/* Button */}
    {!generating && localStatus !== 'generating' && session && summaryEligibilityReason({
      durationMs: session.durationMs,
      transcript: session.transcript ?? null,
      summary: localSummary,
      summaryStatus: localStatus,
    }) === null && (
      <Pressable
        onPress={handleGenerateSummary}
        style={[styles.summaryPill, { backgroundColor: theme.primary[500] }]}
      >
        <Text style={[theme.type.small, { color: '#fff', fontFamily: theme.fontFamily.semibold }]}>
          Generate Summary
        </Text>
      </Pressable>
    )}

    {/* Complete */}
    {localStatus === 'complete' && localSummary && (
      <Text style={[theme.type.small, { color: theme.text.secondary, lineHeight: 22 }]}>
        {localSummary}
      </Text>
    )}

    {/* Failed */}
    {localStatus === 'failed' && !generating && (
      <Pressable onPress={handleGenerateSummary}>
        <Text style={[theme.type.small, { color: theme.alert.urgent }]}>
          Summary failed. Tap to retry.
        </Text>
      </Pressable>
    )}
  </View>
)}
```

Add to StyleSheet:
```typescript
summaryPill: {
  alignSelf: 'flex-start',
  paddingHorizontal: 16,
  paddingVertical: 8,
  borderRadius: 999,
},
```

- [ ] **Step 3: Type check**

```bash
cd app && node node_modules/typescript/bin/tsc --noEmit
```
Expected: 0 errors

- [ ] **Step 4: Verify on device**

Reload app. Open a session with a transcript. Verify:
- "Generate Summary" button appears for eligible sessions
- Tap → generating pill shows immediately
- Summary text appears after generation
- Already-generated sessions show summary text directly
- Sessions without API key → AI Summary section hidden

- [ ] **Step 5: Commit**

```bash
git add app/app/session/[id].tsx
git commit -m "feat(D7): AI summary section reusing D.6 logic"
```

---

### Task 5: Alert Timeline accordion

**Files:**
- Modify: `app/app/session/[id].tsx`

Add the collapsible alert timeline at the bottom of the scroll. Collapsed by default — it's reference data, not primary review content.

- [ ] **Step 1: Add timeline state**

```typescript
const [timelineOpen, setTimelineOpen] = useState(false);
```

Events are already loaded in the data fetch effect (Task 2). No additional loading needed.

- [ ] **Step 2: Import AlertLevel and badge helper**

```typescript
import { AlertLevel } from '../../src/types';
```

Add a local alert badge color helper (same logic as history card):
```typescript
function alertBadgeColor(level: AlertLevel, theme: Theme): string {
  switch (level) {
    case AlertLevel.GENTLE: return theme.alert.gentle;
    case AlertLevel.MODERATE: return theme.alert.moderate;
    case AlertLevel.URGENT: return theme.alert.urgent;
    case AlertLevel.CRITICAL: return theme.alert.critical ?? theme.alert.urgent;
    default: return theme.text.tertiary;
  }
}
```

Note: `Theme` import — use the existing `useTheme` return type. Check `app/src/theme/theme.ts` for the exported type name; it may be `ReturnType<typeof useTheme>` or a named export.

- [ ] **Step 3: Add timeline section below summary**

```tsx
{/* ── Alert Timeline ── */}
{events.length > 0 && (
  <View style={styles.section}>
    <Pressable
      onPress={() => setTimelineOpen((o) => !o)}
      style={styles.accordionHeader}
    >
      <Text style={[styles.sectionLabel, { color: theme.text.tertiary, fontFamily: theme.fontFamily.semibold, marginBottom: 0 }]}>
        Alert Timeline
      </Text>
      <Text style={[theme.type.small, { color: theme.text.tertiary }]}>
        {events.length} {events.length === 1 ? 'alert' : 'alerts'}  {timelineOpen ? '▲' : '▶'}
      </Text>
    </Pressable>

    {timelineOpen && (
      <View style={{ marginTop: 12 }}>
        {events.map((event, i) => (
          <View key={i} style={styles.timelineRow}>
            <Text style={[theme.type.small, { color: theme.text.tertiary, width: 36 }]}>
              {formatOffset(event.timestamp)}
            </Text>
            <View style={[styles.timelineDot, { backgroundColor: alertBadgeColor(event.alertLevel, theme) }]} />
            <Text style={[theme.type.small, { color: theme.text.secondary, flex: 1 }]}>
              {formatDuration(event.durationAtAlert)} of continuous speech
            </Text>
          </View>
        ))}
      </View>
    )}
  </View>
)}
```

Add to StyleSheet:
```typescript
accordionHeader: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
},
timelineRow: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 8,
  marginBottom: 8,
},
timelineDot: {
  width: 8,
  height: 8,
  borderRadius: 4,
},
```

- [ ] **Step 4: Type check**

```bash
cd app && node node_modules/typescript/bin/tsc --noEmit
```
Expected: 0 errors

- [ ] **Step 5: Verify on device**

Reload app. Open a session with alerts. Verify:
- "Alert Timeline ▶ N alerts" header is visible
- Tap header → expands with timeline entries
- Tap again → collapses
- Sessions with no alerts → accordion not shown

- [ ] **Step 6: Commit**

```bash
git add app/app/session/[id].tsx
git commit -m "feat(D7): alert timeline accordion section"
```

---

### Task 6: Docs + PHASE_PLAN update

**Files:**
- Modify: `CLAUDE.md`
- Modify: `PHASE_PLAN.md`

- [ ] **Step 1: Update CLAUDE.md**

Add a "Session Detail & Transcript Review (Phase D.7 v1)" section after the "Post-Session Summaries (Phase D.6 v1)" section:

```markdown
### Session Detail & Transcript Review (Phase D.7 v1)
`app/app/session/[id].tsx` is a modal route (registered in `_layout.tsx`) presenting the full session review surface. Navigated via "View Details →" text link at the bottom of every expanded history card.
Screen sections: compact header (date/duration/context/alerts) → Transcript (dominant) → AI Summary (reuses D.6 logic) → Alert Timeline accordion (collapsed by default).
Transcript rendering: parse `transcriptTimestamps` → `TranscriptSegment[]`, parse `speakerMap` → `SpeakerMapping[]`, group consecutive same-speaker `isFinal` segments into named turns. Fallback chain: speaker turns → flat text → "No transcript" empty state.
No new services, no new DB functions, no new types. Pure UI ticket.
```

- [ ] **Step 2: Update PHASE_PLAN.md**

Mark the D.7 line as complete:
```
- [x] RG-D.7: Session detail screen + transcript review
```

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md PHASE_PLAN.md
git commit -m "docs: update CLAUDE.md + PHASE_PLAN.md for D.7 v1 session detail"
```
