# Rambling Guardian

Wearable ADHD speech-duration monitor built on XIAO ESP32S3 Sense.

Detects continuous speech and alerts with escalating RGB LED colors:
- **Green** (breathing) — safe, you're not rambling
- **Yellow** (7s) — gentle nudge
- **Orange** (15s) — time to wrap up
- **Red** (30s) — you've been talking a while
- **Red blinking** (60s) — critical alert

## Hardware

### Components
- [Seeed XIAO ESP32S3 Sense](https://www.seeedstudio.com/XIAO-ESP32S3-Sense-p-5639.html)
- WS2812B NeoPixel RGB LED
- Tactile push button (6mm) + 10kΩ resistor
- 400mAh LiPo battery + JST-PH 2.0 connector
- Breadboard + jumper wires

### Wiring

| Component | Pin | GPIO |
|-----------|-----|------|
| NeoPixel Data | D0 | GPIO 1 |
| Button | D1 | GPIO 2 |
| Button Pull-up | D1 → 3.3V | 10kΩ resistor |
| Battery ADC | D3 | GPIO 4 (via voltage divider) |
| Vibration Motor | D2 | GPIO 3 (Phase B, not wired yet) |
| Microphone | Built-in | GPIO 41/42 (PDM) |

### Button Controls
- **Single press** — Toggle monitoring ↔ presentation mode
- **Double tap** — Cycle VAD sensitivity (4 levels)
- **Long press (3s)** — Deep sleep (press again to wake)

## Build & Flash

1. Install [Arduino IDE 2.x](https://www.arduino.cc/en/software)
2. Add ESP32 board support: `https://espressif.github.io/arduino-esp32/package_esp32_dev_index.json`
3. Install board: **esp32 by Espressif** in Board Manager
4. Install library: **Adafruit NeoPixel** in Library Manager
5. Select board: **XIAO_ESP32S3**
6. Select PSRAM: **OPI PSRAM**
7. Select partition: **Huge APP (3MB No OTA/1MB SPIFFS)**
8. Connect board via USB-C, select port
9. Upload

## Serial Monitor

Set baud rate to **115200**. Expected boot output:
```
Rambling Guardian booting...
[EventBus] Initialized
[Audio] Microphone initialized (PDM RX, 16kHz, 16-bit mono)
[SpeechTimer] Initialized
[LED] NeoPixel initialized
[Button] Initialized on GPIO 2
[Mode] Manager initialized (MONITORING mode)
[Battery] Monitor initialized
=== System ready ===
```

## Architecture

Event-driven pub/sub — modules never call each other directly.

```
Audio Input → [EVENT_SPEECH_STARTED/ENDED] → Speech Timer
Speech Timer → [EVENT_ALERT_LEVEL_CHANGED] → LED Output
Button Input → [EVENT_BUTTON_*] → Mode Manager
Mode Manager → [EVENT_MODE_CHANGED] → Speech Timer, LED Output
Mode Manager → [EVENT_SENSITIVITY_CHANGED] → Audio Input
Battery Monitor → [EVENT_BATTERY_LOW/CRITICAL] → LED Output
```

## License

MIT
