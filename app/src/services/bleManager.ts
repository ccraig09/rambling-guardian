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
import { AlertLevel, ConnectionState, DeviceMode, AlertModality } from '../types';
import { useDeviceStore } from '../stores/deviceStore';
import { saveSetting } from '../db/settings';

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
} as const;

type StatsListener = (stats: SessionStats) => void;

class BLEService {
  private manager: BleManager;
  private device: Device | null = null;
  private statsListeners: Set<StatsListener> = new Set();
  private scanning = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  // Tracks last-known battery level so we can detect threshold crossings
  private currentBattery = 100;
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
      // Fire once per crossing (prev > 20 and next <= 20), not on every tick
      if (prev > 20 && next <= 20) {
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

  /** Scan for the RamblingGuard device and connect. */
  async scanAndConnect(): Promise<void> {
    if (this.scanning) return;

    const store = useDeviceStore.getState();
    store.setConnectionState(ConnectionState.SCANNING);

    // Wait for BLE to be powered on (up to 5 s)
    const bleState = await this.manager.state();
    if (bleState !== State.PoweredOn) {
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

    this.scanning = true;

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
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
            clearTimeout(timeout);
            this.scanning = false;
            useDeviceStore.getState().setConnectionState(ConnectionState.FAILED);
            reject(error);
            return;
          }
          if (scannedDevice?.name?.includes('RamblingGuard')) {
            clearTimeout(timeout);
            this.manager.stopDeviceScan();
            this.scanning = false;
            try {
              await this.connectToDevice(scannedDevice);
              resolve();
            } catch (e) {
              useDeviceStore.getState().setConnectionState(ConnectionState.FAILED);
              reject(e);
            }
          }
        },
      );
    });
  }

  private async connectToDevice(device: Device): Promise<void> {
    useDeviceStore.getState().setConnectionState(ConnectionState.CONNECTING);

    try {
      const connected = await device.connect({ timeout: 10_000 });
      await connected.discoverAllServicesAndCharacteristics();
      this.device = connected;

      // Persist device ID for reconnect
      const store = useDeviceStore.getState();
      store.setLastDeviceId(connected.id);
      saveSetting('lastDeviceId', connected.id).catch(console.warn);

      // Monitor disconnection -> conditional auto-reconnect
      connected.onDisconnected(() => {
        this.cleanupSubscriptions();
        this.device = null;
        useDeviceStore.getState().setConnectionState(ConnectionState.IDLE);
        // Only auto-reconnect if disconnect was unexpected
        if (!this.intentionalDisconnect) {
          this.reconnectTimer = setTimeout(() => {
            this.scanAndConnect().catch(() => {
              console.log('[BLE] Reconnect failed');
            });
          }, 3000);
        }
        this.intentionalDisconnect = false;
      });

      // Bootstrap state from current characteristic values
      await this.readInitialValues(connected);

      // Subscribe to live notifications
      await this.subscribeToNotifications(connected);

      useDeviceStore.getState().setConnectionState(ConnectionState.CONNECTED);
    } catch (e) {
      useDeviceStore.getState().setConnectionState(ConnectionState.FAILED);
      throw e;
    }
  }

  // -------------------------------------------------------------------
  // Initial reads
  // -------------------------------------------------------------------

  private async readInitialValues(device: Device): Promise<void> {
    try {
      const [alertChr, durChr, modeChr, sensChr, batChr, modChr] = await Promise.all([
        device.readCharacteristicForService(SERVICE_UUID, CHR.ALERT_LEVEL),
        device.readCharacteristicForService(SERVICE_UUID, CHR.SPEECH_DUR),
        device.readCharacteristicForService(SERVICE_UUID, CHR.DEVICE_MODE),
        device.readCharacteristicForService(SERVICE_UUID, CHR.SENSITIVITY),
        device.readCharacteristicForService(SERVICE_UUID, CHR.BATTERY),
        device.readCharacteristicForService(SERVICE_UUID, CHR.MODALITY),
      ]);
      this.lastBatteryReadAt = Date.now();
      this.updateState({
        alertLevel: alertChr.value ? parseUint8(alertChr.value) : AlertLevel.NONE,
        speechDuration: durChr.value ? parseUint32LE(durChr.value) : 0,
        mode: modeChr.value ? parseUint8(modeChr.value) : DeviceMode.MONITORING,
        sensitivity: sensChr.value ? parseUint8(sensChr.value) : 0,
        battery: batChr.value ? parseUint8(batChr.value) : 0,
        modality: modChr.value ? parseUint8(modChr.value) : AlertModality.BOTH,
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
          this.updateState({ battery: parseUint8(chr.value) });
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

  // -------------------------------------------------------------------
  // Reconnect + Forget
  // -------------------------------------------------------------------

  /** Attempt to reconnect — tries direct connect to last device first, falls back to scan. */
  async reconnect(): Promise<void> {
    const lastId = useDeviceStore.getState().lastDeviceId;
    if (lastId) {
      try {
        useDeviceStore.getState().setConnectionState(ConnectionState.CONNECTING);
        const device = await this.manager.connectToDevice(lastId, { timeout: 10_000 });
        await device.discoverAllServicesAndCharacteristics();
        this.device = device;
        // Reuse connectToDevice for disconnect handler, initial reads, subscriptions
        // But we already connected — so we manually do the post-connection setup
        const store = useDeviceStore.getState();
        store.setLastDeviceId(device.id);

        device.onDisconnected(() => {
          this.cleanupSubscriptions();
          this.device = null;
          useDeviceStore.getState().setConnectionState(ConnectionState.IDLE);
          if (!this.intentionalDisconnect) {
            this.reconnectTimer = setTimeout(() => {
              this.scanAndConnect().catch(() => {
                console.log('[BLE] Reconnect failed');
              });
            }, 3000);
          }
          this.intentionalDisconnect = false;
        });

        await this.readInitialValues(device);
        await this.subscribeToNotifications(device);
        useDeviceStore.getState().setConnectionState(ConnectionState.CONNECTED);
      } catch {
        // Fall back to full scan
        await this.scanAndConnect();
      }
    } else {
      await this.scanAndConnect();
    }
  }

  /** Disconnect and erase saved device — user must re-scan to pair. */
  async forgetDevice(): Promise<void> {
    await this.disconnect();
    useDeviceStore.getState().setLastDeviceId(null);
    saveSetting('lastDeviceId', '').catch(console.warn);
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
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.cleanupSubscriptions();
    if (this.device) {
      await this.device.cancelConnection();
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
