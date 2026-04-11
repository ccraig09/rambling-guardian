# D.5 v1 — Context-Aware Coaching Profiles — Design Spec

## Purpose

Adjust the device's speech-duration alert thresholds based on the session's classified context. Solo sessions use the user's Settings thresholds. With Others sessions get tighter alerts (monologuing in conversation is worse). Presenting sessions get relaxed alerts (you're expected to talk long). The user sees which profile is active, but does not configure per-profile thresholds in v1.

This builds directly on D.4 (context classification) and the existing device alert system (4-tier speech timer with BLE-writable thresholds).

## Scope

### In scope
- Three named threshold profiles: Solo (Standard), With Others (Tighter), Presenting (Relaxed)
- Per-threshold multipliers derived from the user's Settings baseline
- Safety rails: rounding, floor/ceiling clamping, monotonic enforcement
- Automatic BLE threshold writes when context changes
- Manual context override triggers immediate profile switch
- Profile label shown on the existing SessionContextPill
- Session start/end lifecycle (Solo baseline on start, restore on end)
- Settings changes during active session trigger recomputation
- BLE reconnect re-asserts the correct profile

### Out of scope
- Transcript-based coaching (filler words, pacing, WPM) — deferred to D.5 Phase 2
- Per-context threshold customization UI (editable profiles)
- Firmware changes — uses existing `CHR_THRESHOLDS` (`4A980008`) BLE characteristic
- New database columns — profiles are live behavior, not persisted
- Post-session profile reporting in history

## Threshold Profiles

### The Model

Settings thresholds = the Solo profile. The user's custom Settings values are always what Solo uses. With Others and Presenting profiles are computed as multipliers on the Solo base, not independent values.

If the user changes Settings to 10/20/40/80, Solo becomes 10/20/40/80. With Others and Presenting scale proportionally. Multipliers respect the user's personal baseline — fixed profile values would ignore tuned preferences.

### Per-Threshold Multipliers

Each alert level has its own multiplier per profile. This is not one rough profile-wide multiplier.

| | Gentle | Moderate | Urgent | Critical |
|---|---|---|---|---|
| **Solo** | 1.0x | 1.0x | 1.0x | 1.0x |
| **With Others** | 0.7x | 0.7x | 0.65x | 0.75x |
| **Presenting** | 3.0x | 3.0x | 3.0x | 3.0x |

Rationale:
- With Others: tighter across the board, but critical gets a slightly gentler ratio (0.75x) so the "hard stop" alert still gives the user a moment to wrap up. Earlier levels compress more aggressively.
- Presenting: uniform 3x. Simple, generous, keeps the ladder proportional to whatever the user set in Settings.

### Derivation Formula

```
derivedThreshold = Math.round(baseThreshold × multiplier)
```

### Safety Rails

These are internal safety rails, not user-facing settings. They prevent derived values from becoming too aggressive or too loose.

**Floor clamps (minimum seconds):**
| Gentle | Moderate | Urgent | Critical |
|---|---|---|---|
| 3 | 5 | 10 | 15 |

**Ceiling clamps (maximum seconds):**
| Gentle | Moderate | Urgent | Critical |
|---|---|---|---|
| 30 | 60 | 120 | 300 |

**Monotonic enforcement:** After clamping, walk the ladder. If `moderate <= gentle`, set `moderate = gentle + 1`. Same for `urgent <= moderate` and `critical <= urgent`. This guarantees thresholds are strictly increasing.

**Application order:** multiply → round → clamp floors → clamp ceilings → enforce monotonic.

### Worked Examples

**Default Solo baseline (7/15/30/60):**

| | Gentle | Moderate | Urgent | Critical |
|---|---|---|---|---|
| **Solo** | 7 | 15 | 30 | 60 |
| **With Others** (raw → round) | 4.9→5 | 10.5→11 | 19.5→20 | 45→45 |
| **With Others** (after guards) | 5 | 11 | 20 | 45 |
| **Presenting** (raw → round) | 21→21 | 45→45 | 90→90 | 180→180 |
| **Presenting** (after guards) | 21 | 45 | 90 | 180 |

**Aggressive user Solo baseline (3/8/15/25):**

