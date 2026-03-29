# Rambling Guardian — Design Specification

**Date:** 2026-03-29
**Project:** Personal Recording Multitool (Reboot)
**Board:** Seeed XIAO ESP32S3 Sense
**Language:** C++ via Arduino IDE / ESP-IDF
**Status:** Design approved, pending implementation plan

---

## 1. Vision

A wearable voice companion that detects rambling in real-time and alerts the wearer through escalating visual/haptic feedback. Built on a thumb-sized ESP32S3 board with a built-in microphone, it starts as a rambling detector and grows into a multi-function device: voice note capture, Wispr Flow-style dictation, and AI-powered ADHD coaching.

**Why this exists:** ADHD adults produce ~500 more words per session than neurotypical peers. No existing product monitors speech duration as a coaching tool. This device is the first.

**Design philosophy:** Start with A, design for C. Every phase ships a working device. The event-driven architecture means adding BLE, vibration, or dictation is plugging in a new subscriber — never a rewrite.

---

## 2. Three Device Modes

### Guardian Mode (default, always-on)
- VADNet detects speech continuously (~20mA idle draw)
- Speech timer tracks continuous talking duration
- Resets when pause exceeds 1.2 seconds
- Escalating LED alerts: green (safe) → yellow (7s) → orange (15s) → red (30s) → red blink (60s+)
- No button press needed to start — auto-activates on boot

### Capture Mode (triggered)
- Double-press button to start recording voice note
- Audio saved as WAV to SD card (16kHz mono, sufficient for speech)
- LED blue while recording
- Auto-stops after 5 seconds of silence
- Guardian mode remains active underneath — rambling during a note still triggers alerts

### Dictate Mode (Phase D)
- Triple-press button to start dictation
- Audio streams via BLE to companion app
- App sends to cloud: Whisper STT → Claude cleanup (filler removal, punctuation, course corrections)
- Polished text returned to app clipboard, or typed directly via BLE HID keyboard profile
- LED magenta while dictating

---

## 3. System Architecture

```
INPUT LAYER (event listeners)
├── Microphone (I2S → GPIO 41/42) — continuous audio stream
└── Button (GPIO pin) — tap patterns: single/double/triple/long

    ↓ raw audio

PROCESSING LAYER (middleware)
├── Noise Suppression (ESP-SR AFE) — filters non-voice audio
└── VADNet (neural network) — speech vs silence detection
    Trained on 15,000 hours (English, Chinese, multilingual)

    ↓ speech_started / speech_ended events

CORE LOGIC (state manager)
├── Speech Timer — tracks continuous duration, resets on pause > 1.2s
├── Alert Escalator — 7s GENTLE → 15s MODERATE → 30s URGENT → 60s CRITICAL
├── Mode Manager — MONITORING | CAPTURE | PRESENTATION | DICTATE | DEEP_SLEEP
└── Session Tracker — logs alert counts, durations, timestamps

    ↓ alert_level_changed event (published to event bus)

OUTPUT LAYER (subscriber components — add without touching core)
├── [Phase A]  LED Output — color/pattern maps to alert level
├── [Phase A.5] SD Card Writer — WAV recording + session metadata CSV
├── [Phase B]  Vibration Output — PWM-driven motor, escalating intensity
├── [Phase C]  BLE Output — GATT notifications to companion app
├── [Phase D]  BLE Audio Stream — real-time audio to app for dictation
└── [Phase D]  BLE HID Keyboard — type directly into Mac/PC (alternative)
```

**Architecture pattern:** ESP-IDF Event Loop — equivalent to `addEventListener` for microcontrollers. Each output module registers a handler for `alert_level_changed` events. Adding a new output means writing one new handler function and calling `esp_event_handler_register_with()`. No existing code is modified.

---

## 4. Detection Algorithm

### Voice Activity Detection
- **Engine:** Espressif VADNet (neural network, included in ESP-SR AFE)
- **Configuration:**
  - `vad_mode`: 2 (balanced sensitivity — configurable via button combo)
  - `vad_min_speech_ms`: 128ms (minimum speech to trigger)
  - `vad_min_noise_ms`: 1000ms (minimum silence to confirm pause)
  - `vad_delay_ms`: 128ms (algorithmic delay before speech data output)

