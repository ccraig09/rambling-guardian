#ifndef SESSION_LOGGER_H
#define SESSION_LOGGER_H

#include <Arduino.h>

void sessionLoggerInit();    // Subscribe to events, start tracking
void sessionLoggerUpdate();  // No-op for now (stats accumulated via events)
void sessionLoggerFlush();   // Write current stats to CSV and reset counters

#endif // SESSION_LOGGER_H
