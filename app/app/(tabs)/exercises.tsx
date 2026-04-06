import { View, Text } from 'react-native';

export default function ExercisesScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: '#0F172A', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
      <Text style={{ color: '#F1F5F9', fontSize: 20, fontWeight: '600' }}>
        Exercises
      </Text>
      <Text style={{ color: '#64748B', fontSize: 14, marginTop: 8 }}>
        Daily voice exercises + streaks (C.4.5)
      </Text>
    </View>
  );
}
