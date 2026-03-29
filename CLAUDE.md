# Rambling Guardian

Wearable ADHD speech-duration monitor built on XIAO ESP32S3 Sense.

## Tech Stack
- Board: Seeed XIAO ESP32S3 Sense
- Language: C++ (Arduino IDE)
- Audio: I2S PDM microphone (GPIO 41/42)
- LED: WS2812B NeoPixel (Adafruit NeoPixel library)
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

## Architecture
Modules communicate via event bus only — never call each other directly.
Audio → VAD → SpeechTimer → EventBus → LED/Vibration/BLE subscribers.

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

## User Context
- Carlos is a frontend developer (React Native/TypeScript) learning hardware for the first time
- Visual and experiential learner — use frontend analogies (GPIO = event listeners, loop() = render cycle)
- Has ADHD — keep pace, don't slow down, teach inline
- Owns: XIAO ESP32S3 Sense, SunFounder Kepler Kit (breadboard, wires, resistors, WS2812 strip, buttons, transistors), 400mAh LiPo battery, JST-PH 2.0 connectors, 25-pack tactile buttons, soldering kit, micro SD card

## Non-Negotiables
- Every task gets a git commit with conventional commit message
- Push to GitHub after every 2-3 tasks minimum
- Never skip the event bus pattern — all modules communicate via events
- Energy-based VAD for MVP (ESP-SR VADNet requires ESP-IDF, deferred to later phase)
- Battery safety: JST connector only, never solder battery directly, respect polarity
