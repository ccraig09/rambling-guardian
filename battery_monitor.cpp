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
