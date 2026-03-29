#!/usr/bin/env python3
"""
Arduino Hardware Discovery Script

Automatically detects connected Arduino boards, identifies their capabilities,
and probes for connected components.
"""

import subprocess
import json
import sys
import time

def run_command(cmd, capture_output=True):
    """Execute shell command and return output."""
    try:
        if capture_output:
            result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
            return result.returncode, result.stdout, result.stderr
        else:
            result = subprocess.run(cmd, shell=True)
            return result.returncode, "", ""
    except Exception as e:
        return 1, "", str(e)

def detect_boards():
    """Detect connected Arduino boards using arduino-cli."""
    print("🔍 Detecting Arduino boards...")
    returncode, stdout, stderr = run_command("arduino-cli board list --format json")
    
    if returncode != 0:
        print(f"❌ Error detecting boards: {stderr}")
        return []
    
    try:
        boards = json.loads(stdout)
        detected = boards.get('detected_ports', [])
        
        if not detected:
            print("⚠️  No Arduino boards detected.")
            print("   Check USB connection and try again.")
            return []
        
        print(f"✅ Found {len(detected)} board(s)")
        return detected
    except json.JSONDecodeError:
        print("❌ Error parsing board detection output")
        return []

def get_board_info(board):
    """Extract detailed board information."""
    port = board.get('port', {}).get('address', 'Unknown')
    protocol = board.get('port', {}).get('protocol', 'Unknown')
    
    matching_boards = board.get('matching_boards', [])
    if matching_boards:
        board_info = matching_boards[0]
        name = board_info.get('name', 'Unknown Board')
        fqbn = board_info.get('fqbn', 'Unknown')
    else:
        name = "Unknown Board"
        fqbn = "Unknown"
    
    return {
        'port': port,
        'protocol': protocol,
        'name': name,
        'fqbn': fqbn
    }

def get_board_capabilities(fqbn):
    """Return board capabilities based on FQBN."""
    capabilities = {
        'arduino:avr:uno': {
            'digital_pins': 14,
            'analog_pins': 6,
            'pwm_pins': [3, 5, 6, 9, 10, 11],
            'voltage': '5V',
            'flash': '32KB',
            'sram': '2KB',
            'i2c': {'sda': 'A4', 'scl': 'A5'},
            'spi': {'miso': 12, 'mosi': 11, 'sck': 13}
        },
        'arduino:avr:nano': {
            'digital_pins': 14,
            'analog_pins': 8,
            'pwm_pins': [3, 5, 6, 9, 10, 11],
            'voltage': '5V',
            'flash': '32KB',
            'sram': '2KB',
            'i2c': {'sda': 'A4', 'scl': 'A5'},
            'spi': {'miso': 12, 'mosi': 11, 'sck': 13}
        },
        'arduino:avr:mega': {
            'digital_pins': 54,
            'analog_pins': 16,
            'pwm_pins': list(range(2, 14)) + [44, 45, 46],
            'voltage': '5V',
            'flash': '256KB',
            'sram': '8KB',
            'i2c': {'sda': 20, 'scl': 21},
            'spi': {'miso': 50, 'mosi': 51, 'sck': 52}
        },
        'esp32:esp32:esp32': {
            'digital_pins': 36,
            'analog_pins': 18,
            'pwm_pins': 16,
            'voltage': '3.3V',
            'flash': '4MB',
            'sram': '520KB',
            'wifi': True,
            'bluetooth': True
        }
    }
    
    # Try exact match first
    if fqbn in capabilities:
        return capabilities[fqbn]
    
    # Try partial match
    for known_fqbn, caps in capabilities.items():
        if known_fqbn in fqbn or fqbn in known_fqbn:
            return caps
    
    # Default capabilities
    return {
        'digital_pins': 'Unknown',
        'analog_pins': 'Unknown',
        'pwm_pins': 'Unknown',
        'voltage': 'Unknown',
        'flash': 'Unknown',
        'sram': 'Unknown'
    }

