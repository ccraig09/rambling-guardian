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
#include "sd_card.h"
#include "capture_mode.h"

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
  sdCardInit();
  captureModeInit();

  Serial.println("=== System ready ===");
  Serial.println("Modes: single-press = presentation, long-press = sleep");
  Serial.println("LED: green=safe, yellow=7s, orange=15s, red=30s, blink=60s");

  // Subscribe to speech events so we can see them in the log
  eventBusSubscribe(EVENT_SPEECH_STARTED, onSpeech);
  eventBusSubscribe(EVENT_SPEECH_ENDED, onSpeech);
  eventBusSubscribe(EVENT_ALERT_LEVEL_CHANGED, onAlert);
}

void onSpeech(EventType event, int payload) {
  if (event == EVENT_SPEECH_STARTED) {
    Serial.print(">>> SPEECH STARTED (energy: ");
    Serial.print(payload);
    Serial.println(")");
  } else if (event == EVENT_SPEECH_ENDED) {
    Serial.print(">>> SPEECH ENDED (energy: ");
    Serial.print(payload);
    Serial.println(")");
  }
}

void onAlert(EventType event, int payload) {
  const char* labels[] = { "NONE", "GENTLE", "MODERATE", "URGENT", "CRITICAL" };
  Serial.print(">>> ALERT: ");
  if (payload >= 0 && payload <= 4) Serial.println(labels[payload]);
}

void loop() {
  audioInputUpdate();
  speechTimerUpdate();
  ledOutputUpdate();
  buttonInputUpdate();
  batteryMonitorUpdate();
  captureModeUpdate();

#ifdef DEBUG_AUDIO
  // Debug: show mic energy every 500ms so you can SEE what the mic hears
  static unsigned long lastPrint = 0;
  if (millis() - lastPrint > 500) {
    int energy = audioGetCurrentEnergy();
    int threshold = VAD_THRESHOLDS[1]; // default sensitivity
    Serial.print("[Mic] energy=");
    Serial.print(energy);
    Serial.print(" | thresh=");
    Serial.print(threshold);
    Serial.print(" | ");
    if (energy > threshold) {
      Serial.print("VOICE");
    } else {
      Serial.print("quiet");
    }
    Serial.print(" | timer=");
    Serial.print(speechTimerGetDuration() / 1000);
    Serial.println("s");
    lastPrint = millis();
  }
#endif
}
