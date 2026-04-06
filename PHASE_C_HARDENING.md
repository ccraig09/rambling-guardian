# Rambling Guardian — Phase C Hardening Plan

This document locks the decisions that must be made before Phase D AI coaching work begins.

## Why this exists

The project has working firmware, a BLE-connected Expo companion app, exercises, history, settings, and notifications. The biggest risk now is building AI/coaching features on top of incomplete sync rules, unclear session semantics, weak persistence, or unmeasured battery behavior.

This hardening pass exists to prevent building on broken windows.

## Product direction

- The **device** is the primary sensing surface.
- The **phone app** is the companion, review, settings, and coaching surface.
- The **cloud** is optional until Phase D.0 and should not be required for core device use.
- The product must still work when the phone is absent, disconnected, locked, interrupted by alarms/calls, or relaunched later.

## Current truths to align in docs/code

- Vibration hardware is wired and should no longer be documented as pending.
- The button map has changed from the stale README.
- The companion app exists and is part of the real product.
- Favorites are implemented inline in Exercises and should be treated as shipped for Phase C.
- The calendar layout has a visible right-edge alignment bug that must be fixed before Phase D.

## Phase C hardening goals

1. **Truthful docs**
   - README reflects current firmware + app behavior.
   - Session definitions are explicit.
   - Hardware button shortcuts are taught in-app.

2. **Reliable persistence**
   - App settings persist across relaunch.
   - Device thresholds and sync state persist across reboot.

3. **Reliable reconnect + resync**
   - Device can be used without the phone nearby.
   - Phone can reconnect later and safely import missing sessions/events.
   - Mid-sync failure does not duplicate or lose data.

4. **Battery + power safety**
   - Battery readings are calibrated and smoothed.
   - Recording/sync behavior respects battery thresholds.
   - Portable battery sizing is based on measured current, not guesses.

5. **Test coverage**
   - Edge cases and failure modes are explicitly tested before Phase D.

## Core semantics

### Session
A **session** is an automatically segmented conversational window detected on-device.

Suggested start rule:
- start a new session when speech has been detected after a sufficiently long quiet period

Suggested end rule:
- end the session after a sufficiently long trailing silence or after explicit manual stop

### Speaking run
A **speaking run** is one continuous user-speaking span inside a session.

### Alert event
An **alert event** is a threshold crossing inside a speaking run.
It should store:
- stable event id
- session id
- speaking run id
- timestamp offset from session start
- alert level
- duration at alert

### Manual capture
A **manual capture** is a user-triggered recording and must remain separate from auto-detected sessions.

### Synced from device
A session marked `synced_from_device` means:
- the session originated on the wearable
- the phone imported it later from the device backlog
- it was not originally created live on the phone

## Sync protocol

### Requirements
- Device must store backlog locally.
- Phone must ask for a **manifest** on reconnect.
- Sync must be resumable.
- Writes must be idempotent.
- Device must not mark items as synced until they are acknowledged.

### Manifest model
The device should expose:
- pending session count
- pending speaking run count
- pending alert event count
- pending manual capture count
- estimated bytes/chunks pending
- device sync checkpoint id

### Transfer model
1. Phone connects.
2. Phone reads current live state.
3. Phone requests sync manifest.
4. Phone requests unsynced items in deterministic order.
5. Device sends chunk(s).
6. Phone writes locally using upsert semantics.
7. Phone acks the chunk/item.
8. Device advances checkpoint only after ack.

### Mid-sync failure behavior
If sync breaks:
- unacked items remain pending on device
- locally written items must be safe to replay without duplication
- reconnect resumes from last acked checkpoint

### UI expectations
The app should show:
- `Syncing 2 of 9 sessions`
- `Last synced 12m ago`
- `3 sessions waiting to review`
- `Synced from device` badge on imported items
- `New` indicator for newly imported sessions

## Audio retention policy

The product should not keep raw all-day audio by default.

### Default retention tiers
1. **Always keep metadata**
   - sessions
   - speaking runs
   - alert events
   - summaries/insights later

2. **Manual voice notes**
   - kept in full until the user deletes them
   - user can optionally archive or export them

3. **Auto-detected sessions**
   - default to metadata only
   - optionally keep short flagged audio clips

4. **Long meetings / valuable memories**
   - prompt after sync:
     - Keep summary only
     - Keep summary + key clips
     - Keep full audio
     - Delete audio, keep metadata

### Practical policy
- Keep **transcript + summary + key clips** for most sessions.
- Keep **full audio** only for intentional saves, manual voice notes, or explicitly preserved meetings/memories.
- Raw audio should be transcoded/compressed after sync when possible rather than stored forever in raw PCM.

## Battery and power policy

### Product rules
- The device should not suddenly die mid-meeting without attempting a safe flush.
- The device should avoid starting long recordings when battery is already too low.
- Critical battery should trigger a **safe-stop**, not abrupt loss.

### Recommended battery states
These are product policy targets and should be tuned after power profiling.

- **Normal zone**: all features available
- **Low battery zone**: warn user, reduce LED brightness, avoid nonessential sync chatter
- **Capture guard zone**: do not start new manual recordings or optional bulk sync
- **Critical reserve zone**: finalize current file/session, persist sync markers, then enter protected shutdown/deep sleep

### Behavior expectations
- If the battery becomes critically low during recording:
  - stop accepting new capture frames after reserve is hit
  - close the file cleanly
  - write final metadata/checkpoint
  - mark the session as recoverable/importable later
  - warn the user if possible before shutdown

## Cloud foundation (Phase D.0)

Recommended stack:
- **Firestore** for metadata and sync state
- **Storage** for optional audio blobs
- **Google Drive** for archive/export, not primary operational state

Suggested cloud entities:
- devices
- sessions
- speaking_runs
- alert_events
- manual_captures
- sync_checkpoints

## Apple Watch future role

Apple Watch should be treated as a **fast control surface**, not the primary sensing brain.

Good candidates:
- reconnect guardian
- toggle presentation mode
- start manual capture
- mark this conversation
- find/search for device

Avoid making the first watch version responsible for full BLE orchestration or primary coaching logic.

## Testing matrix

### Firmware
- threshold transitions
- pause-reset logic
- session boundary rules
- battery low/critical behavior
- mode switching behavior
- capture mode edge cases
- persistence across reboot

### App logic
- settings persistence/hydration
- BLE reconnect state machine
- sync progress state
- partial sync failure + resume
- duplicate replay protection
- imported session rendering
- favorites discoverability flows
- calendar layout regression

### Sync protocol
- empty backlog
- one item backlog
- large backlog
- mid-sync disconnect
- duplicate chunk replay
- corrupted chunk
- ack lost after local write
- device reboot during sync
- phone app killed during sync
- reconnect after stale watermark

### Manual hardware verification
- use without phone nearby
- reconnect after hours
- sync while screen locked
- sync after alarm/call interruption
- low battery during sync
- manual capture during pending sync
- BLE reconnect after dev build reload

## Immediate implementation order

1. README truth pass
2. settings persistence
3. BLE reconnect/sync state machine
4. session semantics + history timestamp fix
5. battery calibration + safe-stop policy
6. calendar bug fix
7. notification truth pass
8. power profiling
9. Phase D.0 cloud prep
