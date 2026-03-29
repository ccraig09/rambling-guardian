# ESP32 Specific Guide

Complete guide for ESP32 development with unique features, capabilities, and best practices.

## ESP32 Overview

The ESP32 is a powerful microcontroller with built-in WiFi and Bluetooth, making it ideal for IoT projects.

### Key Specifications

| Feature | ESP32 | ESP32-S2 | ESP32-C3 | ESP32-S3 |
|---------|-------|----------|----------|----------|
| CPU | Dual-core 240MHz | Single 240MHz | Single RISC-V 160MHz | Dual 240MHz |
| WiFi | 802.11 b/g/n | 802.11 b/g/n | 802.11 b/g/n | 802.11 b/g/n |
| Bluetooth | Classic + BLE | - | BLE 5.0 | BLE 5.0 |
| GPIO | 34 | 43 | 22 | 45 |
| ADC | 18 channels (12-bit) | 20 channels | 6 channels | 20 channels |
| DAC | 2 channels | 2 channels | - | - |
| Touch Pins | 10 | 14 | - | 14 |
| Flash | 4MB (typical) | 4MB | 4MB | 8MB+ |
| PSRAM | Optional | Optional | - | Optional 8MB |

## Board Installation

### Install ESP32 Board Support

```bash
# Add ESP32 board manager URL
arduino-cli config add board_manager.additional_urls https://espressif.github.io/arduino-esp32/package_esp32_index.json

# Update index
arduino-cli core update-index

# Install ESP32 core
arduino-cli core install esp32:esp32

# Verify installation
arduino-cli core list
```

### Common ESP32 FQBNs

```bash
# ESP32 Dev Module (most common)
esp32:esp32:esp32

# ESP32-S2
esp32:esp32:esp32s2

# ESP32-C3
esp32:esp32:esp32c3

# ESP32-S3
esp32:esp32:esp32s3

# Specific boards
esp32:esp32:esp32doit-devkit-v1    # DOIT ESP32 DevKit V1
esp32:esp32:nodemcu-32s            # NodeMCU-32S
esp32:esp32:esp32-poe              # ESP32-PoE
```

## Pin Mapping

### ESP32 DevKit V1 (30-pin)

**GPIO Pins:**
- Usable: 0, 2, 4, 5, 12-19, 21-23, 25-27, 32-33
- Input only: 34-39 (no pull-up/pull-down)
- Boot mode pins: 0, 2, 5, 12, 15 (use carefully)

**Special Functions:**
- **ADC1**: GPIO 32-39 (use when WiFi active)
- **ADC2**: GPIO 0, 2, 4, 12-15, 25-27 (conflicts with WiFi)
- **DAC**: GPIO 25, 26
- **Touch**: GPIO 0, 2, 4, 12-15, 27, 32, 33
- **I2C**: Any GPIO (default SDA=21, SCL=22)
- **SPI**: Any GPIO (default MOSI=23, MISO=19, SCK=18, SS=5)
- **UART0** (Serial): TX=GPIO1, RX=GPIO3 (USB)
- **UART1**: TX=GPIO10, RX=GPIO9 (internal flash)
- **UART2**: TX=GPIO17, RX=GPIO16 (available)

**Strapping Pins (Special Behavior):**
- GPIO 0: Boot mode (must be HIGH at boot for normal mode)
- GPIO 2: Boot mode
- GPIO 5: Boot mode
- GPIO 12: Flash voltage (LOW=3.3V, HIGH=1.8V)
- GPIO 15: Boot mode

### Pin Safety

**Avoid at boot:**
- GPIO 6-11: Connected to internal flash
- GPIO 1, 3: Serial (USB connection)

**Safe for general use:**
- GPIO 4, 16, 17, 18, 19, 21, 22, 23, 25, 26, 27, 32, 33

## WiFi Features

### Basic WiFi Connection

```cpp
#include <WiFi.h>

const char* ssid = "your-network";
const char* password = "your-password";

void setup() {
  Serial.begin(115200);
  
  // Connect to WiFi
  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);
  
  Serial.print("Connecting to WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  
  Serial.println("\nConnected!");
  Serial.print("IP Address: ");
  Serial.println(WiFi.localIP());
  Serial.print("MAC Address: ");
  Serial.println(WiFi.macAddress());
  Serial.print("Signal Strength (RSSI): ");
  Serial.println(WiFi.RSSI());
}

void loop() {
  // Check connection
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi disconnected! Reconnecting...");
    WiFi.reconnect();
  }
}
```

