#include "backlog.h"
#include "sd_card.h"
#include "boot_state.h"
#include <SD.h>

static const char* BACKLOG_PATH = "/RG/backlog.bin";
static const char* BACKLOG_BAK_PATH = "/RG/backlog.bin.bak";
static const char* SYNC_STATE_PATH = "/RG/sync_state.bin";
static const uint8_t BACKLOG_MAGIC[4] = {'R', 'G', 'B', 'L'};
static const uint8_t SYNC_MAGIC[4] = {'R', 'G', 'S', 'C'};

static bool ready = false;
static BacklogHeader header;

// In-memory record cache (max 128 records = 4KB, fits in SRAM)
#define BACKLOG_MAX_RECORDS 128
static SessionRecord records[BACKLOG_MAX_RECORDS];
static uint16_t recordCount = 0;

// Sync state (loaded from SD, committed on request)
static SyncState syncState;

// Storage threshold: 64KB minimum free space
#define STORAGE_LOW_THRESHOLD 65536

// ============================================
// Internal helpers
// ============================================

static bool validateBacklogMagic(const BacklogHeader& h) {
  return (h.magic[0] == BACKLOG_MAGIC[0] &&
          h.magic[1] == BACKLOG_MAGIC[1] &&
          h.magic[2] == BACKLOG_MAGIC[2] &&
          h.magic[3] == BACKLOG_MAGIC[3]);
}

static bool validateSyncMagic(const SyncState& s) {
  return (s.magic[0] == SYNC_MAGIC[0] &&
          s.magic[1] == SYNC_MAGIC[1] &&
          s.magic[2] == SYNC_MAGIC[2] &&
          s.magic[3] == SYNC_MAGIC[3]);
}

static void initEmptyHeader() {
  memcpy(header.magic, BACKLOG_MAGIC, 4);
  header.version = BACKLOG_VERSION;
  header.recordSize = BACKLOG_RECORD_SIZE;
  header.recordCount = 0;
  header.bootId = bootStateGetId();
  memset(header.reserved, 0, 4);
}

static bool writeNewBacklog() {
  initEmptyHeader();
  File f = SD.open(BACKLOG_PATH, FILE_WRITE);
  if (!f) {
    Serial.println("[Backlog] ERROR: Failed to create backlog.bin");
    return false;
  }
  f.write((uint8_t*)&header, sizeof(BacklogHeader));
  f.close();
  recordCount = 0;
  return true;
}

static bool writeFullBacklog() {
  File f = SD.open(BACKLOG_PATH, FILE_WRITE);
  if (!f) {
    Serial.println("[Backlog] ERROR: Failed to rewrite backlog.bin");
    return false;
  }
  f.write((uint8_t*)&header, sizeof(BacklogHeader));
  for (uint16_t i = 0; i < recordCount; i++) {
    f.write((uint8_t*)&records[i], sizeof(SessionRecord));
  }
  f.close();
  return true;
}

// ============================================
// Public API
// ============================================

