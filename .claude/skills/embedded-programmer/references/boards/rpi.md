# Raspberry Pi Platform Guide

Complete guide for Raspberry Pi single-board computer development.

## Overview

Raspberry Pi is a series of credit-card-sized single-board computers running Linux, ideal for projects requiring computing power, networking, and GPIO control.

## Models

| Model | CPU | RAM | GPIO | Use Case |
|-------|-----|-----|------|----------|
| Pi Zero / Zero W | 1GHz single-core | 512MB | 40-pin | Minimal projects, WiFi optional |
| Pi Zero 2 W | 1GHz quad-core | 512MB | 40-pin | Better performance, WiFi/BT |
| Pi 3 Model B+ | 1.4GHz quad-core | 1GB | 40-pin | General purpose |
| Pi 4 Model B | 1.5GHz quad-core | 2/4/8GB | 40-pin | High performance, 4K |
| Pi 5 | 2.4GHz quad-core | 4/8GB | 40-pin | Latest, most powerful |
| Pi Pico | RP2040 (see rp2040.md) | 264KB | 26 GPIO | Microcontroller, not Linux |

## Setup

### Operating System

**Raspberry Pi OS (Recommended):**
```bash
# Download from raspberrypi.com/software/
# Flash to SD card with Raspberry Pi Imager
# Boot and configure
```

**Headless Setup:**
```bash
# Create SSH file on boot partition
touch /Volumes/boot/ssh

# Create WiFi configuration
cat > /Volumes/boot/wpa_supplicant.conf << EOF
country=US
ctrl_interface=DIR=/var/run/wpa_supplicant GROUP=netdev
update_config=1

network={
    ssid="YourNetworkName"
    psk="YourPassword"
    key_mgmt=WPA-PSK
}
EOF
```

### Initial Configuration

```bash
# Update system
sudo apt update
sudo apt upgrade -y

# Install essentials
sudo apt install -y git python3-pip python3-dev build-essential

# Enable interfaces (I2C, SPI, Serial)
sudo raspi-config
# Interface Options → Enable I2C, SPI, Serial

# Reboot
sudo reboot
```

## GPIO

### 40-Pin Header Pinout

```
     3.3V  [ 1] [ 2]  5V
 GPIO2/SDA  [ 3] [ 4]  5V
 GPIO3/SCL  [ 5] [ 6]  GND
    GPIO4  [ 7] [ 8]  GPIO14/TXD
      GND  [ 9] [10]  GPIO15/RXD
   GPIO17  [11] [12]  GPIO18/PWM
   GPIO27  [13] [14]  GND
   GPIO22  [15] [16]  GPIO23
     3.3V  [17] [18]  GPIO24
GPIO10/MOSI [19] [20]  GND
 GPIO9/MISO [21] [22]  GPIO25
GPIO11/SCLK [23] [24]  GPIO8/CE0
      GND  [25] [26]  GPIO7/CE1
  ID_SD    [27] [28]  ID_SC
   GPIO5   [29] [30]  GND
   GPIO6   [31] [32]  GPIO12/PWM
  GPIO13   [33] [34]  GND
  GPIO19   [35] [36]  GPIO16
  GPIO26   [37] [38]  GPIO20
     GND   [39] [40]  GPIO21
```

**Special Pins:**
- GPIO2, GPIO3: I2C (SDA, SCL)
- GPIO9, GPIO10, GPIO11: SPI (MISO, MOSI, SCLK)
- GPIO14, GPIO15: UART (TXD, RXD)
- GPIO12, GPIO13, GPIO18, GPIO19: PWM-capable

**Voltage: 3.3V** (NOT 5V tolerant!)

## Python GPIO Programming

### Option 1: RPi.GPIO (Traditional)

```bash
# Install
sudo apt install python3-rpi.gpio
```

