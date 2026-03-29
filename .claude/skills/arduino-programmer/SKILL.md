---
name: arduino-programmer
description: Program Arduino boards via USB with full hardware discovery, interactive project planning, code generation, compilation, and live testing dashboard. Use this skill whenever the user mentions Arduino, microcontroller programming, embedded systems, wants to create IoT projects, mentions sensors/LEDs/motors, wants to program hardware, or asks to build physical computing projects. Also trigger when user wants to test Arduino boards, create hardware demos, or build interactive electronics projects.
---

# Arduino Programmer Skill

A comprehensive skill for programming Arduino boards through complete hardware discovery, interactive requirement gathering, code generation, compilation, flashing, and live testing with interactive dashboards.

## Overview

This skill handles the complete Arduino development workflow:
1. **Hardware Discovery** - Detect connected Arduino board, identify type, and catalog available pins and connected components
2. **Interactive Planning** - Guide user through project requirements with capability-aware suggestions
3. **Code Generation** - Write optimized Arduino C/C++ code tailored to the hardware
4. **Compilation & Upload** - Compile and flash code to the board using arduino-cli
5. **Live Testing** - Create web-based dashboards for real-time interaction and monitoring

## Prerequisites

### Required Tools
- `arduino-cli` - Arduino command-line interface
- `pyserial` - Python library for serial communication
- Web browser for testing dashboards

### Installation

```bash
# Install arduino-cli
curl -fsSL https://raw.githubusercontent.com/arduino/arduino-cli/master/install.sh | sh

# Add to PATH if needed
export PATH=$PATH:$HOME/bin

# Install Python dependencies
pip install pyserial --break-system-packages

# Initialize arduino-cli
arduino-cli config init
arduino-cli core update-index
```

## Workflow

### Phase 1: Hardware Discovery

**Goal**: Identify the connected Arduino board and its capabilities.

#### Step 1.1: Detect Connected Boards

```bash
# List connected boards
arduino-cli board list
```

This returns the port, protocol, board type, and core. Example output:
```
Port         Protocol Type              Board Name FQBN            Core
/dev/ttyACM0 serial   Serial Port (USB) Arduino Uno arduino:avr:uno arduino:avr
```

#### Step 1.2: Install Board Core (if needed)

```bash
# Install the appropriate core (e.g., AVR for Uno/Nano/Mega)
arduino-cli core install arduino:avr
# For ESP32
arduino-cli core install esp32:esp32
# For ESP8266
arduino-cli core install esp8266:esp8266
```

#### Step 1.3: Get Board Details

Extract key information:
- **Board Type**: Uno, Nano, Mega, ESP32, ESP8266, etc.
- **FQBN** (Fully Qualified Board Name): Needed for compilation
- **Port**: USB device path (e.g., /dev/ttyACM0, /dev/ttyUSB0)
- **Available Pins**: Digital, analog, PWM, I2C, SPI
- **Voltage**: 3.3V or 5V logic
- **Memory**: Flash, SRAM, EEPROM

**Common Board Capabilities:**

| Board | Digital | Analog | PWM | Voltage | Flash | SRAM |
|-------|---------|--------|-----|---------|-------|------|
| Uno | 14 (0-13) | 6 (A0-A5) | 6 | 5V | 32KB | 2KB |
| Nano | 14 (D0-D13) | 8 (A0-A7) | 6 | 5V | 32KB | 2KB |
| Mega | 54 (0-53) | 16 (A0-A15) | 15 | 5V | 256KB | 8KB |
| ESP32 | 36 | 18 | 16 | 3.3V | 4MB | 520KB |
| ESP8266 | 17 | 1 | 4 | 3.3V | 4MB | 80KB |

#### Step 1.4: Probe for Connected Components

Create and upload a discovery sketch to identify connected components:

