# Rambling Guardian — Phase Plan

Living ticket tracker. Check off as completed.

---

## Phase A.1 — Dev Workflow Setup + Code Cleanup

<!-- Note: Phases A.2–A.4 are not standalone phases — A.1 covers cleanup and workflow setup, then we jump to A.5 (SD card). This is intentional. -->

- [x] RG-A1.1: Create development workflow docs
- [x] RG-A1.2: Update CLAUDE.md and README
- [x] RG-A1.3: Code cleanup from code review
- [x] RG-A1.4: Generate NotebookLM learning materials
- [x] RG-A1.5: Set up GitHub Issues + Milestones
- [x] RG-A1.6: VAD auto-calibration on boot
- [x] Run revise-claude-md and commit

---

## Phase A.5 — SD Card Voice Note Capture

- [x] RG-A5.1: SD card initialization and FAT32 mount
- [x] RG-A5.2: WAV file writer with audio buffering
- [x] RG-A5.3: Capture mode state machine
- [x] RG-A5.4: Session metadata logger
- [x] Run revise-claude-md and commit

---

## Phase B — Haptic Vibration Feedback

- [x] RG-B.1: Wire vibration motor circuit on breadboard
- [x] RG-B.2: Vibration output subscriber module
- [x] RG-B.3: User preference for alert modality
- [x] Run revise-claude-md and commit

---

## Phase C — BLE Companion App + Voice Trainer

### Firmware
- [x] RG-C.1: NimBLE GATT peripheral setup
- [x] RG-C.2: BLE connection management (WiFi deferred to Phase D)

### Design
- [x] RG-C.3.5: Design system + Figma feature designs (DESIGN.md, tokens, primitives)

### App
- [x] RG-C.3: React Native Expo project scaffold
- [x] RG-C.4: Voice trainer onboarding
- [x] RG-C.4.5: Offline exercise library (55 exercises, streaks, daily rotation)
- [x] RG-C.4.6: Exercise controls — pause/resume, stop, preview, completion celebration
- [x] RG-C.4.7: Exercise library navigation — category tabs, unlock badges, difficulty legend
- [x] RG-C.4.8: Recording quality — real audio metering, playback, min duration, re-record
- [x] RG-C.4.9: Streak calendar polish — plural fix, legend clarity, tappable cells, loading skeleton
- [x] RG-C.4.10: Favorites & highly-rated exercises — bookmark/favorite exercises, auto-collect 4-5 star rated, dedicated Favorites section in library for quick access
- [ ] ~~RG-C.5~~ → Deferred to Phase D (needs calendar integration + speaker diarization to be useful; manual mode switching is ADHD-hostile)
- [x] RG-C.10: Notification system (alerts, summaries, coaching, streaks, exercise reminders)
- [x] RG-C.6: BLE connection + real-time dashboard
- [x] RG-C.7: Session history + analytics
- [x] RG-C.8: Settings + threshold configuration
- [ ] ~~RG-C.9~~ → Deferred (iOS notifications auto-forward to Watch; deep WatchKit integration later)
- [x] UI polish pass
- [x] Run revise-claude-md and commit

### Phase C.11 — Hardening Before AI Coaching (Batch 1 + Batch 2 complete)

#### Batch 1
- [x] RG-C.11.1: Settings persistence — write-through to SQLite, hydration on launch, no flicker
- [x] RG-C.11.2: BLE lifecycle hardening — explicit ConnectionState (idle/scanning/connecting/connected/syncing/failed), subscription cleanup, reconnect/disconnect/forget-device
- [x] RG-C.11.3: Sync groundwork — sync metadata in sessionStore, SyncStatusIndicator, "From device" badge, upsert-safe session import
- [x] RG-C.11.4: Session/history semantics — JSDoc definitions, session type labels, extracted time formatters
- [x] RG-C.11.5: Calendar layout fix — dynamic cell sizing via useWindowDimensions, works on all iPhone widths
- [x] RG-C.11.6: Battery safety — recording blocked below threshold, critical-battery auto-stop, min battery setting
- [x] RG-C.11.7: Tests — 52 tests across 5 files (settings persistence, BLE state, sync replay, timestamps, calendar sizing)
- [x] RG-C.11.8: UI polish — Alert Style segment widths, sync indicator spacing
- [x] BLE diagnostic logging (temporary, remove before merge to main)

