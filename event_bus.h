#ifndef EVENT_BUS_H
#define EVENT_BUS_H

#include <Arduino.h>

// ============================================
// Event Types
// ============================================
enum EventType {
  EVENT_SPEECH_STARTED,        // VAD detected speech
  EVENT_SPEECH_ENDED,          // VAD detected silence
  EVENT_ALERT_LEVEL_CHANGED,   // Timer crossed a threshold
  EVENT_MODE_CHANGED,          // Button toggled device mode
  EVENT_BUTTON_SINGLE,         // Single press detected
  EVENT_BUTTON_DOUBLE,         // Double press detected
  EVENT_BUTTON_LONG,           // Long press detected
  EVENT_BATTERY_LOW,           // Battery below warning threshold
  EVENT_BATTERY_CRITICAL,      // Battery below shutdown threshold
  EVENT_SENSITIVITY_CHANGED,   // VAD sensitivity level changed (payload = index)
  EVENT_SD_READY,              // SD card status (payload: 1 = ready, 0 = not available)
  EVENT_CAPTURE_STARTED,       // Recording started (capture mode)
  EVENT_CAPTURE_STOPPED,       // Recording stopped (capture mode)
  EVENT_COUNT                  // Total number of event types
};

// Alert levels (payload for EVENT_ALERT_LEVEL_CHANGED)
enum AlertLevel {
  ALERT_NONE = 0,
  ALERT_GENTLE = 1,
  ALERT_MODERATE = 2,
  ALERT_URGENT = 3,
  ALERT_CRITICAL = 4
};

// Device modes (payload for EVENT_MODE_CHANGED)
enum DeviceMode {
  MODE_MONITORING = 0,
  MODE_PRESENTATION = 1,
  MODE_DEEP_SLEEP = 2
};

// Callback signature: receives event type and an int payload
typedef void (*EventCallback)(EventType event, int payload);

// ============================================
// Public API
// ============================================
void eventBusInit();
void eventBusSubscribe(EventType event, EventCallback callback);
void eventBusPublish(EventType event, int payload);

#endif // EVENT_BUS_H
