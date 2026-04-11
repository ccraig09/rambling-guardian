#include "speech_timer.h"
#include "event_bus.h"
#include "config.h"

static unsigned long speechStartTime = 0;
static unsigned long lastSpeechTime = 0;
static bool isSpeaking = false;
static bool timerRunning = false;
static AlertLevel currentLevel = ALERT_NONE;

// Runtime-configurable thresholds (defaults from config.h, writable via BLE)
static unsigned long thresholdGentle   = ALERT_GENTLE_MS;
static unsigned long thresholdModerate = ALERT_MODERATE_MS;
static unsigned long thresholdUrgent   = ALERT_URGENT_MS;
static unsigned long thresholdCritical = ALERT_CRITICAL_MS;

// Calculate alert level from duration
static AlertLevel levelFromDuration(unsigned long duration) {
  if (duration >= thresholdCritical) return ALERT_CRITICAL;
  if (duration >= thresholdUrgent)   return ALERT_URGENT;
  if (duration >= thresholdModerate) return ALERT_MODERATE;
  if (duration >= thresholdGentle)   return ALERT_GENTLE;
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

static void onThresholdsChanged(EventType event, int payload) {
  // BLE module stores thresholds in seconds — we need milliseconds
  // The BLE module publishes this event after updating its own threshold array.
  // We read the new values from the BLE characteristic via a shared approach:
  // The payload is unused; the ble_output module calls speechTimerSetThresholds() directly.
  // (This event just signals that thresholds changed, for logging purposes.)
  Serial.printf("[SpeechTimer] Thresholds updated: %lu/%lu/%lu/%lums\n",
                thresholdGentle, thresholdModerate, thresholdUrgent, thresholdCritical);
}

static void resetTimerState() {
  timerRunning = false;
  speechStartTime = 0;
  isSpeaking = false;
  if (currentLevel != ALERT_NONE) {
    currentLevel = ALERT_NONE;
    eventBusPublish(EVENT_ALERT_LEVEL_CHANGED, ALERT_NONE);
  }
}

static void onSessionStarted(EventType event, int payload) {
  resetTimerState();
  Serial.println("[SpeechTimer] Session started — timer reset");
}

static void onSessionStopped(EventType event, int payload) {
  resetTimerState();
  Serial.println("[SpeechTimer] Session stopped — timer reset");
}

void speechTimerInit() {
  eventBusSubscribe(EVENT_SPEECH_STARTED, onSpeechEvent);
  eventBusSubscribe(EVENT_SPEECH_ENDED, onSpeechEvent);
  eventBusSubscribe(EVENT_SESSION_STARTED, onSessionStarted);
  eventBusSubscribe(EVENT_SESSION_STOPPED, onSessionStopped);
  eventBusSubscribe(EVENT_THRESHOLDS_CHANGED, onThresholdsChanged);
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

void speechTimerSetThresholds(unsigned long gentle, unsigned long moderate,
                               unsigned long urgent, unsigned long critical) {
  thresholdGentle   = gentle;
  thresholdModerate = moderate;
  thresholdUrgent   = urgent;
  thresholdCritical = critical;
}