#### Batch 2
- [x] RG-C.11.9: Session model correction — ConversationSession/ConnectionWindow forward types, SyncPhase/SyncManifest/SyncCheckpoint types, JSDoc truth pass
- [x] RG-C.11.10: Sync engine — state machine with explicit phase transitions (REQUESTING_MANIFEST → IMPORTING → FINALIZING → COMPLETE/FAILED), checkpoint persistence in settings table
- [x] RG-C.11.11: Firmware battery safe-stop — capture_mode subscribes to EVENT_BATTERY_CRITICAL, 2s provisional delay, CLAUDE.md docs
- [x] RG-C.11.12: Notification truth pass — removed deprecated shouldShowAlert, OS permission check on mount + foreground, warning row when blocked
- [x] RG-C.11.13: README truth pass — full rewrite with accurate hardware, features, known limitations
- [x] RG-C.11.14: UI wording — "speaking runs" (not segments), "Avg alerts/session", honest empty state text
- [x] RG-C.11.15: Tests — 68 tests across 8 passing suites (added syncEngine, notifications, extended syncReplay). Note: theme.test.ts has a pre-existing failure (expo-sqlite ESM import) unrelated to Batch 2.

#### Remaining
- [x] RG-C.11.16: expo-av → expo-audio migration (before SDK 55)
- [ ] Run revise-claude-md and commit

---

## Phase D-pre A — Triggered Activation Foundation

### Firmware
- [x] RG-DpA.1: New state machine — replace DeviceMode enum (IDLE/ACTIVE_SESSION/MANUAL_NOTE/DEEP_SLEEP + reserved slot for future PRESENTATION_COACH), add TriggerSource enum, add session events
- [x] RG-DpA.2: Button trigger remap — single press toggles IDLE↔ACTIVE_SESSION, double press MANUAL_NOTE only from IDLE (ignored from ACTIVE), long press stops session then sleeps
- [x] RG-DpA.3: Conditional main loop — audioInputUpdate/speechTimerUpdate gated on mode; add audioInputSuspend/Resume with re-calibration on resume
- [x] RG-DpA.4: LED/haptic truth signals — IDLE dim white pulse every 5s, session start/stop haptic feedback, remove deprecated PRESENTATION LED behavior
- [x] RG-DpA.5: BLE session control — add CHR_SESSION_CTRL (4A98000B) Read+Write+Notify; session stats reset on SESSION_STARTED not BLE connect

### App
- [x] RG-DpA.6: Type + store updates — new DeviceMode/TriggerSource/AppSessionState enums, deviceStore defaults to IDLE, add sessionState field, schema migration (trigger_source, session_type)
- [x] RG-DpA.7: BLE session commands — startSession/stopSession on BLEService, SESSION_CTRL notifications, STARTING/STOPPING intermediate states with 3s timeout + retry
- [x] RG-DpA.8: Session tracker decoupling — watch sessionState not connected, handle BLE disconnect mid-session
- [x] RG-DpA.9: Session screen redesign — three states (not connected / connected+idle / connected+active), Start/End Session buttons, no disconnect on end

### Quality
- [x] RG-DpA.10: Tests + docs — TypeScript type check passes, 76 tests pass (8 suites), update CLAUDE.md + PHASE_PLAN.md

---

## Phase D-pre B — Standalone Backlog Foundation

### Firmware
- [x] RG-DpB.1: Boot ID persistence — /RG/boot_id.bin with magic + monotonic counter, increment on each boot
- [x] RG-DpB.2: Backlog file — versioned /RG/backlog.bin with header (magic "RGBL", version, recordSize, recordCount), 32-byte SessionRecord with bootId + deviceSessionSequence + boot-relative timestamps
- [x] RG-DpB.3: Backlog operations — append on SESSION_STOPPED, corruption detection + .bak rename, compaction when >100 records and >50% synced, storage-full handling (EVENT_STORAGE_LOW, skip write, session still runs), no-SD-card graceful degradation
- [x] RG-DpB.4: BLE sync transport — add CHR_SYNC_DATA (4A98000C), manifest/request/ack/commit protocol with replay-safe (bootId, sequence) IDs

