# Rambling Guardian

Wearable ADHD speech-duration monitor built on XIAO ESP32S3 Sense.

## Tech Stack
- Board: Seeed XIAO ESP32S3 Sense
- Language: C++ (Arduino IDE)
- Audio: I2S PDM microphone (GPIO 41/42)
- LED: Built-in RGB via `rgbLedWrite()` (ESP32 Board Package — no external library needed)
- Architecture: Event-driven (pub/sub event bus)

## Pin Assignments
| Pin | Purpose |
|-----|---------|
| GPIO 41 | Microphone Data In (I2S PDM) — built-in, do not reassign |
| GPIO 42 | Microphone Clock (I2S PDM) — built-in, do not reassign |
| GPIO 21 | SD Card CS — built-in, do not reassign |
| GPIO 1 (D0) | NeoPixel RGB LED data |
| GPIO 2 (D1) | Tactile button input (10kΩ pull-up to 3.3V) |
| GPIO 3 (D2) | Reserved for vibration motor (Phase B) |

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

## Architecture
Modules communicate via event bus only — never call each other directly.
Audio → VAD → SpeechTimer → EventBus → LED/Vibration/BLE subscribers.
Debug serial prints are gated by `#define DEBUG_AUDIO` in config.h (commented out by default)

## Workflow Docs
- **Phase Plan:** `PHASE_PLAN.md` — living ticket checklist, current phase + all future phases
- **Agent Workflow:** `AGENT_WORKFLOW.md` — 5-step per-ticket process, skills table, personas
- **Selector Pass:** `SELECTOR_PASS_PROMPT.md` — pre-implementation checklist template
- **Smoke Tests:** `SMOKE_TESTS.md` — Phase A.1 verification checklist

## Key Docs (all in this repo)
- **Design Spec:** `docs/specs/2026-03-29-rambling-guardian-design.md` — full architecture, edge cases, all 5 phases
- **Implementation Plan:** `docs/plans/2026-03-29-rambling-guardian-phase-a.md` — exact code for every task
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

## Non-Negotiables
- Every task gets a git commit with conventional commit message
- Push to GitHub after every 2-3 tasks minimum
- Never skip the event bus pattern — all modules communicate via events
- Energy-based VAD for MVP (ESP-SR VADNet requires ESP-IDF, deferred to later phase)
- Battery safety: JST connector only, never solder battery directly, respect polarity
