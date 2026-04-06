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
- [ ] RG-C.2: BLE connection management (WiFi deferred to Phase D)

### Design
- [x] RG-C.3.5: Design system + Figma feature designs (DESIGN.md, tokens, primitives)

### App
- [x] RG-C.3: React Native Expo project scaffold
- [x] RG-C.4: Voice trainer onboarding
- [x] RG-C.4.5: Offline exercise library (55 exercises, streaks, daily rotation)
- [ ] RG-C.5: Session modes (solo / with others)
- [ ] RG-C.10: Notification system (alerts, summaries, coaching, streaks)
- [ ] RG-C.6: BLE connection + real-time dashboard
- [ ] RG-C.7: Session history + analytics
- [ ] RG-C.8: Settings + threshold configuration
- [ ] RG-C.9: Apple Watch forwarding
- [ ] UI polish pass
- [ ] Run revise-claude-md and commit

---

## Phase D — Transcription + AI Coaching + Cloud Sync

- [ ] RG-D.1: Audio streaming via BLE to companion app
- [ ] RG-D.2: Real-time transcription + speaker detection
- [ ] RG-D.3: Live speaker identification + naming
- [ ] RG-D.4: Claude coaching engine
- [ ] RG-D.5: "Catch me up" button
- [ ] RG-D.6: "Draft a question" feature
- [ ] RG-D.7: Post-session summary + insights
- [ ] RG-D.8: Google Drive backup + sync
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
