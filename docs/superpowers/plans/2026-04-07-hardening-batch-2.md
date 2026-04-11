# Phase C Hardening Batch 2 — Live Testing Fixes

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix six real-device issues found during live testing: BLE reconnect reliability, session lifecycle clarity, stats freshness, history clutter, pending sync UX, and USB/battery display.

**Architecture:** Firmware changes touch `ble_output.cpp`, `battery_monitor.cpp`, and `config.h`. App changes touch session screen, history screen, DB queries, sync indicator, and device store. All changes are isolated — no new features, no Phase D work.

**Tech Stack:** C++ (Arduino/NimBLE), React Native/Expo, expo-sqlite, zustand, react-native-ble-plx

**Branch:** `feat/phase-c-hardening-batch-1` (continue existing branch)

---

## File Map

| Priority | File | Action | Purpose |
|----------|------|--------|---------|
| P1 | `ble_output.cpp` | Modify:68-74 | Harden disconnect → re-advertising flow |
| P1 | `ble_output.cpp` | Modify:60-66 | Add connect logging with address |
| P3 | `ble_output.cpp` | Modify:348-365 | Decouple session stats from battery cadence |
| P3 | `config.h` | Modify:107 | Add `BLE_STATS_UPDATE_INTERVAL_MS` constant |
| P6 | `battery_monitor.cpp` | Modify:37-48 | Send sentinel value (255) for USB power |
| P2 | `app/app/(tabs)/session.tsx` | Modify:234-361 | Add session lifecycle helper text + End Session button |
| P3 | `app/app/(tabs)/session.tsx` | Modify:303-330 | Already uses useSessionStats — no change needed after firmware fix |
| P4 | `app/src/db/sessions.ts` | Modify:66-73 | Filter junk sessions from history query |
| P4 | `app/src/db/sessions.ts` | Modify:98-118 | Exclude junk sessions from lifetime stats |
| P4 | `app/app/(tabs)/history.tsx` | Modify:258-271 | Document the filter in UI (empty-state copy update) |
| P5 | `app/src/components/SyncStatusIndicator.tsx` | Modify:64-74 | Replace "N pending" with clear explanation |
| P6 | `app/src/services/bleManager.ts` | Modify:284-290 | Handle battery sentinel (255 = USB power) |
| P6 | `app/app/(tabs)/session.tsx` | Modify:244-246 | Show "USB" instead of "0%" for USB power |
| P6 | `app/app/(tabs)/settings.tsx` | Modify battery display | Show "USB Power" when battery is null |
| P6 | `app/src/stores/deviceStore.ts` | Modify | Change battery type to `number | null` |

---

### Task 1: Firmware — Harden BLE disconnect/re-advertising (P1)

**Files:**
- Modify: `ble_output.cpp:59-75`

**Context:** After the phone disconnects, the device sometimes isn't rediscoverable until power-cycled. The current `onDisconnect` calls `NimBLEDevice::startAdvertising()` directly, which may fail silently if advertising is in an intermediate state. The fix: explicitly stop advertising before restarting, add a small delay, and log the advertising restart.

Also improve `onConnect` logging to include the client address (useful for debugging multiple-device scenarios and verifying the connection is real).

- [ ] **Step 1: Harden onDisconnect with stop-then-start advertising**

In `ble_output.cpp`, replace the `BleServerCallbacks` class:

```cpp
class BleServerCallbacks : public NimBLEServerCallbacks {
  void onConnect(NimBLEServer* pServer, NimBLEConnInfo& connInfo) override {
    clientConnected = true;
    // Request faster connection interval: 15-30ms (units of 1.25ms)
    pServer->updateConnParams(connInfo.getConnHandle(), 12, 24, 0, 200);
    Serial.printf("[BLE] Client connected (addr: %s)\n",
                  connInfo.getAddress().toString().c_str());
    eventBusPublish(EVENT_BLE_CONNECTED, 0);
  }

  void onDisconnect(NimBLEServer* pServer, NimBLEConnInfo& connInfo, int reason) override {
    clientConnected = false;
    Serial.printf("[BLE] Client disconnected (reason: 0x%02X)\n", reason);
    eventBusPublish(EVENT_BLE_DISCONNECTED, 0);
    // Stop-then-start to clear any stale advertising state
    NimBLEDevice::getAdvertising()->stop();
    delay(100);  // Allow BLE stack to settle
    NimBLEDevice::startAdvertising();
    Serial.println("[BLE] Advertising restarted after disconnect");
  }
};
```

