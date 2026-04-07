#include "ble_output.h"
#include "event_bus.h"
#include "config.h"
#include "speech_timer.h"
#include "battery_monitor.h"

// NimBLE memory optimization — must be defined before NimBLEDevice.h
// We only need peripheral + broadcaster (server), not central/observer (client)
#define CONFIG_BT_NIMBLE_MAX_CONNECTIONS 1
#define CONFIG_BT_NIMBLE_ROLE_CENTRAL_DISABLED
#define CONFIG_BT_NIMBLE_ROLE_OBSERVER_DISABLED
#define CONFIG_BT_NIMBLE_MAX_BONDS 1
#define CONFIG_BT_NIMBLE_MAX_CCCDS 10   // We have 9 characteristics, some with CCCD
#define CONFIG_BT_NIMBLE_HOST_TASK_STACK_SIZE 3072

#include <NimBLEDevice.h>

// ============================================
// State tracked for BLE characteristics
// ============================================
static bool clientConnected = false;
static AlertLevel currentAlert = ALERT_NONE;
static DeviceMode currentMode = MODE_MONITORING;
static AlertModality currentModality = MODALITY_BOTH;
static uint8_t currentSensitivity = 0;
static unsigned long lastBleUpdate = 0;

// Session stats tracked locally for the packed characteristic
static uint16_t sessionAlertCount = 0;
static uint8_t  sessionMaxAlert = 0;
static uint16_t sessionSpeechSegments = 0;
static unsigned long sessionStartMs = 0;

// Runtime alert thresholds (default from config.h, writable via BLE)
static uint16_t alertThresholds[4] = {
  ALERT_GENTLE_MS / 1000,    // stored as seconds for BLE (7)
  ALERT_MODERATE_MS / 1000,  // (15)
  ALERT_URGENT_MS / 1000,    // (30)
  ALERT_CRITICAL_MS / 1000   // (60)
};

// ============================================
// NimBLE pointers
// ============================================
static NimBLEServer* pServer = nullptr;
static NimBLECharacteristic* chrAlertLevel = nullptr;
static NimBLECharacteristic* chrSpeechDur = nullptr;
static NimBLECharacteristic* chrDeviceMode = nullptr;
static NimBLECharacteristic* chrSensitivity = nullptr;
static NimBLECharacteristic* chrBattery = nullptr;
static NimBLECharacteristic* chrSessionStats = nullptr;
static NimBLECharacteristic* chrThresholds = nullptr;
static NimBLECharacteristic* chrModality = nullptr;
static NimBLECharacteristic* chrDeviceInfo = nullptr;

// ============================================
// Server Callbacks
// ============================================
class BleServerCallbacks : public NimBLEServerCallbacks {
  void onConnect(NimBLEServer* pServer, NimBLEConnInfo& connInfo) override {
    clientConnected = true;
    // Request faster connection interval: 15-30ms (units of 1.25ms)
    pServer->updateConnParams(connInfo.getConnHandle(), 12, 24, 0, 200);
    Serial.printf("[BLE] Client connected (addr: %s)\n",
                  connInfo.getAddress().toString().c_str());
    eventBusPublish(EVENT_BLE_CONNECTED, 0);
  }

  void onDisconnect(NimBLEServer* pServer, NimBLEConnInfo& connInfo, int reason) override {
    clientConnected = false;
    Serial.printf("[BLE] Client disconnected (reason: 0x%02X)\n", reason);
    eventBusPublish(EVENT_BLE_DISCONNECTED, 0);
    // Stop-then-start to clear any stale advertising state
    NimBLEDevice::getAdvertising()->stop();
    delay(100);  // Allow BLE stack to settle
    NimBLEDevice::startAdvertising();
    Serial.println("[BLE] Advertising restarted after disconnect");
  }
};

static BleServerCallbacks serverCallbacks;

