import { useSessionStore } from '../../stores/sessionStore';
import { useSettingsStore } from '../../stores/settingsStore';
import {
  computeProfileThresholds,
  applyProfileForCurrentContext,
} from '../coachingProfileService';
import { bleService } from '../bleManager';
import type { AlertThresholds } from '../../types';

// Mock db/settings so settingsStore doesn't pull in expo-sqlite
jest.mock('../../db/settings', () => ({
  saveSetting: jest.fn(async () => {}),
  loadAllSettings: jest.fn(async () => new Map()),
  saveSettings: jest.fn(async () => {}),
}));

// Mock BLE — we test coordinator logic, not actual BLE writes
const mockWriteThresholds = jest.fn().mockResolvedValue(undefined);
jest.mock('../bleManager', () => ({
  bleService: {
    writeThresholds: (...args: unknown[]) => mockWriteThresholds(...args),
  },
}));

const SOLO_BASE: AlertThresholds = {
  gentleSec: 7,
  moderateSec: 15,
  urgentSec: 30,
  criticalSec: 60,
};

describe('coaching profile coordinator', () => {
  beforeEach(() => {
    useSessionStore.getState().resetContext();
    useSessionStore.getState().resetProfile();
    mockWriteThresholds.mockClear();
    mockWriteThresholds.mockResolvedValue(undefined);
  });

  test('activeProfile is null before any session', () => {
    expect(useSessionStore.getState().activeProfile).toBeNull();
    expect(useSessionStore.getState().lastProfileWriteTime).toBeNull();
  });

  test('resetProfile clears activeProfile and lastProfileWriteTime', () => {
    const derived = computeProfileThresholds('presentation', SOLO_BASE);
    useSessionStore.getState().setActiveProfile(derived);
    useSessionStore.getState().setLastProfileWriteTime(Date.now());

    useSessionStore.getState().resetProfile();

    expect(useSessionStore.getState().activeProfile).toBeNull();
    expect(useSessionStore.getState().lastProfileWriteTime).toBeNull();
  });

  test('applyProfileForCurrentContext writes derived thresholds on context change', async () => {
    useSessionStore.getState().setSessionContext('with_others');
    await applyProfileForCurrentContext();

    expect(mockWriteThresholds).toHaveBeenCalledTimes(1);
    const written = mockWriteThresholds.mock.calls[0][0] as AlertThresholds;
    expect(written.gentleSec).toBe(5); // 7*0.7=4.9→5
    expect(useSessionStore.getState().activeProfile).toEqual(written);
  });

  test('identical derived thresholds skip BLE write', async () => {
    // Set context and apply once
    useSessionStore.getState().setSessionContext('solo');
    await applyProfileForCurrentContext();
    expect(mockWriteThresholds).toHaveBeenCalledTimes(1);

    // Apply again with same context — should skip
    mockWriteThresholds.mockClear();
    await applyProfileForCurrentContext();
    expect(mockWriteThresholds).not.toHaveBeenCalled();
  });

  test('stability guard suppresses rapid context-triggered writes', async () => {
    // First write
    useSessionStore.getState().setSessionContext('with_others');
    await applyProfileForCurrentContext();
    expect(mockWriteThresholds).toHaveBeenCalledTimes(1);

    // Change context immediately — stability guard should suppress
    mockWriteThresholds.mockClear();
    useSessionStore.getState().setSessionContext('presentation');
    await applyProfileForCurrentContext(); // no bypassStabilityGuard
    expect(mockWriteThresholds).not.toHaveBeenCalled();
  });

  test('manual override bypasses stability guard', async () => {
    // First write to set lastProfileWriteTime
    useSessionStore.getState().setSessionContext('with_others');
    await applyProfileForCurrentContext();

    // Override immediately — should bypass stability guard
    mockWriteThresholds.mockClear();
    useSessionStore.getState().setSessionContext('presentation');
    await applyProfileForCurrentContext({ bypassStabilityGuard: true });
    expect(mockWriteThresholds).toHaveBeenCalledTimes(1);
    const written = mockWriteThresholds.mock.calls[0][0] as AlertThresholds;
    expect(written.gentleSec).toBe(21); // 7*3.0
  });

  test('failed BLE write does not update activeProfile', async () => {
    useSessionStore.getState().setSessionContext('with_others');
    await applyProfileForCurrentContext();
    const successfulProfile = useSessionStore.getState().activeProfile;

    // Next write will fail
    mockWriteThresholds.mockRejectedValueOnce(new Error('BLE disconnected'));
    useSessionStore.getState().setSessionContext('presentation');
    await applyProfileForCurrentContext({ bypassStabilityGuard: true });

    // activeProfile should still be the last successful write
    expect(useSessionStore.getState().activeProfile).toEqual(successfulProfile);
  });

  test('store updates only on successful BLE write', async () => {
    // Fail the first write
    mockWriteThresholds.mockRejectedValueOnce(new Error('BLE error'));
    useSessionStore.getState().setSessionContext('with_others');
    await applyProfileForCurrentContext();

    // Store should NOT have been updated
    expect(useSessionStore.getState().activeProfile).toBeNull();
    expect(useSessionStore.getState().lastProfileWriteTime).toBeNull();
  });
});
