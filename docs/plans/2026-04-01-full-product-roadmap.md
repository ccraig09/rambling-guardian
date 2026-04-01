# Rambling Guardian — Full Product Roadmap & Development Plan

## Context

Phase A (MVP breadboard prototype) is complete and working: energy-based VAD, escalating LED alerts, button controls, battery monitoring. The device detects speech duration and alerts the wearer through color escalation (green → yellow → orange → red → blink).

Carlos wants to expand this from a breadboard prototype into a full product that competes with Omi ($89), Limitless ($99), and PLAUD ($159). The unique competitive advantage: **no existing wearable does real-time ADHD speech coaching**. All competitors focus on transcription/summaries AFTER the conversation. Rambling Guardian alerts IN THE MOMENT.

The vision: combine the hardware device with a React Native companion app (inspired by Word Shepherd's patterns), proper engineering practices, and a learning path for Carlos to understand C++/embedded systems.

### Key Findings from Research

**Competitors:** Omi (open API, $89), Limitless (100hr battery, acquired by Meta), PLAUD (multi-form-factor, 112 languages). None offer real-time speech coaching for ADHD.

**Word Shepherd:** TypeScript/React Native meeting companion with Deepgram STT + Claude coaching. Different tech stack (Node/TS vs C++), but the CoachingDetector threshold logic, prompt templates, and phase planning patterns are valuable references. **Recommendation: don't fork. Start fresh, reference patterns.**

**Carlos's established workflow (from Money Shepherd/Word Shepherd):** Phase plans with tickets (RG-X.Y format), selector pass before coding, code review before testing, thin TDD for domain logic, smoke tests per phase, risk tracking, 1 skill per ticket max.

---

## Product Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   RAMBLING GUARDIAN                       │
│                                                          │
│  ┌──────────────┐    BLE     ┌─────────────────────┐   │
│  │  ESP32S3      │◄─────────►│  React Native App   │   │
│  │  Wearable     │           │  (Companion)        │   │
│  │               │           │                     │   │
│  │  • VAD        │  alerts   │  • Dashboard        │   │
│  │  • LED alerts │──────────►│  • Session history  │   │
│  │  • Vibration  │           │  • Settings/tuning  │   │
│  │  • Button     │  config   │  • Coaching reports  │   │
│  │  • SD card    │◄──────────│  • Transcription    │   │
│  │  • Battery    │           │  • Apple Watch      │   │
│  └──────────────┘           └──────────┬──────────┘   │
│                                         │               │
│                                    Cloud API            │
│                              ┌──────────┴──────────┐   │
│                              │  • Deepgram STT     │   │
│                              │  • Claude coaching   │   │
│                              │  • Session storage   │   │
│                              │  • Analytics         │   │
│                              └─────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

---

## Phase Structure

Uses Carlos's established Foundation/Evolution model from Money Shepherd:

### [FOUNDATION] Phases — Core reliability
- **Phase A** ✅ — Rambling detection MVP (complete)
- **Phase A.1** — Code cleanup + dev workflow setup
- **Phase A.5** — SD card voice note capture
- **Phase B** — Haptic vibration feedback

### [EVOLUTION] Phases — Product features
- **Track 1: Connectivity** — Phase C: BLE + Companion App
- **Track 2: Intelligence** — Phase D: Transcription + AI coaching
- **Track 3: Dictation** — Phase E: Wispr-style speak-to-text
- **Track 4: Scale** — Phase F: Production, pricing, distribution

---

## Phase A.1 — Dev Workflow Setup + Code Cleanup
**Goal:** Establish the development practices BEFORE writing more code.

### Tickets

**RG-A1.1: Create development workflow docs**
- Create `PHASE_PLAN.md` with ticket tracking (checkbox format)
  - **Every phase ends with:** `- [ ] Run revise-claude-md and commit`
- Create `AGENT_WORKFLOW.md` with per-ticket 5-step process + phase boundary step
  - **Step 6 (last ticket of each phase only):** Update CLAUDE.md via `revise-claude-md` — mandatory, not optional
- Create `SELECTOR_PASS_PROMPT.md` template
  - **Include "Phase boundary?" gate** — if last ticket in a phase, CLAUDE.md update required before marking complete
- Create `SMOKE_TESTS.md` for Phase A verification
- Reference: Money Shepherd's AGENT_WORKFLOW.md patterns

**RG-A1.2: Update CLAUDE.md and README**
- Update tech stack: `rgbLedWrite()` not Adafruit NeoPixel
- Document correct build command: `--fqbn esp32:esp32:XIAO_ESP32S3:PSRAM=opi`
- Add workflow section referencing new docs
- Add code review requirement before testing

**RG-A1.3: Code cleanup from code review**
- Remove unused `firstCheckSkipped` in battery_monitor.cpp
- Wrap debug prints behind `#ifdef DEBUG_AUDIO`
- Update inline comments (DC offset is ~1340, thresholds match new values)

**RG-A1.4: Generate NotebookLM learning materials**
- Add C++/Arduino learning source to existing notebook
- Map C++ concepts to JavaScript equivalents (classes → prototypes, pointers → references, static → module scope)
- Generate slide deck: "C++ for JavaScript Developers"
- Generate video: "How the Event Bus Works (Redux vs ESP32)"
- Focus: teach Carlos to understand and explain the firmware, not just build it

**RG-A1.5: Set up GitHub Issues + Milestones**
- Create milestone per phase (A.1, A.5, B, C, D, E)
- Create issues for each ticket with risk/mitigation tags
- Link to PHASE_PLAN.md tracking

### Smoke Test
- [ ] PHASE_PLAN.md exists with all phases listed
- [ ] AGENT_WORKFLOW.md matches Money Shepherd pattern
- [ ] CLAUDE.md reflects actual tech stack and build commands
- [ ] Debug prints toggle with `#define DEBUG_AUDIO`
- [ ] `arduino-cli compile --fqbn esp32:esp32:XIAO_ESP32S3:PSRAM=opi .` succeeds
- [ ] NotebookLM notebook has C++ learning materials

---

## Phase A.5 — SD Card Voice Note Capture
**Goal:** Record voice notes to SD card on double-press.

### Tickets

**RG-A5.1: SD card initialization and FAT32 mount**
- New files: `sd_card.h`, `sd_card.cpp`
- Init SD on GPIO 21 (built-in CS pin)
- Handle missing SD card gracefully (event bus notification)

**RG-A5.2: WAV file writer with audio buffering**
- New files: `wav_writer.h`, `wav_writer.cpp`
- 16kHz, 16-bit mono WAV format
- Double-buffered writing (DMA fills one buffer while SD writes the other)
- Auto-name files with timestamp

**RG-A5.3: Capture mode state machine**
- New files: `capture_mode.h`, `capture_mode.cpp`
- Subscribe to `EVENT_BUTTON_DOUBLE` → start recording
- Subscribe to `EVENT_SPEECH_ENDED` → track silence duration
- Auto-stop after 5s continuous silence
- LED: solid magenta during recording
- Guardian mode stays active underneath

**RG-A5.4: Session metadata logger**
- New file: `session_logger.h`, `session_logger.cpp`
- CSV file on SD: timestamp, duration, alert_count, max_level, sensitivity
- One row per monitoring session (reset to reset)
- Enables later analytics in companion app

### Smoke Test
- [ ] SD card mounts on boot (serial: `[SD] Card mounted`)
- [ ] Double-press starts recording (LED: magenta)
- [ ] WAV file appears on SD card, plays back on computer
- [ ] 5s silence auto-stops recording
- [ ] Session CSV logs alert events
- [ ] Missing SD card doesn't crash firmware

---

## Phase B — Haptic Vibration Feedback
**Goal:** Add vibration motor as discreet alert output.

### Hardware
- Coin vibration motor → GPIO 3 via NPN transistor (2N2222)
- Flyback diode (1N4001) across motor terminals
- PWM control for intensity patterns

### Tickets

**RG-B.1: Wire vibration motor circuit on breadboard**
- Visual wiring guide in NotebookLM (like NeoPixel phase)
- 4 connections: GPIO 3 → transistor base (via 1kΩ), collector → motor, emitter → GND, motor+ → 3.3V

**RG-B.2: Vibration output subscriber module**
- New files: `vibration_output.h`, `vibration_output.cpp`
- Subscribe to `EVENT_ALERT_LEVEL_CHANGED`
- PWM patterns per alert level:
  - GENTLE: single soft pulse
  - MODERATE: double pulse every 3s
  - URGENT: continuous gentle buzz
  - CRITICAL: strong intermittent buzz

**RG-B.3: User preference for alert modality**
- Config option: LED only, vibration only, or both
- Triple-press button cycles modality
- Persist preference (or reset on boot for MVP)

### Smoke Test
- [ ] Motor vibrates on speech detection (feel it, don't just see LED)
- [ ] Vibration patterns differ per alert level
- [ ] Motor stops when speech ends
- [ ] Triple-press cycles alert modality

---

## Phase C — BLE Companion App + Voice Trainer
**Goal:** Connect device to React Native app. Set up voice enrollment, meeting modes, and Word Shepherd-inspired features.

### Architecture Decision: New App, Reference Word Shepherd
- BLE-first architecture (not WebSocket-dependent like Word Shepherd)
- Port Word Shepherd's CoachingDetector, prompt templates, speaker detection patterns
- New repo, reference Word Shepherd for navigation, state management, growth dashboard

### Tickets (Firmware Side)

**RG-C.1: NimBLE GATT peripheral setup**
- New files: `ble_output.h`, `ble_output.cpp`
- Custom service UUID: `4A980001-1CC4-E7C1-C757-F1267DD021E8`
- Characteristics: alert_level, speech_duration, device_mode, sensitivity, battery, session_stats, thresholds, audio_stream

**RG-C.2: BLE + WiFi connectivity with fallback sync**
- Subscribe to all events → update GATT characteristics
- Notify connected client on changes
- Handle read/write for settings (sensitivity, thresholds)
- **Robustness:** Auto-reconnect after phone calls, alarms, BLE interruptions
- **Battery for long meetings:** Optimize BLE connection intervals for 2+ hour sessions
- **WiFi fallback:** ESP32S3 has both BLE and WiFi. Use WiFi for:
  - Direct Google Drive upload when on home WiFi (no phone needed)
  - Background sync: device queues recordings/transcripts on SD card, auto-uploads when WiFi available
  - Sync strategy: BLE preferred (real-time to phone) → WiFi fallback (batch to cloud) → SD buffer (offline)
  - WiFi credentials stored on device (configured once via companion app)
- Graceful degradation: if both BLE + WiFi drop, device continues standalone (LED/vibration alerts, SD buffering)

### Tickets (App Side — Core)

**RG-C.3: React Native Expo project scaffold**
- Expo bare workflow (needed for BLE)
- react-native-ble-plx for BLE communication
- Navigation: Home, Live Session, History, Settings, Coaching, Onboarding

**RG-C.4: Voice trainer onboarding**
- **First-run setup:** Record 3-5 voice samples (read prompts aloud)
- Store voice embedding locally for speaker recognition
- "That's me" confirmation during meetings to improve accuracy
- Edge case: user only says one sentence — still identifiable after training
- This MUST happen before meeting mode works properly

**RG-C.5: Session modes — fluid, not rigid**
- Modes are loose categories, not strict walls. Life isn't always a "meeting":
  - **Solo** (default) — talking to yourself, voice notes, thinking aloud
  - **With others** — any interaction: meeting, conversation, random chat, phone call, drive-thru, anything
- Auto-detection: second voice appears → seamlessly enable speaker tracking. No prompt, no mode switch needed.
- **The device just adapts.** Solo = rambling alerts for you. Others present = track who's talking, only coach YOUR speech, name speakers as they appear.
- Manual override available (app toggle or device triple-press) for edge cases
- Edge cases handled loosely:
  - Cashier at store → don't bother naming, auto-expires after session
  - Recurring colleague → builds recognition over time
  - Phone call → other person's voice comes through speaker, treated as second speaker
  - Group hangout → multiple unnamed speakers, that's fine — focus coaching on Carlos

**RG-C.6: BLE connection + real-time dashboard**
- Scan for Guardian device
- Display real-time: alert level, speech duration, battery %, current mode
- Color-coded status matching device LED
- Battery estimation: "~2hr 15min remaining at current usage"

**RG-C.7: Session history + analytics**
- Store sessions locally (SQLite via expo-sqlite)
- Charts: daily rambling time, alert frequency, improvement trends
- Reference: Word Shepherd's GrowthScreen patterns

**RG-C.8: Settings + threshold configuration**
- Write sensitivity and alert thresholds to device via BLE
- Mode preferences (LED/vibration/both)
- Meeting mode defaults vs self-note defaults
- Persist across sessions

**RG-C.9: Apple Watch forwarding**
- iOS notifications for alert level changes
- Automatic Apple Watch display (free with iOS notifications)

### Smoke Test
- [ ] App discovers and connects to Guardian device
- [ ] Voice trainer completes enrollment (3-5 samples)
- [ ] Real-time alert level updates on phone as you speak
- [ ] Meeting mode detects multiple speakers
- [ ] BLE reconnects after phone call interruption
- [ ] Battery % displays with estimated remaining time
- [ ] Session history shows past recordings with stats
- [ ] Device works standalone if BLE drops mid-meeting

---

## Phase D — Transcription + AI Coaching + Cloud Sync
**Goal:** Add cloud transcription, intelligent coaching, speaker identification, and backup.

### AI Credit Cost Estimation (Personal Use)
| Service | Rate | Est. Daily (1hr meetings) | Est. Monthly |
|---------|------|--------------------------|-------------|
| Deepgram Nova-3 STT | $0.0043/min | $0.26/day | ~$8/month |
| Claude Haiku (passive coaching) | ~$0.01/session | $0.01/day | ~$0.30/month |
| Claude Sonnet (summaries) | ~$0.05/summary | $0.05/day | ~$1.50/month |
| **Total estimate** | | **~$0.32/day** | **~$10/month** |

Note: On-device VAD gates cloud calls — silence doesn't consume STT credits. Actual cost depends on meeting frequency and length.

### Tickets

**RG-D.1: Audio streaming via BLE to companion app**
- Stream 16kHz PCM audio from device to app
- App forwards to cloud STT (Deepgram Nova-3)
- Buffering strategy for BLE bandwidth constraints (~20kbps effective)

**RG-D.2: Real-time transcription + speaker detection**
- Live transcript in app during monitoring
- Deepgram diarization identifies speakers (speaker 0, 1, 2...)
- Match Carlos's voice embedding (from Phase C voice trainer) to auto-label "Me"
- Other speakers labeled "Speaker 1", "Speaker 2" etc.

**RG-D.3: Live speaker identification + naming**
- **During the session** (not just after): app prompts "New voice detected — who is this?" when a new speaker appears
- Carlos can tap to name them immediately, or edit later
- Speaker labels appear in real-time transcript as names, not "Speaker 1"
- Build speaker library over time (voice embeddings stored locally)
- Auto-suggest names based on previous encounters with same voice
- **Return visitors:** "This sounds like Sarah from last Tuesday's call — confirm?"

**RG-D.4: Claude coaching engine**
- Port Word Shepherd's CoachingDetector + FillerDetector + SuggestionEngine patterns
- Detect: rambling (duration), filler words, topic drift, speaking pace
- Coaching nudges displayed in app (not on device — too distracting)
- Meeting mode: only coach on YOUR speech, not others'

**RG-D.5: "Catch me up" button**
- Tap to get AI summary of what's been discussed
- Dynamic timeframe options: "Last 5 minutes", "Last 10 minutes", "From beginning"
- Uses transcript buffer + Claude Haiku for fast summarization
- Use case: you zoned out or arrived late to a meeting

**RG-D.6: "Draft a question" feature**
- When speaker says "Any questions?" — app nudges: "Want to draft one?"
- Claude reviews recent context and helps formulate a clear question
- Based on what YOU were tracking vs. what was discussed
- Reference: Word Shepherd's `/api/coach` endpoint and prompt templates

**RG-D.7: Post-session summary + insights**
- Claude Sonnet summarizes conversation
- Highlights: rambling moments, key points, action items
- Compare against previous sessions for improvement trends
- Context-aware templates per mode (meeting summary ≠ self-note summary)

**RG-D.8: Google Drive backup + sync (multi-path)**
- **Path 1 — Via app:** Companion app syncs transcripts/audio to Google Drive (OAuth, Carlos's account)
- **Path 2 — Direct WiFi:** Device uploads SD card contents directly to Google Drive when on home WiFi (no phone needed). Uses ESP32 HTTP client + Google Drive REST API with stored refresh token.
- **Background sync:** Device queues files on SD. When WiFi available, uploads in background. When BLE + app available, syncs faster via phone.
- Folder structure: `Rambling Guardian / 2026 / April / [auto-title].txt`
- Separate folders: `Audio/` and `Transcripts/`
- Auto-title from Claude: first meaningful sentence or meeting topic
- Monthly rollover prevents folders from getting too large
- If offline all day, syncs everything when Carlos gets home to WiFi

### Smoke Test
- [ ] Live transcript appears in app while talking
- [ ] Carlos's voice auto-labeled as "Me" in transcript
- [ ] Coaching nudge appears when rambling detected (your speech only in meeting mode)
- [ ] "Catch me up" returns accurate summary of last 5 minutes
- [ ] "Draft a question" generates relevant question from context
- [ ] Post-session summary is accurate and helpful
- [ ] Transcript syncs to Google Drive with proper folder structure
- [ ] Filler word count is tracked and displayed

---

## Phase E — Wispr-Style Dictation
**Goal:** Speak → get polished text on any device.

### Tickets
- BLE audio streaming to cloud
- Whisper STT → Claude cleanup pipeline (filler removal, course correction)
- Clipboard integration on phone
- BLE HID keyboard option (type directly to Mac/PC)
- Personal dictionary sync

---

## Phase F — Production (Personal Use)
**Goal:** From breadboard to permanent personal device. Not selling — building for Carlos.

### Tickets
- Custom PCB design (KiCad) — consolidate breadboard to single board
- 3D printed enclosure — small, clip-on or pendant form factor
- Production battery selection (target: 24-48hr with BLE)
- USB-C charging circuit
- OTA firmware updates via BLE (no more plugging in to flash)
- App Store submission (TestFlight for personal use)

---

## Development Workflow (Applied to Every Ticket)

### Per-Ticket 5-Step Process
1. **Plan** — Restate goal, list files, declare test requirements, pick 2-3 skills, declare expert persona
2. **Implement** — Touch only declared files
3. **Check** — Compile + flash + serial monitor (hardware) or lint + test (app)
4. **Fix** — Systematic debugging if checks fail
5. **Summarize** — What/Files/How to test/Risks format

### Expert Persona Per Ticket
Each ticket dynamically adopts the most relevant expert perspective. Not overdone — just the right hat for the task. Examples:
- **Firmware tickets** → Embedded systems engineer (10yr ESP32 experience)
- **BLE protocol** → Bluetooth SIG protocol specialist
- **React Native app** → Senior mobile architect (React Native + BLE)
- **AI coaching prompts** → Behavioral psychologist + prompt engineer
- **Audio DSP** → Signal processing engineer
- **Battery management** → Power systems engineer
- **UX/UI design** → Product designer specializing in accessibility + ADHD
- **Cloud architecture** → Backend architect (serverless, streaming)

Declared at plan step. Lightweight — just ensures the right instincts guide implementation.

### Code Review Gate
- Run `superpowers:requesting-code-review` BEFORE flashing or merging
- Review against design spec + event bus pattern compliance
- No testing stale code — only reviewed code gets flashed/deployed

### Skills Per Ticket: Min 2, Max 4
Always pull in enough perspective. Minimum 2 skills, maximum 4 per ticket.

| Phase | Skills (pick 2-4 per ticket) |
|-------|------------------------------|
| A.1 | `revise-claude-md`, `brainstorming`, `verification-before-completion` |
| A.5 | `embedded-programmer`, `test-driven-development`, `solid` |
| B | `embedded-programmer`, `verification-before-completion`, `brainstorming` |
| C (firmware) | `embedded-programmer`, `solid`, `context7`, `verification-before-completion` |
| C (app) | `react-native-architecture`, `solid`, `brainstorming`, `test-driven-development` |
| D | `claude-api`, `test-driven-development`, `context7`, `solid` |

### Testing Policy (Thin TDD)
**Tests REQUIRED for:**
- Domain logic (speech timing, alert escalation, energy calculation)
- BLE protocol contracts
- Cloud API routes
- Data persistence/migrations
- Speaker detection accuracy
- Voice enrollment verification

**Tests NOT REQUIRED for:**
- LED animation tweaks
- UI-only polish in companion app
- Hardware wiring changes

### Compile Flag (NEVER forget)
```
arduino-cli compile --fqbn esp32:esp32:XIAO_ESP32S3:PSRAM=opi .
```
NEVER use `--build-property "build.extra_flags=..."` — it overrides `-DESP32=ESP32`.

---

## Learning Plan (NotebookLM) — Dynamic, Not Static

Generate materials in the existing notebook (`497bb0ca-...`). **Updated at end of each phase** so content stays current.

### Initial Materials (Phase A.1)
1. **"C++ for JavaScript Developers"** — slide deck mapping concepts (classes → prototypes, pointers → references, static → module scope, templates → generics)
2. **"How the Event Bus Works"** — video comparing Redux dispatch/subscribe to the ESP32 event bus
3. **"Reading ESP32 Datasheets"** — guide to understanding hardware specs

### Phase-End Learning Updates (Dynamic)
After each phase, add a source to NotebookLM with:
- **What was built** — code snippets with annotations
- **How it works** — architecture diagrams, data flow
- **JavaScript equivalent** — "This C++ pattern is like X in React/Node"
- **What to teach someone** — explain it like you're presenting to a colleague

Generate a **slide deck or video** per phase so Carlos can:
- Review what was built on weekends
- Share with others: "This is how the event bus works, and here's the code"
- Build intuition for C++ patterns through JavaScript analogies

### Future Phase Materials (generated when needed)
- **"BLE for Web Developers"** — infographic: GATT = REST API (Phase C)
- **"Audio DSP Basics"** — how VAD and energy detection work (Phase D)
- **"From Breadboard to PCB"** — roadmap video (Phase F)

**Goal:** Carlos can explain every module, teach someone else, and make informed architecture decisions — not just build.

---

## Centralized Brain — Conversation Continuity

### Problem
Long conversations accumulate context that gets lost when starting fresh. New conversations should pick up seamlessly with the same knowledge, rules, and perspective.

### Solution: 4-Layer Persistence

**Layer 1: CLAUDE.md (loads every conversation)**
- Tech stack, architecture, build commands, non-negotiables
- Workflow rules (code review before testing, min 2 skills, expert personas)
- Links to all docs (PHASE_PLAN.md, AGENT_WORKFLOW.md, design spec)
- Updated at phase boundaries via `revise-claude-md` skill

**Layer 2: Memory files (auto-loaded from MEMORY.md index)**
- User preferences, feedback, lessons learned
- Project status (what phase we're in, what's done)
- Build gotchas (PSRAM flag, NeoPixel library, etc.)
- Updated when significant decisions or lessons occur

**Layer 3: PHASE_PLAN.md (checked at start of each session)**
- Living ticket checklist: `- [x]` done, `- [ ]` pending
- Agent reads this to know exactly where to start
- Includes current phase, next ticket, blockers

**Layer 4: docs/ folder (referenced as needed)**
- Design spec (architecture, edge cases, all phases)
- Implementation plans (task-level detail)
- Reference docs (original PRD, intake, hardware guide)

### Handoff Protocol (End of Each Session)
1. Update `PHASE_PLAN.md` — mark completed tickets, note blockers
2. Update memory files — any new lessons, decisions, or preferences
3. Commit and push to GitHub
4. Summary message: "Here's where we left off: [ticket], [status], [next step]"

### New Session Protocol (Start of Each Session)
1. Agent reads CLAUDE.md (automatic)
2. Agent reads MEMORY.md index (automatic)
3. Agent reads PHASE_PLAN.md to find current ticket
4. Agent confirms: "We're on [ticket]. Last session we [did X]. Ready to continue?"
5. Agent adopts expert persona for current ticket

**Result:** Every conversation responds identically — same skills, same rules, same awareness of what's done and what's next.

---

## Edge Cases (Expanded)

### Meeting Mode Edge Cases
- **You only say one sentence** — voice trainer must recognize from short samples
- **Speaker talks over you** — overlapping speech, diarization may misattribute
- **Phone call during meeting** — BLE drops; device continues standalone; app reconnects after
- **Alarm/notification interrupts** — iOS audio session handling; BLE connection survives
- **Meeting goes 3+ hours** — battery management; warn at 20% with "X minutes remaining"
- **Late arrival** — "Catch me up" from beginning; transcript already rolling
- **Multiple meetings same day** — auto-separate sessions by silence gaps (>5 min = new session)

### Self-Note Mode Edge Cases
- **Background TV/music** — auto-calibration filters ambient; may need manual sensitivity bump
- **Whispering late at night** — low energy threshold needed; auto-calibration handles this
- **Walking/moving** — vibration motor noise picked up by mic; test and mitigate
- **Forgot to stop recording** — auto-stop after configurable silence timeout (5 min default)

### BLE / Connection Edge Cases
- **Phone out of BLE range** — device continues standalone; syncs when reconnected
- **Multiple devices nearby** — device UUID uniquely identifies your Guardian
- **iOS background mode** — BLE continues in background but audio streaming may pause
- **App killed by iOS** — device doesn't crash; reconnects when app relaunches

### Google Drive Sync Edge Cases
- **No internet** — queue locally, sync when connected
- **Drive full** — warn in app; pause sync
- **Duplicate files** — idempotent naming (session ID in filename)
- **Large audio files** — compress WAV → AAC before upload; or upload only transcripts by default

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| BLE + I2S peripheral conflict | Audio drops during BLE transfer | Test early in Phase C; use DMA for both |
| Battery life too short with BLE | <2hr in meetings | Aggressive power mgmt; BLE intervals; warn early |
| Deepgram cost at scale | ~$10/mo at 1hr/day | On-device VAD gates cloud calls; silence = free |
| Companion app scope creep | Delays hardware phases | Strict ticket scoping; MVP-first per feature |
| ESP32 board package updates | Library breakage | Pin version in CLAUDE.md; test before upgrading |
| Voice trainer accuracy | Misidentifies speaker | Multiple enrollment samples; "correct me" button |
| BLE drops mid-meeting | Lost transcript data | Device buffers to SD; syncs on reconnect |
| iOS kills app in background | Loses BLE connection | Background BLE mode; auto-reconnect protocol |
| Google Drive API rate limits | Sync failures | Batch uploads; queue with retry; daily sync option |
| Context drift across sessions | Agent forgets decisions | 4-layer persistence; PHASE_PLAN.md as source of truth |

---

## Decisions Made

1. **Next phase after A.1:** Phase A.5 (SD Card voice notes) — builds on existing code, lower risk
2. **Companion app strategy:** New app, reference Word Shepherd patterns — clean BLE-first architecture
3. **VAD tuning:** Add auto-calibration on boot — measure ambient noise for 3s, set threshold dynamically

### Auto-Calibration Ticket (add to Phase A.1)

**RG-A1.6: VAD auto-calibration on boot**
- On startup, read 3 seconds of audio (30 windows × 100ms)
- Compute mean energy of ambient noise
- Set VAD threshold to `ambient_energy × 3` (or minimum 20)
- Log: `[Audio] Calibrated: ambient=12, threshold=36`
- Eliminates manual threshold tuning across environments
- Add to `audio_input.cpp` in `audioInputInit()`

## What's Next (Immediate)

Start with **Phase A.1** (dev workflow setup + code cleanup + auto-calibration) — 6 tickets, no hardware changes, sets the foundation for everything else. Then **Phase A.5** (SD card voice notes).

## Verification

Phase A.1 is verified when:
- All workflow docs exist and match Money Shepherd patterns
- CLAUDE.md is accurate
- Debug code is behind `#ifdef`
- Firmware compiles clean
- NotebookLM has C++ learning materials
- GitHub milestones created for phases A.1 through F