```python
#!/usr/bin/env python3
import RPi.GPIO as GPIO
import time

# Pin numbering modes
GPIO.setmode(GPIO.BCM)    # Use GPIO numbers (GPIO17, GPIO18, etc.)
# GPIO.setmode(GPIO.BOARD)  # Use physical pin numbers (1-40)

# Setup pins
LED_PIN = 18
BUTTON_PIN = 17

GPIO.setup(LED_PIN, GPIO.OUT)
GPIO.setup(BUTTON_PIN, GPIO.IN, pull_up_down=GPIO.PUD_UP)

# Digital output
GPIO.output(LED_PIN, GPIO.HIGH)
time.sleep(1)
GPIO.output(LED_PIN, GPIO.LOW)

# Digital input
button_state = GPIO.input(BUTTON_PIN)

# PWM
pwm = GPIO.PWM(LED_PIN, 1000)  # 1000Hz frequency
pwm.start(50)  # 50% duty cycle
pwm.ChangeDutyCycle(75)  # Change to 75%
pwm.stop()

# Interrupts
def button_callback(channel):
    print(f"Button pressed on GPIO {channel}")

GPIO.add_event_detect(BUTTON_PIN, GPIO.FALLING, 
                      callback=button_callback, bouncetime=200)

# Cleanup (always!)
try:
    while True:
        time.sleep(1)
except KeyboardInterrupt:
    GPIO.cleanup()
```

### Option 2: gpiozero (Modern, Recommended)

```bash
# Install
sudo apt install python3-gpiozero
```

```python
#!/usr/bin/env python3
from gpiozero import LED, Button, MotionSensor, Servo, PWMLED
from signal import pause
import time

# Simple LED control
led = LED(18)
led.on()
led.off()
led.toggle()
led.blink(on_time=1, off_time=1)  # Blink

# Button with events
button = Button(17)

def button_pressed():
    print("Button pressed!")

button.when_pressed = button_pressed
button.when_released = lambda: print("Released")

# PWM LED (smooth brightness)
pwm_led = PWMLED(18)
pwm_led.value = 0.5  # 50% brightness
pwm_led.pulse()  # Breathing effect

# Motion sensor
pir = MotionSensor(4)
pir.when_motion = lambda: print("Motion detected!")
pir.when_no_motion = lambda: print("No motion")

# Servo control
servo = Servo(18)
servo.min()    # -1
servo.mid()    #  0
servo.max()    #  1
servo.value = 0.5

# Keep program running
pause()
```

### Option 3: pigpio (Precise timing)

```bash
# Install daemon
sudo apt install pigpio python3-pigpio

# Start daemon
sudo pigpiod
```

```python
import pigpio
import time

pi = pigpio.pi()

# GPIO
pi.set_mode(18, pigpio.OUTPUT)
pi.write(18, 1)  # HIGH
pi.write(18, 0)  # LOW

# PWM (hardware PWM on GPIO 12, 13, 18, 19)
pi.hardware_PWM(18, 1000, 500000)  # 1kHz, 50% duty

# Servo (500-2500 microseconds)
pi.set_servo_pulsewidth(18, 1500)  # Center

# Callbacks
def callback(gpio, level, tick):
    print(f"GPIO {gpio} changed to {level} at {tick}")

cb = pi.callback(17, pigpio.EITHER_EDGE, callback)

# Cleanup
time.sleep(10)
cb.cancel()
pi.stop()
```

## I2C

```bash
# Enable I2C
sudo raspi-config
# Interface Options → I2C → Enable

# Install tools
sudo apt install i2c-tools python3-smbus

# Scan for devices
i2cdetect -y 1  # Use bus 1 (bus 0 on very old Pi)
```

```python
import smbus
import time

bus = smbus.SMBus(1)  # I2C bus 1
address = 0x27  # Device address

# Write byte
bus.write_byte_data(address, 0x00, 0xFF)

# Read byte
data = bus.read_byte_data(address, 0x00)

# Write block
data = [0x01, 0x02, 0x03]
bus.write_i2c_block_data(address, 0x00, data)

# Read block
data = bus.read_i2c_block_data(address, 0x00, 4)
```

