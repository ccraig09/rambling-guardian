#ifndef BOOT_STATE_H
#define BOOT_STATE_H

#include <Arduino.h>

void bootStateInit();           // Read/increment boot ID from SD, must call after sdCardInit()
uint32_t bootStateGetId();      // Current boot ID (0 if SD unavailable)
uint16_t bootStateNextSessionSequence();  // Increment and return next session sequence for this boot

#endif // BOOT_STATE_H