```cpp
// discovery.ino - Hardware discovery sketch
void setup() {
  Serial.begin(9600);
  Serial.println("=== Arduino Hardware Discovery ===");
  
  // Test digital pins
  Serial.println("\n--- Digital Pin Scan ---");
  for (int pin = 2; pin <= 13; pin++) {
    pinMode(pin, INPUT_PULLUP);
    delay(10);
    int state = digitalRead(pin);
    Serial.print("Pin D"); Serial.print(pin); 
    Serial.print(": "); Serial.println(state == HIGH ? "FLOATING/PULLED_HIGH" : "GROUNDED/PULLED_LOW");
  }
  
  // Test analog pins
  Serial.println("\n--- Analog Pin Scan ---");
  for (int pin = 0; pin <= 5; pin++) {
    int value = analogRead(pin);
    Serial.print("Pin A"); Serial.print(pin); 
    Serial.print(": "); Serial.println(value);
  }
  
  // I2C scan
  Serial.println("\n--- I2C Device Scan ---");
  Wire.begin();
  byte count = 0;
  for (byte i = 8; i < 120; i++) {
    Wire.beginTransmission(i);
    if (Wire.endTransmission() == 0) {
      Serial.print("I2C device found at 0x");
      if (i < 16) Serial.print("0");
      Serial.println(i, HEX);
      count++;
    }
  }
  if (count == 0) Serial.println("No I2C devices found");
  
  Serial.println("\n=== Discovery Complete ===");
}

void loop() {
  // Keep reading sensors for dynamic detection
  delay(1000);
}
```

Compile and upload this discovery sketch, then read serial output to identify:
- LEDs (pins showing LOW when expected HIGH)
- Buttons (pins with pull-up showing state changes)
- Potentiometers/sensors (analog pins with varying values)
- I2C devices (displays, sensors with addresses like 0x27, 0x3C, 0x68)

**Present findings to user** in a clear format:
```
🔍 Arduino Board Detected
Board: Arduino Uno
Port: /dev/ttyACM0
FQBN: arduino:avr:uno

📊 Available Resources:
- 14 Digital pins (D0-D13)
- 6 Analog pins (A0-A5)
- 6 PWM pins (D3, D5, D6, D9, D10, D11)
- I2C: SDA (A4), SCL (A5)
- SPI: MISO (D12), MOSI (D11), SCK (D13)

🔌 Detected Components:
- LED on pin D13 (built-in)
- Button on pin D2 (pulled up)
- Potentiometer on A0 (values: 0-1023)
- I2C LCD at 0x27
```

### Phase 2: Interactive Project Planning

**Goal**: Understand what the user wants to build and ensure it's feasible with available hardware.

#### Step 2.1: Initial Query

Ask the user what they want to create. Examples:
- "What would you like to build with this Arduino?"
- "I can see you have [components]. What demo would you like to create?"

#### Step 2.2: Capability-Aware Guidance

Based on discovered hardware, provide suggestions and constraints:

**If limited components detected:**
```
Based on your hardware, here are some projects we can create:
1. Button-controlled LED (using D2 button, D13 LED)
2. LED brightness control via potentiometer (A0 → PWM pin)
3. Simple serial monitor display
4. Blink patterns and sequences

What interests you most?
```

**If rich components detected:**
```
Great hardware setup! You have an I2C LCD and sensors. We could create:
1. Real-time sensor dashboard on LCD
2. Temperature/humidity monitor (if sensor detected)
3. Interactive game using button + display
4. Data logger with serial output

Which direction should we go?
```

#### Step 2.3: Iterative Refinement

Keep asking clarifying questions until you have:
- **Primary function**: What the device does
- **Inputs**: Buttons, sensors, serial commands
- **Outputs**: LEDs, display, serial monitor, motors
- **Behavior**: Event-driven, periodic, continuous
- **Edge cases**: What happens on startup, errors, boundary conditions

**Example conversation:**
```
User: I want to make a temperature display
Claude: Great! I see you have an LCD. Do you have a temperature sensor connected?
User: Yes, a DHT22 on pin D4
Claude: Perfect. Should it:
  - Display continuously updated readings?
  - Log min/max temperatures?
  - Show warnings at certain thresholds?
  - Send data over serial for logging?
```

