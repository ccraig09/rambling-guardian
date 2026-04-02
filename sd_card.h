#ifndef SD_CARD_H
#define SD_CARD_H

#include <Arduino.h>

void sdCardInit();       // Mount SD card, create directories, publish EVENT_SD_READY
bool sdCardIsReady();    // Returns true if SD card is mounted and usable

#endif // SD_CARD_H