void backlogInit() {
  ready = false;
  recordCount = 0;
  memset(&syncState, 0, sizeof(syncState));

  if (!sdCardIsReady()) {
    Serial.println("[Backlog] SD unavailable — backlog disabled");
    return;
  }

  if (SD.exists(BACKLOG_PATH)) {
    File f = SD.open(BACKLOG_PATH, FILE_READ);
    if (!f) {
      Serial.println("[Backlog] ERROR: Failed to open backlog.bin");
      return;
    }

    // Read header
    if (f.size() < sizeof(BacklogHeader)) {
      f.close();
      Serial.println("[Backlog] File too small — creating fresh");
      if (!writeNewBacklog()) return;
    } else {
      f.read((uint8_t*)&header, sizeof(BacklogHeader));

      if (!validateBacklogMagic(header)) {
        f.close();
        Serial.println("[Backlog] Invalid magic — renaming to .bak, creating fresh");
        SD.rename(BACKLOG_PATH, BACKLOG_BAK_PATH);
        if (!writeNewBacklog()) return;
      } else if (header.version != BACKLOG_VERSION) {
        f.close();
        Serial.printf("[Backlog] Version mismatch (got %d, want %d) — renaming to .bak\n",
                      header.version, BACKLOG_VERSION);
        SD.rename(BACKLOG_PATH, BACKLOG_BAK_PATH);
        if (!writeNewBacklog()) return;
      } else {
        // Valid header — read records
        uint16_t count = header.recordCount;
        if (count > BACKLOG_MAX_RECORDS) {
          Serial.printf("[Backlog] Record count %d exceeds max %d — truncating\n",
                        count, BACKLOG_MAX_RECORDS);
          count = BACKLOG_MAX_RECORDS;
        }

        // Verify file has enough data for claimed records
        size_t expectedSize = sizeof(BacklogHeader) + (size_t)count * sizeof(SessionRecord);
        if ((size_t)f.size() < expectedSize) {
          // Power-loss truncation: only read records that are fully present
          uint16_t actualRecords = (f.size() - sizeof(BacklogHeader)) / sizeof(SessionRecord);
          Serial.printf("[Backlog] File truncated: expected %d records, found %d\n",
                        count, actualRecords);
          count = actualRecords;
        }

        for (uint16_t i = 0; i < count; i++) {
          f.read((uint8_t*)&records[i], sizeof(SessionRecord));
        }
        f.close();
        recordCount = count;

        // Fix header if it was wrong (power-loss recovery)
        if (header.recordCount != recordCount) {
          header.recordCount = recordCount;
          // Rewrite header with corrected count
          File fw = SD.open(BACKLOG_PATH, "r+");
          if (fw) {
            fw.seek(0);
            fw.write((uint8_t*)&header, sizeof(BacklogHeader));
            fw.close();
          }
        }

        Serial.printf("[Backlog] Loaded %d records from backlog.bin\n", recordCount);
      }
    }
  } else {
    Serial.println("[Backlog] No backlog.bin found — creating");
    if (!writeNewBacklog()) return;
  }

  // Load sync state if it exists
  if (SD.exists(SYNC_STATE_PATH)) {
    File sf = SD.open(SYNC_STATE_PATH, FILE_READ);
    if (sf && sf.size() == sizeof(SyncState)) {
      sf.read((uint8_t*)&syncState, sizeof(SyncState));
      sf.close();
      if (!validateSyncMagic(syncState)) {
        Serial.println("[Backlog] Invalid sync state magic — resetting");
        memset(&syncState, 0, sizeof(syncState));
      } else {
        Serial.printf("[Backlog] Sync state loaded: last acked boot=%lu seq=%d, pending=%d\n",
                      (unsigned long)syncState.lastAckedBootId,
                      syncState.lastAckedSequence,
                      syncState.pendingCount);
      }
    } else {
      if (sf) sf.close();
    }
  }

  ready = true;
  Serial.printf("[Backlog] Ready (%d records, %d pending)\n",
                recordCount, backlogGetPendingCount());
}

bool backlogAppendSession(const SessionRecord& record) {
  if (!ready) {
    Serial.println("[Backlog] Not ready — cannot append");
    return false;
  }

  if (recordCount >= BACKLOG_MAX_RECORDS) {
    Serial.println("[Backlog] Record buffer full — run compact or sync first");
    return false;
  }

  // Check storage
  uint64_t freeBytes = SD.totalBytes() - SD.usedBytes();
  if (freeBytes < STORAGE_LOW_THRESHOLD) {
    uint32_t freeKB = (uint32_t)(freeBytes / 1024);
    Serial.printf("[Backlog] Storage low: %lu KB free — publishing EVENT_STORAGE_LOW\n",
                  (unsigned long)freeKB);
    eventBusPublish(EVENT_STORAGE_LOW, (int)freeKB);
    return false;
  }

  // Add to in-memory array
  records[recordCount] = record;

  // Append to file
  File f = SD.open(BACKLOG_PATH, "r+");
  if (!f) {
    Serial.println("[Backlog] ERROR: Failed to open backlog.bin for append");
    return false;
  }

  // Seek to end (past header + existing records)
  size_t offset = sizeof(BacklogHeader) + (size_t)recordCount * sizeof(SessionRecord);
  f.seek(offset);
  f.write((uint8_t*)&records[recordCount], sizeof(SessionRecord));

  // Update header record count
  recordCount++;
  header.recordCount = recordCount;
  f.seek(0);
  f.write((uint8_t*)&header, sizeof(BacklogHeader));
  f.close();

  Serial.printf("[Backlog] Appended session (boot=%lu, seq=%d) — %d total records\n",
                (unsigned long)record.bootId, record.deviceSessionSequence, recordCount);
  return true;
}

