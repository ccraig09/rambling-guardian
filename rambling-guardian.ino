// Rambling Guardian — XIAO ESP32S3 Sense
// Detects continuous speech and alerts with escalating LED colors
// https://github.com/ccraig09/rambling-guardian

#include "config.h"

void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("Rambling Guardian booting...");
  Serial.print("VAD threshold: ");
  Serial.println(VAD_THRESHOLDS[1]);
}

void loop() {
  delay(100);
}