Continue until requirements are crystal clear.

### Phase 3: Code Generation

**Goal**: Write clean, well-documented Arduino code that matches the hardware and requirements.

#### Step 3.1: Code Structure

Generate code with this structure:

```cpp
/*
 * [Project Name]
 * 
 * Description: [Clear description of what this does]
 * 
 * Hardware:
 * - Board: [Arduino Uno/Mega/etc]
 * - Components:
 *   - [Component 1] on pin [X]
 *   - [Component 2] on pin [Y]
 * 
 * Created: [Date]
 */

// ========== INCLUDES ==========
#include <Wire.h>  // For I2C
// Add other libraries as needed

// ========== PIN DEFINITIONS ==========
#define LED_PIN 13
#define BUTTON_PIN 2
// Clear, descriptive names

// ========== GLOBAL VARIABLES ==========
int sensorValue = 0;
bool ledState = false;

// ========== SETUP ==========
void setup() {
  Serial.begin(9600);  // Always useful for debugging
  pinMode(LED_PIN, OUTPUT);
  pinMode(BUTTON_PIN, INPUT_PULLUP);
  
  // Initialize libraries
  // Add startup messages
  Serial.println("System initialized");
}

// ========== MAIN LOOP ==========
void loop() {
  // Main logic here
  // Keep it simple and readable
}

// ========== HELPER FUNCTIONS ==========
void blinkLed(int duration) {
  digitalWrite(LED_PIN, HIGH);
  delay(duration);
  digitalWrite(LED_PIN, LOW);
}
```

#### Step 3.2: Best Practices

**Memory Management:**
- Use `const` for constants to save RAM
- Use `F()` macro for string literals: `Serial.println(F("Hello"));`
- Minimize global variables on boards with limited SRAM

**Timing:**
- Avoid `delay()` in complex programs - use `millis()` for non-blocking timing
- Example non-blocking blink:
```cpp
unsigned long previousMillis = 0;
const long interval = 1000;

void loop() {
  unsigned long currentMillis = millis();
  if (currentMillis - previousMillis >= interval) {
    previousMillis = currentMillis;
    // Do timed action
  }
  // Other code runs without blocking
}
```

**Input Handling:**
- Debounce buttons (hardware or software)
- Validate sensor readings
- Add bounds checking

**Serial Communication:**
- Use consistent baud rates
- Add debug output for testing
- Consider error messages

**Libraries:**
Common libraries to use when appropriate:
- `Wire.h` - I2C communication
- `SPI.h` - SPI communication
- `Servo.h` - Servo motor control
- `LiquidCrystal_I2C.h` - I2C LCD displays
- `DHT.h` - DHT11/DHT22 temperature sensors
- `Adafruit_Sensor.h` - Unified sensor library

#### Step 3.3: Save Code

Save the generated code to a `.ino` file in its own directory:

```bash
mkdir -p /home/claude/arduino-projects/[project-name]
# Save to /home/claude/arduino-projects/[project-name]/[project-name].ino
```

Arduino requires the .ino file to be in a folder with the same name.

### Phase 4: Compilation and Upload

**Goal**: Compile the code and flash it to the Arduino board.

#### Step 4.1: Compile

```bash
arduino-cli compile --fqbn [FQBN] /home/claude/arduino-projects/[project-name]
```

Example:
```bash
arduino-cli compile --fqbn arduino:avr:uno /home/claude/arduino-projects/led-blink
```

**Handle compilation errors:**
- Parse error messages
- Explain the issue in plain language
- Fix the code and recompile
- Common issues: missing libraries, syntax errors, undefined pins

#### Step 4.2: Install Missing Libraries

If compilation fails due to missing libraries:

```bash
# Search for library
arduino-cli lib search [library-name]

# Install library
arduino-cli lib install "[Library Name]"
```

Examples:
```bash
arduino-cli lib install "LiquidCrystal I2C"
arduino-cli lib install "DHT sensor library"
arduino-cli lib install "Adafruit Unified Sensor"
```

