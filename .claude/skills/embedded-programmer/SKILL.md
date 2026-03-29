---
name: embedded-programmer
description: Program any embedded hardware (Arduino, ESP32, STM32, Raspberry Pi, etc.) with full hardware discovery, interactive project planning, code generation, compilation, flashing, and live testing dashboards. Use this skill for microcontroller programming, embedded systems, IoT projects, hardware prototyping, robotics, or any physical computing project. Triggers on mentions of: Arduino, ESP32, ESP8266, STM32, Raspberry Pi, Pico, microcontroller, embedded, IoT, sensors, hardware programming, GPIO, I2C, SPI, UART, or board programming.
---

# Embedded Hardware Programmer Skill

A comprehensive, hardware-agnostic skill for programming embedded systems from hardware detection through live testing and deployment.

## Overview

This skill provides a unified workflow for programming ANY embedded hardware:
- **Microcontrollers**: Arduino, ESP32, STM32, nRF52, RP2040, etc.
- **Single Board Computers**: Raspberry Pi, BeagleBone, Jetson Nano, etc.
- **Development Boards**: Custom boards, shields, breakouts, etc.

## Universal Workflow

```
1. Hardware Detection → Identify board, toolchain, capabilities
2. Interactive Planning → Understand requirements, suggest projects
3. Code Generation → Write optimized code for the platform
4. Build & Flash → Compile and upload to hardware
5. Live Testing → Create dashboards and monitoring tools
```

## Phase 0: Initial Assessment & Hardware Identification

**Goal**: Gather information from the user and hardware to accurately identify the platform.

### Step 0.1: User Interview (Always Start Here)

**Before any automated detection**, ask the user targeted questions to build an educated guess about their hardware. This helps identify boards that may not be auto-detectable or require specific handling.

#### Initial Questions

Ask these questions in a conversational, friendly way:

**Question 1: What board do you have?**
```
"Let's start by learning about your hardware. What board are you working with?"

Listen for:
- Brand names: "Arduino", "ESP32", "Raspberry Pi", "STM32", "Blue Pill"
- Board names: "Uno", "Nano", "NodeMCU", "Pi Zero", "Black Pill"
- Chip names: "ATmega328", "ESP32-WROOM", "STM32F103", "RP2040"
```

**Question 2: What's written on the board?**
```
"Can you tell me what text or markings you see on the board itself?
This could be:
- Model numbers (e.g., 'UNO R3', 'ESP-WROOM-32', 'STM32F103C8T6')
- Manufacturer names
- Version numbers
- Chip markings"
```

**Question 3: Physical characteristics**
```
"A few quick details about the physical board:
- What color is it? (Blue boards are often STM32 clones, red/green often Arduino)
- Approximate size? (Credit card = Pi, small USB stick = Arduino Nano/ESP8266)
- Does it have WiFi/Bluetooth antenna? (Visible antenna = ESP32/ESP8266)
- USB connector type? (Micro-USB, USB-C, Mini-USB, or none?)"
```

**Question 4: Where did you get it?**
```
"Where did this board come from?
- Official (Arduino.cc, Raspberry Pi Foundation)
- Clone/compatible (AliExpress, Amazon)
- Kit (which kit?)
- Part of a project (which one?)"
```

**Question 5: What's it connected to?**
```
"How is it currently connected to your computer?
- USB cable (what shows up when you plug it in?)
- Serial adapter
- Programmer (ST-Link, FTDI, etc.)
- Not connected yet"
```

#### Build Initial Profile

Based on answers, create an initial profile:

```python
initial_profile = {
    'suspected_platform': 'esp32',  # Best guess
    'confidence': 'medium',  # low, medium, high
    'indicators': [
        'User said "ESP32"',
        'Board has WiFi antenna visible',
        'USB shows up as CP2102 serial'
    ],
    'alternative_platforms': ['esp8266', 'esp32-s2'],  # Possibilities
    'needs_clarification': []  # Questions to ask if detection fails
}
```

**Example educated guesses:**

