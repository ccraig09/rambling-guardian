#ifndef AUDIO_INPUT_H
#define AUDIO_INPUT_H

#include <Arduino.h>

void audioInputInit();
void audioInputUpdate();  // Call every loop() iteration
int  audioGetCurrentEnergy();  // For debugging
void audioSetSensitivity(int level);  // 0-3, indexes VAD_THRESHOLDS

// Get pointer to last audio window's raw samples (before DC offset removal).
// Sets *buf to point to the internal sample buffer.
// Returns number of samples available (0 if none yet).
int audioGetLastSamples(const int16_t** buf);

void audioInputSuspend();   // Stop I2S DMA reads (saves power in IDLE)
void audioInputResume();    // Restart I2S and re-calibrate VAD
bool audioInputIsActive();  // True if I2S is running and processing

#endif // AUDIO_INPUT_H
