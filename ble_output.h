#ifndef BLE_OUTPUT_H
#define BLE_OUTPUT_H

#include <Arduino.h>

void bleOutputInit();       // Set up NimBLE GATT server, subscribe to events
void bleOutputUpdate();     // Periodic BLE updates (call every loop)
bool bleIsConnected();      // Check if a BLE client is connected

#endif // BLE_OUTPUT_H
