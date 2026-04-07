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
- [ ] RG-C.11.16: expo-av → expo-audio migration (before SDK 55)
- [ ] Run revise-claude-md and commit

---

## Phase D.0 — Cloud Foundation + Sync Model

- [ ] RG-D.0.1: Firestore for metadata
- [ ] RG-D.0.2: Storage for optional audio blobs
- [ ] RG-D.0.3: Google Drive for archive/export only
- [ ] RG-D.0.4: Sync checkpoints / watermarks
- [ ] RG-D.0.5: Retention policy for metadata vs audio
- [ ] RG-D.0.6: Cloud retry/resume tests

---

## Phase D — Device-First Coaching + Insights

- [ ] RG-D.1: Device-first session segmentation + local backlog
- [ ] RG-D.2: Real-time transcription + speaker detection
- [ ] RG-D.3: Voice enrollment + speaker attribution
- [ ] RG-D.4: Context classification (solo, couple, meeting, presentation, background noise)
- [ ] RG-D.5: Coaching engine — fillers, pacing, interruption patterns, overlong runs, reflection prompts
- [ ] RG-D.6: Exercise recommendation engine
- [ ] RG-D.7: Post-session summaries + insights
- [ ] RG-D.8: Backup/export flow
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

## Post-Launch — Follow-up Tasks

Deferred improvements to revisit after all phases ship.

- [ ] Dedicated Favorites screen — currently favorites are an inline section in the exercises scroll, easy to miss; needs its own tab or prominent entry point
- [ ] Exercise search/filter — search by name, filter by duration, difficulty
- [ ] Onboarding walkthrough — first-launch guided tour explaining device vs exercises vs voice enrollment
- [ ] Apple Watch deep integration (deferred C.9) — complication, haptics relay, glanceable speech timer
- [ ] Session modes auto-detection (deferred C.5) — requires Phase D speaker diarization to detect solo vs group automatically
- [ ] Dark/light mode toggle in settings — currently follows system; no in-app override UI
- [ ] Exercise progress tracking — per-exercise history, improvement trends over time
- [ ] Export/share session data — PDF or CSV export for therapist review
