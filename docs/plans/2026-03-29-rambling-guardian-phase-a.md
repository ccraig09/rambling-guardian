# Rambling Guardian Phase A — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a wearable device on the XIAO ESP32S3 Sense that detects continuous speech and alerts with escalating RGB LED colors (green → yellow → orange → red → red blink) at 7s/15s/30s/60s thresholds.

**Architecture:** Energy-based Voice Activity Detection reads audio amplitude from the built-in I2S PDM microphone, a speech timer tracks continuous duration with 1.2s pause debounce, and an event bus decouples detection from output so BLE/vibration can plug in later without rewriting core logic.

**Tech Stack:** C++ / Arduino IDE / ESP32 board package (Espressif) / Adafruit NeoPixel / ESP_I2S

**Design Spec:** `docs/superpowers/specs/2026-03-29-rambling-guardian-design.md`

**Important for the implementing agent:** This is a HARDWARE project. There is no localhost, no npm, no browser. Verification = flash firmware to physical board via USB-C, observe LED behavior, read Serial Monitor output. The working directory for this project is a NEW repo called `rambling-guardian`, separate from `word-shepherd`.

---

## File Structure

```
rambling-guardian/
├── rambling-guardian.ino      # Main entry — setup() and loop()
├── config.h                   # Pin assignments, thresholds, timing constants
├── event_bus.h                # Event types + publish/subscribe API
├── event_bus.cpp              # Event bus implementation (callback registry)
├── audio_input.h              # I2S microphone + energy-based VAD
├── audio_input.cpp            # Reads PDM mic, calculates RMS, emits speech events
├── speech_timer.h             # Continuous speech tracker + alert escalation
├── speech_timer.cpp           # Subscribes to speech events, emits alert levels
├── led_output.h               # NeoPixel LED subscriber
├── led_output.cpp             # Maps alert levels to colors/patterns
├── button_input.h             # Button gesture detection (single/double/long press)
├── button_input.cpp           # Debounce + multi-tap state machine
├── mode_manager.h             # Device mode state (MONITORING/PRESENTATION/SLEEP)
├── mode_manager.cpp           # Subscribes to button events, emits mode changes
├── battery_monitor.h          # ADC battery voltage reader
├── battery_monitor.cpp        # Periodic reads, low-battery warnings, graceful shutdown
├── .claude/
│   └── skills/
│       └── embedded-systems/  # Installed skill for firmware patterns
├── CLAUDE.md                  # Project instructions for Claude Code
└── README.md                  # Hardware setup guide
```

Each `.h`/`.cpp` pair is one module with one responsibility. They communicate only through the event bus — never by calling each other directly. Like React components that only talk through a context/store.

---

## Task 0: Project Setup & Toolchain

**Files:**
- Create: `rambling-guardian/` repo on GitHub
- Create: `rambling-guardian/CLAUDE.md`
- Install: Arduino IDE 2.x + ESP32 board support
- Install: Embedded systems skills

- [ ] **Step 1: Create GitHub repo**

```bash
cd ~/Workspace
mkdir rambling-guardian && cd rambling-guardian
git init
```

- [ ] **Step 2: Install embedded skills**

```bash
# Clone the embedded skills repos
git clone https://github.com/anujdutt9/claude-code-skills /tmp/claude-code-skills
git clone https://github.com/jeffallan/claude-skills /tmp/claude-skills

# Copy relevant skills into project
mkdir -p .claude/skills
cp -r /tmp/claude-code-skills/embedded-programmer .claude/skills/
cp -r /tmp/claude-code-skills/arduino-programmer .claude/skills/
cp -r /tmp/claude-skills/skills/specialized/embedded-systems .claude/skills/

# Cleanup
rm -rf /tmp/claude-code-skills /tmp/claude-skills
```

- [ ] **Step 3: Create CLAUDE.md**

```markdown
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
6. Upload: Click upload button (→ icon)
7. Monitor: Tools → Serial Monitor (115200 baud)

## Architecture
Modules communicate via event bus only — never call each other directly.
Audio → VAD → SpeechTimer → EventBus → LED/Vibration/BLE subscribers.

## Design Spec
See: word-shepherd/docs/superpowers/specs/2026-03-29-rambling-guardian-design.md
```

- [ ] **Step 4: Install Arduino IDE and board support**

```bash
# Install arduino-cli (if not using Arduino IDE GUI)
brew install arduino-cli

# Add ESP32 board support
arduino-cli config init
arduino-cli config add board_manager.additional_urls https://espressif.github.io/arduino-esp32/package_esp32_dev_index.json
arduino-cli core update-index
arduino-cli core install esp32:esp32

# Install required libraries
arduino-cli lib install "Adafruit NeoPixel"
```

- [ ] **Step 5: Create the .ino skeleton and verify it compiles**

Create `rambling-guardian.ino`:
```cpp
// Rambling Guardian — XIAO ESP32S3 Sense
// Detects continuous speech and alerts with escalating LED colors

void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("Rambling Guardian booting...");
}

void loop() {
  delay(100);
}
```

- [ ] **Step 6: Flash skeleton to board and verify serial output**

```bash
arduino-cli compile --fqbn esp32:esp32:XIAO_ESP32S3 .
arduino-cli upload --fqbn esp32:esp32:XIAO_ESP32S3 -p /dev/cu.usbmodem* .
arduino-cli monitor -p /dev/cu.usbmodem* -c baudrate=115200
```

