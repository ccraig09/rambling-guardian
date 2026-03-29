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

  Serial.println("System ready. Monitoring mode active.");
}

void loop() {
  audioInputUpdate();
  speechTimerUpdate();
  ledOutputUpdate();
  buttonInputUpdate();
}
