# Hardware Development Reference Guide

*A reusable guide for hardware projects, created during the Personal Recording Multitool project*

## 1. Vendor Comparison for Oklahoma Shipping

### Tier 1: Educational/Maker Focused
| Vendor | Shipping to OK | Strengths | Weaknesses | Best For |
|--------|---------------|-----------|------------|----------|
| **Adafruit** | 3-5 days, ~$10 | Amazing tutorials, quality products, beginner-friendly | Higher prices, limited selection | Prototyping, learning, unique sensors |
| **SparkFun** | 2-4 days, ~$8 | Good docs, open hardware, US-based | Premium pricing, less variety than others | Quality modules, educational kits |
| **Seeed Studio** | 7-14 days, ~$15 | Unique modules, Grove ecosystem | Slower shipping from China | Modular prototyping, advanced sensors |

### Tier 2: Component Distributors
| Vendor | Shipping to OK | Strengths | Weaknesses | Best For |
|--------|---------------|-----------|------------|----------|
| **Digi-Key** | Next-day available, ~$8 | Massive selection, detailed specs, fast ship | Overwhelming for beginners | Any component imaginable |
| **Mouser** | 1-2 days from Texas, ~$8 | Great selection, good prices, nearby warehouse | Complex website | Bulk orders, specific parts |
| **Newark** | 2-3 days, ~$10 | Industrial focus, good support | Higher minimums | Commercial prototypes |

### Tier 3: Budget Options
| Vendor | Shipping to OK | Strengths | Weaknesses | Best For |
|--------|---------------|-----------|------------|----------|
| **Amazon** | 1-2 days Prime | Fast, easy returns | Quality varies, clones common | Common parts, urgent needs |
| **eBay** | Varies, $3-30 | Cheapest prices, rare finds | Long ship times, quality lottery | Non-critical parts, bulk basics |
| **AliExpress** | 15-45 days, ~$5 | Rock-bottom prices | Very slow, quality concerns | Bulk prototyping supplies |

### Local Oklahoma Options
- **RadioShack** (if still open): Basic components, immediate availability
- **University Bookstores** (OU/OSU): Sometimes carry maker supplies
- **Habitat for Humanity ReStore**: Salvage electronics for parts
- **Ham Radio Outlets**: Specialized RF/electronic components

## 2. Component Selection Best Practices

### Microcontroller Selection Matrix
| Need | Best Option | Why | Alternatives |
|------|------------|-----|--------------|
| **Audio Processing** | Raspberry Pi Zero 2 W | Linux audio stack, I2S support | ESP32 (limited), Teensy 4.1 |
| **Low Power Wearable** | nRF52840 | BLE + low power | ESP32-S3, RP2040 |
| **Quick Prototype** | Arduino Uno/Nano | Massive community | Any Arduino-compatible |
| **AI at Edge** | Raspberry Pi 4/5 | CPU power for inference | Jetson Nano, Coral Dev |
| **Smallest Size** | ATtiny85 | 8-pin package | PIC10F, ESP32-C3 |

### Common Component Guidelines

#### Microphones for Wearables
1. **MEMS Digital** (Recommended)
   - SPH0645LM4H: I2S output, good quality, ~$8
   - ICS-43434: Higher quality, more expensive, ~$12
   - MP34DT01: STM standard, cheap, ~$4

2. **Analog Options** (Simpler but noisier)
   - MAX4466: Adjustable gain, ~$7
   - MAX9814: Auto-gain, ~$8

#### Power Components
1. **Batteries**
   - **LiPo**: Best energy density (500mAh = ~5hrs @100mA)
   - **LiFePO4**: Safer, longer life, lower voltage
   - **Coin Cell**: Compact but limited capacity

2. **Charging Circuits**
   - **TP4056**: Basic, cheap, works (~$1)
   - **MCP73831**: Better, programmable current (~$3)
   - **BQ24075**: Advanced, power path management (~$5)

3. **Voltage Regulation**
   - **Linear (LDO)**: Simple, low noise, wastes power as heat
   - **Switching (Buck/Boost)**: Efficient, can be noisy
   - **Combo Modules**: PowerBoost 1000C, etc.

#### Communication Modules
1. **WiFi Options**
   - ESP8266: Cheap, power hungry (~$3)
   - ESP32: WiFi + BLE, better (~$5)
   - ATWINC1500: Dedicated WiFi, reliable (~$20)

2. **Bluetooth**
   - HC-05/06: Classic BT, easy (~$5)
   - HM-10: BLE, AT commands (~$4)
   - nRF modules: Best for custom BLE (~$15)

