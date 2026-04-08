#ifndef BACKLOG_H
#define BACKLOG_H

#include <Arduino.h>
#include "event_bus.h"

// Backlog file format version
#define BACKLOG_VERSION 1
#define BACKLOG_RECORD_SIZE 32

// On-disk header (16 bytes)
struct BacklogHeader {
  uint8_t  magic[4];         // "RGBL"
  uint8_t  version;
  uint8_t  recordSize;       // sizeof(SessionRecord)
  uint16_t recordCount;
  uint32_t bootId;
  uint8_t  reserved[4];
};

// On-disk session record (32 bytes)
struct SessionRecord {
  uint32_t bootId;
  uint16_t deviceSessionSequence;
  uint32_t startedAtMsSinceBoot;
  uint32_t endedAtMsSinceBoot;
  uint8_t  mode;
  uint8_t  triggerSource;
  uint16_t alertCount;
  uint8_t  maxAlert;
  uint16_t speechSegments;
  uint8_t  sensitivity;
  uint8_t  syncStatus;       // 0=pending, 1=synced, 2=failed
  uint8_t  reserved[7];
};

// Sync status values
#define SYNC_PENDING  0
#define SYNC_SYNCED   1
#define SYNC_FAILED   2

// On-disk sync checkpoint (16 bytes)
struct SyncState {
  uint8_t  magic[4];         // "RGSC"
  uint32_t lastAckedBootId;
  uint16_t lastAckedSequence;
  uint16_t pendingCount;
  uint8_t  reserved[4];
};

// Public API
void backlogInit();                          // Must call after sdCardInit() and bootStateInit()
bool backlogAppendSession(const SessionRecord& record);  // Write a session to the backlog
bool backlogGetNextPending(SessionRecord& out);          // Get next unsynced record
bool backlogAckRecord(uint32_t bootId, uint16_t sequence);  // Mark record as synced
uint16_t backlogGetPendingCount();           // Number of unsynced records
uint32_t backlogGetOldestBootId();           // Oldest boot ID in backlog
uint32_t backlogGetNewestBootId();           // Newest boot ID in backlog
bool backlogCommitCheckpoint();              // Persist sync state to SD
void backlogCompact();                       // Remove synced records if conditions met
bool backlogIsReady();                       // True if backlog file is valid and writable

#endif // BACKLOG_H
