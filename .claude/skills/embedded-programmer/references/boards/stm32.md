# STM32 Platform Guide

Complete guide for STM32 microcontroller family development.

## Overview

STM32 is a family of ARM Cortex-M based microcontrollers from STMicroelectronics, known for high performance, rich peripherals, and robust ecosystem.

## STM32 Families

| Family | Core | Max Speed | Use Case |
|--------|------|-----------|----------|
| STM32F0 | Cortex-M0 | 48MHz | Entry-level, low-cost |
| STM32F1 | Cortex-M3 | 72MHz | General purpose (Blue Pill) |
| STM32F4 | Cortex-M4 | 180MHz | DSP, FPU, high performance |
| STM32F7 | Cortex-M7 | 216MHz | Advanced, graphics |
| STM32H7 | Cortex-M7 | 480MHz | Ultra high performance |
| STM32L4 | Cortex-M4 | 80MHz | Ultra-low power |
| STM32G4 | Cortex-M4 | 170MHz | Mixed signal, motor control |
| STM32WB | Cortex-M4 | 64MHz | Bluetooth LE 5.0 |

## Toolchain Setup

### Option 1: PlatformIO (Recommended)

```bash
# Install PlatformIO
pip install platformio --break-system-packages

# Create new STM32 project
pio init --board bluepill_f103c8

# Available boards:
# - bluepill_f103c8 (STM32F103C8T6)
# - blackpill_f103c8 (STM32F103C8T6)
# - nucleo_f103rb (STM32 Nucleo)
# - blackpill_f401cc (STM32F401)
# - nucleo_f446re (STM32F446)
# - genericSTM32F407VGT6
```

**platformio.ini example:**
```ini
[env:bluepill_f103c8]
platform = ststm32
board = bluepill_f103c8
framework = arduino

# Or use STM32Cube HAL
[env:bluepill_f103c8_hal]
platform = ststm32
board = bluepill_f103c8
framework = stm32cube
```

### Option 2: STM32CubeIDE

1. Download from st.com/stm32cubeide
2. Eclipse-based IDE with code generator
3. Graphical peripheral configuration
4. Built-in debugger support

### Option 3: Arduino + STM32duino

```bash
# Add STM32 board support to Arduino
arduino-cli config add board_manager.additional_urls \
  https://github.com/stm32duino/BoardManagerFiles/raw/main/package_stmicroelectronics_index.json

# Install STM32 core
arduino-cli core update-index
arduino-cli core install STMicroelectronics:stm32

# Compile and upload
arduino-cli compile --fqbn STMicroelectronics:stm32:GenF1:pnum=BLUEPILL_F103C8 ./project
arduino-cli upload -p /dev/ttyUSB0 --fqbn STMicroelectronics:stm32:GenF1:pnum=BLUEPILL_F103C8 ./project
```

## Upload Methods

### ST-Link V2 (Recommended)

```bash
# Install st-link tools
sudo apt-get install stlink-tools

# Probe for device
st-info --probe

# Flash binary
st-flash write firmware.bin 0x8000000

# Erase chip
st-flash erase
```

### USB DFU Mode (Bootloader)

```bash
# Install dfu-util
sudo apt-get install dfu-util

# Put device in DFU mode (BOOT0=1, reset)
# Check detection
dfu-util -l

# Upload firmware
dfu-util -a 0 -s 0x08000000:leave -D firmware.bin
```

### Serial Bootloader (UART)

```bash
# Install stm32flash
sudo apt-get install stm32flash

# Upload via UART (BOOT0=1, reset)
stm32flash -w firmware.bin -v -g 0x0 /dev/ttyUSB0
```

## Common Boards

### Blue Pill (STM32F103C8T6)

**Specifications:**
- CPU: ARM Cortex-M3 @ 72MHz
- Flash: 64KB (often 128KB)
- RAM: 20KB
- GPIO: 37 pins
- ADC: 2x 12-bit (16 channels)
- Timers: 7 (advanced PWM)
- UART: 3
- SPI: 2
- I2C: 2
- USB: 1 (Full-speed)
- Voltage: 3.3V

**Pinout:**
```
      VBAT   GND
       PC13  3.3V
       PC14  NRST
       PC15  PB11
       PA0   PB10
       PA1   PB1
       PA2   PB0
       PA3   PA7
       PA4   PA6
       PA5   PA5  (SPI1_SCK)
       PB9   PA4  (SPI1_NSS)
  SDA  PB8   PA3  (USART2_RX)
  SCL  PB7   PA2  (USART2_TX)
       PB6   PA1
       PB5   PA0
       PB4   PC15
       PB3   PC14
       PA15  PC13 (LED)
       PA12  VBAT
       PA11  3.3V (USB D+)
       PA10  GND
       PA9   5V (USB D-)
       PA8   GND
       PB15  3.3V
       PB14  GND
       PB13  GND (SPI2_SCK)
       PB12  GND (SPI2_NSS)
```