### Speech Timer Logic
```
on SPEECH_STARTED:
  if timer not running:
    start timer
    current_level = NONE

on SPEECH_ENDED:
  start pause_timer(1200ms)  // 1.2 second debounce

on PAUSE_TIMER_EXPIRED:
  if still silent:
    reset speech timer
    emit alert_level_changed(NONE)  // back to green

on TIMER_TICK (every 100ms):
  elapsed = now - speech_start_time
  new_level = calculate_level(elapsed)
  if new_level != current_level:
    current_level = new_level
    emit alert_level_changed(new_level)
```

### Alert Levels
| Elapsed | Level | LED Color | Vibration (Phase B) | Meaning |
|---------|-------|-----------|---------------------|---------|
| 0-6s | NONE | Dim green pulse | — | You're fine |
| 7-14s | GENTLE | Solid yellow | Single soft pulse | Heads up |
| 15-29s | MODERATE | Solid orange | Double pulse every 3s | Wrap it up |
| 30-59s | URGENT | Solid red | Continuous gentle buzz | You're rambling |
| 60s+ | CRITICAL | Red blink (1Hz) | Strong intermittent buzz | Stop talking |

### Pause Threshold: Why 1.2 Seconds
- ADHD speech research shows disfluencies are brief (< 1 second)
- Natural breath pauses: 0.3-0.8 seconds
- Conversational turn-taking pauses: 0.7-1.5 seconds
- 1.2s catches the gap between "rapid-fire ADHD speech" and "natural conversation turn"
- Configurable: user can adjust via companion app in Phase C

---

## 5. Hardware Design

### Components — Phase A MVP
| Component | Specification | Purpose | Est. Cost |
|-----------|--------------|---------|-----------|
| XIAO ESP32S3 Sense | Dual-core 240MHz, 8MB PSRAM, 8MB Flash, built-in mic + SD slot | Main board | $13 (already owned) |
| RGB LED (WS2812B / NeoPixel) | Addressable, single wire | Alert output | $2 |
| Tactile button | 6mm through-hole | Mode toggle | $0.50 |
| LiPo battery | 3.7V 540mAh with JST-PH 2.0 + protection circuit | Power | $8 |
| MicroSD card | 32GB max | Audio storage | Already owned |
| Resistors | 10kΩ pull-up for button | Debounce | $0.10 |
| Enclosure | 3D printed or small project box | Housing | $5-10 |
| Wires + headers | Dupont/jumper wires for prototyping | Connections | $3 |

**Total MVP cost: ~$27 (or ~$14 if you already have the board + SD card)**