| User Says | Color | Size | Antenna | → Platform Guess |
|-----------|-------|------|---------|------------------|
| "Arduino" | Any | Small | No | Arduino Uno/Nano |
| "Blue Pill" | Blue | Small | No | STM32F103C8T6 |
| "ESP32" | Any | Medium | Yes | ESP32 |
| "Raspberry Pi" | Green | Card | Maybe | Raspberry Pi |
| "NodeMCU" | Any | Medium | Yes | ESP8266 |
| "Pico" | Green | Thumb | No | RP2040 |

#### Present Hypothesis to User

```
Based on what you've told me, I believe you have:

🔍 Most likely: ESP32 DevKit V1
   Confidence: High
   
   Characteristics:
   • WiFi + Bluetooth capable
   • 3.3V logic
   • 36 GPIO pins
   • USB-to-Serial: CP2102
   
📋 Possible alternatives:
   • ESP32-S2 (WiFi only, no Bluetooth)
   • ESP32-C3 (RISC-V based)

Does this sound right? If not, I'll adjust based on detection.
```

### Step 0.2: Automated Hardware Detection

Now that we have an educated guess, probe the hardware to confirm and get exact details:

```bash
# USB device detection
lsusb
# Look for:
# - Arduino: VID 2341 (official), 1A86 (CH340), 0403 (FTDI)
# - ESP32: VID 10C4 (CP210x), 1A86 (CH340)
# - STM32: VID 0483 (ST-Link)
# - Raspberry Pi: Check /proc/cpuinfo
```

Run universal detection to identify all connected devices:

```bash
# List all USB/serial devices
ls /dev/tty* | grep -E "(USB|ACM|AMA)"

# Check for Arduino-compatible boards
arduino-cli board list 2>/dev/null || echo "arduino-cli not available"

# Check for STM32 tools
st-info --probe 2>/dev/null || echo "stlink tools not available"

# Check for Raspberry Pi (if running on Pi)
cat /proc/cpuinfo | grep -i "raspberry" || echo "Not a Raspberry Pi"

# Check for Platform IO devices
pio device list 2>/dev/null || echo "platformio not available"

# Generic USB device info
lsusb 2>/dev/null || echo "lsusb not available"
```

### Step 0.3: Verify Against Initial Hypothesis

Compare automated detection results with the initial user-provided information:

```python
def verify_detection(initial_profile, detection_results):
    """
    Compare user's description with automated detection
    """
    if detection_results['platform'] == initial_profile['suspected_platform']:
        print("✅ Detection confirms your board:")
        print(f"   Platform: {detection_results['platform']}")
        print(f"   Board: {detection_results['board_name']}")
        return 'confirmed'
    
    elif detection_results['platform'] in initial_profile['alternative_platforms']:
        print("⚠️  Close match - slightly different variant:")
        print(f"   You mentioned: {initial_profile['suspected_platform']}")
        print(f"   Detected: {detection_results['platform']}")
        print("   This is normal for board variants.")
        return 'variant'
    
    else:
        print("❗ Unexpected detection result:")
        print(f"   You described: {initial_profile['suspected_platform']}")
        print(f"   But detected: {detection_results['platform']}")
        print("\n   Possible reasons:")
        print("   • Wrong USB cable/port")
        print("   • Different board than expected")
        print("   • Driver issue")
        print("\n   Which seems more likely to you?")
        return 'mismatch'
```

**Handle mismatches:**

```
If detection contradicts user input:

1. Show both sets of information
2. Ask user to verify:
   - "You mentioned it's an Arduino, but I'm detecting an ESP8266"
   - "Can you double-check the board markings?"
   - "Is it possible it's a compatible/clone board?"

3. Let user decide:
   - Trust detection (usual case)
   - Trust user input (if detection failed)
   - Investigate further (ask more questions)
```

### Step 0.4: Identify Hardware Platform

Based on detection results and user verification, determine the platform:

| Detection Pattern | Platform | Toolchain |
|------------------|----------|-----------|
| `arduino:avr:*` | Arduino AVR | arduino-cli |
| `esp32:esp32:*` | ESP32 | arduino-cli or ESP-IDF |
| `esp8266:esp8266:*` | ESP8266 | arduino-cli |
| STLink detected | STM32 | STM32CubeIDE / PlatformIO |
| `/dev/ttyAMA0` on Pi | Raspberry Pi | Python/C++ native |
| `VID 2E8A` (RP2040) | Raspberry Pi Pico | arduino-cli / MicroPython |
| Nordic SEGGER | nRF52 | nRF SDK / Zephyr |

