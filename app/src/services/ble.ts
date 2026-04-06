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