## 3. SunFounder Kit Integration

### Typical SunFounder Kit Contents Useful for Hardware Projects
- **Breadboard**: 830-point for prototyping
- **Jumper Wires**: M-M, M-F, F-F varieties
- **Basic Components**: Resistors, LEDs, buttons, potentiometers
- **Sensors**: Often includes temperature, light, motion
- **Displays**: LCD, 7-segment, or LED matrix
- **Power**: Battery holders, voltage regulators

### How to Leverage for New Projects
1. **Start Simple**: Use breadboard + jumpers before custom PCB
2. **Reuse Sensors**: Temperature sensor → battery monitor
3. **Power Supply**: Kit's regulator → prototype power
4. **Display Options**: LCD for debugging, LED for status
5. **Input Methods**: Buttons/pots for configuration

### Common Adaptations
```
SunFounder Component → Hardware Project Use
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Servo Motor → Haptic feedback (eccentric weight)
Ultrasonic Sensor → Proximity detection for auto-wake
Photoresistor → Ambient light for display dimming
Buzzer → Audio feedback/alarms
SD Card Module → Local data logging
RTC Module → Timestamp recordings
```

## 4. Hardware Prototyping Process

### Phase 1: Concept Validation (Week 1-2)
- [ ] Define core functionality
- [ ] Research similar projects
- [ ] Estimate power budget
- [ ] Sketch physical design
- [ ] Order long-lead items

### Phase 2: Breadboard Prototype (Week 3-4)
- [ ] Test each subsystem independently
- [ ] Integrate power management
- [ ] Verify communication protocols
- [ ] Measure actual power consumption
- [ ] Document wiring with photos

### Phase 3: Perfboard/PCB v1 (Week 5-6)
- [ ] Transfer to permanent connections
- [ ] Add proper connectors
- [ ] Include test points
- [ ] Implement error handling
- [ ] Start enclosure design

### Phase 4: Integration Testing (Week 7-8)
- [ ] Environmental testing (temp, humidity)
- [ ] Battery life validation
- [ ] EMI/noise testing
- [ ] Drop/durability testing
- [ ] User experience testing

## 5. Common Hardware Pitfalls & Solutions

### Power Problems
| Issue | Symptoms | Solution |
|-------|----------|----------|
| **Brownouts** | Random resets, corrupted data | Add bulk capacitors, better regulator |
| **Noise** | Erratic behavior, bad ADC readings | Separate analog/digital grounds, add ferrites |
| **Short battery** | Dies too quickly | Profile consumption, add sleep modes |
| **Won't wake** | Deep sleep permanent | Add hardware watchdog, test wake sources |

### Communication Failures
| Issue | Symptoms | Solution |
|-------|----------|----------|
| **I2C stuck** | Bus hangs, no response | Add pull-ups (4.7k typical), check addresses |
| **SPI corruption** | Bad data, wrong values | Verify clock speed, check MISO/MOSI swap |
| **UART garbage** | Random characters | Match baud rates, check level shifting |
| **WiFi drops** | Intermittent connection | Better antenna, check power supply |

### Mechanical/Environmental
| Issue | Symptoms | Solution |
|-------|----------|----------|
| **Loose connections** | Intermittent failures | Strain relief, better connectors |
| **Temperature drift** | Values change with temp | Use temperature compensation |
| **Water ingress** | Corrosion, shorts | Conformal coating, proper seals |
| **Static damage** | Dead components | ESD protection, proper handling |

## 6. Rapid Prototyping Tools

### Essential Software
1. **Circuit Design**
   - KiCad (free, powerful)
   - EasyEDA (online, simple)
   - Fritzing (beginner-friendly)

2. **PCB Fabrication**
   - OSH Park (purple PCBs, US-made)
   - JLCPCB (cheap, fast from China)
   - PCBWay (good quality, assembly service)

3. **3D Modeling (Enclosures)**
   - Fusion 360 (free for personal use)
   - FreeCAD (open source)
   - TinkerCAD (web-based, simple)

4. **Firmware Development**
   - PlatformIO (multi-platform IDE)
   - Arduino IDE (beginner-friendly)
   - VS Code + extensions

### Hardware Debug Tools
- **Multimeter**: Absolute essential ($20-50)
- **Logic Analyzer**: For protocol debugging ($10-50)
- **Oscilloscope**: For analog/timing issues ($300+)
- **USB Power Meter**: Monitor consumption ($15)
- **Hot Air Station**: For SMD work ($50+)

## 7. Project-Specific Learnings

