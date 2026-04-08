#include "boot_state.h"
#include "sd_card.h"
#include <SD.h>

static const char* BOOT_ID_PATH = "/RG/boot_id.bin";

// On-disk format (8 bytes)
struct BootState {
  uint8_t  magic[2];      // "RG" (0x52, 0x47)
  uint16_t reserved;      // zero
  uint32_t bootId;
};

static uint32_t currentBootId = 0;
static uint16_t sessionSequence = 0;

void bootStateInit() {
  if (!sdCardIsReady()) {
    Serial.println("[BootState] SD unavailable — boot ID disabled");
    return;
  }

  BootState state;
  memset(&state, 0, sizeof(state));

  if (SD.exists(BOOT_ID_PATH)) {
    File f = SD.open(BOOT_ID_PATH, FILE_READ);
    if (f && f.size() == sizeof(BootState)) {
      f.read((uint8_t*)&state, sizeof(state));
      f.close();

      if (state.magic[0] == 'R' && state.magic[1] == 'G') {
        currentBootId = state.bootId + 1;
      } else {
        Serial.println("[BootState] Invalid magic — resetting boot ID");
        currentBootId = 1;
      }
    } else {
      if (f) f.close();
      currentBootId = 1;
    }
  } else {
    currentBootId = 1;
  }

  // Write incremented boot ID back
  state.magic[0] = 'R';
  state.magic[1] = 'G';
  state.reserved = 0;
  state.bootId = currentBootId;

  File f = SD.open(BOOT_ID_PATH, FILE_WRITE);
  if (f) {
    f.write((uint8_t*)&state, sizeof(state));
    f.close();
    Serial.printf("[BootState] Boot ID: %lu\n", (unsigned long)currentBootId);
  } else {
    Serial.println("[BootState] ERROR: Failed to write boot_id.bin");
  }

  sessionSequence = 0;
}

uint32_t bootStateGetId() {
  return currentBootId;
}

uint16_t bootStateNextSessionSequence() {
  return sessionSequence++;
}