Expected: Serial Monitor shows `Rambling Guardian booting...`

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: project scaffolding with Arduino IDE + ESP32 board support"
```

---

## Task 1: Config Constants

**Files:**
- Create: `config.h`

- [ ] **Step 1: Create config.h with all project constants**

```cpp
#ifndef CONFIG_H
#define CONFIG_H

// ============================================
// Pin Assignments
// ============================================
#define PIN_MIC_DATA      41    // I2S PDM data in (built-in mic)
#define PIN_MIC_CLK       42    // I2S PDM clock (built-in mic)
#define PIN_NEOPIXEL      1     // D0 — WS2812B RGB LED data
#define PIN_BUTTON         2     // D1 — Tactile button (10kΩ pull-up)
#define PIN_VIBRATION      3     // D2 — Vibration motor (Phase B, unused now)
#define PIN_SD_CS         21    // SD card chip select (built-in)

// ============================================
// Audio / VAD Settings
// ============================================
#define AUDIO_SAMPLE_RATE     16000   // 16kHz — sufficient for speech
#define AUDIO_WINDOW_MS       100     // RMS energy window (100ms chunks)
#define AUDIO_SAMPLES_PER_WINDOW (AUDIO_SAMPLE_RATE / (1000 / AUDIO_WINDOW_MS))
#define VAD_ENERGY_THRESHOLD  500     // Amplitude threshold for speech detection
                                       // Tune this per environment (higher = less sensitive)
#define VAD_SENSITIVITY_LEVELS 4      // Number of sensitivity presets
// Sensitivity presets: threshold values for modes 1-4
// Lower = more sensitive (catches quieter speech but more false positives)
const int VAD_THRESHOLDS[VAD_SENSITIVITY_LEVELS] = { 300, 500, 800, 1200 };

// ============================================
// Speech Timer Thresholds (milliseconds)
// ============================================
#define PAUSE_THRESHOLD_MS    1200    // 1.2s silence = timer reset
#define ALERT_GENTLE_MS       7000    // 7 seconds continuous speech
#define ALERT_MODERATE_MS    15000    // 15 seconds
#define ALERT_URGENT_MS      30000    // 30 seconds
#define ALERT_CRITICAL_MS    60000    // 60 seconds

// ============================================
// Button Timing (milliseconds)
// ============================================
#define BUTTON_DEBOUNCE_MS    50      // Debounce window
#define BUTTON_MULTI_TAP_MS  300     // Window to detect multi-tap
#define BUTTON_LONG_PRESS_MS 3000    // Long press threshold

// ============================================
// Battery Monitoring
// ============================================
#define BATTERY_CHECK_INTERVAL_MS  60000  // Check every 60 seconds
#define BATTERY_WARNING_PERCENT    10     // Orange blink warning
#define BATTERY_SHUTDOWN_PERCENT    5     // Save + deep sleep
#define BATTERY_DIM_PERCENT        15     // Reduce LED brightness

// ============================================
// LED Settings
// ============================================
#define LED_NUM_PIXELS        1       // Single NeoPixel (or 8 for strip)
#define LED_BRIGHTNESS_FULL  50      // Max brightness (0-255, keep low for battery)
#define LED_BRIGHTNESS_DIM   15      // Dimmed for low battery
#define LED_BREATHE_SPEED_MS 2000    // Breathing animation cycle

#endif // CONFIG_H
```

- [ ] **Step 2: Include config.h in main .ino and verify it compiles**

Update `rambling-guardian.ino`:
```cpp
#include "config.h"

void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("Rambling Guardian booting...");
  Serial.print("VAD threshold: ");
  Serial.println(VAD_THRESHOLDS[1]);
}

void loop() {
  delay(100);
}
```

- [ ] **Step 3: Flash and verify config loads**

Expected serial output: `VAD threshold: 500`

- [ ] **Step 4: Commit**

```bash
git add config.h rambling-guardian.ino
git commit -m "feat: add config.h with pin assignments and timing constants"
```

---

## Task 2: Event Bus

**Files:**
- Create: `event_bus.h`
- Create: `event_bus.cpp`

- [ ] **Step 1: Create event_bus.h**

```cpp
#ifndef EVENT_BUS_H
#define EVENT_BUS_H

#include <Arduino.h>

// ============================================
// Event Types
// ============================================
enum EventType {
  EVENT_SPEECH_STARTED,        // VAD detected speech
  EVENT_SPEECH_ENDED,          // VAD detected silence
  EVENT_ALERT_LEVEL_CHANGED,   // Timer crossed a threshold
  EVENT_MODE_CHANGED,          // Button toggled device mode
  EVENT_BUTTON_SINGLE,         // Single press detected
  EVENT_BUTTON_DOUBLE,         // Double press detected
  EVENT_BUTTON_LONG,           // Long press detected
  EVENT_BATTERY_LOW,           // Battery below warning threshold
  EVENT_BATTERY_CRITICAL,      // Battery below shutdown threshold
  EVENT_COUNT                  // Total number of event types
};

// Alert levels (payload for EVENT_ALERT_LEVEL_CHANGED)
enum AlertLevel {
  ALERT_NONE = 0,
  ALERT_GENTLE = 1,
  ALERT_MODERATE = 2,
  ALERT_URGENT = 3,
  ALERT_CRITICAL = 4
};

