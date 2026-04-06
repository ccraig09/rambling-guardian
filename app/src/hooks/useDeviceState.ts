/**
 * React hooks for BLE device state and session stats.
 *
 * useDeviceState — reactive DeviceState from the Zustand store (updated by bleManager).
 * useSessionStats — session stats pushed via BLE notifications.
 */
import { useEffect, useState } from 'react';
import { useDeviceStore } from '../stores/deviceStore';
import { bleService } from '../services/bleManager';
import type { DeviceState, SessionStats } from '../types';

/** Returns reactive device state. Components re-render on any field change. */
export function useDeviceState(): DeviceState {
  const { updateDevice, setConnected, reset, ...state } = useDeviceStore();
  return state;
}

/** Returns the latest session stats pushed by the device (null until first notification). */
export function useSessionStats(): SessionStats | null {
  const [stats, setStats] = useState<SessionStats | null>(null);

  useEffect(() => {
    return bleService.onStatsUpdate(setStats);
  }, []);

  return stats;
}
