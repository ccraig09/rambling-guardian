# Triggered Activation Design Brief

**Date:** 2026-04-07
**Status:** Approved — replaces always-listening model for v1
**Phases:** D-pre A (Triggered Activation Foundation), D-pre B (Standalone Backlog Foundation)

---

## 1. Direction Change

The device is idle by default, not always-listening. Sessions begin intentionally through a trigger (button press, BLE command, future Apple Watch shortcut). This replaces the always-on MONITORING mode from the original design.

**Why:** Always-listening caused battery drain, false triggers from ambient noise, unclear privacy expectations, and junk data. Trigger-based activation gives a clearer "active vs idle" state, a better privacy story, and less accidental capture.

---

## 2. Activation Model

### 2.1 Device Modes

| Mode | Enum Value | Default? | Listening? | Purpose |
|------|-----------|----------|-----------|---------|
| IDLE | 0 | Yes (boot) | No | Low power, waiting for trigger. LED: dim white pulse every 5s. |
| ACTIVE_SESSION | 1 | No | Yes | Triggered monitoring — VAD + speech timer + alerts + BLE stats. |
| MANUAL_NOTE | 2 | No | Yes | Double-press capture. Strong audio retention to SD. |
| DEEP_SLEEP | 3 | No | No | Long-press. Wake on button. |
| *(reserved)* | 4+ | — | — | Future coaching variants (PRESENTATION_COACH, MEETING_CAPTURE). |

**PRESENTATION mode status:** Deprecated for v1, not philosophically removed. The concept of "active but coached differently" has a future home as MODE_PRESENTATION_COACH or similar. The enum slot is reserved.

### 2.2 Firmware Enum

```c
enum DeviceMode {
  MODE_IDLE = 0,
  MODE_ACTIVE_SESSION = 1,
  MODE_MANUAL_NOTE = 2,
  MODE_DEEP_SLEEP = 3,
  // Reserved: MODE_PRESENTATION_COACH = 4
};
```

Replaces: `MODE_MONITORING=0, MODE_PRESENTATION=1, MODE_DEEP_SLEEP=2`

---

## 3. Trigger Architecture

### 3.1 Events

New event types added to the event bus:

| Event | Publisher | Purpose |
|-------|----------|---------|
| EVENT_SESSION_START_REQUESTED | Any trigger source | Request to start a session |
| EVENT_SESSION_STOP_REQUESTED | Any trigger source | Request to stop a session |
| EVENT_SESSION_STARTED | mode_manager (after validation) | Session confirmed active |
| EVENT_SESSION_STOPPED | mode_manager (after validation) | Session confirmed ended |

### 3.2 Trigger Sources

```c
enum TriggerSource {
  TRIGGER_BUTTON = 0,
  TRIGGER_BLE_COMMAND = 1,
  TRIGGER_WATCH = 2,      // future
  TRIGGER_REMOTE = 3,     // future
  TRIGGER_AUTO_TIMEOUT = 4
};
```

All trigger sources publish EVENT_SESSION_START_REQUESTED. Mode_manager validates the transition and publishes EVENT_SESSION_STARTED. This decouples trigger input from session logic.

### 3.3 Button Mapping

| Press | Action |
|-------|--------|
| Single | Toggle IDLE ↔ ACTIVE_SESSION |
| Double | Start/stop MANUAL_NOTE (from IDLE only; ignored from ACTIVE_SESSION) |
| Triple | Cycle alert modality (unchanged) |
| Long (3s) | Stop active session (if any) → deep sleep |

### 3.4 MANUAL_NOTE Simplification (v1)

MANUAL_NOTE is only entered from IDLE. Double-press from ACTIVE_SESSION is ignored. If the user wants a voice note during an active session, they stop the session first.

Future phases may add an interrupt pattern (pause session → note → resume) once the base model is proven.

---

## 4. Confirmation Feedback

### 4.1 Session Start
- LED: dim white pulse → solid green breathing
- Haptic: 100ms vibration pulse
- BLE: notify SESSION_CTRL characteristic → 0x01

### 4.2 Session Stop
- LED: green → dim white pulse
- Haptic: two short 50ms pulses
- BLE: notify SESSION_CTRL characteristic → 0x00

### 4.3 Privacy Signal

| State | LED Pattern | Meaning |
|-------|------------|---------|
| IDLE | Dim white pulse every 5s | On but NOT listening |
| ACTIVE_SESSION | Solid green breathing → alert escalation | Actively monitoring speech |
| MANUAL_NOTE | Magenta | Recording to SD |

The visual contrast between dim-white-pulse and green-breathing is the primary privacy signal. The user must never wonder if the device is listening.

### 4.4 Trigger Latency Expectations

| Trigger | Target Latency |
|---------|---------------|
| Button → LED + haptic | < 200ms |
| Button → serial log | < 200ms |
| BLE write → device confirmation notify | < 500ms |
| BLE write → app UI update | < 1s |
| Stop → idle confirmation | < 200ms (button), < 500ms (BLE) |
| Auto-timeout → session stop | Within 1 loop iteration (~100ms) |

