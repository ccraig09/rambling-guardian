import { create } from 'zustand';
import { AlertLevel, AlertModality, ConnectionState, DeviceMode, type DeviceState } from '../types';

interface DeviceStore extends DeviceState {
  connectionState: ConnectionState;
  lastDeviceId: string | null;
  updateDevice: (partial: Partial<DeviceState>) => void;
  setConnected: (connected: boolean) => void;
  setConnectionState: (state: ConnectionState) => void;
  setLastDeviceId: (id: string | null) => void;
  reset: () => void;
}

const initialState: DeviceState & { connectionState: ConnectionState; lastDeviceId: string | null } = {
  alertLevel: AlertLevel.NONE,
  speechDuration: 0,
  mode: DeviceMode.MONITORING,
  sensitivity: 0,
  battery: 100,
  modality: AlertModality.BOTH,
  connected: false,
  connectionState: ConnectionState.IDLE,
  lastDeviceId: null,
};

export const useDeviceStore = create<DeviceStore>((set) => ({
  ...initialState,
  updateDevice: (partial) => set(partial),
  setConnected: (connected) => set({ connected }),
  setConnectionState: (state) =>
    set({ connectionState: state, connected: state === ConnectionState.CONNECTED }),
  setLastDeviceId: (id) => set({ lastDeviceId: id }),
  reset: () => set(initialState),
}));