### Step 0.5: Load Hardware-Specific Configuration

**Critical**: Based on identified platform, read the appropriate reference file:

```bash
# Load board-specific documentation
view /mnt/skills/*/embedded-programmer/references/boards/{platform}.md
```

**Available platform guides:**
- `arduino.md` - Arduino Uno, Nano, Mega (AVR-based)
- `esp32.md` - ESP32, ESP32-S2/S3/C3 (WiFi/BLE)
- `esp8266.md` - ESP8266 (WiFi)
- `stm32.md` - STM32 family (ARM Cortex-M)
- `rpi.md` - Raspberry Pi (Linux SBC)
- `rp2040.md` - Raspberry Pi Pico (RP2040)
- `nrf52.md` - Nordic nRF52 (BLE)

**Each platform guide contains:**
- Toolchain installation
- Pin mappings
- Unique capabilities
- Library ecosystem
- Code examples
- Best practices

### Step 0.6: Install Required Toolchain

Based on the platform, install necessary tools:

**Arduino-compatible (Arduino, ESP32, ESP8266, RP2040):**
```bash
# Install arduino-cli if not present
curl -fsSL https://raw.githubusercontent.com/arduino/arduino-cli/master/install.sh | sh
export PATH=$PATH:$HOME/bin

# Initialize and update
arduino-cli config init
arduino-cli core update-index

# Install platform-specific core
arduino-cli core install {platform_core}
# Examples:
# arduino-cli core install arduino:avr
# arduino-cli core install esp32:esp32
# arduino-cli core install rp2040:rp2040
```

**STM32:**
```bash
# Option 1: PlatformIO (recommended)
pip install platformio --break-system-packages

# Option 2: STM32CubeProgrammer
# Download from STMicroelectronics website

# Option 3: stlink tools
sudo apt-get install stlink-tools
```

**Raspberry Pi:**
```bash
# GPIO libraries
pip install RPi.GPIO gpiozero --break-system-packages

# Optional: WiringPi for C/C++
sudo apt-get install wiringpi
```

**Platform IO (Universal):**
```bash
# Supports 1000+ boards
pip install platformio --break-system-packages
pio system info
```

## Phase 1: Hardware Discovery

**Goal**: Understand the specific hardware capabilities and connected components.

### Step 1.1: Get Board Specifications

Once platform is identified, extract detailed specs from the platform guide:

```python
# Example for any platform
specs = {
    'platform': 'esp32',
    'board': 'ESP32 DevKit V1',
    'cpu': 'Dual-core Xtensa 240MHz',
    'ram': '520KB',
    'flash': '4MB',
    'gpio_count': 36,
    'voltage': '3.3V',
    'special_features': ['WiFi', 'Bluetooth', 'Touch', 'DAC']
}
```

### Step 1.2: Probe for Connected Components

Create and run a hardware discovery program appropriate for the platform:

**For Arduino-like platforms:** Upload a discovery sketch
**For Raspberry Pi:** Run a Python GPIO scan
**For STM32:** Use HAL initialization and probe peripherals

**Universal component detection:**
- Digital pin states (HIGH/LOW/floating)
- Analog readings (sensors, potentiometers)
- I2C bus scan (displays, sensors)
- SPI devices
- UART/Serial devices
- USB devices (for Pi/Linux boards)

### Step 1.3: Present Hardware Summary

Create a clear, formatted summary for the user:

