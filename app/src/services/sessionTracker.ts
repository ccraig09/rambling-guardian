/**
 * SessionTracker — wires BLE device state to the sessions DB.
 *
 * Subscribes to the Zustand deviceStore (which bleManager keeps in sync).
 * Auto-creates a session when the device connects and finalizes it on disconnect.
 */
import { useDeviceStore } from '../stores/deviceStore';
import { bleService } from './bleManager';
import { createSession, finalizeSession, recordAlertEvent } from '../db/sessions';
import { AlertLevel } from '../types';

class SessionTracker {
  private sessionId: string | null = null;
  private sessionStartMs: number = 0;
  private lastAlertLevel: AlertLevel = AlertLevel.NONE;
  private unsubscribeStore: (() => void) | null = null;
  private unsubscribeStats: (() => void) | null = null;

  // Counters — tracked here since BLE stats reset on reconnect
  private _alertCount = 0;
  private _maxAlert: AlertLevel = AlertLevel.NONE;
  private _speechSegments = 0;

  start() {
    // Subscribe to deviceStore for connection and alert level changes
    this.unsubscribeStore = useDeviceStore.subscribe(async (state) => {
      const wasConnected = this.sessionId !== null;
      const isConnected = state.connected;

      if (isConnected && !wasConnected) {
        // Device just connected — start a new session
        try {
          this.sessionId = await createSession(state.sensitivity);
          this.sessionStartMs = Date.now();
          this.lastAlertLevel = AlertLevel.NONE;
          this._alertCount = 0;
          this._maxAlert = AlertLevel.NONE;
          this._speechSegments = 0;
        } catch (e) {
          console.warn('[SessionTracker] Failed to create session:', e);
        }
      }

      if (!isConnected && wasConnected) {
        // Device disconnected — finalize the session
        const id = this.sessionId;
        this.sessionId = null;
        if (id) {
          try {
            const durationMs = Date.now() - this.sessionStartMs;
            await finalizeSession(
              id,
              durationMs,
              this._alertCount,
              this._maxAlert,
              this._speechSegments,
            );
          } catch (e) {
            console.warn('[SessionTracker] Failed to finalize session:', e);
          }
        }
      }

      // Track alert level transitions while connected
      if (
        this.sessionId &&
        state.alertLevel > AlertLevel.NONE &&
        state.alertLevel !== this.lastAlertLevel
      ) {
        this.lastAlertLevel = state.alertLevel;
        this._alertCount++;
        if (state.alertLevel > this._maxAlert) {
          this._maxAlert = state.alertLevel;
        }
        try {
          await recordAlertEvent(
            this.sessionId,
            state.alertLevel,
            Date.now() - this.sessionStartMs,
            state.speechDuration,
          );
        } catch (e) {
          console.warn('[SessionTracker] Failed to record alert event:', e);
        }
      }
    });

    // Subscribe to session stats for speech segment count
    this.unsubscribeStats = bleService.onStatsUpdate((stats) => {
      this._speechSegments = stats.speechSegments;
    });
  }

  stop() {
    this.unsubscribeStore?.();
    this.unsubscribeStats?.();
    this.unsubscribeStore = null;
    this.unsubscribeStats = null;
  }
}

export const sessionTracker = new SessionTracker();