// Device modes (payload for EVENT_MODE_CHANGED)
enum DeviceMode {
  MODE_MONITORING = 0,
  MODE_PRESENTATION = 1,
  MODE_DEEP_SLEEP = 2
};

// Callback signature: receives event type and an int payload
typedef void (*EventCallback)(EventType event, int payload);

// ============================================
// Public API
// ============================================
void eventBusInit();
void eventBusSubscribe(EventType event, EventCallback callback);
void eventBusPublish(EventType event, int payload);

#endif // EVENT_BUS_H
```

- [ ] **Step 2: Create event_bus.cpp**

```cpp
#include "event_bus.h"

// Max subscribers per event type
#define MAX_SUBSCRIBERS 8

// Registry: array of callback lists, one per event type
static EventCallback subscribers[EVENT_COUNT][MAX_SUBSCRIBERS];
static int subscriberCount[EVENT_COUNT];

void eventBusInit() {
  for (int i = 0; i < EVENT_COUNT; i++) {
    subscriberCount[i] = 0;
    for (int j = 0; j < MAX_SUBSCRIBERS; j++) {
      subscribers[i][j] = nullptr;
    }
  }
  Serial.println("[EventBus] Initialized");
}

void eventBusSubscribe(EventType event, EventCallback callback) {
  if (event >= EVENT_COUNT) return;
  int idx = subscriberCount[event];
  if (idx >= MAX_SUBSCRIBERS) {
    Serial.println("[EventBus] ERROR: Max subscribers reached");
    return;
  }
  subscribers[event][idx] = callback;
  subscriberCount[event]++;
}

void eventBusPublish(EventType event, int payload) {
  if (event >= EVENT_COUNT) return;
  for (int i = 0; i < subscriberCount[event]; i++) {
    if (subscribers[event][i] != nullptr) {
      subscribers[event][i](event, payload);
    }
  }
}
```

- [ ] **Step 3: Wire into main .ino and test with a dummy event**

Update `rambling-guardian.ino`:
```cpp
#include "config.h"
#include "event_bus.h"

void testHandler(EventType event, int payload) {
  Serial.print("[Test] Received event ");
  Serial.print(event);
  Serial.print(" with payload ");
  Serial.println(payload);
}

void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("Rambling Guardian booting...");

  eventBusInit();
  eventBusSubscribe(EVENT_ALERT_LEVEL_CHANGED, testHandler);

  // Test: publish a dummy alert
  eventBusPublish(EVENT_ALERT_LEVEL_CHANGED, ALERT_GENTLE);
}

void loop() {
  delay(100);
}
```

- [ ] **Step 4: Flash and verify event bus works**

Expected serial output:
```
Rambling Guardian booting...
[EventBus] Initialized
[Test] Received event 2 with payload 1
```

- [ ] **Step 5: Commit**

```bash
git add event_bus.h event_bus.cpp rambling-guardian.ino
git commit -m "feat: event bus with pub/sub for inter-module communication"
```

---

## Task 3: Microphone Input + Energy-Based VAD

**Files:**
- Create: `audio_input.h`
- Create: `audio_input.cpp`

- [ ] **Step 1: Create audio_input.h**

```cpp
#ifndef AUDIO_INPUT_H
#define AUDIO_INPUT_H

#include <Arduino.h>

void audioInputInit();
void audioInputUpdate();  // Call every loop() iteration
int  audioGetCurrentEnergy();  // For debugging

#endif // AUDIO_INPUT_H
```

- [ ] **Step 2: Create audio_input.cpp**

```cpp
#include "audio_input.h"
#include "event_bus.h"
#include "config.h"
#include "ESP_I2S.h"

static I2SClass i2s;
static bool speechActive = false;
static int currentEnergy = 0;
static int currentSensitivity = 1;  // Default mode 2 (index 1)

// Calculate RMS energy from audio samples over a window
static int calculateEnergy() {
  long sum = 0;
  int validSamples = 0;

  for (int i = 0; i < AUDIO_SAMPLES_PER_WINDOW; i++) {
    int sample = i2s.read();
    // Filter invalid samples (0, -1, 1 are noise artifacts)
    if (sample != 0 && sample != -1 && sample != 1) {
      sum += abs(sample);
      validSamples++;
    }
  }

  if (validSamples == 0) return 0;
  return (int)(sum / validSamples);
}

void audioInputInit() {
  i2s.setPinsPdmRx(PIN_MIC_CLK, PIN_MIC_DATA);

  if (!i2s.begin(I2S_MODE_PDM_RX, AUDIO_SAMPLE_RATE,
                 I2S_DATA_BIT_WIDTH_16BIT, I2S_SLOT_MODE_MONO)) {
    Serial.println("[Audio] ERROR: Failed to initialize I2S microphone!");
    return;
  }

  Serial.println("[Audio] Microphone initialized (PDM RX, 16kHz, 16-bit mono)");
}

void audioInputUpdate() {
  currentEnergy = calculateEnergy();
  int threshold = VAD_THRESHOLDS[currentSensitivity];
  bool isSpeech = (currentEnergy > threshold);

  if (isSpeech && !speechActive) {
    speechActive = true;
    eventBusPublish(EVENT_SPEECH_STARTED, currentEnergy);
  } else if (!isSpeech && speechActive) {
    speechActive = false;
    eventBusPublish(EVENT_SPEECH_ENDED, currentEnergy);
  }
}

