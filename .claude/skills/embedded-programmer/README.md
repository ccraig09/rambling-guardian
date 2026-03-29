# Embedded Hardware Programmer Skill

**A universal, hardware-agnostic skill for programming ANY embedded system.**

## What This Skill Does

This skill provides end-to-end embedded development for:

- **Microcontrollers**: Arduino, ESP32, ESP8266, STM32, nRF52, RP2040
- **Single Board Computers**: Raspberry Pi, BeagleBone, Jetson Nano
- **Development Boards**: Custom boards, shields, breakouts

All through one unified workflow: Detect → Plan → Code → Build → Flash → Test

## Key Features

### 1. Universal Hardware Detection
Automatically identifies:
- Arduino boards (Uno, Nano, Mega, Leonardo)
- ESP32/ESP8266 (WiFi/Bluetooth capable)
- STM32 (ARM Cortex-M, various families)
- Raspberry Pi (all models, Linux-based)
- RP2040 (Raspberry Pi Pico)
- Nordic nRF52 (BLE)

### 2. Platform-Specific Intelligence
Loads appropriate reference guides:
- `arduino.md` - AVR-based Arduinos
- `esp32.md` - ESP32 with WiFi/BT/dual-core
- `stm32.md` - STM32 with HAL/Arduino
- `rpi.md` - Raspberry Pi with Python/C++
- `rp2040.md` - Pico with MicroPython/C++
- `nrf52.md` - Nordic BLE development

### 3. Capability-Aware Project Planning
Suggests projects based on actual hardware:
- WiFi available? → IoT dashboards, web servers
- Limited RAM? → Efficient local projects
- Linux SBC? → Complex apps, ML, computer vision
- Low power? → Sleep modes, battery optimization

### 4. Multi-Toolchain Support
- **arduino-cli** - Arduino, ESP32, RP2040
- **PlatformIO** - Universal (1000+ boards)
- **STM32CubeIDE** - STM32 HAL
- **Python** - Raspberry Pi
- **ESP-IDF** - Advanced ESP32
- **nRF SDK** - Nordic development

### 5. Platform-Optimized Code Generation
- Arduino: F() macros, non-blocking patterns
- ESP32: WiFi, dual-core, low-power
- STM32: HAL peripherals, DMA, interrupts
- Raspberry Pi: Python/C++, systemd services
- Best practices for each platform

### 6. Live Testing & Monitoring
- Web Serial dashboards (microcontrollers)
- Flask/FastAPI servers (Raspberry Pi)
- MQTT integration (IoT)
- Serial monitors
- Debug logging

## Skill Structure

```
embedded-programmer/
├── SKILL.md                      # Main workflow (universal)
├── README.md                     # This file
├── references/
│   ├── libraries.md             # Common libraries (I2C, SPI, sensors, etc.)
│   └── boards/
│       ├── arduino.md           # Arduino Uno/Nano/Mega
│       ├── esp32.md             # ESP32/ESP8266 (WiFi/BT)
│       ├── stm32.md             # STM32 (ARM Cortex-M)
│       ├── rpi.md               # Raspberry Pi (Linux SBC)
│       ├── rp2040.md            # Raspberry Pi Pico
│       └── nrf52.md             # Nordic nRF52 (BLE)
├── scripts/
│   └── discover_hardware.py    # Universal hardware detection
└── templates/
    └── dashboard_template.html  # Web-based testing dashboard
```

## 🎓 How It Works

### Two-Phase Detection (Educated Guess + Verification)

Unlike other tools that blindly scan hardware, this skill uses a **smart two-phase approach**:

#### Phase 1: User Interview (Educated Guess)
```
Skill: "What board do you have?"
User: "It's blue, says STM32F103C8T6, about 2 inches long"

Skill analyzes:
→ "Blue" = Likely STM32 clone
→ "STM32F103C8T6" = Blue Pill board
→ Small size confirms it

Initial Profile Created:
✓ Platform: STM32 (Blue Pill)
✓ Confidence: High
✓ Expected: ARM Cortex-M3, 64KB Flash, 20KB RAM
```

