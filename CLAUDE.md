# Rambling Guardian

Wearable ADHD speech-duration monitor built on XIAO ESP32S3 Sense.

## Tech Stack
- Board: Seeed XIAO ESP32S3 Sense
- Language: C++ (Arduino IDE)
- Audio: I2S PDM microphone (GPIO 41/42)
- LED: Built-in RGB via `rgbLedWrite()` (ESP32 Board Package — no external library needed)
- SD Card: Built-in micro SD slot on Sense expansion board (GPIO 21 CS, FAT32, Arduino SD library)
- Architecture: Event-driven (pub/sub event bus)

## Pin Assignments
| Pin | Purpose |
|-----|---------|
| GPIO 41 | Microphone Data In (I2S PDM) — built-in, do not reassign |
| GPIO 42 | Microphone Clock (I2S PDM) — built-in, do not reassign |
| GPIO 21 | SD Card CS — built-in, do not reassign |
| GPIO 1 (D0) | Reserved — originally for external NeoPixel, now unused (built-in LED used instead) |
| GPIO 2 (D1) | Tactile button input (10kΩ pull-up to 3.3V) |
| GPIO 3 (D2) | Reserved for vibration motor (Phase B) |
| GPIO 4 (D3/A2) | Battery voltage ADC (100kΩ/100kΩ divider to battery+) |

## Build & Flash
1. Open `rambling-guardian.ino` in Arduino IDE 2.x
2. Board: "XIAO_ESP32S3" (Espressif ESP32 package)
3. PSRAM: "OPI PSRAM"
4. Partition: "Huge APP (3MB No OTA/1MB SPIFFS)"
5. Port: Select USB serial port
6. Upload: Click upload button
7. Monitor: Tools → Serial Monitor (115200 baud)

## Build Command (CLI)
```
arduino-cli compile --fqbn esp32:esp32:XIAO_ESP32S3:PSRAM=opi .
```
**NEVER** use `--build-property "build.extra_flags=..."` — it overrides `-DESP32=ESP32` and breaks the build.
Build size after Phase B: 441KB flash (13%), 34KB RAM (10%) — baseline for tracking bloat.

## Architecture
Modules communicate via event bus only — never call each other directly.
**Idle by default (Phase D-pre A):** Device boots into MODE_IDLE (not listening). Sessions start only when triggered (button press, BLE command, future Apple Watch shortcut). Audio I2S is suspended in IDLE to save power (~20mA vs ~50mA).
Session lifecycle: trigger → EVENT_SESSION_START_REQUESTED → mode_manager validates → EVENT_SESSION_STARTED → Audio resumes, VAD+SpeechTimer active → trigger stop → EVENT_SESSION_STOP_REQUESTED → EVENT_SESSION_STOPPED → Audio suspends.
SD card recording: EVENT_BUTTON_DOUBLE → CaptureMode → WavWriter → SD card. Only from IDLE (ignored during active session). Auto-stops after 5s silence.
Alert modality: triple-press cycles LED only / vibration only / both. Default: both. Resets on boot.
Vibration motor on GPIO 3 via S8050 NPN transistor. PWM patterns per alert level. SPI pins: expansion board uses GPIO 7/8/9 (not defaults).
Button is interrupt-driven (GPIO CHANGE mode) — never poll, I2S blocks for ~100ms per loop.
Utility modules (wav_writer, sd_card) are called directly — they're stateless helpers, not event subscribers.
audioGetLastSamples() exposes raw I2S samples for recording — shared buffer with VAD energy calculation.
Debug serial prints are gated by `#define DEBUG_AUDIO` in config.h (commented out by default)
VAD auto-calibrates on boot (~6s): 5 warmup + 30 measurement windows × 200ms. Serial: `[Audio] Calibrated: ambient=XX, threshold=YY`
Sensitivity levels (0–3) apply multipliers { 1, 2, 4, 8 } on calibrated baseline. Threshold capped at 80 — safe to boot mid-meeting.