#### Step 4.3: Upload to Board

```bash
arduino-cli upload -p [PORT] --fqbn [FQBN] /home/claude/arduino-projects/[project-name]
```

Example:
```bash
arduino-cli upload -p /dev/ttyACM0 --fqbn arduino:avr:uno /home/claude/arduino-projects/led-blink
```

**Handle upload errors:**
- Port access issues: May need `sudo` or user in `dialout` group
- Wrong board selected: Verify FQBN matches actual board
- Board not responding: Check USB connection, try reset button

#### Step 4.4: Verify Upload

Confirm successful upload and provide feedback:
```
✅ Code compiled successfully
📤 Uploaded to Arduino Uno on /dev/ttyACM0
🎯 Your device should now be running!
```

### Phase 5: Live Testing Dashboard

**Goal**: Create an interactive web dashboard for testing and monitoring the Arduino.

#### Step 5.1: Serial Monitor Integration

For simple projects, create a Python script to monitor serial output:

```python
# serial_monitor.py
import serial
import time

def monitor_arduino(port, baudrate=9600):
    try:
        ser = serial.Serial(port, baudrate, timeout=1)
        print(f"Connected to {port} at {baudrate} baud")
        print("=" * 50)
        
        while True:
            if ser.in_waiting > 0:
                line = ser.readline().decode('utf-8').rstrip()
                print(f"[{time.strftime('%H:%M:%S')}] {line}")
    except KeyboardInterrupt:
        print("\nMonitoring stopped")
    except Exception as e:
        print(f"Error: {e}")
    finally:
        if 'ser' in locals():
            ser.close()

if __name__ == "__main__":
    monitor_arduino('/dev/ttyACM0', 9600)
```

#### Step 5.2: Interactive Web Dashboard

For projects requiring control and visualization, create an HTML dashboard with real-time serial communication:

```html
<!DOCTYPE html>
<html>
<head>
    <title>Arduino Dashboard</title>
    <meta charset="UTF-8">
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
</head>
<body class="bg-gray-900 text-white p-8">
    <div class="max-w-6xl mx-auto">
        <h1 class="text-4xl font-bold mb-8">🔧 Arduino Control Panel</h1>
        
        <!-- Connection Status -->
        <div id="status" class="mb-6 p-4 rounded-lg bg-yellow-600">
            <span class="font-bold">⚠️ Not Connected</span> - Click Connect to start
        </div>
        
        <!-- Controls -->
        <div class="grid grid-cols-2 gap-6 mb-8">
            <div class="bg-gray-800 p-6 rounded-lg">
                <h2 class="text-2xl font-bold mb-4">Controls</h2>
                <button id="connectBtn" class="w-full bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded mb-3">
                    Connect to Arduino
                </button>
                <button id="led-toggle" class="w-full bg-green-600 hover:bg-green-700 px-4 py-2 rounded" disabled>
                    Toggle LED
                </button>
            </div>
            
            <!-- Live Data -->
            <div class="bg-gray-800 p-6 rounded-lg">
                <h2 class="text-2xl font-bold mb-4">Live Readings</h2>
                <div class="space-y-2">
                    <div class="flex justify-between">
                        <span>Sensor Value:</span>
                        <span id="sensor-value" class="font-mono">--</span>
                    </div>
                    <div class="flex justify-between">
                        <span>LED State:</span>
                        <span id="led-state" class="font-mono">--</span>
                    </div>
                </div>
            </div>
        </div>
        
        <!-- Chart -->
        <div class="bg-gray-800 p-6 rounded-lg mb-8">
            <h2 class="text-2xl font-bold mb-4">Sensor History</h2>
            <canvas id="dataChart"></canvas>
        </div>
        
        <!-- Serial Monitor -->
        <div class="bg-gray-800 p-6 rounded-lg">
            <h2 class="text-2xl font-bold mb-4">Serial Monitor</h2>
            <div id="serial-output" class="bg-black p-4 rounded font-mono text-sm h-64 overflow-y-auto"></div>
        </div>
    </div>

    <script>
        // Serial connection using Web Serial API
        let port;
        let reader;
        let writer;
        
        const statusDiv = document.getElementById('status');
        const connectBtn = document.getElementById('connectBtn');
        const serialOutput = document.getElementById('serial-output');
        
        // Chart setup
        const ctx = document.getElementById('dataChart').getContext('2d');
        const chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Sensor Value',
                    data: [],
                    borderColor: 'rgb(59, 130, 246)',
                    tension: 0.1
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: { beginAtZero: true }
                },
                animation: false
            }
        });
        
        // Connect to Arduino
        connectBtn.addEventListener('click', async () => {
            try {
                port = await navigator.serial.requestPort();
                await port.open({ baudRate: 9600 });
                
                statusDiv.innerHTML = '<span class="font-bold">✅ Connected</span>';
                statusDiv.className = 'mb-6 p-4 rounded-lg bg-green-600';
                connectBtn.disabled = true;
                document.querySelectorAll('button:not(#connectBtn)').forEach(btn => btn.disabled = false);
                
                // Read serial data
                const textDecoder = new TextDecoderStream();
                const readableStreamClosed = port.readable.pipeTo(textDecoder.writable);
                reader = textDecoder.readable.getReader();
                
                // Write capability
                const textEncoder = new TextEncoderStream();
                const writableStreamClosed = textEncoder.readable.pipeTo(port.writable);
                writer = textEncoder.writable.getWriter();
                
                readSerialData();
            } catch (error) {
                console.error('Connection error:', error);
                alert('Failed to connect: ' + error.message);
            }
        });
        
        // Read incoming data
        async function readSerialData() {
            try {
                while (true) {
                    const { value, done } = await reader.read();
                    if (done) break;
                    
                    // Display in serial monitor
                    const time = new Date().toLocaleTimeString();
                    serialOutput.innerHTML += `<div>[${time}] ${value}</div>`;
                    serialOutput.scrollTop = serialOutput.scrollHeight;
                    
                    // Parse data (customize based on your protocol)
                    parseSensorData(value);
                }
            } catch (error) {
                console.error('Read error:', error);
            }
        }
        
        // Send command to Arduino
        async function sendCommand(cmd) {
            if (writer) {
                await writer.write(cmd + '\n');
            }
        }
        
        // Parse sensor data and update UI
        function parseSensorData(data) {
            // Example: "SENSOR:123,LED:1"
            const matches = data.match(/SENSOR:(\d+),LED:(\d+)/);
            if (matches) {
                const sensorValue = parseInt(matches[1]);
                const ledState = matches[2] === '1' ? 'ON' : 'OFF';
                
                document.getElementById('sensor-value').textContent = sensorValue;
                document.getElementById('led-state').textContent = ledState;
                
                // Update chart
                const now = new Date().toLocaleTimeString();
                chart.data.labels.push(now);
                chart.data.datasets[0].data.push(sensorValue);
                
                // Keep last 20 points
                if (chart.data.labels.length > 20) {
                    chart.data.labels.shift();
                    chart.data.datasets[0].data.shift();
                }
                
                chart.update();
            }
        }
        
        // LED toggle
        document.getElementById('led-toggle').addEventListener('click', () => {
            sendCommand('TOGGLE_LED');
        });
    </script>
</body>
</html>
```

#### Step 5.3: Dashboard Customization

Customize the dashboard based on the project:

**For sensor projects:**
- Add real-time graphs (Chart.js)
- Display min/max/average values
- Add threshold alerts

**For control projects:**
- Add sliders for PWM control
- Add buttons for digital outputs
- Add color pickers for RGB LEDs

**For data logging:**
- Add CSV export functionality
- Show historical trends
- Add timestamp logging

#### Step 5.4: Arduino Code for Dashboard Integration

Modify the Arduino code to communicate with the dashboard:

```cpp
// Add to main code for dashboard communication
void sendStatus() {
  // Send structured data
  Serial.print("SENSOR:");
  Serial.print(sensorValue);
  Serial.print(",LED:");
  Serial.println(ledState ? 1 : 0);
}

void handleCommand(String cmd) {
  cmd.trim();
  if (cmd == "TOGGLE_LED") {
    ledState = !ledState;
    digitalWrite(LED_PIN, ledState);
  }
  // Add more commands as needed
}

void loop() {
  // Send status every 100ms
  static unsigned long lastUpdate = 0;
  if (millis() - lastUpdate >= 100) {
    sendStatus();
    lastUpdate = millis();
  }
  
  // Check for incoming commands
  if (Serial.available() > 0) {
    String cmd = Serial.readStringUntil('\n');
    handleCommand(cmd);
  }
  
  // Rest of loop code
}
```

### Phase 6: Testing and Iteration

**Goal**: Verify functionality and refine based on observations.

#### Step 6.1: Functional Testing

Guide the user through testing:
```
Let's test your Arduino project:

1. ✅ Code uploaded successfully
2. 🔍 Open the dashboard in your browser: file:///home/claude/arduino-projects/[project]/dashboard.html
3. 🔌 Click "Connect to Arduino" and select the serial port
4. 🎮 Try the controls and observe the behavior

What do you see? Is it working as expected?
```

#### Step 6.2: Debugging Common Issues

**No serial data:**
- Check baud rate matches (9600 in both code and dashboard)
- Verify Serial.begin() is called in setup()
- Check USB cable and connection

**Dashboard not responding:**
- Verify browser supports Web Serial API (Chrome/Edge)
- Check for JavaScript errors in console
- Ensure port permissions are granted

**Unexpected behavior:**
- Add debug Serial.println() statements
- Check pin numbers match wiring
- Verify component specifications (voltage, current)

**Erratic readings:**
- Add filtering/averaging to sensor readings
- Check for electromagnetic interference
- Verify stable power supply

#### Step 6.3: Iterate Based on Feedback

Ask the user:
- "What would you like to change?"
- "Are there any features you'd like to add?"
- "Is the behavior what you expected?"

Then modify code accordingly and re-upload.

## Advanced Features

### Multi-Board Support

Detect and program multiple Arduino boards simultaneously:

```bash
# List all connected boards
arduino-cli board list --format json

# Compile for different boards
arduino-cli compile --fqbn esp32:esp32:esp32 ./project
arduino-cli compile --fqbn arduino:avr:mega ./project
```

### Wireless Communication

For ESP32/ESP8266 boards, add WiFi capabilities:

```cpp
#include <WiFi.h>

const char* ssid = "your-ssid";
const char* password = "your-password";

void setup() {
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi connected");
  Serial.println(WiFi.localIP());
}
```

### Data Logging

Add SD card logging for long-term data collection:

```cpp
#include <SD.h>

File dataFile;

void setup() {
  if (!SD.begin(4)) {
    Serial.println("SD initialization failed");
    return;
  }
}

void logData(String data) {
  dataFile = SD.open("datalog.txt", FILE_WRITE);
  if (dataFile) {
    dataFile.println(data);
    dataFile.close();
  }
}
```

### EEPROM Storage

Persist settings across reboots:

```cpp
#include <EEPROM.h>

void saveSettings(int value) {
  EEPROM.write(0, value);
}

int loadSettings() {
  return EEPROM.read(0);
}
```

## Troubleshooting

### Permission Denied on Upload

```bash
# Add user to dialout group (Linux)
sudo usermod -a -G dialout $USER
# Log out and back in

# Or use sudo for single upload
sudo arduino-cli upload -p /dev/ttyACM0 --fqbn arduino:avr:uno ./project
```

### Board Not Detected

1. Check USB cable (must be data cable, not charge-only)
2. Try different USB port
3. Check if board appears in `lsusb` or `dmesg | tail`
4. Try pressing reset button before upload
5. Check if drivers are needed (CH340/CH341 for clones)