```
╔══════════════════════════════════════════════════════════╗
║         HARDWARE DETECTED: ESP32 DevKit V1              ║
╚══════════════════════════════════════════════════════════╝

📋 Board Information
  • Platform: ESP32
  • Port: /dev/ttyUSB0
  • CPU: Dual-core Xtensa @ 240MHz
  • Memory: 520KB SRAM, 4MB Flash
  • Voltage: 3.3V

🔌 Available Interfaces
  • GPIO: 36 pins
  • ADC: 18 channels (12-bit)
  • DAC: 2 channels
  • PWM: 16 channels
  • I2C: 2 controllers
  • SPI: 4 controllers
  • UART: 3 controllers

⚡ Special Features
  • WiFi 802.11 b/g/n
  • Bluetooth Classic + BLE
  • 10x Capacitive Touch
  • Hall Effect Sensor

🛠️ Detected Components
  • I2C LCD at 0x27 (likely 16x2)
  • DHT sensor on GPIO 4
  • LED on GPIO 2 (built-in)
  • Button on GPIO 0 (boot button)

💡 Development Environment
  • Toolchain: ESP-IDF / Arduino
  • Compiler: xtensa-gcc
  • Upload: esptool.py
```

## Phase 2: Interactive Project Planning

**Goal**: Understand what the user wants to build and ensure feasibility.

### Step 2.1: Understand Requirements

Ask targeted questions based on detected hardware:

**For microcontrollers (Arduino, ESP32, STM32):**
- What inputs do you want to use? (sensors, buttons, serial)
- What outputs? (LEDs, displays, motors, serial, network)
- What behavior? (event-driven, periodic, continuous)
- Any timing requirements? (real-time, low-latency)
- Power constraints? (battery, always-on)

**For SBCs (Raspberry Pi):**
- What language? (Python, C++, Node.js)
- Need GUI? (desktop app vs headless)
- Network requirements? (server, client, both)
- OS services needed? (systemd, cron, networking)

### Step 2.2: Capability-Aware Suggestions

Suggest projects based on what's actually possible:

**If WiFi available (ESP32, Pi):**
```
With WiFi capability, you could create:
1. IoT sensor dashboard with cloud logging
2. Web-controlled device (web server)
3. MQTT home automation node
4. Remote monitoring system
5. Wireless sensor network
```

**If limited resources (Arduino Uno):**
```
With 2KB RAM and no wireless, best options:
1. Local sensor display (I2C LCD)
2. Motor controller (serial commands)
3. Data logger (SD card)
4. LED patterns/animations
5. Button-controlled device
```

**If Linux SBC (Raspberry Pi):**
```
With full Linux, you could build:
1. Computer vision system (OpenCV)
2. Web application with database
3. Multi-threaded data processor
4. GUI control interface
5. Network service/daemon
```

### Step 2.3: Iterative Refinement

Keep asking until you have complete clarity:
- Pin assignments
- Communication protocols
- Data formats
- Error handling
- Edge cases
- Performance requirements

## Phase 3: Code Generation

**Goal**: Write platform-optimized code that follows best practices.

### Step 3.1: Select Programming Language

**Platform-appropriate languages:**
- Arduino/ESP32/ESP8266: C/C++ (Arduino framework)
- STM32: C/C++ (HAL/LL/CMSIS)
- Raspberry Pi: Python (primary), C/C++ (performance)
- RP2040: C++ (Arduino), MicroPython, or C (Pico SDK)
- nRF52: C (Nordic SDK), C++ (Arduino), Rust

### Step 3.2: Use Platform-Specific Templates

Load the appropriate template from the platform guide and generate code:

**Arduino-style (Arduino, ESP32, RP2040):**
```cpp
/*
 * Project: {PROJECT_NAME}
 * Board: {BOARD_NAME}
 * Description: {DESCRIPTION}
 */

// Include platform-specific headers
#include <Arduino.h>
{PLATFORM_INCLUDES}

// Pin definitions
#define LED_PIN 13
{PIN_DEFINITIONS}

// Global variables
{GLOBALS}

void setup() {
  Serial.begin(115200);
  pinMode(LED_PIN, OUTPUT);
  
  {SETUP_CODE}
  
  Serial.println("System initialized");
}

void loop() {
  {MAIN_LOGIC}
}

{HELPER_FUNCTIONS}
```

**STM32 HAL:**
```c
#include "main.h"

// Peripheral handles
I2C_HandleTypeDef hi2c1;
UART_HandleTypeDef huart2;

void SystemClock_Config(void);
static void MX_GPIO_Init(void);
static void MX_I2C1_Init(void);

int main(void) {
  HAL_Init();
  SystemClock_Config();
  MX_GPIO_Init();
  MX_I2C1_Init();
  
  {MAIN_CODE}
  
  while (1) {
    {LOOP_CODE}
  }
}
```