### Standalone Backlog (Phase D-pre B)
**Metadata-first standalone persistence.** Session metadata (timestamps, alerts, speech segments, trigger source) persists to SD for later sync — not audio, not transcripts.
Boot-relative timestamps: `bootId` (monotonic counter in `/RG/boot_id.bin`) + `deviceSessionSequence` + `millis()` offsets. Phone anchors wall-clock per-boot on BLE connect.
Backlog file: versioned `/RG/backlog.bin` with 16-byte header ("RGBL" magic, version, recordSize) and 32-byte `SessionRecord` structs. Max 128 in-memory. Corruption → .bak rename + fresh file. Compaction when >100 records and >50% synced.
BLE sync: `4A98000C` (SYNC_DATA) — manifest(0x01)/request(0x02)/ack(0x03)/commit(0x04) protocol. Replay-safe via (bootId, sequence) pairs. Idempotent imports on app side. Partial success is normal.
No-SD graceful degradation: session runs, BLE live stats work, backlog skipped. Unwritten data is lost on power-off — no false recovery promises.
Build size after D-pre B: 737KB flash (22%), 48KB RAM (14%).

### Sync Status Model (Phase D.0)
Per-session `sync_status`: NULL (local) | pending | received | processed | acked | committed | failed.
Single watermark advances only on `committed` (device confirmed SD write). `acked` is transitional, not equivalent to synced.
syncCheckpointService.ts manages status transitions. syncEngine.ts retains the BLE state machine. syncTransport.ts wires status calls into the BLE sync cycle.
Watermark stored in settings table under key `syncWatermark`.

### Retention Tiers (Phase D.0)
| Tier | Data | Retention | Auto-Prune |
|------|------|-----------|------------|
| 1 | Metadata | Forever | Never |
| 2 | Transcript | Indefinite | Manual only |
| 3 | Alert clips | 30 days | Yes |
| 4 | Full audio | 7 days | Yes |
retentionService.ts enforces. `runPruneNow()` for manual trigger. `startRetentionEnforcement()` on app launch + daily interval. Tiers 3-4 are no-ops until audio artifacts exist.
`retention_tier` on session row = current effective/highest tier. Future per-artifact table may complement this.
Favorited session exemption deferred until favorited column exists.
SyncTarget type in syncTarget.ts documents future cloud adapter contract — not implemented in D.0.

### Transcript Pipeline (Phase D.1)
Phone mic captures audio via `react-native-live-audio-stream` during active sessions (16kHz/mono/16-bit PCM). Audio streams to Deepgram Nova-3 over raw WebSocket (`Authorization: Token` header — query param does NOT work). Live transcript appears in session screen via `transcriptStore` (Zustand). On session end, finalized plain text + structured segment JSON persisted to sessions table (`transcript`, `transcript_timestamps` columns). Retention tier auto-promoted to TRANSCRIPT.
`transcriptService.ts` orchestrates the pipeline, consuming `activeSessionId` from `sessionStore` (set by `sessionTracker`). `deepgramClient.ts` wraps the Deepgram WebSocket. `transcriptStore.ts` holds reactive UI state (segments, interim text, status).
API key (`EXPO_PUBLIC_DEEPGRAM_API_KEY`) is client-side for prototyping only — move behind backend auth before production.
Degradation: if WebSocket drops, status → `interrupted`, preserve existing transcript, stop capture (intentional v1 simplification).

### Speaker Attribution (Phase D.2)
Deepgram diarization (`diarize: true`) assigns speaker labels per word. `deepgramClient.ts` picks the dominant speaker per segment. `TranscriptSegment.speaker` holds the raw diarized label ("Speaker 0") — never mutated with display names.
`speakerService.ts` manages per-session mappings: diarized label → display name + confidence (provisional/user_confirmed). Default "Me" assignment is conditional: 1-2 speakers only, generic labels for 3+.
`speakerStore.ts` (Zustand) holds reactive mapping state. `LiveTranscript` resolves display names at render time. Tap speaker label → `SpeakerPicker` modal for correction.
`speaker_map TEXT` column on sessions table persists final mappings as JSON on session end.
`voice_profiles` table stores enrollment data (sample references, NULL embedding in D.2). `voiceProfileService.ensureProfileExists()` runs at startup (non-blocking, best-effort).