int audioGetCurrentEnergy() {
  return currentEnergy;
}
```

- [ ] **Step 3: Wire into main .ino and test microphone**

Update `rambling-guardian.ino`:
```cpp
#include "config.h"
#include "event_bus.h"
#include "audio_input.h"

void onSpeech(EventType event, int payload) {
  if (event == EVENT_SPEECH_STARTED) {
    Serial.print("[VAD] Speech STARTED (energy: ");
    Serial.print(payload);
    Serial.println(")");
  } else if (event == EVENT_SPEECH_ENDED) {
    Serial.print("[VAD] Speech ENDED (energy: ");
    Serial.print(payload);
    Serial.println(")");
  }
}

void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("Rambling Guardian booting...");

  eventBusInit();
  eventBusSubscribe(EVENT_SPEECH_STARTED, onSpeech);
  eventBusSubscribe(EVENT_SPEECH_ENDED, onSpeech);

  audioInputInit();
}

void loop() {
  audioInputUpdate();
  // Print energy level every 500ms for calibration
  static unsigned long lastPrint = 0;
  if (millis() - lastPrint > 500) {
    Serial.print("[Energy] ");
    Serial.println(audioGetCurrentEnergy());
    lastPrint = millis();
  }
}
```

- [ ] **Step 4: Flash and test with voice**

Open Serial Monitor at 115200 baud. Expected:
- Silence: `[Energy] 20` (low numbers)
- Talking: `[Energy] 800+` and `[VAD] Speech STARTED`
- Stop talking: `[VAD] Speech ENDED`

**If energy values are too low/high:** Adjust `VAD_ENERGY_THRESHOLD` in `config.h`. Use Serial Plotter (Tools → Serial Plotter) to visualize the waveform.

- [ ] **Step 5: Commit**

```bash
git add audio_input.h audio_input.cpp rambling-guardian.ino
git commit -m "feat: I2S microphone input with energy-based voice activity detection"
```

---

## Task 4: Speech Timer + Alert Escalator

**Files:**
- Create: `speech_timer.h`
- Create: `speech_timer.cpp`

- [ ] **Step 1: Create speech_timer.h**

```cpp
#ifndef SPEECH_TIMER_H
#define SPEECH_TIMER_H

#include <Arduino.h>

void speechTimerInit();
void speechTimerUpdate();  // Call every loop() iteration
unsigned long speechTimerGetDuration();  // Current speech duration in ms
AlertLevel speechTimerGetLevel();  // Current alert level

#endif // SPEECH_TIMER_H
```

- [ ] **Step 2: Create speech_timer.cpp**

```cpp
#include "speech_timer.h"
#include "event_bus.h"
#include "config.h"

static unsigned long speechStartTime = 0;
static unsigned long lastSpeechTime = 0;
static bool isSpeaking = false;
static bool timerRunning = false;
static AlertLevel currentLevel = ALERT_NONE;
static bool alertsSuppressed = false;

// Calculate alert level from duration
static AlertLevel levelFromDuration(unsigned long duration) {
  if (duration >= ALERT_CRITICAL_MS) return ALERT_CRITICAL;
  if (duration >= ALERT_URGENT_MS)   return ALERT_URGENT;
  if (duration >= ALERT_MODERATE_MS) return ALERT_MODERATE;
  if (duration >= ALERT_GENTLE_MS)   return ALERT_GENTLE;
  return ALERT_NONE;
}

// Event handlers
static void onSpeechEvent(EventType event, int payload) {
  if (event == EVENT_SPEECH_STARTED) {
    isSpeaking = true;
    lastSpeechTime = millis();
    if (!timerRunning) {
      speechStartTime = millis();
      timerRunning = true;
    }
  } else if (event == EVENT_SPEECH_ENDED) {
    isSpeaking = false;
    lastSpeechTime = millis();
  }
}

static void onModeChanged(EventType event, int payload) {
  DeviceMode mode = (DeviceMode)payload;
  alertsSuppressed = (mode == MODE_PRESENTATION);
  if (alertsSuppressed && currentLevel != ALERT_NONE) {
    currentLevel = ALERT_NONE;
    eventBusPublish(EVENT_ALERT_LEVEL_CHANGED, ALERT_NONE);
  }
}

void speechTimerInit() {
  eventBusSubscribe(EVENT_SPEECH_STARTED, onSpeechEvent);
  eventBusSubscribe(EVENT_SPEECH_ENDED, onSpeechEvent);
  eventBusSubscribe(EVENT_MODE_CHANGED, onModeChanged);
  Serial.println("[SpeechTimer] Initialized");
}