**Boot Modes:**
- BOOT0=0, BOOT1=X: Flash (normal)
- BOOT0=1, BOOT1=0: System memory (bootloader)
- BOOT0=1, BOOT1=1: SRAM

### Black Pill (STM32F401CC / F411CE)

**Specifications (F411CE):**
- CPU: ARM Cortex-M4 @ 100MHz
- FPU: Yes
- Flash: 512KB
- RAM: 128KB
- GPIO: 32 pins
- ADC: 1x 12-bit (16 channels)
- USB: OTG Full-speed
- Faster and more memory than Blue Pill

## HAL Programming

### Basic HAL Project Structure

```c
#include "main.h"

// Peripheral handles
I2C_HandleTypeDef hi2c1;
UART_HandleTypeDef huart2;
TIM_HandleTypeDef htim1;

// Function prototypes
void SystemClock_Config(void);
static void MX_GPIO_Init(void);
static void MX_I2C1_Init(void);
static void MX_USART2_UART_Init(void);

int main(void) {
  // Initialize HAL
  HAL_Init();
  
  // Configure system clock
  SystemClock_Config();
  
  // Initialize peripherals
  MX_GPIO_Init();
  MX_I2C1_Init();
  MX_USART2_UART_Init();
  
  // Main loop
  while (1) {
    HAL_GPIO_TogglePin(GPIOC, GPIO_PIN_13);
    HAL_Delay(1000);
  }
}

void SystemClock_Config(void) {
  RCC_OscInitTypeDef RCC_OscInitStruct = {0};
  RCC_ClkInitTypeDef RCC_ClkInitStruct = {0};

  // Configure main PLL
  RCC_OscInitStruct.OscillatorType = RCC_OSCILLATORTYPE_HSE;
  RCC_OscInitStruct.HSEState = RCC_HSE_ON;
  RCC_OscInitStruct.PLL.PLLState = RCC_PLL_ON;
  RCC_OscInitStruct.PLL.PLLSource = RCC_PLLSOURCE_HSE;
  RCC_OscInitStruct.PLL.PLLMUL = RCC_PLL_MUL9;  // 8MHz * 9 = 72MHz
  HAL_RCC_OscConfig(&RCC_OscInitStruct);

  // Configure system clock
  RCC_ClkInitStruct.ClockType = RCC_CLOCKTYPE_HCLK|RCC_CLOCKTYPE_SYSCLK
                              |RCC_CLOCKTYPE_PCLK1|RCC_CLOCKTYPE_PCLK2;
  RCC_ClkInitStruct.SYSCLKSource = RCC_SYSCLKSOURCE_PLLCLK;
  RCC_ClkInitStruct.AHBCLKDivider = RCC_SYSCLK_DIV1;
  RCC_ClkInitStruct.APB1CLKDivider = RCC_HCLK_DIV2;
  RCC_ClkInitStruct.APB2CLKDivider = RCC_HCLK_DIV1;
  HAL_RCC_ClockConfig(&RCC_ClkInitStruct, FLASH_LATENCY_2);
}

static void MX_GPIO_Init(void) {
  GPIO_InitTypeDef GPIO_InitStruct = {0};

  // Enable GPIO clock
  __HAL_RCC_GPIOC_CLK_ENABLE();

  // Configure PC13 (LED) as output
  GPIO_InitStruct.Pin = GPIO_PIN_13;
  GPIO_InitStruct.Mode = GPIO_MODE_OUTPUT_PP;
  GPIO_InitStruct.Pull = GPIO_NOPULL;
  GPIO_InitStruct.Speed = GPIO_SPEED_FREQ_LOW;
  HAL_GPIO_Init(GPIOC, &GPIO_InitStruct);
}
```

## Arduino Framework

### Basic Blink Example

```cpp
#define LED_PIN PC13  // Blue Pill LED

void setup() {
  pinMode(LED_PIN, OUTPUT);
  Serial.begin(115200);
  Serial.println("STM32 Ready!");
}

void loop() {
  digitalWrite(LED_PIN, HIGH);
  delay(1000);
  digitalWrite(LED_PIN, LOW);
  delay(1000);
}
```

