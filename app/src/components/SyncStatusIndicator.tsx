/**
 * SyncStatusIndicator — compact pill showing BLE sync status.
 *
 * Uses the explicit SyncPhase from the sync engine when available,
 * falling back to the simpler pendingSyncCount/isSyncing for IDLE phase.
 */
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/theme';
import { useSessionStore } from '../stores/sessionStore';
import { SyncPhase } from '../types';

export default function SyncStatusIndicator() {
  const theme = useTheme();
  const syncPhase = useSessionStore((s) => s.syncPhase);
  const pendingSyncCount = useSessionStore((s) => s.pendingSyncCount);
  const lastSyncAt = useSessionStore((s) => s.lastSyncAt);

  // Phase-driven states (sync engine is active)
  if (syncPhase === SyncPhase.REQUESTING_MANIFEST) {
    return (
      <View style={[styles.pill, { backgroundColor: theme.colors.card, borderRadius: theme.radius.full }]}>
        <ActivityIndicator size="small" color={theme.text.muted} />
        <Text style={[theme.type.small, { color: theme.text.muted }]}>
          Preparing sync...
        </Text>
      </View>
    );
  }

  if (syncPhase === SyncPhase.IMPORTING || syncPhase === SyncPhase.FINALIZING) {
    return (
      <View style={[styles.pill, { backgroundColor: theme.colors.card, borderRadius: theme.radius.full }]}>
        <ActivityIndicator size="small" color={theme.text.muted} />
        <Text style={[theme.type.small, { color: theme.text.muted }]}>
          Syncing...
        </Text>
      </View>
    );
  }

  if (syncPhase === SyncPhase.FAILED) {
    return (
      <View style={[styles.pill, { backgroundColor: theme.colors.card, borderRadius: theme.radius.full }]}>
        <Ionicons name="alert-circle-outline" size={14} color={theme.semantic.warning} />
        <Text style={[theme.type.small, { color: theme.semantic.warning }]}>
          Sync failed
        </Text>
      </View>
    );
  }

  if (syncPhase === SyncPhase.COMPLETE) {
    return (
      <View style={[styles.pill, { backgroundColor: theme.colors.card, borderRadius: theme.radius.full }]}>
        <Ionicons name="checkmark-circle-outline" size={14} color={theme.text.muted} />
        <Text style={[theme.type.small, { color: theme.text.muted }]}>
          Synced
        </Text>
      </View>
    );
  }

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
