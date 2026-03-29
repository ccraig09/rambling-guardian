// Rambling Guardian — XIAO ESP32S3 Sense
// Detects continuous speech and alerts with escalating LED colors
// https://github.com/ccraig09/rambling-guardian

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
