/**
 * SpeakerPicker — bottom-sheet modal for reassigning a speaker identity.
 */
import { useState } from 'react';
import { View, Text, Pressable, TextInput, Modal, StyleSheet } from 'react-native';
import { useTheme } from '../theme/theme';
import { speakerService } from '../services/speakerService';
import { useSpeakerStore } from '../stores/speakerStore';

interface Props {
  diarizedLabel: string;
  visible: boolean;
  onClose: () => void;
}

export function SpeakerPicker({ diarizedLabel, visible, onClose }: Props) {
  const theme = useTheme();
  const mappings = useSpeakerStore((s) => s.mappings);
  const [customName, setCustomName] = useState('');

  // Collect existing display names for quick selection
  const existingNames = new Set<string>();
  existingNames.add('Me');
  for (const m of Object.values(mappings)) {
    if (m.displayName !== 'Me') existingNames.add(m.displayName);
  }

  function handleSelect(name: string) {
    speakerService.reassignSpeaker(diarizedLabel, name);
    onClose();
  }

  function handleCustomSubmit() {
    if (customName.trim()) {
      speakerService.reassignSpeaker(diarizedLabel, customName.trim());
      setCustomName('');
      onClose();
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={[styles.sheet, { backgroundColor: theme.colors.card, borderRadius: theme.radius.xl }]}>
          <Text style={[theme.type.subtitle, { color: theme.text.primary, marginBottom: theme.spacing.md }]}>
            Who is {diarizedLabel}?
          </Text>

          {[...existingNames].map((name) => (
            <Pressable
              key={name}
              onPress={() => handleSelect(name)}
              style={[styles.option, { borderColor: theme.colors.elevated, borderRadius: theme.radius.lg }]}
            >
              <Text style={[theme.type.body, { color: theme.text.primary }]}>{name}</Text>
            </Pressable>
          ))}

          <View style={[styles.customRow, { marginTop: theme.spacing.md }]}>
            <TextInput
              value={customName}
              onChangeText={setCustomName}
              placeholder="Custom name..."
              placeholderTextColor={theme.text.muted}
              style={[
                styles.input,
                {
                  color: theme.text.primary,
                  borderColor: theme.colors.elevated,
                  borderRadius: theme.radius.lg,
                },
              ]}
              onSubmitEditing={handleCustomSubmit}
              returnKeyType="done"
            />
          </View>

          <Pressable
            onPress={onClose}
            style={[styles.cancelButton, { marginTop: theme.spacing.md }]}
          >
            <Text style={[theme.type.body, { color: theme.text.muted }]}>Cancel</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    padding: 20,
    paddingBottom: 40,
  },
  option: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    marginBottom: 8,
  },
  customRow: {
    flexDirection: 'row',
  },
  input: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    fontSize: 16,
  },
  cancelButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
});
