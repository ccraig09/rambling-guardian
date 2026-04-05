#include "mode_manager.h"
#include "event_bus.h"
#include "config.h"

static DeviceMode currentMode = MODE_MONITORING;
static AlertModality currentModality = MODALITY_BOTH;

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

  // Double-press is reserved for capture mode (Phase A.5)

  else if (event == EVENT_BUTTON_LONG) {
    // Enter deep sleep
    Serial.println("[Mode] → DEEP SLEEP");
    currentMode = MODE_DEEP_SLEEP;
    eventBusPublish(EVENT_MODE_CHANGED, (int)currentMode);
    delay(500);  // Let LED fade
    esp_deep_sleep_start();
  }
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

void modeManagerInit() {
  // Configure wake-up source: button press (GPIO low)
  esp_sleep_enable_ext1_wakeup((1ULL << PIN_BUTTON), ESP_EXT1_WAKEUP_ANY_LOW);

  eventBusSubscribe(EVENT_BUTTON_SINGLE, onButtonEvent);
  eventBusSubscribe(EVENT_BUTTON_LONG, onButtonEvent);
  eventBusSubscribe(EVENT_BUTTON_TRIPLE, onTriplePress);

  Serial.println("[Mode] Manager initialized (MONITORING mode, alerts: both)");
}

DeviceMode modeManagerGetMode() {
  return currentMode;
}
