#include "session_logger.h"
#include "event_bus.h"
#include "sd_card.h"
#include <SD.h>

// ============================================
// Session Statistics (accumulated via events)
// ============================================
static unsigned long sessionStartMs = 0;
static int alertCount = 0;
static int maxAlertLevel = 0;
static int currentSensitivity = 0;
static int speechSegments = 0;

// ============================================
// CSV file path
// ============================================
static const char* SESSION_CSV_PATH = "/RG/sessions.csv";

// ============================================
// Event Handlers
// ============================================

static void onAlertLevelChanged(EventType event, int payload) {
  alertCount++;
  if (payload > maxAlertLevel) {
    maxAlertLevel = payload;
  }
}

static void onSensitivityChanged(EventType event, int payload) {
  currentSensitivity = payload;
}

static void onSpeechStarted(EventType event, int payload) {
  speechSegments++;
}

// ============================================
// Public API
// ============================================

void sessionLoggerInit() {
  sessionStartMs = millis();
  alertCount = 0;
  maxAlertLevel = 0;
  currentSensitivity = 0;
  speechSegments = 0;

  eventBusSubscribe(EVENT_ALERT_LEVEL_CHANGED, onAlertLevelChanged);
  eventBusSubscribe(EVENT_SENSITIVITY_CHANGED, onSensitivityChanged);
  eventBusSubscribe(EVENT_SPEECH_STARTED, onSpeechStarted);

  Serial.println("[Session] Logger initialized");
}

void sessionLoggerUpdate() {
  // No-op — stats accumulated via event callbacks
}

void sessionLoggerFlush() {
  if (!sdCardIsReady()) {
    Serial.println("[Session] WARNING: SD card not ready — skipping flush");
    return;
  }

  unsigned long durationMs = millis() - sessionStartMs;

  // Open CSV file in append mode
  File csvFile = SD.open(SESSION_CSV_PATH, FILE_APPEND);
  if (!csvFile) {
    Serial.println("[Session] ERROR: Failed to open sessions.csv");
    return;
  }

  // Write header if file is new (size == 0)
  if (csvFile.size() == 0) {
    csvFile.println("boot_ms,duration_ms,alert_count,max_alert,sensitivity,speech_segments");
  }

  // Write one row of session data
  char row[128];
  snprintf(row, sizeof(row), "%lu,%lu,%d,%d,%d,%d",
           sessionStartMs, durationMs, alertCount, maxAlertLevel,
           currentSensitivity, speechSegments);
  csvFile.println(row);
  csvFile.close();

  // Log summary
  Serial.print("[Session] Logged — duration=");
  Serial.print(durationMs / 1000);
  Serial.print("s, alerts=");
  Serial.print(alertCount);
  Serial.print(", max_level=");
  Serial.print(maxAlertLevel);
  Serial.print(", segments=");
  Serial.println(speechSegments);

  // Reset counters for next session
  alertCount = 0;
  maxAlertLevel = 0;
  speechSegments = 0;
  sessionStartMs = millis();
}
