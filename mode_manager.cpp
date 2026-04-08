#include "mode_manager.h"
#include "event_bus.h"
#include "config.h"

static DeviceMode currentMode = MODE_IDLE;
static AlertModality currentModality = MODALITY_BOTH;
static TriggerSource currentTriggerSource = TRIGGER_BUTTON;

// ============================================
// Session lifecycle handlers
// ============================================

static void onSessionStartRequested(EventType event, int payload) {
  if (currentMode != MODE_IDLE) {
    Serial.println("[Mode] Session start ignored — not in IDLE");
    return;
  }
  currentMode = MODE_ACTIVE_SESSION;
  currentTriggerSource = (TriggerSource)payload;
  Serial.println("[Mode] → ACTIVE_SESSION");
  eventBusPublish(EVENT_SESSION_STARTED, payload);
  eventBusPublish(EVENT_MODE_CHANGED, (int)currentMode);
}

static void onSessionStopRequested(EventType event, int payload) {
  if (currentMode != MODE_ACTIVE_SESSION) {
    Serial.println("[Mode] Session stop ignored — not in ACTIVE_SESSION");
    return;
  }
  currentMode = MODE_IDLE;
  Serial.println("[Mode] → IDLE");
  eventBusPublish(EVENT_SESSION_STOPPED, payload);
  eventBusPublish(EVENT_MODE_CHANGED, (int)currentMode);
}

// ============================================
// Button handlers
// ============================================

static void onSinglePress(EventType event, int payload) {
  if (currentMode == MODE_IDLE) {
    eventBusPublish(EVENT_SESSION_START_REQUESTED, (int)TRIGGER_BUTTON);
  } else if (currentMode == MODE_ACTIVE_SESSION) {
    eventBusPublish(EVENT_SESSION_STOP_REQUESTED, (int)TRIGGER_BUTTON);
  }
  // MANUAL_NOTE, DEEP_SLEEP: ignore
}

static void onDoublePress(EventType event, int payload) {
  if (currentMode == MODE_ACTIVE_SESSION) {
    Serial.println("[Mode] Double-press ignored — active session");
    return;
  }
  if (currentMode == MODE_IDLE) {
    currentMode = MODE_MANUAL_NOTE;
    Serial.println("[Mode] → MANUAL_NOTE");
    eventBusPublish(EVENT_MODE_CHANGED, (int)currentMode);
  }
  // Let EVENT_BUTTON_DOUBLE propagate — capture_mode subscribes to it
}

static void onLongPress(EventType event, int payload) {
  if (currentMode == MODE_ACTIVE_SESSION) {
    // Stop session first, then sleep — bypass request/validate since we're
    // doing a forced teardown (long-press overrides normal flow)
    Serial.println("[Mode] → IDLE (stopping session before sleep)");
    currentMode = MODE_IDLE;
    eventBusPublish(EVENT_SESSION_STOPPED, (int)TRIGGER_BUTTON);
    eventBusPublish(EVENT_MODE_CHANGED, (int)currentMode);
  }

  Serial.println("[Mode] → DEEP SLEEP");
  currentMode = MODE_DEEP_SLEEP;
  eventBusPublish(EVENT_MODE_CHANGED, (int)currentMode);
  delay(500);  // Let LED fade
  esp_deep_sleep_start();
}

static void onTriplePress(EventType event, int payload) {
  // Cycle: BOTH → LED_ONLY → VIBRATION_ONLY → BOTH
  if (currentModality == MODALITY_BOTH) {
    currentModality = MODALITY_LED_ONLY;
    Serial.println("[Mode] Alert modality: LED only");
  } else if (currentModality == MODALITY_LED_ONLY) {
    currentModality = MODALITY_VIBRATION_ONLY;
    Serial.println("[Mode] Alert modality: vibration only");
  } else {
    currentModality = MODALITY_BOTH;
    Serial.println("[Mode] Alert modality: both");
  }
  eventBusPublish(EVENT_MODALITY_CHANGED, (int)currentModality);
}

// ============================================
// Capture mode return to IDLE
// ============================================

static void onCaptureStopped(EventType event, int payload) {
  if (currentMode == MODE_MANUAL_NOTE) {
    currentMode = MODE_IDLE;
    Serial.println("[Mode] → IDLE (capture ended)");
    eventBusPublish(EVENT_MODE_CHANGED, (int)currentMode);
  }
}

// ============================================
// Public API
// ============================================

void modeManagerInit() {
  // Configure wake-up source: button press (GPIO low)
  esp_sleep_enable_ext1_wakeup((1ULL << PIN_BUTTON), ESP_EXT1_WAKEUP_ANY_LOW);

  // Button event subscriptions
  eventBusSubscribe(EVENT_BUTTON_SINGLE, onSinglePress);
  eventBusSubscribe(EVENT_BUTTON_DOUBLE, onDoublePress);
  eventBusSubscribe(EVENT_BUTTON_LONG, onLongPress);
  eventBusSubscribe(EVENT_BUTTON_TRIPLE, onTriplePress);

  // Session lifecycle subscriptions
  eventBusSubscribe(EVENT_SESSION_START_REQUESTED, onSessionStartRequested);
  eventBusSubscribe(EVENT_SESSION_STOP_REQUESTED, onSessionStopRequested);

  // Return to IDLE when capture stops
  eventBusSubscribe(EVENT_CAPTURE_STOPPED, onCaptureStopped);

  Serial.println("[Mode] Manager initialized (IDLE mode, alerts: both)");
}

DeviceMode modeManagerGetMode() {
  return currentMode;
}

AlertModality modeManagerGetModality() {
  return currentModality;
}

TriggerSource modeManagerGetTriggerSource() {
  return currentTriggerSource;
}
