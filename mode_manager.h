#ifndef MODE_MANAGER_H
#define MODE_MANAGER_H

#include <Arduino.h>
#include "event_bus.h"

void modeManagerInit();
DeviceMode modeManagerGetMode();

#endif // MODE_MANAGER_H
