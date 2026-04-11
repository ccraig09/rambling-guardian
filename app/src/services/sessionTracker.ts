/**
 * SessionTracker — wires device session state to the sessions DB.
 *
 * Subscribes to the Zustand deviceStore. Creates a session when the device
 * confirms an active session (sessionState -> ACTIVE) and finalizes it when
 * the device confirms idle (sessionState -> NO_SESSION). Sessions are no
 * longer tied to BLE connection windows — a BLE disconnect during an active
 * session leaves the session open until the device confirms idle on reconnect.
 */
import { useDeviceStore } from '../stores/deviceStore';
import { bleService } from './bleManager';
import { createSession, finalizeSession, recordAlertEvent, getPendingSyncCount } from '../db/sessions';
import { AlertLevel, AppSessionState } from '../types';
import { useSettingsStore } from '../stores/settingsStore';
import { useSessionStore } from '../stores/sessionStore';
import {
  sendSessionSummaryNotification,
  checkAndSendStreakNotification,
} from './notifications';

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
    // Subscribe to deviceStore for sessionState and alert level changes
    this.unsubscribeStore = useDeviceStore.subscribe(async (state) => {
      // --- Session creation (device confirmed active) ---
      if (state.sessionState === AppSessionState.ACTIVE && this.sessionId === null) {
        try {
          this.sessionId = await createSession(state.sensitivity);
          useSessionStore.getState().setActiveSessionId(this.sessionId);
          this.sessionStartMs = Date.now();
          this.lastAlertLevel = AlertLevel.NONE;
          this._alertCount = 0;
          this._maxAlert = AlertLevel.NONE;
          this._speechSegments = 0;
          console.log('[SessionTracker] Session created:', this.sessionId);

          // D.5: write Solo baseline thresholds to device on session start
          const { thresholds } = useSettingsStore.getState();
          try {
            await bleService.writeThresholds(thresholds);
            useSessionStore.getState().setActiveProfile(thresholds);
            useSessionStore.getState().setLastProfileWriteTime(Date.now());
          } catch (e) {
            console.warn('[SessionTracker] Failed to write Solo thresholds:', e);
          }
        } catch (e) {
          console.warn('[SessionTracker] Failed to create session:', e);
        }
      }

      // --- Session finalization (device confirmed idle) ---
      // Covers ACTIVE -> NO_SESSION and STOPPING -> NO_SESSION transitions
      if (state.sessionState === AppSessionState.NO_SESSION && this.sessionId !== null) {
        const id = this.sessionId;
        this.sessionId = null;
        useSessionStore.getState().setActiveSessionId(null);
        try {
          const durationMs = Date.now() - this.sessionStartMs;
          await finalizeSession(
            id,
            durationMs,
            this._alertCount,
            this._maxAlert,
            this._speechSegments,
          );
          console.log('[SessionTracker] Session finalized:', id, durationMs, 'ms');

          // D.5: restore Solo baseline thresholds — only clear profile on success
          const { thresholds } = useSettingsStore.getState();
          try {
            await bleService.writeThresholds(thresholds);
            useSessionStore.getState().resetProfile();
          } catch (e) {
            // Keep prior activeProfile — reconnect will re-assert it
            console.warn('[SessionTracker] Failed to restore Solo thresholds:', e);
          }

          // Refresh pending sync count after finalize
          const pendingCount = await getPendingSyncCount();
          useSessionStore.getState().setPendingSyncCount(pendingCount);

          // Fire session summary + streak check if notifications are on
          const { notificationsEnabled } = useSettingsStore.getState();
          if (notificationsEnabled) {
            await sendSessionSummaryNotification(durationMs, this._alertCount).catch(
              (e) => console.warn('[SessionTracker] Summary notification failed:', e),
            );
            await checkAndSendStreakNotification().catch(
              (e) => console.warn('[SessionTracker] Streak notification failed:', e),
            );
          }
        } catch (e) {
          console.warn('[SessionTracker] Failed to finalize session:', e);
        }
      }

      // --- Alert level tracking (only during active session) ---
      if (
        this.sessionId &&
        state.sessionState === AppSessionState.ACTIVE &&
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
