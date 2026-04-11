/**
 * Notification Service — permission request, scheduling, and local push.
 *
 * All outbound notifications go through here. Callers never import
 * expo-notifications directly; they use these typed wrappers instead.
 */
import * as ExpoNotifications from 'expo-notifications';
import { Platform } from 'react-native';
import { getDatabase } from '../db/database';
import { getCurrentStreak } from '../db/exercises';

// Configure notification handler — must be called at module level so it is
// registered before any notification can fire.
ExpoNotifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

// ─── Permissions ─────────────────────────────────────────────────────────────

/** Request notification permissions. Returns true if granted. */
export async function requestNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  const { status: existing } = await ExpoNotifications.getPermissionsAsync();
  if (existing === 'granted') return true;
  const { status } = await ExpoNotifications.requestPermissionsAsync();
  return status === 'granted';
}

/** Read OS notification permission status without prompting. */
export async function getNotificationPermissionStatus(): Promise<'granted' | 'denied' | 'undetermined'> {
  if (Platform.OS === 'web') return 'denied';
  const { status } = await ExpoNotifications.getPermissionsAsync();
  if (status === 'granted') return 'granted';
  if (status === 'denied') return 'denied';
  return 'undetermined';
}

// ─── Daily exercise reminder ──────────────────────────────────────────────────

/** Schedule a daily exercise reminder. Cancels any existing one first. */
export async function scheduleDailyExerciseReminder(hourOfDay = 8): Promise<void> {
  await cancelDailyExerciseReminder();

  await ExpoNotifications.scheduleNotificationAsync({
    content: {
      title: 'Time to practice 🎙',
      body: 'Your daily voice exercises are ready. 2 minutes to sharper speech.',
      data: { type: 'exercise_reminder' },
    },
    trigger: {
      type: ExpoNotifications.SchedulableTriggerInputTypes.DAILY,
      hour: hourOfDay,
      minute: 0,
    },
  });
}

/** Cancel the daily exercise reminder. */
export async function cancelDailyExerciseReminder(): Promise<void> {
  const scheduled = await ExpoNotifications.getAllScheduledNotificationsAsync();
  for (const n of scheduled) {
    if ((n.content.data as Record<string, unknown>)?.type === 'exercise_reminder') {
      await ExpoNotifications.cancelScheduledNotificationAsync(n.identifier);
    }
  }
}

// ─── Session summary ──────────────────────────────────────────────────────────

/** Send an immediate local notification for a completed session. */
export async function sendSessionSummaryNotification(
  durationMs: number,
  alertCount: number,
): Promise<void> {
  const minutes = Math.floor(durationMs / 60_000);
  const seconds = Math.floor((durationMs % 60_000) / 1000);
  const durationStr = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;

  const body =
    alertCount === 0
      ? `Great session — ${durationStr} with no alerts. Clean speech!`
      : `${durationStr} session — ${alertCount} alert${alertCount === 1 ? '' : 's'} triggered.`;

  await ExpoNotifications.scheduleNotificationAsync({
    content: {
      title: 'Session complete',
      body,
      data: { type: 'session_summary' },
    },
    trigger: null, // immediate
  });

  await saveNotificationRecord('summary', 'Session complete', body);
}

// ─── Low battery ──────────────────────────────────────────────────────────────

/** Send a low battery warning (fires immediately). */
export async function sendLowBatteryNotification(batteryPercent: number): Promise<void> {
  const body = `RamblingGuard battery at ${batteryPercent}%. Charge soon to keep monitoring.`;

  await ExpoNotifications.scheduleNotificationAsync({
    content: {
      title: 'Low battery',
      body,
      data: { type: 'battery_warning' },
    },
    trigger: null,
  });

  await saveNotificationRecord('battery', 'Low battery', body);
}

// ─── Streak milestones ────────────────────────────────────────────────────────

const STREAK_MILESTONES = [3, 7, 14, 30] as const;

const STREAK_MESSAGES: Record<number, string> = {
  3:  '3 days in a row — you\'re building a habit!',
  7:  'One full week of practice. Your voice is getting sharper.',
  14: 'Two weeks strong. You\'re in the top tier of consistent speakers.',
  30: '30 day streak. That\'s elite. Keep it going.',
};

/**
 * Read the current streak and fire a milestone notification if the streak
 * count matches one of the defined milestones. No-ops otherwise.
 */
export async function checkAndSendStreakNotification(): Promise<void> {
  const streak = await getCurrentStreak();
  if (!(STREAK_MILESTONES as readonly number[]).includes(streak)) return;

  const body = STREAK_MESSAGES[streak];
  if (!body) return;

  await ExpoNotifications.scheduleNotificationAsync({
    content: {
      title: `${streak}-day streak 🔥`,
      body,
      data: { type: 'streak_milestone' },
    },
    trigger: null,
  });

  await saveNotificationRecord('streak', `${streak}-day streak`, body);
}

// ─── Internal persistence ─────────────────────────────────────────────────────

async function saveNotificationRecord(
  type: string,
  title: string,
  body: string,
): Promise<void> {
  try {
    const db = await getDatabase();
    await db.runAsync(
      'INSERT INTO notifications (type, title, body, sent_at, read) VALUES (?, ?, ?, ?, 0)',
      [type, title, body, Date.now()],
    );
  } catch (e) {
    console.warn('[Notifications] Failed to save record:', e);
  }
}