### App
- [x] RG-DpB.5: Sync transport — new syncTransport.ts wiring BLE protocol into existing syncEngine scaffold, idempotent upsert keyed on (bootId, sequence), handles lost ack / failed commit / partial success
- [x] RG-DpB.6: Schema + timestamp anchoring — boot_id/device_sequence columns, per-boot time offset calculation on BLE connect, best-effort wall-clock for cross-boot sessions
- [x] RG-DpB.7: Transcript/retention placeholders — transcript, transcript_timestamps, audio_retention columns (empty for now, Phase D populates)

### Quality
- [x] RG-DpB.8: Tests + docs — firmware compiles (737KB/48KB), TypeScript passes, 76 tests pass (8 suites), CLAUDE.md + PHASE_PLAN.md updated

### Investigation (parallel, non-blocking)
- [ ] RG-INV.1: Apple Watch shortcut feasibility — Shortcut→app intent→BLE write path, background BLE behavior, latency measurement, written findings doc only

---

## Phase D.0 — Local-First Sync & Retention Foundation

### Implemented (local-first)
- [x] RG-D.0.4: Sync checkpoints — per-session sync_status pipeline (pending→received→processed→acked→committed), committed-only watermark, syncCheckpointService
- [x] RG-D.0.5: Retention policy — 4-tier model (metadata forever, transcript indefinite, clips 30d, audio 7d), retentionService with runPruneNow() manual trigger, enforcement loop
- [x] RG-D.0.T: SyncTarget type definition + tests for checkpoint and retention services

### Deferred (cloud — after transcript artifacts exist)
- [ ] ~~RG-D.0.1~~: Firestore for metadata
- [ ] ~~RG-D.0.2~~: Storage for optional audio blobs
- [ ] ~~RG-D.0.3~~: Google Drive for archive/export only
- [ ] ~~RG-D.0.6~~: Cloud retry/resume tests

---

## Phase D — Transcription + AI Coaching

- [x] RG-D.1: Transcript pipeline foundation — phone mic capture via react-native-live-audio-stream, Deepgram Nova-3 WebSocket streaming STT, live transcript display, session-driven (not VAD-gated in v1), plain text + structured segment persistence
- [x] RG-D.2: Voice enrollment + speaker attribution foundation ✅ COMPLETE — Deepgram diarization, speaker label resolution, mappings UI, voice profile storage
- [ ] RG-D.3: Speaker-aware transcript handling / diarization-ready processing — real-time speaker labeling in transcript, "New voice detected" prompts, speaker library with return-visitor matching, name editing
- [ ] RG-D.4: Context classification — detect solo / couple / meeting / presentation / background noise from speaker count + patterns, mode-aware coaching (only coach YOUR speech in meetings)
- [ ] RG-D.5: Coaching engine — filler detection, pacing analysis, interruption patterns, overlong runs, reflection prompts, "Catch me up" summaries, "Draft a question" feature
- [ ] RG-D.6: Post-session summaries + insights — Claude Sonnet summaries, rambling highlights, action items, improvement trends vs previous sessions, context-aware templates per mode
- [ ] RG-D.7: Exercise recommendation engine — suggest exercises based on detected patterns (filler words → articulation drills, pacing → rhythm exercises), integrate with existing exercise library
- [ ] RG-D.8: Backup/export flow — Google Drive sync (app-mediated OAuth), folder structure (year/month/auto-title), separate Audio/ and Transcripts/ folders, background queue
- [ ] Run revise-claude-md and commit

---

## Phase E — Wispr-Style Dictation

