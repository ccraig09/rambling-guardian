#ifndef SPEECH_TIMER_H
#define SPEECH_TIMER_H

#include <Arduino.h>

void speechTimerInit();
void speechTimerUpdate();  // Call every loop() iteration
unsigned long speechTimerGetDuration();  // Current speech duration in ms
AlertLevel speechTimerGetLevel();  // Current alert level

#endif // SPEECH_TIMER_H
