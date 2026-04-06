import { View, Text } from 'react-native';

export default function SettingsScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: '#0F172A', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
      <Text style={{ color: '#F1F5F9', fontSize: 20, fontWeight: '600' }}>
        Settings
      </Text>
      <Text style={{ color: '#64748B', fontSize: 14, marginTop: 8 }}>
        Device settings + app preferences (C.8)
      </Text>
    </View>
  );
}