bool backlogGetNextPending(SessionRecord& out) {
  if (!ready) return false;

  for (uint16_t i = 0; i < recordCount; i++) {
    if (records[i].syncStatus == SYNC_PENDING) {
      out = records[i];
      return true;
    }
  }
  return false;
}

bool backlogAckRecord(uint32_t bootId, uint16_t sequence) {
  if (!ready) return false;

  for (uint16_t i = 0; i < recordCount; i++) {
    if (records[i].bootId == bootId && records[i].deviceSessionSequence == sequence) {
      records[i].syncStatus = SYNC_SYNCED;

      // Write the updated syncStatus byte to disk
      // syncStatus is at offset 23 within SessionRecord
      size_t recordOffset = sizeof(BacklogHeader) + (size_t)i * sizeof(SessionRecord);
      size_t syncStatusFieldOffset = offsetof(SessionRecord, syncStatus);

      File f = SD.open(BACKLOG_PATH, "r+");
      if (f) {
        f.seek(recordOffset + syncStatusFieldOffset);
        f.write(records[i].syncStatus);
        f.close();
      }

      // Update sync state
      syncState.lastAckedBootId = bootId;
      syncState.lastAckedSequence = sequence;

      Serial.printf("[Backlog] Acked session (boot=%lu, seq=%d)\n",
                    (unsigned long)bootId, sequence);
      return true;
    }
  }

  Serial.printf("[Backlog] Ack failed — record not found (boot=%lu, seq=%d)\n",
                (unsigned long)bootId, sequence);
  return false;
}

uint16_t backlogGetPendingCount() {
  uint16_t count = 0;
  for (uint16_t i = 0; i < recordCount; i++) {
    if (records[i].syncStatus == SYNC_PENDING) {
      count++;
    }
  }
  return count;
}

uint32_t backlogGetOldestBootId() {
  if (recordCount == 0) return 0;
  return records[0].bootId;
}

uint32_t backlogGetNewestBootId() {
  if (recordCount == 0) return 0;
  return records[recordCount - 1].bootId;
}

bool backlogCommitCheckpoint() {
  if (!ready) return false;

  memcpy(syncState.magic, SYNC_MAGIC, 4);
  syncState.pendingCount = backlogGetPendingCount();

  File f = SD.open(SYNC_STATE_PATH, FILE_WRITE);
  if (!f) {
    Serial.println("[Backlog] ERROR: Failed to write sync_state.bin");
    return false;
  }
  f.write((uint8_t*)&syncState, sizeof(SyncState));
  f.close();

  Serial.printf("[Backlog] Checkpoint committed: pending=%d\n", syncState.pendingCount);
  return true;
}

void backlogCompact() {
  if (!ready) return;
  if (recordCount <= 100) return;

  // Count synced records
  uint16_t syncedCount = 0;
  for (uint16_t i = 0; i < recordCount; i++) {
    if (records[i].syncStatus == SYNC_SYNCED) {
      syncedCount++;
    }
  }

  // Only compact if more than half are synced
  if (syncedCount <= recordCount / 2) {
    Serial.println("[Backlog] Compact skipped — not enough synced records");
    return;
  }

  // Filter to pending-only
  uint16_t newCount = 0;
  for (uint16_t i = 0; i < recordCount; i++) {
    if (records[i].syncStatus != SYNC_SYNCED) {
      records[newCount] = records[i];
      newCount++;
    }
  }

  uint16_t removed = recordCount - newCount;
  recordCount = newCount;
  header.recordCount = recordCount;

  // Rewrite entire backlog file
  if (writeFullBacklog()) {
    Serial.printf("[Backlog] Compacted: removed %d synced records, %d remaining\n",
                  removed, recordCount);
  }
}

bool backlogIsReady() {
  return ready;
}
