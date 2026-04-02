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

  if (!SD.begin(PIN_SD_CS)) {
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
    SD.mkdir("/RG");
    Serial.println("[SD] Created /RG");
  }
  if (!SD.exists("/RG/recordings")) {
    SD.mkdir("/RG/recordings");
    Serial.println("[SD] Created /RG/recordings");
  }

  cardReady = true;
  eventBusPublish(EVENT_SD_READY, 1);
  Serial.println("[SD] Ready");
}

bool sdCardIsReady() {
  return cardReady;
}
