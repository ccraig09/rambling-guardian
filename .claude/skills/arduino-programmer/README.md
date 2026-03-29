# Arduino Programmer Skill

A comprehensive skill for end-to-end Arduino development through Claude Code.

## What This Skill Does

This skill handles the complete Arduino development workflow:

1. **Hardware Discovery** - Automatically detects connected Arduino boards and identifies their capabilities
2. **Interactive Planning** - Guides users through project requirements with capability-aware suggestions
3. **Code Generation** - Writes optimized Arduino C/C++ code tailored to the hardware
4. **Compilation & Upload** - Compiles and flashes code to the board using arduino-cli
5. **Live Testing** - Creates interactive web-based dashboards for real-time monitoring and control

## When to Use This Skill

Use this skill whenever:
- User mentions Arduino, microcontroller, or embedded programming
- User wants to build IoT or physical computing projects
- User asks about programming sensors, LEDs, motors, or other hardware
- User wants to create hardware demos or prototypes
- User needs to test or debug Arduino boards

## Prerequisites

### Required Tools

The skill will help install these if needed:

```bash
# arduino-cli - Arduino command-line interface
curl -fsSL https://raw.githubusercontent.com/arduino/arduino-cli/master/install.sh | sh

# Python serial library
pip install pyserial --break-system-packages

# Initialize arduino-cli
arduino-cli config init
arduino-cli core update-index
```

### Supported Boards

- Arduino Uno, Nano, Mega
- ESP32, ESP8266
- Most Arduino-compatible boards

## Example Workflows

### Simple LED Control

```
User: "Make an LED blink on my Arduino"

Claude will:
1. Detect the board (e.g., Arduino Uno on /dev/ttyACM0)
2. Generate code for LED on pin 13
3. Compile and upload
4. Create a dashboard with toggle and speed controls
```

### Temperature Monitor

```
User: "Monitor temperature and display on LCD"

Claude will:
1. Detect board and probe for I2C LCD
2. Ask about temperature sensor details
3. Generate code with DHT library
4. Install required libraries
5. Compile and upload
6. Create dashboard with live graphs and min/max tracking
```

### Multi-Sensor Dashboard

```
User: "Create a dashboard for my weather station"

Claude will:
1. Probe for all connected sensors (temp, humidity, pressure, etc.)
2. Plan data collection strategy
3. Generate optimized code with efficient sampling
4. Create comprehensive dashboard with charts and alerts
5. Add data export functionality
```

## Skill Structure

```
arduino-programmer/
├── SKILL.md                    # Main skill instructions
├── README.md                   # This file
├── references/
│   └── libraries.md           # Common Arduino library reference
├── scripts/
│   └── discover_hardware.py   # Hardware detection utility
└── templates/
    └── dashboard_template.html # Reusable dashboard template
```

## Key Features

### 1. Intelligent Hardware Detection

- Automatically identifies board type and capabilities
- Probes for connected components (sensors, displays, etc.)
- Detects I2C devices and suggests likely identification
- Provides comprehensive pin mapping

### 2. Guided Project Planning

- Capability-aware suggestions based on detected hardware
- Iterative refinement through questions
- Prevents impossible configurations
- Offers creative project ideas

### 3. Production-Quality Code

- Well-commented and structured
- Memory-efficient (F() macros, PROGMEM)
- Non-blocking timing patterns
- Proper error handling
- Library management

### 4. Live Testing Dashboards

- Web Serial API integration
- Real-time data visualization with Chart.js
- Interactive controls
- Serial monitor with command input
- Responsive, modern UI with Tailwind CSS

### 5. Comprehensive Error Handling

- Clear compilation error messages
- Automatic library installation
- Upload troubleshooting
- Hardware debugging assistance

## Advanced Capabilities

### Multi-Board Support
Handle multiple Arduino boards simultaneously

### Wireless Communication
ESP32/ESP8266 WiFi and Bluetooth integration

### Data Logging
SD card and EEPROM storage

### Web Server
Create web-based control interfaces on ESP boards

### Custom Protocols
Serial communication protocol design and parsing

## Common Use Cases

1. **Learning Projects**
   - LED blink variations
   - Button and sensor basics
   - Serial communication
   - PWM and analog I/O

2. **IoT Devices**
   - Temperature/humidity monitors
   - Smart home controllers
   - Environmental sensors
   - Remote monitoring systems

3. **Robotics**
   - Motor control
   - Servo positioning
   - Sensor fusion
   - Autonomous navigation

4. **Data Acquisition**
   - Multi-sensor logging
   - Real-time graphing
   - Threshold monitoring
   - CSV export

5. **Interactive Art**
   - LED patterns
   - Sound reactive displays
   - Motion-triggered installations
   - Generative art controllers

## Tips for Best Results

1. **Start with Detection** - Always begin by letting Claude detect your hardware
2. **Be Specific** - The more details you provide about your project, the better
3. **Iterate Incrementally** - Build complex projects step by step
4. **Use the Dashboard** - Interactive testing is more fun and effective
5. **Save Your Code** - Claude will organize projects in folders for you

## Troubleshooting

### Board Not Detected
- Check USB cable (must be data cable)
- Try different USB port
- Check `lsusb` or `dmesg` for device
- Install CH340/CH341 drivers for clones

### Upload Failed
- Add user to `dialout` group: `sudo usermod -a -G dialout $USER`
- Use `sudo` for single upload
- Press reset button before upload
- Verify correct FQBN

### Dashboard Not Working
- Use Chrome or Edge (Web Serial API)
- Check JavaScript console for errors
- Verify baud rate matches code
- Grant port permissions when prompted

### Compilation Errors
- Update library index: `arduino-cli lib update-index`
- Install missing libraries: `arduino-cli lib install "Library Name"`
- Check board core installed: `arduino-cli core list`

## Technical Details

### Communication Protocol

For dashboard integration, Arduino code sends structured data:

```cpp
// Format: KEY1:value1,KEY2:value2
Serial.print("TEMP:");
Serial.print(temperature);
Serial.print(",HUMID:");
Serial.println(humidity);
```

Dashboard parses with regex or string matching.

### Chart Data Management

- Keeps last 20 data points for performance
- Auto-scaling axes
- Multiple datasets supported
- Real-time updates without blocking

### Memory Optimization

- String literals in PROGMEM with F() macro
- Minimal global variables
- Stack-based local variables
- Efficient data structures

## Resources

### Official Documentation
- [Arduino Reference](https://www.arduino.cc/reference/en/)
- [arduino-cli Documentation](https://arduino.github.io/arduino-cli/)
- [Web Serial API](https://web.dev/serial/)

### Library Resources
- [Arduino Library Manager](https://www.arduino.cc/reference/en/libraries/)
- [PlatformIO Registry](https://registry.platformio.org/)
- [Adafruit Libraries](https://github.com/adafruit/)

### Community
- [Arduino Forum](https://forum.arduino.cc/)
- [Stack Overflow - Arduino](https://stackoverflow.com/questions/tagged/arduino)
- [Reddit - r/arduino](https://www.reddit.com/r/arduino/)

## Version History

- **v1.0** - Initial release with full workflow support
  - Hardware detection
  - Interactive planning
  - Code generation
  - Dashboard creation
  - Comprehensive library support

## Contributing

This skill is designed to be extended. Feel free to:
- Add support for new boards
- Include additional libraries in references
- Create specialized dashboard templates
- Share example projects

## License

This skill is part of the Claude Code skills ecosystem and follows the same licensing as Claude Code.

---

**Happy Making! 🔧⚡**