### Pin Naming Convention

```cpp
// Port and pin number
PA0, PA1, PA2  // Port A pins
PB0, PB1, PB2  // Port B pins
PC13, PC14, PC15  // Port C pins

// Alternative: Use numbers (board-specific)
pinMode(13, OUTPUT);  // May vary by board
```

## Common Peripherals

### UART

**HAL:**
```c
uint8_t tx_data[] = "Hello STM32\r\n";
HAL_UART_Transmit(&huart2, tx_data, sizeof(tx_data)-1, 100);

uint8_t rx_data[10];
HAL_UART_Receive(&huart2, rx_data, 10, 1000);
```

**Arduino:**
```cpp
Serial.begin(115200);  // USART1
Serial2.begin(9600);   // USART2

Serial.println("Hello");
Serial2.write(data, length);
```

### I2C

**HAL:**
```c
#define I2C_ADDR 0x27 << 1  // 7-bit addr shifted

uint8_t data[2] = {0x00, 0xFF};
HAL_I2C_Master_Transmit(&hi2c1, I2C_ADDR, data, 2, 100);

uint8_t rx_data[2];
HAL_I2C_Master_Receive(&hi2c1, I2C_ADDR, rx_data, 2, 100);
```

**Arduino:**
```cpp
#include <Wire.h>

void setup() {
  Wire.begin();  // Master mode
  // Wire.begin(8);  // Slave mode, address 8
}

void loop() {
  Wire.beginTransmission(0x27);
  Wire.write(0x00);
  Wire.endTransmission();
  
  Wire.requestFrom(0x27, 2);
  while (Wire.available()) {
    char c = Wire.read();
  }
}
```

### SPI

**HAL:**
```c
uint8_t tx_data = 0xAB;
uint8_t rx_data;
HAL_SPI_TransmitReceive(&hspi1, &tx_data, &rx_data, 1, 100);
```

**Arduino:**
```cpp
#include <SPI.h>

void setup() {
  SPI.begin();
  SPI.setClockDivider(SPI_CLOCK_DIV4);
  pinMode(SS, OUTPUT);
}

void loop() {
  digitalWrite(SS, LOW);
  byte received = SPI.transfer(0xAB);
  digitalWrite(SS, HIGH);
}
```

### ADC

**HAL:**
```c
HAL_ADC_Start(&hadc1);
HAL_ADC_PollForConversion(&hadc1, 100);
uint32_t value = HAL_ADC_GetValue(&hadc1);
// value is 0-4095 for 12-bit ADC
```

**Arduino:**
```cpp
int value = analogRead(PA0);  // Returns 0-4095
float voltage = value * (3.3 / 4095.0);
```

### PWM

**HAL:**
```c
// Start PWM on Timer 1 Channel 1
HAL_TIM_PWM_Start(&htim1, TIM_CHANNEL_1);

// Set duty cycle (0-65535 for 16-bit timer)
__HAL_TIM_SET_COMPARE(&htim1, TIM_CHANNEL_1, 32768);  // 50%
```

**Arduino:**
```cpp
// PWM pins: PA8, PA9, PA10, PB6, PB7, PB8, PB9
analogWrite(PA8, 128);  // 50% duty (0-255)
```

## Advanced Features

### DMA (Direct Memory Access)

```c
uint8_t buffer[100];

// UART DMA transmit
HAL_UART_Transmit_DMA(&huart2, buffer, sizeof(buffer));

// ADC DMA (continuous)
HAL_ADC_Start_DMA(&hadc1, (uint32_t*)buffer, 100);
```

### Interrupts

**HAL:**
```c
// Enable interrupt in MX_GPIO_Init
GPIO_InitStruct.Mode = GPIO_MODE_IT_FALLING;
HAL_NVIC_EnableIRQ(EXTI0_IRQn);
HAL_NVIC_SetPriority(EXTI0_IRQn, 0, 0);

// Implement callback
void HAL_GPIO_EXTI_Callback(uint16_t GPIO_Pin) {
  if (GPIO_Pin == GPIO_PIN_0) {
    // Handle interrupt
  }
}
```

**Arduino:**
```cpp
void setup() {
  attachInterrupt(digitalPinToInterrupt(PA0), isr, FALLING);
}

void isr() {
  // Interrupt service routine (keep short!)
}
```

### RTC (Real-Time Clock)