### Speaker Library (Phase D.3)
`speakerLibraryService.ts` owns cross-session speaker identity — separate from `speakerService` (session-scoped). `known_speakers` table (migrateToV5): `id`, `name UNIQUE`, `created_at`, `updated_at`, `last_seen_at`, `session_count`.
Name normalization: trim + collapse internal spaces + preserve casing. Applied on all writes. "Me" is never stored in the library.
`loadLibrary()` runs at app startup (non-blocking, after DB init). All writes are DB-first — cache updates only on DB success to prevent divergence.
`session_count` increments once per session at finalization (not per segment). Deduplicated via `Set` if multiple diarized labels map to the same name.
`SpeakerPicker` shows library names (recency order) between "Me" and custom input. On confirm, calls both `speakerService.reassignSpeaker()` and `speakerLibraryService.addSpeaker()` (skips "Me").
`NewSpeakerBanner` (presentational) shows inline pill in `LiveTranscript` when provisional non-"Me" speakers exist. Logic (unnamed count, tap target) lives in `LiveTranscript`. Unresolved speakers stay provisional in `speaker_map` if ignored during session — data ready for future post-session editing.

### Context Classification (Phase D.4)
`contextClassificationService.ts` classifies sessions as `solo` (1 speaker), `with_others` (2+ speakers, no presentation dominance), or `presentation` (1 speaker has 85%+ of segments with 3+ speakers total). Minimum 15 final segments before classification fires.
`sessionStore` holds live `sessionContext` + `sessionContextOverride`. Override is sticky — once the user manually selects a context, auto-classification stops for that session.
`SessionContextPill` in the session screen shows the detected context. Tap to override via Alert.alert picker.
`session_context` and `session_context_source` columns (migrateToV6) persist the final value on session end.

### Coaching Profiles (Phase D.5 v1)
`coachingProfileService.ts` has two layers: pure profile logic (computeProfileThresholds, getProfileLabel) and a thin orchestration coordinator (applyProfileForCurrentContext). Solo uses the user's Settings thresholds. With Others (0.7x/0.7x/0.65x/0.75x) and Presenting (3x uniform) are derived via per-threshold multipliers. Safety rails: floor/ceiling clamps + monotonic enforcement. Applied order: multiply → round → clamp → monotonic.
`applyProfileForCurrentContext()` is the single authority for threshold writes during sessions. Reads context from sessionStore, base from settingsStore, computes derived, compares with activeProfile, checks stability guard (5s), writes via BLE. Store updates only on successful write.
Session start → Solo baseline. Context change → derived profile. Manual override → immediate (bypass stability). Settings change during session → immediate recompute. Session end → restore Solo + clear profile (only on successful write). BLE reconnect → re-assert activeProfile or Solo.
`SessionContextPill` shows profile label: "Solo · Standard alerts", "With Others · Tighter alerts", "Presenting · Relaxed alerts".

### Post-Session Summaries (Phase D.6 v1)
`summaryService.ts` generates one AI summary per session on demand. `anthropicClient.ts` is a provider adapter that tries `@anthropic-ai/sdk` first and falls back to raw fetch on load failure. `summaryPrompts.ts` holds three context-aware system prompts (solo / with_others / presentation) plus the user-message assembler and deterministic truncation.
Eligibility rules: summary generates only when transcript exists, duration >= 30s, no summary already complete, and not currently generating. In-flight protection: `summary_status = 'generating'` blocks duplicate taps at both the service and UI level.
Model: Claude Haiku 4.5 via env var `EXPO_PUBLIC_ANTHROPIC_API_KEY`. Client-side for prototyping — flag before production. Upgrade to Sonnet is a single-constant change in `config/anthropic.ts`.
Truncation strategy: if transcript exceeds ~32K chars (~8K tokens), keep only the last 32K chars with a truncation marker. Metadata and alert events are always preserved in full.
`session_context_source` is preserved from D.4; summary prompts are selected by `session_context`.
`migrateToV7` adds `summary`, `summary_status`, `summary_generated_at` columns. Summary displays in the expanded session card in history with four states: button / generating / complete / failed (tap to retry).

### Session Detail & Transcript Review (Phase D.7 v1)
`app/app/session/[id].tsx` is a modal route (registered in `_layout.tsx`) presenting the full session review surface. Navigated via "View Details →" text link at the bottom of every expanded history card.
Screen sections: compact header (date/duration/context/alerts) → Transcript (dominant) → AI Summary (reuses D.6 logic) → Alert Timeline accordion (collapsed by default).
Transcript rendering: parse `transcriptTimestamps` → `TranscriptSegment[]`, parse `speakerMap` → `SpeakerMapping[]`, group consecutive same-speaker `isFinal` segments into named turns. Fallback chain: speaker turns → flat text → "No transcript" empty state.
No new services, no new DB functions, no new types. Pure UI ticket.

