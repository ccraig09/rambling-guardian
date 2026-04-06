import { create } from 'zustand';
import { AlertLevel, AlertModality, DeviceMode, type DeviceState } from '../types';

interface DeviceStore extends DeviceState {
  updateDevice: (partial: Partial<DeviceState>) => void;
  setConnected: (connected: boolean) => void;
  reset: () => void;
}

const initialState: DeviceState = {
  alertLevel: AlertLevel.NONE,
  speechDuration: 0,
  mode: DeviceMode.MONITORING,
  sensitivity: 0,
  battery: 100,
  modality: AlertModality.BOTH,
  connected: false,
};

export const useDeviceStore = create<DeviceStore>((set) => ({
  ...initialState,
  updateDevice: (partial) => set(partial),
  setConnected: (connected) => set({ connected }),
  reset: () => set(initialState),
}));