// ============================================
// Characteristic Write Callbacks
// ============================================
class SensitivityWriteCallback : public NimBLECharacteristicCallbacks {
  void onWrite(NimBLECharacteristic* pChr, NimBLEConnInfo& connInfo) override {
    uint8_t val = pChr->getValue<uint8_t>();
    if (val < VAD_SENSITIVITY_LEVELS) {
      currentSensitivity = val;
      eventBusPublish(EVENT_SENSITIVITY_CHANGED, val);
      Serial.printf("[BLE] Sensitivity set to %d\n", val);
    }
  }
};

class DeviceModeWriteCallback : public NimBLECharacteristicCallbacks {
  void onWrite(NimBLECharacteristic* pChr, NimBLEConnInfo& connInfo) override {
    uint8_t val = pChr->getValue<uint8_t>();
    if (val <= MODE_DEEP_SLEEP) {
      currentMode = (DeviceMode)val;
      eventBusPublish(EVENT_MODE_CHANGED, val);
      Serial.printf("[BLE] Mode set to %d\n", val);
    }
  }
};

class ThresholdsWriteCallback : public NimBLECharacteristicCallbacks {
  void onWrite(NimBLECharacteristic* pChr, NimBLEConnInfo& connInfo) override {
    // 8 bytes: 4x uint16_t LE (thresholds in seconds)
    const uint8_t* data = pChr->getValue().data();
    size_t len = pChr->getValue().size();
    if (len >= 8) {
      for (int i = 0; i < 4; i++) {
        alertThresholds[i] = data[i * 2] | (data[i * 2 + 1] << 8);
      }
      // Update speech timer with new thresholds (seconds -> milliseconds)
      speechTimerSetThresholds(
        (unsigned long)alertThresholds[0] * 1000,
        (unsigned long)alertThresholds[1] * 1000,
        (unsigned long)alertThresholds[2] * 1000,
        (unsigned long)alertThresholds[3] * 1000
      );
      eventBusPublish(EVENT_THRESHOLDS_CHANGED, 0);
      Serial.printf("[BLE] Thresholds set: %d/%d/%d/%ds\n",
                    alertThresholds[0], alertThresholds[1],
                    alertThresholds[2], alertThresholds[3]);
    }
  }
};

class ModalityWriteCallback : public NimBLECharacteristicCallbacks {
  void onWrite(NimBLECharacteristic* pChr, NimBLEConnInfo& connInfo) override {
    uint8_t val = pChr->getValue<uint8_t>();
    if (val <= MODALITY_BOTH) {
      currentModality = (AlertModality)val;
      eventBusPublish(EVENT_MODALITY_CHANGED, val);
      Serial.printf("[BLE] Modality set to %d\n", val);
    }
  }
};

static SensitivityWriteCallback sensitivityCb;
static DeviceModeWriteCallback deviceModeCb;
static ThresholdsWriteCallback thresholdsCb;
static ModalityWriteCallback modalityCb;

// ============================================
// Event Bus Callbacks
// ============================================
static void onAlertChanged(EventType event, int payload) {
  currentAlert = (AlertLevel)payload;
  sessionAlertCount++;
  if (payload > sessionMaxAlert) sessionMaxAlert = payload;

  if (clientConnected && chrAlertLevel) {
    uint8_t val = (uint8_t)payload;
    chrAlertLevel->setValue(val);
    chrAlertLevel->notify();
  }
}

static void onModeChanged(EventType event, int payload) {
  currentMode = (DeviceMode)payload;
  if (clientConnected && chrDeviceMode) {
    uint8_t val = (uint8_t)payload;
    chrDeviceMode->setValue(val);
    chrDeviceMode->notify();
  }
}

static void onSpeechEvent(EventType event, int payload) {
  if (event == EVENT_SPEECH_STARTED) {
    sessionSpeechSegments++;
    if (sessionStartMs == 0) sessionStartMs = millis();
  }
}

