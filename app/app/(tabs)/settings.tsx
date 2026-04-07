/**
 * Settings Screen — RG-C.8
 *
 * Three sections:
 *   DEVICE  — sensitivity, alert style, alert thresholds (BLE writes)
 *   APP     — daily exercise goal, notifications
 *   ABOUT   — firmware, app version, device name, battery
 *
 * Offline-safe: all writes go to Zustand first; BLE writes only when connected.
 */
import { useState, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Switch,
  StyleSheet,
  ActivityIndicator,
  Linking,
  AppState,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../src/theme/theme';
import { useDeviceState } from '../../src/hooks/useDeviceState';
import { useDeviceStore } from '../../src/stores/deviceStore';
import { useSettingsStore } from '../../src/stores/settingsStore';
import { bleService } from '../../src/services/bleManager';
import { AlertModality } from '../../src/types';
import type { AlertThresholds } from '../../src/types';
import { getNotificationPermissionStatus } from '../../src/services/notifications';

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

type ThemeType = ReturnType<typeof useTheme>;

/** ALL-CAPS section header with letter spacing */
function SectionHeader({ label, theme }: { label: string; theme: ThemeType }) {
  return (
    <Text
      style={[
        theme.type.caption,
        {
          color: theme.text.muted,
          letterSpacing: 1.2,
          marginTop: 28,
          marginBottom: 8,
          paddingHorizontal: 4,
        },
      ]}
    >
      {label.toUpperCase()}
    </Text>
  );
}

/** Card wrapper for a group of setting rows */
function SettingGroup({ children, theme }: { children: React.ReactNode; theme: ThemeType }) {
  return (
    <View
      style={{
        backgroundColor: theme.colors.card,
        borderRadius: theme.radius.xl,
        overflow: 'hidden',
      }}
    >
      {children}
    </View>
  );
}

/** Single info row — label on left, value on right */
function InfoRow({
  label,
  value,
  valueColor,
  theme,
  isLast,
}: {
  label: string;
  value: string;
  valueColor?: string;
  theme: ThemeType;
  isLast?: boolean;
}) {
  return (
    <View
      style={[
        styles.row,
        !isLast && {
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: theme.colors.elevated,
        },
      ]}
    >
      <Text style={[theme.type.body, { color: theme.text.primary }]}>{label}</Text>
      <Text style={[theme.type.body, { color: valueColor ?? theme.text.secondary }]}>
        {value}
      </Text>
    </View>
  );
}

/** Stepper control: [−] value [+] */
function Stepper({
  value,
  onDecrement,
  onIncrement,
  unit,
  theme,
}: {
  value: number;
  onDecrement: () => void;
  onIncrement: () => void;
  unit?: string;
  theme: ThemeType;
}) {
  return (
    <View style={styles.stepper}>
      <Pressable
        onPress={onDecrement}
        style={[
          styles.stepBtn,
          { backgroundColor: theme.colors.elevated, borderRadius: theme.radius.md },
        ]}
      >
        <Text style={[theme.type.subtitle, { color: theme.text.secondary }]}>−</Text>
      </Pressable>
      <Text
        style={[
          theme.type.subtitle,
          { color: theme.text.primary, minWidth: 40, textAlign: 'center' },
        ]}
      >
        {unit ? `${value}${unit}` : value}
      </Text>
      <Pressable
        onPress={onIncrement}
        style={[
          styles.stepBtn,
          { backgroundColor: theme.primary[500], borderRadius: theme.radius.md },
        ]}
      >
        <Text style={[theme.type.subtitle, { color: theme.text.onColor }]}>+</Text>
      </Pressable>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Threshold limits
// ---------------------------------------------------------------------------

const THRESHOLD_CONFIG = [
  { key: 'gentleSec' as keyof AlertThresholds, label: 'Gentle', min: 3, max: 15 },
  { key: 'moderateSec' as keyof AlertThresholds, label: 'Moderate', min: 8, max: 30 },
  { key: 'urgentSec' as keyof AlertThresholds, label: 'Urgent', min: 20, max: 60 },
  { key: 'criticalSec' as keyof AlertThresholds, label: 'Critical', min: 40, max: 120 },
] as const;

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export default function SettingsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const deviceState = useDeviceState();
  const deviceStore = useDeviceStore();
  const settings = useSettingsStore();

  const [localThresholds, setLocalThresholds] = useState<AlertThresholds>(settings.thresholds);
  const [isApplyingThresholds, setIsApplyingThresholds] = useState(false);
  const [applySuccess, setApplySuccess] = useState(false);

  // Check OS notification permission on mount and when app returns to foreground
  useEffect(() => {
    const checkPermission = () => {
      getNotificationPermissionStatus().then((status) => {
        settings.setNotificationPermissionStatus(status);
      }).catch(console.warn);
    };
    checkPermission();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') checkPermission();
    });
    return () => sub.remove();
  }, []);

  // ------------------------------------------------------------------
  // Handlers
  // ------------------------------------------------------------------

  async function handleSensitivityChange(value: number) {
    deviceStore.updateDevice({ sensitivity: value });
    if (deviceState.connected) {
      await bleService.writeSensitivity(value).catch(console.warn);
    }
  }

  async function handleModalityChange(value: AlertModality) {
    deviceStore.updateDevice({ modality: value });
    if (deviceState.connected) {
      await bleService.writeModality(value).catch(console.warn);
    }
  }

  function adjustThreshold(key: keyof AlertThresholds, delta: number) {
    const cfg = THRESHOLD_CONFIG.find((c) => c.key === key)!;
    setLocalThresholds((prev) => ({
      ...prev,
      [key]: Math.min(cfg.max, Math.max(cfg.min, prev[key] + delta)),
    }));
  }

  async function handleApplyThresholds() {
    settings.setThresholds(localThresholds);
    setApplySuccess(false);
    if (deviceState.connected) {
      setIsApplyingThresholds(true);
      await bleService.writeThresholds(localThresholds).catch(console.warn);
      setIsApplyingThresholds(false);
    }
    setApplySuccess(true);
    setTimeout(() => setApplySuccess(false), 2500);
  }

  // ------------------------------------------------------------------
  // Helpers
  // ------------------------------------------------------------------

  const batteryColor =
    deviceState.battery <= 20 ? theme.semantic.error : theme.semantic.success;

  const batteryAge = bleService.getBatteryAge();
  const batteryFresh = batteryAge < 60_000; // less than 1 minute old
  const batteryAgeLabel = batteryFresh
    ? 'Live'
    : batteryAge < Infinity
      ? `${Math.round(batteryAge / 1000)}s ago`
      : '';

  function segmentStyle(active: boolean) {
    return [
      styles.segment,
      {
        backgroundColor: active ? theme.primary[500] : theme.colors.elevated,
        borderRadius: theme.radius.md,
      },
    ];
  }

  function segmentTextStyle(active: boolean) {
    return [
      theme.type.small,
      {
        color: active ? theme.text.onColor : theme.text.secondary,
        fontFamily: theme.fontFamily.semibold,
      },
    ];
  }

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.bg, paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Screen title */}
        <Text
          style={[theme.type.title, { color: theme.text.primary, marginBottom: theme.spacing.sm }]}
        >
          Settings
        </Text>

        {/* ================================================================
         * DEVICE section
         * ================================================================ */}
        <SectionHeader label="Device" theme={theme} />

        {!deviceState.connected ? (
          <SettingGroup theme={theme}>
            <View style={[styles.row, { paddingVertical: 16 }]}>
              <Text style={[theme.type.body, { color: theme.text.muted }]}>
                Not connected — connect via the Session tab
              </Text>
            </View>
          </SettingGroup>
        ) : (
          <>
            {/* ── Sensitivity + Alert Style ── */}
            <SettingGroup theme={theme}>
              {/* Sensitivity */}
              <View
                style={[
                  styles.settingRow,
                  {
                    borderBottomWidth: StyleSheet.hairlineWidth,
                    borderBottomColor: theme.colors.elevated,
                  },
                ]}
              >
                <View style={styles.settingLeft}>
                  <Text style={[theme.type.body, { color: theme.text.primary }]}>Sensitivity</Text>
                  <Text style={[theme.type.small, { color: theme.text.muted, marginTop: 2 }]}>
                    Speech detection aggressiveness
                  </Text>
                </View>
                <View style={styles.segmentGroup}>
                  {[0, 1, 2, 3].map((val) => (
                    <Pressable
                      key={val}
                      onPress={() => handleSensitivityChange(val)}
                      style={segmentStyle(deviceState.sensitivity === val)}
                    >
                      <Text style={segmentTextStyle(deviceState.sensitivity === val)}>
                        {val}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              {/* Alert Style */}
              <View style={styles.settingRow}>
                <View style={styles.settingLeft}>
                  <Text style={[theme.type.body, { color: theme.text.primary }]}>Alert Style</Text>
                  <Text style={[theme.type.small, { color: theme.text.muted, marginTop: 2 }]}>
                    How the device alerts you
                  </Text>
                </View>
                <View style={styles.segmentGroup}>
                  {[
                    { value: AlertModality.LED_ONLY, label: 'LED' },
                    { value: AlertModality.VIBRATION_ONLY, label: 'Vibrate' },
                    { value: AlertModality.BOTH, label: 'Both' },
                  ].map(({ value, label }) => (
                    <Pressable
                      key={value}
                      onPress={() => handleModalityChange(value)}
                      style={[segmentStyle(deviceState.modality === value), styles.segmentWide]}
                    >
                      <Text style={segmentTextStyle(deviceState.modality === value)}>
                        {label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            </SettingGroup>

            {/* ── Alert Thresholds ── */}
            <SectionHeader label="Alert Thresholds" theme={theme} />
            <SettingGroup theme={theme}>
              <View style={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 4 }}>
                <Text
                  style={[theme.type.small, { color: theme.text.muted, paddingVertical: 12 }]}
                >
                  Time before each alert level triggers
                </Text>
              </View>

              {THRESHOLD_CONFIG.map(({ key, label }, i) => (
                <View
                  key={key}
                  style={[
                    styles.thresholdRow,
                    i < THRESHOLD_CONFIG.length - 1 && {
                      borderBottomWidth: StyleSheet.hairlineWidth,
                      borderBottomColor: theme.colors.elevated,
                    },
                  ]}
                >
                  <Text style={[theme.type.body, { color: theme.text.secondary, flex: 1 }]}>
                    {label}
                  </Text>
                  <Stepper
                    value={localThresholds[key]}
                    unit="s"
                    onDecrement={() => adjustThreshold(key, -1)}
                    onIncrement={() => adjustThreshold(key, 1)}
                    theme={theme}
                  />
                </View>
              ))}

              {/* Apply button + success toast */}
              <View style={{ padding: 16 }}>
                {applySuccess && (
                  <View
                    style={[
                      styles.successToast,
                      {
                        backgroundColor: `${theme.semantic.success}18`,
                        borderRadius: theme.radius.md,
                        marginBottom: 12,
                      },
                    ]}
                  >
                    <Text style={[theme.type.small, { color: theme.semantic.success, fontFamily: theme.fontFamily.semibold }]}>
                      {deviceState.connected ? 'Thresholds applied to device' : 'Thresholds saved'}
                    </Text>
                  </View>
                )}
                <Pressable
                  onPress={handleApplyThresholds}
                  disabled={isApplyingThresholds}
                  style={[
                    styles.applyBtn,
                    {
                      backgroundColor: theme.primary[500],
                      borderRadius: theme.radius.lg,
                      opacity: isApplyingThresholds ? 0.7 : 1,
                    },
                  ]}
                >
                  {isApplyingThresholds ? (
                    <ActivityIndicator color={theme.text.onColor} size="small" />
                  ) : (
                    <Text style={[theme.type.subtitle, { color: theme.text.onColor }]}>
                      Apply to Device
                    </Text>
                  )}
                </Pressable>
              </View>
            </SettingGroup>
          </>
        )}

        {/* ================================================================
         * APP section
         * ================================================================ */}
        <SectionHeader label="App" theme={theme} />

        <SettingGroup theme={theme}>
          {/* Daily Exercise Goal */}
          <View
            style={[
              styles.settingRow,
              {
                borderBottomWidth: StyleSheet.hairlineWidth,
                borderBottomColor: theme.colors.elevated,
              },
            ]}
          >
            <View style={styles.settingLeft}>
              <Text style={[theme.type.body, { color: theme.text.primary }]}>
                Daily Exercise Goal
              </Text>
              <Text style={[theme.type.small, { color: theme.text.muted, marginTop: 2 }]}>
                Exercises to complete per day
              </Text>
            </View>
            <Stepper
              value={settings.dailyExerciseTarget}
              onDecrement={() =>
                settings.setDailyExerciseTarget(Math.max(1, settings.dailyExerciseTarget - 1))
              }
              onIncrement={() =>
                settings.setDailyExerciseTarget(Math.min(10, settings.dailyExerciseTarget + 1))
              }
              theme={theme}
            />
          </View>

          {/* Min Battery for Recording */}
          <View
            style={[
              styles.settingRow,
              {
                borderBottomWidth: StyleSheet.hairlineWidth,
                borderBottomColor: theme.colors.elevated,
              },
            ]}
          >
            <View style={styles.settingLeft}>
              <Text style={[theme.type.body, { color: theme.text.primary }]}>
                Min Battery for Recording
              </Text>
              <Text style={[theme.type.small, { color: theme.text.muted, marginTop: 2 }]}>
                Device battery threshold to allow recording
              </Text>
            </View>
            <Stepper
              value={settings.minBatteryForRecording}
              unit="%"
              onDecrement={() =>
                settings.setMinBatteryForRecording(
                  Math.max(5, settings.minBatteryForRecording - 5),
                )
              }
              onIncrement={() =>
                settings.setMinBatteryForRecording(
                  Math.min(30, settings.minBatteryForRecording + 5),
                )
              }
              theme={theme}
            />
          </View>

          {/* Notifications */}
          <View
            style={[
              styles.settingRow,
              settings.notificationsEnabled && settings.notificationPermissionStatus === 'denied' && {
                borderBottomWidth: StyleSheet.hairlineWidth,
                borderBottomColor: theme.colors.elevated,
              },
            ]}
          >
            <View style={styles.settingLeft}>
              <Text style={[theme.type.body, { color: theme.text.primary }]}>Notifications</Text>
              <Text style={[theme.type.small, { color: theme.text.muted, marginTop: 2 }]}>
                Exercise reminders and session summaries
              </Text>
            </View>
            <Switch
              value={settings.notificationsEnabled}
              onValueChange={settings.setNotificationsEnabled}
              trackColor={{ false: theme.colors.elevated, true: theme.primary[500] }}
              thumbColor={theme.text.onColor}
            />
          </View>

          {/* OS permission warning — only when explicitly denied, not undetermined */}
          {settings.notificationsEnabled && settings.notificationPermissionStatus === 'denied' && (
            <Pressable
              onPress={() => Linking.openSettings()}
              style={[styles.settingRow, { gap: 8, paddingVertical: 10 }]}
            >
              <Ionicons name="warning-outline" size={18} color={theme.semantic.warning} />
              <Text
                style={[
                  theme.type.small,
                  { color: theme.semantic.warning, flex: 1 },
                ]}
              >
                Notifications are enabled but your iPhone has blocked them. Tap to open Settings.
              </Text>
            </Pressable>
          )}
        </SettingGroup>

        {/* ================================================================
         * ABOUT section
         * ================================================================ */}
        <SectionHeader label="About" theme={theme} />

        <SettingGroup theme={theme}>
          <InfoRow label="Firmware" value="RG v1.0 PhaseC" theme={theme} />
          <InfoRow label="App Version" value="1.0.0" theme={theme} />
          <InfoRow
            label="Device Name"
            value={deviceState.connected ? 'RamblingGuard' : '—'}
            theme={theme}
          />
          <View
            style={[styles.row, { minHeight: 50 }]}
          >
            <Text style={[theme.type.body, { color: theme.text.primary }]}>Battery</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={[theme.type.body, { color: deviceState.connected ? batteryColor : theme.text.secondary }]}>
                {deviceState.connected ? `${deviceState.battery}%` : '—'}
              </Text>
              {deviceState.connected && batteryAgeLabel !== '' && (
                <Text
                  style={[
                    theme.type.small,
                    {
                      color: batteryFresh ? theme.semantic.success : theme.text.muted,
                      fontFamily: theme.fontFamily.semibold,
                    },
                  ]}
                >
                  {batteryAgeLabel}
                </Text>
              )}
            </View>
          </View>
        </SettingGroup>

        {/* Bottom padding */}
        <View style={{ height: 40 }} />
      </ScrollView>
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
  /** Simple info row — label | value */
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 50,
  },
  /** Setting row with left text block + right control */
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    minHeight: 64,
  },
  settingLeft: {
    flex: 1,
  },
  /** Segmented control group */
  segmentGroup: {
    flexDirection: 'row',
    gap: 4,
  },
  /** Single segment button — 44dp square (for numeric labels) */
  segment: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /** Wider segment for text labels (LED / Vibrate / Both) */
  segmentWide: {
    width: undefined,
    paddingHorizontal: 14,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /** Stepper [−] value [+] */
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thresholdRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  applyBtn: {
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  successToast: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: 'center',
  },
});
