import { View, Text } from 'react-native';

export default function HistoryScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: '#0F172A', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
      <Text style={{ color: '#F1F5F9', fontSize: 20, fontWeight: '600' }}>
        History
      </Text>
      <Text style={{ color: '#64748B', fontSize: 14, marginTop: 8 }}>
        Session history + analytics (C.7)
      </Text>
    </View>
  );
}
