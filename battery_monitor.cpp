#include "battery_monitor.h"
#include "event_bus.h"
#include "config.h"

// Battery voltage reading via 100k/100k voltage divider on GPIO 4 (D3/A2).
// On USB power without a battery connected, readings will be near 0V — the
// batteryMonitorUpdate() function skips shutdown logic when voltage < 2.0V.

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

  // Read battery voltage via ADC on dedicated pin (not A0 — that's the NeoPixel)
  int rawADC = analogRead(PIN_BATTERY);
  float voltage = (rawADC / 4095.0) * 3.3 * 2.0;  // ×2 for voltage divider

  batteryPercent = voltageToPercent(voltage);

  Serial.print("[Battery] ");
  Serial.print(voltage, 2);
  Serial.print("V (");
  Serial.print(batteryPercent);
  Serial.println("%)");

  // Skip shutdown logic if no battery is wired (voltage near zero on USB power)
  if (voltage < 2.0) {
    Serial.println("[Battery] No battery detected — skipping shutdown");
    return;
  }

  // Check thresholds
  if (batteryPercent <= BATTERY_SHUTDOWN_PERCENT && !criticalFired) {
    criticalFired = true;
    eventBusPublish(EVENT_BATTERY_CRITICAL, batteryPercent);
    Serial.println("[Battery] CRITICAL — initiating graceful shutdown");
    esp_sleep_enable_ext1_wakeup((1ULL << PIN_BUTTON), ESP_EXT1_WAKEUP_ANY_LOW);
    // PROVISIONAL: 2s delay as temporary safety margin for capture_mode to flush
    // WAV data and session log after receiving EVENT_BATTERY_CRITICAL. The event-bus
    // subscription is the real safe-stop mechanism — this delay is a stopgap.
    // Future: replace with a completion handshake (capture_mode sets a "flush
    // complete" flag that battery_monitor checks before sleeping).
    delay(2000);
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