Not hard SLAs — verification targets. Investigate if any path exceeds 2x expected.

---

## 5. BLE Session Control

### 5.1 SESSION_CTRL Characteristic

UUID: `4A98000B-1CC4-E7C1-C757-F1267DD021E8`
Type: Read + Write + Notify

| Operation | Value | Effect |
|-----------|-------|--------|
| Write 0x01 | Start request | Device publishes EVENT_SESSION_START_REQUESTED |
| Write 0x02 | Stop request | Device publishes EVENT_SESSION_STOP_REQUESTED |
| Read | 0x00 or 0x01 | Current state (idle / active) |
| Notify | 0x00 or 0x01 | On state change |

**v1 payload is intentionally minimal.** Future versions may extend to include trigger source, interrupted/recovering state, auto-timeout countdown, or active mode variant. Clients should tolerate unknown values (treat any non-0x01 as "not active").

### 5.2 Session Stats Reset

Session stats characteristic (4A980007) now resets on EVENT_SESSION_STARTED, not on BLE connect. This means multiple sessions within one BLE connection each get their own stats.

### 5.3 Device Mode Characteristic

Initial value changes to MODE_IDLE (was MODE_MONITORING). Existing write callback for mode is deprecated — writes still accepted for backward compat.

---

## 6. App Session Lifecycle

### 6.1 Conceptual Change

**Before:** Session = BLE connection window. Connect → createSession. Disconnect → finalizeSession.

**After:** Session = explicit start/stop within a connection. BLE connection is prerequisite, not trigger.

### 6.2 App Session State Machine

```
NO_SESSION → STARTING → ACTIVE → STOPPING → NO_SESSION
```

| State | Trigger | UI |
|-------|---------|-----|
| NO_SESSION | — | "Start Session" button (if connected) |
| STARTING | User taps Start or device button | "Starting..." spinner |
| ACTIVE | Device confirms via SESSION_CTRL notify | Live dashboard |
| STOPPING | User taps End or device button | "Stopping..." spinner |

### 6.3 State Transition Discipline

**Start flow:**
1. App sets sessionState → STARTING
2. Sends BLE write 0x01
3. Waits for device notify confirming 0x01
4. On confirmation → ACTIVE
5. On 3s timeout → retry once → still no confirm → NO_SESSION + error

**Stop flow:**
1. App sets sessionState → STOPPING
2. Sends BLE write 0x02
3. Waits for device notify confirming 0x00
4. On confirmation → NO_SESSION, finalize session
5. On 3s timeout → retry once → still no confirm → NO_SESSION + finalize with last known stats + log warning

The stop-timeout fallback (step 5) is best-effort recovery, not guaranteed truth. Finalized stats reflect last BLE-received values which may be stale. Device-confirmed state is always the source of truth when available.

The app never jumps directly to ACTIVE or NO_SESSION before the device confirms. STARTING and STOPPING are real, visible UI states.

### 6.4 Session Screen (three states)

1. **Not Connected** — Scan/reconnect buttons (same as today)
2. **Connected + Idle** — Device connected pill, battery, "Start Session" CTA
3. **Connected + Active** — Live dashboard (speech timer, alert meter, stats), "End Session" button

"End Session" stops the session but does NOT disconnect BLE. User returns to Connected + Idle.

---

## 7. Remote Control Comparison

| Method | Feasibility | Dependencies | Friction | HW Complexity | Battery | Risk | Priority |
|--------|------------|-------------|----------|---------------|---------|------|----------|
| Device button | Proven | None | Low | None | None | Very Low | P0 — D-pre A |
| Phone app BLE | High | New BLE chr + app UI | Medium | None | Minimal | Low | P0 — D-pre A |
| Apple Watch shortcut | Med-High | Shortcuts provider, bg BLE | Low once set up | None | Minimal | Medium | P1 — investigate |
| Bracelet/clip/pendant | Medium | Second MCU, pairing | Very low | High | Separate | High | P3 — Phase F |
| Smart ring | Low | Custom ring hw | Very low | Very high | Separate | Very high | P4 — post-launch |

**v1 recommendation:** Ship button + BLE command. Investigate Apple Watch shortcut feasibility. Defer all custom hardware remotes.

---

## 8. Standalone Backlog (Phase D-pre B)

### 8.1 Scope: Metadata-First

D-pre B is a metadata-first standalone backlog foundation. It persists session metadata (timestamps, alert counts, speech segments, trigger source) to SD for later sync.

**What it is NOT:**
- Full automatic offline meeting audio retention
- Offline transcript generation
- A replacement for manual note audio

Manual note (double-press → WAV to SD) remains the only saved-audio path. Transcript-first retention is the long-term direction, but D-pre B only lays the structural groundwork.

### 8.2 Boot-Relative Timestamp Model