```c
RTC_TimeTypeDef sTime;
RTC_DateTypeDef sDate;

// Set time
sTime.Hours = 12;
sTime.Minutes = 30;
sTime.Seconds = 0;
HAL_RTC_SetTime(&hrtc, &sTime, RTC_FORMAT_BIN);

// Set date
sDate.Year = 24;
sDate.Month = RTC_MONTH_MARCH;
sDate.Date = 1;
HAL_RTC_SetDate(&hrtc, &sDate, RTC_FORMAT_BIN);

// Get time
HAL_RTC_GetTime(&hrtc, &sTime, RTC_FORMAT_BIN);
HAL_RTC_GetDate(&hrtc, &sDate, RTC_FORMAT_BIN);
```

### USB CDC (Virtual COM Port)

**HAL + USB middleware:**
```c
#include "usbd_cdc_if.h"

uint8_t data[] = "Hello USB\r\n";
CDC_Transmit_FS(data, sizeof(data)-1);

// Implement callback
int8_t CDC_Receive_FS(uint8_t* Buf, uint32_t *Len) {
  // Process received data
  return (USBD_OK);
}
```

## Debugging

### Printf via SWO (Serial Wire Output)

```c
// Redirect printf to SWO
int _write(int file, char *ptr, int len) {
  for (int i = 0; i < len; i++) {
    ITM_SendChar((*ptr++));
  }
  return len;
}

// Use normally
printf("Counter: %d\n", counter);
```

### Debugger with ST-Link

```bash
# Start OpenOCD
openocd -f interface/stlink-v2.cfg -f target/stm32f1x.cfg

# In another terminal, start GDB
arm-none-eabi-gdb firmware.elf
(gdb) target remote localhost:3333
(gdb) load
(gdb) monitor reset halt
(gdb) continue
```

## Best Practices

### 1. Clock Configuration
Always configure clocks properly for maximum performance:
```c
// Use HSE (external crystal) with PLL
// F103: 8MHz HSE * PLL9 = 72MHz
// F4: Various PLL configurations up to 180MHz
```

### 2. Peripheral Initialization Order
```c
HAL_Init();              // 1. Initialize HAL
SystemClock_Config();    // 2. Configure clocks
MX_GPIO_Init();         // 3. GPIO
MX_DMA_Init();          // 4. DMA (before peripherals using it)
MX_USART_Init();        // 5. Other peripherals
```

### 3. Interrupt Priorities
```c
// Lower number = higher priority
HAL_NVIC_SetPriority(EXTI0_IRQn, 0, 0);      // Highest
HAL_NVIC_SetPriority(TIM1_UP_IRQn, 1, 0);    // Medium
HAL_NVIC_SetPriority(USART1_IRQn, 2, 0);     // Lower
```

### 4. Power Optimization
```c
// Enter sleep mode
HAL_PWR_EnterSLEEPMode(PWR_MAINREGULATOR_ON, PWR_SLEEPENTRY_WFI);

// Enter stop mode (lower power)
HAL_PWR_EnterSTOPMode(PWR_LOWPOWERREGULATOR_ON, PWR_STOPENTRY_WFI);
```

## Troubleshooting

### Upload Issues

**ST-Link not detected:**
```bash
# Check connection
st-info --probe

# Update ST-Link firmware
# Download from st.com/stlink-v2

# Try different USB port
```

**DFU mode issues:**
```bash
# Ensure BOOT0 is HIGH (3.3V)
# Press reset button
# Check with dfu-util -l

# If not detected, install DFU drivers (Windows)
```

### Common Errors

**HardFault:**
- Check stack size
- Verify pointer validity
- Check peripheral clocks enabled
- Review interrupt handlers

**Memory overflow:**
```
region `FLASH' overflowed by X bytes
```
- Reduce code size
- Remove unused libraries
- Use smaller bootloader

**Clock configuration failed:**
- Check crystal value matches code
- Verify HSE_VALUE define
- Check solder connections

## Useful Commands

```bash
# PlatformIO
pio run -t upload        # Build and upload
pio device monitor       # Serial monitor
pio run -t clean         # Clean build
pio debug               # Start debugger

# ST-Link tools
st-info --descr         # Device info
st-info --chipid        # Chip ID
st-flash read dump.bin 0x8000000 0x10000  # Read flash

# OpenOCD
openocd -f board/stm32f103c8_blue_pill.cfg
```

## Resources

- [STM32CubeMX](https://www.st.com/stm32cubemx) - Graphical configuration
- [STM32 Reference Manuals](https://www.st.com) - Detailed peripheral docs
- [PlatformIO STM32](https://docs.platformio.org/en/latest/platforms/ststm32.html)
- [STM32duino](https://github.com/stm32duino) - Arduino core