- [ ] **Step 2: Verify build compiles**

```bash
arduino-cli compile --fqbn esp32:esp32:XIAO_ESP32S3:PSRAM=opi .
```

Expected: Compiles without errors.

- [ ] **Step 3: Commit**

```bash
git add ble_output.cpp
git commit -m "fix(ble): harden disconnect/re-advertising with stop-then-start pattern

Explicitly stop advertising before restarting to clear stale state.
Add 100ms settling delay. Log advertising restart and client address."
```

---

### Task 2: Firmware — Speed up session stats BLE cadence (P3)

**Files:**
- Modify: `config.h:107`
- Modify: `ble_output.cpp:348-365`

**Context:** Session stats (speaking runs, alerts, peak alert, session duration) update every 60 seconds — piggybacked on the battery check interval. The hero timer updates every 250ms via `SPEECH_DUR`, but the stats card visually lags behind because it only refreshes once per minute. Fix: decouple stats from battery and update stats every 5 seconds.

- [ ] **Step 1: Add stats update interval constant**

In `config.h`, after line 107 (`BLE_UPDATE_INTERVAL_MS`), add:

```cpp
#define BLE_STATS_INTERVAL_MS  5000    // How often to push session stats (5s)
```

- [ ] **Step 2: Decouple stats update from battery update**

In `ble_output.cpp`, replace the `bleOutputUpdate()` function:

```cpp
void bleOutputUpdate() {
  if (!clientConnected) return;

  unsigned long now = millis();
  if (now - lastBleUpdate < BLE_UPDATE_INTERVAL_MS) return;
  lastBleUpdate = now;

  // Speech duration: every 250ms (BLE_UPDATE_INTERVAL_MS)
  updateSpeechDuration();

  // Session stats: every 5s (BLE_STATS_INTERVAL_MS)
  static unsigned long lastStatsUpdate = 0;
  if (now - lastStatsUpdate >= BLE_STATS_INTERVAL_MS) {
    updateSessionStats();
    lastStatsUpdate = now;
  }

  // Battery: every 60s (BATTERY_CHECK_INTERVAL_MS)
  static unsigned long lastBatteryUpdate = 0;
  if (now - lastBatteryUpdate >= BATTERY_CHECK_INTERVAL_MS) {
    updateBattery();
    lastBatteryUpdate = now;
  }
}
```

- [ ] **Step 3: Verify build compiles**

```bash
arduino-cli compile --fqbn esp32:esp32:XIAO_ESP32S3:PSRAM=opi .
```

Expected: Compiles without errors.

- [ ] **Step 4: Commit**

```bash
git add config.h ble_output.cpp
git commit -m "fix(ble): update session stats every 5s instead of 60s

Decoupled stats from battery update cadence. Stats card now
refreshes 12x faster so it stays in sync with the live timer."
```

---

### Task 3: Firmware — Send battery sentinel for USB power (P6)

**Files:**
- Modify: `battery_monitor.cpp:37-48`

**Context:** When no battery is connected (USB-only development), the ADC reads near 0V but `batteryPercent` was initialized to 100 and never updated (function returns early when voltage < 2.0V). The app shows 100% or a stale value, which is misleading. Fix: set `batteryPercent` to -1 (sentinel) when voltage < 2.0V, and have the BLE characteristic send 255 (0xFF) to indicate "no battery."

- [ ] **Step 1: Update battery monitor to set USB power sentinel**

In `battery_monitor.cpp`, replace lines 37-48:

```cpp
  batteryPercent = voltageToPercent(voltage);

  Serial.print("[Battery] ");
  Serial.print(voltage, 2);
  Serial.print("V (");
  Serial.print(batteryPercent);
  Serial.println("%)");

  // No battery wired — USB power only. Set sentinel so BLE sends 255.
  if (voltage < 2.0) {
    batteryPercent = -1;
    Serial.println("[Battery] No battery detected (USB power)");
    return;
  }
```

- [ ] **Step 2: Update batteryGetPercent() for BLE encoding**

The existing `batteryGetPercent()` returns `int`, so -1 is valid. The BLE layer in `ble_output.cpp` calls `updateBattery()` which does:

Check `ble_output.cpp` for how battery is sent. It likely uses `uint8_t`, so -1 will naturally wrap to 255 (0xFF). Verify this is the case. If `updateBattery` casts to `uint8_t`, the sentinel will be 255 automatically.

Read `ble_output.cpp` around the `updateBattery()` function to confirm. The `batteryGetPercent()` returns `int`, which will be cast to `uint8_t(255)` when stored in the BLE characteristic. This is correct.

- [ ] **Step 3: Verify build compiles**

```bash
arduino-cli compile --fqbn esp32:esp32:XIAO_ESP32S3:PSRAM=opi .
```

Expected: Compiles without errors.

- [ ] **Step 4: Commit**

```bash
git add battery_monitor.cpp
git commit -m "fix(battery): send 255 sentinel when on USB power

When no battery is connected, batteryPercent is set to -1 which
BLE encodes as 0xFF. App can detect this and show 'USB Power'
instead of a misleading percentage."
```

---

### Task 4: App — Handle USB power battery sentinel + display (P6)

**Files:**
- Modify: `app/src/stores/deviceStore.ts` — change battery type
- Modify: `app/src/services/bleManager.ts:284-290` — handle sentinel
- Modify: `app/app/(tabs)/session.tsx:244-246` — show "USB" for null battery
- Modify: `app/app/(tabs)/settings.tsx` — show "USB Power" in about section
- Modify: `app/app/(tabs)/index.tsx` — show "USB" in home status

**Context:** Firmware now sends battery=255 when on USB power without a battery. The app needs to interpret 255 as "no battery" and display "USB Power" instead of a percentage. Change `battery` in the device store from `number` to `number | null`, where `null` means USB power / no battery detected.

- [ ] **Step 1: Update DeviceState type**

In `app/src/types/index.ts`, find the `DeviceState` interface and change `battery: number` to `battery: number | null`. Also update the default in `app/src/stores/deviceStore.ts` — change `battery: 100` to `battery: null`.

- [ ] **Step 2: Handle sentinel in BLE manager**

In `app/src/services/bleManager.ts`, update the battery notification handler (around line 284-290):

```typescript
this.subscriptions.push(
  device.monitorCharacteristicForService(SERVICE_UUID, CHR.BATTERY, (_err, chr) => {
    if (chr?.value) {
      this.lastBatteryReadAt = Date.now();
      const raw = parseUint8(chr.value);
      // Firmware sends 255 when no battery connected (USB power)
      this.updateState({ battery: raw === 255 ? null : raw });
    }
  }),
);
```

Also update `readInitialValues` in the same file — find where battery is read initially and apply the same 255 → null mapping.

- [ ] **Step 3: Update Session screen battery display**

In `app/app/(tabs)/session.tsx`, find the battery display (around line 244-246):

```tsx
<Text style={[theme.type.small, { color: theme.text.muted, marginLeft: theme.spacing.sm }]}>
  {deviceState.battery === null ? 'USB' : `${deviceState.battery}%`}
</Text>
```

- [ ] **Step 4: Update Home screen battery display**

In `app/app/(tabs)/index.tsx`, find the battery display text and update:

```tsx
{`RamblingGuard · ${deviceState.battery === null ? 'USB power' : `${deviceState.battery}% battery`}`}
```

- [ ] **Step 5: Update Settings screen battery display**

In `app/app/(tabs)/settings.tsx`, find the battery row in the About section and update to handle null:

If `deviceState.battery === null`, show "USB Power" in green instead of a percentage. Skip the freshness label since it's not meaningful for USB power.

- [ ] **Step 6: Update low-battery notification guard**

In `app/src/services/bleManager.ts`, find the low-battery notification logic (around line 75-88). Add a guard: skip the low-battery check when `next === null` (USB power).

- [ ] **Step 7: Run type check**

```bash
cd app && node node_modules/typescript/bin/tsc --noEmit
```

Expected: No errors.

- [ ] **Step 8: Commit**

```bash
cd app && git add src/types/index.ts src/stores/deviceStore.ts src/services/bleManager.ts ../app/\(tabs\)/session.tsx ../app/\(tabs\)/index.tsx ../app/\(tabs\)/settings.tsx
git commit -m "fix(ui): show 'USB Power' when no battery connected

Firmware sends battery=255 for USB power. App maps 255→null and
displays 'USB' or 'USB Power' instead of a misleading percentage."
```

