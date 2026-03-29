#ifndef CONFIG_H
#define CONFIG_H

// ============================================
// Pin Assignments
// ============================================
#define PIN_MIC_DATA      41    // I2S PDM data in (built-in mic)
#define PIN_MIC_CLK       42    // I2S PDM clock (built-in mic)
#define PIN_NEOPIXEL      1     // D0 — WS2812B RGB LED data
#define PIN_BUTTON         2     // D1 — Tactile button (10kΩ pull-up)
#define PIN_VIBRATION      3     // D2 — Vibration motor (Phase B, unused now)
#define PIN_SD_CS         21    // SD card chip select (built-in)

// ============================================
// Audio / VAD Settings
// ============================================
#define AUDIO_SAMPLE_RATE     16000   // 16kHz — sufficient for speech
#define AUDIO_WINDOW_MS       100     // RMS energy window (100ms chunks)
#define AUDIO_SAMPLES_PER_WINDOW ((AUDIO_SAMPLE_RATE * AUDIO_WINDOW_MS) / 1000)
#define VAD_ENERGY_THRESHOLD  500     // Amplitude threshold for speech detection
                                       // Tune this per environment (higher = less sensitive)
#define VAD_SENSITIVITY_LEVELS 4      // Number of sensitivity presets
// Sensitivity presets: threshold values for modes 1-4
// Lower = more sensitive (catches quieter speech but more false positives)
static const int VAD_THRESHOLDS[VAD_SENSITIVITY_LEVELS] = { 300, 500, 800, 1200 };

// ============================================
// Speech Timer Thresholds (milliseconds)
// ============================================
#define PAUSE_THRESHOLD_MS    1200    // 1.2s silence = timer reset
#define ALERT_GENTLE_MS       7000    // 7 seconds continuous speech
#define ALERT_MODERATE_MS    15000    // 15 seconds
#define ALERT_URGENT_MS      30000    // 30 seconds
#define ALERT_CRITICAL_MS    60000    // 60 seconds

// ============================================
// Button Timing (milliseconds)
// ============================================
#define BUTTON_DEBOUNCE_MS    50      // Debounce window
#define BUTTON_MULTI_TAP_MS  300     // Window to detect multi-tap
#define BUTTON_LONG_PRESS_MS 3000    // Long press threshold

// ============================================
// Battery Monitoring
// ============================================
#define BATTERY_CHECK_INTERVAL_MS  60000  // Check every 60 seconds
#define BATTERY_WARNING_PERCENT    10     // Orange blink warning
#define BATTERY_SHUTDOWN_PERCENT    5     // Save + deep sleep
#define BATTERY_DIM_PERCENT        15     // Reduce LED brightness

// ============================================
// LED Settings
// ============================================
#define LED_NUM_PIXELS        1       // Single NeoPixel (or 8 for strip)
#define LED_BRIGHTNESS_FULL  50      // Max brightness (0-255, keep low for battery)
#define LED_BRIGHTNESS_DIM   15      // Dimmed for low battery
#define LED_BREATHE_SPEED_MS 2000    // Breathing animation cycle

#endif // CONFIG_H
