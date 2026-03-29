#include "audio_input.h"
#include "event_bus.h"
#include "config.h"
#include "ESP_I2S.h"

static I2SClass i2s;
static bool i2sReady = false;
static bool speechActive = false;
static int currentEnergy = 0;
static int currentSensitivity = 1;  // Default mode 2 (index 1)

// Calculate mean absolute amplitude from audio samples over a window
static int calculateEnergy() {
  long sum = 0;
  int validSamples = 0;

  for (int i = 0; i < AUDIO_SAMPLES_PER_WINDOW; i++) {
    int sample = i2s.read();
    // Filter invalid samples (0, -1, 1 are noise artifacts)
    if (sample != 0 && sample != -1 && sample != 1) {
      sum += abs(sample);
      validSamples++;
    }
  }

  if (validSamples == 0) return 0;
  return (int)(sum / validSamples);
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
  bool isSpeech = (currentEnergy > threshold);

  if (isSpeech && !speechActive) {
    speechActive = true;
    eventBusPublish(EVENT_SPEECH_STARTED, currentEnergy);
  } else if (!isSpeech && speechActive) {
    speechActive = false;
    eventBusPublish(EVENT_SPEECH_ENDED, currentEnergy);
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
