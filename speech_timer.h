#ifndef SPEECH_TIMER_H
#define SPEECH_TIMER_H

#include <Arduino.h>
#include "event_bus.h"

void speechTimerInit();
void speechTimerUpdate();  // Call every loop() iteration
unsigned long speechTimerGetDuration();  // Current speech duration in ms
AlertLevel speechTimerGetLevel();  // Current alert level
void speechTimerSetThresholds(unsigned long gentle, unsigned long moderate,
                               unsigned long urgent, unsigned long critical);  // Runtime threshold update

#endif // SPEECH_TIMER_H
