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
    eventBusPublish(EVENT_SENSITIVITY_CHANGED, vadSensitivity);
    Serial.print("[Mode] VAD sensitivity: mode ");
    Serial.print(vadSensitivity + 1);
    Serial.print(" (threshold: ");
    Serial.print(VAD_THRESHOLDS[vadSensitivity]);
    Serial.println(")");
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
  esp_sleep_enable_ext1_wakeup((1ULL << PIN_BUTTON), ESP_EXT1_WAKEUP_ANY_LOW);

  eventBusSubscribe(EVENT_BUTTON_SINGLE, onButtonEvent);
  eventBusSubscribe(EVENT_BUTTON_DOUBLE, onButtonEvent);
  eventBusSubscribe(EVENT_BUTTON_LONG, onButtonEvent);

  Serial.println("[Mode] Manager initialized (MONITORING mode)");
}

DeviceMode modeManagerGetMode() {
  return currentMode;
}