### WiFi Access Point Mode

```cpp
#include <WiFi.h>

const char* ap_ssid = "ESP32-AP";
const char* ap_password = "12345678";  // Min 8 characters

void setup() {
  Serial.begin(115200);
  
  // Create Access Point
  WiFi.softAP(ap_ssid, ap_password);
  
  IPAddress IP = WiFi.softAPIP();
  Serial.print("AP IP address: ");
  Serial.println(IP);
  
  // Get connected clients
  Serial.print("Clients connected: ");
  Serial.println(WiFi.softAPgetStationNum());
}
```

### WiFi Scanning

```cpp
void scanNetworks() {
  Serial.println("Scanning WiFi networks...");
  int n = WiFi.scanNetworks();
  
  Serial.println("Scan complete");
  if (n == 0) {
    Serial.println("No networks found");
  } else {
    Serial.printf("%d networks found:\n", n);
    for (int i = 0; i < n; i++) {
      Serial.printf("%d: %s (%d dBm) %s\n", 
        i + 1,
        WiFi.SSID(i).c_str(),
        WiFi.RSSI(i),
        WiFi.encryptionType(i) == WIFI_AUTH_OPEN ? "Open" : "Encrypted"
      );
    }
  }
}
```

### WiFi Events

```cpp
void WiFiEvent(WiFiEvent_t event) {
  switch(event) {
    case SYSTEM_EVENT_STA_GOT_IP:
      Serial.println("WiFi connected");
      Serial.print("IP: ");
      Serial.println(WiFi.localIP());
      break;
    case SYSTEM_EVENT_STA_DISCONNECTED:
      Serial.println("WiFi lost connection");
      break;
    default:
      break;
  }
}

void setup() {
  WiFi.onEvent(WiFiEvent);
  WiFi.begin(ssid, password);
}
```

## Web Server

### Simple Web Server

```cpp
#include <WiFi.h>
#include <WebServer.h>

WebServer server(80);

// Root page
void handleRoot() {
  String html = R"(
<!DOCTYPE html>
<html>
<head>
  <title>ESP32 Server</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body { font-family: Arial; margin: 20px; background: #1a1a1a; color: white; }
    .button { padding: 15px 30px; background: #4CAF50; color: white; 
              border: none; border-radius: 5px; font-size: 18px; cursor: pointer; }
    .button:hover { background: #45a049; }
  </style>
</head>
<body>
  <h1>ESP32 Web Server</h1>
  <p>Sensor Value: <span id="value">--</span></p>
  <button class="button" onclick="toggleLED()">Toggle LED</button>
  
  <script>
    function toggleLED() {
      fetch('/toggle').then(() => console.log('LED toggled'));
    }
    
    setInterval(() => {
      fetch('/sensor')
        .then(r => r.text())
        .then(v => document.getElementById('value').textContent = v);
    }, 1000);
  </script>
</body>
</html>
  )";
  
  server.send(200, "text/html", html);
}

// API endpoints
void handleToggle() {
  static bool ledState = false;
  ledState = !ledState;
  digitalWrite(LED_PIN, ledState);
  server.send(200, "text/plain", ledState ? "ON" : "OFF");
}

void handleSensor() {
  int value = analogRead(SENSOR_PIN);
  server.send(200, "text/plain", String(value));
}

void setup() {
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
  }
  
  // Define routes
  server.on("/", handleRoot);
  server.on("/toggle", handleToggle);
  server.on("/sensor", handleSensor);
  
  server.begin();
  Serial.println("Server started");
}

void loop() {
  server.handleClient();
}
```

### WebSocket Server

```cpp
#include <WebSocketsServer.h>

WebSocketsServer webSocket(81);

void webSocketEvent(uint8_t num, WStype_t type, uint8_t * payload, size_t length) {
  switch(type) {
    case WStype_DISCONNECTED:
      Serial.printf("[%u] Disconnected!\n", num);
      break;
    case WStype_CONNECTED:
      {
        IPAddress ip = webSocket.remoteIP(num);
        Serial.printf("[%u] Connected from %s\n", num, ip.toString().c_str());
      }
      break;
    case WStype_TEXT:
      Serial.printf("[%u] Text: %s\n", num, payload);
      // Echo back
      webSocket.sendTXT(num, payload);
      break;
  }
}

void setup() {
  webSocket.begin();
  webSocket.onEvent(webSocketEvent);
}

void loop() {
  webSocket.loop();
  
  // Broadcast to all clients
  static unsigned long lastBroadcast = 0;
  if (millis() - lastBroadcast > 1000) {
    int value = analogRead(SENSOR_PIN);
    String json = "{\"sensor\":" + String(value) + "}";
    webSocket.broadcastTXT(json);
    lastBroadcast = millis();
  }
}
```

