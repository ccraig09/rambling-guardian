#include "audio_input.h"
#include "event_bus.h"
#include "config.h"
#include "ESP_I2S.h"

static I2SClass i2s;
static bool i2sReady = false;
static bool speechActive = false;
static int currentEnergy = 0;
static int currentSensitivity = 1;  // Default mode 2 (index 1)

// VAD state machine
static int aboveCount = 0;              // consecutive onset windows
static unsigned long lastAboveTime = 0;  // millis() of last above-threshold window

// Calculate energy with DC offset removal
// PDM mics have a large DC offset (~1340 on this board).
// We subtract the per-window mean so silence reads near zero.
static int calculateEnergy() {
  int16_t samples[AUDIO_SAMPLES_PER_WINDOW];
  int validCount = 0;

  // Pass 1: read all samples and compute mean (= DC offset)
  long dcSum = 0;
  for (int i = 0; i < AUDIO_SAMPLES_PER_WINDOW; i++) {
    int sample = i2s.read();
    if (sample != 0 && sample != -1 && sample != 1) {
      samples[validCount] = (int16_t)sample;
      dcSum += sample;
      validCount++;
    }
  }
  if (validCount == 0) return 0;
  int dcOffset = (int)(dcSum / validCount);

  // Pass 2: mean absolute deviation from DC offset
  long energySum = 0;
  for (int i = 0; i < validCount; i++) {
    energySum += abs(samples[i] - dcOffset);
  }
  return (int)(energySum / validCount);
}

static void onSensitivityChanged(EventType event, int payload) {
  audioSetSensitivity(payload);
}

void audioInputInit() {
  i2s.setPinsPdmRx(PIN_MIC_CLK, PIN_MIC_DATA);

  if (!i2s.begin(I2S_MODE_PDM_RX, AUDIO_SAMPLE_RATE,
                 I2S_DATA_BIT_WIDTH_16BIT, I2S_SLOT_MODE_MONO)) {
    Serial.println("[Audio] ERROR: Failed to initialize I2S microphone!");
    return;
  }

  i2sReady = true;
  eventBusSubscribe(EVENT_SENSITIVITY_CHANGED, onSensitivityChanged);
  Serial.println("[Audio] Microphone initialized (PDM RX, 16kHz, 16-bit mono)");
}

void audioInputUpdate() {
  if (!i2sReady) return;
  currentEnergy = calculateEnergy();
  int threshold = VAD_THRESHOLDS[currentSensitivity];
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
