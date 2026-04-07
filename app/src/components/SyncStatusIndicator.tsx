/**
 * SyncStatusIndicator — compact pill showing BLE sync status.
 *
 * Reads from sessionStore and displays one of three states:
 * - Pending: "N pending" with clock icon
 * - Syncing: "Syncing..." with activity indicator
 * - Synced: "Synced" with checkmark icon
 */
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/theme';
import { useSessionStore } from '../stores/sessionStore';

export default function SyncStatusIndicator() {
  const theme = useTheme();
  const pendingSyncCount = useSessionStore((s) => s.pendingSyncCount);
  const isSyncing = useSessionStore((s) => s.isSyncing);
  const lastSyncAt = useSessionStore((s) => s.lastSyncAt);

  if (isSyncing) {
    return (
      <View style={[styles.pill, { backgroundColor: theme.colors.card, borderRadius: theme.radius.full }]}>
        <ActivityIndicator size="small" color={theme.text.muted} />
        <Text style={[theme.type.small, { color: theme.text.muted }]}>
          Syncing...
        </Text>
      </View>
    );
  }

  if (pendingSyncCount > 0) {
    return (
      <View style={[styles.pill, { backgroundColor: theme.colors.card, borderRadius: theme.radius.full }]}>
        <Ionicons name="time-outline" size={14} color={theme.text.muted} />
        <Text style={[theme.type.small, { color: theme.text.muted }]}>
          {pendingSyncCount} pending
        </Text>
      </View>
    );
  }

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

  // No sync state to display yet
  return null;
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 6,
  },
});