## Bluetooth Features

### Bluetooth Serial (Classic)

```cpp
#include <BluetoothSerial.h>

BluetoothSerial SerialBT;

void setup() {
  Serial.begin(115200);
  SerialBT.begin("ESP32_BT"); // Bluetooth device name
  Serial.println("Bluetooth started - ready to pair!");
}

void loop() {
  // Forward data between Serial and Bluetooth
  if (Serial.available()) {
    SerialBT.write(Serial.read());
  }
  if (SerialBT.available()) {
    Serial.write(SerialBT.read());
  }
}
```

### BLE (Bluetooth Low Energy) Server

```cpp
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>

BLEServer *pServer = NULL;
BLECharacteristic *pCharacteristic = NULL;
bool deviceConnected = false;

// UUIDs (generate your own at uuidgenerator.net)
#define SERVICE_UUID        "4fafc201-1fb5-459e-8fcc-c5c9c331914b"
#define CHARACTERISTIC_UUID "beb5483e-36e1-4688-b7f5-ea07361b26a8"

class MyServerCallbacks: public BLEServerCallbacks {
  void onConnect(BLEServer* pServer) {
    deviceConnected = true;
    Serial.println("Device connected");
  }
  
  void onDisconnect(BLEServer* pServer) {
    deviceConnected = false;
    Serial.println("Device disconnected");
    pServer->startAdvertising(); // Restart advertising
  }
};

void setup() {
  Serial.begin(115200);
  
  // Create BLE Device
  BLEDevice::init("ESP32_BLE");
  
  // Create BLE Server
  pServer = BLEDevice::createServer();
  pServer->setCallbacks(new MyServerCallbacks());
  
  // Create BLE Service
  BLEService *pService = pServer->createService(SERVICE_UUID);
  
  // Create BLE Characteristic
  pCharacteristic = pService->createCharacteristic(
    CHARACTERISTIC_UUID,
    BLECharacteristic::PROPERTY_READ |
    BLECharacteristic::PROPERTY_WRITE |
    BLECharacteristic::PROPERTY_NOTIFY
  );
  
  pCharacteristic->addDescriptor(new BLE2902());
  
  // Start service
  pService->start();
  
  // Start advertising
  BLEAdvertising *pAdvertising = BLEDevice::getAdvertising();
  pAdvertising->addServiceUUID(SERVICE_UUID);
  pAdvertising->setScanResponse(true);
  pAdvertising->setMinPreferred(0x06);
  pAdvertising->setMinPreferred(0x12);
  BLEDevice::startAdvertising();
  
  Serial.println("BLE server started - waiting for connections");
}

void loop() {
  if (deviceConnected) {
    // Send data to connected device
    int value = analogRead(34);
    pCharacteristic->setValue(String(value).c_str());
    pCharacteristic->notify();
    delay(1000);
  }
}
```

## Advanced Features

### Dual Core Programming

```cpp
TaskHandle_t Task1;
TaskHandle_t Task2;

void Task1code(void * pvParameters) {
  Serial.print("Task1 running on core ");
  Serial.println(xPortGetCoreID());
  
  while(true) {
    // High-priority task on Core 0
    Serial.println("Task1");
    delay(1000);
  }
}

void Task2code(void * pvParameters) {
  Serial.print("Task2 running on core ");
  Serial.println(xPortGetCoreID());
  
  while(true) {
    // WiFi/BLE tasks on Core 1
    Serial.println("Task2");
    delay(2000);
  }
}

void setup() {
  Serial.begin(115200);
  
  // Create tasks on specific cores
  xTaskCreatePinnedToCore(
    Task1code,   // Function
    "Task1",     // Name
    10000,       // Stack size
    NULL,        // Parameters
    1,           // Priority
    &Task1,      // Task handle
    0            // Core ID (0 or 1)
  );
  
  xTaskCreatePinnedToCore(
    Task2code,
    "Task2",
    10000,
    NULL,
    1,
    &Task2,
    1  // Run on Core 1
  );
}

void loop() {
  // Main loop runs on Core 1
}
```

