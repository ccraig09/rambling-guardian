// Rambling Guardian — XIAO ESP32S3 Sense
// Detects continuous speech and alerts with escalating LED colors
// https://github.com/ccraig09/rambling-guardian

#include "config.h"
#include "event_bus.h"
#include "audio_input.h"

void onSpeech(EventType event, int payload) {
  if (event == EVENT_SPEECH_STARTED) {
    Serial.print("[VAD] Speech STARTED (energy: ");
    Serial.print(payload);
    Serial.println(")");
  } else if (event == EVENT_SPEECH_ENDED) {
    Serial.print("[VAD] Speech ENDED (energy: ");
    Serial.print(payload);
    Serial.println(")");
  }
}

void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("Rambling Guardian booting...");

  eventBusInit();
  eventBusSubscribe(EVENT_SPEECH_STARTED, onSpeech);
  eventBusSubscribe(EVENT_SPEECH_ENDED, onSpeech);

  audioInputInit();
}

void loop() {
  audioInputUpdate();
  // Print energy level every 500ms for calibration
  static unsigned long lastPrint = 0;
  if (millis() - lastPrint > 500) {
    Serial.print("[Energy] ");
    Serial.println(audioGetCurrentEnergy());
    lastPrint = millis();
  }
}
