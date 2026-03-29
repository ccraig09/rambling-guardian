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

## Design Spec
See: ../word-shepherd/docs/superpowers/specs/2026-03-29-rambling-guardian-design.md

## Implementation Plan
See: ../word-shepherd/docs/superpowers/plans/2026-03-29-rambling-guardian-phase-a.md
