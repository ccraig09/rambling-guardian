# Rambling Guardian

Wearable ADHD speech-duration monitor. A clip-on device tracks how long you've been talking and nudges you with escalating LED and vibration alerts before you lose your audience.

**Status:** Late Phase C — companion app and BLE integration complete, hardening in progress. Not yet released.

## How It Works

The device listens for continuous speech via a PDM microphone and energy-based VAD (voice activity detection). When speech exceeds configurable thresholds, it alerts with escalating intensity:

| Level | Default | LED | Vibration |
|-------|---------|-----|-----------|
| Gentle | 7 s | Yellow | Short pulse |
| Moderate | 15 s | Orange | Double pulse |
| Urgent | 30 s | Red | Triple pulse |
| Critical | 60 s | Red blink | Continuous |

Thresholds and alert modality (LED only, vibration only, or both) are configurable from the companion app.

## Hardware

- **Board:** Seeed XIAO ESP32S3 Sense
- **Microphone:** Built-in I2S PDM (GPIO 41/42)
- **LED:** Built-in RGB via `rgbLedWrite()`
- **Vibration:** Motor on GPIO 3 via S8050 NPN transistor
- **Button:** Tactile on GPIO 2 (10kΩ pull-up to 3.3V)
- **Battery:** 400mAh LiPo via JST-PH 2.0 connector
- **Battery ADC:** GPIO 4 (100kΩ/100kΩ voltage divider)
- **SD Card:** Built-in micro SD slot (GPIO 21 CS, FAT32)

### Button Controls

| Action | Function |
|--------|----------|
| Single press | Toggle monitoring / presentation mode |
| Double tap | Start/stop voice capture to SD card |
| Triple press | Cycle alert modality (LED / vibration / both) |
| Long press (3 s) | Deep sleep (press again to wake) |

## Companion App

React Native / Expo app providing:

- **Voice trainer** — 55 guided exercises across 4 categories (warmup, breathing, articulation, speech), with streaks, daily rotation, favorites, and real audio recording
- **Real-time dashboard** — live BLE connection to device showing speech duration, alert level, battery, and session stats
- **Session history** — per-session analytics with alert timelines and lifetime stats
- **Settings** — sensitivity, alert thresholds, alert modality, notification preferences, all persisted to SQLite

### App Tech Stack

- React Native / Expo (SDK 54, file-based routing via expo-router)
- SQLite (expo-sqlite, WAL mode) for local persistence
- BLE communication via react-native-ble-plx
- Zustand for state management
- Local notifications via expo-notifications

### Known Limitations

- **Sessions = BLE connection windows**, not conversations. A single conversation spanning a reconnect creates two session entries. A future update will group connection windows into user-facing conversations.
- **No cloud sync** — all data is local to the phone. Cloud backup is planned for Phase D.
- **Energy-based VAD** — detects sound energy, not speech specifically. Background noise above the adaptive threshold will register as speech. ML-based VAD (ESP-SR) is deferred to a future phase.
- **No speaker diarization** — the device does not distinguish who is speaking. Session modes (solo/group) require manual selection, which is deferred until auto-detection is available.

## Architecture

Event-driven pub/sub on the firmware side — modules never call each other directly:

```
Audio Input → [EVENT_SPEECH_STARTED/ENDED] → Speech Timer
Speech Timer → [EVENT_ALERT_LEVEL_CHANGED] → LED Output, Vibration Output, BLE
Button Input → [EVENT_BUTTON_*] → Mode Manager, Capture Mode
Battery Monitor → [EVENT_BATTERY_LOW/CRITICAL] → LED Output, Capture Mode
```

Capture mode subscribes to `EVENT_BATTERY_CRITICAL` to safely flush WAV and session data before the device enters deep sleep.

## Build & Flash

### Arduino IDE

1. Board: **XIAO_ESP32S3** (Espressif ESP32 package)
2. PSRAM: **OPI PSRAM**
3. Partition: **Huge APP (3MB No OTA/1MB SPIFFS)**
4. Upload via USB-C, serial monitor at 115200 baud

### CLI

```bash
arduino-cli compile --fqbn esp32:esp32:XIAO_ESP32S3:PSRAM=opi .
```

### Companion App

```bash
cd app && npx expo start
```

## Project Direction

Rambling Guardian is a personal tool — device-first monitoring with a phone companion for configuration, training, and review. Future phases include cloud backup (Google Drive), real-time transcription with speaker detection, AI coaching insights, and a dictation mode. See `PHASE_PLAN.md` for the full roadmap.

## License

MIT
