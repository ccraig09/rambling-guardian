// Rambling Guardian — XIAO ESP32S3 Sense
// Detects continuous speech and alerts with escalating LED colors
// https://github.com/ccraig09/rambling-guardian

#include "config.h"
#include "event_bus.h"
#include "audio_input.h"
#include "speech_timer.h"
#include "led_output.h"

void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("Rambling Guardian booting...");

  eventBusInit();
  audioInputInit();
  speechTimerInit();
  ledOutputInit();

  Serial.println("System ready. LED should be breathing green.");
}

void loop() {
  audioInputUpdate();
  speechTimerUpdate();
  ledOutputUpdate();
}
