import { formatOffset, formatDuration, formatTotalTime } from '../timeFormat';

describe('formatOffset', () => {
  test('0ms returns 0:00', () => expect(formatOffset(0)).toBe('0:00'));
  test('7500ms returns 0:07', () => expect(formatOffset(7500)).toBe('0:07'));
  test('65000ms returns 1:05', () => expect(formatOffset(65000)).toBe('1:05'));
  test('3600000ms returns 60:00', () => expect(formatOffset(3600000)).toBe('60:00'));
});

describe('formatDuration', () => {
  test('0ms returns 0s', () => expect(formatDuration(0)).toBe('0s'));
  test('5000ms returns 5s', () => expect(formatDuration(5000)).toBe('5s'));
  test('65000ms returns 1m 5s', () => expect(formatDuration(65000)).toBe('1m 5s'));
  test('120000ms returns 2m 0s', () => expect(formatDuration(120000)).toBe('2m 0s'));
});

describe('formatTotalTime', () => {
  test('0ms returns 0m', () => expect(formatTotalTime(0)).toBe('0m'));
  test('30 minutes returns 30m', () => expect(formatTotalTime(1800000)).toBe('30m'));
  test('90 minutes returns 1h 30m', () => expect(formatTotalTime(5400000)).toBe('1h 30m'));
  test('120 minutes returns 2h', () => expect(formatTotalTime(7200000)).toBe('2h'));
});