### Deep Sleep Mode

```cpp
#define SLEEP_DURATION 10  // seconds

void setup() {
  Serial.begin(115200);
  
  // Print wake-up reason
  esp_sleep_wakeup_cause_t wakeup_reason = esp_sleep_get_wakeup_cause();
  switch(wakeup_reason) {
    case ESP_SLEEP_WAKEUP_TIMER:
      Serial.println("Wakeup: Timer");
      break;
    case ESP_SLEEP_WAKEUP_EXT0:
      Serial.println("Wakeup: External signal");
      break;
    default:
      Serial.println("First boot");
      break;
  }
  
  // Do work
  Serial.println("Doing work...");
  delay(5000);
  
  // Configure wake-up
  esp_sleep_enable_timer_wakeup(SLEEP_DURATION * 1000000ULL);  // microseconds
  
  Serial.println("Going to sleep now");
  esp_deep_sleep_start();
}

void loop() {
  // Never reached - deep sleep restarts ESP32
}
```

### Wake on Touch

```cpp
#define TOUCH_PIN T0  // GPIO 4

void setup() {
  Serial.begin(115200);
  
  // Configure touch wake-up (lower = more sensitive)
  touchAttachInterrupt(TOUCH_PIN, callback, 40);
  esp_sleep_enable_touchpad_wakeup();
  
  Serial.println("Touch the pin to wake up");
  delay(1000);
  
  esp_deep_sleep_start();
}

void callback() {
  // This runs on wake-up
}

void loop() {}
```

### ADC Reading (with calibration)

```cpp
void setup() {
  Serial.begin(115200);
  
  // Configure ADC
  analogReadResolution(12);  // 0-4095
  analogSetAttenuation(ADC_11db);  // Full range 0-3.3V
}

void loop() {
  // Read raw value
  int rawValue = analogRead(34);
  
  // Convert to voltage
  float voltage = rawValue * (3.3 / 4095.0);
  
  Serial.printf("Raw: %d, Voltage: %.2fV\n", rawValue, voltage);
  delay(1000);
}
```

### DAC Output

```cpp
// DAC available on GPIO 25 and 26
void setup() {
  // DAC resolution is 8-bit (0-255)
}

void loop() {
  // Generate sine wave on DAC1 (GPIO25)
  for (int i = 0; i < 360; i++) {
    float rad = i * PI / 180.0;
    int value = (sin(rad) + 1) * 127.5;  // 0-255
    dacWrite(25, value);
    delayMicroseconds(100);
  }
}
```

### Capacitive Touch Sensors

```cpp
const int TOUCH_THRESHOLD = 40;

void setup() {
  Serial.begin(115200);
}

void loop() {
  // Read touch value (lower = more touch)
  int touchValue = touchRead(T0);  // GPIO 4
  
  Serial.printf("Touch value: %d ", touchValue);
  
  if (touchValue < TOUCH_THRESHOLD) {
    Serial.println("- TOUCHED!");
  } else {
    Serial.println();
  }
  
  delay(100);
}
```

## Power Management

### Power Modes

```cpp
#include <esp_wifi.h>

void setup() {
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
  }
  
  // Light sleep (WiFi remains connected)
  esp_wifi_set_ps(WIFI_PS_MIN_MODEM);  // Modem sleep
  
  // Reduce CPU frequency
  setCpuFrequencyMhz(80);  // Options: 240, 160, 80, 40, 20, 10
}
```

## NVS (Non-Volatile Storage)

```cpp
#include <Preferences.h>

Preferences preferences;

void setup() {
  Serial.begin(115200);
  
  // Open namespace
  preferences.begin("my-app", false);  // false = read/write
  
  // Write values
  preferences.putInt("counter", 0);
  preferences.putString("name", "ESP32");
  preferences.putFloat("temp", 25.5);
  
  // Read values
  int counter = preferences.getInt("counter", 0);  // default = 0
  String name = preferences.getString("name", "");
  float temp = preferences.getFloat("temp", 0.0);
  
  Serial.printf("Counter: %d, Name: %s, Temp: %.1f\n", counter, name.c_str(), temp);
  
  // Close
  preferences.end();
}
```

## File System (SPIFFS)

