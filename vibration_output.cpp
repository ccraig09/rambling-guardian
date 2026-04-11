#include "vibration_output.h"
#include "event_bus.h"
#include "config.h"

// Current alert level (updated by event callback)
static AlertLevel currentAlert = ALERT_NONE;
static AlertModality currentModality = MODALITY_BOTH;

// Animation timing
static unsigned long patternStartMs = 0;   // When current pattern cycle began
static unsigned long cycleElapsed = 0;     // ms into current cycle

// Gentle: one-shot pulse
static bool gentlePulsePending = false;
static unsigned long gentlePulseStartMs = 0;
static bool gentlePulseActive = false;

// Track whether motor is currently driven (avoid redundant writes)
static bool motorOn = false;

// Session confirmation haptic state
static bool sessionStartPulse = false;
static unsigned long sessionPulseStartMs = 0;

static bool sessionStopPulse = false;
static int sessionStopPulseCount = 0;
static unsigned long sessionStopPulseStartMs = 0;

static void motorWrite(uint8_t duty) {
  analogWrite(PIN_VIBRATION, duty);
  motorOn = (duty > 0);
}

static void onModalityChanged(EventType event, int payload) {
  currentModality = (AlertModality)payload;
  // If switching to LED-only, immediately kill motor
  if (currentModality == MODALITY_LED_ONLY && motorOn) {
    motorWrite(0);
  }
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

static void onSessionStarted(EventType event, int payload) {
  sessionStartPulse = true;
  sessionPulseStartMs = millis();
  motorWrite(180);
}

static void onSessionStopped(EventType event, int payload) {
  sessionStopPulse = true;
  sessionStopPulseCount = 0;
  sessionStopPulseStartMs = millis();
  motorWrite(180);
}

void vibrationOutputInit() {
  pinMode(PIN_VIBRATION, OUTPUT);
  analogWrite(PIN_VIBRATION, 0);

  eventBusSubscribe(EVENT_ALERT_LEVEL_CHANGED, onAlertChanged);
  eventBusSubscribe(EVENT_MODALITY_CHANGED, onModalityChanged);
  eventBusSubscribe(EVENT_SESSION_STARTED, onSessionStarted);
  eventBusSubscribe(EVENT_SESSION_STOPPED, onSessionStopped);

  Serial.println("[Vibration] Motor initialized on GPIO " + String(PIN_VIBRATION));
}

void vibrationOutputUpdate() {
  unsigned long now = millis();

  // Session start confirmation: single 100ms pulse
  if (sessionStartPulse) {
    if (now - sessionPulseStartMs >= 100) {
      motorWrite(0);
      sessionStartPulse = false;
    }
    return;  // Confirmation overrides alert patterns
  }

  // Session stop confirmation: two 50ms pulses with 80ms gap
  if (sessionStopPulse) {
    unsigned long elapsed = now - sessionStopPulseStartMs;
    if (sessionStopPulseCount == 0) {
      // First pulse
      if (elapsed >= 50) {
        motorWrite(0);
        sessionStopPulseCount = 1;
        sessionStopPulseStartMs = now;
      }
    } else if (sessionStopPulseCount == 1) {
      // Gap
      if (elapsed >= 80) {
        motorWrite(180);
        sessionStopPulseCount = 2;
        sessionStopPulseStartMs = now;
      }
    } else {
      // Second pulse
      if (elapsed >= 50) {
        motorWrite(0);
        sessionStopPulse = false;
      }
    }
    return;  // Confirmation overrides alert patterns
  }

  // Suppress vibration if modality is LED-only
  if (currentModality == MODALITY_LED_ONLY) {
    if (motorOn) motorWrite(0);
    return;
  }

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