### Google Drive Backup (Phase D.8 v1)
App-mediated Google Drive OAuth 2.0 (PKCE code flow, no client_secret). Per-session Markdown export, refresh token persistence in `expo-secure-store`.
**Services:** `googleAuthService.ts` (token lifecycle: connect, refresh, disconnect, isConnected). `driveExportService.ts` (folder tree ops + idempotent upload + batch export). `sessionMarkdown.ts` (pure formatter — no DB/side effects).
**GCP:** project `rambling-guardian`, Google Drive API enabled, iOS OAuth Client ID `618204796187-dh47tmhn7p12lup9o7utqpm9l3f4vr99.apps.googleusercontent.com`, bundle ID `com.ccraig09.ramblingguardian`, reverse scheme `com.googleusercontent.apps.618204796187-dh47tmhn7p12lup9o7utqpm9l3f4vr99`.
**Drive folder tree:** `My Drive / Rambling Guardian Backups / Transcripts / YYYY / MM /`. "Backups" suffix avoids collision with user's other same-named project folders. `findFolder` scopes to `'root' in parents` when no explicit parent to prevent matching folders elsewhere in Drive. Scope: `drive.file` only (app sees only files it creates).
**Filename:** `YYYY-MM-DD_HH-MM_ctx_XXXXXXXX.md` where `XXXXXXXX` is the last 8 chars of session UUID — prevents filename collisions between same-minute same-context sessions.
**Idempotency:** Drive is source of truth, NOT the stored `drive_file_id`. `findOrUpsertMarkdownFile` always searches by filename with `trashed=false`; if found, PATCH content, else POST new. This sidesteps a silent-failure mode where Drive accepts PATCH on trashed files (returns 200, updates content, file stays in trash — invisible to user). `drive_file_id` is still written on upload for future optimization but never read for dedup decisions.
**`migrateToV8`** adds `drive_file_id TEXT` and `backup_status TEXT` columns. `BackupStatus = 'uploading' | 'complete' | 'failed' | null`.
**Filter behavior:** `exportAllSessions(onProgress, force)`. Default `force=false` filters out sessions with `backup_status='complete'` — fast repeat runs only process new/failed sessions. `force=true` re-uploads all sessions (recovery path for DB/Drive divergence). Per-session `exportSession(id)` always exports, bypassing filter.
**UI:** Settings → Cloud Backup has (1) primary "Back Up All Sessions" with live progress `N of M backed up…`, `Retry Failed Sessions` in alert red on partial/full failure; (2) secondary muted link "Re-upload all sessions (even ones already backed up)" — escape hatch; (3) Disconnect Google Drive. Session Detail → per-session "Export to Drive" button with `uploading`/`failed`/`complete` states.
**OAuth non-negotiables:** `Google.useAuthRequest` hook MUST live in React components (not service classes) — expo-auth-session React constraint. `shouldAutoExchangeCode: false` REQUIRED or the hook consumes the auth code internally before our service can exchange it (causing `invalid_grant`). Pass `request?.redirectUri` (not `makeRedirectUri(...)`) into the token exchange — the hook's redirectUri is authoritative. Token refresh silently disconnects on `invalid_grant` (password change, revocation).
**Build required:** `expo-auth-session`, `expo-web-browser`, `expo-secure-store` are all native — EAS build required (not Expo Go). OAuth consent screen is in "Testing" mode — only `carlos.craig09@gmail.com` can authorize until published.

### Battery Safe-Stop Sequence
When battery hits BATTERY_SHUTDOWN_PERCENT, battery_monitor publishes EVENT_BATTERY_CRITICAL. The event bus is synchronous, so all subscribers run before battery_monitor continues. capture_mode subscribes to this event and calls stopRecording() (which flushes WAV data via wavWriterClose() and session stats via sessionLoggerFlush()) before the event handler returns. A 2s delay before esp_deep_sleep_start() provides a provisional safety margin. **The event-bus subscription is the real safe-stop mechanism — the delay is a stopgap.** Future improvement: replace the fixed delay with a completion handshake where capture_mode sets a "flush complete" flag that battery_monitor checks before sleeping.

## Workflow Docs
- **Phase Plan:** `PHASE_PLAN.md` — living ticket checklist, current phase + all future phases
- **Agent Workflow:** `AGENT_WORKFLOW.md` — 5-step per-ticket process, skills table, personas
- **Selector Pass:** `SELECTOR_PASS_PROMPT.md` — pre-implementation checklist template
- **Smoke Tests:** `SMOKE_TESTS.md` — Phase A.1 verification checklist

