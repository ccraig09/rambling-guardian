#ifndef CAPTURE_MODE_H
#define CAPTURE_MODE_H

#include <Arduino.h>

void captureModeInit();    // Subscribe to events
void captureModeUpdate();  // Call every loop() — feeds audio to WAV writer when recording

#endif // CAPTURE_MODE_H
