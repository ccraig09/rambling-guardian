/**
 * BLE Connection Manager — singleton service for scanning, connecting,
 * subscribing to GATT notifications, and exposing device state.
 *
 * Pushes all state updates through the Zustand deviceStore so every
 * subscriber (Home tab, Session tab, Settings, etc.) stays in sync.
 */
import { BleManager, Device, State } from 'react-native-ble-plx';
import {
  parseUint8,
  parseUint32LE,
  parseSessionStats,
  encodeThresholds,
  encodeUint8,
} from './ble';
import type { DeviceState, SessionStats, AlertThresholds } from '../types';
import { AlertLevel, AppSessionState, ConnectionState, DeviceMode, AlertModality } from '../types';
import { useDeviceStore } from '../stores/deviceStore';
import { saveSetting } from '../db/settings';
import { clearSyncCheckpoint } from './syncEngine';

// --- GATT UUIDs ---
const SERVICE_UUID = '4A980001-1CC4-E7C1-C757-F1267DD021E8';
const CHR = {
  ALERT_LEVEL:   '4A980002-1CC4-E7C1-C757-F1267DD021E8',
  SPEECH_DUR:    '4A980003-1CC4-E7C1-C757-F1267DD021E8',
  DEVICE_MODE:   '4A980004-1CC4-E7C1-C757-F1267DD021E8',
  SENSITIVITY:   '4A980005-1CC4-E7C1-C757-F1267DD021E8',
  BATTERY:       '4A980006-1CC4-E7C1-C757-F1267DD021E8',
  SESSION_STATS: '4A980007-1CC4-E7C1-C757-F1267DD021E8',
  THRESHOLDS:    '4A980008-1CC4-E7C1-C757-F1267DD021E8',
  MODALITY:      '4A980009-1CC4-E7C1-C757-F1267DD021E8',
  DEVICE_INFO:   '4A98000A-1CC4-E7C1-C757-F1267DD021E8',
  SESSION_CTRL:  '4A98000B-1CC4-E7C1-C757-F1267DD021E8',
  SYNC_DATA:     '4A98000C-1CC4-E7C1-C757-F1267DD021E8',
} as const;

type StatsListener = (stats: SessionStats) => void;

class BLEService {
  private manager: BleManager;
  private device: Device | null = null;
  private statsListeners: Set<StatsListener> = new Set();
  private scanning = false;
  private connecting = false; // Guards against parallel connect attempts
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  // Session control: confirmation timeout + retry tracking
  private sessionConfirmTimer: ReturnType<typeof setTimeout> | null = null;
  private sessionRetryCount = 0;
  // Tracks last-known battery level so we can detect threshold crossings
  // null = USB power (no battery installed)
  private currentBattery: number | null = null;
  // Subscription tracking for cleanup
  private subscriptions: { remove: () => void }[] = [];
  // Intentional disconnect flag — suppresses auto-reconnect
  private intentionalDisconnect = false;
  // Battery freshness tracking
  private lastBatteryReadAt = 0;

  constructor() {
    this.manager = new BleManager();
  }

  /** Get current device state snapshot from the store. */
  getState(): DeviceState {
    const {
      updateDevice, setConnected, setConnectionState, setLastDeviceId, reset,
      connectionState, lastDeviceId,
      ...state
    } = useDeviceStore.getState();
    return state;
  }

  /** Subscribe to session stats updates. Returns unsubscribe function. */
  onStatsUpdate(listener: StatsListener): () => void {
    this.statsListeners.add(listener);
    return () => { this.statsListeners.delete(listener); };
  }

  /** Push partial state into the Zustand store (notifies all React subscribers). */
  private updateState(partial: Partial<DeviceState>) {
    // Check for battery crossing the 20 % warning threshold before updating
    if ('battery' in partial && partial.battery !== undefined) {
      const prev = this.currentBattery;
      const next = partial.battery;
      this.currentBattery = next;
      // Skip low-battery check when on USB power (null) — no battery to warn about
      if (next === null || prev === null) {
        // noop — can't cross a threshold without real battery values on both sides
      } else if (prev > 20 && next <= 20) {
        // Fire once per crossing (prev > 20 and next <= 20), not on every tick
        import('./notifications')
          .then(({ sendLowBatteryNotification }) => {
            sendLowBatteryNotification(next).catch(console.warn);
          })
          .catch(console.warn);
      }
    }
    useDeviceStore.getState().updateDevice(partial);
  }

  // -------------------------------------------------------------------
  // Subscription cleanup
  // -------------------------------------------------------------------