## Key Docs (all in this repo)
- **Design Spec:** `docs/specs/2026-03-29-rambling-guardian-design.md` — original architecture (always-listening model, pre-D-pre)
- **Triggered Activation Brief:** `docs/specs/2026-04-07-triggered-activation-design.md` — idle-by-default model, session triggers, standalone backlog, BLE session control
- **Implementation Plan:** `docs/plans/2026-03-29-rambling-guardian-phase-a.md` — exact code for every task
- **Full Roadmap:** `docs/plans/2026-04-01-full-product-roadmap.md` — Phases A.5 through F with ticket details
- **Original Intake:** `docs/reference/original-intake.md` — founder call transcript/brief
- **Original PRD:** `docs/reference/original-prd.md` — previous attempt's full PRD
- **Hardware Guide:** `docs/reference/hardware-guide.md` — vendor sourcing, components, prototyping process

## Workflow
- Use `superpowers:subagent-driven-development` to execute the implementation plan
- Each task dispatches a fresh subagent with full task text from the plan
- Two-stage review after each task: spec compliance, then code quality
- Commit after every task. Push frequently. Git activity matters.
- Run `superpowers:requesting-code-review` BEFORE flashing firmware — never test unreviewed code

## User Context
- Carlos is a frontend developer (React Native/TypeScript) learning hardware for the first time
- Visual and experiential learner — use frontend analogies (GPIO = event listeners, loop() = render cycle)
- Has ADHD — keep pace, don't slow down, teach inline
- Owns: XIAO ESP32S3 Sense, SunFounder Kepler Kit (breadboard, wires, resistors, WS2812 strip, buttons, transistors), 400mAh LiPo battery, JST-PH 2.0 connectors, 25-pack tactile buttons, soldering kit, micro SD card

## Companion App (Phase C — complete)

React Native / Expo app at `app/`. Dark-first, indigo-tinted design system. All UI work requires `ui-mastery` skill.

### App Tech Stack
- Expo SDK 54, expo-router (file-based tabs + modal)
- expo-sqlite (WAL mode) — local persistence, no cloud DB
- expo-av — audio recording with real metering (`isMeteringEnabled: true`)
- expo-haptics — tactile feedback on step completion, ratings
- expo-notifications — local push only (no server)
- react-native-ble-plx — BLE connection to device
- zustand — state management (deviceStore, settingsStore)
- @expo/vector-icons (Ionicons) — must `npx expo install @expo/vector-icons`
- Plus Jakarta Sans — typeface via `@expo-google-fonts/plus-jakarta-sans`

### App Commands
```bash
cd app && npx expo start                           # start dev server
cd app && node node_modules/typescript/bin/tsc --noEmit  # type check (must run from app/)
npx expo install @expo/vector-icons               # add icons (not auto-included)
```

### App Architecture
- `app/src/theme/` — `useTheme()` hook, color palette, spacing, typography
- `app/src/db/` — SQLite schema, exercises, sessions, voiceSamples
- `app/src/stores/` — deviceStore (BLE state), settingsStore (preferences)
- `app/src/services/bleManager.ts` — singleton BLEService, auto-reconnect, 9 GATT characteristics
- `app/src/services/voiceRecorder.ts` — recording + playback + metering callbacks
- `app/src/services/sessionTracker.ts` — subscribes to deviceStore via Zustand, creates/finalizes sessions
- `app/src/components/ExerciseCard.tsx` — 4 states: collapsed / preview / active / completed
- `app/src/components/StepTimer.tsx` — countdown with pause/resume, visual urgency at ≤5s
- `app/src/components/StreakCalendar.tsx` — monthly calendar, tappable cells, skeleton loading
- `app/src/components/WaveformBars.tsx` — real audio metering (circular buffer), fallback random