**Raspberry Pi Python:**
```python
#!/usr/bin/env python3
"""
{PROJECT_NAME}
{DESCRIPTION}
"""

import RPi.GPIO as GPIO
import time
{IMPORTS}

# Pin definitions
LED_PIN = 18
{PIN_DEFS}

def setup():
    GPIO.setmode(GPIO.BCM)
    GPIO.setup(LED_PIN, GPIO.OUT)
    {SETUP}

def main():
    setup()
    try:
        while True:
            {MAIN_LOOP}
    except KeyboardInterrupt:
        print("\nExiting...")
    finally:
        GPIO.cleanup()

if __name__ == "__main__":
    main()
```

### Step 3.3: Platform-Specific Best Practices

Apply best practices from the platform guide:

**Arduino/ESP32:**
- Use F() macro for strings
- Non-blocking delays with millis()
- Proper pin modes
- Serial debugging

**STM32:**
- Peripheral initialization order
- Interrupt priorities
- DMA setup
- Clock configuration

**Raspberry Pi:**
- GPIO cleanup
- Signal handling
- Thread safety
- Resource management

### Step 3.4: Save Project Structure

Create appropriate project structure:

**Arduino-like:**
```
/home/claude/projects/{project_name}/
├── {project_name}.ino
└── README.md
```

**PlatformIO:**
```
/home/claude/projects/{project_name}/
├── platformio.ini
├── src/
│   └── main.cpp
├── lib/
└── README.md
```

**Raspberry Pi:**
```
/home/claude/projects/{project_name}/
├── main.py
├── requirements.txt
├── systemd/
│   └── {project}.service
└── README.md
```

## Phase 4: Build & Flash

**Goal**: Compile and upload code to hardware.

### Step 4.1: Platform-Specific Build

**Arduino-cli (Arduino, ESP32, ESP8266, RP2040):**
```bash
arduino-cli compile --fqbn {FQBN} {project_path}
arduino-cli upload -p {PORT} --fqbn {FQBN} {project_path}
```

**PlatformIO (Universal):**
```bash
cd {project_path}
pio run                    # Compile
pio run --target upload    # Upload
pio device monitor         # Serial monitor
```

**STM32 (st-flash):**
```bash
make
st-flash write {binary}.bin 0x8000000
```

**Raspberry Pi:**
```bash
# Python - just run it
python3 main.py

# C/C++ - compile with GCC
gcc -o program main.c -lwiringPi
./program

# Install as service
sudo cp systemd/{project}.service /etc/systemd/system/
sudo systemctl enable {project}
sudo systemctl start {project}
```

### Step 4.2: Library Management

Install required libraries based on platform:

**Arduino-cli:**
```bash
arduino-cli lib search {library_name}
arduino-cli lib install "{Library Name}"
```

**PlatformIO:**
```bash
pio lib search {library}
pio lib install {library_id}
```

**Raspberry Pi:**
```bash
pip install -r requirements.txt --break-system-packages
```

### Step 4.3: Handle Build Errors

Parse errors and provide helpful explanations:
- Missing libraries → Install instructions
- Syntax errors → Code fixes
- Memory overflow → Optimization tips
- Wrong board selected → Correct FQBN
- Port access denied → Permission fixes

## Phase 5: Live Testing & Monitoring

**Goal**: Create appropriate testing interface for the platform.

### Step 5.1: Serial/UART Monitoring

**Universal serial monitor:**
```python
import serial
import time

def monitor_serial(port, baudrate=115200):
    try:
        ser = serial.Serial(port, baudrate, timeout=1)
        print(f"Connected to {port} at {baudrate} baud")
        print("=" * 60)
        
        while True:
            if ser.in_waiting:
                line = ser.readline().decode('utf-8', errors='ignore').strip()
                timestamp = time.strftime('%H:%M:%S')
                print(f"[{timestamp}] {line}")
                
    except KeyboardInterrupt:
        print("\nMonitoring stopped")
    finally:
        if 'ser' in locals():
            ser.close()
```

