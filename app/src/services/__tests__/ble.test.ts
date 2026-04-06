import {
  parseUint8,
  parseUint32LE,
  parseSessionStats,
  encodeThresholds,
  encodeUint8,
} from '../ble';

// Helper: encode raw bytes to base64
function bytesToBase64(bytes: number[]): string {
  return btoa(String.fromCharCode(...bytes));
}

describe('BLE parsing utilities', () => {
  describe('parseUint8', () => {
    it('parses 0', () => {
      expect(parseUint8(bytesToBase64([0]))).toBe(0);
    });

    it('parses 255', () => {
      expect(parseUint8(bytesToBase64([255]))).toBe(255);
    });

    it('parses alert level 3 (URGENT)', () => {
      expect(parseUint8(bytesToBase64([3]))).toBe(3);
    });

    it('parses battery 87%', () => {
      expect(parseUint8(bytesToBase64([87]))).toBe(87);
    });
  });

  describe('parseUint32LE', () => {
    it('parses 0', () => {
      expect(parseUint32LE(bytesToBase64([0, 0, 0, 0]))).toBe(0);
    });

    it('parses 7000ms (ALERT_GENTLE threshold)', () => {
      // 7000 = 0x00001B58 → LE bytes: 0x58, 0x1B, 0x00, 0x00
      expect(parseUint32LE(bytesToBase64([0x58, 0x1b, 0x00, 0x00]))).toBe(7000);
    });

    it('parses 60000ms (ALERT_CRITICAL threshold)', () => {
      // 60000 = 0x0000EA60 → LE bytes: 0x60, 0xEA, 0x00, 0x00
      expect(parseUint32LE(bytesToBase64([0x60, 0xea, 0x00, 0x00]))).toBe(60000);
    });

    it('handles high bit correctly (unsigned)', () => {
      // 0xFFFFFFFF = 4294967295 (max uint32)
      expect(parseUint32LE(bytesToBase64([0xff, 0xff, 0xff, 0xff]))).toBe(4294967295);
    });

    it('handles values above 0x7FFFFFFF (sign bit)', () => {
      // 0x80000000 = 2147483648
      expect(parseUint32LE(bytesToBase64([0x00, 0x00, 0x00, 0x80]))).toBe(2147483648);
    });
  });

  describe('parseSessionStats', () => {
    it('parses a valid 10-byte session stats struct', () => {
      // duration: 15000ms (0x00003A98), alerts: 3, maxAlert: 2, segments: 5, sensitivity: 1
      const bytes = [
        0x98, 0x3a, 0x00, 0x00, // duration LE
        0x03, 0x00,             // alert count LE
        0x02,                   // max alert
        0x05, 0x00,             // segments LE
        0x01,                   // sensitivity
      ];

      const stats = parseSessionStats(bytesToBase64(bytes));
      expect(stats.durationMs).toBe(15000);
      expect(stats.alertCount).toBe(3);
      expect(stats.maxAlertLevel).toBe(2);
      expect(stats.speechSegments).toBe(5);
      expect(stats.sensitivity).toBe(1);
    });

    it('parses zero session', () => {
      const bytes = new Array(10).fill(0);
      const stats = parseSessionStats(bytesToBase64(bytes));
      expect(stats.durationMs).toBe(0);
      expect(stats.alertCount).toBe(0);
      expect(stats.maxAlertLevel).toBe(0);
      expect(stats.speechSegments).toBe(0);
      expect(stats.sensitivity).toBe(0);
    });
  });

  describe('encodeThresholds', () => {
    it('encodes default thresholds', () => {
      const encoded = encodeThresholds({
        gentleSec: 7,
        moderateSec: 15,
        urgentSec: 30,
        criticalSec: 60,
      });

      // Decode and verify
      const decoded = atob(encoded);
      expect(decoded.charCodeAt(0) | (decoded.charCodeAt(1) << 8)).toBe(7);
      expect(decoded.charCodeAt(2) | (decoded.charCodeAt(3) << 8)).toBe(15);
      expect(decoded.charCodeAt(4) | (decoded.charCodeAt(5) << 8)).toBe(30);
      expect(decoded.charCodeAt(6) | (decoded.charCodeAt(7) << 8)).toBe(60);
    });

    it('round-trips through parse', () => {
      const thresholds = {
        gentleSec: 10,
        moderateSec: 20,
        urgentSec: 45,
        criticalSec: 90,
      };
      const encoded = encodeThresholds(thresholds);
      const decoded = atob(encoded);

      expect(decoded.charCodeAt(0) | (decoded.charCodeAt(1) << 8)).toBe(10);
      expect(decoded.charCodeAt(2) | (decoded.charCodeAt(3) << 8)).toBe(20);
      expect(decoded.charCodeAt(4) | (decoded.charCodeAt(5) << 8)).toBe(45);
      expect(decoded.charCodeAt(6) | (decoded.charCodeAt(7) << 8)).toBe(90);
    });
  });

  describe('encodeUint8', () => {
    it('encodes 0', () => {
      const decoded = atob(encodeUint8(0));
      expect(decoded.charCodeAt(0)).toBe(0);
    });

    it('encodes sensitivity level 3', () => {
      const decoded = atob(encodeUint8(3));
      expect(decoded.charCodeAt(0)).toBe(3);
    });

    it('clamps to byte range', () => {
      const decoded = atob(encodeUint8(256));
      expect(decoded.charCodeAt(0)).toBe(0); // 256 & 0xFF = 0
    });
  });
});
