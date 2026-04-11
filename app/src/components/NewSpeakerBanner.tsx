/**
 * NewSpeakerBanner — presentational pill shown when unnamed speakers exist.
 *
 * Pure UI component: no state, no store access, no logic.
 * All count derivation and tap handling lives in LiveTranscript.
 */
import { Pressable, Text, View, StyleSheet } from 'react-native';
import { useTheme } from '../theme/theme';
import { fontFamily } from '../theme/typography';

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
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: theme.colors.elevated,
          borderRadius: theme.radius.lg,
          borderLeftColor: theme.primary[500],
          marginBottom: theme.spacing.sm,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      <View
        style={[
          styles.dot,
          { backgroundColor: theme.primary[500] },
        ]}
      />
      <Text style={[theme.type.caption, { color: theme.text.secondary, fontFamily: fontFamily.semibold }]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderLeftWidth: 4,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 8,
  },
});