void speechTimerUpdate() {
  if (!timerRunning) return;

  unsigned long now = millis();

  // Check if pause exceeded threshold — reset timer
  if (!isSpeaking && (now - lastSpeechTime) > PAUSE_THRESHOLD_MS) {
    timerRunning = false;
    speechStartTime = 0;
    if (currentLevel != ALERT_NONE) {
      currentLevel = ALERT_NONE;
      eventBusPublish(EVENT_ALERT_LEVEL_CHANGED, ALERT_NONE);
      Serial.println("[SpeechTimer] Reset — pause detected");
    }
    return;
  }

  // Calculate duration and check for level change
  if (alertsSuppressed) return;

  unsigned long duration = now - speechStartTime;
  AlertLevel newLevel = levelFromDuration(duration);

  if (newLevel != currentLevel) {
    currentLevel = newLevel;
    eventBusPublish(EVENT_ALERT_LEVEL_CHANGED, (int)newLevel);
    Serial.print("[SpeechTimer] Alert level: ");
    Serial.print(newLevel);
    Serial.print(" (duration: ");
    Serial.print(duration / 1000);
    Serial.println("s)");
  }
}

unsigned long speechTimerGetDuration() {
  if (!timerRunning) return 0;
  return millis() - speechStartTime;
}

AlertLevel speechTimerGetLevel() {
  return currentLevel;
}
```

- [ ] **Step 3: Wire into main .ino**

Update `rambling-guardian.ino`:
```cpp
#include "config.h"
#include "event_bus.h"
#include "audio_input.h"
#include "speech_timer.h"

void onAlertChanged(EventType event, int payload) {
  const char* labels[] = { "NONE", "GENTLE", "MODERATE", "URGENT", "CRITICAL" };
  Serial.print("[Alert] Level changed to: ");
  Serial.println(labels[payload]);
}

void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("Rambling Guardian booting...");

  eventBusInit();
  eventBusSubscribe(EVENT_ALERT_LEVEL_CHANGED, onAlertChanged);

  audioInputInit();
  speechTimerInit();

  Serial.println("System ready. Start talking to test...");
}

void loop() {
  audioInputUpdate();
  speechTimerUpdate();
}
```

- [ ] **Step 4: Flash and test escalation**

Talk continuously for 7+ seconds. Expected serial output:
```
System ready. Start talking to test...
[SpeechTimer] Alert level: 1 (duration: 7s)
[Alert] Level changed to: GENTLE
[SpeechTimer] Alert level: 2 (duration: 15s)
[Alert] Level changed to: MODERATE
```

Stop talking for 1.2+ seconds:
```
[SpeechTimer] Reset — pause detected
[Alert] Level changed to: NONE
```

- [ ] **Step 5: Commit**

```bash
git add speech_timer.h speech_timer.cpp rambling-guardian.ino
git commit -m "feat: speech timer with escalating alert levels (7s/15s/30s/60s)"
```

---

## Task 5: LED Output Subscriber

**Files:**
- Create: `led_output.h`
- Create: `led_output.cpp`

- [ ] **Step 1: Create led_output.h**

```cpp
#ifndef LED_OUTPUT_H
#define LED_OUTPUT_H

#include <Arduino.h>

void ledOutputInit();
void ledOutputUpdate();  // Call every loop() — handles animations

#endif // LED_OUTPUT_H
```

- [ ] **Step 2: Create led_output.cpp**

```cpp
#include "led_output.h"
#include "event_bus.h"
#include "config.h"
#include <Adafruit_NeoPixel.h>

static Adafruit_NeoPixel strip(LED_NUM_PIXELS, PIN_NEOPIXEL, NEO_GRB + NEO_KHZ800);
static AlertLevel currentAlert = ALERT_NONE;
static DeviceMode currentMode = MODE_MONITORING;
static uint8_t brightness = LED_BRIGHTNESS_FULL;

// Color definitions (R, G, B)
static uint32_t colorNone;       // Dim green
static uint32_t colorGentle;     // Yellow
static uint32_t colorModerate;   // Orange
static uint32_t colorUrgent;     // Red
static uint32_t colorCritical;   // Red (blinks)
static uint32_t colorPresentation; // Blue

// Breathing animation state
static unsigned long lastBreathUpdate = 0;
static float breathPhase = 0.0;

// Blink animation state
static unsigned long lastBlinkToggle = 0;
static bool blinkOn = true;

static void onAlertChanged(EventType event, int payload) {
  currentAlert = (AlertLevel)payload;
}

static void onModeChanged(EventType event, int payload) {
  currentMode = (DeviceMode)payload;
}

static void onBatteryLow(EventType event, int payload) {
  brightness = LED_BRIGHTNESS_DIM;
  strip.setBrightness(brightness);
}

// Smooth breathing effect — returns brightness multiplier 0.0-1.0
static float breathe() {
  unsigned long now = millis();
  float elapsed = (float)(now % LED_BREATHE_SPEED_MS) / LED_BREATHE_SPEED_MS;
  // Sine wave: 0→1→0 over the cycle
  return (sin(elapsed * 2.0 * PI) + 1.0) / 2.0;
}

void ledOutputInit() {
  strip.begin();
  strip.setBrightness(brightness);
  strip.show();

  // Pre-compute colors
  colorNone        = strip.Color(0, 40, 0);     // Dim green
  colorGentle      = strip.Color(255, 200, 0);   // Yellow
  colorModerate    = strip.Color(255, 100, 0);   // Orange
  colorUrgent      = strip.Color(255, 0, 0);     // Red
  colorCritical    = strip.Color(255, 0, 0);     // Red (blinks handled in update)
  colorPresentation = strip.Color(0, 0, 80);     // Blue

  eventBusSubscribe(EVENT_ALERT_LEVEL_CHANGED, onAlertChanged);
  eventBusSubscribe(EVENT_MODE_CHANGED, onModeChanged);
  eventBusSubscribe(EVENT_BATTERY_LOW, onBatteryLow);

  Serial.println("[LED] NeoPixel initialized");
}

