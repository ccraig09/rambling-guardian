/**
 * SessionContextPill — shows detected session context (solo / with others / presenting).
 *
 * Tappable: opens an override picker so the user can correct the classification.
 * Purely presentational — all state management is in the parent.
 */
import { Pressable, Text, StyleSheet } from 'react-native';
import { useTheme } from '../theme/theme';
import type { SessionContext } from '../types';

const CONTEXT_LABELS: Record<SessionContext, string> = {
  solo: 'Solo',
  with_others: 'With Others',
  presentation: 'Presenting',
};

interface Props {
  context: SessionContext | null;
  isOverride: boolean;
  onPress: () => void;
}

export function SessionContextPill({ context, isOverride, onPress }: Props) {
  const theme = useTheme();

  if (!context) return null;

  const label = CONTEXT_LABELS[context] + (isOverride ? ' ·' : '');

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.pill,
        {
          backgroundColor: theme.colors.card,
          borderRadius: theme.radius.full,
        },
      ]}
    >
      <Text style={[theme.type.small, { color: theme.text.secondary }]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
});
