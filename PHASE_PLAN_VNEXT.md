# Rambling Guardian — Proposed Next Phase Plan

This is a drop-in replacement draft for `PHASE_PLAN.md` until the tracked file is updated directly.

## Changes from current plan

- Mark `RG-C.4.10` complete because favorites are already implemented.
- Split notification work into final hardening tasks instead of treating it as fully finished.
- Add a new **Phase C.11 — Hardening Before AI Coaching** section.
- Add a new **Phase D.0 — Cloud Foundation + Sync Model** section.
- Rewrite Phase D around device-first segmentation, sync, speaker attribution, context classification, and coaching.
- Keep Post-Launch items as future follow-up work.

## Proposed additions to Phase C

### Phase C.11 — Hardening Before AI Coaching
- README truth pass
- session semantics
- hardware shortcuts/help section
- persisted settings
- real device info in settings
- BLE reconnect/disconnect/forget-device flows
- BLE sync state machine
- synced-from-device backlog model
- resumable sync with ack/retry semantics
- history timestamp correctness
- calendar layout bug fix
- favorites discoverability improvement
- battery calibration + safe-stop policy
- power profiling
- firmware/app/manual test matrices

## Proposed additions before cloud coaching

### Phase D.0 — Cloud Foundation + Sync Model
- Firestore for metadata
- Storage for optional audio blobs
- Google Drive for archive/export only
- sync checkpoints / watermarks
- retention policy for metadata vs audio
- cloud retry/resume tests

## Proposed rewrite of Phase D

### Phase D — Device-First Coaching + Insights
- device-first session segmentation + local backlog
- optional compressed audio / flagged clip sync
- voice enrollment + speaker attribution
- context classification: solo, couple, meeting, presentation, background TV/noise
- coaching engine: fillers, pacing, interruption patterns, overlong runs, reflection prompts
- exercise recommendation engine
- post-session summaries + insights
- backup/export flow

## Notes to keep explicit

- The device must still work without the phone nearby.
- Mid-sync failure must resume cleanly.
- Long meetings/memories may need user prompts to keep summary only vs full audio.
- Manual captures and auto-detected sessions must remain distinct.
- Low battery should safe-stop recording instead of abruptly losing state.
- Apple Watch remains deferred as deeper integration, but quick-control actions remain a valid future direction.