```cpp
#include <SPIFFS.h>

void setup() {
  Serial.begin(115200);
  
  // Mount SPIFFS
  if (!SPIFFS.begin(true)) {
    Serial.println("SPIFFS Mount Failed");
    return;
  }
  
  // Write file
  File file = SPIFFS.open("/data.txt", FILE_WRITE);
  if (file) {
    file.println("Hello ESP32!");
    file.close();
  }
  
  // Read file
  file = SPIFFS.open("/data.txt", FILE_READ);
  if (file) {
    while (file.available()) {
      Serial.write(file.read());
    }
    file.close();
  }
  
  // List files
  File root = SPIFFS.open("/");
  File entry = root.openNextFile();
  while (entry) {
    Serial.printf("File: %s, Size: %d\n", entry.name(), entry.size());
    entry = root.openNextFile();
  }
}
```

## Common Libraries

### Install ESP32-specific libraries

```bash
# HTTP Client
arduino-cli lib install "HTTPClient"

# WebServer
# (Built into ESP32 core)

# WebSockets
arduino-cli lib install "WebSockets"

# MQTT
arduino-cli lib install "PubSubClient"

# JSON
arduino-cli lib install "ArduinoJson"

# NTP Time
# (Built into ESP32 core)

# mDNS
# (Built into ESP32 core)
```

## Best Practices

### 1. WiFi Connection with Timeout

```cpp
bool connectWiFi(unsigned long timeout_ms) {
  WiFi.begin(ssid, password);
  
  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED) {
    if (millis() - start > timeout_ms) {
      Serial.println("WiFi timeout");
      return false;
    }
    delay(100);
  }
  return true;
}
```

### 2. Avoid ADC2 When Using WiFi

```cpp
// Use ADC1 pins (32-39) when WiFi is active
// ADC2 (0, 2, 4, 12-15, 25-27) conflicts with WiFi
int sensorValue = analogRead(34);  // GPIO34 is ADC1
```

### 3. Watchdog Timer

```cpp
#include <esp_task_wdt.h>

void setup() {
  // Enable watchdog (10 seconds)
  esp_task_wdt_init(10, true);
  esp_task_wdt_add(NULL);
}

void loop() {
  // Reset watchdog
  esp_task_wdt_reset();
  
  // Do work
  delay(1000);
}
```

### 4. OTA Updates

```cpp
#include <ArduinoOTA.h>

void setup() {
  WiFi.begin(ssid, password);
  
  ArduinoOTA.setHostname("esp32-device");
  ArduinoOTA.setPassword("admin");
  
  ArduinoOTA.onStart([]() {
    Serial.println("OTA Start");
  });
  
  ArduinoOTA.onEnd([]() {
    Serial.println("\nOTA End");
  });
  
  ArduinoOTA.onProgress([](unsigned int progress, unsigned int total) {
    Serial.printf("Progress: %u%%\r", (progress / (total / 100)));
  });
  
  ArduinoOTA.begin();
}

void loop() {
  ArduinoOTA.handle();
}
```

## Troubleshooting

### Board Not Detected

```bash
# Check USB connection
ls /dev/ttyUSB*

# Install drivers (Linux)
sudo usermod -a -G dialout $USER

# Try different baud rates
arduino-cli upload -p /dev/ttyUSB0 --fqbn esp32:esp32:esp32 -b 115200 ./project
```

### Brown-out Detector Reset

Add to sketch:
```cpp
// Increase brown-out detection threshold
#include "soc/soc.h"
#include "soc/rtc_cntl_reg.h"

void setup() {
  WRITE_PERI_REG(RTC_CNTL_BROWN_OUT_REG, 0);  // Disable
}
```

Or use better power supply (5V 2A minimum).

### WiFi Won't Connect

```cpp
// Add diagnostics
WiFi.printDiag(Serial);
Serial.println(WiFi.status());  // WL_CONNECTED = 3
```

Common issues:
- Wrong credentials
- 5GHz network (ESP32 only supports 2.4GHz)
- Hidden SSID (requires special config)
- Power supply insufficient

---

## Quick Reference

**Installation:**
```bash
arduino-cli core install esp32:esp32
```

**Compile:**
```bash
arduino-cli compile --fqbn esp32:esp32:esp32 ./project
```

**Upload:**
```bash
arduino-cli upload -p /dev/ttyUSB0 --fqbn esp32:esp32:esp32 ./project
```

**Monitor:**
```bash
arduino-cli monitor -p /dev/ttyUSB0 -c baudrate=115200
```