static void onModalityChanged(EventType event, int payload) {
  currentModality = (AlertModality)payload;
  if (clientConnected && chrModality) {
    uint8_t val = (uint8_t)payload;
    chrModality->setValue(val);
    chrModality->notify();
  }
}

static void onSensitivityChanged(EventType event, int payload) {
  currentSensitivity = (uint8_t)payload;
  if (clientConnected && chrSensitivity) {
    uint8_t val = (uint8_t)payload;
    chrSensitivity->setValue(val);
  }
}

// ============================================
// Helpers
// ============================================
static void updateSessionStats() {
  if (!clientConnected || !chrSessionStats) return;

  // Pack 10 bytes: uint32 duration, uint16 alerts, uint8 max, uint16 segments, uint8 sensitivity
  uint8_t buf[10];
  uint32_t dur = (sessionStartMs > 0) ? (millis() - sessionStartMs) : 0;
  buf[0] = dur & 0xFF;
  buf[1] = (dur >> 8) & 0xFF;
  buf[2] = (dur >> 16) & 0xFF;
  buf[3] = (dur >> 24) & 0xFF;
  buf[4] = sessionAlertCount & 0xFF;
  buf[5] = (sessionAlertCount >> 8) & 0xFF;
  buf[6] = sessionMaxAlert;
  buf[7] = sessionSpeechSegments & 0xFF;
  buf[8] = (sessionSpeechSegments >> 8) & 0xFF;
  buf[9] = currentSensitivity;

  chrSessionStats->setValue(buf, 10);
  chrSessionStats->notify();
}

static void updateSpeechDuration() {
  if (!clientConnected || !chrSpeechDur) return;

  uint32_t dur = speechTimerGetDuration();
  chrSpeechDur->setValue(dur);
  chrSpeechDur->notify();
}

static void updateBattery() {
  if (!clientConnected || !chrBattery) return;

  uint8_t pct = (uint8_t)batteryGetPercent();
  chrBattery->setValue(pct);
  chrBattery->notify();
}

