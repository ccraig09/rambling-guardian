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