### Step 5.2: Platform-Appropriate Dashboard

**For microcontrollers (Arduino, ESP32, STM32):**
Create web dashboard using Web Serial API (see templates/dashboard_template.html)

**For network-capable devices (ESP32, Pi):**
Create web server on device itself:
```python
# Flask server on Raspberry Pi
from flask import Flask, jsonify, render_template
import RPi.GPIO as GPIO

app = Flask(__name__)

@app.route('/api/sensor')
def get_sensor():
    value = read_sensor()
    return jsonify({'value': value})

@app.route('/api/led/<state>')
def control_led(state):
    GPIO.output(LED_PIN, state == 'on')
    return jsonify({'status': 'ok'})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
```

**For headless embedded:**
Create logging and remote monitoring:
```python
# MQTT publishing
import paho.mqtt.client as mqtt

client = mqtt.Client()
client.connect("broker.hivemq.com", 1883, 60)

while True:
    data = read_sensors()
    client.publish("device/sensors", json.dumps(data))
    time.sleep(1)
```

### Step 5.3: Debugging Tools

**Arduino/ESP32:**
- Serial.println() debugging
- LED indicators
- Oscilloscope for timing
- Logic analyzer for protocols

**STM32:**
- SWD debugger (ST-Link)
- printf via SWO
- Breakpoints and step debugging
- Memory inspection

**Raspberry Pi:**
- Standard Python debugging (pdb)
- System logs (journalctl)
- GPIO state inspection
- Network analysis (tcpdump, wireshark)

## Advanced Features

### Cross-Platform Communication

Enable devices to communicate:

**UART/Serial:**
```cpp
// Arduino/ESP32 → Raspberry Pi
Serial.println("SENSOR:123");

# Raspberry Pi receives
import serial
ser = serial.Serial('/dev/ttyUSB0', 115200)
line = ser.readline().decode()
```

**I2C (as master/slave):**
```cpp
// ESP32 as I2C slave
Wire.begin(0x08);
Wire.onReceive(receiveEvent);
Wire.onRequest(requestEvent);
```

**Network (ESP32, Pi):**
```cpp
// ESP32 HTTP client
HTTPClient http;
http.begin("http://192.168.1.100:5000/data");
http.POST(jsonData);
```

### Multi-Device Projects

**Example: ESP32 + Raspberry Pi system**
- ESP32: Sensor collection, low-power operation
- Raspberry Pi: Data processing, ML inference, web dashboard
- Communication: MQTT or HTTP

## Troubleshooting Guide

### Universal Issues

**Device not detected:**
1. Check USB cable (must be data cable)
2. Try different USB port
3. Check `lsusb` / `dmesg | tail`
4. Install drivers (CH340, FTDI, etc.)
5. Add user to dialout group: `sudo usermod -a -G dialout $USER`

**Upload fails:**
1. Verify correct board/FQBN selected
2. Check port permissions
3. Press reset/boot button if required
4. Close other programs using the port
5. Try slower upload speed

**Code compiles but doesn't work:**
1. Add debug Serial.println() statements
2. Check voltage levels (3.3V vs 5V)
3. Verify pin connections
4. Check pull-up/pull-down requirements
5. Measure with multimeter/oscilloscope

### Platform-Specific Issues

Consult the appropriate platform guide in `references/boards/` for:
- Memory issues
- Timing problems
- Peripheral conflicts
- Power management
- Reset/boot issues

## Summary

This skill provides a universal embedded programming workflow:

1. **Detect** → Identify any hardware platform
2. **Learn** → Load platform-specific knowledge
3. **Plan** → Interactive requirements gathering
4. **Code** → Generate optimized platform code
5. **Build** → Compile with appropriate toolchain
6. **Flash** → Upload to hardware
7. **Test** → Create suitable monitoring interface

**The key to generalization**: Platform-specific details live in reference files, while the workflow remains consistent.

**When to read platform references:**
- ALWAYS when a platform is detected
- Before code generation
- When using platform-specific features
- During troubleshooting

**Platform detection triggers automatic reference loading** to ensure you get correct pins, libraries, and best practices for that specific hardware.
