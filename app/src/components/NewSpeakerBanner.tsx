/**
 * NewSpeakerBanner — presentational pill shown when unnamed speakers exist.
 *
 * Pure UI component: no state, no store access, no logic.
 * All count derivation and tap handling lives in LiveTranscript.
 */
import { Pressable, Text, StyleSheet } from 'react-native';
import { useTheme } from '../theme/theme';

interface Props {
  unnamedCount: number;
  onPress: () => void;
}

export function NewSpeakerBanner({ unnamedCount, onPress }: Props) {
  const theme = useTheme();

  if (unnamedCount === 0) return null;

  const label =
    unnamedCount === 1
      ? 'New voice detected — tap to name'
      : `${unnamedCount} new voices detected — review names`;

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.pill,
        {
          backgroundColor: theme.primary[500] + '26', // ~15% opacity
          borderRadius: theme.radius.lg,
          marginBottom: theme.spacing.sm,
        },
      ]}
    >
      <Text style={[theme.type.caption, { color: theme.primary[500], fontWeight: '600' }]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignSelf: 'flex-start',
  },
});