def create_discovery_sketch(board_type):
    """Generate hardware discovery sketch."""
    sketch = '''/*
 * Arduino Hardware Discovery Sketch
 * Automatically detects connected components
 */

#include <Wire.h>

void setup() {
  Serial.begin(9600);
  while (!Serial) { delay(10); }
  
  Serial.println("=== ARDUINO HARDWARE DISCOVERY ===");
  Serial.println();
  
  // Board identification
  Serial.println("--- Board Information ---");
  Serial.print("Board Type: ");
  #if defined(ARDUINO_AVR_UNO)
    Serial.println("Arduino Uno");
  #elif defined(ARDUINO_AVR_NANO)
    Serial.println("Arduino Nano");
  #elif defined(ARDUINO_AVR_MEGA2560)
    Serial.println("Arduino Mega");
  #elif defined(ARDUINO_ARCH_ESP32)
    Serial.println("ESP32");
  #elif defined(ARDUINO_ARCH_ESP8266)
    Serial.println("ESP8266");
  #else
    Serial.println("Unknown");
  #endif
  
  Serial.print("Clock Speed: ");
  Serial.print(F_CPU / 1000000);
  Serial.println(" MHz");
  Serial.println();
  
  // Digital pin scan
  Serial.println("--- Digital Pin Scan ---");
  Serial.println("Pin | State");
  Serial.println("----|-------");
  
  #if defined(ARDUINO_AVR_UNO) || defined(ARDUINO_AVR_NANO)
    int maxDigitalPin = 13;
  #elif defined(ARDUINO_AVR_MEGA2560)
    int maxDigitalPin = 53;
  #else
    int maxDigitalPin = 13;  // Safe default
  #endif
  
  for (int pin = 2; pin <= maxDigitalPin; pin++) {
    pinMode(pin, INPUT_PULLUP);
    delay(5);
    int state = digitalRead(pin);
    
    Serial.print("D");
    if (pin < 10) Serial.print(" ");
    Serial.print(pin);
    Serial.print(" | ");
    
    if (state == HIGH) {
      Serial.println("HIGH (floating/pulled up)");
    } else {
      Serial.println("LOW  (grounded/active)");
    }
  }
  Serial.println();
  
  // Analog pin scan
  Serial.println("--- Analog Pin Scan ---");
  Serial.println("Pin | Value | Voltage");
  Serial.println("----|-------|--------");
  
  #if defined(ARDUINO_AVR_UNO)
    int maxAnalogPin = 5;
  #elif defined(ARDUINO_AVR_NANO)
    int maxAnalogPin = 7;
  #elif defined(ARDUINO_AVR_MEGA2560)
    int maxAnalogPin = 15;
  #else
    int maxAnalogPin = 5;
  #endif
  
  for (int pin = 0; pin <= maxAnalogPin; pin++) {
    int value = analogRead(pin);
    float voltage = value * (5.0 / 1023.0);  // Assuming 5V reference
    
    Serial.print("A");
    Serial.print(pin);
    Serial.print("  | ");
    
    if (value < 10) Serial.print("   ");
    else if (value < 100) Serial.print("  ");
    else if (value < 1000) Serial.print(" ");
    
    Serial.print(value);
    Serial.print(" | ");
    Serial.print(voltage, 2);
    Serial.print("V");
    
    // Interpretation
    if (value < 10) {
      Serial.println(" (GND)");
    } else if (value > 1000) {
      Serial.println(" (VCC)");
    } else if (value > 400 && value < 600) {
      Serial.println(" (Potentiometer/Sensor?)");
    } else {
      Serial.println();
    }
  }
  Serial.println();
  
  // I2C device scan
  Serial.println("--- I2C Device Scan ---");
  Wire.begin();
  byte count = 0;
  
  for (byte addr = 1; addr < 127; addr++) {
    Wire.beginTransmission(addr);
    byte error = Wire.endTransmission();
    
    if (error == 0) {
      Serial.print("I2C device found at 0x");
      if (addr < 16) Serial.print("0");
      Serial.print(addr, HEX);
      
      // Common device identification
      switch(addr) {
        case 0x27:
        case 0x3F:
          Serial.println(" (Likely LCD Display)");
          break;
        case 0x68:
          Serial.println(" (Likely MPU6050/DS1307 RTC)");
          break;
        case 0x76:
        case 0x77:
          Serial.println(" (Likely BMP280/BME280)");
          break;
        case 0x3C:
        case 0x3D:
          Serial.println(" (Likely OLED Display)");
          break;
        default:
          Serial.println();
      }
      count++;
    }
  }
  
  if (count == 0) {
    Serial.println("No I2C devices found");
  } else {
    Serial.print("Found ");
    Serial.print(count);
    Serial.println(" I2C device(s)");
  }
  Serial.println();
  
  Serial.println("=== DISCOVERY COMPLETE ===");
  Serial.println("Monitoring analog pins for changes...");
}

void loop() {
  // Continuous monitoring
  static unsigned long lastPrint = 0;
  
  if (millis() - lastPrint > 2000) {
    lastPrint = millis();
    
    // Check for significant analog changes
    for (int pin = 0; pin <= 5; pin++) {
      int value = analogRead(pin);
      if (value > 50 && value < 1000) {  // Likely a sensor
        Serial.print("A");
        Serial.print(pin);
        Serial.print(": ");
        Serial.println(value);
      }
    }
  }
}
'''
    return sketch

