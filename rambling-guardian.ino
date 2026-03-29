// Rambling Guardian — XIAO ESP32S3 Sense
// Detects continuous speech and alerts with escalating LED colors
// https://github.com/ccraig09/rambling-guardian

#include "config.h"
#include "event_bus.h"
#include "audio_input.h"
#include "speech_timer.h"
#include "led_output.h"
#include "button_input.h"
#include "mode_manager.h"
#include "battery_monitor.h"

void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("Rambling Guardian booting...");

  eventBusInit();
  audioInputInit();
  speechTimerInit();
  ledOutputInit();
  buttonInputInit();
  modeManagerInit();
  batteryMonitorInit();

  Serial.println("=== System ready ===");
  Serial.println("Modes: single-press = presentation, long-press = sleep");
  Serial.println("LED: green=safe, yellow=7s, orange=15s, red=30s, blink=60s");
}

void loop() {
  audioInputUpdate();
  speechTimerUpdate();
  ledOutputUpdate();
  buttonInputUpdate();
  batteryMonitorUpdate();
}
