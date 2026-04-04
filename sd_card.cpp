#include "sd_card.h"
#include "event_bus.h"
#include "config.h"
#include <SD.h>
#include <SPI.h>

static bool cardReady = false;

// Log card type as human-readable string
static void logCardType(uint8_t type) {
  Serial.print("[SD] Card type: ");
  switch (type) {
    case CARD_MMC:  Serial.println("MMC");   break;
    case CARD_SD:   Serial.println("SD");    break;
    case CARD_SDHC: Serial.println("SDHC");  break;
    default:        Serial.println("Unknown"); break;
  }
}

void sdCardInit() {
  Serial.println("[SD] Initializing SD card...");

  // XIAO ESP32S3 Sense expansion board uses non-default SPI pins for SD card:
  // SCK=GPIO7, MISO=GPIO8, MOSI=GPIO9, CS=GPIO21
  SPI.begin(7, 8, 9, PIN_SD_CS);

  if (!SD.begin(PIN_SD_CS, SPI, 4000000)) {
    Serial.println("[SD] No card detected — recording disabled");
    cardReady = false;
    eventBusPublish(EVENT_SD_READY, 0);
    return;
  }

  uint8_t cardType = SD.cardType();
  if (cardType == CARD_NONE) {
    Serial.println("[SD] No card detected — recording disabled");
    cardReady = false;
    eventBusPublish(EVENT_SD_READY, 0);
    return;
  }

  logCardType(cardType);

  // Log card size and free space
  uint64_t cardSize = SD.cardSize() / (1024 * 1024);     // MB
  uint64_t totalBytes = SD.totalBytes() / (1024 * 1024);  // MB
  uint64_t usedBytes = SD.usedBytes() / (1024 * 1024);    // MB
  uint64_t freeBytes = totalBytes - usedBytes;

  Serial.print("[SD] Card mounted, FAT32, ");
  Serial.print((unsigned long)freeBytes);
  Serial.print(" MB free (");
  Serial.print((unsigned long)cardSize);
  Serial.println(" MB total)");

  // Create directory structure: /RG/recordings/
  if (!SD.exists("/RG")) {
    if (!SD.mkdir("/RG")) {
      Serial.println("[SD] ERROR: Failed to create /RG — recording disabled");
      cardReady = false;
      eventBusPublish(EVENT_SD_READY, 0);
      return;
    }
    Serial.println("[SD] Created /RG");
  }
  if (!SD.exists("/RG/recordings")) {
    if (!SD.mkdir("/RG/recordings")) {
      Serial.println("[SD] ERROR: Failed to create /RG/recordings — recording disabled");
      cardReady = false;
      eventBusPublish(EVENT_SD_READY, 0);
      return;
    }
    Serial.println("[SD] Created /RG/recordings");
  }

  cardReady = true;
  eventBusPublish(EVENT_SD_READY, 1);
  Serial.println("[SD] Ready");
}

bool sdCardIsReady() {
  return cardReady;
}