def display_board_summary(board_info, capabilities):
    """Display formatted board information."""
    print("\n" + "="*60)
    print("🔍 ARDUINO BOARD DETECTED")
    print("="*60)
    print(f"📌 Board Name:  {board_info['name']}")
    print(f"🔌 Port:        {board_info['port']}")
    print(f"📡 Protocol:    {board_info['protocol']}")
    print(f"🏷️  FQBN:       {board_info['fqbn']}")
    print()
    print("📊 BOARD CAPABILITIES")
    print("-" * 60)
    print(f"Digital Pins:   {capabilities['digital_pins']}")
    print(f"Analog Pins:    {capabilities['analog_pins']}")
    print(f"PWM Pins:       {capabilities['pwm_pins']}")
    print(f"Voltage:        {capabilities['voltage']}")
    print(f"Flash Memory:   {capabilities['flash']}")
    print(f"SRAM:           {capabilities['sram']}")
    
    if 'i2c' in capabilities:
        i2c = capabilities['i2c']
        print(f"I2C:            SDA={i2c['sda']}, SCL={i2c['scl']}")
    
    if 'spi' in capabilities:
        spi = capabilities['spi']
        print(f"SPI:            MISO={spi['miso']}, MOSI={spi['mosi']}, SCK={spi['sck']}")
    
    if capabilities.get('wifi'):
        print("WiFi:           Yes ✓")
    
    if capabilities.get('bluetooth'):
        print("Bluetooth:      Yes ✓")
    
    print("="*60)

def main():
    """Main discovery workflow."""
    print("Arduino Hardware Discovery Tool")
    print("="*60)
    
    # Detect boards
    boards = detect_boards()
    
    if not boards:
        print("\n💡 Troubleshooting:")
        print("   1. Check USB cable is connected")
        print("   2. Try a different USB port")
        print("   3. Ensure arduino-cli is installed")
        print("   4. Check for driver issues (CH340 for clones)")
        sys.exit(1)
    
    # Process each board
    for idx, board in enumerate(boards):
        if idx > 0:
            print("\n" + "="*60)
        
        board_info = get_board_info(board)
        capabilities = get_board_capabilities(board_info['fqbn'])
        
        display_board_summary(board_info, capabilities)
        
        # Offer to run discovery sketch
        print("\n📝 Next Steps:")
        print("   1. Upload discovery sketch to probe for components")
        print("   2. Monitor serial output for detected hardware")
        print("   3. Use findings to plan your project")
        
        # Save board info to JSON
        output_file = f"/tmp/arduino_board_{idx}.json"
        with open(output_file, 'w') as f:
            json.dump({
                'info': board_info,
                'capabilities': capabilities
            }, f, indent=2)
        
        print(f"\n💾 Board info saved to: {output_file}")
    
    print("\n✅ Discovery complete!")

if __name__ == "__main__":
    main()