  private cleanupSubscriptions(): void {
    for (const sub of this.subscriptions) sub.remove();
    this.subscriptions = [];
  }

  // -------------------------------------------------------------------
  // Scanning + Connection
  // -------------------------------------------------------------------

  /** Cancel any pending reconnect timer. */
  private cancelReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  /** Scan for the RamblingGuard device and connect. */
  async scanAndConnect(): Promise<void> {
    console.log('[BLE] scanAndConnect called — scanning:', this.scanning, 'connecting:', this.connecting, 'device:', !!this.device);
    if (this.scanning || this.connecting) {
      console.log('[BLE] Already scanning/connecting, returning');
      return;
    }

    const store = useDeviceStore.getState();
    store.setConnectionState(ConnectionState.SCANNING);

    // Wait for BLE to be powered on (up to 5 s)
    try {
      const bleState = await this.manager.state();
      console.log('[BLE] Adapter state:', bleState);
      if (bleState !== State.PoweredOn) {
        console.log('[BLE] Waiting for PoweredOn...');
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(
            () => reject(new Error('Bluetooth not available')),
            5000,
          );
          const sub = this.manager.onStateChange((state) => {
            if (state === State.PoweredOn) {
              clearTimeout(timeout);
              sub.remove();
              resolve();
            }
          }, true);
        });
      }
    } catch (e) {
      console.log('[BLE] Power-on check failed:', e);
      useDeviceStore.getState().setConnectionState(ConnectionState.FAILED);
      throw e;
    }

    this.scanning = true;
    console.log('[BLE] Starting device scan...');

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        console.log('[BLE] Scan timeout (15s) — no device found');
        this.manager.stopDeviceScan();
        this.scanning = false;
        useDeviceStore.getState().setConnectionState(ConnectionState.FAILED);
        reject(new Error('Device not found. Make sure RamblingGuard is powered on.'));
      }, 15_000);

      this.manager.startDeviceScan(
        [SERVICE_UUID],
        { allowDuplicates: false },
        async (error, scannedDevice) => {
          if (error) {
            console.log('[BLE] Scan error:', error.message, 'reason:', error.reason);
            clearTimeout(timeout);
            this.scanning = false;
            useDeviceStore.getState().setConnectionState(ConnectionState.FAILED);
            reject(error);
            return;
          }
          if (scannedDevice) {
            console.log('[BLE] Scanned device:', scannedDevice.name, scannedDevice.id);
          }
          if (scannedDevice?.name?.includes('RamblingGuard') && !this.connecting) {
            clearTimeout(timeout);
            this.manager.stopDeviceScan();
            this.scanning = false;
            this.connecting = true;
            console.log('[BLE] Found RamblingGuard! Connecting...');
            try {
              await this.connectToDevice(scannedDevice);
              resolve();
            } catch (e) {
              console.log('[BLE] connectToDevice failed:', e);
              useDeviceStore.getState().setConnectionState(ConnectionState.FAILED);
              reject(e);
            } finally {
              this.connecting = false;
            }
          }
        },
      );
    });
  }

  private async connectToDevice(device: Device): Promise<void> {
    console.log('[BLE] connectToDevice — id:', device.id, 'name:', device.name);
    useDeviceStore.getState().setConnectionState(ConnectionState.CONNECTING);

    try {
      console.log('[BLE] Calling device.connect...');
      const connected = await device.connect({ timeout: 10_000 });
      console.log('[BLE] Connected, discovering services...');
      await connected.discoverAllServicesAndCharacteristics();
      this.device = connected;
      console.log('[BLE] Services discovered, persisting device ID');

      // Persist device ID for reconnect
      const store = useDeviceStore.getState();
      store.setLastDeviceId(connected.id);
      saveSetting('lastDeviceId', connected.id).catch(console.warn);

      await this.setupPostConnection(connected);
      console.log('[BLE] Post-connection setup complete');
    } catch (e) {
      console.log('[BLE] connectToDevice error:', e);
      useDeviceStore.getState().setConnectionState(ConnectionState.FAILED);
      throw e;
    }
  }

  /** Shared post-connection setup: disconnect handler, initial reads, subscriptions. */
  private async setupPostConnection(device: Device): Promise<void> {
    // Monitor disconnection -> conditional auto-reconnect
    device.onDisconnected((error) => {
      console.log('[BLE] onDisconnected fired — intentional:', this.intentionalDisconnect, 'error:', error?.message ?? 'none');
      this.cleanupSubscriptions();
      this.device = null;
      this.connecting = false;
      useDeviceStore.getState().setConnectionState(ConnectionState.IDLE);
      if (!this.intentionalDisconnect) {
        // Cancel any existing timer before scheduling a new one
        this.cancelReconnectTimer();
        console.log('[BLE] Scheduling auto-reconnect in 3s');
        this.reconnectTimer = setTimeout(() => {
          this.reconnect().catch((e) => {
            console.log('[BLE] Auto-reconnect failed:', e);
          });
        }, 3000);
      }
      this.intentionalDisconnect = false;
    });

    await this.readInitialValues(device);
    await this.subscribeToNotifications(device);
    useDeviceStore.getState().setConnectionState(ConnectionState.CONNECTED);
  }

  // -------------------------------------------------------------------
  // Initial reads
  // -------------------------------------------------------------------

  private async readInitialValues(device: Device): Promise<void> {
    try {
      const [alertChr, durChr, modeChr, sensChr, batChr, modChr, sessionCtrlChr] = await Promise.all([
        device.readCharacteristicForService(SERVICE_UUID, CHR.ALERT_LEVEL),
        device.readCharacteristicForService(SERVICE_UUID, CHR.SPEECH_DUR),
        device.readCharacteristicForService(SERVICE_UUID, CHR.DEVICE_MODE),
        device.readCharacteristicForService(SERVICE_UUID, CHR.SENSITIVITY),
        device.readCharacteristicForService(SERVICE_UUID, CHR.BATTERY),
        device.readCharacteristicForService(SERVICE_UUID, CHR.MODALITY),
        device.readCharacteristicForService(SERVICE_UUID, CHR.SESSION_CTRL),
      ]);
      this.lastBatteryReadAt = Date.now();
      const rawBattery = batChr.value ? parseUint8(batChr.value) : null;
      const sessionCtrlVal = sessionCtrlChr.value ? parseUint8(sessionCtrlChr.value) : 0;
      this.updateState({
        alertLevel: alertChr.value ? parseUint8(alertChr.value) : AlertLevel.NONE,
        speechDuration: durChr.value ? parseUint32LE(durChr.value) : 0,
        mode: modeChr.value ? parseUint8(modeChr.value) : DeviceMode.IDLE,
        sensitivity: sensChr.value ? parseUint8(sensChr.value) : 0,
        battery: rawBattery === null || rawBattery === 255 ? null : rawBattery,
        modality: modChr.value ? parseUint8(modChr.value) : AlertModality.BOTH,
        sessionState: sessionCtrlVal === 0x01 ? AppSessionState.ACTIVE : AppSessionState.NO_SESSION,
      });
    } catch (e) {
      console.warn('[BLE] Failed to read initial values:', e);
    }
  }

  // -------------------------------------------------------------------
  // Notification subscriptions
  // -------------------------------------------------------------------

  private async subscribeToNotifications(device: Device): Promise<void> {
    this.subscriptions.push(
      device.monitorCharacteristicForService(SERVICE_UUID, CHR.ALERT_LEVEL, (_err, chr) => {
        if (chr?.value) this.updateState({ alertLevel: parseUint8(chr.value) });
      }),
    );

    this.subscriptions.push(
      device.monitorCharacteristicForService(SERVICE_UUID, CHR.SPEECH_DUR, (_err, chr) => {
        if (chr?.value) this.updateState({ speechDuration: parseUint32LE(chr.value) });
      }),
    );

    this.subscriptions.push(
      device.monitorCharacteristicForService(SERVICE_UUID, CHR.BATTERY, (_err, chr) => {
        if (chr?.value) {
          this.lastBatteryReadAt = Date.now();
          const raw = parseUint8(chr.value);
          this.updateState({ battery: raw === 255 ? null : raw });
        }
      }),
    );

    this.subscriptions.push(
      device.monitorCharacteristicForService(SERVICE_UUID, CHR.SESSION_STATS, (_err, chr) => {
        if (chr?.value) {
          const stats = parseSessionStats(chr.value);
          this.statsListeners.forEach((l) => l(stats));
        }
      }),
    );

    this.subscriptions.push(
      device.monitorCharacteristicForService(SERVICE_UUID, CHR.DEVICE_MODE, (_err, chr) => {
        if (chr?.value) this.updateState({ mode: parseUint8(chr.value) });
      }),
    );

    this.subscriptions.push(
      device.monitorCharacteristicForService(SERVICE_UUID, CHR.MODALITY, (_err, chr) => {
        if (chr?.value) this.updateState({ modality: parseUint8(chr.value) });
      }),
    );

    this.subscriptions.push(
      device.monitorCharacteristicForService(SERVICE_UUID, CHR.SESSION_CTRL, (_err, chr) => {
        if (chr?.value) {
          const val = parseUint8(chr.value);
          this.handleSessionCtrlNotify(val);
        }
      }),
    );
  }

  // -------------------------------------------------------------------
  // Session control helpers
  // -------------------------------------------------------------------

  private handleSessionCtrlNotify(val: number): void {
    // Clear any pending confirmation timeout
    if (this.sessionConfirmTimer) {
      clearTimeout(this.sessionConfirmTimer);
      this.sessionConfirmTimer = null;
    }
    this.sessionRetryCount = 0;

    const store = useDeviceStore.getState();
    if (val === 0x01) {
      // Device confirmed active session
      store.updateDevice({ sessionState: AppSessionState.ACTIVE });
      console.log('[BLE] Session confirmed: ACTIVE');
    } else {
      // Device confirmed idle (0x00 or any non-0x01)
      store.updateDevice({ sessionState: AppSessionState.NO_SESSION });
      console.log('[BLE] Session confirmed: NO_SESSION');
    }
  }

  private async handleSessionConfirmTimeout(command: number): Promise<void> {
    this.sessionConfirmTimer = null;

    if (this.sessionRetryCount < 1) {
      // Retry once
      this.sessionRetryCount++;
      console.warn(`[BLE] Session ${command === 0x01 ? 'start' : 'stop'} confirmation timeout — retrying`);

      try {
        if (this.device) {
          await this.device.writeCharacteristicWithResponseForService(
            SERVICE_UUID, CHR.SESSION_CTRL, encodeUint8(command),
          );
          this.sessionConfirmTimer = setTimeout(() => {
            this.handleSessionConfirmTimeout(command);
          }, 3000);
        }
      } catch (e) {
        console.warn('[BLE] Session retry write failed:', e);
        // Give up — fall through to fallback below
        this.sessionRetryCount = 99; // force fallback
        this.handleSessionConfirmTimeout(command);
      }
      return;
    }

    // Gave up after retry — best-effort fallback
    console.warn(`[BLE] Session ${command === 0x01 ? 'start' : 'stop'} confirmation failed after retry`);
    const store = useDeviceStore.getState();

    if (command === 0x01) {
      // Start failed — return to NO_SESSION
      store.updateDevice({ sessionState: AppSessionState.NO_SESSION });
    } else {
      // Stop failed — best-effort: finalize with last known stats.
      // This is a best-effort recovery path, not guaranteed truth.
      // Device-confirmed state is the source of truth when available.
      store.updateDevice({ sessionState: AppSessionState.NO_SESSION });
    }
  }

  // -------------------------------------------------------------------
  // Writes
  // -------------------------------------------------------------------

  /** Write sensitivity (0-3) to device. */
  async writeSensitivity(value: number): Promise<void> {
    if (!this.device) throw new Error('Not connected');
    const encoded = encodeUint8(value);
    await this.device.writeCharacteristicWithResponseForService(
      SERVICE_UUID, CHR.SENSITIVITY, encoded,
    );
    this.updateState({ sensitivity: value });
  }

  /** Write alert modality to device. */
  async writeModality(value: AlertModality): Promise<void> {
    if (!this.device) throw new Error('Not connected');
    const encoded = encodeUint8(value);
    await this.device.writeCharacteristicWithResponseForService(
      SERVICE_UUID, CHR.MODALITY, encoded,
    );
    this.updateState({ modality: value });
  }

  /** Write thresholds to device. */
  async writeThresholds(thresholds: AlertThresholds): Promise<void> {
    if (!this.device) throw new Error('Not connected');
    const encoded = encodeThresholds(thresholds);
    await this.device.writeCharacteristicWithResponseForService(
      SERVICE_UUID, CHR.THRESHOLDS, encoded,
    );
  }

  /** Request device to start a session. App enters STARTING state, waits for device confirmation. */
  async startSession(): Promise<void> {
    if (!this.device) throw new Error('Not connected');

    const store = useDeviceStore.getState();
    if (store.sessionState === AppSessionState.ACTIVE || store.sessionState === AppSessionState.STARTING) {
      console.log('[BLE] startSession ignored — already', store.sessionState);
      return;
    }

    store.updateDevice({ sessionState: AppSessionState.STARTING });
    this.sessionRetryCount = 0;

    try {
      await this.device.writeCharacteristicWithResponseForService(
        SERVICE_UUID, CHR.SESSION_CTRL, encodeUint8(0x01),
      );
      console.log('[BLE] Session start command sent');
    } catch (e) {
      console.warn('[BLE] Session start write failed:', e);
      store.updateDevice({ sessionState: AppSessionState.NO_SESSION });
      throw e;
    }

    // Wait for device confirmation (3s timeout + 1 retry)
    this.sessionConfirmTimer = setTimeout(() => {
      this.handleSessionConfirmTimeout(0x01);
    }, 3000);
  }

  /** Request device to stop the session. App enters STOPPING state, waits for device confirmation. */
  async stopSession(): Promise<void> {
    if (!this.device) throw new Error('Not connected');

    const store = useDeviceStore.getState();
    if (store.sessionState === AppSessionState.NO_SESSION || store.sessionState === AppSessionState.STOPPING) {
      console.log('[BLE] stopSession ignored — already', store.sessionState);
      return;
    }

    store.updateDevice({ sessionState: AppSessionState.STOPPING });
    this.sessionRetryCount = 0;

    try {
      await this.device.writeCharacteristicWithResponseForService(
        SERVICE_UUID, CHR.SESSION_CTRL, encodeUint8(0x02),
      );
      console.log('[BLE] Session stop command sent');
    } catch (e) {
      console.warn('[BLE] Session stop write failed:', e);
      // Fallback: finalize with last known stats
      store.updateDevice({ sessionState: AppSessionState.NO_SESSION });
      throw e;
    }

    this.sessionConfirmTimer = setTimeout(() => {
      this.handleSessionConfirmTimeout(0x02);
    }, 3000);
  }

  // -------------------------------------------------------------------
  // Reconnect + Forget
  // -------------------------------------------------------------------

  /** Attempt to reconnect — tries direct connect to last device first, falls back to scan. */
  async reconnect(): Promise<void> {
    if (this.connecting || this.scanning) {
      console.log('[BLE] reconnect skipped — already connecting/scanning');
      return;
    }
    this.cancelReconnectTimer();
    const lastId = useDeviceStore.getState().lastDeviceId;
    console.log('[BLE] reconnect — lastDeviceId:', lastId);
    if (lastId) {
      this.connecting = true;
      try {
        useDeviceStore.getState().setConnectionState(ConnectionState.CONNECTING);
        console.log('[BLE] Trying direct connect to', lastId);
        const device = await this.manager.connectToDevice(lastId, { timeout: 10_000 });
        console.log('[BLE] Direct connect succeeded, discovering services...');
        await device.discoverAllServicesAndCharacteristics();
        this.device = device;
        await this.setupPostConnection(device);
        console.log('[BLE] Reconnect complete');
      } catch (e) {
        console.log('[BLE] Direct connect failed:', e, '— falling back to scan');
        this.connecting = false;
        // Fall back to full scan
        await this.scanAndConnect();
      } finally {
        this.connecting = false;
      }
    } else {
      console.log('[BLE] No saved device ID, doing full scan');
      await this.scanAndConnect();
    }
  }

  /** Disconnect and erase saved device — user must re-scan to pair. */
  async forgetDevice(): Promise<void> {
    await this.disconnect();
    useDeviceStore.getState().setLastDeviceId(null);
    saveSetting('lastDeviceId', '').catch(console.warn);
    clearSyncCheckpoint().catch(console.warn);
  }

  /** How stale is the last battery reading (ms). Returns Infinity if never read. */
  getBatteryAge(): number {
    return this.lastBatteryReadAt > 0 ? Date.now() - this.lastBatteryReadAt : Infinity;
  }

  // -------------------------------------------------------------------
  // Teardown
  // -------------------------------------------------------------------

  /** Intentionally disconnect from device. Suppresses auto-reconnect. */
  async disconnect(): Promise<void> {
    this.intentionalDisconnect = true;
    this.cancelReconnectTimer();
    if (this.sessionConfirmTimer) {
      clearTimeout(this.sessionConfirmTimer);
      this.sessionConfirmTimer = null;
    }
    this.connecting = false;
    this.cleanupSubscriptions();
    if (this.device) {
      try {
        await this.device.cancelConnection();
      } catch {
        // Device may already be disconnected — safe to ignore
      }
      this.device = null;
    }
    useDeviceStore.getState().setConnectionState(ConnectionState.IDLE);
  }

  isConnected(): boolean {
    return useDeviceStore.getState().connected;
  }

  isScanning(): boolean {
    return this.scanning;
  }

  destroy() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.cleanupSubscriptions();
    this.manager.destroy();
  }
}

/** Singleton — import this everywhere. */
export const bleService = new BLEService();
