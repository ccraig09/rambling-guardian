import { View, Text } from 'react-native';
import { useDeviceStore } from '../../src/stores/deviceStore';

export default function HomeScreen() {
  const connected = useDeviceStore((s) => s.connected);
  const battery = useDeviceStore((s) => s.battery);

  return (
    <View style={{ flex: 1, backgroundColor: '#0F172A', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
      <Text style={{ color: '#F1F5F9', fontSize: 24, fontWeight: '700', marginBottom: 8 }}>
        Rambling Guardian
      </Text>
      <Text style={{ color: '#94A3B8', fontSize: 14, textAlign: 'center' }}>
        {connected
          ? `Device connected - ${battery}% battery`
          : 'No device connected. Go to Session tab to connect.'}
      </Text>
    </View>
  );
}