### Audio Recording Hardware Insights
1. **Microphone Placement**: Keep away from power regulators (noise)
2. **Sample Rates**: 16kHz sufficient for speech, saves power/storage
3. **Buffering**: Circular buffer prevents data loss during writes
4. **Codec Selection**: Hardware MP3 encoding saves CPU cycles

### Wearable-Specific Considerations
1. **Antenna Design**: Body affects RF performance significantly
2. **Haptic Feedback**: PWM frequency affects feel (100-300Hz typical)
3. **Charging**: Magnetic connectors prevent wear
4. **Biocompatibility**: Some users sensitive to nickel, certain plastics

### Power Optimization Techniques
1. **Sleep Modes**: Can achieve <10μA in deep sleep
2. **Peripheral Control**: Turn off unused subsystems
3. **Burst Operations**: Batch operations then sleep
4. **Dynamic Frequency**: Reduce clock when possible

## 8. Testing & Validation Checklist

### Electrical Testing
- [ ] Voltage levels at all test points
- [ ] Current consumption in all modes
- [ ] Signal integrity (especially I2S/SPI)
- [ ] ESD immunity testing
- [ ] Thermal imaging under load

### Functional Testing  
- [ ] All user stories verified
- [ ] Edge cases handled
- [ ] Error recovery validated
- [ ] Performance benchmarks met
- [ ] Battery life confirmed

### Environmental Testing
- [ ] Temperature range (-10°C to 50°C typical)
- [ ] Humidity exposure
- [ ] Drop testing (1m typical)
- [ ] Vibration resistance
- [ ] Water resistance (if applicable)

### Compliance Considerations
- [ ] FCC Part 15 (unintentional radiator)
- [ ] CE marking requirements
- [ ] RoHS compliance
- [ ] Battery shipping regulations
- [ ] Recording device laws

## 9. Sourcing Strategy Template

### For New Hardware Projects:
1. **Prototype Phase**: Order from Adafruit/SparkFun for documentation
2. **Optimization Phase**: Source from Digi-Key for exact specs
3. **Cost Reduction**: Find alternatives on Mouser/Newark
4. **Production**: Direct from manufacturer or AliExpress for bulk

### Order Planning Worksheet
```
Component Budget Calculator
━━━━━━━━━━━━━━━━━━━━━━━━
Prototype Qty: ___ units
Buffer: 50% extra for mistakes
━━━━━━━━━━━━━━━━━━━━━━━━
MCU: $____ × ___ = $____
Sensors: $____ × ___ = $____
Power: $____ × ___ = $____
Passive: ~$10 per prototype
PCB: $____ × ___ = $____
Enclosure: $____ × ___ = $____
━━━━━━━━━━━━━━━━━━━━━━━━
Subtotal: $____
Shipping (15%): $____
Tax (8.5% OK): $____
━━━━━━━━━━━━━━━━━━━━━━━━
Total: $____
```

## 10. Community Resources

### Online Communities
- **Reddit**: r/AskElectronics, r/PrintedCircuitBoard
- **Discord**: Adafruit, SparkFun servers
- **Forums**: EEVblog, All About Circuits
- **Stack Exchange**: Electronics, Arduino

### YouTube Channels
- **GreatScott!**: Excellent explanations
- **EEVblog**: Deep technical content
- **Andreas Spiess**: IoT and low power
- **Adafruit**: Project tutorials

### Local Resources
- **Makerspaces**: Check for local hackerspaces
- **Ham Radio Clubs**: Often have electronics help
- **Community Colleges**: Electronics courses
- **Libraries**: Some have maker programs

## Quick Reference Card

### Essential Formulas
```
Ohm's Law: V = I × R
Power: P = V × I = I²R = V²/R
Battery Life (hours) = Capacity (mAh) / Current (mA)
Voltage Divider: Vout = Vin × (R2 / (R1 + R2))
RC Time Constant: τ = R × C
LED Resistor: R = (Vsupply - Vled) / Iled
Pull-up Value: 4.7kΩ - 10kΩ typical
```

### Common Voltages
- 5V: USB, older MCUs
- 3.3V: Modern MCUs, sensors  
- 1.8V: Some low-power chips
- ±12V: Op-amps, audio

### Quick Debug Steps
1. Check power (voltage correct?)
2. Verify ground connections
3. Test continuity
4. Look for shorts
5. Confirm oscillator running
6. Check reset pin state
7. Verify communication settings
8. Add debug output

---

*This guide is a living document. Update it with lessons learned from each hardware project to build institutional knowledge.*
