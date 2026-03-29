#include "event_bus.h"

// Max subscribers per event type
#define MAX_SUBSCRIBERS 8

// Registry: array of callback lists, one per event type
static EventCallback subscribers[EVENT_COUNT][MAX_SUBSCRIBERS];
static uint8_t subscriberCount[EVENT_COUNT];

void eventBusInit() {
  for (int i = 0; i < EVENT_COUNT; i++) {
    subscriberCount[i] = 0;
    for (int j = 0; j < MAX_SUBSCRIBERS; j++) {
      subscribers[i][j] = nullptr;
    }
  }
  Serial.println("[EventBus] Initialized");
}

void eventBusSubscribe(EventType event, EventCallback callback) {
  if (event >= EVENT_COUNT) return;
  int idx = subscriberCount[event];
  if (idx >= MAX_SUBSCRIBERS) {
    Serial.println("[EventBus] ERROR: Max subscribers reached");
    return;
  }
  subscribers[event][idx] = callback;
  subscriberCount[event]++;
}

// NOTE: publish() is synchronous and re-entrant. Callbacks MUST NOT
// subscribe or unsubscribe during execution. Recursive publish() calls
// (a subscriber publishing a new event) are safe up to ~5 levels deep.
void eventBusPublish(EventType event, int payload) {
  if (event >= EVENT_COUNT) return;
  for (int i = 0; i < subscriberCount[event]; i++) {
    if (subscribers[event][i] != nullptr) {
      subscribers[event][i](event, payload);
    }
  }
}
