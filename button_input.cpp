#include "button_input.h"
#include "event_bus.h"
#include "config.h"

// ============================================
// Interrupt-driven button capture
// ============================================
// The main loop is slow (~100ms per cycle due to blocking I2S reads).
// Polling the button in loop() misses quick taps.
// Instead, a GPIO interrupt captures every press/release instantly,
// and buttonInputUpdate() processes the accumulated taps.
//
// Think of it like push notifications (interrupt) vs checking your
// phone every 10 seconds (polling). You never miss a tap now.

// ISR state — volatile because shared between interrupt and main code
static volatile int isrTapCount = 0;
static volatile unsigned long isrLastPressTime = 0;
static volatile unsigned long isrLastReleaseTime = 0;
static volatile bool isrButtonDown = false;

// Main-loop state
static bool longPressFired = false;

// ISR: fires on every button state change (press or release)
// Runs in microseconds — no Serial prints or blocking calls allowed
void IRAM_ATTR buttonISR() {
  unsigned long now = millis();
  bool pressed = (digitalRead(PIN_BUTTON) == LOW);  // Active low with pull-up

  if (pressed && !isrButtonDown) {
    // Button just pressed — debounce check
    if (now - isrLastReleaseTime > BUTTON_DEBOUNCE_MS) {
      isrButtonDown = true;
      isrLastPressTime = now;
    }
  } else if (!pressed && isrButtonDown) {
    // Button just released — debounce check
    if (now - isrLastPressTime > BUTTON_DEBOUNCE_MS) {
      isrButtonDown = false;
      isrLastReleaseTime = now;
      isrTapCount++;
    }
  }
}

void buttonInputInit() {
  pinMode(PIN_BUTTON, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(PIN_BUTTON), buttonISR, CHANGE);
  Serial.println("[Button] Initialized on GPIO " + String(PIN_BUTTON) + " (interrupt-driven)");
}

void buttonInputUpdate() {
  unsigned long now = millis();

  // Long press: button held down for 3+ seconds
  if (isrButtonDown && !longPressFired && (now - isrLastPressTime >= BUTTON_LONG_PRESS_MS)) {
    longPressFired = true;
    noInterrupts();
    isrTapCount = 0;  // Cancel any accumulated taps
    interrupts();
    eventBusPublish(EVENT_BUTTON_LONG, 0);
    Serial.println("[Button] Long press");
  }

  // Reset long press flag after release
  if (!isrButtonDown && longPressFired) {
    longPressFired = false;
  }

  // Multi-tap window expired — fire appropriate event
  if (isrTapCount > 0 && !isrButtonDown && (now - isrLastReleaseTime > BUTTON_MULTI_TAP_MS)) {
    // Atomically read and reset tap count (prevent ISR race condition)
    noInterrupts();
    int taps = isrTapCount;
    isrTapCount = 0;
    interrupts();

    if (taps == 1) {
      eventBusPublish(EVENT_BUTTON_SINGLE, 0);
      Serial.println("[Button] Single press");
    } else if (taps == 2) {
      eventBusPublish(EVENT_BUTTON_DOUBLE, 0);
      Serial.println("[Button] Double press");
    }
    // Triple+ reserved for Phase B (alert modality toggle)
  }
}