// ============================================
// Public API
// ============================================
void bleOutputInit() {
  // Initialize NimBLE — must happen before I2S audio claims internal DMA memory
  NimBLEDevice::init(BLE_DEVICE_NAME);

  // Create server
  pServer = NimBLEDevice::createServer();
  pServer->setCallbacks(&serverCallbacks);

  // Create service
  NimBLEService* pService = pServer->createService(BLE_SERVICE_UUID);

  // --- Characteristics ---

  // Alert Level (Read + Notify)
  chrAlertLevel = pService->createCharacteristic(
    BLE_CHR_ALERT_LEVEL,
    NIMBLE_PROPERTY::READ | NIMBLE_PROPERTY::NOTIFY
  );
  uint8_t initAlert = ALERT_NONE;
  chrAlertLevel->setValue(initAlert);

  // Speech Duration (Read + Notify) — uint32_t ms
  chrSpeechDur = pService->createCharacteristic(
    BLE_CHR_SPEECH_DUR,
    NIMBLE_PROPERTY::READ | NIMBLE_PROPERTY::NOTIFY
  );
  uint32_t initDur = 0;
  chrSpeechDur->setValue(initDur);

  // Device Mode (Read + Write + Notify)
  chrDeviceMode = pService->createCharacteristic(
    BLE_CHR_DEVICE_MODE,
    NIMBLE_PROPERTY::READ | NIMBLE_PROPERTY::WRITE | NIMBLE_PROPERTY::NOTIFY
  );
  uint8_t initMode = MODE_MONITORING;
  chrDeviceMode->setValue(initMode);
  chrDeviceMode->setCallbacks(&deviceModeCb);

  // Sensitivity (Read + Write)
  chrSensitivity = pService->createCharacteristic(
    BLE_CHR_SENSITIVITY,
    NIMBLE_PROPERTY::READ | NIMBLE_PROPERTY::WRITE
  );
  uint8_t initSens = 0;
  chrSensitivity->setValue(initSens);
  chrSensitivity->setCallbacks(&sensitivityCb);

  // Battery Level (Read + Notify)
  chrBattery = pService->createCharacteristic(
    BLE_CHR_BATTERY,
    NIMBLE_PROPERTY::READ | NIMBLE_PROPERTY::NOTIFY
  );
  uint8_t initBat = 0;  // Updated once battery monitor initializes
  chrBattery->setValue(initBat);

  // Session Stats (Read + Notify) — packed 10 bytes
  chrSessionStats = pService->createCharacteristic(
    BLE_CHR_SESSION_STATS,
    NIMBLE_PROPERTY::READ | NIMBLE_PROPERTY::NOTIFY
  );
  uint8_t initStats[10] = {0};
  chrSessionStats->setValue(initStats, 10);

  // Alert Thresholds (Read + Write) — 4x uint16_t LE (seconds)
  chrThresholds = pService->createCharacteristic(
    BLE_CHR_THRESHOLDS,
    NIMBLE_PROPERTY::READ | NIMBLE_PROPERTY::WRITE
  );
  uint8_t initThresh[8];
  for (int i = 0; i < 4; i++) {
    initThresh[i * 2] = alertThresholds[i] & 0xFF;
    initThresh[i * 2 + 1] = (alertThresholds[i] >> 8) & 0xFF;
  }
  chrThresholds->setValue(initThresh, 8);
  chrThresholds->setCallbacks(&thresholdsCb);

  // Alert Modality (Read + Write + Notify)
  chrModality = pService->createCharacteristic(
    BLE_CHR_MODALITY,
    NIMBLE_PROPERTY::READ | NIMBLE_PROPERTY::WRITE | NIMBLE_PROPERTY::NOTIFY
  );
  uint8_t initMod = MODALITY_BOTH;
  chrModality->setValue(initMod);
  chrModality->setCallbacks(&modalityCb);

  // Device Info (Read only) — firmware version string
  chrDeviceInfo = pService->createCharacteristic(
    BLE_CHR_DEVICE_INFO,
    NIMBLE_PROPERTY::READ
  );
  chrDeviceInfo->setValue("RG v1.0 PhaseC");

  // Start service
  pService->start();

  // Start advertising
  NimBLEAdvertising* pAdv = NimBLEDevice::getAdvertising();
  pAdv->setName(BLE_DEVICE_NAME);
  pAdv->addServiceUUID(BLE_SERVICE_UUID);
  pAdv->enableScanResponse(true);
  pAdv->start();

  // Subscribe to events
  eventBusSubscribe(EVENT_ALERT_LEVEL_CHANGED, onAlertChanged);
  eventBusSubscribe(EVENT_MODE_CHANGED, onModeChanged);
  eventBusSubscribe(EVENT_SPEECH_STARTED, onSpeechEvent);
  eventBusSubscribe(EVENT_SPEECH_ENDED, onSpeechEvent);
  eventBusSubscribe(EVENT_MODALITY_CHANGED, onModalityChanged);
  eventBusSubscribe(EVENT_SENSITIVITY_CHANGED, onSensitivityChanged);

  Serial.println("[BLE] GATT server started, advertising as " BLE_DEVICE_NAME);
}

void bleOutputUpdate() {
  if (!clientConnected) return;

  unsigned long now = millis();
  if (now - lastBleUpdate < BLE_UPDATE_INTERVAL_MS) return;
  lastBleUpdate = now;

  // Periodic updates: speech duration + session stats
  updateSpeechDuration();

  // Battery updates less frequently (piggyback on the 250ms cycle but only update every 60s)
  static unsigned long lastBatteryUpdate = 0;
  if (now - lastBatteryUpdate >= BATTERY_CHECK_INTERVAL_MS) {
    updateBattery();
    updateSessionStats();
    lastBatteryUpdate = now;
  }
}

bool bleIsConnected() {
  return clientConnected;
}
