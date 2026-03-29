# Arduino Platform Guide

Guide for programming classic Arduino boards (Uno, Nano, Mega) based on AVR microcontrollers.

## Overview

Arduino boards are beginner-friendly microcontrollers with a simple IDE and vast library ecosystem.

## Board Specifications

| Board | MCU | Flash | SRAM | GPIO | Analog | PWM | Voltage |
|-------|-----|-------|------|------|--------|-----|---------|
| Uno | ATmega328P | 32KB | 2KB | 14 | 6 | 6 | 5V |
| Nano | ATmega328P | 32KB | 2KB | 14 | 8 | 6 | 5V |
| Mega | ATmega2560 | 256KB | 8KB | 54 | 16 | 15 | 5V |
| Leonardo | ATmega32U4 | 32KB | 2.5KB | 20 | 12 | 7 | 5V |

## Toolchain Setup

```bash
# Install arduino-cli
curl -fsSL https://raw.githubusercontent.com/arduino/arduino-cli/master/install.sh | sh
export PATH=$PATH:$HOME/bin

# Initialize
arduino-cli config init
arduino-cli core update-index

# Install AVR core
arduino-cli core install arduino:avr
```

## Pin Reference

### Arduino Uno

**Digital Pins:** 0-13
- D0, D1: Serial (RX, TX) - avoid if using Serial
- D3, D5, D6, D9, D10, D11: PWM (~)

**Analog Pins:** A0-A5
- Can also be used as digital (14-19)

**I2C:** A4 (SDA), A5 (SCL)
**SPI:** D10 (SS), D11 (MOSI), D12 (MISO), D13 (SCK)

### Arduino Mega

**Digital Pins:** 0-53
- PWM: 2-13, 44-46

**Analog Pins:** A0-A15

**I2C:** SDA=20, SCL=21
**SPI:** SS=53, MOSI=51, MISO=50, SCK=52

## Basic Code Structure

```cpp
/*
 * Arduino Project Template
 */

// Pin definitions
const int LED_PIN = 13;
const int BUTTON_PIN = 2;

// Global variables
int buttonState = 0;

void setup() {
  // Initialize serial
  Serial.begin(9600);
  
  // Configure pins
  pinMode(LED_PIN, OUTPUT);
  pinMode(BUTTON_PIN, INPUT_PULLUP);
  
  Serial.println("Setup complete");
}

void loop() {
  // Read input
  buttonState = digitalRead(BUTTON_PIN);
  
  // Control output
  digitalWrite(LED_PIN, buttonState == LOW ? HIGH : LOW);
  
  delay(10);
}
```

## Common Operations

### Digital I/O

```cpp
pinMode(13, OUTPUT);        // Set pin as output
pinMode(2, INPUT);          // Set pin as input
pinMode(3, INPUT_PULLUP);   // Input with internal pullup

digitalWrite(13, HIGH);     // Set pin HIGH (5V)
digitalWrite(13, LOW);      // Set pin LOW (0V)

int state = digitalRead(2); // Read pin state
```

### Analog I/O

```cpp
// Read analog (0-1023 for 10-bit ADC)
int value = analogRead(A0);

// Convert to voltage
float voltage = value * (5.0 / 1023.0);

// PWM output (0-255)
analogWrite(9, 128);  // 50% duty cycle
```

### Serial Communication

```cpp
Serial.begin(9600);           // Initialize at 9600 baud
Serial.println("Hello");      // Print with newline
Serial.print("Value: ");
Serial.print(value);

// Read data
if (Serial.available() > 0) {
  char c = Serial.read();
  String line = Serial.readStringUntil('\n');
}
```

## Libraries

See `references/libraries.md` for comprehensive library guide.

**Common libraries:**
```cpp
#include <Wire.h>              // I2C
#include <SPI.h>               // SPI
#include <Servo.h>             // Servo motors
#include <LiquidCrystal.h>     // LCD displays
#include <SD.h>                // SD cards
#include <EEPROM.h>            // Non-volatile storage
```

## Compilation & Upload

```bash
# Compile
arduino-cli compile --fqbn arduino:avr:uno ./project

# Upload
arduino-cli upload -p /dev/ttyACM0 --fqbn arduino:avr:uno ./project

# Combined
arduino-cli compile --upload -p /dev/ttyACM0 --fqbn arduino:avr:uno ./project

# Serial monitor
arduino-cli monitor -p /dev/ttyACM0 -c baudrate=9600
```

## FQBNs

- Arduino Uno: `arduino:avr:uno`
- Arduino Nano: `arduino:avr:nano`
- Arduino Mega: `arduino:avr:mega`
- Arduino Leonardo: `arduino:avr:leonardo`

## Best Practices

### Memory Management

**Use F() macro for strings:**
```cpp
Serial.println(F("This string stays in flash, not RAM"));
```

**Use PROGMEM for constants:**
```cpp
const char message[] PROGMEM = "Long message stored in flash";
```

### Non-Blocking Code

**Bad (blocking):**
```cpp
void loop() {
  digitalWrite(LED, HIGH);
  delay(1000);
  digitalWrite(LED, LOW);
  delay(1000);
}
```

**Good (non-blocking):**
```cpp
unsigned long previousMillis = 0;
const long interval = 1000;

void loop() {
  unsigned long currentMillis = millis();
  
  if (currentMillis - previousMillis >= interval) {
    previousMillis = currentMillis;
    digitalWrite(LED, !digitalRead(LED));
  }
  
  // Other code can run here
}
```

## Troubleshooting

**Upload failed:**
- Check correct board selected
- Try pressing reset button
- Close Serial Monitor
- Check cable (must be data cable)

**Not enough memory:**
- Use F() macro
- Remove unused libraries
- Reduce global variables
- Use smaller data types

**Port permission denied:**
```bash
sudo usermod -a -G dialout $USER
# Log out and back in
```

For more details, see official Arduino documentation at arduino.cc
