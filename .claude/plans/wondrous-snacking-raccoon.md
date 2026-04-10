# Phase C Plan -- BLE Companion App + Voice Trainer

## Context

Phases A.1, A.5, and B are complete. The ESP32S3 wearable has 12 firmware modules (VAD, speech timer, LED, vibration, button, battery, SD card recording, session logging) communicating via a synchronous event bus. No BLE code exists yet. Phase C bridges the device to a React Native companion app over BLE, adding real-time monitoring, an offline exercise library, and session analytics.

Carlos is a senior React Native/TypeScript dev — the app side is his home turf. The firmware BLE work is new territory.

## Housekeeping (before implementation)

1. **Close stale GitHub issues:** 6 A.1 issues (#1-6) are still open despite all being complete. Close them.
2. **Create Phase C GitHub issues:** Create issues for all C tickets under the "Phase C" milestone.
3. **Update PHASE_PLAN.md:** Add new tickets (C.3.5, C.4.5, C.10), revise C.2 scope description.
4. **Update memory:** Mark Phase B complete, Phase C starting.

## Key Design Decisions

### WiFi deferred to Phase D
C.2 was originally "BLE + WiFi connectivity." WiFi provisioning, multi-network storage, and batch sync all require cloud endpoints (Google Drive) that don't exist until Phase D. BLE alone covers all Phase C needs (phone is always in pocket range). C.2 becomes "BLE connection management" only.

### Monorepo structure
App lives at `/app` within the same repo. Firmware stays at root. Keeps everything in one place for a personal project.

### App architecture
- **Expo SDK 52+** with bare workflow (required for `react-native-ble-plx`)
- **Expo Router** (file-based routing, tabs for main nav)
- **Zustand** for state management
- **expo-sqlite** for offline-first data persistence
- **react-native-ble-plx** for BLE
- **expo-notifications** for local notifications (auto-forwards to Apple Watch)

### Figma-first design (first time doing this properly)
Unifyr gave us the Figma tooling knowledge but was retrofitted late. Rambling Guardian is the first project doing Figma-first from day one. Following Refactoring UI: start with features, not layouts.

### Data architecture: SQLite + Google Drive
- **SQLite** locally for offline-first (sessions, exercises, settings, voice samples)
- **Google Drive** for cloud backup of recordings, transcripts, session data (Phase D)
- Storage math: 1hr/day compressed audio = ~2.5GB/year. Free 15GB tier covers ~6 years. Google One $2/mo for 100GB if needed.
- No paid database needed for a personal project.

### Voice enrollment is recording-only in Phase C
C.4 stores voice samples but does NOT compute embeddings. Speaker recognition arrives in Phase D with Deepgram diarization. Honest scoping — the recordings are ready when the AI is.

### Session modes are manual toggle in Phase C
Auto-detection of second speakers requires diarization (Phase D). C.5 provides a manual "Solo / With Others" toggle that sets a data flag for Phase D to act on.

---

## UI Design Approach

### Mandatory skills on EVERY UI ticket
- `ui-mastery` — Refactoring UI design persona (hierarchy, spacing, depth, color)
- `figma:figma-use` — Figma Plugin API for component building
- Read relevant `~/.design-kb/` chapters per component type:
  - Cards/containers: `02-hierarchy.md`, `03-spacing-layout.md`, `06-depth-shadows.md`
  - Forms/inputs: `02-hierarchy.md`, `03-spacing-layout.md`, `04-typography.md`
  - Mobile screens: `10-mobile-patterns.md`, `03-spacing-layout.md`
  - Color work: `05-color.md`
  - Dark theme: `09-dark-theme.md`
  - Polish: `08-finishing-touches.md`

### Design foundation (RG-C.3.5)
Before any UI is built, create:
1. **DESIGN.md** — Brand personality, color palette (HSL-based), typography scale, spacing system, dark/light mode tokens
2. **Figma token library** — Variables matching DESIGN.md (colors, spacing, radius, typography)
3. **Figma component primitives** — Button, Card, Badge, Input, Toggle, Timer display
4. **Key feature designs** (features first, not screens — per Refactoring UI):
   - Exercise card + step timer (the core daily interaction)
   - Alert level indicator (the real-time feedback element)
   - Session stats card (the history unit)
   - Streak calendar (the motivation element)
   - Device connection card (the BLE status element)

### Refactoring UI principles enforced
- Reference: `/Users/carlos/Workspace/refactoring-ui_compress.pdf` + `~/.design-kb/` chapters
- Start with feature, not layout
- Design in grayscale first (get hierarchy right), add color second
- Fewer borders — prefer spacing, shadow, background difference
- Start with too much white space, compress later
- One hero element per screen (the number/state that matters most)
- 44pt minimum touch targets (mobile patterns chapter)
- Both themes tested side-by-side

### Pattern from Unifyr (adapted)
- Atomic design: primitives -> patterns -> features -> screens
- Self-review before presenting: `get_screenshot` -> critique against KB -> fix -> re-screenshot
- All fills bound to semantic variables (light/dark mode aliases)

---

## BLE GATT Protocol Design

**Service UUID:** `4A980001-1CC4-E7C1-C757-F1267DD021E8`

| Characteristic | UUID Suffix | Properties | Format | Size |
|---|---|---|---|---|
| Alert Level | 0002 | Read, Notify | uint8 (0-4) | 1B |
| Speech Duration | 0003 | Read, Notify | uint32 LE (ms) | 4B |
| Device Mode | 0004 | Read, Write, Notify | uint8 | 1B |
| VAD Sensitivity | 0005 | Read, Write | uint8 (0-3) | 1B |
| Battery Level | 0006 | Read, Notify | uint8 (0-100%) | 1B |
| Session Stats | 0007 | Read, Notify | packed struct | 10B |
| Alert Thresholds | 0008 | Read, Write | 4x uint16 LE | 8B |
| Alert Modality | 0009 | Read, Write, Notify | uint8 (0-2) | 1B |
| Device Info | 000A | Read | UTF-8 string | ~20B |

**Note:** Speech Duration must be uint32 (not uint16). uint16 overflows at 65s — before ALERT_CRITICAL even triggers at 60s.

**New firmware events needed:** `EVENT_BLE_CONNECTED`, `EVENT_BLE_DISCONNECTED`, `EVENT_THRESHOLDS_CHANGED`

---

## SQLite Schema (designed in C.3, used throughout)

```sql
sessions (id, started_at, ended_at, duration_ms, mode, alert_count, max_alert, speech_segments, sensitivity, synced_from_device)
alert_events (id, session_id, timestamp, alert_level, duration_at_alert)
exercises (id, category, title, description, instructions, duration_seconds, difficulty, tags, sort_order)
exercise_completions (id, exercise_id, completed_at, rating)
streaks (id, date, exercises_done, sessions_done, total_speech_ms)
settings (key, value)
notifications (id, type, title, body, sent_at, read)
voice_samples (id, recorded_at, file_path, duration_ms, confirmed)
```

---

## Ticket Execution Order

### Sprint 1 — Parallel foundation (firmware + app scaffold)

**[1] RG-C.1: NimBLE GATT peripheral setup** (firmware)
- Skills: `embedded-programmer`, `context7`
- New: `ble_output.h`, `ble_output.cpp`
- Modify: `event_bus.h` (3 new events), `config.h` (BLE constants), `rambling-guardian.ino` (add to init/loop)
- Install: NimBLE-Arduino library
- Subscribe to all events -> update GATT characteristics, notify connected clients
- Write callbacks: app writes sensitivity/mode/thresholds -> publish to event bus
- Flash budget: current 441KB + ~300KB NimBLE = ~741KB (24% of 3MB) -- safe
- Test: nRF Connect app to scan, connect, read/write characteristics
- **Critical risk:** I2S + NimBLE DMA conflict. Test immediately on hardware.

**[2] RG-C.3: React Native Expo scaffold** (app — infrastructure only, no UI yet)
- Skills: `react-native-architecture`, `solid`
- New project at `/app/` with Expo Router tabs
- SQLite schema + database init + exercise seeding
- Zustand stores (device, session, settings, exercise)
- BLE service skeleton + constants (UUIDs, data parsers)
- Placeholder screens (tab structure only — no styled UI)
- Deps: expo ~52, expo-router, react-native-ble-plx, expo-sqlite, expo-notifications, expo-av, zustand, victory-native

### Sprint 2 — Design foundation + BLE polish

**[3] RG-C.3.5: Design system + Figma feature designs** (design — NEW)
- Skills: `ui-mastery`, `figma:figma-use`, `figma:figma-generate-library`
- Read: `~/.design-kb/01-process.md` (personality-first), `05-color.md` (HSL palettes), `04-typography.md`, `03-spacing-layout.md`, `09-dark-theme.md`, `10-mobile-patterns.md`
- Reference: Money Shepherd DESIGN.md pattern (`/Users/carlos/Workspace/money-shepherd-domain/DESIGN.md`)
- **Step 1: DESIGN.md** — Define Rambling Guardian's brand personality, color system (HSL), typography scale, spacing (4pt grid), dark/light tokens. Think: what does an ADHD speech coach *feel* like? Calm but energizing. Supportive, not clinical.
- **Step 2: Figma token library** — Migrate DESIGN.md tokens to Figma variables (colors, spacing, radius, type)
- **Step 3: Component primitives in Figma** — Button, Card, Badge, Input, Toggle, TimerDisplay, ProgressRing (atomic level)
- **Step 4: Key feature designs in Figma** (features, not screens):
  - Exercise card with step timer (daily interaction)
  - Alert level indicator with color ring (real-time feedback)
  - Session stats card (history unit)
  - Streak calendar heat map (motivation)
  - Device connection status card (BLE)
  - Voice recording prompt card (onboarding)
- **Step 5: Self-review** — Screenshot each component, critique against KB chapters, fix, re-screenshot
- Both light and dark mode for every component
- **Output:** DESIGN.md committed + Figma file with tokens + primitives + feature components

**[4] RG-C.2: BLE connection management** (firmware, parallel with design)
- Skills: `embedded-programmer`, `solid`
- Modify: `ble_output.cpp` — auto-reconnect, connection parameter negotiation, power-saving advertising
- LED feedback: cyan flash on connect, red flash on disconnect (only during ALERT_NONE)
- Standalone: device continues normally without BLE
- WiFi deferred to Phase D
- Test: connect, toggle airplane mode, verify reconnect

### Sprint 3 — App features with design system (parallel)

All UI tickets from here forward use the design system from C.3.5.

**[5] RG-C.4: Voice trainer onboarding** (app)
- Skills: `ui-mastery`, `react-native-architecture`
- Read: `10-mobile-patterns.md`, `02-hierarchy.md`
- New: onboarding screens, voice recorder service, waveform component
- 3-5 text prompts, record each via expo-av, store WAV + metadata
- "Skip for now" always available (ADHD-friendly)
- No embedding computation — just store recordings for Phase D
- Implement using Figma voice recording prompt card design
- Test: record samples, verify persistence

**[6] RG-C.4.5: Offline exercise library** (app)
- Skills: `ui-mastery`, `react-native-architecture`
- Read: `10-mobile-patterns.md`, `02-hierarchy.md`, `08-finishing-touches.md`
- AI-generated exercise content (55 exercises, 4 categories) — Carlos reviews JSON before shipping
- Daily rotation engine: 3 exercises from 3 categories, freshness-weighted
- Difficulty progression: unlock next tier after 5 completions
- Streaks: calendar heat map (from Figma design), milestones at 3/7/14/30 days
- Implement using Figma exercise card + streak calendar designs
- Test: verify varied daily selections, streak counting, completion flow

**[7] RG-C.5: Session modes** (app)
- Skills: `ui-mastery`, `solid`
- Manual toggle: "Solo" / "With Others" — stored per session
- Intentionally thin — auto-detection deferred to Phase D
- Test: toggle modes, verify database records

**[8] RG-C.10: Notification system** (app)
- Skills: `react-native-architecture`, `solid`
- expo-notifications setup with channels (Alerts, Summaries, Coaching, Milestones)
- Types: rambling alerts (BLE-triggered in C.6), daily summary (scheduled), battery, coaching reminders, streak milestones
- Notification log to SQLite
- All types individually toggleable
- Test: trigger test notifications, verify scheduling, verify DB logging

### Sprint 4 — Integration (first BLE connection)

**[9] RG-C.6: BLE connection + real-time dashboard** (app + firmware)
- Skills: `ui-mastery`, `react-native-architecture`
- Read: `02-hierarchy.md`, `05-color.md`, `10-mobile-patterns.md`
- BLE scanning filtered by service UUID, connection flow, characteristic subscription
- Real-time dashboard using Figma alert indicator + device connection card designs
- Hero element: the alert level color ring (one dominant visual per screen)
- Notification triggers: fire on ALERT_URGENT/CRITICAL
- Auto-reconnect: retry every 3s for 2 min, then manual button
- iOS background BLE mode
- Auto-create session records from BLE data stream
- **This is the integration ticket — requires physical device.**
- Test: connect to device, verify all live stats, verify reconnect, verify background mode

### Sprint 5 — Data-driven features (parallel)

**[10] RG-C.7: Session history + analytics** (app)
- Skills: `ui-mastery`, `react-native-architecture`
- Read: `02-hierarchy.md`, `03-spacing-layout.md`, `08-finishing-touches.md`
- Session list using Figma session stats card design
- Session detail with alert timeline
- Analytics: today's stats, 7-day trend, alert frequency trend
- Charts via victory-native — glanceable, not data-dense (ADHD-friendly)
- Empty state: designed, not an afterthought (finishing touches chapter)
- Test: seed test data, verify charts

**[11] RG-C.8: Settings + threshold configuration** (app)
- Skills: `ui-mastery`, `react-native-architecture`
- Read: `10-mobile-patterns.md`, `02-hierarchy.md`
- Device settings (written via BLE): sensitivity, thresholds, modality, mode
- App settings (SQLite): notification preferences, theme, daily target
- Threshold sliders: 5s-120s range, defaults match config.h
- Disabled state when device disconnected
- **Requires:** `speech_timer.cpp` to support runtime thresholds (currently compile-time in config.h)
- Test: change settings, verify BLE writes via Serial monitor

### Sprint 6 — Polish + phase boundary

**[12] RG-C.9: Apple Watch forwarding** (app)
- Skills: `react-native-architecture`
- Verify existing expo-notifications payloads forward to Watch
- Add haptic sound to high-priority notifications
- ~30 min ticket — lowest effort in Phase C
- Test: paired Apple Watch, verify notifications appear with haptic

**[13] UI polish pass** (app)
- Skills: `ui-mastery`, `figma:figma-use`
- Read: `08-finishing-touches.md`, `06-depth-shadows.md`
- Review all screens against DESIGN.md and Figma designs
- Check: hierarchy, spacing, touch targets, dark mode, empty states, loading states
- Fix any visual inconsistencies
- Screenshot every screen, critique, fix

**[14] Run revise-claude-md and commit** (phase boundary)

---

## Firmware Modifications Summary

| File | Changes |
|---|---|
| `event_bus.h` | Add EVENT_BLE_CONNECTED, EVENT_BLE_DISCONNECTED, EVENT_THRESHOLDS_CHANGED |
| `config.h` | Add BLE constants (device name, MTU, connection intervals) |
| `rambling-guardian.ino` | Add bleOutputInit() to setup, bleOutputUpdate() to loop |
| `speech_timer.cpp` | Make thresholds runtime-configurable (subscribe to EVENT_THRESHOLDS_CHANGED) |
| `led_output.cpp` | Subscribe to BLE events for connection status flashes |
| NEW `ble_output.h/.cpp` | NimBLE GATT server, event subscriptions, characteristic updates |

---

## Verification

Phase C is verified when:
- [ ] DESIGN.md exists with brand personality, colors, typography, spacing
- [ ] Figma file has token library + component primitives + feature designs (light + dark)
- [ ] Device advertises and app discovers it via BLE
- [ ] All GATT characteristics read correctly from app
- [ ] Real-time alert level updates on phone as you speak
- [ ] App writes sensitivity/thresholds to device successfully
- [ ] Voice trainer records and stores samples
- [ ] Exercise library shows daily rotation with streaks
- [ ] Session history displays past sessions with charts
- [ ] BLE reconnects after interruption
- [ ] Device works standalone if BLE drops
- [ ] Notifications appear on iPhone and Apple Watch
- [ ] App works offline (exercises, history) without BLE
- [ ] UI passes Refactoring UI checklist (hierarchy, spacing, touch targets, both themes)
- [ ] `arduino-cli compile --fqbn esp32:esp32:XIAO_ESP32S3:PSRAM=opi .` succeeds with BLE module

---

## Risks

| Risk | Mitigation |
|---|---|
| NimBLE + I2S DMA conflict | Test in C.1 immediately. ESP32S3 has separate DMA channels. If conflict: batch BLE notifications to 250ms intervals. |
| BLE drops during meetings | C.2 auto-reconnect + device continues standalone. App shows reconnecting state. |
| iOS kills app in background | `bluetooth-central` background mode in Info.plist. Test explicitly. |
| Battery drain with BLE active | NimBLE is lightweight. Monitor in C.6. If <2hr: increase connection interval to 50ms. |
| Exercise content volume | AI-generated 55, Carlos reviews. JSON is human-editable for ongoing additions. |
| Scope creep on modes (C.5) | Intentionally thin. Manual toggle only. AI detection is Phase D. |
| Design system delays Sprint 3 | C.3.5 runs parallel with firmware C.2. No UI tickets are blocked until C.3.5 completes. |
| Figma-first is new workflow | This is a practice round. Start with features (not screens). Learn the process. |

## Deferrals to Phase D

| Feature | Reason |
|---|---|
| WiFi provisioning + batch sync | No cloud endpoints yet. BLE covers Phase C needs. |
| Google Drive backup | SQLite + local storage for Phase C. Drive sync in D.8. |
| Audio streaming characteristic | No transcription to stream to. |
| Auto speaker detection | Requires Deepgram diarization. |
| Voice embedding computation | Recordings stored; embeddings computed when model arrives. |
| AI-powered exercise recommendations | Offline exercises first, adaptive AI later. |
| Paid database | Not needed. SQLite + Google Drive covers a personal project for years. |