| | Gentle | Moderate | Urgent | Critical |
|---|---|---|---|---|
| **Solo** | 3 | 8 | 15 | 25 |
| **With Others** (raw → round) | 2.1→2 | 5.6→6 | 9.75→10 | 18.75→19 |
| **With Others** (after guards) | 3 | 6 | 10 | 19 |
| **Presenting** (raw → round) | 9→9 | 24→24 | 45→45 | 75→75 |
| **Presenting** (after guards) | 9 | 24 | 45 | 75 |

Note: With Others gentle hit the 3s floor and got clamped. Monotonic still holds.

## Threshold Write Lifecycle

### Trigger Points

| Event | Action |
|---|---|
| **Session starts** | Compute profile from current context (null at start → Solo). Write Solo thresholds to device. |
| **Context classification changes** | D.4 classifier fires after ~15 segments. If context changes, recompute profile and conditionally write. |
| **User manually overrides context** | Recompute profile from override and write immediately (bypasses stability guard). |
| **Settings changed during active session** | If BLE connected, recompute current context profile with new base and write. If not connected, apply on reconnect or next session. |
| **Session ends** | Restore the user's Solo (Settings) thresholds. Device never carries a non-Solo profile into idle. |
| **BLE reconnect while idle** | Re-assert Solo baseline. |
| **BLE reconnect during active session** | Re-assert `activeProfile` from sessionStore (the last successfully written profile). |

### Before Context Is Known

When a session starts, D.4 hasn't classified yet (needs 15 segments). During this window, use Solo thresholds. Solo is the user's Settings baseline — the safest default. If context later resolves to With Others or Presenting, the thresholds update at that point. The first ~30-60 seconds of every session use Solo.

### Write-Only-On-Change Rule

The app tracks the last successfully written thresholds (`activeProfile` in sessionStore). If context changes but the derived ladder is identical to what's already on the device (possible with clamping edge cases), skip the BLE write.

### Write-Stability Guard

To prevent BLE write churn if context briefly fluctuates while evidence is settling, apply a stability guard:
- After a context-triggered threshold write, suppress further context-triggered writes for 5 seconds.
- Manual overrides bypass this guard (user intent is immediate).
- Settings changes during a session bypass this guard (user explicitly changed their baseline).

### Applied-Profile State

`activeProfile` and `lastProfileWriteTime` in sessionStore represent the profile actually applied to the device:
- Update them only after a successful BLE write.
- On write failure, keep the prior applied state. The profile will be re-asserted on BLE reconnect.
- This means the store always reflects device truth, not intent.

## Orchestration — Single Authority for Threshold Writes

**Rule:** UI (`session.tsx`) does not directly own BLE threshold-write logic. UI can set manual override state (via sessionStore). A service/coordinator layer is the single owner of compute → compare → BLE write behavior.

### The Coordinator: `coachingProfileService.ts`

This service intentionally contains two layers in a single file:

**Layer 1 — Pure profile logic (no side effects, no store/BLE access):**
- `computeProfileThresholds(context, baseThresholds) → AlertThresholds` — multipliers + safety rails
- `getProfileLabel(context) → string` — returns "Standard alerts" / "Tighter alerts" / "Relaxed alerts"

These are stateless pure functions. They can be unit-tested with no mocking.

**Layer 2 — Thin orchestration coordinator (has side effects — reads stores, writes BLE):**
- `applyProfileForCurrentContext(options?: { bypassStabilityGuard?: boolean })` — the single authoritative path for all threshold writes during a session:
  1. Read current context from `sessionStore.sessionContext`
  2. Read base thresholds from `settingsStore.thresholds`
  3. Compute derived thresholds via `computeProfileThresholds`
  4. Compare with `sessionStore.activeProfile` — skip if identical
  5. Check stability guard (unless bypassed)
  6. Write via `bleService.writeThresholds()`
  7. On success: update `sessionStore.activeProfile` and `lastProfileWriteTime`
  8. On failure: log warning, keep prior state (reconnect will retry)

### Who Calls the Coordinator