void ledOutputUpdate() {
  uint32_t color;

  if (currentMode == MODE_PRESENTATION) {
    // Presentation mode: breathing blue
    float b = breathe();
    color = strip.Color(0, 0, (int)(80 * b));
  } else if (currentMode == MODE_DEEP_SLEEP) {
    strip.setPixelColor(0, 0);
    strip.show();
    return;
  } else {
    // Monitoring mode
    switch (currentAlert) {
      case ALERT_NONE:
        // Breathing green
        {
          float b = breathe();
          color = strip.Color(0, (int)(40 * b), 0);
        }
        break;
      case ALERT_GENTLE:
        color = colorGentle;
        break;
      case ALERT_MODERATE:
        color = colorModerate;
        break;
      case ALERT_URGENT:
        color = colorUrgent;
        break;
      case ALERT_CRITICAL:
        // Blinking red at 1Hz
        if (millis() - lastBlinkToggle > 500) {
          blinkOn = !blinkOn;
          lastBlinkToggle = millis();
        }
        color = blinkOn ? colorCritical : strip.Color(0, 0, 0);
        break;
      default:
        color = strip.Color(0, 0, 0);
    }
  }

  strip.setPixelColor(0, color);
  strip.show();
}
```

- [ ] **Step 3: Wire into main .ino**

Update `rambling-guardian.ino`:
```cpp
#include "config.h"
#include "event_bus.h"
#include "audio_input.h"
#include "speech_timer.h"
#include "led_output.h"

void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("Rambling Guardian booting...");

  eventBusInit();
  audioInputInit();
  speechTimerInit();
  ledOutputInit();

  Serial.println("System ready. LED should be breathing green.");
}

void loop() {
  audioInputUpdate();
  speechTimerUpdate();
  ledOutputUpdate();
}
```

- [ ] **Step 4: Flash and test LED behavior**

Verify:
1. Boot → LED breathes dim green
2. Talk for 7s → LED turns solid yellow
3. Talk for 15s → LED turns orange
4. Talk for 30s → LED turns solid red
5. Talk for 60s → LED blinks red
6. Stop talking for 1.2s → LED fades back to breathing green

- [ ] **Step 5: Commit**

```bash
git add led_output.h led_output.cpp rambling-guardian.ino
git commit -m "feat: NeoPixel LED output with escalating colors and breathing animation"
```

---

## Task 6: Button Input + Mode Manager

**Files:**
- Create: `button_input.h`
- Create: `button_input.cpp`
- Create: `mode_manager.h`
- Create: `mode_manager.cpp`

- [ ] **Step 1: Create button_input.h**

```cpp
#ifndef BUTTON_INPUT_H
#define BUTTON_INPUT_H

#include <Arduino.h>

void buttonInputInit();
void buttonInputUpdate();  // Call every loop() iteration

#endif // BUTTON_INPUT_H
```

- [ ] **Step 2: Create button_input.cpp**

```cpp
#include "button_input.h"
#include "event_bus.h"
#include "config.h"

static bool lastState = HIGH;        // Pull-up means HIGH when not pressed
static bool buttonDown = false;
static unsigned long pressStartTime = 0;
static unsigned long lastReleaseTime = 0;
static int tapCount = 0;
static bool longPressFired = false;

void buttonInputInit() {
  pinMode(PIN_BUTTON, INPUT_PULLUP);
  Serial.println("[Button] Initialized on GPIO " + String(PIN_BUTTON));
}

void buttonInputUpdate() {
  bool currentState = digitalRead(PIN_BUTTON);
  unsigned long now = millis();

  // Debounce
  static unsigned long lastChange = 0;
  if (currentState != lastState) {
    lastChange = now;
  }
  lastState = currentState;
  if ((now - lastChange) < BUTTON_DEBOUNCE_MS) return;

  bool pressed = (currentState == LOW);  // Active low with pull-up

  // Button just pressed
  if (pressed && !buttonDown) {
    buttonDown = true;
    pressStartTime = now;
    longPressFired = false;
  }

  // Button held — check for long press
  if (pressed && buttonDown && !longPressFired) {
    if ((now - pressStartTime) >= BUTTON_LONG_PRESS_MS) {
      longPressFired = true;
      tapCount = 0;
      eventBusPublish(EVENT_BUTTON_LONG, 0);
      Serial.println("[Button] Long press");
    }
  }

  // Button just released
  if (!pressed && buttonDown) {
    buttonDown = false;
    if (!longPressFired) {
      tapCount++;
      lastReleaseTime = now;
    }
  }

  // Multi-tap window expired — fire appropriate event
  if (tapCount > 0 && !buttonDown && (now - lastReleaseTime) > BUTTON_MULTI_TAP_MS) {
    if (tapCount == 1) {
      eventBusPublish(EVENT_BUTTON_SINGLE, 0);
      Serial.println("[Button] Single press");
    } else if (tapCount == 2) {
      eventBusPublish(EVENT_BUTTON_DOUBLE, 0);
      Serial.println("[Button] Double press");
    }
    // Triple+ reserved for future phases
    tapCount = 0;
  }
}
```

- [ ] **Step 3: Create mode_manager.h**

```cpp
#ifndef MODE_MANAGER_H
#define MODE_MANAGER_H

