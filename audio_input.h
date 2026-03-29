#ifndef AUDIO_INPUT_H
#define AUDIO_INPUT_H

#include <Arduino.h>

void audioInputInit();
void audioInputUpdate();  // Call every loop() iteration
int  audioGetCurrentEnergy();  // For debugging
void audioSetSensitivity(int level);  // 0-3, indexes VAD_THRESHOLDS

#endif // AUDIO_INPUT_H