## SPI

```bash
# Enable SPI
sudo raspi-config
# Interface Options → SPI → Enable

# Install
sudo apt install python3-spidev
```

```python
import spidev
import time

spi = spidev.SpiDev()
spi.open(0, 0)  # Bus 0, Device 0 (CE0)

# Configuration
spi.max_speed_hz = 1000000  # 1MHz
spi.mode = 0  # SPI mode 0

# Transfer data
to_send = [0x01, 0x02, 0x03]
received = spi.xfer2(to_send)

# Read data
received = spi.readbytes(4)

# Close
spi.close()
```

## UART/Serial

```bash
# Enable serial port (disable console)
sudo raspi-config
# Interface Options → Serial → 
#   Login shell over serial: No
#   Serial port hardware: Yes
```

```python
import serial
import time

# Open serial port
ser = serial.Serial(
    port='/dev/ttyAMA0',  # or /dev/serial0
    baudrate=9600,
    parity=serial.PARITY_NONE,
    stopbits=serial.STOPBITS_ONE,
    bytesize=serial.EIGHTBITS,
    timeout=1
)

# Write
ser.write(b'Hello\r\n')

# Read
line = ser.readline().decode('utf-8').strip()

# Read with timeout
if ser.in_waiting > 0:
    data = ser.read(ser.in_waiting)

ser.close()
```

## Web Applications

### Flask (Simple Web Server)

```bash
pip install flask --break-system-packages
```

```python
from flask import Flask, render_template, request, jsonify
from gpiozero import LED, Button
import threading

app = Flask(__name__)

led = LED(18)
button = Button(17)

@app.route('/')
def index():
    return '''
    <html>
        <body>
            <h1>Raspberry Pi Control</h1>
            <button onclick="toggleLED()">Toggle LED</button>
            <p>Button State: <span id="button">--</span></p>
            
            <script>
                function toggleLED() {
                    fetch('/led/toggle').then(r => r.json()).then(console.log);
                }
                
                setInterval(() => {
                    fetch('/button').then(r => r.json())
                        .then(data => {
                            document.getElementById('button').textContent = 
                                data.pressed ? 'PRESSED' : 'Released';
                        });
                }, 100);
            </script>
        </body>
    </html>
    '''

@app.route('/led/toggle')
def led_toggle():
    led.toggle()
    return jsonify({'state': 'on' if led.is_lit else 'off'})

@app.route('/button')
def button_state():
    return jsonify({'pressed': button.is_pressed})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
```

### FastAPI (Modern, Async)

```bash
pip install fastapi uvicorn --break-system-packages
```

```python
from fastapi import FastAPI
from fastapi.responses import HTMLResponse
from gpiozero import LED
import uvicorn

app = FastAPI()
led = LED(18)

@app.get("/", response_class=HTMLResponse)
async def root():
    return "<h1>Raspberry Pi API</h1>"

@app.post("/led/{state}")
async def control_led(state: str):
    if state == "on":
        led.on()
    elif state == "off":
        led.off()
    return {"led": "on" if led.is_lit else "off"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
```

## System Integration

### Systemd Service

```bash
# Create service file
sudo nano /etc/systemd/system/myproject.service
```

```ini
[Unit]
Description=My Raspberry Pi Project
After=network.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/project
ExecStart=/usr/bin/python3 /home/pi/project/main.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

```bash
# Enable and start
sudo systemctl enable myproject
sudo systemctl start myproject

# Check status
sudo systemctl status myproject

# View logs
sudo journalctl -u myproject -f
```

### Cron Jobs

```bash
# Edit crontab
crontab -e

# Run script every minute
* * * * * /usr/bin/python3 /home/pi/script.py >> /home/pi/cron.log 2>&1

# Run at boot
@reboot /usr/bin/python3 /home/pi/startup.py