ESP32 has no RTC — millis() resets on reboot. Device tracks:
- `bootId` — monotonically increasing counter, persisted to SD
- `deviceSessionSequence` — increments per session within a boot
- `startedAtMsSinceBoot` — millis() at session start
- `endedAtMsSinceBoot` — millis() at session end

Phone anchors timestamps per-boot on BLE connect. Cross-boot sessions get best-effort wall-clock (correctly ordered within their boot, approximate anchor).

### 8.3 Backlog File Format

File: `/RG/backlog.bin` — versioned binary with header.

**Header (16 bytes):** magic "RGBL", version, recordSize, recordCount, bootId, reserved.

**Session record (32 bytes):** bootId, deviceSessionSequence, startedAtMsSinceBoot, endedAtMsSinceBoot, mode, triggerSource, alertCount, maxAlert, speechSegments, sensitivity, syncStatus, reserved.

See plan for full struct definitions.

### 8.4 No SD / SD Unavailable

Sessions do not depend on SD. If no SD card, SD init failure, or SD unavailable:
- Session still runs — VAD, speech timer, alerts, LED, haptic all work
- BLE live stats work if phone is connected
- No backlog written — data exists only in RAM/BLE
- Once session ends and device disconnects or powers off, unwritten metadata is lost
- Later sync cannot recover data that was never persisted
- UI must not imply standalone sync can recover unwritten sessions

### 8.5 Storage-Full

If < 64KB free: EVENT_STORAGE_LOW published, backlog write skipped, session still runs. Brief orange blink before green transition as warning (visually distinct from normal session start). Same data-loss rules as no-SD case.

---

## 9. BLE Sync Transport (Phase D-pre B)

### 9.1 Protocol

New characteristic CHR_SYNC_DATA at UUID `4A98000C`:

| Step | Phone writes | Device responds |
|------|-------------|----------------|
| Manifest | 0x01 | pendingCount, oldestBootId, newestBootId |
| Next record | 0x02 | Next unsynced SessionRecord or 0xFF |
| Ack record | 0x03 + bootId + sequence | 0x00 (ok) or 0x01 (not found) |
| Commit | 0x04 | 0x00 (ok) or 0x02 (write failed) |

### 9.2 Reliability Design

- **Replay-safe IDs:** Each record identified by (bootId, deviceSessionSequence) — globally unique pair
- **Idempotent imports:** App upserts by deterministic ID `"dev-{bootId}-{sequence}"`
- **Lost ack:** Device re-sends on next sync, app re-imports (upsert = no-op), re-acks
- **Failed checkpoint commit:** Acked records revert to pending on reboot, re-imported idempotently on next sync
- **Partial success is normal** — the protocol tolerates it by design
- **Commit = transaction commit:** SD checkpoint only written on explicit 0x04

---

## 10. Transcript-First Retention Policy

| Priority | Data | Retention | Size |
|----------|------|-----------|------|
| 1 (always) | Session metadata | Forever | ~32 bytes/session |
| 2 (default) | Transcript + word timestamps | Indefinitely | ~1KB/min speech |
| 3 (opt-in) | Audio clips at alert moments | 30 days unless favorited | ~32KB/sec |
| 4 (explicit) | Full session audio | 7 days, exportable | ~32KB/sec |

D-pre B adds schema columns. Phase D populates them with real transcription data.

---

## 11. Edge Cases

| Edge Case | Strategy |
|-----------|----------|
| Accidental trigger | Sessions < 5s with no speech/alerts auto-discard on stop |
| Double trigger | Synchronous event bus — second request sees mode already changed |
| Start while active | Ignore, notify current state via BLE |
| BLE command fails | App stays in STARTING/STOPPING, 3s timeout + retry. LED is ground truth. |
| Phone reconnects mid-session | Read SESSION_CTRL on reconnect; resume or create continuation |
| Phone reconnects after session | Sync backlog on next connect |
| User forgets to stop | MAX_SESSION_DURATION_MS (default 2hr); auto-stop |
| Double-press during active | Ignored (v1 — MANUAL_NOTE only from IDLE) |
| Privacy uncertainty | LED contrast + haptic on transitions |
| Low battery mid-session | EVENT_BATTERY_CRITICAL → force stop |
| No SD card | Session runs, no backlog, data lost on power-off |
| Storage full | Session runs, backlog skipped, orange blink warning |
| Backlog partial sync | Checkpoint-based resume, idempotent re-import |

---

## 12. What's Deferred

| Feature | Phase |
|---------|-------|
| MANUAL_NOTE interrupt from ACTIVE_SESSION | D-pre B or D |
| Apple Watch deep integration | D or post-launch |
| Transcription (Deepgram/Whisper) | D |
| Speaker diarization / voice enrollment | D |
| Custom hardware remote | F |
| Smart ring | Post-launch |
| Auto-detect session mode | D |
| Retention auto-enforcement | D.0 |
| PRESENTATION_COACH mode | D |