**Why ask first?**
- Catches non-detectable boards (broken USB, custom boards)
- Helps troubleshoot detection issues
- Identifies clones/variants that appear similar
- Sets expectations before probing hardware
- Builds user confidence through conversation

#### Phase 2: Automated Detection (Verification)
```bash
# Now probe the hardware
st-info --probe
lsusb
arduino-cli board list

Results:
✅ Confirmed: STM32F103C8T6
✅ Detected via: ST-Link V2
✅ Matches user description
```

**Verification outcomes:**
- **Match**: User description = Detection → Proceed confidently
- **Variant**: Close match (ESP32 vs ESP32-S2) → Inform user, proceed
- **Mismatch**: Different platform → Ask user to clarify, investigate

### Complete Workflow Example

```
Phase 0: User Interview + Detection
   User: "Blue board, says STM32F103C8T6"
   → Guess: STM32 Blue Pill
   → Detect: Confirmed via ST-Link
   → Load: references/boards/stm32.md

Phase 1: Hardware Discovery
   Probe GPIO, I2C devices, connected sensors
   → Found: OLED at 0x3C, Button on PB0

Phase 2: Interactive Planning
   "What do you want to build?"
   → User: "Temperature display on the OLED"
   → Suggest: Real-time graph, min/max tracking, button to toggle units

Phase 3: Generate Code
   STM32 HAL code with:
   - I2C OLED control  
   - Temperature sensor (DHT22)
   - Button interrupt handling
   - Efficient display updates

Phase 4: Build & Flash
   PlatformIO compile → st-flash upload → Success!

Phase 5: Live Testing
   Serial monitor shows sensor readings
   OLED displays temperature graph
```

## Example Projects

### Arduino Uno + LCD
```
Hardware: Arduino Uno, 16x2 I2C LCD, DHT22 sensor
Result: Local temperature display with scrolling text
Code: Arduino C++ with LiquidCrystal_I2C library
```

### ESP32 + Sensors → Web Dashboard
```
Hardware: ESP32, BME280 (temp/humidity/pressure), BH1750 (light)
Result: WiFi-enabled web server with real-time graphs
Code: ESP32 C++ with WiFi, WebServer, sensor libraries
Features: OTA updates, deep sleep, MQTT publishing
```

### STM32 Blue Pill + OLED
```
Hardware: STM32F103C8T6, 128x64 OLED, buttons
Result: Menu-driven interface with graphics
Code: STM32 HAL or Arduino framework
Features: DMA, interrupts, efficient power usage
```

### Raspberry Pi + Camera + ML
```
Hardware: Raspberry Pi 4, Pi Camera, servo motors
Result: Object detection with camera pan/tilt
Code: Python with OpenCV, TensorFlow Lite
Features: Systemd service, web interface, GPIO control
```

### Multi-Device IoT System
```
Hardware: ESP32 (sensors) + Raspberry Pi (hub)
Result: Distributed sensor network with central dashboard
Communication: MQTT broker on Pi, ESP32 clients
Code: ESP32 in C++, Pi in Python with Flask
```

## 🔧 Supported Platforms

| Platform | Language | Wireless | Unique Features |
|----------|----------|----------|----------------|
| **Arduino** | C++ | ❌ | Simple, huge library ecosystem |
| **ESP32** | C++ | WiFi + BT | Dual-core, touch, DAC, low power |
| **ESP8266** | C++ | WiFi | Compact, low cost |
| **STM32** | C/C++ | Optional | High performance, rich peripherals |
| **Raspberry Pi** | Python/C++ | WiFi | Full Linux, GPU, USB, Ethernet |
| **RP2040** | C++/Python | ❌ | Dual-core, PIO, very fast |
| **nRF52** | C/C++ | BLE | Ultra low power, mesh networking |