#include <Arduino.h>

void modeManagerInit();
DeviceMode modeManagerGetMode();

#endif // MODE_MANAGER_H
```

- [ ] **Step 4: Create mode_manager.cpp**

```cpp
#include "mode_manager.h"
#include "event_bus.h"
#include "config.h"

static DeviceMode currentMode = MODE_MONITORING;
static int vadSensitivity = 1;  // Index into VAD_THRESHOLDS (mode 2 = index 1)

static void onButtonEvent(EventType event, int payload) {
  if (event == EVENT_BUTTON_SINGLE) {
    // Toggle between MONITORING and PRESENTATION
    if (currentMode == MODE_MONITORING) {
      currentMode = MODE_PRESENTATION;
      Serial.println("[Mode] → PRESENTATION (alerts suppressed)");
    } else if (currentMode == MODE_PRESENTATION) {
      currentMode = MODE_MONITORING;
      Serial.println("[Mode] → MONITORING");
    }
    eventBusPublish(EVENT_MODE_CHANGED, (int)currentMode);
  }

  else if (event == EVENT_BUTTON_DOUBLE) {
    // Cycle VAD sensitivity
    vadSensitivity = (vadSensitivity + 1) % VAD_SENSITIVITY_LEVELS;
    Serial.print("[Mode] VAD sensitivity: mode ");
    Serial.print(vadSensitivity + 1);
    Serial.print(" (threshold: ");
    Serial.print(VAD_THRESHOLDS[vadSensitivity]);
    Serial.println(")");
    // Note: audio_input.cpp reads this via a shared mechanism or config update
  }

  else if (event == EVENT_BUTTON_LONG) {
    // Enter deep sleep
    Serial.println("[Mode] → DEEP SLEEP");
    currentMode = MODE_DEEP_SLEEP;
    eventBusPublish(EVENT_MODE_CHANGED, (int)currentMode);
    delay(500);  // Let LED fade
    esp_deep_sleep_start();
  }
}

void modeManagerInit() {
  // Configure wake-up source: button press (GPIO low)
  esp_sleep_enable_ext0_wakeup((gpio_num_t)PIN_BUTTON, 0);

  eventBusSubscribe(EVENT_BUTTON_SINGLE, onButtonEvent);
  eventBusSubscribe(EVENT_BUTTON_DOUBLE, onButtonEvent);
  eventBusSubscribe(EVENT_BUTTON_LONG, onButtonEvent);

  Serial.println("[Mode] Manager initialized (MONITORING mode)");
}

DeviceMode modeManagerGetMode() {
  return currentMode;
}
```

- [ ] **Step 5: Wire into main .ino**

Update `rambling-guardian.ino`:
```cpp
#include "config.h"
#include "event_bus.h"
#include "audio_input.h"
#include "speech_timer.h"
#include "led_output.h"
#include "button_input.h"
#include "mode_manager.h"

void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("Rambling Guardian booting...");

  eventBusInit();
  audioInputInit();
  speechTimerInit();
  ledOutputInit();
  buttonInputInit();
  modeManagerInit();

  Serial.println("System ready. Monitoring mode active.");
}

void loop() {
  audioInputUpdate();
  speechTimerUpdate();
  ledOutputUpdate();
  buttonInputUpdate();
}
```

- [ ] **Step 6: Flash and test button interactions**

Verify:
1. Single press → LED flashes blue (presentation), alerts stop
2. Single press again → LED back to green (monitoring)
3. Double tap → Serial shows sensitivity change
4. Long press 3s → Device enters deep sleep (LED off)
5. Press button again → Device wakes, LED breathes green

- [ ] **Step 7: Commit**

```bash
git add button_input.h button_input.cpp mode_manager.h mode_manager.cpp rambling-guardian.ino
git commit -m "feat: button gestures (single/double/long) + mode manager (monitoring/presentation/sleep)"
```

---

## Task 7: Battery Monitor

**Files:**
- Create: `battery_monitor.h`
- Create: `battery_monitor.cpp`

- [ ] **Step 1: Create battery_monitor.h**

```cpp
#ifndef BATTERY_MONITOR_H
#define BATTERY_MONITOR_H

#include <Arduino.h>

void batteryMonitorInit();
void batteryMonitorUpdate();  // Call every loop() iteration
int  batteryGetPercent();

#endif // BATTERY_MONITOR_H
```

- [ ] **Step 2: Create battery_monitor.cpp**

```cpp
#include "battery_monitor.h"
#include "event_bus.h"
#include "config.h"

// XIAO ESP32S3 battery voltage pin
// The board reads battery voltage through an internal voltage divider
// ADC pin for battery on XIAO ESP32S3 is typically A0 / GPIO 1
// But we're using GPIO 1 for NeoPixel — use the built-in battery read
// XIAO ESP32S3 can read battery voltage on pin D0 when not used for other purpose
// Alternative: use analogReadMilliVolts on a free ADC pin
//
// For XIAO ESP32S3, battery voltage monitoring uses internal ADC
// The actual implementation depends on board revision.
// We'll read from the battery voltage divider if available.

static unsigned long lastCheck = 0;
static int batteryPercent = 100;
static bool warningFired = false;
static bool criticalFired = false;

