# Common Arduino Libraries Reference

This document provides quick reference for frequently used Arduino libraries and their implementation patterns.

## Core Communication Libraries

### Wire.h (I2C)

**Purpose:** Communicate with I2C devices (sensors, displays, EEPROMs)

**Basic Usage:**
```cpp
#include <Wire.h>

void setup() {
  Wire.begin();  // Master mode
  // Wire.begin(8);  // Slave mode with address 8
}

// Scan for I2C devices
void i2cScan() {
  for (byte addr = 1; addr < 127; addr++) {
    Wire.beginTransmission(addr);
    byte error = Wire.endTransmission();
    if (error == 0) {
      Serial.print("Device at 0x");
      Serial.println(addr, HEX);
    }
  }
}

// Read from I2C device
byte readI2C(byte address, byte reg) {
  Wire.beginTransmission(address);
  Wire.write(reg);
  Wire.endTransmission();
  Wire.requestFrom(address, (byte)1);
  return Wire.read();
}
```

### SPI.h (Serial Peripheral Interface)

**Purpose:** High-speed communication with sensors, displays, SD cards

**Basic Usage:**
```cpp
#include <SPI.h>

void setup() {
  SPI.begin();
  SPI.setDataMode(SPI_MODE0);
  SPI.setClockDivider(SPI_CLOCK_DIV4);
}

void transferData(byte data) {
  digitalWrite(CS_PIN, LOW);
  byte result = SPI.transfer(data);
  digitalWrite(CS_PIN, HIGH);
}
```

## Display Libraries

### LiquidCrystal_I2C.h

**Purpose:** Control I2C LCD displays (16x2, 20x4)

**Installation:**
```bash
arduino-cli lib install "LiquidCrystal I2C"
```

**Usage:**
```cpp
#include <LiquidCrystal_I2C.h>

// Create LCD object (address, columns, rows)
LiquidCrystal_I2C lcd(0x27, 16, 2);

void setup() {
  lcd.init();
  lcd.backlight();
  lcd.setCursor(0, 0);  // column, row
  lcd.print("Hello World!");
}

// Custom characters
void createCustomChar() {
  byte heart[8] = {
    0b00000,
    0b01010,
    0b11111,
    0b11111,
    0b01110,
    0b00100,
    0b00000,
    0b00000
  };
  lcd.createChar(0, heart);
  lcd.write(0);  // Display custom character
}
```

### Adafruit_SSD1306.h (OLED)

**Purpose:** Control OLED displays (128x64, 128x32)

**Installation:**
```bash
arduino-cli lib install "Adafruit SSD1306"
arduino-cli lib install "Adafruit GFX Library"
```

**Usage:**
```cpp
#include <Adafruit_SSD1306.h>
#include <Adafruit_GFX.h>

#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
#define OLED_RESET -1

Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);

void setup() {
  if(!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
    Serial.println("OLED failed");
    for(;;);
  }
  
  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(WHITE);
  display.setCursor(0, 0);
  display.println("Hello!");
  display.display();
}
```

## Sensor Libraries

### DHT.h (Temperature/Humidity)

**Purpose:** Read DHT11, DHT22, DHT21 sensors

**Installation:**
```bash
arduino-cli lib install "DHT sensor library"
arduino-cli lib install "Adafruit Unified Sensor"
```

**Usage:**
```cpp
#include <DHT.h>

#define DHTPIN 2
#define DHTTYPE DHT22  // or DHT11, DHT21

DHT dht(DHTPIN, DHTTYPE);

void setup() {
  dht.begin();
}

void loop() {
  float humidity = dht.readHumidity();
  float temperature = dht.readTemperature();  // Celsius
  float fahrenheit = dht.readTemperature(true);
  
  if (isnan(humidity) || isnan(temperature)) {
    Serial.println("Failed to read from DHT sensor!");
    return;
  }
  
  float heatIndex = dht.computeHeatIndex(fahrenheit, humidity);
}
```

### Adafruit_BMP280.h (Pressure/Altitude)

**Purpose:** Read BMP280 barometric pressure and temperature

**Installation:**
```bash
arduino-cli lib install "Adafruit BMP280 Library"
arduino-cli lib install "Adafruit Unified Sensor"
```

**Usage:**
```cpp
#include <Adafruit_BMP280.h>

Adafruit_BMP280 bmp;

void setup() {
  if (!bmp.begin(0x76)) {  // or 0x77
    Serial.println("BMP280 not found");
    while (1);
  }
  
  // Configure sampling
  bmp.setSampling(Adafruit_BMP280::MODE_NORMAL,
                  Adafruit_BMP280::SAMPLING_X2,
                  Adafruit_BMP280::SAMPLING_X16,
                  Adafruit_BMP280::FILTER_X16,
                  Adafruit_BMP280::STANDBY_MS_500);
}

void loop() {
  float temp = bmp.readTemperature();
  float pressure = bmp.readPressure();  // Pa
  float altitude = bmp.readAltitude(1013.25);  // meters
}
```

### MPU6050.h (Accelerometer/Gyroscope)

**Purpose:** Read 6-axis motion sensor data

**Installation:**
```bash
arduino-cli lib install "MPU6050"
```

**Usage:**
```cpp
#include <MPU6050.h>

MPU6050 mpu;

void setup() {
  Wire.begin();
  mpu.initialize();
  
  if (!mpu.testConnection()) {
    Serial.println("MPU6050 connection failed");
    while(1);
  }
}

void loop() {
  int16_t ax, ay, az;
  int16_t gx, gy, gz;
  
  mpu.getMotion6(&ax, &ay, &az, &gx, &gy, &gz);
  
  // Convert to g and degrees/second
  float accelX = ax / 16384.0;
  float gyroX = gx / 131.0;
}
```