### Additional for Phase B
| Component | Purpose | Est. Cost |
|-----------|---------|-----------|
| Coin vibration motor | Haptic feedback | $3 |
| NPN transistor (2N2222) | Motor driver (GPIO can't power motor directly) | $0.50 |
| Diode (1N4001) | Flyback protection for motor | $0.10 |

### Pin Assignments
```
GPIO 41 (D11) — Microphone Data In (I2S)     [built-in, do not use]
GPIO 42 (D12) — Microphone Word Select (I2S)  [built-in, do not use]
GPIO 21       — SD Card CS                     [built-in, do not use]
GPIO 1  (D0)  — RGB LED data (NeoPixel)
GPIO 2  (D1)  — Tactile button input (with 10kΩ pull-up)
GPIO 3  (D2)  — Vibration motor (via transistor) [Phase B]
GPIO 4  (D3)  — Reserved for future use
```

### Wiring Diagram (Text)
```
XIAO ESP32S3 Sense
┌─────────────────┐
│  [USB-C]        │
│                 │
│ D0 ──────────── RGB LED data in
│                 │     └── LED VCC → 3.3V
│                 │     └── LED GND → GND
│                 │
│ D1 ──┬──[10kΩ]── 3.3V   (pull-up)
│      └── Button ── GND
│                 │
│ D2 ──[1kΩ]──┬── 2N2222 Base     [Phase B]
│              │   Collector ── Motor(−)
│              │   Emitter ── GND
│              │   Motor(+) ── 3.3V
│              │   [1N4001 across motor]
│                 │
│ BAT+ ─── LiPo (+)
│ BAT− ─── LiPo (−)  ⚠️ (−) closest to USB port!
│                 │
│ [Built-in Mic]  │  GPIO 41/42 — do not reassign
│ [Built-in SD]   │  GPIO 21 — do not reassign
└─────────────────┘
```

---

## 6. Battery Management

### Safety Rules (Non-Negotiable)
- Use LiPo WITH protection circuit module (PCM) — all recommended batteries include this
- **Polarity:** Negative (−) closest to USB port, Positive (+) away from USB port
- Use JST-PH 2.0 connector — NEVER solder battery directly to board
- Never charge unattended overnight (until build is trusted)
- Never puncture, bend, or crush the LiPo pouch
- Store at 50% charge if unused for weeks
- Keep away from metal objects (keys, coins)

### Power States
| State | Current Draw | Battery Life (540mAh) | Battery Life (1200mAh) |
|-------|-------------|----------------------|----------------------|
| Deep sleep | ~14μA | Months | Months |
| Monitoring (VAD + LED) | ~100-150mA | 3.5-5 hours | 8-12 hours |
| Recording (VAD + LED + SD write) | ~180-200mA | 2.5-3 hours | 6-7 hours |
| BLE active (Phase C) | ~150-200mA | 2.5-3.5 hours | 6-8 hours |

### Firmware Battery Logic
- Read battery voltage via ADC periodically (every 60s)
- At 15%: reduce LED brightness to conserve power
- At 10%: blink orange 3x every 30 seconds ("charge me")
- At 5%: save session data to SD, red fade, enter deep sleep
- On USB plug-in: auto-wake from deep sleep, LED shows charging (breathing cyan)

---

## 7. Button Interaction Design

| Gesture | Action | LED Feedback |
|---------|--------|-------------|
| Single press | Toggle MONITORING ↔ PRESENTATION mode | Flash mode color once |
| Double press | Start/stop voice note recording (Capture mode) | Blue while recording |
| Long press (3s) | Enter/exit deep sleep | Red fade out / green fade in |
| Double tap (in monitoring) | Cycle VAD sensitivity (mode 1→2→3→4→1) | Flash white N times for mode N |
| Triple press | Reserved: Phase C BLE reconnect / Phase D dictation | Magenta flash |

### Button Debounce
- Hardware: 10kΩ pull-up resistor
- Software: 50ms debounce window, 300ms multi-tap detection window
- Like `lodash.debounce()` but in firmware

---

## 8. Edge Cases

### Speech Detection
| Scenario | Handling |
|----------|---------|
| Other people talking nearby | MVP: triggers timer too (proximity = mostly you). Phase C: Personal VAD isolates your voice. |
| Background TV/music | ESP-SR Noise Suppression filters non-voice audio. Talk radio/podcasts may trigger — use presentation mode. |
| Laughing, coughing | VADNet classifies as non-speech. Brief bursts (<1s) filtered. Won't reach 7s threshold. |
| Whispering | Configurable VAD sensitivity (modes 1-4). Mode 2 default catches normal conversation volume. |
| Phone calls | Other person's voice picked up from speaker. Turn-taking resets timer naturally. Actually useful — catches call domination. |
| Talking to yourself alone | Intentionally triggers. ADHD rumination spirals are real — gentle nudge is helpful. Disable with presentation mode if unwanted. |
| Driving with road noise | ESP-SR handles ambient noise. Passenger conversation works normally. Singing may trigger — embrace or presentation mode. |
| Meetings where you should present | Single-press → presentation mode. Alerts suppressed, blue LED confirms active-but-quiet. |

### Hardware / Power
| Scenario | Handling |
|----------|---------|
| Battery dies mid-conversation | Graceful: 10% warning → 5% save + shutdown. Protection circuit prevents over-discharge below 3.0V. |
| Device overheating | ESP32S3 throttles at 85°C (well before danger). Enclosure should have ventilation. Normal operating: 30-40°C. |
| Water/sweat | MVP enclosure is not waterproof. Keep mic opening clear. Future: conformal coating + acoustic vent for IPX4. |
| SD card full | Auto-rotate: delete oldest files when card reaches 90% capacity. |
| SD card missing | Degrade gracefully: monitoring works, recording disabled, LED flashes white on record attempt to indicate no storage. |
| Firmware needs updating | MVP: USB-C cable to computer, flash via Arduino IDE. Phase C: OTA updates via BLE from companion app. |

### User Experience
| Scenario | Handling |
|----------|---------|
| Alert fatigue | LED-only is gentle — ignorable. Escalation gives grace. Thresholds configurable (Phase C via app). |
| Forgets to charge | Low-battery warnings start at 15%. Device gracefully sleeps — no data loss. |
| Forgets to turn on | ALWAYS ON by default. Boot → monitoring. No start button. Only deep sleep requires manual wake. |
| Embarrassment from visible LED | LED placement inside enclosure with diffuser. Others see a soft glow, not a traffic light. Discuss form factor in implementation. |

---

## 9. Phase Roadmap

### Phase A — Rambling Guardian MVP
**Goal:** Detect continuous speech and alert with escalating LED colors.
**Deliverables:**
- Arduino IDE project setup with ESP-IDF components
- I2S microphone input → ESP-SR AFE → VADNet
- Speech timer with 1.2s pause threshold
- Alert escalator (NONE → GENTLE → MODERATE → URGENT → CRITICAL)
- Event bus architecture (ESP-IDF Event Loop)
- LED output subscriber (NeoPixel RGB)
- Button input with debounce and gesture detection
- Mode manager (MONITORING, PRESENTATION, DEEP_SLEEP)
- Battery voltage monitoring + graceful shutdown
- **Learning:** Arduino IDE, C++ basics, I2S audio, GPIO, state machines, event-driven architecture

### Phase A.5 — Voice Note Capture
**Goal:** Record voice notes to SD card on demand.
**Deliverables:**
- SD card initialization and WAV file writing
- Double-press button → start recording
- Auto-stop on 5s silence (reuses VAD)
- Session metadata CSV (timestamps, alert counts, durations)
- File rotation when SD card nears capacity
- **Learning:** SD card I/O, WAV encoding, audio buffering, FreeRTOS task management

### Phase B — Haptic Feedback
**Goal:** Add vibration motor as an additional alert output.
**Deliverables:**
- Wire vibration motor with transistor driver
- Vibration output subscriber (PWM patterns)
- Escalating haptic patterns matching LED levels
- **Learning:** PWM control, transistor switching, haptic design, soldering on small boards

### Phase C — BLE Companion App
**Goal:** Connect device to phone for real-time status, session history, and configuration.
**Deliverables:**
- NimBLE GATT peripheral on device (custom service UUID)
- Characteristics: alert_level, session_stats, device_mode, battery_level, vad_sensitivity
- React Native app with react-native-ble-plx
- Real-time alert display on phone
- Session history + analytics dashboard
- Voice note transfer (SD → BLE → app → cloud)
- iOS notifications → automatic Apple Watch forwarding
- Personal VAD voice enrollment (speaker-conditioned detection)
- OTA firmware updates via BLE
- Threshold configuration from app
- **Learning:** BLE GATT, NimBLE, React Native BLE, data transfer protocols

### Phase D — Wispr-Style Dictation
**Goal:** Speak into device, get polished text on any device.
**Deliverables:**
- BLE audio streaming to companion app
- Cloud pipeline: Whisper STT → Claude cleanup
- Filler word removal ("um", "uh", "like")
- Course correction handling ("actually", "wait" → outputs final thought only)
- Context-aware formatting
- Clipboard integration in companion app
- Alternative: BLE HID keyboard profile (type directly into Mac/PC)
- Personal dictionary synced across devices
- **Learning:** BLE audio streaming, cloud AI pipelines, Whisper API, prompt engineering, BLE HID

### Phase E — AI Coaching & Insights
**Goal:** Analyze speech patterns over time and provide actionable coaching.
**Deliverables:**
- Transcribed sessions analyzed by Claude
- Daily/weekly rambling trend reports
- Coaching notes ("Your longest ramble was about X — try the 3-point framework")
- Playback with ramble timestamps highlighted
- Goal setting and progress tracking
- **Learning:** AI prompt engineering for coaching, data visualization, behavioral pattern recognition

---

## 10. BLE GATT Service Design (Phase C Readiness)

Defined now so Phase A code structure accommodates it.

### Custom Service: Rambling Guardian (UUID: `4A980001-1CC4-E7C1-C757-F1267DD021E8`)

| Characteristic | UUID | Properties | Data Format |
|---------------|------|------------|-------------|
| Alert Level | `...0002` | Read, Notify | uint8 (0=NONE, 1=GENTLE, 2=MODERATE, 3=URGENT, 4=CRITICAL) |
| Speech Duration | `...0003` | Read, Notify | uint16 (milliseconds since speech started) |
| Device Mode | `...0004` | Read, Write, Notify | uint8 (0=MONITORING, 1=PRESENTATION, 2=CAPTURE, 3=DICTATE, 4=SLEEP) |
| VAD Sensitivity | `...0005` | Read, Write | uint8 (1-4) |
| Battery Level | `...0006` | Read, Notify | uint8 (0-100 percent) |
| Session Stats | `...0007` | Read, Notify | JSON string: `{"alerts":12,"max_duration":45,"total_speech":320}` |
| Alert Thresholds | `...0008` | Read, Write | 4x uint16: gentle_ms, moderate_ms, urgent_ms, critical_ms |

---

## 11. Comparison to Previous Attempt

| Aspect | Previous (failed) | This reboot |
|--------|-------------------|-------------|
| Board | Raspberry Pi Zero 2 W | XIAO ESP32S3 Sense |
| Size | Large, needed external mic | 21x17.5mm, mic built in |
| Language | Python (MicroPython) | C++ (Arduino/ESP-IDF) |
| Scope | Everything at once | Phased: ship MVP, iterate |
| Audio processing | Cloud-dependent | On-device VADNet |
| Architecture | Monolithic | Event-driven, modular outputs |
| Cost | ~$65 MVP | ~$27 MVP |
| Form factor | Required custom PCB | Works on bare board |

---

## 12. Open Questions (Resolved During Implementation)

1. **Enclosure form factor:** Bracelet, clip-on, desk stand, or pocket? Decide after Phase A works on breadboard.
2. **LED diffusion:** How to make LED visible but not harsh? Test with different enclosure materials.
3. **Exact pause threshold:** Start at 1.2s, calibrate with real usage data.
4. **SD card format:** FAT32 (compatible with all OSes) vs exFAT (larger files). Start with FAT32.
5. **Wake word for dictation:** Define in Phase D. Options: button-only, or train a custom wake word via ESP-SR WakeNet.

---

## 13. Sources

- [Seeed XIAO ESP32S3 Sense Wiki](https://wiki.seeedstudio.com/xiao_esp32s3_getting_started/)
- [XIAO Microphone Usage](https://wiki.seeedstudio.com/xiao_esp32s3_sense_mic/)
- [ESP-SR VADNet Documentation](https://docs.espressif.com/projects/esp-sr/en/latest/esp32s3/vadnet/README.html)
- [ESP-IDF Event Loop](https://docs.espressif.com/projects/esp-idf/en/stable/esp32/api-reference/system/esp_event.html)
- [ESP-SR Speech Recognition (GitHub)](https://github.com/espressif/esp-sr)
- [Wispr Flow](https://wisprflow.ai/) — dictation feature reference
- [Apple Personal VAD Research](https://machinelearning.apple.com/research/comparative-analysis-personalized-voice)
- [react-native-ble-plx](https://dotintent.github.io/react-native-ble-plx/)
- [NimBLE-Arduino (GitHub)](https://github.com/h2zero/NimBLE-Arduino)
- [ADHD Speech Production Research (PMC)](https://pmc.ncbi.nlm.nih.gov/articles/PMC10726419/)
- [XIAO ESP32S3 Sleep Modes](https://wiki.seeedstudio.com/XIAO_ESP32S3_Consumption/)
- [Baseten Case Study: Wispr Flow](https://www.baseten.co/resources/customers/wispr-flow/)
