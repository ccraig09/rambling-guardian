#ifndef MODE_MANAGER_H
#define MODE_MANAGER_H

#include <Arduino.h>
#include "event_bus.h"

void modeManagerInit();
DeviceMode modeManagerGetMode();
AlertModality modeManagerGetModality();
TriggerSource modeManagerGetTriggerSource();

#endif // MODE_MANAGER_H