## Motor Control Libraries

### Servo.h

**Purpose:** Control hobby servo motors

**Usage:**
```cpp
#include <Servo.h>

Servo myServo;

void setup() {
  myServo.attach(9);  // Pin 9
  myServo.write(90);  // Position in degrees (0-180)
}

void sweep() {
  for (int pos = 0; pos <= 180; pos++) {
    myServo.write(pos);
    delay(15);
  }
}
```

### AccelStepper.h

**Purpose:** Control stepper motors with acceleration

**Installation:**
```bash
arduino-cli lib install "AccelStepper"
```

**Usage:**
```cpp
#include <AccelStepper.h>

// Define motor interface (1 = driver, 2 = 2-wire, 4 = 4-wire)
AccelStepper stepper(1, 2, 3);  // STEP, DIR pins

void setup() {
  stepper.setMaxSpeed(1000);
  stepper.setAcceleration(500);
  stepper.moveTo(2000);  // Move 2000 steps
}

void loop() {
  if (stepper.distanceToGo() == 0) {
    stepper.moveTo(-stepper.currentPosition());
  }
  stepper.run();  // Must be called frequently
}
```

## Storage Libraries

### SD.h

**Purpose:** Read/write SD cards

**Usage:**
```cpp
#include <SD.h>

#define CS_PIN 10

void setup() {
  if (!SD.begin(CS_PIN)) {
    Serial.println("SD initialization failed");
    return;
  }
  
  // Write file
  File dataFile = SD.open("data.txt", FILE_WRITE);
  if (dataFile) {
    dataFile.println("Hello World");
    dataFile.close();
  }
  
  // Read file
  dataFile = SD.open("data.txt");
  if (dataFile) {
    while (dataFile.available()) {
      Serial.write(dataFile.read());
    }
    dataFile.close();
  }
}
```

### EEPROM.h

**Purpose:** Non-volatile storage (survives power off)

**Usage:**
```cpp
#include <EEPROM.h>

void setup() {
  // Write byte
  EEPROM.write(0, 123);
  
  // Read byte
  int value = EEPROM.read(0);
  
  // Write int (2 bytes)
  EEPROM.put(0, 12345);
  
  // Read int
  int storedValue;
  EEPROM.get(0, storedValue);
}
```

## Network Libraries (ESP32/ESP8266)

### WiFi.h

**Purpose:** Connect to WiFi networks

**Usage:**
```cpp
#include <WiFi.h>

const char* ssid = "your-network";
const char* password = "your-password";

void setup() {
  WiFi.begin(ssid, password);
  
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  
  Serial.println("\nConnected!");
  Serial.print("IP: ");
  Serial.println(WiFi.localIP());
}
```

### WebServer.h / ESP8266WebServer.h

**Purpose:** Create web server on ESP32/ESP8266

**Usage:**
```cpp
#include <WiFi.h>
#include <WebServer.h>  // ESP32
// #include <ESP8266WebServer.h>  // ESP8266

WebServer server(80);

void handleRoot() {
  server.send(200, "text/html", "<h1>Hello from ESP32!</h1>");
}

void setup() {
  WiFi.begin(ssid, password);
  // Wait for connection...
  
  server.on("/", handleRoot);
  server.begin();
}

void loop() {
  server.handleClient();
}
```

### HTTPClient.h

**Purpose:** Make HTTP requests

**Usage:**
```cpp
#include <HTTPClient.h>

void makeRequest() {
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    
    http.begin("http://api.example.com/data");
    int httpCode = http.GET();
    
    if (httpCode > 0) {
      String payload = http.getString();
      Serial.println(payload);
    }
    
    http.end();
  }
}
```

## Utility Libraries

### ArduinoJson.h

**Purpose:** Parse and create JSON

**Installation:**
```bash
arduino-cli lib install "ArduinoJson"
```

**Usage:**
```cpp
#include <ArduinoJson.h>

void parseJson() {
  StaticJsonDocument<200> doc;
  
  // Parse
  deserializeJson(doc, "{\"sensor\":\"temp\",\"value\":23.5}");
  const char* sensor = doc["sensor"];
  float value = doc["value"];
  
  // Create
  doc["timestamp"] = millis();
  doc["data"] = 42;
  serializeJson(doc, Serial);
}
```

### Ticker.h (ESP32/ESP8266)

**Purpose:** Execute functions at intervals

**Usage:**
```cpp
#include <Ticker.h>

Ticker timer;

void timerCallback() {
  Serial.println("Timer triggered!");
}

void setup() {
  timer.attach(1.0, timerCallback);  // Every 1 second
}
```

## Best Practices

### Library Selection
- Always use the latest stable version
- Check compatibility with your board
- Read examples in library documentation
- Verify memory requirements for your board

### Common Issues

**Compilation errors:**
- Install dependencies (often "Adafruit Unified Sensor")
- Update library to latest version
- Check board core is up to date

**Runtime errors:**
- Verify I2C/SPI addresses
- Check pin connections
- Ensure adequate power supply
- Add timeout checks

**Memory issues:**
- Use F() macro for string constants
- Reduce buffer sizes if needed
- Consider PROGMEM for large data
- Check available RAM with:
```cpp
extern int __heap_start, *__brkval;
int freeMemory() {
  int v;
  return (int) &v - (__brkval == 0 ? (int) &__heap_start : (int) __brkval);
}
```

### Library Installation Troubleshooting

If `arduino-cli lib install` fails:
1. Update library index: `arduino-cli lib update-index`
2. Search for exact name: `arduino-cli lib search [name]`
3. Check spelling and spaces
4. Install manually from GitHub if needed
