/**
 * Session Screen — BLE device connection + session management.
 *
 * Three screen states:
 * 1. Not Connected — connection card with scan/reconnect/forget buttons.
 * 2. Connected + Idle — status pill, "Ready to Monitor" card, Start Session CTA.
 * 3. Connected + Active — live dashboard (speech timer, alert meter, stats).
 *    Plus STARTING/STOPPING transitional states with spinners.
 *
 * "End Session" stops monitoring but keeps the BLE connection alive.
 */
import { LiveTranscript } from '../../src/components/LiveTranscript';
import { SessionContextPill } from '../../src/components/SessionContextPill';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../src/theme/theme';
import { useDeviceState, useSessionStats, useConnectionState } from '../../src/hooks/useDeviceState';
import { useDeviceStore } from '../../src/stores/deviceStore';
import { useSessionStore } from '../../src/stores/sessionStore';
import { bleService } from '../../src/services/bleManager';
import { AlertLevel, AppSessionState, ConnectionState, DeviceMode, AlertModality } from '../../src/types';
import type { SessionContext } from '../../src/types';
import { useTranscriptStore } from '../../src/stores/transcriptStore';
import SyncStatusIndicator from '../../src/components/SyncStatusIndicator';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Wait for session + transcript finalization to complete.
 * Watches for sessionState → NO_SESSION and transcriptStore.status → complete/idle.
 * Returns early once both conditions are met, or after timeoutMs.
 */
function waitForFinalization(timeoutMs: number): Promise<void> {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      unsubDevice();
      unsubTranscript();
      resolve();
    }, timeoutMs);

    function checkDone() {
      const sessionDone =
        useDeviceStore.getState().sessionState === AppSessionState.NO_SESSION;
      const transcriptStatus = useTranscriptStore.getState().status;
      const transcriptDone =
        transcriptStatus === 'complete' || transcriptStatus === 'idle';
      if (sessionDone && transcriptDone) {
        clearTimeout(timeout);
        unsubDevice();
        unsubTranscript();
        resolve();
      }
    }

    const unsubDevice = useDeviceStore.subscribe(checkDone);
    const unsubTranscript = useTranscriptStore.subscribe(checkDone);
    // Check immediately in case already finalized
    checkDone();
  });
}

function formatDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${String(sec).padStart(2, '0')}`;
}

const ALERT_LABELS: Record<number, string> = {
  [AlertLevel.NONE]: 'All clear',
  [AlertLevel.GENTLE]: 'Heads up \u2014 you\'ve been talking a while',
  [AlertLevel.MODERATE]: 'Time to wrap up',
  [AlertLevel.URGENT]: 'You\'re rambling \u2014 take a breath',
  [AlertLevel.CRITICAL]: 'Stop. Let others speak.',
};

const MODE_LABELS: Record<number, string> = {
  [DeviceMode.IDLE]: 'Idle',
  [DeviceMode.ACTIVE_SESSION]: 'Active Session',
  [DeviceMode.MANUAL_NOTE]: 'Manual Note',
  [DeviceMode.DEEP_SLEEP]: 'Deep Sleep',
};

const MODALITY_LABELS: Record<number, string> = {
  [AlertModality.LED_ONLY]: 'LED Only',
  [AlertModality.VIBRATION_ONLY]: 'Vibration Only',
  [AlertModality.BOTH]: 'Both',
};

const ALERT_LEVEL_NAMES: Record<number, string> = {
  [AlertLevel.NONE]: 'None',
  [AlertLevel.GENTLE]: 'Gentle',
  [AlertLevel.MODERATE]: 'Moderate',
  [AlertLevel.URGENT]: 'Urgent',
  [AlertLevel.CRITICAL]: 'Critical',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function SessionScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const deviceState = useDeviceState();
  const sessionStats = useSessionStats();
  const connectionState = useConnectionState();
  const sessionState = useDeviceStore((s) => s.sessionState);
  const lastDeviceId = useDeviceStore((s) => s.lastDeviceId);
  const sessionContext = useSessionStore((s) => s.sessionContext);
  const sessionContextOverride = useSessionStore((s) => s.sessionContextOverride);

  async function handleConnect() {
    try {
      await bleService.scanAndConnect();
    } catch {
      // connectionState is already set to FAILED by bleManager
    }
  }

  async function handleReconnect() {
    try {
      await bleService.reconnect();
    } catch {
      // connectionState is already set to FAILED by bleManager
    }
  }

  async function handleStartSession() {
    try {
      await bleService.startSession();
    } catch {
      // Error state is handled by bleManager timeout logic
    }
  }

  function handleEndSession() {
    Alert.alert(
      'End Session?',
      'This will stop monitoring and save the session to History. Your device will stay connected.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'End Session',
          style: 'destructive',
          onPress: async () => {
            try {
              await bleService.stopSession();
            } catch {
              console.warn('[Session] Stop session failed');
            }
          },
        },
      ],
    );
  }

  async function handleDisconnect() {
    try {
      // Read fresh store state — the React hook value may be stale by the
      // time the user taps, especially during fast transitions.
      const current = useDeviceStore.getState().sessionState;

      // Guard every non-idle state: STARTING, ACTIVE, STOPPING.
      // Disconnecting during any of these would cancel the BLE notification
      // that triggers session + transcript finalization.
      if (current !== AppSessionState.NO_SESSION) {
        // STOPPING is already in progress — just wait for it to finish.
        // STARTING/ACTIVE need a stop command first.
        if (current !== AppSessionState.STOPPING) {
          await bleService.stopSession();
        }
        await waitForFinalization(8000);
      }
      await bleService.disconnect();
    } catch {
      console.warn('[Session] Disconnect failed');
    }
  }

  async function handleForgetDevice() {
    try {
      await bleService.forgetDevice();
    } catch {
      console.warn('[Session] Forget device failed');
    }
  }

  function handleContextOverride() {
    Alert.alert(
      'Session Context',
      'What kind of conversation is this?',
      [
        { text: 'Solo', onPress: () => applyContextOverride('solo') },
        { text: 'With Others', onPress: () => applyContextOverride('with_others') },
        { text: 'Presenting', onPress: () => applyContextOverride('presentation') },
        { text: 'Cancel', style: 'cancel' },
      ],
    );
  }

  function applyContextOverride(context: SessionContext) {
    useSessionStore.getState().setSessionContext(context);
    useSessionStore.getState().setSessionContextOverride(true);
  }

  function alertColor(level: AlertLevel): string {
    switch (level) {
      case AlertLevel.GENTLE:   return theme.alert.gentle;
      case AlertLevel.MODERATE: return theme.alert.moderate;
      case AlertLevel.URGENT:   return theme.alert.urgent;
      case AlertLevel.CRITICAL: return theme.alert.urgent;
      default:                  return theme.text.muted;
    }
  }

  // Segment colors for the 4-bar meter
  const segmentColors = [
    theme.alert.gentle,
    theme.alert.moderate,
    theme.alert.urgent,
    'hsl(0, 68%, 42%)', // critical — darker red
  ];

  const isBusy = connectionState === ConnectionState.SCANNING || connectionState === ConnectionState.CONNECTING;

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.bg, paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* -- Screen title -- */}
        <Text style={[theme.type.title, { color: theme.text.primary, marginBottom: theme.spacing.lg }]}>
          Session
        </Text>

        {connectionState !== ConnectionState.CONNECTED ? (
          /* ============================================================
           * DISCONNECTED / SCANNING / CONNECTING / FAILED STATE
           * ============================================================ */
          <View style={[styles.card, { backgroundColor: theme.colors.card, borderRadius: theme.radius.xl }]}>
            {/* Dot + heading */}
            <View style={styles.statusRow}>
              <View style={[styles.dot, {
                backgroundColor: connectionState === ConnectionState.FAILED
                  ? theme.semantic.error
                  : theme.text.muted,
              }]} />
              <Text style={[theme.type.heading, { color: theme.text.primary }]}>
                {connectionState === ConnectionState.FAILED ? 'Connection Failed' : 'Not Connected'}
              </Text>
            </View>

            <Text style={[theme.type.body, { color: theme.text.secondary, marginTop: theme.spacing.sm }]}>
              {connectionState === ConnectionState.FAILED
                ? 'Could not connect to your RamblingGuard device.'
                : 'Your RamblingGuard device isn\'t connected.'}
            </Text>

            {/* Primary action button */}
            <Pressable
              onPress={handleConnect}
              disabled={isBusy}
              style={[
                styles.primaryButton,
                {
                  backgroundColor: theme.primary[500],
                  borderRadius: theme.radius.lg,
                  marginTop: theme.spacing.lg,
                  opacity: isBusy ? 0.7 : 1,
                },
              ]}
            >
              {connectionState === ConnectionState.SCANNING ? (
                <View style={styles.scanningRow}>
                  <ActivityIndicator color={theme.text.onColor} size="small" />
                  <Text style={[theme.type.subtitle, { color: theme.text.onColor, marginLeft: theme.spacing.sm }]}>
                    Searching for RamblingGuard...
                  </Text>
                </View>
              ) : connectionState === ConnectionState.CONNECTING ? (
                <View style={styles.scanningRow}>
                  <ActivityIndicator color={theme.text.onColor} size="small" />
                  <Text style={[theme.type.subtitle, { color: theme.text.onColor, marginLeft: theme.spacing.sm }]}>
                    Connecting...
                  </Text>
                </View>
              ) : (
                <Text style={[theme.type.subtitle, { color: theme.text.onColor }]}>
                  {connectionState === ConnectionState.FAILED ? 'Try Again' : 'Connect Device'}
                </Text>
              )}
            </Pressable>

            {/* Reconnect button — only when idle with a known device */}
            {connectionState === ConnectionState.IDLE && lastDeviceId && (
              <Pressable
                onPress={handleReconnect}
                style={[
                  styles.secondaryButton,
                  {
                    borderColor: theme.primary[500],
                    borderRadius: theme.radius.lg,
                    marginTop: theme.spacing.sm,
                  },
                ]}
              >
                <Text style={[theme.type.subtitle, { color: theme.primary[500] }]}>
                  Reconnect
                </Text>
              </Pressable>
            )}

            {/* Forget Device button — only in FAILED state */}
            {connectionState === ConnectionState.FAILED && lastDeviceId && (
              <Pressable
                onPress={handleForgetDevice}
                style={[
                  styles.secondaryButton,
                  {
                    borderColor: theme.text.muted,
                    borderRadius: theme.radius.lg,
                    marginTop: theme.spacing.sm,
                  },
                ]}
              >
                <Text style={[theme.type.subtitle, { color: theme.text.muted }]}>
                  Forget Device
                </Text>
              </Pressable>
            )}
          </View>
        ) : sessionState === AppSessionState.STARTING ? (
          /* ============================================================
           * CONNECTED + STARTING STATE
           * ============================================================ */
          <>
            {/* -- Status pill -- */}
            <View style={[styles.statusPill, { backgroundColor: theme.colors.card, borderRadius: theme.radius.full }]}>
              <View style={[styles.dot, { backgroundColor: theme.alert.safe }]} />
              <Text style={[theme.type.small, { color: theme.text.secondary }]}>
                Connected
              </Text>
              <Text style={[theme.type.small, { color: theme.text.muted, marginLeft: theme.spacing.sm }]}>
                {deviceState.battery === null ? 'USB' : `${deviceState.battery}%`}
              </Text>
            </View>

            <View style={[styles.heroContainer, { marginTop: theme.spacing.xl }]}>
              <ActivityIndicator size="large" color={theme.primary[500]} />
              <Text style={[theme.type.body, { color: theme.text.secondary, marginTop: theme.spacing.md }]}>
                Starting session...
              </Text>
            </View>
          </>
        ) : sessionState === AppSessionState.ACTIVE ? (
          /* ============================================================
           * CONNECTED + ACTIVE STATE — live dashboard
           * ============================================================ */
          <>
            {/* -- Status pill -- */}
            <View style={[styles.statusPill, { backgroundColor: theme.colors.card, borderRadius: theme.radius.full }]}>
              <View style={[styles.dot, { backgroundColor: theme.alert.safe }]} />
              <Text style={[theme.type.small, { color: theme.text.secondary }]}>
                Connected
              </Text>
              <Text style={[theme.type.small, { color: theme.text.muted, marginLeft: theme.spacing.sm }]}>
                {deviceState.battery === null ? 'USB' : `${deviceState.battery}%`}
              </Text>
            </View>

            {/* -- Sync status (only during active session) -- */}
            <View style={{ marginTop: theme.spacing.sm }}>
              <SyncStatusIndicator />
            </View>

            {/* -- Context classification pill (D.4) -- */}
            <View style={{ marginTop: theme.spacing.sm }}>
              <SessionContextPill
                context={sessionContext}
                isOverride={sessionContextOverride}
                onPress={handleContextOverride}
              />
            </View>

            {/* -- Session Info -- */}
            <View style={[styles.card, { backgroundColor: theme.colors.card, borderRadius: theme.radius.xl, marginTop: theme.spacing.md }]}>
              <Text style={[theme.type.small, { color: theme.text.tertiary, lineHeight: 18 }]}>
                {'Speech timer resets after 3 seconds of silence. Tap End Session to save and return to idle.'}
              </Text>
            </View>

            {/* -- Speech Duration (HERO) -- */}
            <View style={styles.heroContainer}>
              <Text style={[theme.type.hero, { color: theme.text.primary, fontSize: 64, letterSpacing: -3 }]}>
                {formatDuration(deviceState.speechDuration)}
              </Text>

              {/* Alert message */}
              <View style={[styles.alertMessageRow, { marginTop: theme.spacing.sm }]}>
                {deviceState.alertLevel > AlertLevel.NONE && (
                  <View
                    style={[
                      styles.alertDot,
                      { backgroundColor: alertColor(deviceState.alertLevel) },
                    ]}
                  />
                )}
                <Text
                  style={[
                    theme.type.body,
                    {
                      color: deviceState.alertLevel === AlertLevel.NONE
                        ? theme.text.muted
                        : alertColor(deviceState.alertLevel),
                    },
                  ]}
                >
                  {ALERT_LABELS[deviceState.alertLevel] ?? 'All clear'}
                </Text>
              </View>
            </View>

            {/* -- Alert Level Meter (4 segments) -- */}
            <View style={[styles.meterRow, { marginTop: theme.spacing.lg }]}>
              {segmentColors.map((color, i) => (
                <View
                  key={i}
                  style={[
                    styles.meterSegment,
                    {
                      backgroundColor: deviceState.alertLevel >= i + 1
                        ? color
                        : theme.colors.elevated,
                      borderRadius: theme.radius.sm,
                    },
                  ]}
                />
              ))}
            </View>

            {/* -- Session Stats Card -- */}
            <View style={[styles.card, { backgroundColor: theme.colors.card, borderRadius: theme.radius.xl, marginTop: theme.spacing.lg }]}>
              <Text style={[theme.type.subtitle, { color: theme.text.primary, marginBottom: theme.spacing.md }]}>
                Session Stats
              </Text>
              <View style={styles.statsGrid}>
                <StatItem
                  label="Speaking runs"
                  value={String(sessionStats?.speechSegments ?? 0)}
                  theme={theme}
                />
                <StatItem
                  label="Alerts triggered"
                  value={String(sessionStats?.alertCount ?? 0)}
                  theme={theme}
                />
                <StatItem
                  label="Peak alert"
                  value={ALERT_LEVEL_NAMES[sessionStats?.maxAlertLevel ?? 0] ?? 'None'}
                  theme={theme}
                />
                <StatItem
                  label="Session"
                  value={formatDuration(sessionStats?.durationMs ?? 0)}
                  theme={theme}
                />
              </View>
            </View>

            {/* -- Live Transcript -- */}
            <View style={{ marginTop: theme.spacing.lg }}>
              <LiveTranscript />
            </View>

            {/* -- Device Info Row -- */}
            <View style={[styles.infoRow, { marginTop: theme.spacing.base }]}>
              <Text style={[theme.type.caption, { color: theme.text.muted }]}>
                Sensitivity: {deviceState.sensitivity}/3
              </Text>
              <Text style={[theme.type.caption, { color: theme.text.muted }]}>
                {MODE_LABELS[deviceState.mode] ?? 'Unknown'}
              </Text>
              <Text style={[theme.type.caption, { color: theme.text.muted }]}>
                {MODALITY_LABELS[deviceState.modality] ?? 'Unknown'}
              </Text>
            </View>

            {/* -- End Session button -- */}
            <Pressable
              onPress={handleEndSession}
              style={[
                styles.secondaryButton,
                {
                  borderColor: theme.semantic.error,
                  borderRadius: theme.radius.lg,
                  marginTop: theme.spacing.lg,
                },
              ]}
            >
              <Text style={[theme.type.subtitle, { color: theme.semantic.error }]}>
                End Session
              </Text>
            </Pressable>
            <Text style={[theme.type.caption, { color: theme.text.muted, textAlign: 'center', marginTop: theme.spacing.xs }]}>
              Stops monitoring and saves to History
            </Text>
          </>
        ) : sessionState === AppSessionState.STOPPING ? (
          /* ============================================================
           * CONNECTED + STOPPING STATE
           * ============================================================ */
          <>
            {/* -- Status pill -- */}
            <View style={[styles.statusPill, { backgroundColor: theme.colors.card, borderRadius: theme.radius.full }]}>
              <View style={[styles.dot, { backgroundColor: theme.alert.safe }]} />
              <Text style={[theme.type.small, { color: theme.text.secondary }]}>
                Connected
              </Text>
              <Text style={[theme.type.small, { color: theme.text.muted, marginLeft: theme.spacing.sm }]}>
                {deviceState.battery === null ? 'USB' : `${deviceState.battery}%`}
              </Text>
            </View>

            <View style={[styles.heroContainer, { marginTop: theme.spacing.xl }]}>
              <ActivityIndicator size="large" color={theme.text.muted} />
              <Text style={[theme.type.body, { color: theme.text.secondary, marginTop: theme.spacing.md }]}>
                Ending session...
              </Text>
            </View>
          </>
        ) : (
          /* ============================================================
           * CONNECTED + IDLE STATE
           * ============================================================ */
          <>
            {/* -- Status pill -- */}
            <View style={[styles.statusPill, { backgroundColor: theme.colors.card, borderRadius: theme.radius.full }]}>
              <View style={[styles.dot, { backgroundColor: theme.alert.safe }]} />
              <Text style={[theme.type.small, { color: theme.text.secondary }]}>
                Connected
              </Text>
              <Text style={[theme.type.small, { color: theme.text.muted, marginLeft: theme.spacing.sm }]}>
                {deviceState.battery === null ? 'USB' : `${deviceState.battery}%`}
              </Text>
            </View>

            {/* -- Ready message -- */}
            <View style={[styles.card, { backgroundColor: theme.colors.card, borderRadius: theme.radius.xl, marginTop: theme.spacing.lg }]}>
              <Text style={[theme.type.heading, { color: theme.text.primary, marginBottom: theme.spacing.sm }]}>
                Ready to Monitor
              </Text>
              <Text style={[theme.type.body, { color: theme.text.secondary }]}>
                Your device is connected and idle. Start a session to begin speech monitoring with real-time alerts.
              </Text>
            </View>

            {/* -- Device info -- */}
            <View style={[styles.infoRow, { marginTop: theme.spacing.base }]}>
              <Text style={[theme.type.caption, { color: theme.text.muted }]}>
                Sensitivity: {deviceState.sensitivity}/3
              </Text>
              <Text style={[theme.type.caption, { color: theme.text.muted }]}>
                {MODALITY_LABELS[deviceState.modality] ?? 'Unknown'}
              </Text>
            </View>

            {/* -- Start Session CTA -- */}
            <Pressable
              onPress={handleStartSession}
              style={[
                styles.primaryButton,
                {
                  backgroundColor: theme.primary[500],
                  borderRadius: theme.radius.lg,
                  marginTop: theme.spacing.lg,
                },
              ]}
            >
              <Text style={[theme.type.subtitle, { color: theme.text.onColor }]}>
                Start Session
              </Text>
            </Pressable>

            {/* -- Disconnect button -- */}
            <Pressable
              onPress={handleDisconnect}
              style={[
                styles.secondaryButton,
                {
                  borderColor: theme.text.muted,
                  borderRadius: theme.radius.lg,
                  marginTop: theme.spacing.sm,
                },
              ]}
            >
              <Text style={[theme.type.subtitle, { color: theme.text.muted }]}>
                Disconnect
              </Text>
            </Pressable>
          </>
        )}

        {/* Bottom padding */}
        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatItem({ label, value, theme }: { label: string; value: string; theme: ReturnType<typeof useTheme> }) {
  return (
    <View style={styles.statItem}>
      <Text style={[theme.type.heading, { color: theme.text.primary }]}>
        {value}
      </Text>
      <Text style={[theme.type.caption, { color: theme.text.muted, marginTop: 2 }]}>
        {label}
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scroll: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  card: {
    padding: 16,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  primaryButton: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  secondaryButton: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    borderWidth: 1,
    backgroundColor: 'transparent',
  },
  scanningRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 6,
  },
  heroContainer: {
    alignItems: 'center',
    marginTop: 32,
  },
  alertMessageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  alertDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  meterRow: {
    flexDirection: 'row',
    gap: 4,
  },
  meterSegment: {
    flex: 1,
    height: 8,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  statItem: {
    width: '50%',
    paddingVertical: 8,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
});
