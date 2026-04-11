/**
 * BLE Service — parsing utilities and encoding helpers for GATT characteristics.
 * Full scan/connect implementation comes in C.6.
 *
 * Note: atob/btoa require Hermes engine (React Native 0.70+).
 * react-native-ble-plx returns characteristic values as base64 strings.
 */

import type { SessionStats, AlertThresholds } from '../types';

// Parse a uint32 LE from a base64-encoded BLE value
export function parseUint32LE(base64: string): number {
  const bytes = atob(base64);
  return (
    (bytes.charCodeAt(0) |
      (bytes.charCodeAt(1) << 8) |
      (bytes.charCodeAt(2) << 16) |
      (bytes.charCodeAt(3) << 24)) >>> 0
  );
}

// Parse a uint8 from a base64-encoded BLE value
export function parseUint8(base64: string): number {
  return atob(base64).charCodeAt(0);
}

// Parse session stats packed struct (10 bytes)
export function parseSessionStats(base64: string): SessionStats {
  const bytes = atob(base64);
  return {
    durationMs:
      ((bytes.charCodeAt(0) |
        (bytes.charCodeAt(1) << 8) |
        (bytes.charCodeAt(2) << 16) |
        (bytes.charCodeAt(3) << 24)) >>> 0),
    alertCount: bytes.charCodeAt(4) | (bytes.charCodeAt(5) << 8),
    maxAlertLevel: bytes.charCodeAt(6),
    speechSegments: bytes.charCodeAt(7) | (bytes.charCodeAt(8) << 8),
    sensitivity: bytes.charCodeAt(9),
  };
}

// Encode thresholds as 8 bytes (4x uint16 LE, seconds) for BLE write
export function encodeThresholds(thresholds: AlertThresholds): string {
  const buf = new Uint8Array(8);
  const vals = [
    thresholds.gentleSec,
    thresholds.moderateSec,
    thresholds.urgentSec,
    thresholds.criticalSec,
  ];
  vals.forEach((v, i) => {
    buf[i * 2] = v & 0xff;
    buf[i * 2 + 1] = (v >> 8) & 0xff;
  });
  return btoa(String.fromCharCode(...buf));
}

// Encode a single uint8 for BLE write
export function encodeUint8(value: number): string {
  return btoa(String.fromCharCode(value & 0xff));
}

// --- Sync protocol helpers ---

/** Parse sync manifest response (10 bytes): pendingCount(u16) + oldestBootId(u32) + newestBootId(u32) */
export function parseSyncManifest(base64: string): { pendingCount: number; oldestBootId: number; newestBootId: number } {
  const bytes = atob(base64);
  return {
    pendingCount: bytes.charCodeAt(0) | (bytes.charCodeAt(1) << 8),
    oldestBootId: (bytes.charCodeAt(2) | (bytes.charCodeAt(3) << 8) | (bytes.charCodeAt(4) << 16) | (bytes.charCodeAt(5) << 24)) >>> 0,
    newestBootId: (bytes.charCodeAt(6) | (bytes.charCodeAt(7) << 8) | (bytes.charCodeAt(8) << 16) | (bytes.charCodeAt(9) << 24)) >>> 0,
  };
}

/** Parse a 32-byte SessionRecord from base64 BLE notification */
export function parseSessionRecord(base64: string): {
  bootId: number;
  deviceSessionSequence: number;
  startedAtMsSinceBoot: number;
  endedAtMsSinceBoot: number;
  mode: number;
  triggerSource: number;
  alertCount: number;
  maxAlert: number;
  speechSegments: number;
  sensitivity: number;
  syncStatus: number;
} {
  const bytes = atob(base64);
  return {
    bootId: (bytes.charCodeAt(0) | (bytes.charCodeAt(1) << 8) | (bytes.charCodeAt(2) << 16) | (bytes.charCodeAt(3) << 24)) >>> 0,
    deviceSessionSequence: bytes.charCodeAt(4) | (bytes.charCodeAt(5) << 8),
    startedAtMsSinceBoot: (bytes.charCodeAt(6) | (bytes.charCodeAt(7) << 8) | (bytes.charCodeAt(8) << 16) | (bytes.charCodeAt(9) << 24)) >>> 0,
    endedAtMsSinceBoot: (bytes.charCodeAt(10) | (bytes.charCodeAt(11) << 8) | (bytes.charCodeAt(12) << 16) | (bytes.charCodeAt(13) << 24)) >>> 0,
    mode: bytes.charCodeAt(14),
    triggerSource: bytes.charCodeAt(15),
    alertCount: bytes.charCodeAt(16) | (bytes.charCodeAt(17) << 8),
    maxAlert: bytes.charCodeAt(18),
    speechSegments: bytes.charCodeAt(19) | (bytes.charCodeAt(20) << 8),
    sensitivity: bytes.charCodeAt(21),
    syncStatus: bytes.charCodeAt(22),
  };
}

/** Encode sync ack command: 0x03 + bootId(4 LE) + sequence(2 LE) = 7 bytes */
export function encodeSyncAck(bootId: number, sequence: number): string {
  const buf = new Uint8Array(7);
  buf[0] = 0x03;
  buf[1] = bootId & 0xFF;
  buf[2] = (bootId >> 8) & 0xFF;
  buf[3] = (bootId >> 16) & 0xFF;
  buf[4] = (bootId >> 24) & 0xFF;
  buf[5] = sequence & 0xFF;
  buf[6] = (sequence >> 8) & 0xFF;
  return btoa(String.fromCharCode(...buf));
}
