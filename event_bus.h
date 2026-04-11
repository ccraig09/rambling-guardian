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
  EVENT_BUTTON_TRIPLE,         // Triple press detected
  EVENT_MODALITY_CHANGED,      // Alert modality changed (payload: AlertModality)
  EVENT_BLE_CONNECTED,         // BLE client connected
  EVENT_BLE_DISCONNECTED,      // BLE client disconnected
  EVENT_THRESHOLDS_CHANGED,    // Alert thresholds updated via BLE
  EVENT_SESSION_START_REQUESTED,  // Trigger wants to start session (payload: TriggerSource)
  EVENT_SESSION_STOP_REQUESTED,   // Trigger wants to stop session (payload: TriggerSource)
  EVENT_SESSION_STARTED,          // Session confirmed active (payload: TriggerSource)
  EVENT_SESSION_STOPPED,          // Session confirmed ended (payload: TriggerSource)
  EVENT_STORAGE_LOW,              // SD storage below threshold (payload: free KB)
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
  MODE_IDLE = 0,            // Default on boot. Not listening.
  MODE_ACTIVE_SESSION = 1,  // Triggered monitoring. VAD + speech timer + alerts.
  MODE_MANUAL_NOTE = 2,     // Double-press capture to SD.
  MODE_DEEP_SLEEP = 3,      // Long-press. Wake on button.
  // Reserved: MODE_PRESENTATION_COACH = 4 (future)
};

// Alert modality (payload for EVENT_MODALITY_CHANGED)
enum AlertModality {
  MODALITY_LED_ONLY = 0,
  MODALITY_VIBRATION_ONLY = 1,
  MODALITY_BOTH = 2
};

// Trigger source (payload for EVENT_SESSION_START/STOP_REQUESTED/STARTED/STOPPED)
enum TriggerSource {
  TRIGGER_BUTTON = 0,
  TRIGGER_BLE_COMMAND = 1,
  TRIGGER_WATCH = 2,      // future
  TRIGGER_REMOTE = 3,     // future
  TRIGGER_AUTO_TIMEOUT = 4
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
