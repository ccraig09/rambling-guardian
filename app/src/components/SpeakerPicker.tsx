/**
 * SpeakerPicker — bottom-sheet modal for assigning a speaker identity.
 *
 * Shows: "Me" | library names (past sessions, recency order) | custom input.
 * Library names already used in this session are deduplicated.
 * Saves confirmed names to the cross-session speaker library.
 */
import { useState } from 'react';
import { View, Text, Pressable, TextInput, Modal, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { useTheme } from '../theme/theme';
import { speakerService } from '../services/speakerService';
import { speakerLibraryService } from '../services/speakerLibraryService';
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

  // Display names already used in this session (excluding "Me")
  const sessionNames = new Set<string>(
    Object.values(mappings)
      .map((m) => m.displayName)
      .filter((n) => n !== 'Me'),
  );

  // Library names ordered by recency, deduped against session names
  const libraryNames = speakerLibraryService
    .getLibraryNames()
    .filter((n) => !sessionNames.has(n));

  function confirmName(name: string) {
    speakerService.reassignSpeaker(diarizedLabel, name);
    if (name !== 'Me') {
      speakerLibraryService.addSpeaker(name).catch(console.warn); // persist to library
    }
    onClose();
  }

  function handleCustomSubmit() {
    const trimmed = customName.trim();
    if (trimmed) {
      confirmName(trimmed);
      setCustomName('');
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardAvoiding}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={[styles.sheet, { backgroundColor: theme.colors.card, borderRadius: theme.radius.xl }]}>
          <Text style={[theme.type.subtitle, { color: theme.text.primary, marginBottom: theme.spacing.md }]}>
            Who is {diarizedLabel}?
          </Text>

          {/* Always-first: Me */}
          <Pressable
            onPress={() => confirmName('Me')}
            style={[styles.option, { borderColor: theme.colors.elevated, borderRadius: theme.radius.lg }]}
          >
            <Text style={[theme.type.body, { color: theme.text.primary }]}>Me</Text>
          </Pressable>

          {/* Library names: past speakers, most recently seen first */}
          {libraryNames.map((name) => (
            <Pressable
              key={name}
              onPress={() => confirmName(name)}
              style={[styles.option, { borderColor: theme.colors.elevated, borderRadius: theme.radius.lg }]}
            >
              <Text style={[theme.type.body, { color: theme.text.primary }]}>{name}</Text>
            </Pressable>
          ))}

          {/* Unknown / Not sure yet option */}
          <Pressable
            onPress={() => {
              speakerService.reassignSpeaker(diarizedLabel, diarizedLabel);
              onClose();
            }}
            style={[styles.option, { borderColor: theme.colors.elevated, borderRadius: theme.radius.lg }]}
          >
            <Text style={[theme.type.body, { color: theme.text.muted }]}>Unknown / Not sure yet</Text>
          </Pressable>

          {/* Custom name input */}
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
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  keyboardAvoiding: {
    flex: 1,
  },
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
