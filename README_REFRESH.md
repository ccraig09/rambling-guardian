# Rambling Guardian

Wearable speech-awareness and coaching system built on **Seeed XIAO ESP32S3 Sense** with a connected **React Native Expo companion app**.

Rambling Guardian is no longer just a firmware prototype. The product now has:
- on-device speech-duration monitoring
- LED + vibration alerts
- BLE companion app
- live session dashboard
- local history and analytics
- settings + threshold configuration
- voice-training exercises
- manual capture mode with SD-backed recording

## Current product position

The project is in **late Phase C**:
- firmware + app are working
- the next priority is **hardening** before AI coaching work
- the biggest remaining areas are reconnect/resync reliability, persistence, session semantics, battery truth, and power profiling

## Core behavior

The wearable monitors continuous speech and escalates alerts:
- **Green** breathing: all clear
- **Yellow**: gentle nudge
- **Orange**: time to wrap up
- **Red**: urgent
- **Blinking red**: critical

The phone app is the companion surface for:
- connection state
- history/review
- exercises
- settings
- future coaching/insights

## Hardware

### Current components
- Seeed XIAO ESP32S3 Sense
- built-in PDM microphone
- built-in RGB LED
- tactile push button
- vibration motor
- LiPo battery
- SD card support for manual capture mode

### Wiring notes
- button on D1 / GPIO 2
- vibration motor on D2 / GPIO 3
- battery ADC on D3 / GPIO 4 via divider
- built-in mic on GPIO 41 / 42

## Button controls

- **Single press**: toggle Monitoring ↔ Presentation mode
- **Double press**: start/stop manual capture mode
- **Triple press**: cycle alert modality (both, LED-only, vibration-only)
- **Long press**: enter deep sleep

## Modes

### Monitoring
Normal guardian mode. The device tracks continuous speaking duration and issues alerts.

### Presentation
Suppresses normal alerting so intentional long-form speaking does not feel like rambling.

### Manual capture
Explicit recording mode for saved voice notes, memories, or intentional captures.

### Deep sleep
Power-saving state entered manually or later by battery protection logic.

## Architecture

The firmware uses an event-driven pub/sub design so modules stay decoupled.

Examples:
- Audio input publishes speech started / ended events
- Speech timer publishes alert-level changes
- LED/vibration/BLE/session logging react to events
- Button input publishes user-intent events to mode/capture logic

## Companion app surfaces

### Home
Quick daily context, exercises, and device connection summary.

### Session
Live BLE dashboard for current speech duration, alert state, battery, and device stats.

### Exercises
Offline exercise library, daily practice, streaks, favorites, and active exercise flow.

### History
Recent sessions, timelines, analytics, and later coaching entry point.

### Settings
Thresholds, modality, reminders, and product/device information.

## Product principles

- **Device first**: the wearable should keep working even when the phone is absent.
- **Phone as companion**: the phone should catch up later and present review/coaching clearly.
- **Metadata always, audio selectively**: keep summaries/events by default, keep full audio only when it is intentional or explicitly preserved.
- **Hardening before AI**: Phase D coaching depends on clean sync and trustworthy session semantics.

## Known hardening priorities

- reconnect/resync without app restarts
- persistent settings + thresholds
- synced-from-device backlog import
- history timestamp correctness
- calendar layout bug in exercises/streak screen
- battery calibration + safe-stop recording behavior
- power profiling for portable battery sizing

## Audio retention direction

Raw 16 kHz / 16-bit mono audio is too heavy for all-day default storage.

Planned policy:
- always keep session metadata
- keep manual notes in full until deleted
- keep flagged clips optionally
- prompt user after long meetings or valuable captures:
  - keep summary only
  - keep summary + key clips
  - keep full audio
  - delete audio and keep metadata

## Battery behavior direction

The device should not abruptly die mid-meeting if it can safely flush state first.

Planned behavior:
- warn in low battery zone
- avoid starting long manual recordings when battery is already too low
- on critical battery, safely close files and persist session/sync state before protected shutdown

## Build + flash

1. Install Arduino IDE 2.x
2. Add ESP32 board support
3. Select XIAO ESP32S3
4. Select OPI PSRAM
5. Select partition scheme appropriate for current firmware size
6. Upload over USB-C

## Next step

Before Phase D, complete **Phase C hardening**: persistence, reconnect/resync, battery truth, session semantics, sync backlog model, and test coverage.

## License

MIT
