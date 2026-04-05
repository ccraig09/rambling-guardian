#include "led_output.h"
#include "event_bus.h"
#include "config.h"
#include "esp32-hal-rgb-led.h"

static AlertLevel currentAlert = ALERT_NONE;
static DeviceMode currentMode = MODE_MONITORING;
static AlertModality currentModality = MODALITY_BOTH;
static uint8_t brightness = LED_BRIGHTNESS_FULL;
static bool captureActive = false;

// Animation rate-limiting
static unsigned long lastLedUpdate = 0;

// Blink animation state
static unsigned long lastBlinkToggle = 0;
static bool blinkOn = true;

// Scale an RGB color by brightness (0-255) and write to LED
static void writeLed(uint8_t r, uint8_t g, uint8_t b) {
  uint8_t sr = (uint8_t)((uint16_t)r * brightness / 255);
  uint8_t sg = (uint8_t)((uint16_t)g * brightness / 255);
  uint8_t sb = (uint8_t)((uint16_t)b * brightness / 255);
  rgbLedWrite(PIN_NEOPIXEL, sr, sg, sb);
}

static void onAlertChanged(EventType event, int payload) {
  currentAlert = (AlertLevel)payload;
}

static void onModeChanged(EventType event, int payload) {
  currentMode = (DeviceMode)payload;
}

static void onModalityChanged(EventType event, int payload) {
  currentModality = (AlertModality)payload;
}

static void onBatteryLow(EventType event, int payload) {
  brightness = LED_BRIGHTNESS_DIM;
}

static void onCaptureStarted(EventType event, int payload) {
  captureActive = true;
}

static void onCaptureStopped(EventType event, int payload) {
  captureActive = false;
}

// Smooth breathing effect — returns multiplier 0.0-1.0
static float breathe() {
  unsigned long now = millis();
  float elapsed = (float)(now % LED_BREATHE_SPEED_MS) / LED_BREATHE_SPEED_MS;
  return (sin(elapsed * 2.0 * PI) + 1.0) / 2.0;
}

void ledOutputInit() {
  rgbLedWrite(PIN_NEOPIXEL, 0, 0, 0);

  eventBusSubscribe(EVENT_ALERT_LEVEL_CHANGED, onAlertChanged);
  eventBusSubscribe(EVENT_MODE_CHANGED, onModeChanged);
  eventBusSubscribe(EVENT_MODALITY_CHANGED, onModalityChanged);
  eventBusSubscribe(EVENT_BATTERY_LOW, onBatteryLow);
  eventBusSubscribe(EVENT_CAPTURE_STARTED, onCaptureStarted);
  eventBusSubscribe(EVENT_CAPTURE_STOPPED, onCaptureStopped);

  Serial.println("[LED] NeoPixel initialized");
}

void ledOutputUpdate() {
  unsigned long now = millis();
  if (now - lastLedUpdate < 20) return;  // 50 Hz refresh
  lastLedUpdate = now;

  // Capture mode override: solid magenta during recording
  if (captureActive) {
    writeLed(255, 0, 255);
    return;
  }

  if (currentMode == MODE_PRESENTATION) {
    float b = breathe();
    writeLed(0, 0, (uint8_t)(80 * b));
    return;
  } else if (currentMode == MODE_DEEP_SLEEP) {
    rgbLedWrite(PIN_NEOPIXEL, 0, 0, 0);
    return;
  }

  // Monitoring mode — suppress visual alerts if modality is vibration-only
  if (currentModality == MODALITY_VIBRATION_ONLY) {
    float b = breathe();
    writeLed(0, (uint8_t)(40 * b), 0);  // Breathing green (no alert colors)
    return;
  }

  switch (currentAlert) {
    case ALERT_NONE: {
      float b = breathe();
      writeLed(0, (uint8_t)(40 * b), 0);        // Breathing green
      break;
    }
    case ALERT_GENTLE:
      writeLed(255, 200, 0);                      // Yellow
      break;
    case ALERT_MODERATE:
      writeLed(255, 100, 0);                      // Orange
      break;
    case ALERT_URGENT:
      writeLed(255, 0, 0);                        // Red
      break;
    case ALERT_CRITICAL:
      if (millis() - lastBlinkToggle > 500) {
        blinkOn = !blinkOn;
        lastBlinkToggle = millis();
      }
      if (blinkOn) writeLed(255, 0, 0);           // Blinking red
      else         rgbLedWrite(PIN_NEOPIXEL, 0, 0, 0);
      break;
    default:
      rgbLedWrite(PIN_NEOPIXEL, 0, 0, 0);
  }
}