## When to Use This Skill

### Triggers
- User mentions: Arduino, ESP32, STM32, Raspberry Pi, microcontroller, embedded
- IoT projects, hardware programming, robotics, sensor projects
- Mentions of GPIO, I2C, SPI, UART, or specific sensors
- Wants to build physical computing projects
- Needs to program development boards

### Examples
```
"Program my Arduino to blink an LED"
"Create a WiFi temperature sensor with ESP32"
"Help me control a motor with Raspberry Pi"
"I have an STM32 Blue Pill, what can I build?"
"Make a BLE beacon with nRF52"
```

## 🛠️ Installation

See main skill installation documentation. The `.skill` file contains:
- Main SKILL.md with universal workflow
- Platform-specific guides (6 boards)
- Library reference
- Hardware detection scripts
- Dashboard templates

## Design Philosophy

### Generalization Through Modularity

**Core Workflow (SKILL.md):** Universal steps that work for ANY platform
**Platform Guides (boards/*.md):** Specific details, pins, libraries, best practices
**Runtime Detection:** Automatically loads the right guide for detected hardware

### Benefits
- Add new platforms without changing core workflow
- Each platform gets expert-level guidance
- Consistent user experience across all hardware
- Easy to maintain and extend

### Adding New Platforms
To support a new board family (e.g., RISC-V, BeagleBone):
1. Create `references/boards/newplatform.md` with specs, toolchain, examples
2. Add detection pattern in Phase 0
3. That's it! The workflow automatically adapts

## Comparison with Arduino-Only Skill

| Feature | Arduino Skill | Embedded Skill |
|---------|---------------|----------------|
| Platforms | Arduino, ESP32 | Arduino, ESP32, STM32, Pi, etc. |
| Approach | Arduino-centric | Platform-agnostic |
| Extensibility | Limited | Highly modular |
| Use Cases | Hobbyist projects | Professional + hobbyist |
| Complexity | Simpler | More comprehensive |

## Documentation

Each platform guide includes:
- Hardware specifications
- Toolchain setup instructions
- Pin mappings and peripherals
- Code examples (basic to advanced)
- Libraries and frameworks
- Best practices
- Troubleshooting

## 🚦 Getting Started

### Example: First-Time User with Unknown Board

```
User: "I have this board and want to program it"

Claude: "Great! Let's identify what you have. A few quick questions:

1. What's written on the board itself? Any model numbers or chip names?
2. What color is the board?
3. About how big is it - credit card size, USB stick size, or smaller?
4. Does it have a visible WiFi antenna?
5. What type of USB connector does it have?"

User: "It says 'ESP-WROOM-32', it's like 2 inches long, has an antenna, 
and micro-USB"

Claude: "Perfect! Based on that, you have an ESP32 DevKit board.

Let me verify by detecting it...
[runs detection]

✅ Confirmed! ESP32 DevKit V1 on /dev/ttyUSB0

This board has:
• WiFi + Bluetooth
• Dual-core processor  
• 36 GPIO pins
• 3.3V logic

What would you like to build with it?"
```

### Example: Experienced User

```
User: "Program my STM32 Blue Pill to control servos"

Claude: "Got it - STM32F103C8T6. Let me detect it...

✅ Found via ST-Link on /dev/ttyACM0
✅ Loaded STM32 platform guide

How many servos, and which pins do you want to use?"
```

## Installation & Usage

1. **Connect your hardware** (any supported board)
2. **Activate this skill** in Claude Code
3. **Say**: "I have a [board name], help me build [project]"
4. **Follow the guided workflow**: Detect → Plan → Code → Flash → Test

The skill automatically adapts to your hardware!

## Contributing

Want to add support for a new platform?
- Create a new markdown file in `references/boards/`
- Follow the template structure of existing guides
- Include: specs, setup, pinout, code examples, libraries
- Submit and it automatically integrates!

---

**Power ANY embedded project with intelligent, platform-aware development assistance!**