---

### Task 5: App — Session lifecycle helper copy + End Session (P2)

**Files:**
- Modify: `app/app/(tabs)/session.tsx:234-361`

**Context:** Users don't understand when a session starts, ends, or appears in History. Today's model: a session = one BLE connection window. It starts on connect, ends on disconnect. Silence doesn't end it. The UI needs to make this explicit. Also add an "End Session" button that intentionally disconnects (equivalent to tapping Disconnect, but with clearer intent).

- [ ] **Step 1: Add session model helper text**

In `app/app/(tabs)/session.tsx`, after the `SyncStatusIndicator` (around line 250-252), add a helper card:

```tsx
{/* -- Session Info -- */}
<View style={[styles.card, { backgroundColor: theme.colors.card, borderRadius: theme.radius.xl, marginTop: theme.spacing.md }]}>
  <Text style={[theme.type.small, { color: theme.text.tertiary, lineHeight: 18 }]}>
    This session started when you connected. It will save to History when you disconnect or tap End Session below.
  </Text>
</View>
```

- [ ] **Step 2: Replace "Disconnect" button with "End Session"**

In `app/app/(tabs)/session.tsx`, find the Disconnect button (around line 346-360) and replace:

```tsx
{/* -- End Session button -- */}
<Pressable
  onPress={handleDisconnect}
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
  Saves session to History and disconnects from device
</Text>
```

- [ ] **Step 3: Run type check**

```bash
cd app && node node_modules/typescript/bin/tsc --noEmit
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
cd app && git add app/\(tabs\)/session.tsx
git commit -m "feat(ui): add session lifecycle helper copy and End Session button

Explains that sessions are connection-window based.
Renames Disconnect to 'End Session' with supporting copy
so users understand when sessions save to History."
```

---

### Task 6: App — Filter junk sessions from History (P4)

**Files:**
- Modify: `app/src/db/sessions.ts:66-73` (getSessions query)
- Modify: `app/src/db/sessions.ts:98-118` (getLifetimeStats query)

**Context:** History shows many 0-second, 0-speech entries from reconnect noise. These are connection windows that connected/disconnected immediately with no meaningful activity. Filter rule: exclude finalized sessions where `duration_ms < 5000 AND speech_segments = 0 AND alert_count = 0`. This catches reconnect noise while preserving any session where the user actually spoke or got an alert, even if brief.

- [ ] **Step 1: Update getSessions to filter junk**

In `app/src/db/sessions.ts`, update the `getSessions` function:

```typescript
/** Get sessions ordered newest first, excluding reconnect noise. */
export async function getSessions(limit = 50): Promise<Session[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<any>(
    `SELECT * FROM sessions
     WHERE ended_at IS NOT NULL
       AND NOT (duration_ms < 5000 AND speech_segments = 0 AND alert_count = 0)
     ORDER BY started_at DESC LIMIT ?`,
    [limit],
  );
  return rows.map(parseSession);
}
```

