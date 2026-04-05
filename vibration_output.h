#ifndef VIBRATION_OUTPUT_H
#define VIBRATION_OUTPUT_H

#include <Arduino.h>

void vibrationOutputInit();    // Set up PWM on GPIO 3, subscribe to events
void vibrationOutputUpdate();  // Run vibration patterns (call every loop)

#endif // VIBRATION_OUTPUT_H
