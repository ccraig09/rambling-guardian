/**
 * Sync Transport -- BLE layer for the backlog sync protocol.
 *
 * Wires the SYNC_DATA characteristic into the syncEngine scaffold.
 * Handles: manifest request, record transfer, ack, commit.
 * Partial success is normal -- the protocol tolerates it by design.
 */
import { bleService } from './bleManager';
import { parseSyncManifest, parseSessionRecord, parseUint8, encodeSyncAck, encodeUint8 } from './ble';
import { upsertDeviceSession } from '../db/sessions';
import {
  beginSync,
  startImport,
  startFinalizing,
  completeSync,
  failSync,
  advanceCheckpoint,
} from './syncEngine';

const SERVICE_UUID = '4A980001-1CC4-E7C1-C757-F1267DD021E8';
const CHR_SYNC_DATA = '4A98000C-1CC4-E7C1-C757-F1267DD021E8';

/** Per-boot time anchor -- recorded on BLE connect */
interface BootTimeAnchor {
  bootId: number;
  phoneTimestamp: number;   // Date.now() at connection time
  deviceMillis: number;     // millis() value read from device at connection time
}

// Time anchors keyed by bootId
const timeAnchors = new Map<number, BootTimeAnchor>();

/**
 * Record a time anchor for the current boot on BLE connect.
 * Call this from bleManager after reading initial values.
 */
export function recordTimeAnchor(bootId: number, deviceMillis: number): void {
  timeAnchors.set(bootId, {
    bootId,
    phoneTimestamp: Date.now(),
    deviceMillis,
  });
}

/**
 * Convert boot-relative millis to wall-clock timestamp.
 * If we have an anchor for this boot, compute exact offset.
 * Otherwise return 0 (unknown -- best-effort on next connect).
 */
function toWallClock(bootId: number, msSinceBoot: number): number {
  const anchor = timeAnchors.get(bootId);
  if (!anchor) return 0; // No anchor for this boot -- can't compute wall-clock
  const offset = anchor.phoneTimestamp - anchor.deviceMillis;
  return offset + msSinceBoot;
}

/**
 * Run the full sync cycle: manifest -> import -> ack -> commit.
 * Returns the number of sessions imported.
 */
export async function syncFromDevice(): Promise<number> {
  const device = (bleService as any).device;
  if (!device) throw new Error('Not connected');

  await beginSync();

  let imported = 0;

  try {
    // 1. Request manifest
    await device.writeCharacteristicWithResponseForService(
      SERVICE_UUID, CHR_SYNC_DATA, encodeUint8(0x01),
    );

    // Wait for notification with manifest
    const manifest = await waitForNotification(device, CHR_SYNC_DATA, 3000);
    if (!manifest || atob(manifest).length < 10) {
      await failSync('No manifest response');
      return 0;
    }

    const { pendingCount } = parseSyncManifest(manifest);
    console.log(`[SyncTransport] Manifest: ${pendingCount} pending`);

    if (pendingCount === 0) {
      await completeSync();
      return 0;
    }

    // 2. Import loop
    startImport();

    for (let i = 0; i < pendingCount; i++) {
      // Request next record
      await device.writeCharacteristicWithResponseForService(
        SERVICE_UUID, CHR_SYNC_DATA, encodeUint8(0x02),
      );

      const recordData = await waitForNotification(device, CHR_SYNC_DATA, 3000);
      if (!recordData) {
        console.warn('[SyncTransport] No record response -- stopping import');
        break;
      }

      // Check for "no more records" sentinel
      const decoded = atob(recordData);
      if (decoded.length === 1 && parseUint8(recordData) === 0xFF) {
        console.log('[SyncTransport] No more pending records');
        break;
      }

      const record = parseSessionRecord(recordData);
      const sessionId = `dev-${record.bootId}-${record.deviceSessionSequence}`;

      // Convert timestamps
      const startedAt = toWallClock(record.bootId, record.startedAtMsSinceBoot);
      const endedAt = toWallClock(record.bootId, record.endedAtMsSinceBoot);
      const durationMs = record.endedAtMsSinceBoot - record.startedAtMsSinceBoot;

      // Idempotent upsert
      await upsertDeviceSession({
        id: sessionId,
        startedAt: startedAt || Date.now(), // fallback if no anchor
        endedAt: endedAt || Date.now(),
        durationMs,
        mode: 'solo', // device doesn't track session mode yet
        alertCount: record.alertCount,
        maxAlert: record.maxAlert,
        speechSegments: record.speechSegments,
        sensitivity: record.sensitivity,
        bootId: record.bootId,
        deviceSequence: record.deviceSessionSequence,
      });

      // Ack the record
      const ackData = encodeSyncAck(record.bootId, record.deviceSessionSequence);
      await device.writeCharacteristicWithResponseForService(
        SERVICE_UUID, CHR_SYNC_DATA, ackData,
      );

      // Wait for ack response
      const ackResp = await waitForNotification(device, CHR_SYNC_DATA, 3000);
      if (ackResp && parseUint8(ackResp) !== 0x00) {
        console.warn(`[SyncTransport] Ack failed for ${sessionId}`);
        // Continue anyway -- partial success is normal
      }

      await advanceCheckpoint(`${record.bootId}-${record.deviceSessionSequence}`, sessionId);
      imported++;
      console.log(`[SyncTransport] Imported ${sessionId}`);
    }

    // 3. Commit checkpoint
    startFinalizing();
    await device.writeCharacteristicWithResponseForService(
      SERVICE_UUID, CHR_SYNC_DATA, encodeUint8(0x04),
    );

    const commitResp = await waitForNotification(device, CHR_SYNC_DATA, 3000);
    if (commitResp && parseUint8(commitResp) === 0x02) {
      // Commit write failed on device -- partial success.
      // This is a best-effort recovery path, not guaranteed truth.
      // App-side checkpoint is already saved. On next boot, device
      // will re-send these records and app will re-import idempotently.
      console.warn('[SyncTransport] Device commit failed -- partial success, will retry next sync');
    }

    await completeSync();
    return imported;
  } catch (e: any) {
    await failSync(e.message || 'Sync failed');
    return imported;
  }
}

/**
 * Wait for a BLE notification on a characteristic.
 * Returns base64 value or null on timeout.
 */
function waitForNotification(
  device: any,
  characteristicUUID: string,
  timeoutMs: number,
): Promise<string | null> {
  return new Promise((resolve) => {
    let resolved = false;
    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        sub.remove();
        resolve(null);
      }
    }, timeoutMs);

    const sub = device.monitorCharacteristicForService(
      SERVICE_UUID,
      characteristicUUID,
      (_err: any, chr: any) => {
        if (!resolved && chr?.value) {
          resolved = true;
          clearTimeout(timer);
          sub.remove();
          resolve(chr.value);
        }
      },
    );
  });
}