### Compilation Errors

**"library not found":**
```bash
arduino-cli lib search [library-name]
arduino-cli lib install "[exact library name]"
```

**"FQBN not found":**
```bash
arduino-cli core update-index
arduino-cli core install [core-name]
```

**Memory overflow:**
- Reduce string literals (use F() macro)
- Remove unused variables
- Use smaller data types where possible
- Consider moving data to PROGMEM

### Web Serial API Issues

- Only works in Chrome/Edge (not Firefox/Safari)
- Requires HTTPS or localhost
- May need browser flags enabled in some versions
- Check browser console for specific errors

## Best Practices Summary

1. **Always start with hardware discovery** - Know what you're working with
2. **Iterate requirements with user** - Clear specs prevent rework
3. **Comment code extensively** - Arduino code is often modified later
4. **Use non-blocking code** - Avoid delay() in complex programs
5. **Add serial debugging** - Makes troubleshooting much easier
6. **Test incrementally** - Verify each component before combining
7. **Create reusable functions** - Cleaner code, easier to modify
8. **Document pin assignments** - Critical for hardware projects
9. **Add error handling** - Check sensor validity, bounds, etc.
10. **Provide live feedback** - Dashboards make testing interactive and fun

## Example Workflows

### Example 1: Simple LED Blink
```
User: "Make an LED blink"
1. Detect board → Arduino Uno on /dev/ttyACM0
2. Generate code → LED on pin 13, 1-second interval
3. Compile and upload
4. Create dashboard with on/off toggle and speed control
```

### Example 2: Temperature Monitor
```
User: "Monitor temperature on LCD"
1. Detect board → Uno with I2C LCD at 0x27
2. Ask: "What sensor?" → DHT22 on pin D4
3. Generate code → Read DHT22, display on LCD, serial output
4. Compile, install DHT library, upload
5. Create dashboard → Live temp/humidity graph, min/max tracking
```

### Example 3: Button-Controlled Servo
```
User: "Control a servo with a button"
1. Detect board → Uno with button on D2
2. Ask: "Which pin for servo? What angles?" → D9, 0° to 180°
3. Generate code → Button press rotates servo through positions
4. Compile and upload
5. Create dashboard → Visual servo position, manual control slider
```

## Quick Reference

### Common arduino-cli Commands

```bash
# Setup
arduino-cli config init
arduino-cli core update-index
arduino-cli core install arduino:avr

# Board management
arduino-cli board list
arduino-cli board listall

# Library management
arduino-cli lib search [name]
arduino-cli lib install "[name]"
arduino-cli lib list

# Compilation and upload
arduino-cli compile --fqbn [FQBN] [path]
arduino-cli upload -p [port] --fqbn [FQBN] [path]

# Combined compile + upload
arduino-cli compile --upload -p [port] --fqbn [FQBN] [path]
```

### Common FQBNs

- Arduino Uno: `arduino:avr:uno`
- Arduino Nano: `arduino:avr:nano`
- Arduino Mega: `arduino:avr:mega`
- ESP32: `esp32:esp32:esp32`
- ESP8266: `esp8266:esp8266:generic`

### Pin Reference Quick Guide

**Arduino Uno:**
- Digital: 0-13 (0-1 for Serial)
- Analog: A0-A5
- PWM: 3, 5, 6, 9, 10, 11
- I2C: SDA=A4, SCL=A5
- SPI: MISO=12, MOSI=11, SCK=13

**Arduino Mega:**
- Digital: 0-53
- Analog: A0-A15
- PWM: 2-13, 44-46
- I2C: SDA=20, SCL=21
- SPI: MISO=50, MOSI=51, SCK=52

---

## Summary

This skill provides end-to-end Arduino development from hardware detection through interactive testing. Always:
1. Start with board discovery
2. Guide user through interactive planning
3. Generate clean, well-documented code
4. Compile and upload with error handling
5. Create live testing dashboards for verification

The workflow is designed to be beginner-friendly while supporting advanced users with complex projects.
