import { useDeviceStore } from '../deviceStore';
import { ConnectionState } from '../../types';

describe('deviceStore BLE state', () => {
  beforeEach(() => {
    useDeviceStore.getState().reset();
  });

  test('initial state is IDLE', () => {
    expect(useDeviceStore.getState().connectionState).toBe(ConnectionState.IDLE);
  });

  test('setConnectionState to CONNECTED sets connected: true', () => {
    useDeviceStore.getState().setConnectionState(ConnectionState.CONNECTED);
    const state = useDeviceStore.getState();
    expect(state.connectionState).toBe(ConnectionState.CONNECTED);
    expect(state.connected).toBe(true);
  });

  test('setConnectionState to IDLE sets connected: false', () => {
    useDeviceStore.getState().setConnectionState(ConnectionState.CONNECTED);
    useDeviceStore.getState().setConnectionState(ConnectionState.IDLE);
    expect(useDeviceStore.getState().connected).toBe(false);
  });

  test('setConnectionState to SCANNING sets connected: false', () => {
    useDeviceStore.getState().setConnectionState(ConnectionState.SCANNING);
    expect(useDeviceStore.getState().connected).toBe(false);
  });

  test('setConnectionState to FAILED sets connected: false', () => {
    useDeviceStore.getState().setConnectionState(ConnectionState.FAILED);
    expect(useDeviceStore.getState().connected).toBe(false);
  });

  test('setLastDeviceId persists', () => {
    useDeviceStore.getState().setLastDeviceId('test-device-123');
    expect(useDeviceStore.getState().lastDeviceId).toBe('test-device-123');
  });

  test('reset clears connectionState and lastDeviceId', () => {
    useDeviceStore.getState().setConnectionState(ConnectionState.CONNECTED);
    useDeviceStore.getState().setLastDeviceId('test-device');
    useDeviceStore.getState().reset();
    expect(useDeviceStore.getState().connectionState).toBe(ConnectionState.IDLE);
    expect(useDeviceStore.getState().lastDeviceId).toBeNull();
  });
});
