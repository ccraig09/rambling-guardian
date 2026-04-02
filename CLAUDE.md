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
Build size after Phase A.5: 430KB flash (12%), 34KB RAM (10%) — baseline for tracking bloat.

## Architecture
Modules communicate via event bus only — never call each other directly.
Audio → VAD → SpeechTimer → EventBus → LED/Vibration/BLE subscribers.
SD card recording: EVENT_BUTTON_DOUBLE → CaptureMode → WavWriter → SD card. Auto-stops after 5s silence.
New events (A.5): EVENT_SD_READY, EVENT_CAPTURE_STARTED, EVENT_CAPTURE_STOPPED
Utility modules (wav_writer, sd_card) are called directly — they're stateless helpers, not event subscribers.
audioGetLastSamples() exposes raw I2S samples for recording — shared buffer with VAD energy calculation.
Debug serial prints are gated by `#define DEBUG_AUDIO` in config.h (commented out by default)
VAD auto-calibrates on boot (~6s): 5 warmup + 30 measurement windows × 200ms. Serial: `[Audio] Calibrated: ambient=XX, threshold=YY`
Sensitivity levels (0–3) apply multipliers { 1, 2, 4, 8 } on calibrated baseline. Threshold capped at 80 — safe to boot mid-meeting.

## Workflow Docs
- **Phase Plan:** `PHASE_PLAN.md` — living ticket checklist, current phase + all future phases
- **Agent Workflow:** `AGENT_WORKFLOW.md` — 5-step per-ticket process, skills table, personas
- **Selector Pass:** `SELECTOR_PASS_PROMPT.md` — pre-implementation checklist template
- **Smoke Tests:** `SMOKE_TESTS.md` — Phase A.1 verification checklist

## Key Docs (all in this repo)
- **Design Spec:** `docs/specs/2026-03-29-rambling-guardian-design.md` — full architecture, edge cases, all 5 phases
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

## Future Companion App

A React Native companion app is planned (see Design Spec Phase D). When that work begins:
- Use `ui-mastery` skill for all UI tickets
- Reference `~/Workspace/.design-kb/10-mobile-patterns.md` for React Native patterns
- Add a `DESIGN.md` to this repo to capture the companion app's brand personality

## IDE / Tooling Notes
- **LSP diagnostics are always false positives** — clang has no Arduino headers; `Serial`, `millis()`, `I2SClass` etc. always show as errors in the IDE. Ignore them. `arduino-cli compile` is the only truth.
- **GitHub milestones:** `gh milestone` is not a valid CLI command — use `gh api repos/{owner}/{repo}/milestones` instead.

## Learning Materials (NotebookLM)
- Notebook: "Rambling Guardian - Hardware Setup for Visual Learners" (ID: `497bb0ca-4dec-4c34-85e9-1d9e2b3071f3`)
- **C++ learning materials** — skip per-phase updates, generate as single teaching session at project end
- **Hardware wiring guides** — DO generate before each phase that adds physical components (button, motor, etc.)

## Module Patterns
| Module | Init | Update | Pattern |
|--------|------|--------|---------|
| audio_input | Y | Y | I2S reader + VAD, exposes samples via audioGetLastSamples() |
| speech_timer | Y | Y | Event subscriber, tracks speech duration |
| led_output | Y | Y | Event subscriber, LED animation loop, capture override → magenta |
| button_input | Y | Y | GPIO poller, debounce, multi-tap detection |
| mode_manager | Y | N | Event subscriber only (button → mode changes) |
| battery_monitor | Y | Y | ADC poller, low battery events |
| sd_card | Y | N | Init-only, exposes sdCardIsReady() utility |
| wav_writer | N | N | Utility API — open/write/close, called by capture_mode |
| capture_mode | Y | Y | State machine (IDLE/RECORDING), feeds audio to wav_writer |
| session_logger | Y | N | Event subscriber, accumulates stats, flush-on-demand to CSV |

## Non-Negotiables
- Every task gets a git commit with conventional commit message
- Push to GitHub after every 2-3 tasks minimum
- Never skip the event bus pattern — all modules communicate via events
- Energy-based VAD for MVP (ESP-SR VADNet requires ESP-IDF, deferred to later phase)
- Battery safety: JST connector only, never solder battery directly, respect polarity
