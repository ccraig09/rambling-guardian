#include "capture_mode.h"
#include "event_bus.h"
#include "config.h"
#include "audio_input.h"
#include "wav_writer.h"
#include "sd_card.h"

// ============================================
// State Machine
// ============================================
enum CaptureState {
  CAPTURE_IDLE,
  CAPTURE_RECORDING
};

static CaptureState state = CAPTURE_IDLE;

// Silence auto-stop tracking
static bool speechActive = false;
static unsigned long lastSpeechEndTime = 0;

// ============================================
// Event Handlers
// ============================================

static void startRecording() {
  if (!wavWriterOpen()) {
    Serial.println("[Capture] Failed to open WAV file");
    return;
  }
  state = CAPTURE_RECORDING;
  speechActive = false;
  lastSpeechEndTime = millis();  // Start silence clock from now
  eventBusPublish(EVENT_CAPTURE_STARTED, 0);
  Serial.println("[Capture] Recording started");
}

static void stopRecording(const char* reason) {
  wavWriterClose();
  state = CAPTURE_IDLE;
  speechActive = false;
  eventBusPublish(EVENT_CAPTURE_STOPPED, 0);
  Serial.print("[Capture] Recording stopped (");
  Serial.print(reason);
  Serial.println(")");
}

static void onDoublePress(EventType event, int payload) {
  if (state == CAPTURE_IDLE) {
    if (!sdCardIsReady()) {
      Serial.println("[Capture] No SD card — cannot record");
      return;
    }
    startRecording();
  } else if (state == CAPTURE_RECORDING) {
    stopRecording("manual");
  }
}

static void onSpeechStarted(EventType event, int payload) {
  if (state == CAPTURE_RECORDING) {
    speechActive = true;
  }
}

static void onSpeechEnded(EventType event, int payload) {
  if (state == CAPTURE_RECORDING) {
    speechActive = false;
    lastSpeechEndTime = millis();
  }
}

// ============================================
// Public API
// ============================================

void captureModeInit() {
  eventBusSubscribe(EVENT_BUTTON_DOUBLE, onDoublePress);
  eventBusSubscribe(EVENT_SPEECH_STARTED, onSpeechStarted);
  eventBusSubscribe(EVENT_SPEECH_ENDED, onSpeechEnded);
  Serial.println("[Capture] Capture mode initialized");
}

void captureModeUpdate() {
  if (state != CAPTURE_RECORDING) return;

  // Feed audio samples to WAV writer
  const int16_t* buf = nullptr;
  int count = audioGetLastSamples(&buf);
  if (count > 0 && buf != nullptr) {
    wavWriterWriteSamples(buf, count);
  }

  // Check silence auto-stop
  if (!speechActive && (millis() - lastSpeechEndTime > CAPTURE_SILENCE_TIMEOUT_MS)) {
    stopRecording("5s silence");
  }
}
