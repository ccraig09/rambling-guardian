#include "button_input.h"
#include "event_bus.h"
#include "config.h"

static bool lastState = HIGH;        // Pull-up means HIGH when not pressed
static bool buttonDown = false;
static unsigned long pressStartTime = 0;
static unsigned long lastReleaseTime = 0;
static int tapCount = 0;
static bool longPressFired = false;

void buttonInputInit() {
  pinMode(PIN_BUTTON, INPUT_PULLUP);
  Serial.println("[Button] Initialized on GPIO " + String(PIN_BUTTON));
}

void buttonInputUpdate() {
  bool currentState = digitalRead(PIN_BUTTON);
  unsigned long now = millis();

  // Debounce
  static unsigned long lastChange = 0;
  if (currentState != lastState) {
    lastChange = now;
  }
  lastState = currentState;
  if ((now - lastChange) < BUTTON_DEBOUNCE_MS) return;

  bool pressed = (currentState == LOW);  // Active low with pull-up

  // Button just pressed
  if (pressed && !buttonDown) {
    buttonDown = true;
    pressStartTime = now;
    longPressFired = false;
  }

  // Button held — check for long press
  if (pressed && buttonDown && !longPressFired) {
    if ((now - pressStartTime) >= BUTTON_LONG_PRESS_MS) {
      longPressFired = true;
      tapCount = 0;
      eventBusPublish(EVENT_BUTTON_LONG, 0);
      Serial.println("[Button] Long press");
    }
  }

  // Button just released
  if (!pressed && buttonDown) {
    buttonDown = false;
    if (!longPressFired) {
      tapCount++;
      lastReleaseTime = now;
    }
  }

  // Multi-tap window expired — fire appropriate event
  if (tapCount > 0 && !buttonDown && (now - lastReleaseTime) > BUTTON_MULTI_TAP_MS) {
    if (tapCount == 1) {
      eventBusPublish(EVENT_BUTTON_SINGLE, 0);
      Serial.println("[Button] Single press");
    } else if (tapCount == 2) {
      eventBusPublish(EVENT_BUTTON_DOUBLE, 0);
      Serial.println("[Button] Double press");
    }
    // Triple+ reserved for future phases
    tapCount = 0;
  }
}