| Caller | Trigger | Bypass stability guard? |
|---|---|---|
| `transcriptService.ts` | Context classification changed | No |
| `session.tsx` via `applyContextOverride()` | Manual override set (sets store, then calls coordinator) | Yes |
| `settingsStore.ts` | Thresholds changed during active session | Yes |
| `sessionTracker.ts` | Session start | N/A (always writes Solo) |
| `sessionTracker.ts` | Session end | N/A (always restores Solo) |
| `bleManager.ts` | BLE reconnect | N/A (re-asserts stored profile) |

Session start/end and BLE reconnect are direct `bleService.writeThresholds()` calls (not through the coordinator) because they always write a known value (Solo or stored activeProfile), not a computed one.

## UI

### SessionContextPill Extension

The existing `SessionContextPill` component gains an optional `profileLabel` prop:

```
Props:
  context: SessionContext | null        // from D.4
  isOverride: boolean                   // from D.4
  profileLabel: string | null           // NEW — from coachingProfileService
  onPress: () => void                   // from D.4
```

**Display format:**
- Context only (no profile): `[ Solo ]` — same as D.4 (fallback if profileLabel is null)
- Context + profile: `[ Solo · Standard alerts ]`
- Context + profile + override: `[ With Others · Tighter alerts · ]`

**When to show the profile label:**
- Only when there is an active classified context (context is not null)
- Before classification floor is met, pill shows nothing (same as D.4)

**Profile label strings** come from `coachingProfileService.getProfileLabel(context)`:
```
solo → "Standard alerts"
with_others → "Tighter alerts"
presentation → "Relaxed alerts"
```

The label mapping lives in the service (not the component) so it stays co-located with the profile definitions. This is intentional — `getProfileLabel` is part of `coachingProfileService` because the labels are a property of the profile system, not a UI concern. The component consumes the label as a string prop without knowing which profile produced it.

### Settings Screen

No changes. Settings still controls "my alert thresholds" — the Solo baseline. No mention of profiles in Settings for v1.

### Session History

No changes. The profile was a live behavior, not a stored artifact.

## Architecture

### New Files

| File | Purpose |
|---|---|
| `app/src/services/coachingProfileService.ts` | Pure threshold computation + orchestration function |
| `app/src/services/__tests__/coachingProfileService.test.ts` | Unit tests for multipliers, clamping, monotonic, edge cases |

### Modified Files

| File | Change |
|---|---|
| `app/src/stores/sessionStore.ts` | Add `activeProfile: AlertThresholds \| null`, `lastProfileWriteTime: number \| null` |
| `app/src/services/transcriptService.ts` | Call `applyProfileForCurrentContext()` after context classification change |
| `app/src/components/SessionContextPill.tsx` | Add `profileLabel` prop, render extended label |
| `app/app/(tabs)/session.tsx` | Pass `profileLabel` to pill, wire override to trigger profile apply |
| `app/src/services/sessionTracker.ts` | Write Solo on session start, restore Solo on session end |
| `app/src/services/bleManager.ts` | Reconnect writes activeProfile (active session) or Solo (idle) |

### No Changes

- No firmware changes — existing `CHR_THRESHOLDS` BLE characteristic accepts threshold writes
- No new BLE characteristics
- No new database columns or migrations
- No new screens or modals

## Testing Strategy

### Unit tests (coachingProfileService)

- Solo profile returns base thresholds unchanged
- With Others applies correct per-threshold multipliers
- Presenting applies correct per-threshold multipliers
- Floor clamping activates when derived value is too low
- Ceiling clamping activates when derived value is too high
- Monotonic enforcement fixes non-increasing sequences after clamping
- Application order is correct (multiply → round → clamp → monotonic)
- Edge case: all base thresholds at minimum → clamping + monotonic produce valid ladder
- Edge case: all base thresholds at maximum → clamping + monotonic produce valid ladder

### Integration tests

- Override stickiness: manual override triggers immediate profile write (bypass stability)
- Context change with stability guard: rapid context changes don't produce multiple writes
- Session lifecycle: Solo written on start, profile restored on end

## What This Does NOT Include (Future D.5 Phase 2)

Transcript-derived coaching signals — filler word counts, speaking pace (WPM), turn-taking balance. Post-session only. Not live, not broad, not part of this implementation pass. Will be designed and scoped separately.
