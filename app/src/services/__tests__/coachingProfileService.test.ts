import {
  computeProfileThresholds,
  getProfileLabel,
  PROFILE_MULTIPLIERS,
  THRESHOLD_FLOORS,
  THRESHOLD_CEILINGS,
} from '../coachingProfileService';
import type { AlertThresholds } from '../../types';

const DEFAULT_BASE: AlertThresholds = {
  gentleSec: 7,
  moderateSec: 15,
  urgentSec: 30,
  criticalSec: 60,
};

describe('computeProfileThresholds', () => {
  test('solo returns base thresholds unchanged', () => {
    const result = computeProfileThresholds('solo', DEFAULT_BASE);
    expect(result).toEqual(DEFAULT_BASE);
  });

  test('with_others applies per-threshold multipliers', () => {
    const result = computeProfileThresholds('with_others', DEFAULT_BASE);
    expect(result).toEqual({
      gentleSec: 5,
      moderateSec: 11,
      urgentSec: 20,
      criticalSec: 45,
    });
  });

  test('presentation applies per-threshold multipliers', () => {
    const result = computeProfileThresholds('presentation', DEFAULT_BASE);
    expect(result).toEqual({
      gentleSec: 21,
      moderateSec: 45,
      urgentSec: 90,
      criticalSec: 180,
    });
  });

  test('floor clamping activates when derived value is too low', () => {
    const aggressive: AlertThresholds = {
      gentleSec: 3,
      moderateSec: 6,
      urgentSec: 14,
      criticalSec: 20,
    };
    const result = computeProfileThresholds('with_others', aggressive);
    expect(result.gentleSec).toBe(3);
    expect(result.moderateSec).toBe(5);
    expect(result.urgentSec).toBe(10);
    expect(result.criticalSec).toBe(15);
  });

  test('ceiling clamping activates when derived value is too high', () => {
    const loose: AlertThresholds = {
      gentleSec: 15,
      moderateSec: 25,
      urgentSec: 50,
      criticalSec: 120,
    };
    const result = computeProfileThresholds('presentation', loose);
    expect(result.gentleSec).toBe(30);
    expect(result.moderateSec).toBe(60);
    expect(result.urgentSec).toBe(120);
    expect(result.criticalSec).toBe(300);
  });

  test('monotonic enforcement fixes non-increasing sequences after clamping', () => {
    const tiny: AlertThresholds = {
      gentleSec: 3,
      moderateSec: 4,
      urgentSec: 5,
      criticalSec: 6,
    };
    const result = computeProfileThresholds('with_others', tiny);
    expect(result.gentleSec).toBeLessThan(result.moderateSec);
    expect(result.moderateSec).toBeLessThan(result.urgentSec);
    expect(result.urgentSec).toBeLessThan(result.criticalSec);
  });

  test('monotonic enforcement bumps when clamped values collide', () => {
    const collider: AlertThresholds = {
      gentleSec: 4,
      moderateSec: 5,
      urgentSec: 15,
      criticalSec: 20,
    };
    const result = computeProfileThresholds('with_others', collider);
    expect(result.gentleSec).toBeLessThan(result.moderateSec);
    expect(result.moderateSec).toBeLessThan(result.urgentSec);
    expect(result.urgentSec).toBeLessThan(result.criticalSec);
  });

  test('all base thresholds at minimum produce valid ladder', () => {
    const min: AlertThresholds = {
      gentleSec: 3,
      moderateSec: 5,
      urgentSec: 10,
      criticalSec: 15,
    };
    for (const ctx of ['solo', 'with_others', 'presentation'] as const) {
      const result = computeProfileThresholds(ctx, min);
      expect(result.gentleSec).toBeLessThan(result.moderateSec);
      expect(result.moderateSec).toBeLessThan(result.urgentSec);
      expect(result.urgentSec).toBeLessThan(result.criticalSec);
    }
  });

  test('all base thresholds at maximum produce valid ladder', () => {
    const max: AlertThresholds = {
      gentleSec: 30,
      moderateSec: 60,
      urgentSec: 120,
      criticalSec: 300,
    };
    for (const ctx of ['solo', 'with_others', 'presentation'] as const) {
      const result = computeProfileThresholds(ctx, max);
      expect(result.gentleSec).toBeLessThan(result.moderateSec);
      expect(result.moderateSec).toBeLessThan(result.urgentSec);
      expect(result.urgentSec).toBeLessThan(result.criticalSec);
    }
  });
});

describe('getProfileLabel', () => {
  test('returns correct labels', () => {
    expect(getProfileLabel('solo')).toBe('Standard alerts');
    expect(getProfileLabel('with_others')).toBe('Tighter alerts');
    expect(getProfileLabel('presentation')).toBe('Relaxed alerts');
  });
});
