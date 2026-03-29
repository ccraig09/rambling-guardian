# Rambling Guardian

Wearable ADHD speech-duration monitor built on the Seeed XIAO ESP32S3 Sense.

Detects continuous speech in real-time and alerts with escalating RGB LED colors. Designed for people with ADHD who talk without pausing — the device gently nudges you before others have to.

## How It Works

The built-in microphone continuously monitors audio energy. When you've been talking non-stop for 7 seconds, the LED turns yellow. Keep going and it escalates: orange at 15s, red at 30s, blinking red at 60s. Pause for 1.2 seconds and it resets to green.

## Alert Levels

| Duration | LED Color | Meaning |
|----------|-----------|---------|
| 0-6s | Breathing green | You're fine |
| 7-14s | Solid yellow | Heads up |
| 15-29s | Solid orange | Wrap it up |
| 30-59s | Solid red | You're rambling |
| 60s+ | Blinking red | Stop talking |

## Hardware

- **Board:** [Seeed XIAO ESP32S3 Sense](https://www.seeedstudio.com/XIAO-ESP32S3-Sense-p-5639.html) (built-in mic, WiFi, BLE, battery charging)
- **LED:** WS2812B NeoPixel RGB
- **Button:** 6mm tactile (mode toggle)
- **Battery:** 3.7V LiPo with JST-PH 2.0 connector

## Pin Assignments

| Pin | Purpose |
|-----|---------|
| GPIO 41 | Microphone Data In (built-in) |
| GPIO 42 | Microphone Clock (built-in) |
| GPIO 1 (D0) | NeoPixel LED data |
| GPIO 2 (D1) | Button input |
| GPIO 3 (D2) | Reserved (vibration motor) |

## Wiring

```
XIAO ESP32S3 Sense
┌─────────────────┐
│  [USB-C]        │
│ D0 ──────── NeoPixel data in
│ D1 ──┬──[10kΩ]── 3.3V
│      └── Button ── GND
│ BAT+ ─── LiPo (+)
│ BAT- ─── LiPo (-)
└─────────────────┘
```

## Build & Flash

1. Install [Arduino IDE 2.x](https://www.arduino.cc/en/software)
2. Add ESP32 board support: `https://espressif.github.io/arduino-esp32/package_esp32_dev_index.json`
3. Install board: `esp32` by Espressif Systems
4. Install library: `Adafruit NeoPixel`
5. Select board: `XIAO_ESP32S3`
6. Set PSRAM: `OPI PSRAM`
7. Set Partition: `Huge APP (3MB No OTA/1MB SPIFFS)`
8. Upload `rambling-guardian.ino`

## Modes

- **Single press:** Toggle monitoring / presentation mode
- **Double tap:** Cycle VAD sensitivity (1-4)
- **Long press (3s):** Deep sleep / wake

## Architecture

Event-driven pub/sub — modules communicate through an event bus, never directly. Adding BLE, vibration, or dictation later means writing a new subscriber, not rewriting existing code.

## Roadmap

- **Phase A:** Rambling detection + LED alerts (current)
- **Phase A.5:** Voice note capture to SD card
- **Phase B:** Haptic feedback (vibration motor)
- **Phase C:** BLE companion app (React Native) + Apple Watch notifications
- **Phase D:** Wispr-style dictation (speech-to-clean-text)
- **Phase E:** AI coaching + speech analytics

## License

MIT
