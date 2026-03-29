#include "speech_timer.h"
#include "event_bus.h"
#include "config.h"

static unsigned long speechStartTime = 0;
static unsigned long lastSpeechTime = 0;
static bool isSpeaking = false;
static bool timerRunning = false;
static AlertLevel currentLevel = ALERT_NONE;
static bool alertsSuppressed = false;

// Calculate alert level from duration
static AlertLevel levelFromDuration(unsigned long duration) {
  if (duration >= ALERT_CRITICAL_MS) return ALERT_CRITICAL;
  if (duration >= ALERT_URGENT_MS)   return ALERT_URGENT;
  if (duration >= ALERT_MODERATE_MS) return ALERT_MODERATE;
  if (duration >= ALERT_GENTLE_MS)   return ALERT_GENTLE;
  return ALERT_NONE;
}

// Event handlers
static void onSpeechEvent(EventType event, int payload) {
  if (event == EVENT_SPEECH_STARTED) {
    isSpeaking = true;
    lastSpeechTime = millis();
    if (!timerRunning) {
      speechStartTime = millis();
      timerRunning = true;
    }
  } else if (event == EVENT_SPEECH_ENDED) {
    isSpeaking = false;
    lastSpeechTime = millis();
  }
}

static void onModeChanged(EventType event, int payload) {
  DeviceMode mode = (DeviceMode)payload;
  alertsSuppressed = (mode == MODE_PRESENTATION);
  if (alertsSuppressed) {
    timerRunning = false;
    speechStartTime = 0;
    isSpeaking = false;
    if (currentLevel != ALERT_NONE) {
      currentLevel = ALERT_NONE;
      eventBusPublish(EVENT_ALERT_LEVEL_CHANGED, ALERT_NONE);
    }
  }
}

void speechTimerInit() {
  eventBusSubscribe(EVENT_SPEECH_STARTED, onSpeechEvent);
  eventBusSubscribe(EVENT_SPEECH_ENDED, onSpeechEvent);
  eventBusSubscribe(EVENT_MODE_CHANGED, onModeChanged);
  Serial.println("[SpeechTimer] Initialized");
}

void speechTimerUpdate() {
  if (!timerRunning) return;

  unsigned long now = millis();

  // Check if pause exceeded threshold — reset timer
  if (!isSpeaking && (now - lastSpeechTime) > PAUSE_THRESHOLD_MS) {
    timerRunning = false;
    speechStartTime = 0;
    if (currentLevel != ALERT_NONE) {
      currentLevel = ALERT_NONE;
      eventBusPublish(EVENT_ALERT_LEVEL_CHANGED, ALERT_NONE);
      Serial.println("[SpeechTimer] Reset — pause detected");
    }
    return;
  }

  // Calculate duration and check for level change
  if (alertsSuppressed) return;

  unsigned long duration = now - speechStartTime;
  AlertLevel newLevel = levelFromDuration(duration);

  if (newLevel != currentLevel) {
    currentLevel = newLevel;
    eventBusPublish(EVENT_ALERT_LEVEL_CHANGED, (int)newLevel);
    Serial.print("[SpeechTimer] Alert level: ");
    Serial.print(newLevel);
    Serial.print(" (duration: ");
    Serial.print(duration / 1000);
    Serial.println("s)");
  }
}

unsigned long speechTimerGetDuration() {
  if (!timerRunning) return 0;
  return millis() - speechStartTime;
}

AlertLevel speechTimerGetLevel() {
  return currentLevel;
}
