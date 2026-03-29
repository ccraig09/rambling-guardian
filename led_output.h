#ifndef LED_OUTPUT_H
#define LED_OUTPUT_H

#include <Arduino.h>

void ledOutputInit();
void ledOutputUpdate();  // Call every loop() — handles animations

#endif // LED_OUTPUT_H
