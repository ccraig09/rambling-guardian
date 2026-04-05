#include "vibration_output.h"
#include "event_bus.h"
#include "config.h"

// Current alert level (updated by event callback)
static AlertLevel currentAlert = ALERT_NONE;

// Animation timing
static unsigned long patternStartMs = 0;   // When current pattern cycle began
static unsigned long cycleElapsed = 0;     // ms into current cycle

// Gentle: one-shot pulse
static bool gentlePulsePending = false;
static unsigned long gentlePulseStartMs = 0;
static bool gentlePulseActive = false;

// Track whether motor is currently driven (avoid redundant writes)
static bool motorOn = false;

static void motorWrite(uint8_t duty) {
  analogWrite(PIN_VIBRATION, duty);
  motorOn = (duty > 0);
}

static void onAlertChanged(EventType event, int payload) {
  AlertLevel newLevel = (AlertLevel)payload;

  // Reset animation state on any level change
  patternStartMs = millis();
  gentlePulseActive = false;
  gentlePulsePending = false;

  // If transitioning TO gentle, flag a one-shot pulse
  if (newLevel == ALERT_GENTLE) {
    gentlePulsePending = true;
  }

  // Turn motor off immediately on transition — the update loop takes over
  motorWrite(0);

  currentAlert = newLevel;
}

void vibrationOutputInit() {
  pinMode(PIN_VIBRATION, OUTPUT);
  analogWrite(PIN_VIBRATION, 0);

  eventBusSubscribe(EVENT_ALERT_LEVEL_CHANGED, onAlertChanged);

  Serial.println("[Vibration] Motor initialized on GPIO " + String(PIN_VIBRATION));
}

void vibrationOutputUpdate() {
  unsigned long now = millis();

  switch (currentAlert) {

    case ALERT_NONE:
      if (motorOn) motorWrite(0);
      break;

    case ALERT_GENTLE:
      // One-shot pulse: buzz once when level changes TO gentle, then stay off
      if (gentlePulsePending && !gentlePulseActive) {
        // Start the pulse
        gentlePulseActive = true;
        gentlePulsePending = false;
        gentlePulseStartMs = now;
        motorWrite(VIBRATION_GENTLE_DUTY);
      }
      if (gentlePulseActive) {
        if (now - gentlePulseStartMs >= VIBRATION_GENTLE_MS) {
          // Pulse complete
          motorWrite(0);
          gentlePulseActive = false;
        }
      }
      break;

    case ALERT_MODERATE: {
      // Double pulse every VIBRATION_MODERATE_CYCLE_MS
      // Pattern: ON(150) OFF(100) ON(150) OFF(rest of cycle)
      cycleElapsed = (now - patternStartMs) % VIBRATION_MODERATE_CYCLE_MS;

      if (cycleElapsed < VIBRATION_MODERATE_ON_MS) {
        // First pulse
        motorWrite(VIBRATION_MODERATE_DUTY);
      } else if (cycleElapsed < VIBRATION_MODERATE_ON_MS + VIBRATION_MODERATE_OFF_MS) {
        // Gap between pulses
        motorWrite(0);
      } else if (cycleElapsed < VIBRATION_MODERATE_ON_MS + VIBRATION_MODERATE_OFF_MS + VIBRATION_MODERATE_ON_MS) {
        // Second pulse
        motorWrite(VIBRATION_MODERATE_DUTY);
      } else {
        // Rest of cycle — off
        if (motorOn) motorWrite(0);
      }
      break;
    }

    case ALERT_URGENT:
      // Continuous low buzz
      if (!motorOn) motorWrite(VIBRATION_URGENT_DUTY);
      break;

    case ALERT_CRITICAL: {
      // Strong intermittent: ON(300) OFF(200) repeat
      unsigned long criticalCycle = VIBRATION_CRITICAL_ON_MS + VIBRATION_CRITICAL_OFF_MS;
      cycleElapsed = (now - patternStartMs) % criticalCycle;

      if (cycleElapsed < VIBRATION_CRITICAL_ON_MS) {
        motorWrite(VIBRATION_CRITICAL_DUTY);
      } else {
        motorWrite(0);
      }
      break;
    }

    default:
      if (motorOn) motorWrite(0);
      break;
  }
}
