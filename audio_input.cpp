#include "audio_input.h"
#include "event_bus.h"
#include "config.h"
#include "ESP_I2S.h"

static I2SClass i2s;
static bool i2sReady = false;
static bool speechActive = false;
static int currentEnergy = 0;
static int currentSensitivity = 0;  // Default: most sensitive (sensitivity level 0)

// VAD state machine
static int aboveCount = 0;              // consecutive onset windows
static unsigned long lastAboveTime = 0;  // millis() of last above-threshold window
static int calibratedBaseline = 0;  // set during boot calibration

// Raw audio sample buffer — shared between calculateEnergy() and audioGetLastSamples()
static int16_t sampleBuffer[AUDIO_SAMPLES_PER_WINDOW];
static int lastSampleCount = 0;

// Calculate energy with DC offset removal
// PDM mics have a large DC offset (~1340 on this board).
// We subtract the per-window mean so silence reads near zero.
#ifdef DEBUG_AUDIO
static unsigned long lastDebugDump = 0;
#endif

static int calculateEnergy() {
  // Read into file-scope sampleBuffer so audioGetLastSamples() can access it
  size_t bytesRead = i2s.readBytes((char*)sampleBuffer, sizeof(sampleBuffer));
  int sampleCount = bytesRead / sizeof(int16_t);
  lastSampleCount = sampleCount;
  if (sampleCount == 0) return 0;

  // Pass 1: compute DC offset (mean)
  long long dcSum = 0;
  for (int i = 0; i < sampleCount; i++) {
    dcSum += sampleBuffer[i];
  }
  int32_t dcOffset = (int32_t)(dcSum / sampleCount);

#ifdef DEBUG_AUDIO
  // Debug dump every 5 seconds
  if (millis() - lastDebugDump > 5000) {
    lastDebugDump = millis();
    Serial.print("[Audio] Raw(10): ");
    for (int i = 0; i < 10 && i < sampleCount; i++) {
      Serial.print(sampleBuffer[i]);
      Serial.print(" ");
    }
    Serial.print(" | cnt=");
    Serial.print(sampleCount);
    Serial.print(" | dcOff=");
    Serial.println(dcOffset);
  }
#endif

  // Pass 2: mean absolute deviation from DC offset
  long long energySum = 0;
  for (int i = 0; i < sampleCount; i++) {
    energySum += abs((int32_t)sampleBuffer[i] - dcOffset);
  }
  return (int)(energySum / sampleCount);
}

static void onSensitivityChanged(EventType event, int payload) {
  audioSetSensitivity(payload);
}

static void calibrateVAD() {
  Serial.println("[Audio] Calibrating VAD — sampling ambient noise (~6 seconds)...");

  // Discard first 5 windows — I2S PDM hardware needs time to settle after begin()
  for (int i = 0; i < 5; i++) {
    calculateEnergy();
    delay(AUDIO_WINDOW_MS);
  }

  long totalEnergy = 0;
  for (int i = 0; i < VAD_CALIBRATION_WINDOWS; i++) {
    int energy = calculateEnergy();
    totalEnergy += energy;
    delay(AUDIO_WINDOW_MS);  // 100ms between windows
  }

  int ambientEnergy = (int)(totalEnergy / VAD_CALIBRATION_WINDOWS);
  int rawThreshold = max(ambientEnergy * VAD_CALIBRATION_MULTIPLIER, VAD_MIN_THRESHOLD);
  calibratedBaseline = min(rawThreshold, VAD_MAX_CALIBRATED_THRESHOLD);

  if (ambientEnergy == 0) {
    Serial.println("[Audio] WARNING: ambient=0 — I2S may not be ready, using minimum threshold");
  } else if (rawThreshold > VAD_MAX_CALIBRATED_THRESHOLD) {
    Serial.println("[Audio] WARNING: High ambient noise detected — threshold capped. Boot in silence for best results.");
  }
  Serial.print("[Audio] Calibrated: ambient=");
  Serial.print(ambientEnergy);
  Serial.print(", threshold=");
  Serial.println(calibratedBaseline);
}

void audioInputInit() {
  i2s.setPinsPdmRx(PIN_MIC_CLK, PIN_MIC_DATA);

  if (!i2s.begin(I2S_MODE_PDM_RX, AUDIO_SAMPLE_RATE,
                 I2S_DATA_BIT_WIDTH_16BIT, I2S_SLOT_MODE_MONO)) {
    Serial.println("[Audio] ERROR: Failed to initialize I2S microphone!");
    return;
  }

  i2sReady = true;
  calibrateVAD();  // measure ambient noise and set initial threshold
  eventBusSubscribe(EVENT_SENSITIVITY_CHANGED, onSensitivityChanged);
  Serial.println("[Audio] Microphone initialized (PDM RX, 16kHz, 16-bit mono)");
}

void audioInputUpdate() {
  if (!i2sReady) return;
  currentEnergy = calculateEnergy();
  // Apply sensitivity level as a multiplier on top of calibrated baseline
  static const int SENSITIVITY_MULTIPLIERS[VAD_SENSITIVITY_LEVELS] = { 1, 2, 4, 8 };
  int threshold = (calibratedBaseline > 0)
    ? calibratedBaseline * SENSITIVITY_MULTIPLIERS[currentSensitivity]
    : VAD_THRESHOLDS[currentSensitivity];
  bool aboveThreshold = (currentEnergy > threshold);

  if (aboveThreshold) {
    aboveCount++;
    lastAboveTime = millis();
  }

  // Onset: require 2 consecutive windows above threshold to start
  if (!speechActive && aboveCount >= VAD_ONSET_WINDOWS) {
    speechActive = true;
    eventBusPublish(EVENT_SPEECH_STARTED, currentEnergy);
  }

  // Offset: only end speech after hangover period with no loud windows
  // This bridges natural gaps between syllables/words (100-400ms)
  if (speechActive && !aboveThreshold) {
    if ((millis() - lastAboveTime) > VAD_HANGOVER_MS) {
      speechActive = false;
      aboveCount = 0;
      eventBusPublish(EVENT_SPEECH_ENDED, currentEnergy);
    }
  }
}

int audioGetCurrentEnergy() {
  return currentEnergy;
}

void audioSetSensitivity(int level) {
  if (level >= 0 && level < VAD_SENSITIVITY_LEVELS) {
    currentSensitivity = level;
  }
}

int audioGetLastSamples(const int16_t** buf) {
  if (buf) {
    *buf = sampleBuffer;
  }
  return lastSampleCount;
}