# Run every day at 2 AM
0 2 * * * /home/pi/daily_task.sh
```

## Camera

### picamera2 (Pi Camera Module)

```bash
# Install
sudo apt install python3-picamera2
```

```python
from picamera2 import Picamera2
import time

picam2 = Picamera2()

# Configure
config = picam2.create_still_configuration()
picam2.configure(config)

# Start and capture
picam2.start()
time.sleep(2)  # Let camera adjust
picam2.capture_file("image.jpg")
picam2.stop()

# Video capture
picam2.start_recording("video.h264")
time.sleep(10)
picam2.stop_recording()
```

### USB Camera (OpenCV)

```bash
pip install opencv-python --break-system-packages
```

```python
import cv2

cap = cv2.VideoCapture(0)  # Device 0

while True:
    ret, frame = cap.read()
    if ret:
        cv2.imshow('Camera', frame)
        
    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

cap.release()
cv2.destroyAllWindows()
```

## Advanced Features

### Multi-threading

```python
import threading
import time
from gpiozero import LED

def blink_led(pin, interval):
    led = LED(pin)
    while True:
        led.toggle()
        time.sleep(interval)

# Create threads
thread1 = threading.Thread(target=blink_led, args=(17, 1))
thread2 = threading.Thread(target=blink_led, args=(18, 0.5))

# Start threads
thread1.daemon = True
thread2.daemon = True
thread1.start()
thread2.start()

# Main thread continues
try:
    while True:
        time.sleep(1)
except KeyboardInterrupt:
    print("Exiting")
```

### MQTT (IoT Communication)

```bash
pip install paho-mqtt --break-system-packages
```

```python
import paho.mqtt.client as mqtt
from gpiozero import LED, Button

led = LED(18)
button = Button(17)

def on_connect(client, userdata, flags, rc):
    print(f"Connected with code {rc}")
    client.subscribe("pi/led")

def on_message(client, userdata, msg):
    if msg.topic == "pi/led":
        if msg.payload == b"on":
            led.on()
        elif msg.payload == b"off":
            led.off()

client = mqtt.Client()
client.on_connect = on_connect
client.on_message = on_message

client.connect("broker.hivemq.com", 1883, 60)

def publish_button():
    client.publish("pi/button", "pressed")

button.when_pressed = publish_button

client.loop_forever()
```

## Performance Tips

### CPU Temperature Monitoring

```python
def get_cpu_temp():
    with open('/sys/class/thermal/thermal_zone0/temp', 'r') as f:
        temp = float(f.read()) / 1000.0
    return temp

print(f"CPU: {get_cpu_temp():.1f}°C")
```

### Overclocking (Pi 4)

```bash
# Edit config
sudo nano /boot/config.txt

# Add (test stability!)
over_voltage=6
arm_freq=2000

# Reboot
sudo reboot
```

## Troubleshooting

### GPIO Issues

**Permission denied:**
```bash
# Add user to gpio group
sudo usermod -a -G gpio $USER
# Log out and back in
```

**Pin already in use:**
```python
# Always cleanup
GPIO.cleanup()
# Or cleanup specific pin
GPIO.cleanup(18)
```

### I2C Not Working

```bash
# Check if enabled
ls /dev/i2c*

# Should see /dev/i2c-1

# Check pull-ups (add 4.7kΩ if needed)
# Try slower speed in /boot/config.txt
dtparam=i2c_arm=on,i2c_arm_baudrate=10000
```

### Serial Issues

```bash
# Check which serial port
ls -l /dev/serial*

# Disable Bluetooth to free up serial0 (Pi 3/4)
sudo nano /boot/config.txt
# Add: dtoverlay=disable-bt
sudo systemctl disable hciuart
```

## Resources

- [gpiozero Documentation](https://gpiozero.readthedocs.io/)
- [RPi.GPIO](https://sourceforge.net/projects/raspberry-gpio-python/)
- [Raspberry Pi Forums](https://forums.raspberrypi.com/)
- [pinout.xyz](https://pinout.xyz/) - Interactive pinout