Note: we also filter out `ended_at IS NULL` (active sessions shouldn't appear in history).

- [ ] **Step 2: Update getLifetimeStats to exclude junk**

In `app/src/db/sessions.ts`, update the `getLifetimeStats` function:

```typescript
/** Get lifetime stats: total sessions, total speech time, total alerts */
export async function getLifetimeStats(): Promise<{
  totalSessions: number;
  totalSpeechMs: number;
  totalAlerts: number;
  avgAlertsPer: number;
}> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<any>(
    `SELECT COUNT(*) as count, SUM(duration_ms) as total_ms, SUM(alert_count) as total_alerts
     FROM sessions
     WHERE ended_at IS NOT NULL
       AND NOT (duration_ms < 5000 AND speech_segments = 0 AND alert_count = 0)`,
  );
  const count = row?.count ?? 0;
  const totalMs = row?.total_ms ?? 0;
  const totalAlerts = row?.total_alerts ?? 0;
  return {
    totalSessions: count,
    totalSpeechMs: totalMs,
    totalAlerts,
    avgAlertsPer: count > 0 ? Math.round(totalAlerts / count) : 0,
  };
}
```

- [ ] **Step 3: Run type check**

```bash
cd app && node node_modules/typescript/bin/tsc --noEmit
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
cd app && git add src/db/sessions.ts
git commit -m "fix(history): filter reconnect-noise sessions from History

Exclude sessions < 5s with 0 speech and 0 alerts from both the
session list and lifetime stats. Documented filter rule in query."
```

---

### Task 7: App — Fix pending sync UX (P5)

**Files:**
- Modify: `app/src/components/SyncStatusIndicator.tsx:64-74`

**Context:** "N pending" is not tappable, not explained, and confusing. In the current architecture, "pending" means "local sessions not yet synced to device via BLE." This sync feature isn't fully user-facing yet — it's infrastructure. Best short-term fix: hide the pending count when idle (it's not actionable) and only show sync status during active sync operations or after success/failure.

- [ ] **Step 1: Remove idle pending count display**

In `app/src/components/SyncStatusIndicator.tsx`, replace the IDLE fallback section (lines 64-87):

```tsx
  // IDLE — only show "Synced" confirmation if a sync completed this session.
  // Hide pending count — it's internal infrastructure, not actionable by the user.
  if (lastSyncAt !== null) {
    return (
      <View style={[styles.pill, { backgroundColor: theme.colors.card, borderRadius: theme.radius.full }]}>
        <Ionicons name="checkmark-circle-outline" size={14} color={theme.text.muted} />
        <Text style={[theme.type.small, { color: theme.text.muted }]}>
          Synced
        </Text>
      </View>
    );
  }

  return null;
```

- [ ] **Step 2: Run type check**

```bash
cd app && node node_modules/typescript/bin/tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
cd app && git add app/src/components/SyncStatusIndicator.tsx
git commit -m "fix(ui): hide non-actionable pending sync count

Remove 'N pending' display — it showed internal sync state that
users couldn't act on. Now only shows status during active sync
or after completion."
```

---

### Task 8: Verify all changes compile + type check

**Files:** None (verification only)

- [ ] **Step 1: Firmware build**

```bash
cd /Users/carlos/Workspace/rambling-guardian && arduino-cli compile --fqbn esp32:esp32:XIAO_ESP32S3:PSRAM=opi .
```

Expected: Compiles without errors. Note flash size — should be close to the Phase B baseline (441KB).

- [ ] **Step 2: App type check**

```bash
cd /Users/carlos/Workspace/rambling-guardian/app && node node_modules/typescript/bin/tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Push changes**

```bash
git push origin feat/phase-c-hardening-batch-1
```

---

## Report Template (fill after completion)

**What changed:**
1. BLE disconnect now uses stop-then-start advertising pattern with 100ms settling delay
2. Session stats BLE cadence changed from 60s → 5s
3. Battery sentinel (255) sent when on USB power, app shows "USB Power"
4. Session screen: helper text explains session model, "Disconnect" → "End Session"
5. History: filters out reconnect noise (<5s, 0 speech, 0 alerts)
6. Sync indicator: hides non-actionable "N pending" count

**What was intentionally not changed:**
- Session model remains connection-window based (no conversation heuristics)
- Auto-reconnect flow unchanged (already working)
- Visual style unchanged
- No Phase D features added

**Current session model:**
A session begins the moment your phone connects to the RamblingGuard device over Bluetooth, and it ends when you disconnect — either by tapping "End Session" or by walking out of range. Everything that happens during that connection window (speech duration, alerts, speaking runs) is recorded as one session entry. Silence pauses don't end the session; only disconnection does. When the session ends, it's saved to History and a summary notification is sent.

**Reconnect bug findings:**
The firmware's `onDisconnect` callback called `NimBLEDevice::startAdvertising()` directly without first stopping the existing advertising state. On ESP32/NimBLE, calling `startAdvertising()` when advertising is in a transitional state can silently fail, leaving the device undiscoverable. Fix: explicit `stop()` → 100ms delay → `start()` pattern. Also added client address logging on connect for debugging.

**Risks/follow-up:**
- History filter is conservative (5s threshold) — may need tuning based on real usage
- Session stats at 5s cadence adds minor BLE bandwidth — monitor for connection stability
- "End Session" button uses the same `handleDisconnect` flow — if disconnect behavior changes later, the button semantics stay aligned
- `pendingSyncCount` is still tracked internally, just hidden from UI — can be re-exposed when sync becomes user-facing