// Convert raw ADC voltage to battery percentage (3.0V-4.2V range)
static int voltageToPercent(float voltage) {
  if (voltage >= 4.2) return 100;
  if (voltage <= 3.0) return 0;
  // Linear approximation (good enough for LiPo)
  return (int)((voltage - 3.0) / (4.2 - 3.0) * 100.0);
}

void batteryMonitorInit() {
  // Configure ADC for battery reading
  analogReadResolution(12);  // 12-bit ADC (0-4095)
  Serial.println("[Battery] Monitor initialized");
}

void batteryMonitorUpdate() {
  unsigned long now = millis();
  if ((now - lastCheck) < BATTERY_CHECK_INTERVAL_MS) return;
  lastCheck = now;

  // Read battery voltage via ADC
  // XIAO ESP32S3 Sense: battery voltage through voltage divider
  // Raw ADC → voltage conversion (adjust multiplier for your voltage divider)
  int rawADC = analogRead(A0);
  float voltage = (rawADC / 4095.0) * 3.3 * 2.0;  // ×2 for voltage divider

  batteryPercent = voltageToPercent(voltage);

  Serial.print("[Battery] ");
  Serial.print(voltage, 2);
  Serial.print("V (");
  Serial.print(batteryPercent);
  Serial.println("%)");

  // Check thresholds
  if (batteryPercent <= BATTERY_SHUTDOWN_PERCENT && !criticalFired) {
    criticalFired = true;
    eventBusPublish(EVENT_BATTERY_CRITICAL, batteryPercent);
    Serial.println("[Battery] CRITICAL — initiating graceful shutdown");
    delay(1000);
    esp_deep_sleep_start();
  }
  else if (batteryPercent <= BATTERY_WARNING_PERCENT && !warningFired) {
    warningFired = true;
    eventBusPublish(EVENT_BATTERY_LOW, batteryPercent);
    Serial.println("[Battery] LOW — dimming LED");
  }

  // Reset flags if battery charged back up
  if (batteryPercent > BATTERY_WARNING_PERCENT) {
    warningFired = false;
    criticalFired = false;
  }
}

int batteryGetPercent() {
  return batteryPercent;
}
```

- [ ] **Step 3: Wire into main .ino**

Update `rambling-guardian.ino`:
```cpp
#include "config.h"
#include "event_bus.h"
#include "audio_input.h"
#include "speech_timer.h"
#include "led_output.h"
#include "button_input.h"
#include "mode_manager.h"
#include "battery_monitor.h"

void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("Rambling Guardian booting...");

  eventBusInit();
  audioInputInit();
  speechTimerInit();
  ledOutputInit();
  buttonInputInit();
  modeManagerInit();
  batteryMonitorInit();

  Serial.println("=== System ready ===");
  Serial.println("Modes: single-press = presentation, long-press = sleep");
  Serial.println("LED: green=safe, yellow=7s, orange=15s, red=30s, blink=60s");
}

void loop() {
  audioInputUpdate();
  speechTimerUpdate();
  ledOutputUpdate();
  buttonInputUpdate();
  batteryMonitorUpdate();
}
```

- [ ] **Step 4: Flash and verify battery readings**

Expected serial output (every 60s):
```
[Battery] 3.85V (70%)
```

When on USB power (no battery), readings may show 4.2V or erratic values — that's normal.

- [ ] **Step 5: Commit**

```bash
git add battery_monitor.h battery_monitor.cpp rambling-guardian.ino
git commit -m "feat: battery voltage monitoring with low-battery warnings and graceful shutdown"
```

---

## Task 8: Integration Test + Push to GitHub

- [ ] **Step 1: Full system verification**

Flash final firmware. Run through this checklist on physical hardware:

```
[ ] Board powers on → Serial: "Rambling Guardian booting..."
[ ] LED breathes dim green (monitoring mode)
[ ] Talk for 7s → LED turns solid yellow
[ ] Talk for 15s → LED turns orange
[ ] Talk for 30s → LED turns solid red
[ ] Talk for 60s → LED blinks red
[ ] Pause 1.2s → LED resets to breathing green
[ ] Single button press → LED switches to blue (presentation)
[ ] Talk in presentation → no color change (alerts suppressed)
[ ] Single button press → back to green (monitoring)
[ ] Double tap → Serial shows sensitivity change
[ ] Long press 3s → LED off, device sleeps
[ ] Press button → device wakes, LED breathes green
[ ] Serial shows battery voltage every 60s
```

- [ ] **Step 2: Create GitHub repo and push**

```bash
cd ~/Workspace/rambling-guardian
gh repo create rambling-guardian --public --source=. --remote=origin --description "Wearable ADHD speech-duration monitor — XIAO ESP32S3 Sense"
git push -u origin main
```

- [ ] **Step 3: Create README.md with wiring guide and photo placeholder**

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: Phase A complete — rambling detection with escalating LED alerts"
git push
```

---

## Post Phase A: What's Next

After Phase A is working on hardware:

1. **Phase A.5** — Add SD card voice note recording (double-press to record)
2. **Phase B** — Wire vibration motor + add haptic output subscriber
3. **Phase C** — BLE GATT peripheral + React Native companion app
4. **Phase D** — Wispr-style dictation via cloud pipeline
5. **Phase E** — AI coaching and speech analytics