### App Non-Negotiables
- **expo-file-system**: import from `expo-file-system/legacy` (not `expo-file-system`) in Expo 54
- **TypeScript**: run from `app/` directory — `node node_modules/typescript/bin/tsc --noEmit`
- **iOS builds**: local EAS only — `eas build --local --platform ios`, no cloud builds
- **DESIGN.md**: exists at repo root — reference for all UI decisions (brand, colors, tokens, components)
- **Session modes (C.5)**: deferred to Phase D — auto-detection needs speaker diarization; manual switching is ADHD-hostile
- **Skeleton loaders**: use `Animated.loop` opacity pulse instead of `ActivityIndicator` for initial loads
- **BLE GATT UUIDs**: `4A980001–4A98000B` (service + 10 characteristics) — see `config.h`
- **BLE Session Control**: `4A98000B` — Read+Write+Notify. Write 0x01=start session, 0x02=stop. Read/Notify: 0x00=idle, 0x01=active.
- **BLE Sync Data**: `4A98000C` — Read+Write+Notify. Backlog sync protocol: 0x01=manifest, 0x02=next record, 0x03=ack, 0x04=commit.
- **PAUSE_THRESHOLD_MS**: 3000ms (tuned on device — 1200ms too sensitive, 5000ms too slow)
- **Deepgram API key**: `EXPO_PUBLIC_DEEPGRAM_API_KEY` env var. Client-side prototyping only — do not ship to TestFlight without reviewing security model.
- **react-native-live-audio-stream**: requires EAS build (not Expo Go). 16kHz/mono/16-bit PCM. `wavFile: ''` required in init options (unused — streaming to Deepgram).
- **Deepgram WebSocket auth**: must use `Authorization: Token KEY` header. Token query param does NOT work on iOS RN 0.81.
- **Google OAuth**: `Google.useAuthRequest` hook MUST stay in React components (not service classes). Set `shouldAutoExchangeCode: false` — hook consumes code internally otherwise, causing `invalid_grant`. Use `request?.redirectUri` from the hook for token exchange, not `makeRedirectUri()`. `expo-auth-session`, `expo-web-browser`, `expo-secure-store` require EAS build.
- **Google Drive scope**: `drive.file` only — app can only see files it creates. Never request broader scopes.
- **Drive idempotency**: Always search by filename (`trashed=false`) to find existing files — never trust a stored file ID. Drive accepts PATCH on trashed files (returns 200, content updates, file stays in trash) which causes silent invisible-success failures.

## IDE / Tooling Notes
- **LSP diagnostics are always false positives** — clang has no Arduino headers; `Serial`, `millis()`, `I2SClass` etc. always show as errors in the IDE. Ignore them. `arduino-cli compile` is the only truth.
- **GitHub milestones:** `gh milestone` is not a valid CLI command — use `gh api repos/{owner}/{repo}/milestones` instead.

## Learning Materials (NotebookLM)
- Notebook: "Rambling Guardian - Hardware Setup for Visual Learners" (ID: `497bb0ca-4dec-4c34-85e9-1d9e2b3071f3`)
- **DO NOT generate ANY NotebookLM materials during phase work** — no infographics, no videos, no hardware guides
- One collective dump at final phase only
- For hardware wiring: use ASCII diagrams in chat (NotebookLM images get pin counts wrong)

## Module Patterns
| Module | Init | Update | Pattern |
|--------|------|--------|---------|
| audio_input | Y | Y | I2S reader + VAD, suspend/resume on mode change, re-calibrates on resume |
| speech_timer | Y | Y | Event subscriber, tracks speech duration |
| led_output | Y | Y | Event subscriber, LED animation loop, capture override → magenta |
| button_input | Y | Y | GPIO poller, debounce, multi-tap detection |
| mode_manager | Y | N | Event subscriber, session lifecycle (IDLE↔ACTIVE_SESSION), trigger validation |
| battery_monitor | Y | Y | ADC poller, low battery events |
| sd_card | Y | N | Init-only, exposes sdCardIsReady() utility |
| wav_writer | N | N | Utility API — open/write/close, called by capture_mode |
| capture_mode | Y | Y | State machine (IDLE/RECORDING), feeds audio to wav_writer |
| session_logger | Y | N | Event subscriber, accumulates stats, appends to backlog on SESSION_STOPPED |
| vibration_output | Y | Y | Event subscriber, PWM patterns per alert level + session confirmation haptics |
| boot_state | Y | N | Persists monotonic boot ID to SD, tracks per-boot session sequence |
| backlog | Y | N | Versioned binary backlog (32-byte records), in-memory cache, compaction, sync checkpoint |

## Non-Negotiables
- Every task gets a git commit with conventional commit message
- Push to GitHub after every 2-3 tasks minimum
- Never skip the event bus pattern — all modules communicate via events
- Energy-based VAD for MVP (ESP-SR VADNet requires ESP-IDF, deferred to later phase)
- Battery safety: JST connector only, never solder battery directly, respect polarity
