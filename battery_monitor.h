#ifndef BATTERY_MONITOR_H
#define BATTERY_MONITOR_H

#include <Arduino.h>

void batteryMonitorInit();
void batteryMonitorUpdate();  // Call every loop() iteration
int  batteryGetPercent();

#endif // BATTERY_MONITOR_H