- [ ] RG-E.1: BLE audio streaming to cloud
- [ ] RG-E.2: Whisper STT → Claude cleanup pipeline
- [ ] RG-E.3: Clipboard integration on phone
- [ ] RG-E.4: BLE HID keyboard option
- [ ] RG-E.5: Personal dictionary sync
- [ ] Run revise-claude-md and commit

---

## Phase F — Production

- [ ] RG-F.1: Custom PCB design (KiCad)
- [ ] RG-F.2: 3D printed enclosure
- [ ] RG-F.3: Production battery selection
- [ ] RG-F.4: USB-C charging circuit
- [ ] RG-F.5: OTA firmware updates via BLE
- [ ] RG-F.6: App Store submission (TestFlight)
- [ ] Run revise-claude-md and commit

---

## Product Direction — Device-First, Phone-Optional

D.1 phone-mic transcription is a **bridge capability**, not the final product identity. It proves the transcript pipeline, persistence, live UI, and Deepgram integration. That work stays.

**Long-term product vision remains device-first, phone-optional, sync-later capable:**
- Device must eventually start and run meaningful sessions without the phone present
- Phone is a companion / enrichment tool, not the only way the product is useful
- If device is used alone in a meeting, it should later sync meaningful data to the phone
- Transcript / summaries / AI processing may happen after sync if needed
- Live phone transcription is a mode, not the only mode

**Future required direction** (not yet scheduled):
- [ ] Device-first standalone capture + sync-later enrichment — standalone session capture on device, later phone sync of metadata and/or recorded artifacts, transcript generation after sync, speaker-aware enrichment after sync, useful workflow even when phone was not present during conversation
- [ ] Device must earn its place beyond: button for the phone, vibration accessory, phone recorder companion. Move toward: device starts session, device can be used alone, phone enriches later, AI/transcript/summary can happen after sync.

**Do not assume "phone present for transcript" is the permanent product model in any future phase design.**

---

## Post-Launch — Follow-up Tasks

Deferred improvements to revisit after all phases ship.

- [ ] VAD hybrid calibration strategy — current full recalibration (~6s) on every session start is too slow for daily wearable UX. Replace with: full calibration at boot only, short quick-check (~0.5s) on session start, cached baseline reuse when ambient is stable, full recal fallback only when conditions changed significantly. Discovered during D-pre A live testing.
- [ ] Dedicated Favorites screen — currently favorites are an inline section in the exercises scroll, easy to miss; needs its own tab or prominent entry point
- [ ] Exercise search/filter — search by name, filter by duration, difficulty
- [ ] Onboarding walkthrough — first-launch guided tour explaining device vs exercises vs voice enrollment
- [ ] Apple Watch deep integration (deferred C.9) — complication, haptics relay, glanceable speech timer
- [ ] Session modes auto-detection (deferred C.5) — requires Phase D speaker diarization to detect solo vs group automatically
- [ ] Dark/light mode toggle in settings — currently follows system; no in-app override UI
- [ ] Exercise progress tracking — per-exercise history, improvement trends over time
- [ ] Export/share session data — PDF or CSV export for therapist review
- [ ] Voice trainer → enrollment bridge — phone trainer recordings are clean labeled Carlos speech samples; use them to generate voice profile / embeddings in app/cloud layer; compare session audio/transcript segments against that profile for speaker attribution ("Me" vs others). Architecture direction: enrollment in app → profile in cloud → matching in transcript pipeline. Do not push identity logic to embedded device first.
- [ ] History scalability / date grouping — History tab is too flat and scroll-heavy with many same-day sessions. Group by date sections with collapsible/expandable day groups. Each date row shows daily summary: session count, total talk time, avg/peak alerts. Today expanded by default, yesterday expanded or partial, older dates collapsed. Gets worse over weeks/months — address before significant daily use.
- [ ] Voice retraining access in Settings — after onboarding, no way to re-run or update voice trainer. Add Settings → Voice Profile entry with: re-record training samples, add more samples later, replace/reset voice profile, last-trained timestamp. Future: confidence/quality indicators. Retraining should be manual on-demand (not time-based schedule) with future option for confidence-based prompts if speaker attribution degrades. Onboarding should not be the only entry point for voice enrollment.
